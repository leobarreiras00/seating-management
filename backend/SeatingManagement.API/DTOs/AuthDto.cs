using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.DTOs
{
    /// <summary>
    /// Password policy: 8 to 72 characters (BCrypt ignores anything beyond 72 bytes), with at least one letter and one digit.
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class StrongPasswordAttribute : ValidationAttribute
    {
        public const int MinLength = 8;
        public const int MaxLength = 72;

        public StrongPasswordAttribute() : base("A palavra-passe deve ter entre 8 e 72 caracteres, com pelo menos uma letra e um número.") { }

        public override bool IsValid(object? value)
        {
            if (value is not string password) return false;
            return password.Length is >= MinLength and <= MaxLength
                && password.Any(char.IsLetter)
                && password.Any(char.IsDigit);
        }
    }

    public class RegisterDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        [StringLength(100)]
        public string Name { get; set; } = string.Empty; 
        
        public string Role { get; set; } = string.Empty;
        public int CompanyId { get; set; }
    }

    public class LoginDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class FirstLoginResetDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string TemporaryPassword { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "A nova palavra-passe é obrigatória.")]
        [StrongPassword]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class ForgotPasswordDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordWithTokenDto
    {
        [Required]
        public string Token { get; set; } = string.Empty;
        
        [Required(ErrorMessage = "A nova palavra-passe é obrigatória.")]
        [StrongPassword]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public Guid UserGuid { get; set; }
    }

    public class ResetPasswordDto 
    { 
        [Required]
        [StrongPassword]
        public string NewPassword { get; set; } = string.Empty; 
    }
    
    public class ChangePasswordDto 
    { 
        [Required]
        public string OldPassword { get; set; } = string.Empty; 
        
        [Required]
        [StrongPassword]
        public string NewPassword { get; set; } = string.Empty; 
    }
        
    public class UpdateAvatarDto 
    { 
        public const int MaxLength = 2 * 1024 * 1024 * 4 / 3; // about 2 MB of image data once base64-encoded

        [MaxLength(MaxLength, ErrorMessage = "A imagem excede o tamanho máximo de 2 MB.")]
        [RegularExpression(@"^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$", ErrorMessage = "A fotografia deve ser uma imagem (PNG, JPEG, WEBP ou GIF).")]
        public string AvatarBase64 { get; set; } = string.Empty; 
    }

    public class ContactDto 
    {
        public string Email { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }
}