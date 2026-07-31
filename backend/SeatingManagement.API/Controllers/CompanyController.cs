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
    public class CompanyController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IMqttService _mqttService; 

        public CompanyController(AppDbContext context, IMqttService mqttService) 
        {
            _context = context;
            _mqttService = mqttService;
        }

        [HttpGet]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetCompanies()
        {
            var companies = await _context.Companies
                .Select(c => new CompanyResponseDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    LogoUrl = c.LogoUrl
                })
                .ToListAsync();

            return Ok(companies);
        }

        [HttpGet("my-company")]
        public async Task<IActionResult> GetMyCompany()
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users
                .Include(u => u.Company)
                .FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
                
            if (user == null || user.Company == null) return NotFound();

            return Ok(new { name = user.Company.Name, logoUrl = user.Company.LogoUrl });
        }

        [HttpPost]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> CreateCompany([FromBody] CreateCompanyDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
                return BadRequest(new { Message = "O nome da empresa é obrigatório." });

            var company = new Company
            {
                Name = request.Name,
                LogoUrl = request.LogoUrl
            };

            _context.Companies.Add(company);
            await _context.SaveChangesAsync();

            await _mqttService.PublishMessageAsync("seating/backoffice/companies", "REFRESH");

            return Ok(new { Message = "Empresa criada com sucesso!", CompanyId = company.Id });
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> UpdateCompany(int id, [FromBody] UpdateCompanyDto request)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { Message = "Empresa não encontrada." });

            company.Name = request.Name;
            company.LogoUrl = request.LogoUrl;

            await _context.SaveChangesAsync();

            var companyUserGuids = await _context.Users
                .Where(u => u.CompanyId == id)
                .Select(u => u.UserGuid)
                .ToListAsync();

            foreach (var userGuid in companyUserGuids)
            {
                await _mqttService.PublishMessageAsync($"seating/managers/{userGuid}/profile", "REFRESH_PROFILE");
            }
            
            await _mqttService.PublishMessageAsync("seating/backoffice/companies", "REFRESH");

            return Ok(new { Message = "Empresa atualizada com sucesso!" });
        }

        [HttpPut("{id}/logo")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> UploadLogo(int id, IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { Message = "Nenhum ficheiro enviado." });

            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { Message = "Empresa não encontrada." });

            var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "logos");
            if (!Directory.Exists(uploadsFolder)) Directory.CreateDirectory(uploadsFolder);

            var uniqueFileName = $"{Guid.NewGuid()}_{file.FileName}";
            var filePath = Path.Combine(uploadsFolder, uniqueFileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            var logoUrl = $"{baseUrl}/logos/{uniqueFileName}";
            
            company.LogoUrl = logoUrl;
            await _context.SaveChangesAsync();

            var companyUserGuids = await _context.Users
                .Where(u => u.CompanyId == id)
                .Select(u => u.UserGuid)
                .ToListAsync();

            foreach (var userGuid in companyUserGuids)
            {
                await _mqttService.PublishMessageAsync($"seating/managers/{userGuid}/profile", "REFRESH_PROFILE");
            }
            
            await _mqttService.PublishMessageAsync("seating/backoffice/companies", "REFRESH");

            return Ok(new { Message = "Logótipo atualizado com sucesso!", LogoUrl = logoUrl });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> DeleteCompany(int id)
        {
            var adminCompanyIdStr = User.FindFirstValue("CompanyId");
            if (adminCompanyIdStr != null && int.Parse(adminCompanyIdStr) == id)
            {
                return BadRequest(new { Message = "Não podes apagar a empresa à qual o teu utilizador SuperAdmin pertence." });
            }

            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { Message = "Empresa não encontrada." });

            var hasUsers = await _context.Users.AnyAsync(u => u.CompanyId == id);
            var hasEvents = await _context.Events.AnyAsync(e => e.CompanyId == id);

            if (hasUsers || hasEvents)
            {
                return BadRequest(new { Message = "Não é possível apagar a empresa. Remove todos os Gestores e Eventos primeiro." });
            }

            _context.Companies.Remove(company);
            await _context.SaveChangesAsync();

            await _mqttService.PublishMessageAsync("seating/backoffice/companies", "REFRESH");

            return Ok(new { Message = "Empresa apagada com sucesso!" });
        }

        [HttpGet("{id}/managers")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetManagers(int id)
        {
            var managers = await _context.Users
                .Where(u => u.CompanyId == id && u.Role == "Gestor")
                .Select(u => new ManagerResponseDto { Id = u.Id, Username = u.Username, Role = u.Role })
                .ToListAsync();
            return Ok(managers);
        }

        [HttpGet("{id}/users")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetUsers(int id)
        {
            var users = await _context.Users
                .Where(u => u.CompanyId == id && u.Role == "Utilizador")
                .Select(u => new ManagerResponseDto { Id = u.Id, Username = u.Username, Role = u.Role })
                .ToListAsync();
            return Ok(users);
        }

        [HttpGet("{id}/events")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetCompanyEvents(int id)
        {
            var events = await _context.Events
                .Where(e => e.CompanyId == id)
                .OrderByDescending(e => e.StartDate) // 👈 ORDENAÇÃO AQUI (Do mais recente para o mais antigo)
                .Select(e => new 
                {
                    Id = e.Id,
                    Name = e.Name,
                    StartDate = e.StartDate,
                    EndDate = e.EndDate,
                    TotalSeats = e.Seats.Count(), 
                    TreatedSeats = e.Seats.Count(s => s.Status != 0),
                    AssignedUsers = e.UserEvents.Select(ue => new { Id = ue.User.Id, Username = ue.User.Username }).ToList()
                })
                .ToListAsync();
            return Ok(events);
        }

        [HttpPost("{id}/events")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<ActionResult<Event>> CreateEvent(int id, CreateEventDto dto)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound("Empresa não encontrada.");

            var newEvent = new Event 
            { 
                Name = dto.Name, 
                StartDate = dto.StartDate, 
                EndDate = dto.EndDate,
                TreatedSeats = 0, 
                CompanyId = id 
            };
            
            _context.Events.Add(newEvent);
            await _context.SaveChangesAsync();
            return Ok(new { Id = newEvent.Id, Name = newEvent.Name, StartDate = newEvent.StartDate, EndDate = newEvent.EndDate, CompanyId = newEvent.CompanyId });
        }

        [HttpPost("{companyId}/events/{eventId}/assign/{userId}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> AssignAccess(int companyId, int eventId, string userId)
        {
            var ev = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId && e.CompanyId == companyId);
            if (ev == null) return NotFound("Evento não encontrado.");
            var exists = await _context.EventAccesses.AnyAsync(ea => ea.EventId == eventId && ea.UserId == userId);
            if (exists) return BadRequest("O utilizador já tem acesso.");
            var access = new EventAccess { EventId = eventId, UserId = userId };
            _context.EventAccesses.Add(access);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Acesso atribuído!" });
        }

        [HttpDelete("{companyId}/events/{eventId}/assign/{userId}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> RemoveAccess(int companyId, int eventId, int userId)
        {
            var access = await _context.UserEvents.Include(ue => ue.User).FirstOrDefaultAsync(ue => ue.EventId == eventId && ue.UserId == userId);
            if (access == null) return NotFound(new { Message = "Acesso não encontrado." });
            var userGuidToNotify = access.User.UserGuid;
            _context.UserEvents.Remove(access);
            await _context.SaveChangesAsync();
            await _mqttService.PublishMessageAsync($"seating/managers/{userGuidToNotify}/events", "REFRESH");
            return Ok(new { Message = "Acesso removido!" });
        }
    }
}