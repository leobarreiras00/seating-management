using System.Net;
using System.Net.Http.Json;
using SeatingManagement.API.Models;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Integration;

/// <summary>INT-SEAT: reading and changing seats, ticket validation, bulk updates and manual guest management.</summary>
[Trait("Suite", "Integration")]
public class SeatIntegrationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public SeatIntegrationTests(SeatlyWebApplicationFactory f) => _f = f;

    private Task<int> OwnEventAsync(int seats = 3) =>
        _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId, TestAccounts.UserAcmeId }, seats);

    // ---------------------------------------------------------------- reading

    [Fact]
    public async Task INT_SEAT_01_GetSeatsByEvent_AssignedUser_ReturnsAllSeatsOfThatEvent()
    {
        var eventId = await OwnEventAsync(seats: 4);
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.GetAsync($"/api/Seat/{eventId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seats = (await response.JsonAsync()).EnumerateArray().ToList();
        Assert.Equal(4, seats.Count);
        Assert.All(seats, s => Assert.Equal(eventId, s.GetProperty("eventId").GetInt32()));
    }

    [Fact]
    public async Task INT_SEAT_02_GetSeatsByEvent_UserNotAssignedToEvent_Returns403()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.GetAsync($"/api/Seat/{TestAccounts.AcmeEventBId}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task INT_SEAT_03_GetSeatsByEvent_GestorSeesAnyEventOfOwnCompany_SuperAdminSeesAny()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);

        var unassignedCompanyEvent = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, seats: 2);

        Assert.Equal(HttpStatusCode.OK, (await gestor.GetAsync($"/api/Seat/{unassignedCompanyEvent}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"/api/Seat/{TestAccounts.GlobexEventId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync($"/api/Seat/{TestAccounts.GlobexEventId}")).StatusCode);
    }

    [Fact]
    public async Task INT_SEAT_04_GetAllSeats_OnlySuperAdmin()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/Seat")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/Seat")).StatusCode);
    }

    // ---------------------------------------------------------------- status changes

    [Fact]
    public async Task INT_SEAT_05_UpdateSeatStatus_ValidStatus_PersistsIncrementsVersionAndPublishesToMqtt()
    {
        var eventId = await OwnEventAsync();
        var seat = (await _f.SeatsOfAsync(eventId)).First();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.PutAsJsonAsync($"/api/Seat/{seat.Id}", new { status = "marcado", assignedTo = "Renamed Guest" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(seat.Version + 1, (await response.JsonAsync()).GetProperty("version").GetInt64());

        var stored = (await _f.SeatsOfAsync(eventId)).First(s => s.Id == seat.Id);
        Assert.Equal(SeatStatus.Marcado, stored.Status);
        Assert.NotNull(stored.MarkedAt);
        Assert.Equal("Renamed Guest", stored.AssignedTo);
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/events/{eventId}/updates" && m.Payload.Contains($"\"SeatId\": {seat.Id}") && m.Payload.Contains("\"Status\": 1"));
    }

    [Fact]
    public async Task INT_SEAT_06_UpdateSeatStatus_BackToVazio_ClearsMarkedAt()
    {
        var eventId = await OwnEventAsync();
        var seat = (await _f.SeatsOfAsync(eventId)).First();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        await user.PutAsJsonAsync($"/api/Seat/{seat.Id}", new { status = "Tratado" });
        var response = await user.PutAsJsonAsync($"/api/Seat/{seat.Id}", new { status = "Vazio" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stored = (await _f.SeatsOfAsync(eventId)).First(s => s.Id == seat.Id);
        Assert.Equal(SeatStatus.Vazio, stored.Status);
        Assert.Null(stored.MarkedAt);
        Assert.Equal(seat.Version + 2, stored.Version);
    }

    [Fact]
    public async Task INT_SEAT_07_UpdateSeatStatus_InvalidStatusUnknownSeatOrForeignSeat_AreRejected()
    {
        var eventId = await OwnEventAsync();
        var seat = (await _f.SeatsOfAsync(eventId)).First();
        var globexSeat = (await _f.SeatsOfAsync(TestAccounts.GlobexEventId)).First();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        Assert.Equal(HttpStatusCode.BadRequest, (await gestor.PutAsJsonAsync($"/api/Seat/{seat.Id}", new { status = "NotAStatus" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.PutAsJsonAsync("/api/Seat/999999", new { status = "Marcado" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.PutAsJsonAsync($"/api/Seat/{globexSeat.Id}", new { status = "Marcado" })).StatusCode);
    }

    [Fact]
    public async Task INT_SEAT_08_UpdateSingleSeat_RecordsAuditOnlyWhenStatusActuallyChanges()
    {
        var eventId = await OwnEventAsync();
        var seat = (await _f.SeatsOfAsync(eventId)).First();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        await user.PutAsJsonAsync($"/api/Seat/{eventId}/update/{seat.Id}", new { status = 1 });
        await user.PutAsJsonAsync($"/api/Seat/{eventId}/update/{seat.Id}", new { status = 1 }); // unchanged
        await user.PutAsJsonAsync($"/api/Seat/{eventId}/update/{seat.Id}", new { status = 0 });

        var actions = (await _f.AuditOfAsync(eventId)).Select(a => a.ActionType).ToList();
        Assert.Equal(new[] { "VALIDATE_SEAT", "UNVALIDATE_SEAT" }, actions);
    }

    [Fact]
    public async Task INT_SEAT_09_UpdateSingleSeat_SeatOfAnotherEvent_Returns404()
    {
        var eventId = await OwnEventAsync();
        var otherEventSeat = (await _f.SeatsOfAsync(TestAccounts.AcmeEventAId)).First();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.PutAsJsonAsync($"/api/Seat/{eventId}/update/{otherEventSeat.Id}", new { status = 1 });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------------------------------------------------------------- ticket validation (QR)

    [Fact]
    public async Task INT_SEAT_10_ValidateTicket_ValidSeat_MarksItAuditsAndPublishes()
    {
        var eventId = await OwnEventAsync();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.PostAsJsonAsync("/api/Seat/validate-ticket", new { eventId, ticketHash = "T-1" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stored = (await _f.SeatsOfAsync(eventId)).Single(s => s.SeatNumber == "T-1");
        Assert.Equal(SeatStatus.Marcado, stored.Status);
        Assert.Contains(await _f.AuditOfAsync(eventId), a => a.ActionType == "QR_VALIDATE" && a.Description.Contains("T-1"));
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/events/{eventId}/updates" && m.Payload.Contains($"\"SeatId\": {stored.Id}"));
    }

    [Fact]
    public async Task INT_SEAT_11_ValidateTicket_AlreadyUsedSeat_Returns400()
    {
        var eventId = await OwnEventAsync();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        await user.PostAsJsonAsync("/api/Seat/validate-ticket", new { eventId, ticketHash = "T-2" });
        var second = await user.PostAsJsonAsync("/api/Seat/validate-ticket", new { eventId, ticketHash = "T-2" });

        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Single((await _f.AuditOfAsync(eventId)), a => a.ActionType == "QR_VALIDATE");
    }

    [Fact]
    public async Task INT_SEAT_12_ValidateTicket_UnknownTicketOrForbiddenEvent_AreRejected()
    {
        var eventId = await OwnEventAsync();
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        Assert.Equal(HttpStatusCode.NotFound, (await user.PostAsJsonAsync("/api/Seat/validate-ticket", new { eventId, ticketHash = "NOPE" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsJsonAsync("/api/Seat/validate-ticket", new { eventId = TestAccounts.GlobexEventId, ticketHash = "G-1" })).StatusCode);
    }

    // ---------------------------------------------------------------- bulk status

    [Fact]
    public async Task INT_SEAT_13_BulkStatus_UpdatesEverySeatAndWritesOneAuditEntry()
    {
        var eventId = await OwnEventAsync(seats: 5);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.PutAsJsonAsync($"/api/Seat/{eventId}/bulk-status", new { status = "Tratado" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.All(await _f.SeatsOfAsync(eventId), s => Assert.Equal(SeatStatus.Tratado, s.Status));
        var audit = Assert.Single(await _f.AuditOfAsync(eventId), a => a.ActionType == "BULK_UPDATE");
        Assert.Contains("5 lugares", audit.Description);
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/events/{eventId}/updates" && m.Payload.Contains("REFRESH"));
    }

    [Fact]
    public async Task INT_SEAT_14_BulkStatus_InvalidStatus_Returns400()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PutAsJsonAsync($"/api/Seat/{eventId}/bulk-status", new { status = "Nope" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- manual guest management

    [Fact]
    public async Task INT_SEAT_15_WalkIn_CreatesPendingSeatWithTrimmedNumberAndAudits()
    {
        var eventId = await OwnEventAsync(seats: 0);
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.PostAsJsonAsync($"/api/Seat/event/{eventId}/walkin",
            new { guestName = "Walk In", category = "VIP", tableName = " M1 ", seatNumber = " 7 " });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seat = Assert.Single(await _f.SeatsOfAsync(eventId));
        Assert.Equal("M1-7", seat.SeatNumber);
        Assert.Equal("Walk In", seat.AssignedTo);
        Assert.Equal("VIP", seat.EventName);
        Assert.Equal(SeatStatus.Vazio, seat.Status);
        Assert.Contains(await _f.AuditOfAsync(eventId), a => a.ActionType == "CREATE_GUEST");
    }

    [Fact]
    public async Task INT_SEAT_16_EditGuest_UpdatesSeatAndStoresBeforeAfterDiffInAudit()
    {
        var eventId = await OwnEventAsync();
        var seat = (await _f.SeatsOfAsync(eventId)).First();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.PutAsJsonAsync($"/api/Seat/{seat.Id}/edit",
            new { guestName = "New Name", category = "Premium", tableName = "Z", seatNumber = "9" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stored = (await _f.SeatsOfAsync(eventId)).First(s => s.Id == seat.Id);
        Assert.Equal("Z-9", stored.SeatNumber);
        Assert.Equal("New Name", stored.AssignedTo);
        Assert.Equal("Premium", stored.EventName);
        Assert.Equal(seat.Version + 1, stored.Version);

        var audit = Assert.Single(await _f.AuditOfAsync(eventId), a => a.ActionType == "UPDATE_GUEST");
        Assert.NotNull(audit.PayloadJson);
        Assert.Contains("\"Before\"", audit.PayloadJson);
        Assert.Contains("\"After\"", audit.PayloadJson);
        Assert.Contains("Z-9", audit.PayloadJson);
    }

    [Fact]
    public async Task INT_SEAT_17_EditAndDeleteGuest_ForeignOrUnknownSeat_Return404()
    {
        var globexSeat = (await _f.SeatsOfAsync(TestAccounts.GlobexEventId)).First();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        Assert.Equal(HttpStatusCode.NotFound, (await gestor.PutAsJsonAsync($"/api/Seat/{globexSeat.Id}/edit",
            new { guestName = "x", category = "x", tableName = "x", seatNumber = "1" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.DeleteAsync($"/api/Seat/{globexSeat.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.DeleteAsync("/api/Seat/999999")).StatusCode);
    }

    [Fact]
    public async Task INT_SEAT_18_DeleteGuest_RemovesSeatAndAudits()
    {
        var eventId = await OwnEventAsync();
        var seat = (await _f.SeatsOfAsync(eventId)).First();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.DeleteAsync($"/api/Seat/{seat.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain(await _f.SeatsOfAsync(eventId), s => s.Id == seat.Id);
        Assert.Contains(await _f.AuditOfAsync(eventId), a => a.ActionType == "DELETE_GUEST");
    }
}
