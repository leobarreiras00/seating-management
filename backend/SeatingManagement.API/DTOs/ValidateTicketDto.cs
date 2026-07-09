namespace SeatingManagement.API.DTOs;
public class ValidateTicketDto
{
    public int EventId { get; set; }
    public string TicketHash { get; set; } = string.Empty; 
}