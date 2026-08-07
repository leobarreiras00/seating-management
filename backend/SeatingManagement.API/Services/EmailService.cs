using System.Net;
using System.Net.Mail;

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

                    <p style='color: #ef4444; font-size: 14px; font-weight: bold;'>⚠️ Nota de Segurança: No teu primeiro login, ser-te-á pedido que alteres esta palavra-passe temporária para uma definitiva.</p>
                </div>
                <p style='text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px;'>&copy; {DateTime.Now.Year} Seatly Management Systems. Todos os direitos reservados.</p>
            </div>";

            await SendEmailAsync(toEmail, subject, body);
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
        {
            var resetLink = $"https://seatly-backoffice-48w6jh6ny-leobarreiras00s-projects.vercel.app/reset-password?token={resetToken}";

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

                    <p style='color: #64748b; font-size: 14px; text-align: center;'>Este link expira em 1 hora. Se não fizeste este pedido, podes ignorar este e-mail em segurança.</p>
                </div>
            </div>";

            await SendEmailAsync(toEmail, subject, body);
        }

        private async Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            var smtpServer = _config["EmailSettings:SmtpServer"];
            var smtpPort = int.Parse(_config["EmailSettings:SmtpPort"]!);
            var senderEmail = _config["EmailSettings:SenderEmail"];
            var senderPassword = _config["EmailSettings:SenderPassword"];
            var senderName = _config["EmailSettings:SenderName"];

            using var client = new SmtpClient(smtpServer, smtpPort)
            {
                Credentials = new NetworkCredential(senderEmail, senderPassword),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(senderEmail!, senderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            mailMessage.To.Add(to);

            await client.SendMailAsync(mailMessage);
        }
    }
}