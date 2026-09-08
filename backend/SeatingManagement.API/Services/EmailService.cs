using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SeatingManagement.API.Services
{
    public interface IEmailService
    {
        Task SendWelcomeEmailAsync(string toEmail, string displayName, string tempPassword, string role);
        Task SendPasswordResetEmailAsync(string toEmail, string resetToken);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string displayName, string tempPassword, string role)
        {
            var subject = "Bem-vindo ao Seatly - As tuas credenciais de acesso";
            var body = $@"
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 40px; border-radius: 20px;'>
                <div style='text-align: center; margin-bottom: 30px;'>
                    <h1 style='color: #7c3aed; font-size: 32px; font-weight: 900; margin: 0;'>Seatly<span style='color: #a855f7;'>✔</span></h1>
                </div>
                <div style='background-color: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
                    <h2 style='color: #0f172a; margin-top: 0;'>Olá, {displayName}!</h2>
                    <p style='color: #475569; font-size: 16px; line-height: 1.6;'>A tua conta de <strong>{role}</strong> foi criada com sucesso na plataforma Seatly.</p>
                    <p style='color: #475569; font-size: 16px; line-height: 1.6;'>Para acederes ao teu dashboard ou aplicação mobile, utiliza as seguintes credenciais temporárias:</p>
                    
                    <div style='background-color: #f1f5f9; padding: 20px; border-radius: 10px; margin: 25px 0; text-align: center; border: 1px solid #e2e8f0;'>
                        <p style='margin: 0; color: #64748b; font-size: 14px;'>E-MAIL</p>
                        <p style='margin: 5px 0 15px 0; color: #0f172a; font-size: 18px; font-weight: bold;'>{toEmail}</p>
                        
                        <p style='margin: 0; color: #64748b; font-size: 14px;'>PALAVRA-PASSE TEMPORÁRIA</p>
                        <p style='margin: 5px 0 0 0; color: #7c3aed; font-size: 24px; font-weight: 900; letter-spacing: 2px;'>{tempPassword}</p>
                    </div>
                </div>
            </div>";

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
        {
            var resetLink = $"https://seatly-backoffice.vercel.app/reset-password?token={resetToken}";

            var subject = "Seatly - Recuperação de Palavra-passe";
            var body = $@"
            <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 40px; border-radius: 20px;'>
                <div style='text-align: center; margin-bottom: 30px;'>
                    <h1 style='color: #7c3aed; font-size: 32px; font-weight: 900; margin: 0;'>Seatly<span style='color: #a855f7;'>✔</span></h1>
                </div>
                <div style='background-color: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
                    <h2 style='color: #0f172a; margin-top: 0;'>Recuperação de Acesso</h2>
                    <p style='color: #475569; font-size: 16px; line-height: 1.6;'>Recebemos um pedido para repor a palavra-passe associada a este e-mail.</p>
                    
                    <div style='text-align: center; margin: 35px 0;'>
                        <a href='{resetLink}' style='background-color: #7c3aed; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);'>Redefinir Palavra-passe</a>
                    </div>
                </div>
            </div>";

            await SendEmailAsync(toEmail, subject, body);
        }

        private async Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            try
            {
                var apiKey = _config["EmailSettings:BrevoApiKey"];
                var senderEmail = _config["EmailSettings:SenderEmail"];
                var senderName = _config["EmailSettings:SenderName"] ?? "Seatly Admin";

                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("api-key", apiKey);
                client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var payload = new
                {
                    sender = new { name = senderName, email = senderEmail },
                    to = new[] { new { email = to } },
                    subject = subject,
                    htmlContent = htmlBody
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                Console.WriteLine($"[EMAIL] A enviar via API do Brevo para: {to}...");
                var response = await client.PostAsync("https://api.brevo.com/v3/smtp/email", content);

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[EMAIL] SUCESSO! E-mail enviado para {to}.");
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"[EMAIL ERRO BREVO] {response.StatusCode}: {error}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[EMAIL ERRO CRÍTICO] Falha ao enviar o e-mail: {ex.Message}");
                throw; // Lança o erro para que não seja engolido!
            }
        }
    }
}