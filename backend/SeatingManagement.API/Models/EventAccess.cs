using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace SeatingManagement.API.Models
{
    public class EventAccess
    {
        [Required]
        public string UserId { get; set; } = string.Empty;
        
        [ForeignKey("UserId")]
        public IdentityUser? User { get; set; }

        [Required]
        public int EventId { get; set; }
        
        [ForeignKey("EventId")]
        public Event? Event { get; set; }
    }
}