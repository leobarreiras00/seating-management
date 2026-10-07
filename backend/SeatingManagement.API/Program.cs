using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SeatingManagement.API.Data;
using SeatingManagement.API.Services;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

// Permitir ligações vindas da Vercel
builder.Services.AddCors(options =>
{
    options.AddPolicy("StrictPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin => 
              {
                  // "Origin: null" (sandboxed iframes, file://) and malformed values must be refused, never throw.
                  if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                  var host = uri.Host;

                  bool isHttps = uri.Scheme == Uri.UriSchemeHttps;

                  bool isProduction = isHttps && host == "seatly-backoffice.vercel.app";

                  bool isMyVercelPreview = isHttps && host.StartsWith("seatly-backoffice-") && host.EndsWith(".vercel.app");

                  bool isLocal = host == "localhost" || host == "127.0.0.1";

                  return isProduction || isMyVercelPreview || isLocal;
              })
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 2. Configurar o Swagger para aceitar Tokens (Cadeado visual)
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Insira o token JWT gerado no login."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            new string[] {}
        }
    });
});

// Configuração da Base de Dados
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Atrás do proxy da Render o IP real do cliente vem em X-Forwarded-For
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
    options.ForwardLimit = 1;
});

builder.Services.AddMemoryCache();

// Limitação de pedidos: o formulário de contacto é público e envia e-mail, por isso tem um limite por IP.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("contact", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "600";
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync("{\"message\":\"Demasiados pedidos. Tenta novamente dentro de alguns minutos.\"}", token);
    };
});

// 3. Configurar a Autenticação JWT
var jwtKey = builder.Configuration["Jwt:Key"] ?? throw new InvalidOperationException("JWT Key is missing");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };

        // A signed token is only honoured while its user still exists (e.g. after DeleteUser the token stops working).
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                if (!Guid.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var userGuid))
                {
                    context.Fail("Invalid subject.");
                    return;
                }

                var cache = context.HttpContext.RequestServices.GetRequiredService<IMemoryCache>();
                if (cache.TryGetValue(ActiveUserCache.Key(userGuid), out _)) return;

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                if (!await db.Users.AsNoTracking().AnyAsync(u => u.UserGuid == userGuid))
                {
                    context.Fail("User no longer exists.");
                    return;
                }

                cache.Set(ActiveUserCache.Key(userGuid), true, ActiveUserCache.Ttl);
            }
        };
    });

builder.Services.AddSingleton<IMqttService, MqttService>();
builder.Services.AddHostedService(provider => (MqttService)provider.GetRequiredService<IMqttService>());
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<IEventAccessService, EventAccessService>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseForwardedHeaders();

// Security headers on every response (the API only returns JSON, so a strict CSP is safe outside Swagger).
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "no-referrer";
        headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
        headers["Cross-Origin-Resource-Policy"] = "same-origin";
        if (!app.Environment.IsDevelopment())
        {
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        }
        if (!headers.ContainsKey("Cache-Control")) headers["Cache-Control"] = "no-store";
        return Task.CompletedTask;
    });
    await next();
});

app.UseCors("StrictPolicy");
app.UseRateLimiter();

// 4. Ativar Autenticação ANTES da Autorização
app.UseAuthentication(); 
app.UseAuthorization();
app.MapControllers();

if (!app.Environment.IsEnvironment("Testing"))
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        // Garante que a base de dados e as tabelas são criadas automaticamente no Deploy
        context.Database.Migrate();
        DbInitializer.Initialize(context, services.GetRequiredService<IConfiguration>(), services.GetRequiredService<ILogger<Program>>());
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocorreu um erro ao inicializar a base de dados.");
    }
}

app.MapMethods("/", new[] { "GET", "HEAD" }, () => "A API do Seatly está online e a correr a 100%!");
app.MapMethods("/health", new[] { "GET", "HEAD" }, () => Results.Ok(new { status = "ok" }));
app.Run();

// Exposes the entry point to the integration test project (WebApplicationFactory<Program>).
public partial class Program { }

/// <summary>Short-lived cache of "this user still exists", so token validation does not hit the database on every request.</summary>
public static class ActiveUserCache
{
    public static readonly TimeSpan Ttl = TimeSpan.FromSeconds(30);
    public static string Key(Guid userGuid) => $"user-active:{userGuid}";
}
