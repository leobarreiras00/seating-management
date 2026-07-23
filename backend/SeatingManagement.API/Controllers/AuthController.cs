using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace SeatingManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous] 
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto request)
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest(new { Message = "O utilizador já existe no sistema." });

            var company = await _context.Companies.FindAsync(request.CompanyId);
            if (company == null)
                return BadRequest(new { Message = "A empresa especificada não existe." });

            var user = new User
            {
                Username = request.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                PinHash = BCrypt.Net.BCrypt.HashPassword(request.Pin),
                UserGuid = Guid.NewGuid(),
                Role = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : "Utilizador",
                CompanyId = request.CompanyId // 👇 Associa o Inquilino
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Utilizador registado com sucesso!" });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto request)
        {
            var user = await _context.Users
                .Include(u => u.Company)
                .FirstOrDefaultAsync(u => u.Username == request.Username);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Unauthorized(new { Message = "Credenciais inválidas." });

            var token = GenerateJwtToken(user);

            return Ok(new { 
                Token = token, 
                UserGuid = user.UserGuid,
                Pin = user.PinHash,
                Role = user.Role,
                CompanyName = user.Company.Name,
                CompanyLogo = user.Company.LogoUrl
            });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _configuration["Jwt:Key"] ?? "ChaveDeSegurancaTemporariaParaOJWT2026!!_Minimo32Caracteres"; 
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserGuid.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("CompanyId", user.CompanyId.ToString()) // 👇 O Inquilino fica blindado no Token
            };

            var issuer = _configuration["Jwt:Issuer"] ?? "SeatingManagementAPI";
            var audience = _configuration["Jwt:Audience"] ?? "SeatingManagementClients";

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(1), 
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}