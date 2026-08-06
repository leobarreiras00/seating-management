using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using SeatingManagement.API.Data;
using SeatingManagement.API.Services;
using System.Text;

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
                  var uri = new Uri(origin);
                  var host = uri.Host;

                  bool isProduction = host == "seatly-backoffice.vercel.app";

                  bool isMyVercelPreview = host.StartsWith("seatly-backoffice-") && host.EndsWith(".vercel.app");

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
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddSingleton<IMqttService, MqttService>();
builder.Services.AddHostedService(provider => (MqttService)provider.GetRequiredService<IMqttService>());

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("StrictPolicy");
app.UseStaticFiles();

// 4. Ativar Autenticação ANTES da Autorização
app.UseAuthentication(); 
app.UseAuthorization();
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        // Garante que a base de dados e as tabelas são criadas automaticamente no Deploy
        context.Database.EnsureCreated(); 
        // Injeta o Super Admin se estiver vazio
        DbInitializer.Initialize(context);
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Ocorreu um erro ao inicializar a base de dados.");
    }
}

app.Run();