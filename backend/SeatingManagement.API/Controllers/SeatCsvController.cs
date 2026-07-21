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

        // 👇 ROTA ATUALIZADA: Agora com Limpeza Automática de Duplicados!
        [HttpPost("import/{eventId}")]
        public async Task<IActionResult> ImportCsv(int eventId, IFormFile file, [FromQuery] string mode = "replace")
        {
            if (file == null || file.Length == 0) return BadRequest("Ficheiro inválido.");
            if (file.Length > MaxFileSizeBytes) return BadRequest("O ficheiro excede 5MB.");

            var fileName = file.FileName ?? "";
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            if (extension != ".csv" && extension != ".txt") return BadRequest("Formato de ficheiro não suportado.");

            try
            {
                var newSeats = new List<Seat>();
                using var stream = file.OpenReadStream();
                using var reader = new StreamReader(stream);
                
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    Delimiter = ";", 
                    MissingFieldFound = null 
                };

                using var csv = new CsvReader(reader, config);
                csv.Read();
                csv.ReadHeader();

                while (csv.Read())
                {
                    csv.TryGetField("MESA", out string? rawMesa);
                    csv.TryGetField("LUGAR", out string? rawLugar);
                    csv.TryGetField("CATEGORIA", out string? rawCategoria);
                    csv.TryGetField("ESTADO", out string? rawEstado);
                    csv.TryGetField("NOME", out string? rawNome);

                    string mesa = SanitizeInput(rawMesa);
                    string lugar = SanitizeInput(rawLugar);
                    string categoria = SanitizeInput(rawCategoria);
                    string statusStr = SanitizeInput(rawEstado);
                    string nome = SanitizeInput(rawNome);

                    if (string.IsNullOrWhiteSpace(mesa) && string.IsNullOrWhiteSpace(lugar) && string.IsNullOrWhiteSpace(nome))
                        continue;

                    string seatNumber = string.IsNullOrWhiteSpace(mesa) ? lugar : (string.IsNullOrWhiteSpace(lugar) ? mesa : $"{mesa}-{lugar}");

                    int status = 0; 
                    if (statusStr.Equals("Validado", StringComparison.OrdinalIgnoreCase)) status = 1;
                    else if (statusStr.Equals("Tratado", StringComparison.OrdinalIgnoreCase)) status = 2;

                    newSeats.Add(new Seat
                    {
                        EventId = eventId,
                        SeatNumber = seatNumber,
                        EventName = categoria,
                        Status = (SeatStatus)status, 
                        AssignedTo = nome,
                        Version = 1,
                        MarkedAt = status != 0 ? DateTime.UtcNow : null 
                    });
                }

                if (mode.Equals("replace", StringComparison.OrdinalIgnoreCase))
                {
                    var existingSeats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
                    _context.Seats.RemoveRange(existingSeats);
                }
                
                await _context.Seats.AddRangeAsync(newSeats);
                await _context.SaveChangesAsync();

                int removedCount = await AutoRemoveDuplicatesAsync(eventId);

                if (_mqttService != null) _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

                string extraMessage = removedCount > 0 ? $" Foram removidos {removedCount} registos duplicados automaticamente." : "";
                return Ok(new { Message = $"Ficheiro importado com sucesso! {newSeats.Count} registos processados em modo '{mode}'.{extraMessage}" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erro a processar o CSV: {ex.Message}");
            }
        }

        [HttpPost("clear/{eventId}")]
        public async Task<IActionResult> ClearDatabase(int eventId, [FromBody] ClearDatabaseDto request)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));

            bool isPinValid = false;
            if (user != null && !string.IsNullOrEmpty(user.PinHash))
            {
                if (user.PinHash == request.Pin)
                {
                    isPinValid = true; 
                }
                else
                {
                    try 
                    {
                        isPinValid = BCrypt.Net.BCrypt.Verify(request.Pin, user.PinHash); 
                    }
                    catch 
                    { 
                        isPinValid = false; 
                    }
                }
            }

            if (!isPinValid)
            {
                return BadRequest(new { Message = "PIN de gestão inválido." });
            }

            var seatsToDelete = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            _context.Seats.RemoveRange(seatsToDelete);
            await _context.SaveChangesAsync();

            if (_mqttService != null) _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

            return Ok(new { Message = "Dados do evento limpos com sucesso!" });
        }

        // 👇 MÉTODO PRIVADO: O motor inteligente que limpa duplicados nos bastidores
        private async Task<int> AutoRemoveDuplicatesAsync(int eventId)
        {
            var allSeats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            var groupedSeats = allSeats.GroupBy(s => s.SeatNumber).Where(g => g.Count() > 1);
            var seatsToRemove = new List<Seat>();

            foreach (var group in groupedSeats)
            {
                // Prioriza os validados/tratados e os mais recentes
                var orderedGroup = group.OrderByDescending(s => (int)s.Status).ThenByDescending(s => s.Id).ToList();
                
                var duplicates = orderedGroup.Skip(1);
                seatsToRemove.AddRange(duplicates);
            }

            if (seatsToRemove.Any())
            {
                _context.Seats.RemoveRange(seatsToRemove);
                await _context.SaveChangesAsync();
                return seatsToRemove.Count;
            }

            return 0;
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