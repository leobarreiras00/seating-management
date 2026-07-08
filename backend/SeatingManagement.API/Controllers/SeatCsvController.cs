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
        private const long MaxFileSizeBytes = 5 * 1024 * 1024; // Limite de Segurança: 5MB

        public SeatCsvController(AppDbContext context)
        {
            _context = context;
        }

        // 1. IMPORTAR CSV (Deteção automática de separador + Sanitização de Segurança)
        [HttpPost("import")]
        public async Task<IActionResult> ImportCsv(IFormFile file)
        {
            // Validação de Segurança 1: Ficheiro nulo ou vazio
            if (file == null || file.Length == 0)
                return BadRequest("Por favor, envie um ficheiro CSV válido.");

            // Validação de Segurança 2: Tamanho máximo do ficheiro (Evita negação de serviço/DoS)
            if (file.Length > MaxFileSizeBytes)
                return BadRequest("O ficheiro excede o limite máximo de segurança de 5MB.");

            // Validação de Segurança 3: Extensão permitida
            var extension = Path.GetExtension(file.FileName).ToLower();
            if (extension != ".csv")
                return BadRequest("Apenas são permitidos ficheiros com a extensão .csv.");

            try
            {
                using var streamReader = new StreamReader(file.OpenReadStream());
                
                var firstLine = await streamReader.ReadLineAsync();
                string delimiter = ","; 
                if (firstLine != null)
                {
                    if (firstLine.Contains(';')) delimiter = ";";
                    else if (firstLine.Contains('\t')) delimiter = "\t";
                }

                streamReader.BaseStream.Seek(0, SeekOrigin.Begin);
                streamReader.DiscardBufferedData();

                var config = new CsvConfiguration(CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    Delimiter = delimiter,
                    MissingFieldFound = null,
                    HeaderValidated = null,
                    // MAGIA DE RESILIÊNCIA: Remove espaços, mete em minúsculas e APAGA o BOM invisível!
                    PrepareHeaderForMatch = args => args.Header.ToLower().Replace("\ufeff", "").Replace(" ", "").Trim()
                };

                using var csv = new CsvReader(streamReader, config);
                var records = csv.GetRecords<SeatCsvRecord>().ToList();
                var newSeats = new List<Seat>();

                foreach (var record in records)
                {
                    // Sanitização de Segurança: Remove fórmulas maliciosas
                    var sanitizedMesa = SanitizeInput(record.Mesa);
                    var sanitizedLugar = SanitizeInput(record.Lugar);
                    var sanitizedNome = SanitizeInput(record.Nome);

                    // RESILIÊNCIA: Se o utilizador se esqueceu de preencher, damos um valor genérico em vez de ignorar
                    if (string.IsNullOrWhiteSpace(sanitizedMesa)) sanitizedMesa = "Indefinida";
                    if (string.IsNullOrWhiteSpace(sanitizedLugar)) sanitizedLugar = "Indefinido";

                    Enum.TryParse(record.Categoria, true, out SeatStatus statusEnum);

                    newSeats.Add(new Seat
                    {
                        SeatNumber = $"Mesa {sanitizedMesa} - Lugar {sanitizedLugar}",
                        EventName = "Evento Geral", 
                        Status = statusEnum,
                        AssignedTo = sanitizedNome,
                        MarkedAt = statusEnum != SeatStatus.Vazio ? DateTime.Now : null
                    });
                }

                _context.Seats.AddRange(newSeats);
                await _context.SaveChangesAsync();

                return Ok(new { Message = $"{newSeats.Count} lugares importados com sucesso usando o separador '{delimiter}'." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erro interno ao processar o CSV com segurança: {ex.Message}");
            }
        }

        // 2. EXPORTAR CSV (Mantém o estado, data e hora de marcação)
        [HttpGet("export")]
        public async Task<IActionResult> ExportCsv()
        {
            var seats = await _context.Seats.ToListAsync();

            var memoryStream = new MemoryStream();
            var streamWriter = new StreamWriter(memoryStream);
            var config = new CsvConfiguration(CultureInfo.InvariantCulture) { Delimiter = ";" };
            var csvWriter = new CsvWriter(streamWriter, config);

            // Exportamos os dados reais incluindo Id, Status e MarkedAt para o MQTT ler mais tarde
            csvWriter.WriteRecords(seats);
            await streamWriter.FlushAsync();
            memoryStream.Position = 0;

            return File(memoryStream, "text/csv", $"Estado_Lugares_{DateTime.Now:yyyyMMdd_HHmm}.csv");
        }

        // 3. LIMPAR BASE DE DADOS (Validado por Token JWT + PIN)
        [HttpPost("clear")]
        public async Task<IActionResult> ClearDatabase([FromBody] ClearDatabaseDto request)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Pin, user.PinHash))
            {
                return Forbid("PIN de gestão inválido. Operação abortada por segurança.");
            }

            _context.Seats.RemoveRange(_context.Seats);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Base de dados de lugares limpa com segurança com validação de PIN!" });
        }

        // Função Auxiliar de Segurança: Remove caracteres que possam executar fórmulas no Excel
        private string SanitizeInput(string? input)
        {
            if (string.IsNullOrEmpty(input)) return string.Empty;
            input = input.Trim();
            
            // Se começar com caracteres perigosos de fórmulas, removemos
            if (input.StartsWith("=") || input.StartsWith("+") || input.StartsWith("-") || input.StartsWith("@"))
            {
                input = Regex.Replace(input, @"^[=\+\-\@]+", "");
            }
            return input;
        }
    }
}