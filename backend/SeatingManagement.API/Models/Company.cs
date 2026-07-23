using System.ComponentModel.DataAnnotations;

namespace SeatingManagement.API.Models
{
    public class Company
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        // O URL do Logotipo que vai aparecer no Painel de Gestão da App
        public string LogoUrl { get; set; } = string.Empty;

        public ICollection<User> Users { get; set; } = new List<User>();
        public ICollection<Event> Events { get; set; } = new List<Event>();
    }
}