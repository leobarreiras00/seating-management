using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        public Guid UserGuid { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty; // Serve agora como "Display Name" / Nome Real

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "Utilizador";

        public string AvatarUrl { get; set; } = string.Empty;

        public bool MustChangePassword { get; set; } = true; // Força a Opção B
        
        public string? PasswordResetToken { get; set; }
        public DateTime? ResetTokenExpiry { get; set; }

        public int CompanyId { get; set; }
        public Company Company { get; set; } = null!;

        public ICollection<UserEvent> UserEvents { get; set; } = new List<UserEvent>();
    }
}