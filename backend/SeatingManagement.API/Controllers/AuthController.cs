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
    /// <summary>
    /// Controlador responsável pela gestão de identidade e emissão de tokens JWT.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [AllowAnonymous] // Garante que a porta de entrada está sempre aberta, mesmo que o sistema seja restrito globalmente.
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
        public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto request)
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest("O utilizador já existe no sistema.");

            var user = new User
            {
                Username = request.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                PinHash = BCrypt.Net.BCrypt.HashPassword(request.Pin),
                UserGuid = Guid.NewGuid() // CORREÇÃO: Geração explícita do identificador único
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Utilizador registado com sucesso!" });
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponseDto>> Login(LoginDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Unauthorized("Credenciais inválidas.");

            var token = GenerateJwtToken(user);

            return Ok(new AuthResponseDto { Token = token, UserGuid = user.UserGuid });
        }

        private string GenerateJwtToken(User user)
        {
            // CORREÇÃO: Fallback de segurança para evitar crash do Swagger caso falhe a leitura do appsettings.json
            var jwtKey = _configuration["Jwt:Key"] ?? "ChaveDeSegurancaTemporariaParaOJWT2026!!_Minimo32Caracteres"; 
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserGuid.ToString()),
                new Claim(ClaimTypes.Name, user.Username)
            };

            var issuer = _configuration["Jwt:Issuer"] ?? "SeatingManagementAPI";
            var audience = _configuration["Jwt:Audience"] ?? "SeatingManagementClients";

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddDays(1), // CORREÇÃO: UtcNow para consistência global de tempo
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}