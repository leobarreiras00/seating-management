using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;

namespace SeatingManagement.API.Controllers
{
    [Authorize(Roles = "SuperAdmin")]
    [ApiController]
    [Route("api/[controller]")]
    public class CompanyController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CompanyController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
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

        [HttpPost]
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

            return Ok(new { Message = "Empresa (Instância) criada com sucesso!", CompanyId = company.Id });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCompany(int id, [FromBody] UpdateCompanyDto request)
        {
            var company = await _context.Companies.FindAsync(id);
            if (company == null) return NotFound(new { Message = "Empresa não encontrada." });

            company.Name = request.Name;
            company.LogoUrl = request.LogoUrl;

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Empresa atualizada com sucesso!" });
        }

        [HttpGet("{id}/managers")]
        public async Task<IActionResult> GetManagers(int id)
        {
            var managers = await _context.Users
                .Where(u => u.CompanyId == id && u.Role == "Gestor")
                .Select(u => new ManagerResponseDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    Role = u.Role
                })
                .ToListAsync();

            return Ok(managers);
        }

        [HttpGet("{id}/events")]
        public async Task<IActionResult> GetCompanyEvents(int id)
        {
            var events = await _context.Events
                .Where(e => e.CompanyId == id)
                .Select(e => new EventStatsResponseDto
                {
                    Id = e.Id,
                    Name = e.Name,
                    StartDate = e.StartDate,
                    TotalSeats = e.Seats.Count(),
                    TreatedSeats = e.Seats.Count(s => s.Status != 0)
                })
                .ToListAsync();

            return Ok(events);
        }

        [HttpPut("{id}/logo")]
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

            return Ok(new { Message = "Logótipo atualizado com sucesso!", LogoUrl = logoUrl });
        }
    }
}