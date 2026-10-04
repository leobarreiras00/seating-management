using System.Net;

namespace SeatingManagement.API.Services
{
    /// <summary>
    /// Modelos HTML dos e-mails transacionais do Seatly.
    ///
    /// O HTML é propositadamente "à antiga" (tabelas, estilos inline, atributos bgcolor) para
    /// funcionar em Gmail, Outlook e Apple Mail, incluindo o modo escuro. Não depende de imagens
    /// externas (muitos clientes bloqueiam-nas), por isso a marca é desenhada com texto e cores sólidas.
    /// Todos os valores dinâmicos são codificados em HTML antes de entrarem no modelo.
    /// </summary>
    public static class EmailTemplates
    {
        // Paleta da marca (igual à da aplicação Android e do backoffice)
        private const string Indigo = "#4F46E5";
        private const string Purple = "#7C3AED";
        private const string Navy = "#1E1B4B";
        private const string Soft = "#F5F3FF";
        private const string Border = "#E9E5FF";
        private const string Muted = "#6B7280";
        private const string Body = "#374151";

        private static string E(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);

        /// <summary>Moldura comum: fundo suave, cabeçalho com a marca, cartão branco e rodapé.</summary>
        private static string Layout(string preheader, string title, string contentHtml) => $@"<!DOCTYPE html>
<html lang=""pt"">
<head>
<meta charset=""utf-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1"">
<meta name=""color-scheme"" content=""light only"">
<meta name=""supported-color-schemes"" content=""light only"">
<title>{E(title)}</title>
</head>
<body style=""margin:0;padding:0;background-color:{Soft};"" bgcolor=""{Soft}"">
<div style=""display:none;max-height:0;overflow:hidden;opacity:0;color:{Soft};"">{E(preheader)}</div>
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" bgcolor=""{Soft}"" style=""background-color:{Soft};"">
 <tr><td align=""center"" style=""padding:32px 16px;"">
  <table role=""presentation"" width=""560"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""width:100%;max-width:560px;"">
   <tr><td align=""center"" bgcolor=""{Indigo}"" style=""background-color:{Indigo};background-image:linear-gradient(135deg,{Purple},{Indigo});border-radius:20px 20px 0 0;padding:30px 24px;"">
     <table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0""><tr>
       <td width=""44"" height=""44"" align=""center"" valign=""middle"" bgcolor=""#FFFFFF"" style=""background-color:#FFFFFF;border-radius:14px;color:{Purple};font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:900;line-height:44px;"">S</td>
       <td style=""padding-left:12px;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#FFFFFF;"">Seatly</td>
     </tr></table>
   </td></tr>
   <tr><td bgcolor=""#FFFFFF"" style=""background-color:#FFFFFF;border-left:1px solid {Border};border-right:1px solid {Border};padding:36px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;color:{Body};"">
     {contentHtml}
   </td></tr>
   <tr><td bgcolor=""#FFFFFF"" style=""background-color:#FFFFFF;border:1px solid {Border};border-top:1px solid {Border};border-radius:0 0 20px 20px;padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:{Muted};text-align:center;"">
     Gestão de lugares para eventos, simples e em tempo real.<br>Este é um e-mail automático do Seatly.
   </td></tr>
  </table>
 </td></tr>
</table>
</body>
</html>";

        private static string Heading(string text) =>
            $@"<h1 style=""margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:30px;font-weight:800;color:{Navy};"">{text}</h1>";

        private static string Paragraph(string html) =>
            $@"<p style=""margin:0 0 16px 0;font-size:15px;line-height:24px;color:{Body};"">{html}</p>";

        private static string Button(string href, string label) => $@"
<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" align=""center"" style=""margin:28px auto;"">
 <tr><td align=""center"" bgcolor=""{Indigo}"" style=""background-color:{Indigo};background-image:linear-gradient(135deg,{Purple},{Indigo});border-radius:14px;"">
  <a href=""{E(href)}"" target=""_blank"" style=""display:inline-block;padding:15px 34px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:14px;"">{E(label)}</a>
 </td></tr>
</table>";

