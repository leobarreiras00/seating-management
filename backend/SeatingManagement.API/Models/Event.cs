using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.Models
{
    public class Event
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Data do Evento (para aparecer debaixo do nome na App)
        public DateTime StartDate { get; set; }

        // Associação Multi-Tenant
        public int CompanyId { get; set; }
        public Company Company { get; set; } = null!;

        public ICollection<UserEvent> UserEvents { get; set; } = new List<UserEvent>();
    }
}