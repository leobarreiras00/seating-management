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
    }
}