        /// <summary>Caixa de destaque com fundo suave (credenciais, mensagem recebida, etc.).</summary>
        private static string Panel(string innerHtml) =>
            $@"<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin:22px 0;""><tr><td bgcolor=""{Soft}"" style=""background-color:{Soft};border:1px solid {Border};border-radius:14px;padding:20px 22px;"">{innerHtml}</td></tr></table>";

        private static string Label(string text) =>
            $@"<div style=""font-size:11px;font-weight:700;letter-spacing:1.2px;color:{Muted};text-transform:uppercase;margin:0 0 4px 0;"">{text}</div>";

        private static string Note(string html) =>
            $@"<p style=""margin:20px 0 0 0;font-size:13px;line-height:20px;color:{Muted};"">{html}</p>";

        /// <summary>E-mail de boas-vindas com as credenciais temporárias de um novo perfil.</summary>
        public static string Welcome(string email, string displayName, string tempPassword, string role)
        {
            var content =
                Heading($"Olá, {E(displayName)}!") +
                Paragraph($"A tua conta de <strong style=\"color:{Navy};\">{E(role)}</strong> foi criada com sucesso no Seatly.") +
                Paragraph("Para entrares no backoffice ou na aplicação móvel, usa as credenciais temporárias abaixo:") +
                Panel(
                    Label("E-mail") +
                    $"<div style=\"font-size:16px;font-weight:700;color:{Navy};margin:0 0 18px 0;word-break:break-all;\">{E(email)}</div>" +
                    Label("Palavra-passe temporária") +
                    $"<div style=\"font-family:'Courier New',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:2px;color:{Purple};word-break:break-all;\">{E(tempPassword)}</div>") +
                Note("<strong>Por segurança</strong>, será pedido que definas uma nova palavra-passe (mínimo de 6 caracteres) no primeiro acesso. Não partilhes este e-mail com ninguém.");
            return Layout("As tuas credenciais de acesso ao Seatly", "Bem-vindo ao Seatly", content);
        }

        /// <summary>E-mail com o botão para repor a palavra-passe.</summary>
        public static string PasswordReset(string resetLink)
        {
            var content =
                Heading("Recuperação de acesso") +
                Paragraph("Recebemos um pedido para repor a palavra-passe associada a este e-mail. Clica no botão abaixo para escolheres uma nova.") +
                Button(resetLink, "Redefinir palavra-passe") +
                Note("Se o botão não funcionar, copia e cola esta ligação no navegador:<br>" +
                     $"<a href=\"{E(resetLink)}\" style=\"color:{Indigo};word-break:break-all;\">{E(resetLink)}</a>") +
                Note("Se não foste tu a pedir esta alteração, podes ignorar este e-mail — a tua palavra-passe atual continua válida.");
            return Layout("Repõe a tua palavra-passe do Seatly", "Recuperação de palavra-passe", content);
        }

        /// <summary>E-mail interno enviado à equipa quando alguém usa o formulário de contacto.</summary>
        public static string SupportContact(string senderEmail, string message)
        {
            var content =
                Heading("Novo pedido de suporte") +
                Paragraph("Recebeste uma nova mensagem através do formulário de contacto do Seatly.") +
                Panel(
                    Label("Remetente") +
                    $"<div style=\"font-size:16px;font-weight:700;margin:0 0 18px 0;\"><a href=\"mailto:{E(senderEmail)}\" style=\"color:{Indigo};text-decoration:none;\">{E(senderEmail)}</a></div>" +
                    Label("Mensagem") +
                    $"<div style=\"font-size:15px;line-height:24px;color:{Navy};white-space:pre-wrap;\">{E(message)}</div>") +
                Note("Para responder, basta clicares em «Responder» no teu cliente de e-mail.");
            return Layout($"Novo contacto de {senderEmail}", "Novo pedido de suporte", content);
        }
    }
}
