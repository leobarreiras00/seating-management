using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SeatingManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSeatVersion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "Version",
                table: "Seats",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Version",
                table: "Seats");
        }
    }
}
