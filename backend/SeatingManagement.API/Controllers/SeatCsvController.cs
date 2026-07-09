using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
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
        private const long MaxFileSizeBytes = 5 * 1024 * 1024; // Limite: 5MB

        public SeatCsvController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("import/{eventId}")]
        public async Task<IActionResult> ImportCsv(int eventId, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest("Por favor, envie um ficheiro CSV válido.");

            if (file.Length > MaxFileSizeBytes)
                return BadRequest("O ficheiro excede o limite máximo de segurança de 5MB.");

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (extension != ".csv")
                return BadRequest("Apenas ficheiros .csv são permitidos.");

            try
            {
                using var stream = file.OpenReadStream();
                using var reader = new StreamReader(stream);
                
                // 👇 A CORREÇÃO ESTÁ AQUI: Configuração robusta do CsvHelper
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    Delimiter = ";", // Lemos o teu ficheiro separado por Ponto e Vírgula
                    MissingFieldFound = null,
                    HeaderValidated = null, // Não falha se faltarem cabeçalhos esperados
                    // MAGIA: Remove espaços e converte para minúsculas para o mapeamento não falhar!
                    PrepareHeaderForMatch = args => args.Header.ToLower().Replace(" ", "").Trim()
                };

                using var csv = new CsvReader(reader, config);
                var records = csv.GetRecords<SeatCsvRecord>().ToList();

                if (!records.Any())
                    return BadRequest("O ficheiro CSV está vazio ou não pôde ser lido.");

                var seatsToInsert = new List<Seat>();

                foreach (var record in records)
                {
                    var mesa = SanitizeInput(record.Mesa);
                    var lugar = SanitizeInput(record.Lugar);
                    var categoria = SanitizeInput(record.Categoria);
                    var nome = SanitizeInput(record.Nome);

                    // Formata para "A-A1" para corresponder exatamente à lógica móvel
                    var seatNumber = string.IsNullOrEmpty(mesa) ? lugar : $"{mesa}-{lugar}";

                    seatsToInsert.Add(new Seat
                    {
                        EventId = eventId, // Associa ao Evento que passaste no Swagger!
                        SeatNumber = seatNumber,
                        EventName = categoria,
                        AssignedTo = string.IsNullOrWhiteSpace(nome) ? null : nome,
                        Status = SeatStatus.Vazio,
                        Version = 1
                    });
                }

                _context.Seats.AddRange(seatsToInsert);
                await _context.SaveChangesAsync();

                return Ok(new { message = $"{seatsToInsert.Count} lugares importados com sucesso para o Evento {eventId}." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erro interno ao processar o ficheiro: {ex.Message}");
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