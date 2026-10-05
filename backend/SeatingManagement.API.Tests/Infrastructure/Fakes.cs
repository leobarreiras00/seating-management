using System.Collections.Concurrent;
using SeatingManagement.API.Services;

namespace SeatingManagement.API.Tests.Infrastructure;

public record PublishedMessage(string Topic, string Payload);

public record SentEmail(string To, string Subject, string Body, string? TempPassword = null, string? ResetToken = null);

/// <summary>Replaces the HiveMQ client: records every message the API would publish.</summary>
public class FakeMqttService : IMqttService
{
    private readonly ConcurrentQueue<PublishedMessage> _messages = new();

    public IReadOnlyList<PublishedMessage> Messages => _messages.ToArray();

    public Task PublishSeatUpdateAsync(int eventId, int seatId, int status)
    {
        _messages.Enqueue(new PublishedMessage($"seating/events/{eventId}/updates", $"{{\"SeatId\": {seatId}, \"Status\": {status}}}"));
        return Task.CompletedTask;
    }

    public Task PublishCommandAsync(int eventId, string command)
    {
        _messages.Enqueue(new PublishedMessage($"seating/events/{eventId}/updates", $"{{\"cmd\": \"{command}\"}}"));
        return Task.CompletedTask;
    }

    public Task PublishMessageAsync(string topic, string payload)
    {
        _messages.Enqueue(new PublishedMessage(topic, payload));
        return Task.CompletedTask;
    }
}

/// <summary>Replaces Brevo: records every e-mail, including the temporary password or reset token it carries.</summary>
public class FakeEmailService : IEmailService
{
    private readonly ConcurrentQueue<SentEmail> _sent = new();

    public IReadOnlyList<SentEmail> Sent => _sent.ToArray();

    public IReadOnlyList<SentEmail> For(string email) =>
        _sent.Where(e => string.Equals(e.To, email, StringComparison.OrdinalIgnoreCase)).ToList();

    public Task SendWelcomeEmailAsync(string toEmail, string displayName, string tempPassword, string role)
    {
        _sent.Enqueue(new SentEmail(toEmail, "welcome", EmailTemplates.Welcome(toEmail, displayName, tempPassword, role), TempPassword: tempPassword));
        return Task.CompletedTask;
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string resetToken)
    {
        _sent.Enqueue(new SentEmail(toEmail, "reset", EmailTemplates.PasswordReset($"https://test.local/reset-password?token={resetToken}"), ResetToken: resetToken));
        return Task.CompletedTask;
    }

    public Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        _sent.Enqueue(new SentEmail(to, subject, htmlBody));
        return Task.CompletedTask;
    }
}
