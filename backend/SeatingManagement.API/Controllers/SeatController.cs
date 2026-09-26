using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;
using System.Security.Claims;

namespace SeatingManagement.API.Controllers
{
    public class UpdateSingleSeatDto
    {
        public int Status { get; set; }
    }

    public class ManageGuestDto
    {
        public string GuestName { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string TableName { get; set; } = string.Empty;
        public string SeatNumber { get; set; } = string.Empty;
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SeatController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMqttService _mqttService;

        public SeatController(AppDbContext context, IMqttService mqttService)
        {
            _context = context;
            _mqttService = mqttService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SeatDto>>> GetSeats()
        {
            return await _context.Seats.Select(s => new SeatDto
            {
                Id = s.Id,
                EventId = s.EventId,
                SeatNumber = s.SeatNumber,
                EventName = s.EventName,
                Status = s.Status,
                AssignedTo = s.AssignedTo,
                MarkedAt = s.MarkedAt
            }).ToListAsync();
        }

        [HttpGet("{eventId}")]
        public async Task<ActionResult<IEnumerable<SeatDto>>> GetSeatsByEvent(int eventId)
        {
            var seats = await _context.Seats
                .Where(s => s.EventId == eventId)
                .Select(s => new SeatDto
                {
                    Id = s.Id,
                    EventId = s.EventId,
                    SeatNumber = s.SeatNumber,
                    EventName = s.EventName,
                    Status = s.Status,
                    AssignedTo = s.AssignedTo,
                    MarkedAt = s.MarkedAt
                })
                .ToListAsync();

            return Ok(seats); 
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSeatStatus(int id, [FromBody] UpdateSeatStatusDto request)
        {
            var seat = await _context.Seats.FindAsync(id);
            if (seat == null) return NotFound("Lugar não encontrado.");

            if (!Enum.TryParse(request.Status, true, out SeatStatus statusEnum))
                return BadRequest("Estado inválido.");

            seat.Status = statusEnum;
            seat.AssignedTo = string.IsNullOrWhiteSpace(request.AssignedTo) ? null : request.AssignedTo;
            seat.MarkedAt = statusEnum != SeatStatus.Vazio ? DateTime.UtcNow : null;
            seat.Version++; 

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishSeatUpdateAsync(seat.EventId, seat.Id, (int)seat.Status);
            return Ok(new { version = seat.Version });
        }

        [HttpPut("{eventId}/update/{seatId}")]
        public async Task<IActionResult> UpdateSingleSeat(int eventId, int seatId, [FromBody] UpdateSingleSeatDto request)
        {
            var seat = await _context.Seats.FirstOrDefaultAsync(s => s.EventId == eventId && s.Id == seatId);
            
            if (seat == null) 
                return NotFound(new { Message = "Lugar não encontrado." });

            int oldStatus = (int)seat.Status;
            
            seat.Status = (SeatStatus)request.Status;
            seat.MarkedAt = request.Status != 0 ? DateTime.UtcNow : null;
            seat.Version++;

            if (oldStatus != request.Status)
            {
                var userName = User.Identity?.Name ?? "Sistema";
                var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
                
                var actionDesc = request.Status != 0 ? "Validou" : "Removeu a validação de";
                var guestName = string.IsNullOrWhiteSpace(seat.AssignedTo) ? "Convite Sem Nome" : seat.AssignedTo;

                _context.AuditLogs.Add(new AuditLog
                {
                    EventId = eventId,
                    ActionType = request.Status != 0 ? "VALIDATE_SEAT" : "UNVALIDATE_SEAT",
                    Description = $"{actionDesc} o lugar {seat.SeatNumber} ({guestName}).",
                    PerformedBy = userName,
                    PerformedRole = userRole,
                    Timestamp = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            
            return Ok(new { Message = "Gravado permanentemente na BD Central." });
        }

        [HttpPost("validate-ticket")]
        public async Task<IActionResult> ValidateTicket([FromBody] ValidateTicketDto request)
        {
            var seat = await _context.Seats
                .FirstOrDefaultAsync(s => s.EventId == request.EventId && s.SeatNumber == request.TicketHash);

            if (seat == null)
                return NotFound(new { Message = "Lugar não encontrado ou bilhete inválido para este evento." });

            if (seat.Status != SeatStatus.Vazio)
                return BadRequest(new { Message = "Erro: Este lugar já está ocupado ou tratado!" });

            seat.Status = SeatStatus.Marcado;
            seat.MarkedAt = DateTime.UtcNow;
            seat.Version++;

            var userName = User.Identity?.Name ?? "Sistema";
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            var guestName = string.IsNullOrWhiteSpace(seat.AssignedTo) ? "Convite Sem Nome" : seat.AssignedTo;

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = request.EventId,
                ActionType = "QR_VALIDATE",
                Description = $"Validou o lugar {seat.SeatNumber} ({guestName}) via Scanner QR.",
                PerformedBy = userName,
                PerformedRole = userRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishSeatUpdateAsync(seat.EventId, seat.Id, (int)seat.Status);

            return Ok(new { Message = "Bilhete validado com sucesso!", Seat = seat });
        }

        [HttpPut("{eventId}/bulk-status")]
        public async Task<IActionResult> BulkUpdateStatus(int eventId, [FromBody] BulkUpdateDto request)
        {
            if (!Enum.TryParse(request.Status, true, out SeatStatus statusEnum))
                return BadRequest(new { Message = "Estado inválido." });

            var seats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            foreach (var seat in seats)
            {
                seat.Status = statusEnum;
                seat.MarkedAt = statusEnum != SeatStatus.Vazio ? DateTime.UtcNow : null;
                seat.Version++;
            }

            var userName = User.Identity?.Name ?? "Sistema";
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            var statusDesc = statusEnum != SeatStatus.Vazio ? "Marcados como Tratados" : "Removidos / Desmarcados";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = eventId,
                ActionType = "BULK_UPDATE",
                Description = $"Ação em massa executada. {seats.Count} lugares afetados ({statusDesc}).",
                PerformedBy = userName,
                PerformedRole = userRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

            return Ok(new { Message = $"{seats.Count} lugares atualizados com sucesso." });
        }

        // ==========================================
        // GESTÃO MANUAL DE CONVIDADOS (CRUD)
        // ==========================================

        [HttpPost("event/{eventId}/walkin")]
        public async Task<IActionResult> AddWalkIn(int eventId, [FromBody] ManageGuestDto request)
        {
            var ev = await _context.Events.FindAsync(eventId);
            if (ev == null) return NotFound(new { Message = "Evento não encontrado." });

            var seatNumber = $"{request.TableName.Trim()}-{request.SeatNumber.Trim()}";

            var seat = new Seat
            {
                EventId = eventId,
                AssignedTo = request.GuestName,
                EventName = request.Category, // Usamos o EventName para guardar a Categoria (igual ao CsvController)
                SeatNumber = seatNumber,
                Status = SeatStatus.Vazio, // Começa como Pendente
                Version = 1
            };

            _context.Seats.Add(seat);
            
            // Registo na Auditoria
            var userName = User.Identity?.Name ?? "Sistema";
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            _context.AuditLogs.Add(new AuditLog
            {
                EventId = eventId,
                ActionType = "CREATE_GUEST",
                Description = $"Adicionou o walk-in: {request.GuestName} ({seatNumber}).",
                PerformedBy = userName,
                PerformedRole = userRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            
            _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");
            return Ok(new { Message = "Convidado adicionado com sucesso." });
        }

        [HttpPut("{id}/edit")]
        public async Task<IActionResult> EditGuest(int id, [FromBody] ManageGuestDto request)
        {
            var seat = await _context.Seats.FindAsync(id);
            if (seat == null) return NotFound(new { Message = "Convidado não encontrado." });

            var seatNumber = $"{request.TableName.Trim()}-{request.SeatNumber.Trim()}";
            var oldName = seat.AssignedTo ?? "Sem Nome";
            var oldSeat = seat.SeatNumber;

            seat.AssignedTo = request.GuestName;
            seat.EventName = request.Category;
            seat.SeatNumber = seatNumber;
            seat.Version++;

            // Registo na Auditoria (FR56)
            var userName = User.Identity?.Name ?? "Sistema";
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            _context.AuditLogs.Add(new AuditLog
            {
                EventId = seat.EventId,
                ActionType = "UPDATE_GUEST",
                Description = $"Editou convidado: {oldName} ({oldSeat}) -> {request.GuestName} ({seatNumber}).",
                PerformedBy = userName,
                PerformedRole = userRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishCommandAsync(seat.EventId, "REFRESH");
            return Ok(new { Message = "Convidado atualizado com sucesso." });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteGuest(int id)
        {
            var seat = await _context.Seats.FindAsync(id);
            if (seat == null) return NotFound(new { Message = "Convidado não encontrado." });

            int eventId = seat.EventId;
            string guestName = seat.AssignedTo ?? "Sem Nome";
            string seatNumber = seat.SeatNumber;

            _context.Seats.Remove(seat);

            // Registo na Auditoria (FR56)
            var userName = User.Identity?.Name ?? "Sistema";
            var userRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            _context.AuditLogs.Add(new AuditLog
            {
                EventId = eventId,
                ActionType = "DELETE_GUEST",
                Description = $"Removeu o convidado: {guestName} ({seatNumber}).",
                PerformedBy = userName,
                PerformedRole = userRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");
            return Ok(new { Message = "Convidado removido com sucesso." });
        }
    }
}