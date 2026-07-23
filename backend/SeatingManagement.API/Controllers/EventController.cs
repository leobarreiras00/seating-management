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
                CompanyId = user.CompanyId 
            };
            
            _context.Events.Add(newEvent);
            await _context.SaveChangesAsync();

            var permission = new Models.UserEvent { UserId = user.Id, EventId = newEvent.Id };
            _context.UserEvents.Add(permission);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Evento criado e atribuído a ti com sucesso!", EventId = newEvent.Id });
        }

        [HttpPost("{eventId}/assign-user")]
        [Authorize(Roles = "SuperAdmin,Gestor")] // Apenas quem gere pode atribuir
        public async Task<IActionResult> AssignUserToEvent(int eventId, [FromBody] AssignUserDto request)
        {
            var adminCompanyIdStr = User.FindFirstValue("CompanyId");
            if (string.IsNullOrEmpty(adminCompanyIdStr)) return Unauthorized();
            
            var adminCompanyId = int.Parse(adminCompanyIdStr);
            var isSuperAdmin = User.IsInRole("SuperAdmin");

            var ev = await _context.Events.FindAsync(eventId);
            if (ev == null) return NotFound(new { Message = "Evento não encontrado." });

            // O Gestor só pode atribuir eventos da sua própria empresa
            if (!isSuperAdmin && ev.CompanyId != adminCompanyId)
                return Forbid();

            var targetUser = await _context.Users.FindAsync(request.UserId);
            if (targetUser == null) return NotFound(new { Message = "Utilizador alvo não encontrado." });

            if (!isSuperAdmin && targetUser.CompanyId != adminCompanyId)
                return BadRequest(new { Message = "O utilizador não pertence à tua empresa." });

            var exists = await _context.UserEvents.AnyAsync(ue => ue.UserId == request.UserId && ue.EventId == eventId);
            if (exists) return BadRequest(new { Message = "O utilizador já tem acesso a este evento." });

            _context.UserEvents.Add(new Models.UserEvent { UserId = request.UserId, EventId = eventId });
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Acesso concedido com sucesso!" });
        }
    }
}