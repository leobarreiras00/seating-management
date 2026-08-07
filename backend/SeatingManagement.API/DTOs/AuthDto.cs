using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string Name { get; set; } = string.Empty; // Display Name
        
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

    // Usado na Opção B
    public class FirstLoginResetDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
        
        [Required]
        public string TemporaryPassword { get; set; } = string.Empty;
        
        [Required]
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
        
        [Required]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public Guid UserGuid { get; set; }
    }
}