using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using SeatingManagement.API.Data;
using SeatingManagement.API.Models;
using SeatingManagement.API.Services;

namespace SeatingManagement.API.Tests.Infrastructure;

/// <summary>
/// Boots the real API pipeline in-process (routing, JWT, authorization, model binding, controllers).
/// Only the edges are replaced: PostgreSQL -> SQLite in memory, HiveMQ -> FakeMqttService, Brevo -> FakeEmailService.
/// </summary>
public class SeatlyWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string JwtKey = "integration-tests-signing-key-minimum-32-characters!";
    public const string JwtIssuer = "SeatingManagementAPI";
    public const string JwtAudience = "SeatingManagementApp";
    public const string ContactRecipient = "support@seatly.test";

    private readonly SqliteConnection _connection;
    private readonly ConcurrentDictionary<string, string> _tokens = new();

    public FakeMqttService Mqtt { get; } = new();
    public FakeEmailService Email { get; } = new();

    static SeatlyWebApplicationFactory()
    {
        // Program.cs reads these while the host is being built, so environment variables are the most reliable channel.
        Environment.SetEnvironmentVariable("Jwt__Key", JwtKey);
        Environment.SetEnvironmentVariable("Jwt__Issuer", JwtIssuer);
        Environment.SetEnvironmentVariable("Jwt__Audience", JwtAudience);
        Environment.SetEnvironmentVariable("Contact__Recipient", ContactRecipient);
    }

    public SeatlyWebApplicationFactory()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureTestServices(services =>
        {
            // 1. Database: drop every EF Core registration of AppDbContext (including the Npgsql provider configuration).
            var efDescriptors = services.Where(d =>
                d.ServiceType == typeof(DbContextOptions<AppDbContext>)
                || d.ServiceType == typeof(DbContextOptions)
                || (d.ServiceType.IsGenericType
                    && d.ServiceType.Name.StartsWith("IDbContextOptionsConfiguration", StringComparison.Ordinal)
                    && d.ServiceType.GetGenericArguments().Contains(typeof(AppDbContext)))).ToList();
            foreach (var d in efDescriptors) services.Remove(d);
            services.AddDbContext<AppDbContext>(o => o.UseSqlite(_connection));

            // 2. MQTT: remove the hosted client (registered through a factory) and the service itself.
            var hosted = services.Where(d => d.ServiceType == typeof(IHostedService) && d.ImplementationFactory != null).ToList();
            foreach (var d in hosted) services.Remove(d);
            services.RemoveAll<IMqttService>();
            services.AddSingleton<IMqttService>(Mqtt);

            // 3. E-mail
            services.RemoveAll<IEmailService>();
            services.AddSingleton<IEmailService>(Email);
        });
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.EnsureCreated();
        Seed(db);
        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing) _connection.Dispose();
    }

    // ------------------------------------------------------------------ clients

    public HttpClient CreateApiClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    public async Task<string> GetTokenAsync(string email, string password = TestAccounts.Password)
    {
        var key = email + "|" + password;
        if (_tokens.TryGetValue(key, out var cached)) return cached;

        var client = CreateApiClient();
        var response = await client.PostAsJsonAsync("/api/Auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = json.GetProperty("token").GetString()!;
        _tokens[key] = token;
        return token;
    }

    public async Task<HttpClient> ClientForAsync(string email, string password = TestAccounts.Password)
    {
        var client = CreateApiClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await GetTokenAsync(email, password));
        return client;
    }

    public HttpClient ClientWithToken(string token)
    {
        var client = CreateApiClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // ------------------------------------------------------------------ database helpers

    public async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> work)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await work(db);
    }

    public async Task MutateAsync(Func<AppDbContext, Task> work)
    {
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await work(db);
    }

    public Task<User> CreateUserAsync(string role, int companyId, string? email = null,
        string password = TestAccounts.Password, bool mustChangePassword = false) =>
        QueryAsync(async db =>
        {
            var user = new User
            {
                Email = email ?? $"{role.ToLowerInvariant()}.{Guid.NewGuid():N}@seatly.test",
                Username = "Test " + role,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, 4),
                Role = role,
                CompanyId = companyId,
                MustChangePassword = mustChangePassword
            };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            return user;
        });

    /// <summary>Creates an isolated event (and optionally seats T-1..T-n) so a test never depends on another test's data.</summary>
    public Task<int> CreateEventAsync(int companyId, int[]? assignedUserIds = null, int seats = 0, string? name = null) =>
        QueryAsync(async db =>
        {
            var ev = new Event
            {
                Name = name ?? "Test Event " + Guid.NewGuid().ToString("N")[..6],
                StartDate = DateTime.UtcNow.AddDays(1),
                EndDate = DateTime.UtcNow.AddDays(2),
                CompanyId = companyId
            };
            db.Events.Add(ev);
            await db.SaveChangesAsync();

            foreach (var userId in assignedUserIds ?? Array.Empty<int>())
                db.UserEvents.Add(new UserEvent { UserId = userId, EventId = ev.Id });

            for (var i = 1; i <= seats; i++)
                db.Seats.Add(new Seat { EventId = ev.Id, SeatNumber = $"T-{i}", EventName = "Standard", AssignedTo = $"Guest {i}", Version = 1 });

            await db.SaveChangesAsync();
            return ev.Id;
        });

    public Task<List<Seat>> SeatsOfAsync(int eventId) =>
        QueryAsync(db => db.Seats.AsNoTracking().Where(s => s.EventId == eventId).OrderBy(s => s.Id).ToListAsync());

    public Task<List<AuditLog>> AuditOfAsync(int eventId) =>
        QueryAsync(db => db.AuditLogs.AsNoTracking().Where(a => a.EventId == eventId).OrderBy(a => a.Id).ToListAsync());

    public Task<List<AuditLog>> AuditByActionAsync(string actionType) =>
        QueryAsync(db => db.AuditLogs.AsNoTracking().Where(a => a.ActionType == actionType).OrderBy(a => a.Id).ToListAsync());

    public Task<User?> FindUserAsync(string email) =>
        QueryAsync(db => db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email));

    // ------------------------------------------------------------------ seed

    private static void Seed(AppDbContext db)
    {
        string Hash() => BCrypt.Net.BCrypt.HashPassword(TestAccounts.Password, 4);

        db.Companies.AddRange(
            new Company { Id = TestAccounts.AcmeCompanyId, Name = "Acme Test", LogoUrl = "https://example.test/acme.png" },
            new Company { Id = TestAccounts.GlobexCompanyId, Name = "Globex Test", LogoUrl = "https://example.test/globex.png" });

        db.Users.AddRange(
            new User { Id = TestAccounts.SuperAdminId, Email = TestAccounts.SuperAdmin, Username = "Super Admin", PasswordHash = Hash(), Role = "SuperAdmin", CompanyId = TestAccounts.SeatlyCompanyId, MustChangePassword = false },
            new User { Id = TestAccounts.GestorAcmeId, Email = TestAccounts.GestorAcme, Username = "Gestor Acme", PasswordHash = Hash(), Role = "Gestor", CompanyId = TestAccounts.AcmeCompanyId, MustChangePassword = false },
            new User { Id = TestAccounts.UserAcmeId, Email = TestAccounts.UserAcme, Username = "User Acme", PasswordHash = Hash(), Role = "Utilizador", CompanyId = TestAccounts.AcmeCompanyId, MustChangePassword = false },
            new User { Id = TestAccounts.GestorGlobexId, Email = TestAccounts.GestorGlobex, Username = "Gestor Globex", PasswordHash = Hash(), Role = "Gestor", CompanyId = TestAccounts.GlobexCompanyId, MustChangePassword = false },
            new User { Id = TestAccounts.UserGlobexId, Email = TestAccounts.UserGlobex, Username = "User Globex", PasswordHash = Hash(), Role = "Utilizador", CompanyId = TestAccounts.GlobexCompanyId, MustChangePassword = false },
            new User { Id = TestAccounts.TempUserId, Email = TestAccounts.TempUser, Username = "Temp User", PasswordHash = Hash(), Role = "Utilizador", CompanyId = TestAccounts.AcmeCompanyId, MustChangePassword = true });

        var start = DateTime.UtcNow.AddDays(1);
        db.Events.AddRange(
            new Event { Id = TestAccounts.AcmeEventAId, Name = "Acme Gala", StartDate = start, EndDate = start.AddHours(6), CompanyId = TestAccounts.AcmeCompanyId },
            new Event { Id = TestAccounts.AcmeEventBId, Name = "Acme Conference", StartDate = start, EndDate = start.AddHours(8), CompanyId = TestAccounts.AcmeCompanyId },
            new Event { Id = TestAccounts.GlobexEventId, Name = "Globex Summit", StartDate = start, EndDate = start.AddHours(8), CompanyId = TestAccounts.GlobexCompanyId });

        db.UserEvents.AddRange(
            new UserEvent { UserId = TestAccounts.GestorAcmeId, EventId = TestAccounts.AcmeEventAId },
            new UserEvent { UserId = TestAccounts.GestorAcmeId, EventId = TestAccounts.AcmeEventBId },
            new UserEvent { UserId = TestAccounts.UserAcmeId, EventId = TestAccounts.AcmeEventAId },
            new UserEvent { UserId = TestAccounts.GestorGlobexId, EventId = TestAccounts.GlobexEventId },
            new UserEvent { UserId = TestAccounts.UserGlobexId, EventId = TestAccounts.GlobexEventId });

        var now = DateTime.UtcNow;
        db.Seats.AddRange(
            new Seat { EventId = TestAccounts.AcmeEventAId, SeatNumber = "A-1", EventName = "VIP", AssignedTo = "Alice", Status = SeatStatus.Vazio, Version = 1 },
            new Seat { EventId = TestAccounts.AcmeEventAId, SeatNumber = "A-2", EventName = "VIP", AssignedTo = "Bob", Status = SeatStatus.Vazio, Version = 1 },
            new Seat { EventId = TestAccounts.AcmeEventAId, SeatNumber = "A-3", EventName = "VIP", AssignedTo = "Carol", Status = SeatStatus.Marcado, MarkedAt = now, Version = 2 },
            new Seat { EventId = TestAccounts.AcmeEventAId, SeatNumber = "B-1", EventName = "Standard", AssignedTo = "Dave", Status = SeatStatus.Vazio, Version = 1 },
            new Seat { EventId = TestAccounts.AcmeEventAId, SeatNumber = "B-2", EventName = "Standard", AssignedTo = "Eve", Status = SeatStatus.Tratado, MarkedAt = now, Version = 2 },
            new Seat { EventId = TestAccounts.AcmeEventBId, SeatNumber = "C-1", EventName = "Standard", AssignedTo = "Frank", Version = 1 },
            new Seat { EventId = TestAccounts.AcmeEventBId, SeatNumber = "C-2", EventName = "Standard", AssignedTo = "Grace", Version = 1 },
            new Seat { EventId = TestAccounts.AcmeEventBId, SeatNumber = "C-3", EventName = "Standard", AssignedTo = "Heidi", Version = 1 },
            new Seat { EventId = TestAccounts.GlobexEventId, SeatNumber = "G-1", EventName = "Standard", AssignedTo = "Ivan", Version = 1 },
            new Seat { EventId = TestAccounts.GlobexEventId, SeatNumber = "G-2", EventName = "Standard", AssignedTo = "Judy", Version = 1 },
            new Seat { EventId = TestAccounts.GlobexEventId, SeatNumber = "G-3", EventName = "Standard", AssignedTo = "Mallory", Version = 1 });

        db.AuditLogs.AddRange(
            new AuditLog { EventId = TestAccounts.AcmeEventAId, ActionType = "VALIDATE_SEAT", Description = "seed 1", PerformedBy = "Gestor Acme", PerformedRole = "Gestor", Timestamp = now.AddMinutes(-30) },
            new AuditLog { EventId = TestAccounts.AcmeEventAId, ActionType = "VALIDATE_SEAT", Description = "seed 2", PerformedBy = "Gestor Acme", PerformedRole = "Gestor", Timestamp = now.AddMinutes(-20) },
            new AuditLog { EventId = TestAccounts.AcmeEventAId, ActionType = "UNVALIDATE_SEAT", Description = "seed 3", PerformedBy = "User Acme", PerformedRole = "Utilizador", Timestamp = now.AddMinutes(-10) },
            new AuditLog { EventId = TestAccounts.GlobexEventId, ActionType = "VALIDATE_SEAT", Description = "seed globex", PerformedBy = "Gestor Globex", PerformedRole = "Gestor", Timestamp = now.AddMinutes(-5) });

        db.SaveChanges();
    }
}
