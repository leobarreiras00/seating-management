using Microsoft.EntityFrameworkCore;

namespace SeatingManagement.API.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
        {
        }
        
        // Aqui vamos colocar as nossas tabelas (DbSets) no próximo passo
    }
}