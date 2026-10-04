using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace SeatingManagement.API.Services
{
    public interface IEmailService
    {
        Task SendWelcomeEmailAsync(string toEmail, string displayName, string tempPassword, string role);
        Task SendPasswordResetEmailAsync(string toEmail, string resetToken);
        Task SendEmailAsync(string to, string subject, string htmlBody);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
        }

        public async Task SendWelcomeEmailAsync(string toEmail, string displayName, string tempPassword, string role)
        {
            var subject = "Bem-vindo ao Seatly - As tuas credenciais de acesso";
            var body = EmailTemplates.Welcome(toEmail, displayName, tempPassword, role);

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
        {
            var resetLink = $"https://seatly-backoffice.vercel.app/reset-password?token={Uri.EscapeDataString(resetToken)}";

            var subject = "Seatly - Recuperação de Palavra-passe";
            var body = EmailTemplates.PasswordReset(resetLink);

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendEmailAsync(string to, string subject, string htmlBody)
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

                _logger.LogInformation("Sending e-mail through the Brevo API.");
                var response = await client.PostAsync("https://api.brevo.com/v3/smtp/email", content);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("E-mail accepted by the Brevo API.");
                }
                else
                {
                    // The provider response body is intentionally not logged (it may echo personal data).
                    _logger.LogError("Brevo API rejected the e-mail request with status {StatusCode}.", (int)response.StatusCode);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send e-mail.");
                throw; // Lança o erro para que não seja engolido!
            }
        }
    }
}