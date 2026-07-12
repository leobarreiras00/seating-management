using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;

namespace SeatingManagement.API.Controllers
{
    // 👇 NOVO DTO PARA ATUALIZAR 1 LUGAR 👇
    public class UpdateSingleSeatDto
    {
        public int Status { get; set; }
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

            // Retorna array vazio em vez de 404 para o Android não dar erro de HTTP no primeiro carregamento
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

        // 👇 O NOVO ENDPOINT DE GRAVAÇÃO INDIVIDUAL 👇
        [HttpPut("{eventId}/update/{seatId}")]
        public async Task<IActionResult> UpdateSingleSeat(int eventId, int seatId, [FromBody] UpdateSingleSeatDto request)
        {
            var seat = await _context.Seats.FirstOrDefaultAsync(s => s.EventId == eventId && s.Id == seatId);
            
            if (seat == null) 
                return NotFound(new { Message = "Lugar não encontrado." });

            // Atualiza a Base de Dados Central (O SQL Server)
            seat.Status = (SeatStatus)request.Status;
            seat.MarkedAt = request.Status != 0 ? DateTime.UtcNow : null;
            seat.Version++;

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

            await _context.SaveChangesAsync();

            _ = _mqttService.PublishSeatUpdateAsync(seat.EventId, seat.Id, (int)seat.Status);

            return Ok(new { Message = "Bilhete validado com sucesso!", Seat = seat });
        }

        [HttpPut("{eventId}/bulk-status")]
        public async Task<IActionResult> BulkUpdateStatus(int eventId, [FromBody] BulkUpdateDto request)
        {
            if (!Enum.TryParse(request.Status, true, out SeatStatus statusEnum))
                return BadRequest(new { Message = "Estado inválido." });

            // Vai buscar todos os lugares do evento e altera-os em memória
            var seats = await _context.Seats.Where(s => s.EventId == eventId).ToListAsync();
            foreach (var seat in seats)
            {
                seat.Status = statusEnum;
                seat.MarkedAt = statusEnum != SeatStatus.Vazio ? DateTime.UtcNow : null;
                seat.Version++;
            }

            // Grava tudo de uma vez (super rápido)
            await _context.SaveChangesAsync();

            // BROADCAST: Envia comando para todos os telemóveis atualizarem a vista
            _ = _mqttService.PublishCommandAsync(eventId, "REFRESH");

            return Ok(new { Message = $"{seats.Count} lugares atualizados com sucesso." });
        }
    }
}