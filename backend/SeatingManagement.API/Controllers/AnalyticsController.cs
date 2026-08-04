using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AnalyticsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboardStats()
        {
            var totalCompanies = await _context.Companies.CountAsync();
            var totalEvents = await _context.Events.CountAsync();
            var totalSeats = await _context.Seats.CountAsync();
            
            var validatedSeats = await _context.Seats.CountAsync(s => (int)s.Status != 0);

            var twelveHoursAgo = DateTime.UtcNow.AddHours(-12);
            var recentValidations = await _context.Seats
                .Where(s => s.MarkedAt != null && s.MarkedAt >= twelveHoursAgo && (int)s.Status != 0)
                .ToListAsync();

            var timeline = recentValidations
                .GroupBy(s => s.MarkedAt!.Value.ToString("HH:00"))
                .Select(g => new { 
                    Time = g.Key, 
                    Validations = g.Count()
                })
                .OrderBy(g => g.Time)
                .ToList();

            var eventsProgressRaw = await _context.Events
                .Select(e => new {
                    Name = e.Name,
                    Total = _context.Seats.Count(s => s.EventId == e.Id),
                    Validated = _context.Seats.Count(s => s.EventId == e.Id && (int)s.Status != 0)
                })
                .OrderByDescending(e => e.Total)
                .Take(4)
                .ToListAsync();

            var eventsProgress = eventsProgressRaw.Select(e => new {
                e.Name,
                e.Total,
                e.Validated,
                Remaining = e.Total - e.Validated // A matemática correta: Total - Validados = Restantes
            }).ToList();

            return Ok(new {
                Stats = new { 
                    Companies = totalCompanies, 
                    Events = totalEvents, 
                    Seats = totalSeats, 
                    ValidatedSeats = validatedSeats 
                },
                Timeline = timeline,
                EventsProgress = eventsProgress
            });
        }
    }
}