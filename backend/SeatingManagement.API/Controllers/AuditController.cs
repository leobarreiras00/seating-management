using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IEventAccessService _access;

        public AuditController(AppDbContext context, IEventAccessService access)
        {
            _context = context;
            _access = access;
        }

        private const int MaxPageSize = 200;

        [HttpGet("events-overview")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> GetEventsOverview()
        {
            var events = await _access.AccessibleEvents(User)
                .Include(e => e.Company)
                .Select(e => new
                {
                    e.Id,
                    e.Name,
                    CompanyName = e.Company != null ? e.Company.Name : "Sem Empresa",
                    CompanyLogo = e.Company != null ? e.Company.LogoUrl : "", 
                    e.StartDate,
                    TotalLogs = _context.AuditLogs.Count(al => al.EventId == e.Id),
                    LastActivity = _context.AuditLogs
                                    .Where(al => al.EventId == e.Id)
                                    .OrderByDescending(al => al.Timestamp)
                                    .Select(al => al.Timestamp)
                                    .FirstOrDefault()
                })
                .OrderByDescending(e => e.LastActivity)
                .ToListAsync();

            return Ok(events);
        }

        [HttpGet("event/{eventId}")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> GetEventLogs(int eventId, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            if (!await _access.CanAccessEventAsync(User, eventId)) return Forbid();

            if (page < 1 || pageSize < 1)
                return BadRequest(new { Message = "Os parâmetros page e pageSize têm de ser positivos." });
            pageSize = Math.Min(pageSize, MaxPageSize);

            var query = _context.AuditLogs
                .Where(al => al.EventId == eventId)
                .OrderByDescending(al => al.Timestamp);

            var totalLogs = await query.CountAsync();

            var logs = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new {
                TotalLogs = totalLogs,
                Page = page,
                PageSize = pageSize,
                Logs = logs
            });
        }
    }
}