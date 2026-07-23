using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SeatingManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class SeedInitialCompany : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Companies",
                columns: new[] { "Id", "LogoUrl", "Name" },
                values: new object[] { 1, "https://img.logoipsum.com/288.svg", "Seatly Admin" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Companies",
                keyColumn: "Id",
                keyValue: 1);
        }
    }
}
