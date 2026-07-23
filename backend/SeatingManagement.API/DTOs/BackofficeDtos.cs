namespace SeatingManagement.API.DTOs
{
    public class AssignUserDto
    {
        public int UserId { get; set; }
    }

    public class ManagerResponseDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class EventStatsResponseDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public int TotalSeats { get; set; }
        public int TreatedSeats { get; set; }
    }
}