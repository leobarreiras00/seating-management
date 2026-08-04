using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.Models;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly AppDbContext _context;

        public AuditController(AppDbContext context)
        {
            _context = context;
        }

        // Devolve os eventos com as suas estatísticas e a contagem de logs
        [HttpGet("events-overview")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> GetEventsOverview()
        {
            var events = await _context.Events
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

        // Devolve todos os logs detalhados de um evento específico
        [HttpGet("event/{eventId}")]
        public async Task<IActionResult> GetEventLogs(int eventId)
        {
            var logs = await _context.AuditLogs
                .Where(al => al.EventId == eventId)
                .OrderByDescending(al => al.Timestamp)
                .ToListAsync();

            return Ok(logs);
        }
    }
}