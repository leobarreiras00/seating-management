using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using SeatingManagement.API.Models;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Integration;

/// <summary>INT-COMP: company administration (SuperAdmin) and company-scoped reads.</summary>
[Trait("Suite", "Integration")]
public class CompanyIntegrationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public CompanyIntegrationTests(SeatlyWebApplicationFactory f) => _f = f;

    private async Task<int> CreateCompanyAsync(HttpClient admin, string name)
    {
        var response = await admin.PostAsJsonAsync("/api/Company", new { name, logoUrl = "https://example.test/logo.png" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.JsonAsync()).GetProperty("companyId").GetInt32();
    }

    [Fact]
    public async Task INT_COMP_01_CreateCompany_SuperAdmin_AppearsInListAndNotifiesBackoffice()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var name = "Company " + Guid.NewGuid().ToString("N")[..6];

        var id = await CreateCompanyAsync(admin, name);

        var list = await (await admin.GetAsync("/api/Company")).JsonAsync();
        Assert.Contains(list.EnumerateArray(), c => c.GetProperty("id").GetInt32() == id && c.GetProperty("name").GetString() == name);
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == "seating/backoffice/companies");
    }

    [Fact]
    public async Task INT_COMP_02_CreateCompany_EmptyNameOrNonSuperAdmin_IsRejected()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PostAsJsonAsync("/api/Company", new { name = "  ", logoUrl = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PostAsJsonAsync("/api/Company", new { name = "Nope", logoUrl = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync("/api/Company")).StatusCode);
    }

    [Fact]
    public async Task INT_COMP_03_UpdateCompany_PersistsAndNotifiesCompanyUsers()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var id = await CreateCompanyAsync(admin, "To Rename");
        var member = await _f.CreateUserAsync("Gestor", id);

        var response = await admin.PutAsJsonAsync($"/api/Company/{id}", new { name = "Renamed", logoUrl = "https://example.test/new.png" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stored = await _f.QueryAsync(db => db.Companies.AsNoTracking().SingleAsync(c => c.Id == id));
        Assert.Equal("Renamed", stored.Name);
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/managers/{member.UserGuid}/profile" && m.Payload == "REFRESH_PROFILE");
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync("/api/Company/99999", new { name = "x", logoUrl = "" })).StatusCode);
    }

    [Fact]
    public async Task INT_COMP_04_UploadLogo_StoresImageAndRejectsEmptyOrUnknown()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var id = await CreateCompanyAsync(admin, "Logo Company");

        var ok = await admin.PutAsJsonAsync($"/api/Company/{id}/logo", new { logoBase64 = "data:image/png;base64,AAAA" });

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal("data:image/png;base64,AAAA", (await _f.QueryAsync(db => db.Companies.AsNoTracking().SingleAsync(c => c.Id == id))).LogoUrl);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"/api/Company/{id}/logo", new { logoBase64 = "" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync("/api/Company/99999/logo", new { logoBase64 = "data:image/png;base64,AAAA" })).StatusCode);
    }

    [Fact]
    public async Task INT_COMP_05_DeleteCompany_BlockedWhenItHasUsersOrIsTheCallersOwn_AllowedWhenEmpty()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.DeleteAsync($"/api/Company/{TestAccounts.SeatlyCompanyId}")).StatusCode);   // own company
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.DeleteAsync($"/api/Company/{TestAccounts.AcmeCompanyId}")).StatusCode);      // has users and events

        var empty = await CreateCompanyAsync(admin, "Disposable");
        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/Company/{empty}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.DeleteAsync($"/api/Company/{empty}")).StatusCode);
    }

    [Fact]
    public async Task INT_COMP_06_MyCompany_ReturnsTheCallersOwnCompany()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorGlobex);
        var json = await (await gestor.GetAsync("/api/Company/my-company")).JsonAsync();
        Assert.Equal("Globex Test", json.GetProperty("name").GetString());
    }

    [Fact]
    public async Task INT_COMP_07_ManagersAndUsers_AreListedPerCompanyByRole()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);

        var managers = await (await admin.GetAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/managers")).JsonAsync();
        var users = await (await admin.GetAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/users")).JsonAsync();

        Assert.Contains(managers.EnumerateArray(), m => m.GetProperty("email").GetString() == TestAccounts.GestorAcme);
        Assert.DoesNotContain(managers.EnumerateArray(), m => m.GetProperty("email").GetString() == TestAccounts.GestorGlobex);
        Assert.Contains(users.EnumerateArray(), u => u.GetProperty("email").GetString() == TestAccounts.UserAcme);
    }

    [Fact]
    public async Task INT_COMP_08_CompanyEvents_ReportTotalAndTreatedSeats()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var companyId = await CreateCompanyAsync(admin, "Counting Company");
        var eventId = await _f.CreateEventAsync(companyId, seats: 4);
        await _f.MutateAsync(async db =>
        {
            var seat = db.Seats.First(s => s.EventId == eventId);
            seat.Status = SeatStatus.Tratado;
            await db.SaveChangesAsync();
        });

        var events = await (await admin.GetAsync($"/api/Company/{companyId}/events")).JsonAsync();

        var ev = Assert.Single(events.EnumerateArray());
        Assert.Equal(4, ev.GetProperty("totalSeats").GetInt32());
        Assert.Equal(1, ev.GetProperty("treatedSeats").GetInt32());
    }

    [Fact]
    public async Task INT_COMP_09_CreateEventForCompany_SuperAdminOnly()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var body = new { name = "Admin made", startDate = DateTime.UtcNow.AddDays(2), endDate = DateTime.UtcNow.AddDays(3) };

        var ok = await admin.PostAsJsonAsync($"/api/Company/{TestAccounts.GlobexCompanyId}/events", body);

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(TestAccounts.GlobexCompanyId, (await ok.JsonAsync()).GetProperty("companyId").GetInt32());
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.PostAsJsonAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/events", body)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsJsonAsync("/api/Company/99999/events", body)).StatusCode);
    }

    [Fact]
    public async Task INT_COMP_10_RemoveAccess_RevokesUsersAccessToTheEvent()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var staff = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { staff.Id }, seats: 2);
        var staffClient = await _f.ClientForAsync(staff.Email);
        Assert.Equal(HttpStatusCode.OK, (await staffClient.GetAsync($"/api/Seat/{eventId}")).StatusCode);

        var response = await admin.DeleteAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/events/{eventId}/assign/{staff.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await staffClient.GetAsync($"/api/Seat/{eventId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.DeleteAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/events/{eventId}/assign/{staff.Id}")).StatusCode);
    }

    [Fact]
    public async Task INT_COMP_11_AssignAccess_GrantsUsersAccessToTheEvent_AndRejectsForeignUsers()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var staff = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var foreign = await _f.CreateUserAsync("Utilizador", TestAccounts.GlobexCompanyId);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, System.Array.Empty<int>(), seats: 2);
        var staffClient = await _f.ClientForAsync(staff.Email);
        Assert.Equal(HttpStatusCode.Forbidden, (await staffClient.GetAsync($"/api/Seat/{eventId}")).StatusCode);

        var granted = await admin.PostAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/events/{eventId}/assign/{staff.Id}", null);

        Assert.Equal(HttpStatusCode.OK, granted.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await staffClient.GetAsync($"/api/Seat/{eventId}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await admin.PostAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/events/{eventId}/assign/{staff.Id}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.PostAsync($"/api/Company/{TestAccounts.AcmeCompanyId}/events/{eventId}/assign/{foreign.Id}", null)).StatusCode);
    }
}
