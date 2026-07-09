using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SeatingManagement.API.Models
{
    public class Seat
    {
        [Key] // Define como Primary Key
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]

        public int EventId { get; set; }
        public string SeatNumber { get; set; } = string.Empty; // Ex: A1, B2, Plateia-1

        [MaxLength(100)]
        public string EventName { get; set; } = string.Empty;

        // O estado do lugar: Vazio, Marcado, Tratado
        public SeatStatus Status { get; set; } = SeatStatus.Vazio;

        // Associado a alguém (opcional, pode ser Guid do user ou nome da pessoa)
        [MaxLength(100)]
        public string? AssignedTo { get; set; }

        // Para guardar o momento exato em que foi tratado/marcado
        public DateTime? MarkedAt { get; set; }

        // Contador de versão para sincronização
        public long Version { get; set; } = 0;
    }

    // Enum para controlar perfeitamente o estado do lugar
    public enum SeatStatus
    {
        Vazio = 0,
        Marcado = 1,
        Tratado = 2
    }
}