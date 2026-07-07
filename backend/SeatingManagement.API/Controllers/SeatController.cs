using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;

namespace SeatingManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SeatController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SeatController(AppDbContext context)
        {
            _context = context;
        }

        // 1. ENDPOINT: Obter todos os lugares (GET /api/seat)
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SeatDto>>> GetSeats()
        {
            var seats = await _context.Seats
                .Select(s => new SeatDto
                {
                    Id = s.Id,
                    SeatNumber = s.SeatNumber,
                    EventName = s.EventName,
                    Status = s.Status,
                    AssignedTo = s.AssignedTo,
                    MarkedAt = s.MarkedAt
                })
                .ToListAsync();

            return Ok(seats);
        }

        // 2. ENDPOINT: Criar um novo lugar (POST /api/seat)
        [HttpPost]
        public async Task<ActionResult<SeatDto>> CreateSeat([FromBody] CreateSeatDto dto)
        {
            var newSeat = new Seat
            {
                SeatNumber = dto.SeatNumber,
                EventName = dto.EventName,
                Status = SeatStatus.Vazio // Por defeito começa vazio
            };

            _context.Seats.Add(newSeat);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetSeats), new { id = newSeat.Id }, newSeat);
        }
    }
}