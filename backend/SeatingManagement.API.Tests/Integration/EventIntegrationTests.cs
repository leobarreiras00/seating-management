using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Integration;

/// <summary>INT-EVT: event lifecycle, event access and assignment of staff.</summary>
[Trait("Suite", "Integration")]
public class EventIntegrationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public EventIntegrationTests(SeatlyWebApplicationFactory f) => _f = f;

    private static object NewEvent(string name) => new
    {
        name,
        startDate = DateTime.UtcNow.AddDays(3),
        endDate = DateTime.UtcNow.AddDays(3).AddHours(5)
    };

    [Fact]
    public async Task INT_EVT_01_CreateEvent_AsGestor_BelongsToGestorCompanyAndIsAssignedToCreator()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var name = "Created " + Guid.NewGuid().ToString("N")[..6];

        var response = await gestor.PostAsJsonAsync("/api/Event", NewEvent(name));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var eventId = (await response.JsonAsync()).GetProperty("eventId").GetInt32();

        var ev = await _f.QueryAsync(db => db.Events.AsNoTracking().SingleAsync(e => e.Id == eventId));
        Assert.Equal(name, ev.Name);
        Assert.Equal(TestAccounts.AcmeCompanyId, ev.CompanyId);
        Assert.True(await _f.QueryAsync(db => db.UserEvents.AnyAsync(ue => ue.EventId == eventId && ue.UserId == TestAccounts.GestorAcmeId)));

        var gestorGuid = (await _f.FindUserAsync(TestAccounts.GestorAcme))!.UserGuid;
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/managers/{gestorGuid}/events" && m.Payload == "REFRESH");
    }

    [Fact]
    public async Task INT_EVT_02_CreateEvent_AsSuperAdmin_BelongsToSeatlyCompany()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var response = await admin.PostAsJsonAsync("/api/Event", NewEvent("Admin event"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var eventId = (await response.JsonAsync()).GetProperty("eventId").GetInt32();
        var ev = await _f.QueryAsync(db => db.Events.AsNoTracking().SingleAsync(e => e.Id == eventId));
        Assert.Equal(TestAccounts.SeatlyCompanyId, ev.CompanyId);
    }

    [Fact]
    public async Task INT_EVT_03_CreateEvent_Anonymous_Returns401()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Event", NewEvent("x"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task INT_EVT_04_MyEvents_ReturnsOnlyEventsAssignedToTheCaller()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var userEvents = await (await user.GetAsync("/api/Event/my-events")).JsonAsync();
        var gestorEvents = await (await gestor.GetAsync("/api/Event/my-events")).JsonAsync();

        var userIds = userEvents.EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToList();
        var gestorIds = gestorEvents.EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToList();

        Assert.Contains(TestAccounts.AcmeEventAId, userIds);
        Assert.DoesNotContain(TestAccounts.AcmeEventBId, userIds);
        Assert.DoesNotContain(TestAccounts.GlobexEventId, userIds);
        Assert.Contains(TestAccounts.AcmeEventAId, gestorIds);
        Assert.Contains(TestAccounts.AcmeEventBId, gestorIds);
        Assert.DoesNotContain(TestAccounts.GlobexEventId, gestorIds);
    }

    [Fact]
    public async Task INT_EVT_05_UpdateEvent_GestorOwnCompany_PersistsAndNotifiesClients()
    {
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId });
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.PutAsJsonAsync($"/api/Event/{eventId}", NewEvent("Renamed event"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var ev = await _f.QueryAsync(db => db.Events.AsNoTracking().SingleAsync(e => e.Id == eventId));
        Assert.Equal("Renamed event", ev.Name);
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == "seating/events/updated" && m.Payload == eventId.ToString());
    }

    [Fact]
    public async Task INT_EVT_06_UpdateEvent_OtherCompanyOrUnknownEvent_Returns403()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PutAsJsonAsync($"/api/Event/{TestAccounts.GlobexEventId}", NewEvent("hack"))).StatusCode);

        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PutAsJsonAsync("/api/Event/99999", NewEvent("none"))).StatusCode);
    }

    [Fact]
    public async Task INT_EVT_07_UpdateEvent_AsUtilizador_Returns403()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.PutAsJsonAsync($"/api/Event/{TestAccounts.AcmeEventAId}", NewEvent("hack"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task INT_EVT_08_AssignUser_GestorAssignsSameCompanyUser_UserGainsAccess()
    {
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId }, seats: 2);
        var staff = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var staffClient = await _f.ClientForAsync(staff.Email);

        Assert.Equal(HttpStatusCode.Forbidden, (await staffClient.GetAsync($"/api/Seat/{eventId}")).StatusCode);

        var response = await gestor.PostAsJsonAsync($"/api/Event/{eventId}/assign-user", new { userId = staff.Id });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await staffClient.GetAsync($"/api/Seat/{eventId}")).StatusCode);
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/managers/{staff.UserGuid}/events");
    }

    [Fact]
    public async Task INT_EVT_09_AssignUser_DuplicateAssignment_Returns400()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsJsonAsync($"/api/Event/{TestAccounts.AcmeEventAId}/assign-user", new { userId = TestAccounts.UserAcmeId });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_EVT_10_AssignUser_CrossCompanyAndUnknownTargets_AreRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        // user of another company
        Assert.Equal(HttpStatusCode.BadRequest,
            (await gestor.PostAsJsonAsync($"/api/Event/{TestAccounts.AcmeEventAId}/assign-user", new { userId = TestAccounts.UserGlobexId })).StatusCode);
        // event of another company
        Assert.Equal(HttpStatusCode.Forbidden,
            (await gestor.PostAsJsonAsync($"/api/Event/{TestAccounts.GlobexEventId}/assign-user", new { userId = TestAccounts.UserAcmeId })).StatusCode);
        // unknown user / unknown event
        Assert.Equal(HttpStatusCode.NotFound,
            (await gestor.PostAsJsonAsync($"/api/Event/{TestAccounts.AcmeEventAId}/assign-user", new { userId = 99999 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await gestor.PostAsJsonAsync("/api/Event/99999/assign-user", new { userId = TestAccounts.UserAcmeId })).StatusCode);
    }

    [Fact]
    public async Task INT_EVT_11_DeleteEvent_SuperAdminDeletesEventAndItsSeats()
    {
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId }, seats: 3);
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);

        var response = await admin.DeleteAsync($"/api/Event/{eventId}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(await _f.QueryAsync(db => db.Events.AnyAsync(e => e.Id == eventId)));
        Assert.Empty(await _f.SeatsOfAsync(eventId));
    }

    [Fact]
    public async Task INT_EVT_12_DeleteEvent_GestorOrUnknownEvent_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.DeleteAsync($"/api/Event/{TestAccounts.AcmeEventBId}")).StatusCode);

        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync("/api/Event/99999")).StatusCode);
    }
}
