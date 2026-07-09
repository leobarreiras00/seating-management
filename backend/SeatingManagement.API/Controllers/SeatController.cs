using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;

namespace SeatingManagement.API.Controllers
{
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
        public async Task<ActionResult<IEnumerable<Seat>>> GetSeatsByEvent(int eventId)
        {
            var seats = await _context.Seats
                                      .Where(s => s.EventId == eventId)
                                      .ToListAsync();

            if (!seats.Any())
                return NotFound($"Nenhum lugar encontrado para o Evento {eventId}.");

            return Ok(seats);
        }

        [HttpPut("{seatNumber}/status")]
        public async Task<IActionResult> UpdateSeatStatus(string seatNumber, [FromBody] UpdateSeatStatusDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Status))
                return BadRequest("O estado é obrigatório.");

            var seat = await _context.Seats.FirstOrDefaultAsync(s => s.SeatNumber == seatNumber);
            if (seat == null) return NotFound($"Lugar '{seatNumber}' não encontrado.");

            if (!Enum.TryParse(request.Status, true, out SeatStatus statusEnum))
                return BadRequest("Estado inválido.");

            seat.Status = statusEnum;
            seat.AssignedTo = string.IsNullOrWhiteSpace(request.AssignedTo) ? null : request.AssignedTo;
            seat.MarkedAt = statusEnum != SeatStatus.Vazio ? DateTime.UtcNow : null;
            seat.Version++; 

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishSeatUpdateAsync(seat.Id, (int)seat.Status);

            return Ok(new { version = seat.Version });
        }

        [HttpPost("validate-ticket")]
        public async Task<IActionResult> ValidateTicket([FromBody] ValidateTicketDto request)
        {
            var seat = await _context.Seats
                                     .FirstOrDefaultAsync(s => s.EventId == request.EventId 
                                                            && s.SeatNumber == request.TicketHash);

            if (seat == null)
                return NotFound(new { Message = "Lugar não encontrado ou bilhete inválido." });

            if (seat.Status != (SeatStatus)0)
                return BadRequest(new { Message = "Erro: Este lugar já está ocupado ou tratado!" });

            seat.Status = (SeatStatus)1;
            seat.MarkedAt = DateTime.UtcNow;
            seat.Version++;

            await _context.SaveChangesAsync();

            // Avisa a rede MQTT em tempo real
            _ = _mqttService.PublishSeatUpdateAsync(seat.Id, 1);

            return Ok(new { Message = "Bilhete validado com sucesso!", Seat = seat });
        }
    }
}