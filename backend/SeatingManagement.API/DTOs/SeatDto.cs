using SeatingManagement.API.Models;

namespace SeatingManagement.API.DTOs
{
    public class SeatDto
    {
        public int Id { get; set; }
        public string SeatNumber { get; set; } = string.Empty;
        public string EventName { get; set; } = string.Empty;
        public SeatStatus Status { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime? MarkedAt { get; set; }
    }

    // DTO específico para a criação de um lugar
    public class CreateSeatDto
    {
        public string SeatNumber { get; set; } = string.Empty;
        public string EventName { get; set; } = string.Empty;
    }
}