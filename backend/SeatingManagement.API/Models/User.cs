using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.Models
{
    public class User
    {
        [Key]
        public int Id { get; set; }

        public Guid UserGuid { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        public string Username { get; set; } = string.Empty;

        [Required]
        public string PasswordHash { get; set; } = string.Empty;

        // O PIN para as ações de gestão de dados (encriptado)
        public string PinHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "Utilizador";
    }
}