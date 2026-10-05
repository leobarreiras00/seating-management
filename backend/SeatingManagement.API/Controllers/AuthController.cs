using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
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
        private readonly IMemoryCache _cache;

        private static readonly string[] AllowedRoles = { "SuperAdmin", "Gestor", "Utilizador" };

        // Login throttling: after MaxFailedAttempts failures for the same e-mail the account is locked for LockoutWindow.
        private const int MaxFailedAttempts = 10;
        private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

        public AuthController(AppDbContext context, IConfiguration configuration, IEmailService emailService, IMemoryCache cache)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
            _cache = cache;
        }

        private static string FailKey(string email) => $"login-fail:{(email ?? string.Empty).Trim().ToLowerInvariant()}";

        private bool IsLockedOut(string email) =>
            _cache.TryGetValue(FailKey(email), out int failures) && failures >= MaxFailedAttempts;

        private void RegisterFailure(string email)
        {
            var key = FailKey(email);
            _cache.TryGetValue(key, out int failures);
            _cache.Set(key, failures + 1, LockoutWindow);
        }

        private void ClearFailures(string email) => _cache.Remove(FailKey(email));

        private IActionResult TooManyAttempts()
        {
            Response.Headers.RetryAfter = ((int)LockoutWindow.TotalSeconds).ToString();
            return StatusCode(StatusCodes.Status429TooManyRequests,
                new { Message = "Demasiadas tentativas falhadas. Tenta novamente dentro de 15 minutos." });
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
                u.Username,
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
            if (user == null || !CanManageUser(user, allowSelf: true)) return NotFound(new { Message = "Utilizador não encontrado." });

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

        [HttpPost("register")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> Register(RegisterDto request)
        {
            if (!string.IsNullOrWhiteSpace(request.Role) && !AllowedRoles.Contains(request.Role))
                return BadRequest(new { Message = "Função inválida. Valores permitidos: SuperAdmin, Gestor, Utilizador." });

            var isCurrentUserSuperAdmin = User.IsInRole("SuperAdmin");
            if (request.Role == "SuperAdmin" && !isCurrentUserSuperAdmin)
                return StatusCode(403, new { Message = "Acesso Negado: Apenas um SuperAdmin pode criar outro SuperAdmin." });

            if (!isCurrentUserSuperAdmin
                && !(int.TryParse(User.FindFirstValue("CompanyId"), out var callerCompanyId) && callerCompanyId == request.CompanyId))
                return StatusCode(403, new { Message = "Acesso Negado: só podes criar utilizadores na tua empresa." });

            if (await _context.Users.AnyAsync(u => u.Email == request.Email))
                return Conflict(new { Message = "Este e-mail já está registado no sistema." });

            var company = await _context.Companies.FindAsync(request.CompanyId);
            if (company == null) return BadRequest(new { Message = "A empresa especificada não existe." });

            string tempPassword = $"Seatly-{GenerateRandomToken(14)}!";

            var user = new User
            {
                Email = request.Email,
                Username = request.Name,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword),
                UserGuid = Guid.NewGuid(),
                Role = !string.IsNullOrWhiteSpace(request.Role) ? request.Role : "Utilizador",
                CompanyId = request.CompanyId,
                MustChangePassword = true
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

            _ = _emailService.SendWelcomeEmailAsync(user.Email, user.Username, tempPassword, user.Role);

            return Ok(new { Message = "Utilizador criado. O e-mail com as credenciais foi enviado com sucesso!" });
        }

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(LoginDto request)
        {
            if (IsLockedOut(request.Email)) return TooManyAttempts();

            var user = await _context.Users.Include(u => u.Company).FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                RegisterFailure(request.Email);
                return Unauthorized(new { Message = "Credenciais inválidas." });
            }

            ClearFailures(request.Email);

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

        [HttpPost("first-login-reset")]
        [AllowAnonymous]
        public async Task<IActionResult> FirstLoginReset(FirstLoginResetDto request)
        {
            if (IsLockedOut(request.Email)) return TooManyAttempts();

            var user = await _context.Users.Include(u => u.Company).FirstOrDefaultAsync(u => u.Email == request.Email);
            
            if (user == null || !BCrypt.Net.BCrypt.Verify(request.TemporaryPassword, user.PasswordHash))
            {
                RegisterFailure(request.Email);
                return Unauthorized(new { Message = "A palavra-passe temporária está incorreta." });
            }

            ClearFailures(request.Email);

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

            var token = GenerateJwtToken(user);
            return Ok(new { 
                Token = token, UserGuid = user.UserGuid, Role = user.Role,
                CompanyName = user.Company?.Name ?? "Sem Empresa", CompanyLogo = user.Company?.LogoUrl ?? ""
            });
        }

        [HttpPost("forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordDto request)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);
            if (user == null) 
                return Ok(new { Message = "Se o e-mail existir, enviámos as instruções de recuperação." });

            // Only the SHA-256 hash is stored: a database leak does not expose usable reset links.
            var rawToken = GenerateRandomToken(32);
            user.PasswordResetToken = HashToken(rawToken);
            user.ResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            await _emailService.SendPasswordResetEmailAsync(user.Email, rawToken);

            return Ok(new { Message = "Se o e-mail existir, enviámos as instruções de recuperação." });
        }

        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPasswordWithToken(ResetPasswordWithTokenDto request)
        {
            var tokenHash = HashToken(request.Token);
            var user = await _context.Users.FirstOrDefaultAsync(u => u.PasswordResetToken == tokenHash && u.ResetTokenExpiry > DateTime.UtcNow);
            if (user == null) return BadRequest(new { Message = "O link de recuperação é inválido ou já expirou." });

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.PasswordResetToken = null;
            user.ResetTokenExpiry = null;
            user.MustChangePassword = false;

            _context.AuditLogs.Add(new AuditLog
            {
                EventId = null, ActionType = "PASSWORD_RECOVERED",
                Description = $"Redefiniu a palavra-passe através do formulário de recuperação.",
                PerformedBy = user.Username, PerformedRole = user.Role, Timestamp = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
            return Ok(new { Message = "A tua palavra-passe foi redefinida com sucesso." });
        }

        [HttpDelete("user/{id}")]
        [Authorize(Roles = "SuperAdmin,Gestor")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null || !CanManageUser(user, allowSelf: false)) return NotFound(new { Message = "Utilizador não encontrado." });
            string deletedUsername = user.Username;
            _context.Users.Remove(user);
            _cache.Remove(ActiveUserCache.Key(user.UserGuid));
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

        [HttpPost("contact")]
        [AllowAnonymous]
        [EnableRateLimiting("contact")]
        public async Task<IActionResult> ContactSupport([FromBody] ContactDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Message))
              return BadRequest(new { message = "Email e mensagem são obrigatórios." });

            if (request.Email.Length > 254 || request.Message.Length > 2000)
                return BadRequest(new { message = "Email ou mensagem demasiado longos." });

            var contactRecipient = _configuration["Contact:Recipient"];
            if (string.IsNullOrWhiteSpace(contactRecipient))
                return StatusCode(503, new { message = "O formulário de contacto não está disponível de momento." });

            string subject = $"[Seatly Support] Novo contacto de {request.Email}";
            string body = EmailTemplates.SupportContact(request.Email, request.Message);

            await _emailService.SendEmailAsync(contactRecipient, subject, body);

            return Ok(new { message = "Mensagem enviada com sucesso." });
        }

        private string GenerateJwtToken(User user)
        {
            var jwtKey = _configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing"); 
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserGuid.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("CompanyId", user.CompanyId.ToString()) 
            };
            var token = new JwtSecurityToken(issuer: _configuration["Jwt:Issuer"] ?? "SeatingManagementAPI", audience: _configuration["Jwt:Audience"] ?? "SeatingManagementClients", claims: claims, expires: DateTime.UtcNow.AddHours(8), signingCredentials: creds);
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        // SuperAdmin manages anyone; Gestor manages non-SuperAdmin users of their own company;
        // any user may act on their own account only when allowSelf is true.
        private bool CanManageUser(Models.User target, bool allowSelf)
        {
            if (allowSelf && Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var callerGuid) && callerGuid == target.UserGuid)
                return true;

            if (User.IsInRole("SuperAdmin")) return true;

            return User.IsInRole("Gestor")
                && int.TryParse(User.FindFirstValue("CompanyId"), out var callerCompanyId)
                && target.CompanyId == callerCompanyId
                && target.Role != "SuperAdmin";
        }

        // Unbiased random string from an unambiguous alphabet (no 0/O, 1/l/I).
        private static string GenerateRandomToken(int length)
        {
            const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
            var chars = new char[length];
            for (var i = 0; i < length; i++)
                chars[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
            return new string(chars);
        }

        private static string HashToken(string token) =>
            Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token ?? string.Empty)));
    }
}
