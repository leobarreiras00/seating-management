using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;
using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SeatCsvController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMqttService _mqttService; 
        private const long MaxFileSizeBytes = 5 * 1024 * 1024; 

        public SeatCsvController(AppDbContext context, IMqttService mqttService)
        {
            _context = context;
            _mqttService = mqttService;
        }

        // 👇 ROTA ATUALIZADA: Suporta Receção de Ficheiros do Telemóvel e Modo Replace/Append
        [HttpPost("import/{eventId}")]
        public async Task<IActionResult> ImportCsv(int eventId, IFormFile file, [FromQuery] string mode = "replace")
        {
            if (file == null || file.Length == 0) return BadRequest("Ficheiro inválido.");
            if (file.Length > MaxFileSizeBytes) return BadRequest("O ficheiro excede 5MB.");

            var fileName = file.FileName ?? "";
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            if (extension != ".csv") return BadRequest("Apenas ficheiros .csv são permitidos.");

            try
            {
                using var stream = file.OpenReadStream();
                using var reader = new StreamReader(stream);
                
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    Delimiter = ";", 
                    MissingFieldFound = null,
                    HeaderValidated = null, 
                    PrepareHeaderForMatch = args => args.Header?.ToLower().Replace("\ufeff", "").Replace(" ", "").Trim() ?? string.Empty
                };

                using var csv = new CsvReader(reader, config);
                var records = csv.GetRecords<SeatCsvRecord>().ToList();

                if (!records.Any()) return BadRequest("Ficheiro vazio.");

                // LÓGICA SÉNIOR: Substituir vs Adicionar
                if (mode.ToLower() == "replace")
                {
                    var existingSeats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
                    _context.Seats.RemoveRange(existingSeats);
                }

                var seatsToInsert = new List<Seat>();
                foreach (var record in records)
                {
                    if (record == null) continue;

                    var mesa = SanitizeInput(record.Mesa);
                    var lugar = SanitizeInput(record.Lugar);
                    var categoria = SanitizeInput(record.Categoria);
                    var nome = SanitizeInput(record.Nome);

                    var seatNumber = string.IsNullOrEmpty(mesa) ? lugar : $"{mesa}-{lugar}";

                    seatsToInsert.Add(new Seat
                    {
                        EventId = eventId, 
                        SeatNumber = seatNumber,
                        EventName = categoria,
                        AssignedTo = string.IsNullOrWhiteSpace(nome) ? null : nome,
                        Status = SeatStatus.Vazio,
                        Version = 1
                    });
                }

                _context.Seats.AddRange(seatsToInsert);
                await _context.SaveChangesAsync();

                if (_mqttService != null) _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

                return Ok(new { message = $"{seatsToInsert.Count} lugares importados." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erro interno: {ex.Message}");
            }
        }

        // 👇 ROTA ATUALIZADA: Limpa APENAS os dados do Evento selecionado!
        [HttpPost("clear/{eventId}")]
        public async Task<IActionResult> ClearDatabase(int eventId, [FromBody] ClearDatabaseDto request)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Pin, user.PinHash))
                return Forbid("PIN de gestão inválido.");

            // Apaga SÓ os dados deste evento, não a BD toda!
            var seatsToDelete = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            _context.Seats.RemoveRange(seatsToDelete);
            await _context.SaveChangesAsync();

            if (_mqttService != null) _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

            return Ok(new { Message = "Dados do evento limpos com sucesso!" });
        }

        private string SanitizeInput(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            input = input.Trim();
            if (input.StartsWith("=") || input.StartsWith("+") || input.StartsWith("-") || input.StartsWith("@"))
                input = Regex.Replace(input, @"^[=\+\-\@]+", "");
            return input;
        }
    }
}