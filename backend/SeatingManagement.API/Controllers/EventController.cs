using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;
using System.Security.Claims;

namespace SeatingManagement.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class EventController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMqttService _mqttService;

        public EventController(AppDbContext context, IMqttService mqttService)
        {
            _context = context;
            _mqttService = mqttService;
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
                TotalSeats = request.TotalSeats,
                CompanyId = user.CompanyId 
            };
            
            _context.Events.Add(newEvent);
            await _context.SaveChangesAsync();

            var permission = new Models.UserEvent { UserId = user.Id, EventId = newEvent.Id };
            _context.UserEvents.Add(permission);
            await _context.SaveChangesAsync();

            await _mqttService.PublishMessageAsync($"seating/managers/{user.UserGuid}/events", "REFRESH");

            return Ok(new { Message = "Evento criado e atribuído a ti com sucesso!", EventId = newEvent.Id });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> UpdateEvent(int id, [FromBody] CreateEventDto request)
        {
            var ev = await _context.Events.FindAsync(id);
            if (ev == null) return NotFound(new { Message = "Evento não encontrado." });

            // Atualiza os dados
            ev.Name = request.Name;
            ev.StartDate = request.StartDate;
            ev.TotalSeats = request.TotalSeats;

            await _context.SaveChangesAsync();

            // Descobre que gestores têm acesso a este evento
            var affectedUserGuids = await _context.UserEvents
                .Where(ue => ue.EventId == id)
                .Select(ue => ue.User.UserGuid)
                .ToListAsync();

            // Avisa o telemóvel de cada um desses gestores para atualizar o nome/data
            foreach (var userGuid in affectedUserGuids)
            {
                await _mqttService.PublishMessageAsync($"seating/managers/{userGuid}/events", "REFRESH");
            }
            
            // Opcional: Aviso global de eventos (caso estejas a ouvir na dashboard)
            await _mqttService.PublishMessageAsync("seating/events/updated", id.ToString());

            return Ok(new { Message = "Evento atualizado com sucesso." });
        }

        [HttpPost("{eventId}/assign-user")]
        [Authorize(Roles = "SuperAdmin,Gestor")] 
        public async Task<IActionResult> AssignUserToEvent(int eventId, [FromBody] AssignUserDto request)
        {
            var adminCompanyIdStr = User.FindFirstValue("CompanyId");
            if (string.IsNullOrEmpty(adminCompanyIdStr)) return Unauthorized();
            
            var adminCompanyId = int.Parse(adminCompanyIdStr);
            var isSuperAdmin = User.IsInRole("SuperAdmin");

            var ev = await _context.Events.FindAsync(eventId);
            if (ev == null) return NotFound(new { Message = "Evento não encontrado." });

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

            await _mqttService.PublishMessageAsync($"seating/managers/{targetUser.UserGuid}/events", "REFRESH");

            return Ok(new { Message = "Acesso concedido com sucesso!" });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin")] 
        public async Task<IActionResult> DeleteEvent(int id)
        {
            var ev = await _context.Events.FindAsync(id);
            if (ev == null) return NotFound(new { Message = "Evento não encontrado." });

            var affectedUserGuids = await _context.UserEvents
                .Where(ue => ue.EventId == id)
                .Select(ue => ue.User.UserGuid)
                .ToListAsync();

            _context.Events.Remove(ev);
            await _context.SaveChangesAsync();

            foreach (var userGuid in affectedUserGuids)
            {
                await _mqttService.PublishMessageAsync($"seating/managers/{userGuid}/events", "REFRESH");
            }

            return Ok(new { Message = "Evento apagado com sucesso." });
        }
    }
}