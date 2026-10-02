using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SeatingManagement.API.Models;

namespace SeatingManagement.API.Data
{
    public static class DbInitializer
    {
        public static void Initialize(AppDbContext context, IConfiguration config, ILogger logger)
        {
            var systemCompany = context.Companies.FirstOrDefault(c => c.Name == "Seatly Admin");

            if (systemCompany == null)
            {
                systemCompany = new Company { Name = "Seatly Admin", LogoUrl = "" };
                context.Companies.Add(systemCompany);
                context.SaveChanges();
            }

            var adminEmail = "leo.gbarreiras@gmail.com";
            var admin = context.Users.FirstOrDefault(u => u.Email == adminEmail);

            if (admin == null)
            {
                var initialPassword = config["Seed:AdminPassword"];
                if (string.IsNullOrWhiteSpace(initialPassword) || initialPassword.Length < 12)
                {
                    logger.LogWarning("No initial SuperAdmin created: set Seed__AdminPassword (minimum 12 characters) to seed one.");
                    return;
                }

                var defaultAdmin = new User
                {
                    Email = adminEmail,
                    Username = "Leonardo Barreiras",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(initialPassword),
                    Role = "SuperAdmin",
                    UserGuid = Guid.NewGuid(),
                    CompanyId = systemCompany.Id,
                    MustChangePassword = true
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