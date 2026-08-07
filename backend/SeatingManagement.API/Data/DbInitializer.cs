using SeatingManagement.API.Models;

namespace SeatingManagement.API.Data
{
    public static class DbInitializer
    {
        public static void Initialize(AppDbContext context)
        {
            var systemCompany = context.Companies.FirstOrDefault(c => c.Name == "Seatly Admin");
            
            if (systemCompany == null)
            {
                systemCompany = new Company { Name = "Seatly Admin", LogoUrl = "" };
                context.Companies.Add(systemCompany);
                context.SaveChanges(); 
            }

            var admin = context.Users.FirstOrDefault(u => u.Email == "leo.gbarreiras@gmail.com");

            if (admin == null)
            {
                var defaultAdmin = new User
                {
                    Email = "leo.gbarreiras@gmail.com",
                    Username = "Leonardo Barreiras", // Display Name
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    Role = "SuperAdmin",
                    UserGuid = Guid.NewGuid(),
                    CompanyId = systemCompany.Id,
                    MustChangePassword = false // O admin mestre não é obrigado a mudar no 1º login
                };

                context.Users.Add(defaultAdmin);
                
                context.AuditLogs.Add(new AuditLog
                {
                    ActionType = "SYSTEM_INIT",
                    Description = "Sistema iniciado. Empresa e conta 'admin' padrão geradas.",
                    PerformedBy = "Sistema",
                    PerformedRole = "Sistema",
                    Timestamp = DateTime.UtcNow
                });
                
                context.SaveChanges();
            }
        }
    }
}