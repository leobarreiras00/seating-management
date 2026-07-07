using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Models;

namespace SeatingManagement.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }
        
        public DbSet<Seat> Seats { get; set; }
        public DbSet<User> Users { get; set; }
    }
}