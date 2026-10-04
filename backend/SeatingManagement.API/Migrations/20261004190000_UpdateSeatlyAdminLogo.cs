using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SeatingManagement.API.Data;

#nullable disable

namespace SeatingManagement.API.Migrations
{
    /// <summary>
    /// Troca o logótipo de exemplo da empresa de sistema "Seatly Admin" pelo novo logótipo do Seatly.
    /// </summary>
    [DbContext(typeof(AppDbContext))]
    [Migration("20261004190000_UpdateSeatlyAdminLogo")]
    public partial class UpdateSeatlyAdminLogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Companies",
                keyColumn: "Id",
                keyValue: 1,
                column: "LogoUrl",
                value: "https://seatly-backoffice.vercel.app/seatly_icon.png");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Companies",
                keyColumn: "Id",
                keyValue: 1,
                column: "LogoUrl",
                value: "https://img.logoipsum.com/288.svg");
        }
    }
}
