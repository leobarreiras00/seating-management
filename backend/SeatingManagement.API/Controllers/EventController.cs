using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
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

        // GET: api/Event/my-events
        // Devolve apenas os eventos aos quais o utilizador logado tem acesso
        [HttpGet("my-events")]
        public async Task<IActionResult> GetMyEvents()
        {
            // 1. Descobre quem está a fazer o pedido através do Token JWT
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized(new { Message = "Sessão inválida." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null) return Unauthorized(new { Message = "Utilizador não encontrado." });

            // 2. Vai à tabela de cruzamento (UserEvents) buscar SÓ os eventos desta pessoa
            var myEvents = await _context.UserEvents
                .Where(ue => ue.UserId == user.Id)
                .Select(ue => new 
                {
                    Id = ue.Event.Id,
                    Name = ue.Event.Name
                })
                .ToListAsync();

            return Ok(myEvents);
        }

        // (Opcional) POST: api/Event
        // Endpoint rápido para poderes criar eventos e testar no Swagger
        [HttpPost]
        public async Task<IActionResult> CreateEvent([FromBody] string eventName)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr!));
            
            if (user == null) return Unauthorized();

            // Cria o evento
            var newEvent = new Models.Event { Name = eventName };
            _context.Events.Add(newEvent);
            await _context.SaveChangesAsync();

            // Dá permissão automática à pessoa que o criou
            var permission = new Models.UserEvent { UserId = user.Id, EventId = newEvent.Id };
            _context.UserEvents.Add(permission);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Evento criado e atribuído a ti com sucesso!", EventId = newEvent.Id });
        }
    }
}