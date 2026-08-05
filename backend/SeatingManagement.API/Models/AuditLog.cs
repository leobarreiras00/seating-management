namespace SeatingManagement.API.Models
{
    public class AuditLog
    {
        public int Id { get; set; }
        
        public int? EventId { get; set; } 
        
        public string ActionType { get; set; } = string.Empty; 
        
        public string Description { get; set; } = string.Empty; 
        
        public string PerformedBy { get; set; } = string.Empty; 
        
        // 👇 NOVA COLUNA PARA AS ETIQUETAS NO FRONTEND 👇
        public string PerformedRole { get; set; } = string.Empty; 
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}