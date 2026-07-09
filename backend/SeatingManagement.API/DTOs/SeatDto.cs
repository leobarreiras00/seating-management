using SeatingManagement.API.Models;

namespace SeatingManagement.API.DTOs
{
    public class SeatDto
    {
        public int Id { get; set; }
        public string SeatNumber { get; set; } = string.Empty;
        public string EventName { get; set; } = string.Empty;
        public int EventId { get; set; }
        public SeatStatus Status { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime? MarkedAt { get; set; }
    }

    public class CreateSeatDto
    {
        public string SeatNumber { get; set; } = string.Empty;
        public string EventName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Objeto de transferência de dados (DTO) utilizado para receber atualizações de estado de um lugar.
    /// </summary>
    public class UpdateSeatStatusDto
    {
        /// <summary>
        /// O novo estado a atribuir ao lugar (ex: Vazio, Marcado, Tratado).
        /// </summary>
        public string Status { get; set; } = string.Empty;

        /// <summary>
        /// Opcional: O nome da pessoa associada ao lugar após a alteração de estado.
        /// </summary>
        public string? AssignedTo { get; set; }
    }
}