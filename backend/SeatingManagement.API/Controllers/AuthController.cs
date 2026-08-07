using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SeatingManagement.API.Data;
using SeatingManagement.API.DTOs;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace SeatingManagement.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;

        public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
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
                u.Email,
                u.Username, // Nome de exibição
                u.Role,
                CompanyName = u.Company != null ? u.Company.Name : "Administração Central",
                CompanyLogo = u.Company != null ? u.Company.LogoUrl : "",
                AvatarUrl = u.AvatarUrl,
                Events = u.UserEvents.Select(ue => new { Id = ue.EventId, Name = ue.Event.Name }).ToList()
            }).ToListAsync();

            return Ok(users);
        }

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
                PerformedBy = performedBy, PerformedRole = performedRole, Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Avatar atualizado com sucesso!", AvatarUrl = user.AvatarUrl });
        }

        // 👇 A NOVA CRIAÇÃO COM EMAIL E PASS TEMPORÁRIA 👇
        [HttpPost("register")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> Register(RegisterDto request)
        {
            var isCurrentUserSuperAdmin = User.IsInRole("SuperAdmin");
            if (request.Role == "SuperAdmin" && !isCurrentUserSuperAdmin)
                return StatusCode(403, new { Message = "Acesso Negado: Apenas um SuperAdmin pode criar outro SuperAdmin." });

            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
                return Conflict(new { Message = "Este e-mail já está registado no sistema." });

            var company = await _context.Companies.FindAsync(request.CompanyId);
            if (company == null) return BadRequest(new { Message = "A empresa especificada não existe." });

            // Gera Password Segura: ex "Seatly-x9A2!j"
            string tempPassword = $"Seatly-{GenerateRandomToken(6)}!";

            var user = new User
            {
                Email = request.Email,
                Username = request.Name, // O Display Name
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword),
                UserGuid = Guid.NewGuid(),
                Role = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : "Utilizador",
                CompanyId = request.CompanyId,
                MustChangePassword = true // Obriga à Opção B
            };

            _context.Users.Add(user);

            var performedBy = User.Identity?.Name ?? "Sistema";
            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null, ActionType = "CREATE_USER",
                Description = $"Criou o utilizador '{user.Username}' ({user.Email}) com a função de '{user.Role}'.",
                PerformedBy = performedBy, PerformedRole = performedRole, Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            // Dispara o e-mail de forma assíncrona (não bloqueia a resposta da API)
            _ = _emailService.SendWelcomeEmailAsync(user.Email, user.Username, tempPassword, user.Role);

            return Ok(new { Message = "Utilizador criado. O e-mail com as credenciais foi enviado com sucesso!" });
        }

        // 👇 O NOVO LOGIN COM EMAIL E OPÇÃO B 👇
        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginDto request)
        {
            var user = await _context.Users.Include(u => u.Company).FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
                return Unauthorized(new { Message = "Credenciais inválidas." });

            // OPÇÃO B: Verifica se é o 1º login
            if (user.MustChangePassword)
            {
                return StatusCode(403, new { 
                    RequiresPasswordReset = true, 
                    Message = "Por questões de segurança, deves definir uma palavra-passe definitiva no teu primeiro acesso." 
                });
            }

            var token = GenerateJwtToken(user);
            return Ok(new { 
                Token = token, UserGuid = user.UserGuid, Role = user.Role,
                CompanyName = user.Company?.Name ?? "Sem Empresa", CompanyLogo = user.Company?.LogoUrl ?? ""
            });
        }

        // 👇 ENDPOINT EXCLUSIVO PARA O 1º LOGIN (OPÇÃO B) 👇
        [HttpPost("first-login-reset")]
        [AllowAnonymous]
        public async Task<IActionResult> FirstLoginReset(FirstLoginResetDto request)
        {
            var user = await _context.Users.Include(u => u.Company).FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.TemporaryPassword, user.PasswordHash))
                return Unauthorized(new { Message = "A palavra-passe temporária está incorreta." });

            if (!user.MustChangePassword)
                return BadRequest(new { Message = "Este utilizador já concluiu o processo de primeiro acesso." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.MustChangePassword = false;

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null, ActionType = "FIRST_LOGIN_RESET",
                Description = $"Concluiu o registo de segurança no primeiro acesso.",
                PerformedBy = user.Username, PerformedRole = user.Role, Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();

            // Gera já o token definitivo para ele entrar direto sem ter de voltar ao ecrã de login
            var token = GenerateJwtToken(user);
            return Ok(new { 
                Token = token, UserGuid = user.UserGuid, Role = user.Role,
                CompanyName = user.Company?.Name ?? "Sem Empresa", CompanyLogo = user.Company?.LogoUrl ?? ""
            });
        }

        // 👇 ESQUECEU-SE DA PASSWORD (GERA TOKEN E ENVIA EMAIL) 👇
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null) 
                return Ok(new { Message = "Se o e-mail existir, enviámos as instruções de recuperação." }); // Segurança para não enumerar emails

            user.PasswordResetToken = GenerateRandomToken(32);
            user.ResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            _ = _emailService.SendPasswordResetEmailAsync(user.Email, user.PasswordResetToken);

            return Ok(new { Message = "Se o e-mail existir, enviámos as instruções de recuperação." });
        }

        // 👇 CONFIRMA RECUPERAÇÃO COM TOKEN 👇
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPasswordWithToken(ResetPasswordWithTokenDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == request.Token && u.ResetTokenExpiry > DateTime.UtcNow);
            if (user == null) return BadRequest(new { Message = "O link de recuperação é inválido ou já expirou." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordResetToken = null;
            user.ResetTokenExpiry = null;
            user.MustChangePassword = false; // Se ele recuperou, não precisa do reset de 1º login

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null, ActionType = "PASSWORD_RECOVERED",
                Description = $"Redefiniu a palavra-passe através do formulário de recuperação.",
                PerformedBy = user.Username, PerformedRole = user.Role, Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { Message = "A tua palavra-passe foi redefinida com sucesso." });
        }

        // [HttpDelete, ChangePassword e GenerateJwtToken mantêm-se iguais]
        [HttpDelete("user/{id}")]
        [Authorize] 
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound(new { Message = "Utilizador não encontrado." });
            string deletedUsername = user.Username;
            _context.Users.Remove(user);
            var performedBy = User.Identity?.Name ?? "Sistema";
            var performedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema";
            _context.AuditLogs.Add(new AuditLog { EventId = null, ActionType = "DELETE_USER", Description = $"Apagou a conta do utilizador '{deletedUsername}'.", PerformedBy = performedBy, PerformedRole = performedRole, Timestamp = DateTime.UtcNow });
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Conta apagada com sucesso." });
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

            _context.AuditLogs.Add(new AuditLog { EventId = null, ActionType = "CHANGE_PASSWORD", Description = "Alterou a sua própria palavra-passe.", PerformedBy = user.Username, PerformedRole = User.FindFirstValue(ClaimTypes.Role) ?? "Sistema", Timestamp = DateTime.UtcNow });
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
            var token = new JwtSecurityToken(issuer: _configuration["Jwt:Issuer"] ?? "SeatingManagementAPI", audience: _configuration["Jwt:Audience"] ?? "SeatingManagementClients", claims: claims, expires: DateTime.UtcNow.AddDays(1), signingCredentials: creds);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // Função utilitária para gerar senhas/tokens seguros
        private string GenerateRandomToken(int length)
        {
            using var rng = RandomNumberGenerator.Create();
            var byteToken = new byte[length];
            rng.GetBytes(byteToken);
            return Convert.ToBase64String(byteToken).Replace("+", "").Replace("/", "").Substring(0, length);
        }
    }

    public class ResetPasswordDto { 
        public string NewPassword { get; set; } = string.Empty; }
    public class ChangePasswordDto { 
        public string OldPassword { get; set; } = string.Empty; 
        public string NewPassword { get; set; } = string.Empty; }
        
    public class UpdateAvatarDto { 
        public string AvatarBase64 { get; set; } = string.Empty; }
}