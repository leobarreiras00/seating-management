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

        [HttpPost("import/{eventId}")]
        public async Task<IActionResult> ImportCsv(int eventId, IFormFile file, [FromQuery] string mode = "replace")
        {
            if (file == null || file.Length == 0) return BadRequest(new { message = "Ficheiro inválido." });
            if (file.Length > MaxFileSizeBytes) return BadRequest(new { message = "O ficheiro excede 5MB." });

            var fileName = file.FileName ?? "";
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            if (extension != ".csv" && extension != ".txt") return BadRequest(new { message = "Formato de ficheiro não suportado." });

            var ev = await _context.Events.FindAsync(eventId);
            if (ev == null) return NotFound(new { message = "Evento não encontrado." });

            try
            {
                var errors = new List<CsvValidationError>();
                var parsedSeats = new List<Seat>();
                int totalProcessed = 0;

                using var stream = file.OpenReadStream();
                using var reader = new StreamReader(stream);
                
                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    Delimiter = ";", 
                    MissingFieldFound = null,
                    PrepareHeaderForMatch = args => args.Header.Trim().ToLower(),
                    BadDataFound = args => throw new Exception($"A estrutura do ficheiro parece corrompida na linha {args.Context?.Parser?.Row ?? 0}.")
                };

                using var csv = new CsvReader(reader, config);
                csv.Read();
                csv.ReadHeader();

                if (csv.HeaderRecord == null || csv.HeaderRecord.Length < 2)
                {
                    return BadRequest(new { message = "Erro de Tabela: O ficheiro não tem as colunas separadas. Certifica-te de que guardaste o CSV com separador Ponto e Vírgula (;)." });
                }

                while (csv.Read())
                {
                    int rowNum = csv.Parser.Row;

                    csv.TryGetField("MESA", out string? rawMesa);
                    csv.TryGetField("LUGAR", out string? rawLugar);
                    csv.TryGetField("CATEGORIA", out string? rawCategoria);
                    
                    string? rawNome = null;
                    if (!csv.TryGetField("NOME", out rawNome))
                    {
                        if (!csv.TryGetField("NOME,", out rawNome))
                        {
                            try { if (csv.HeaderRecord != null) rawNome = csv.GetField<string>(csv.HeaderRecord.Length - 1); }
                            catch { /* Ignora se falhar */ }
                        }
                    }

                    string mesa = SanitizeInput(rawMesa);
                    string lugar = SanitizeInput(rawLugar);
                    string categoria = SanitizeInput(rawCategoria);
                    string nome = SanitizeInput(rawNome);

                    if (string.IsNullOrWhiteSpace(mesa) && string.IsNullOrWhiteSpace(lugar) && 
                        string.IsNullOrWhiteSpace(nome) && string.IsNullOrWhiteSpace(categoria)) 
                    {
                        continue;
                    }

                    totalProcessed++;
                    bool hasError = false;

                    if (string.IsNullOrWhiteSpace(mesa)) { errors.Add(new CsvValidationError { Line = rowNum, ErrorType = "Falta MESA" }); hasError = true; }
                    if (string.IsNullOrWhiteSpace(lugar)) { errors.Add(new CsvValidationError { Line = rowNum, ErrorType = "Falta LUGAR" }); hasError = true; }

                    if (!hasError)
                    {
                        string seatNumber = $"{mesa}-{lugar}";

                        parsedSeats.Add(new Seat
                        {
                            EventId = eventId,
                            SeatNumber = seatNumber,
                            EventName = categoria,
                            Status = (SeatStatus)0, 
                            AssignedTo = nome,
                            Version = 1,
                            MarkedAt = null 
                        });
                    }
                }

                if (errors.Any())
                {
                    var consolidatedErrors = new List<CsvValidationError>();
                    var grouped = errors.GroupBy(e => e.ErrorType).ToList();
                    
                    foreach (var g in grouped)
                    {
                        if (g.Count() == totalProcessed && totalProcessed > 0)
                        {
                            consolidatedErrors.Add(new CsvValidationError { Line = 0, ErrorType = $"A coluna '{g.Key.Replace("Falta ", "")}' está totalmente vazia ou ausente." });
                        }
                        else
                        {
                            consolidatedErrors.AddRange(g);
                        }
                    }

                    return BadRequest(new { 
                        message = "Falha na Validação do Ficheiro",
                        totalRows = totalProcessed,
                        errors = consolidatedErrors.OrderBy(e => e.Line).ToList()
                    });
                }

                if (mode.Equals("replace", StringComparison.OrdinalIgnoreCase))
                {
                    var existingSeats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
                    _context.Seats.RemoveRange(existingSeats);
                }
                
                await _context.Seats.AddRangeAsync(parsedSeats);
                await _context.SaveChangesAsync();

                int removedCount = await AutoRemoveDuplicatesAsync(eventId);

                // 👇 AUDIT LOG: IMPORTAÇÃO CSV 👇
                var userName = User.Identity?.Name ?? "Sistema";
                var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
                var modeDesc = mode.Equals("replace", StringComparison.OrdinalIgnoreCase) ? "Substituição" : "Adição";
                
                _context.AuditLogs.Add(new AuditLog
                {
                    EventId = eventId,
                    ActionType = "IMPORT_CSV",
                    Description = $"Importação por {modeDesc} de {parsedSeats.Count} lugares. {removedCount} duplicados limpos.",
                    PerformedBy = userName,
                    PerformedRole = userRole,
                    Timestamp = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                if (_mqttService != null) 
                {
                    _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");
                    await _mqttService.PublishMessageAsync("seating/backoffice/companies", "REFRESH");

                    var affectedUserGuids = await _context.UserEvents
                        .Where(ue => ue.EventId == eventId)
                        .Select(ue => ue.User.UserGuid)
                        .ToListAsync();

                    foreach (var userGuid in affectedUserGuids)
                        await _mqttService.PublishMessageAsync($"seating/managers/{userGuid}/events", "REFRESH");
                }

                string extraMessage = removedCount > 0 ? $" Foram removidos {removedCount} registos duplicados." : "";
                return Ok(new { message = $"Ficheiro importado! {parsedSeats.Count} registos processados.{extraMessage}" });
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("linha")) return BadRequest(new { message = ex.Message });
                return StatusCode(500, new { message = $"Ocorreu um erro inesperado ao ler a estrutura do ficheiro: {ex.Message}" });
            }
        }

        [HttpPost("clear/{eventId}")]
        public async Task<IActionResult> ClearDatabase(int eventId)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null) return Unauthorized();

            var seatsToDelete = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            int count = seatsToDelete.Count;
            
            _context.Seats.RemoveRange(seatsToDelete);
            await _context.SaveChangesAsync();

            // 👇 AUDIT LOG: LIMPEZA DE BASE DE DADOS 👇
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = eventId,
                ActionType = "CLEAR_DB",
                Description = $"Apagou permanentemente todos os {count} lugares deste evento.",
                PerformedBy = user.Username,
                PerformedRole = userRole,
                Timestamp = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            if (_mqttService != null) _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

            return Ok(new { Message = "Dados do evento limpos com sucesso!" });
        }

        private async Task<int> AutoRemoveDuplicatesAsync(int eventId)
        {
            var allSeats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            var groupedSeats = allSeats.GroupBy(s => s.SeatNumber).Where(g => g.Count() > 1);
            var seatsToRemove = new List<Seat>();

            foreach (var group in groupedSeats)
            {
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
            if (input.EndsWith(",")) input = input.TrimEnd(',');

            return input;
        }
    }

    public class CsvValidationError
    {
        public int Line { get; set; }
        public string ErrorType { get; set; } = string.Empty;
    }
}