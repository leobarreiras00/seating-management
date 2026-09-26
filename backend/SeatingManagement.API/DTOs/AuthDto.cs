using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
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
        [MinLength(6, ErrorMessage = "A palavra-passe deve ter no mínimo 6 caracteres.")]
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
        [MinLength(6, ErrorMessage = "A palavra-passe deve ter no mínimo 6 caracteres.")]
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
        [MinLength(6, ErrorMessage = "A palavra-passe deve ter no mínimo 6 caracteres.")]
        public string NewPassword { get; set; } = string.Empty; 
    }
    
    public class ChangePasswordDto 
    { 
        [Required]
        public string OldPassword { get; set; } = string.Empty; 
        
        [Required]
        [MinLength(6, ErrorMessage = "A palavra-passe deve ter no mínimo 6 caracteres.")]
        public string NewPassword { get; set; } = string.Empty; 
    }
        
    public class UpdateAvatarDto 
    { 
        public string AvatarBase64 { get; set; } = string.Empty; 
    }
}