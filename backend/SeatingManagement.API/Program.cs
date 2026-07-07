using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Data;

var builder = WebApplication.CreateBuilder(args);

// 1. Adicionar os Controladores
builder.Services.AddControllers();

// 2. Configurar o Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 3. Configurar a Base de Dados (Entity Framework)
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// 4. Activar o Swagger no ambiente de desenvolvimento
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); // Isto é o que gera a interface visual
}

// Removi o app.UseHttpsRedirection(); para evitar o aviso no Mac
app.UseAuthorization();
app.MapControllers();

app.Run();