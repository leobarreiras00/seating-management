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
                SeatNumber = s.SeatNumber,
                EventName = s.EventName,
                Status = s.Status,
                AssignedTo = s.AssignedTo,
                MarkedAt = s.MarkedAt
            }).ToListAsync();
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

            // 1. Mutação de Estado e Versionamento
            seat.Status = statusEnum;
            seat.AssignedTo = string.IsNullOrWhiteSpace(request.AssignedTo) ? null : request.AssignedTo;
            seat.MarkedAt = statusEnum != SeatStatus.Vazio ? DateTime.UtcNow : null;
            seat.Version++; // Incremento do contador de versão para sincronização

            await _context.SaveChangesAsync();

            // 2. Broadcast Otimizado: Envia apenas o ID e o Status (int)
            _ = _mqttService.PublishSeatUpdateAsync(seat.Id, (int)seat.Status);

            return Ok(new { version = seat.Version });
        }
    }
}