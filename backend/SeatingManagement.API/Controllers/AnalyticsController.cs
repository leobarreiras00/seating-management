using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.Services;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AnalyticsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEventAccessService _access;

        public AnalyticsController(AppDbContext context, IEventAccessService access)
        {
            _context = context;
            _access = access;
        }

        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboardStats()
        {
            // Only data of events the caller may access is counted.
            var accessibleEvents = _access.AccessibleEvents(User);
            var eventIds = await accessibleEvents.Select(e => e.Id).ToListAsync();

            var totalCompanies = User.IsInRole("SuperAdmin")
                ? await _context.Companies.CountAsync()
                : await accessibleEvents.Select(e => e.CompanyId).Distinct().CountAsync();
            var totalEvents = eventIds.Count;

            var seatsInScope = _context.Seats.Where(s => eventIds.Contains(s.EventId));
            var totalSeats = await seatsInScope.CountAsync();
            
            var validatedSeats = await seatsInScope.CountAsync(s => (int)s.Status != 0);

            var twelveHoursAgo = DateTime.UtcNow.AddHours(-12);
            var recentValidations = await seatsInScope
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
                .Where(e => eventIds.Contains(e.Id))
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