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
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AppDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpGet("users")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> GetUsers()
        {
            var currentUserRole = User.FindFirstValue(ClaimTypes.Role);
            var currentCompanyIdStr = User.FindFirstValue("CompanyId");

            var query = _context.Users
                .Include(u => u.Company)
                .Include(u => u.UserEvents)
                .ThenInclude(ue => ue.Event)
                .AsQueryable();

            if (currentUserRole == "Gestor" && int.TryParse(currentCompanyIdStr, out int companyId))
            {
                query = query.Where(u => u.CompanyId == companyId && u.Role != "SuperAdmin");
            }

            var users = await query.Select(u => new
            {
                u.Id,
                u.Username,
                u.Role,
                CompanyName = u.Company != null ? u.Company.Name : "Administração Central",
                CompanyLogo = u.Company != null ? u.Company.LogoUrl : "",
                AvatarUrl = u.AvatarUrl,
                
                Events = u.UserEvents.Select(ue => new { 
                    Id = ue.EventId, 
                    Name = ue.Event.Name 
                }).ToList()
            }).ToListAsync();

            return Ok(users);
        }

        // 👇 NOVO ENDPOINT: Carregar Fotografia de Perfil 👇
        [HttpPut("user/{id}/avatar")]
        [Authorize]
        public async Task<IActionResult> UpdateAvatar(int id, [FromBody] UpdateAvatarDto request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "Utilizador não encontrado." });

            user.AvatarUrl = request.AvatarBase64;
            
            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            var performedBy = User.Identity?.Name ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null,
                ActionType = "UPDATE_USER",
                Description = $"Atualizou a fotografia de perfil de '{user.Username}'.",
                PerformedBy = performedBy, 
                PerformedRole = performedRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Avatar atualizado com sucesso!", AvatarUrl = user.AvatarUrl });
        }

        [HttpPost("register")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> Register(RegisterDto request)
        {
            var isCurrentUserSuperAdmin = User.IsInRole("SuperAdmin");
            if (request.Role == "SuperAdmin" && !isCurrentUserSuperAdmin)
            {
                return StatusCode(403, new { Message = "Acesso Negado: Apenas um Super Admin pode criar outro Super Admin." });
            }

            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest(new { Message = "O utilizador já existe no sistema." });

            var company = await _context.Companies.FindAsync(request.CompanyId);
            if (company == null)
                return BadRequest(new { Message = "A empresa especificada não existe." });

            var user = new User
            {
                Username = request.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                UserGuid = Guid.NewGuid(),
                Role = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : "Utilizador",
                CompanyId = request.CompanyId 
            };

            _context.Users.Add(user);

            var performedBy = User.Identity?.Name ?? "Sistema";
            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null,
                ActionType = "CREATE_USER",
                Description = $"Criou o utilizador '{user.Username}' com a função de '{user.Role}'.",
                PerformedBy = performedBy,
                PerformedRole = performedRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Utilizador registado com sucesso!" });
        }

        [HttpPost("login")]
        [AllowAnonymous]
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
                Role = user.Role,
                CompanyName = user.Company?.Name ?? "Sem Empresa",
                CompanyLogo = user.Company?.LogoUrl ?? ""
            });
        }

        [HttpDelete("user/{id}")]
        [Authorize] 
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) 
                return NotFound(new { Message = "Utilizador não encontrado." });

            string deletedUsername = user.Username;

            _context.Users.Remove(user);

            var performedBy = User.Identity?.Name ?? "Sistema";
            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null,
                ActionType = "DELETE_USER",
                Description = $"Apagou a conta do utilizador '{deletedUsername}'.",
                PerformedBy = performedBy,
                PerformedRole = performedRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Conta apagada com sucesso." });
        }

        [HttpPut("user/{id}/reset-password")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> ResetUserPassword(int id, [FromBody] ResetPasswordDto request)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "Utilizador não encontrado." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            var performedBy = User.Identity?.Name ?? "Sistema";
            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null,
                ActionType = "RESET_PASSWORD",
                Description = $"Repôs a palavra-passe do utilizador '{user.Username}'.",
                PerformedBy = performedBy,
                PerformedRole = performedRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Palavra-passe alterada com sucesso!" });
        }

        [HttpPut("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto request)
        {
            var userGuidStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (string.IsNullOrEmpty(userGuidStr)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.UserGuid == Guid.Parse(userGuidStr));
            if (user == null) return Unauthorized();

            if (!BCrypt.Net.BCrypt.Verify(request.OldPassword, user.PasswordHash))
                return BadRequest(new { Message = "A palavra-passe atual está incorreta." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null,
                ActionType = "CHANGE_PASSWORD",
                Description = "Alterou a sua própria palavra-passe.",
                PerformedBy = user.Username, 
                PerformedRole = performedRole,
                Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            return Ok(new { Message = "Palavra-passe atualizada com sucesso!" });
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
                new Claim("CompanyId", user.CompanyId.ToString()) 
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

    public class ResetPasswordDto { public string NewPassword { get; set; } = string.Empty; }
    public class ChangePasswordDto { public string OldPassword { get; set; } = string.Empty; public string NewPassword { get; set; } = string.Empty; }
    // DTO para a Fotografia
    public class UpdateAvatarDto { public string AvatarBase64 { get; set; } = string.Empty; }
}