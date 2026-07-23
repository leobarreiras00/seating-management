using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using System.Security.Claims;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class EventController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EventController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("my-events")]
        public async Task<IActionResult> GetMyEvents()
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized(new { Message = "Sessão inválida." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null) return Unauthorized(new { Message = "Utilizador não encontrado." });

            var myEvents = await _context.UserEvents
                .Where(ue => ue.UserId == user.Id)
                .Select(ue => new EventResponseDto
                {
                    Id = ue.Event.Id,
                    Name = ue.Event.Name,
                    StartDate = ue.Event.StartDate
                })
                .ToListAsync();

            return Ok(myEvents);
        }

        [HttpPost]
        public async Task<IActionResult> CreateEvent([FromBody] CreateEventDto request)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr!));
            
            if (user == null) return Unauthorized();

            var newEvent = new Models.Event 
            { 
                Name = request.Name,
                StartDate = request.StartDate,
                CompanyId = user.CompanyId // Fica blindado à empresa de quem o cria
            };
            
            _context.Events.Add(newEvent);
            await _context.SaveChangesAsync();

            var permission = new Models.UserEvent { UserId = user.Id, EventId = newEvent.Id };
            _context.UserEvents.Add(permission);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Evento criado e atribuído a ti com sucesso!", EventId = newEvent.Id });
        }
    }
}