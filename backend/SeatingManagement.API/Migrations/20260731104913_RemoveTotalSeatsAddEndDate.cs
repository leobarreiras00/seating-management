using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SeatingManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveTotalSeatsAddEndDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalSeats",
                table: "Events");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "Events",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "Events");

            migrationBuilder.AddColumn<int>(
                name: "TotalSeats",
                table: "Events",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }
    }
}
