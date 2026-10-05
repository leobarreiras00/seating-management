using System.Net;
using System.Net.Http.Json;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Security;

/// <summary>
/// SEC-AUTHZ: role-based access control (vertical), tenant isolation and object-level authorization (horizontal / IDOR).
/// Every test asserts the SECURE behaviour. Tests tagged Finding=S-xx are regression tests for findings
/// that were confirmed (and, at the time, failing) in the first security run and remediated afterwards.
/// </summary>
[Trait("Suite", "Security")]
public class SecurityAuthorizationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public SecurityAuthorizationTests(SeatlyWebApplicationFactory f) => _f = f;

    private static readonly HttpStatusCode[] Denied = { HttpStatusCode.Forbidden, HttpStatusCode.NotFound };

    // ---------------------------------------------------------------- vertical escalation

    [Fact]
    public async Task SEC_AUTHZ_01_Utilizador_IsForbiddenOnManagerEndpoints()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var calls = new (string, string)[]
        {
            ("GET", "/api/Auth/users"), ("POST", "/api/Auth/register"), ("DELETE", "/api/Auth/user/1"),
            ("PUT", "/api/Event/1"), ("POST", "/api/Event/1/assign-user"), ("DELETE", "/api/Event/1"),
            ("GET", "/api/Audit/events-overview")
        };

        var failures = await SecurityAuthenticationTests.ProbeAsync(user, calls, HttpStatusCode.Forbidden);

        Assert.True(failures.Count == 0, "Utilizador reached manager endpoints:\n" + string.Join("\n", failures));
    }

    [Fact]
    public async Task SEC_AUTHZ_02_UtilizadorAndGestor_AreForbiddenOnSuperAdminEndpoints()
    {
        var calls = new (string, string)[]
        {
            ("GET", "/api/Seat"), ("DELETE", "/api/Event/1"),
            ("GET", "/api/Company"), ("POST", "/api/Company"), ("PUT", "/api/Company/1"), ("PUT", "/api/Company/1/logo"),
            ("DELETE", "/api/Company/1"), ("GET", "/api/Company/1/managers"), ("GET", "/api/Company/1/users"),
            ("GET", "/api/Company/1/events"), ("POST", "/api/Company/1/events"),
            ("POST", "/api/Company/1/events/1/assign/x"), ("DELETE", "/api/Company/1/events/1/assign/1")
        };

        foreach (var email in new[] { TestAccounts.UserAcme, TestAccounts.GestorAcme })
        {
            var failures = await SecurityAuthenticationTests.ProbeAsync(await _f.ClientForAsync(email), calls, HttpStatusCode.Forbidden);
            Assert.True(failures.Count == 0, $"{email} reached SuperAdmin endpoints:\n" + string.Join("\n", failures));
        }
    }

    [Fact]
    public async Task SEC_AUTHZ_03_Gestor_CannotRegisterSuperAdmin()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var email = $"escalation.{Guid.NewGuid():N}@seatly.test";

        var response = await gestor.PostAsJsonAsync("/api/Auth/register",
            new { email, name = "Escalation", role = "SuperAdmin", companyId = TestAccounts.AcmeCompanyId });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null(await _f.FindUserAsync(email));
    }

    [Fact]
    public async Task SEC_AUTHZ_04_Gestor_CannotRegisterUsersInAnotherCompany()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var email = $"crosstenant.{Guid.NewGuid():N}@seatly.test";

        var response = await gestor.PostAsJsonAsync("/api/Auth/register",
            new { email, name = "Cross Tenant", role = "Utilizador", companyId = TestAccounts.GlobexCompanyId });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null(await _f.FindUserAsync(email));
    }

    [Fact]
    public async Task SEC_AUTHZ_05_RoleClaimInBody_CannotElevateAnExistingUser()
    {
        // The role is read from the signed token, never from the request: a Utilizador cannot call a manager endpoint
        // by sending a "role" field.
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.PostAsJsonAsync("/api/Auth/register",
            new { email = $"x.{Guid.NewGuid():N}@seatly.test", name = "X", role = "Utilizador", companyId = TestAccounts.AcmeCompanyId, isAdmin = true });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ---------------------------------------------------------------- horizontal / IDOR

    [Fact]
    public async Task SEC_AUTHZ_10_GestorOfAcme_CannotTouchAnyGlobexEventResource()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var globexSeat = (await _f.SeatsOfAsync(TestAccounts.GlobexEventId)).First();
        var e = TestAccounts.GlobexEventId;

        var calls = new (string Method, string Url, object? Body)[]
        {
            ("GET", $"/api/Seat/{e}", null),
            ("PUT", $"/api/Seat/{globexSeat.Id}", new { status = "Marcado" }),
            ("PUT", $"/api/Seat/{e}/update/{globexSeat.Id}", new { status = 1 }),
            ("PUT", $"/api/Seat/{e}/bulk-status", new { status = "Marcado" }),
            ("POST", $"/api/Seat/event/{e}/walkin", new { guestName = "Intruder", category = "VIP", tableName = "Z", seatNumber = "9" }),
            ("PUT", $"/api/Seat/{globexSeat.Id}/edit", new { guestName = "Intruder", category = "VIP", tableName = "Z", seatNumber = "9" }),
            ("DELETE", $"/api/Seat/{globexSeat.Id}", null),
            ("POST", $"/api/SeatCsv/clear/{e}", null),
            ("GET", $"/api/Audit/event/{e}", null),
            ("PUT", $"/api/Event/{e}", new { name = "Hijacked", startDate = DateTime.UtcNow.AddDays(1), endDate = DateTime.UtcNow.AddDays(2) }),
            ("POST", $"/api/Event/{e}/assign-user", new { userId = TestAccounts.UserAcmeId }),
            ("DELETE", $"/api/Event/{e}", null)
        };

        var failures = new List<string>();
        foreach (var (method, url, body) in calls)
        {
            var response = await gestor.SendJsonAsync(new HttpMethod(method), url, body);
            if (!Denied.Contains(response.StatusCode)) failures.Add($"{method} {url} -> {(int)response.StatusCode}");
        }
        Assert.True(failures.Count == 0, "Cross-tenant access succeeded:\n" + string.Join("\n", failures));

        var after = await _f.SeatsOfAsync(e);
        Assert.Equal(3, after.Count);
        Assert.DoesNotContain(after, s => s.AssignedTo == "Intruder");
        Assert.All(after, s => Assert.Equal(0, (int)s.Status));
    }

    [Fact]
    public async Task SEC_AUTHZ_11_CsvImportIntoAnotherCompanysEvent_IsRefused_AndLeavesDataUntouched()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.UploadCsvAsync(TestAccounts.GlobexEventId, ApiHelpers.ValidCsv);

        Assert.Contains(response.StatusCode, Denied);
        Assert.Equal(3, (await _f.SeatsOfAsync(TestAccounts.GlobexEventId)).Count);
    }

    [Fact]
    public async Task SEC_AUTHZ_12_UtilizadorNotAssigned_CannotAccessAnotherEventOfTheSameCompany()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var e = TestAccounts.AcmeEventBId;
        var seat = (await _f.SeatsOfAsync(e)).First();

        var calls = new (string Method, string Url, object? Body)[]
        {
            ("GET", $"/api/Seat/{e}", null),
            ("PUT", $"/api/Seat/{seat.Id}", new { status = "Marcado" }),
            ("PUT", $"/api/Seat/{e}/update/{seat.Id}", new { status = 1 }),
            ("PUT", $"/api/Seat/{e}/bulk-status", new { status = "Marcado" }),
            ("GET", $"/api/Audit/event/{e}", null)
        };

        var failures = new List<string>();
        foreach (var (method, url, body) in calls)
        {
            var response = await user.SendJsonAsync(new HttpMethod(method), url, body);
            if (!Denied.Contains(response.StatusCode)) failures.Add($"{method} {url} -> {(int)response.StatusCode}");
        }
        Assert.True(failures.Count == 0, string.Join("\n", failures));
        Assert.All(await _f.SeatsOfAsync(e), s => Assert.Equal(0, (int)s.Status));
    }

    [Fact]
    public async Task SEC_AUTHZ_13_Gestor_CannotDeleteOrChangeAvatarOfUsersFromAnotherCompany()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var victim = await _f.CreateUserAsync("Utilizador", TestAccounts.GlobexCompanyId);

        var delete = await gestor.DeleteAsync($"/api/Auth/user/{victim.Id}");
        var avatar = await gestor.PutAsJsonAsync($"/api/Auth/user/{victim.Id}/avatar", new { avatarBase64 = "data:image/png;base64,AAAA" });

        Assert.Contains(delete.StatusCode, Denied);
        Assert.Contains(avatar.StatusCode, Denied);
        var still = await _f.FindUserAsync(victim.Email);
        Assert.NotNull(still);
        Assert.NotEqual("data:image/png;base64,AAAA", still!.AvatarUrl);
    }

    [Fact]
    public async Task SEC_AUTHZ_14_Utilizador_CannotChangeAnotherUsersAvatar()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.PutAsJsonAsync($"/api/Auth/user/{TestAccounts.GestorAcmeId}/avatar", new { avatarBase64 = "data:image/png;base64,AAAA" });
        Assert.Contains(response.StatusCode, Denied);
    }

    [Fact]
    public async Task SEC_AUTHZ_15_Gestor_CannotAssignAUserOfAnotherCompanyToItsEvent()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsJsonAsync($"/api/Event/{TestAccounts.AcmeEventAId}/assign-user", new { userId = TestAccounts.UserGlobexId });
        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task SEC_AUTHZ_16_MyEvents_ListsOnlyEventsOfTheCallersCompany()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorGlobex);
        var body = await (await gestor.GetAsync("/api/Event/my-events")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("Acme Gala", body);
        Assert.DoesNotContain("Acme Conference", body);
    }

    [Fact]
    public async Task SEC_AUTHZ_17_AnalyticsDashboard_DoesNotLeakOtherCompaniesData()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorGlobex);
        var body = await (await gestor.GetAsync("/api/Analytics/dashboard")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("Acme", body);
    }

    [Fact]
    public async Task SEC_AUTHZ_18_AuditOverview_ListsOnlyOwnCompanyEvents()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorGlobex);
        var body = await (await gestor.GetAsync("/api/Audit/events-overview")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("Acme", body);
    }

    [Fact]
    public async Task SEC_AUTHZ_19_ForgedTokenWithAnotherCompanyId_DoesNotGrantAccess()
    {
        // Valid signature (attacker somehow holds the key is NOT assumed): a real Gestor token cannot be re-used
        // with a different CompanyId because the claim is part of the signed payload.
        var real = await _f.GetTokenAsync(TestAccounts.GestorAcme);
        var tampered = TestJwt.TamperPayloadKeepSignature(real);
        var response = await _f.ClientWithToken(tampered).GetAsync($"/api/Seat/{TestAccounts.GlobexEventId}");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ================================================================ REGRESSION TESTS FOR REMEDIATED FINDINGS

    [Fact, Trait("Finding", "S-19")]
    public async Task SEC_AUTHZ_20_Utilizador_CannotCreateEvents()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.PostAsJsonAsync("/api/Event",
            new { name = "Created by Utilizador", startDate = DateTime.UtcNow.AddDays(1), endDate = DateTime.UtcNow.AddDays(2) });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact, Trait("Finding", "S-19")]
    public async Task SEC_AUTHZ_21_Utilizador_CannotWipeTheGuestListOfAnEvent()
    {
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.UserAcmeId }, seats: 3);
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.PostAsync($"/api/SeatCsv/clear/{eventId}", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(3, (await _f.SeatsOfAsync(eventId)).Count);
    }

    [Fact, Trait("Finding", "S-19")]
    public async Task SEC_AUTHZ_22_Utilizador_CannotReplaceTheGuestListWithACsvImport()
    {
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.UserAcmeId }, seats: 3);
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);

        var response = await user.UploadCsvAsync(eventId, ApiHelpers.ValidCsv);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact, Trait("Finding", "S-19")]
    public async Task SEC_AUTHZ_23_Utilizador_CannotReadTheAuditTrailOfAnEvent()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.GetAsync($"/api/Audit/event/{TestAccounts.AcmeEventAId}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact, Trait("Finding", "S-20")]
    public async Task SEC_AUTHZ_24_Register_RejectsRolesOutsideTheKnownSet()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var email = $"badrole.{Guid.NewGuid():N}@seatly.test";

        var response = await gestor.PostAsJsonAsync("/api/Auth/register",
            new { email, name = "Bad Role", role = "Root", companyId = TestAccounts.AcmeCompanyId });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(await _f.FindUserAsync(email));
    }
}
