using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SeatingManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSeatsToEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TotalSeats",
                table: "Events",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TreatedSeats",
                table: "Events",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalSeats",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "TreatedSeats",
                table: "Events");
        }
    }
}
