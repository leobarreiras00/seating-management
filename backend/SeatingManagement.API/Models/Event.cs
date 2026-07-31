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

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        public int TreatedSeats { get; set; } = 0;

        public int CompanyId { get; set; }
        public Company Company { get; set; } = null!;

        public ICollection<UserEvent> UserEvents { get; set; } = new List<UserEvent>();
        public ICollection<Seat> Seats { get; set; } = new List<Seat>();
    }
}