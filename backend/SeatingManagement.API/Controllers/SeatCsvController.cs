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
        private const long MaxFileSizeBytes = 5 * 1024 * 1024; // Limite: 5MB

        public SeatCsvController(AppDbContext context, IMqttService mqttService)
        {
            _context = context;
            _mqttService = mqttService;
        }

        [HttpPost("import/{eventId}")]
        public async Task<IActionResult> ImportCsv(int eventId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Por favor, envie um ficheiro CSV válido.");

            if (file.Length > MaxFileSizeBytes)
                return BadRequest("O ficheiro excede o limite máximo de segurança de 5MB.");

            // PROTEÇÃO 1: Evitar erro se o FileName for nulo
            var fileName = file.FileName ?? "";
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            
            if (extension != ".csv")
                return BadRequest("Apenas ficheiros .csv são permitidos.");

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
                    // PROTEÇÃO 2: Tratar cabeçalhos nulos (colunas extra vazias) e remover BOM invisível
                    PrepareHeaderForMatch = args => args.Header?.ToLower().Replace("\ufeff", "").Replace(" ", "").Trim() ?? string.Empty
                };

                using var csv = new CsvReader(reader, config);
                var records = csv.GetRecords<SeatCsvRecord>().ToList();

                if (!records.Any())
                    return BadRequest("O ficheiro CSV está vazio ou não pôde ser lido.");

                var seatsToInsert = new List<Seat>();

                foreach (var record in records)
                {
                    // PROTEÇÃO 3: Ignorar linhas completamente nulas devolvidas pelo CsvHelper
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

                // PROTEÇÃO 4: Garantir que se a Injeção de Dependência falhar, não quebra o import
                if (_mqttService != null)
                {
                    _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");
                }

                return Ok(new { message = $"{seatsToInsert.Count} lugares importados com sucesso para o Evento {eventId}." });
            }
            catch (Exception ex)
            {
                // DEBUG PROFUNDO: Devolve o StackTrace para sabermos exatamente qual foi a linha que falhou
                return StatusCode(500, $"Erro interno ao processar o ficheiro: {ex.Message} | Detalhe: {ex.StackTrace}");
            }
        }

        [HttpPost("clear")]
        public async Task<IActionResult> ClearDatabase([FromBody] ClearDatabaseDto request)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Pin, user.PinHash))
            {
                return Forbid("PIN de gestão inválido.");
            }

            _context.Seats.RemoveRange(_context.Seats);
            await _context.SaveChangesAsync();

            if (_mqttService != null)
            {
                _ = _mqttService.PublishCommandAsync(0, "REFRESH");
            }

            return Ok(new { Message = "Base de dados limpa com sucesso!" });
        }

        private string SanitizeInput(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            input = input.Trim();
            if (input.StartsWith("=") || input.StartsWith("+") || input.StartsWith("-") || input.StartsWith("@"))
            {
                input = Regex.Replace(input, @"^[=\+\-\@]+", "");
            }
            return input;
        }
    }
}