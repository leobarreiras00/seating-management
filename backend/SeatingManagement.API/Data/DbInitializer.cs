using SeatingManagement.API.Models;

namespace SeatingManagement.API.Data
{
    public static class DbInitializer
    {
        public static void Initialize(AppDbContext context)
        {
            // 1. Criar a Empresa de Sistema caso a base de dados esteja vazia
            var systemCompany = context.Companies.FirstOrDefault(c => c.Name == "Seatly Admin");
            
            if (systemCompany == null)
            {
                systemCompany = new Company
                {
                    Name = "Seatly Admin",
                    LogoUrl = ""
                };
                context.Companies.Add(systemCompany);
                context.SaveChanges(); // Grava logo para a BD gerar o ID da empresa!
            }

            // 2. Procura especificamente se a conta 'admin' já existe
            var admin = context.Users.FirstOrDefault(u => u.Username == "admin");

            if (admin == null)
            {
                // Cria o Super Admin e associa-o à empresa acabada de criar
                var defaultAdmin = new User
                {
                    Username = "admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    Role = "SuperAdmin",
                    UserGuid = Guid.NewGuid(),
                    CompanyId = systemCompany.Id // 👇 Agora já tem uma empresa válida! 👇
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
            else 
            {
                // Repõe a password por segurança se a conta já existir
                admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123");
                context.SaveChanges();
            }
        }
    }
}