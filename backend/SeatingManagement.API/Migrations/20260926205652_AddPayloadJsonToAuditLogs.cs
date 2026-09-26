using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SeatingManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPayloadJsonToAuditLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PayloadJson",
                table: "AuditLogs",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PayloadJson",
                table: "AuditLogs");
        }
    }
}
