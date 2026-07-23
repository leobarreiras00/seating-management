namespace SeatingManagement.API.DTOs
{
    public class EventResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
    }
    
    public class CreateEventDto
    {
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
    }
}