using System.Net;
using System.Net.Http.Json;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Integration;

/// <summary>INT-ANA / INT-AUD / INT-SYS: dashboard statistics, audit trail access and platform endpoints.</summary>
[Trait("Suite", "Integration")]
public class AnalyticsAuditSystemIntegrationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public AnalyticsAuditSystemIntegrationTests(SeatlyWebApplicationFactory f) => _f = f;

    // ---------------------------------------------------------------- analytics

    [Fact]
    public async Task INT_ANA_01_Dashboard_GestorSeesOnlyOwnCompanyData()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var json = await (await gestor.GetAsync("/api/Analytics/dashboard")).JsonAsync();
        var stats = json.GetProperty("stats");

        Assert.Equal(2, stats.GetProperty("events").GetInt32());                // Acme Gala + Acme Conference
        Assert.Equal(1, stats.GetProperty("companies").GetInt32());
        Assert.Equal(8, stats.GetProperty("seats").GetInt32());                 // 5 + 3
        Assert.Equal(2, stats.GetProperty("validatedSeats").GetInt32());        // A-3 Marcado, B-2 Tratado
    }

    [Fact]
    public async Task INT_ANA_02_Dashboard_UtilizadorSeesOnlyAssignedEvents()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var stats = (await (await user.GetAsync("/api/Analytics/dashboard")).JsonAsync()).GetProperty("stats");

        Assert.Equal(1, stats.GetProperty("events").GetInt32());
        Assert.Equal(5, stats.GetProperty("seats").GetInt32());
    }

    [Fact]
    public async Task INT_ANA_03_Dashboard_SuperAdminSeesEverything()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var stats = (await (await admin.GetAsync("/api/Analytics/dashboard")).JsonAsync()).GetProperty("stats");

        Assert.True(stats.GetProperty("companies").GetInt32() >= 3);
        Assert.True(stats.GetProperty("events").GetInt32() >= 3);
        Assert.True(stats.GetProperty("seats").GetInt32() >= 11);
    }

    [Fact]
    public async Task INT_ANA_04_Dashboard_TimelineAndProgressAreConsistent()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var json = await (await gestor.GetAsync("/api/Analytics/dashboard")).JsonAsync();

        var timelineTotal = json.GetProperty("timeline").EnumerateArray().Sum(t => t.GetProperty("validations").GetInt32());
        Assert.Equal(2, timelineTotal);

        foreach (var ev in json.GetProperty("eventsProgress").EnumerateArray())
        {
            Assert.Equal(
                ev.GetProperty("total").GetInt32() - ev.GetProperty("validated").GetInt32(),
                ev.GetProperty("remaining").GetInt32());
        }
    }

    [Fact]
    public async Task INT_ANA_05_Dashboard_Anonymous_Returns401()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateApiClient().GetAsync("/api/Analytics/dashboard")).StatusCode);
    }

    // ---------------------------------------------------------------- audit trail

    [Fact]
    public async Task INT_AUD_01_EventsOverview_IsScopedAndCountsLogs()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var json = await (await gestor.GetAsync("/api/Audit/events-overview")).JsonAsync();
        var events = json.EnumerateArray().ToList();

        Assert.Equal(2, events.Count);
        Assert.DoesNotContain(events, e => e.GetProperty("id").GetInt32() == TestAccounts.GlobexEventId);
        var gala = events.Single(e => e.GetProperty("id").GetInt32() == TestAccounts.AcmeEventAId);
        Assert.Equal(3, gala.GetProperty("totalLogs").GetInt32());
        Assert.Equal("Acme Test", gala.GetProperty("companyName").GetString());
    }

    [Fact]
    public async Task INT_AUD_02_EventsOverview_UtilizadorOrAnonymous_IsDenied()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/Audit/events-overview")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateApiClient().GetAsync("/api/Audit/events-overview")).StatusCode);
    }

    [Fact]
    public async Task INT_AUD_03_EventLogs_ArePagedNewestFirst()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var page1 = await (await gestor.GetAsync($"/api/Audit/event/{TestAccounts.AcmeEventAId}?page=1&pageSize=2")).JsonAsync();
        var page2 = await (await gestor.GetAsync($"/api/Audit/event/{TestAccounts.AcmeEventAId}?page=2&pageSize=2")).JsonAsync();

        Assert.Equal(3, page1.GetProperty("totalLogs").GetInt32());
        Assert.Equal(2, page1.GetProperty("logs").GetArrayLength());
        Assert.Equal(1, page2.GetProperty("logs").GetArrayLength());
        Assert.Equal("seed 3", page1.GetProperty("logs")[0].GetProperty("description").GetString());   // newest first
    }

    [Fact]
    public async Task INT_AUD_04_EventLogs_OtherCompanyEvent_Returns403()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        Assert.Equal(HttpStatusCode.Forbidden, (await gestor.GetAsync($"/api/Audit/event/{TestAccounts.GlobexEventId}")).StatusCode);
    }

    // ---------------------------------------------------------------- platform

    [Fact]
    public async Task INT_SYS_01_Health_ReturnsOkForGetAndHead()
    {
        var client = _f.CreateApiClient();

        var get = await client.GetAsync("/health");
        var head = await client.SendAsync(new HttpRequestMessage(HttpMethod.Head, "/health"));

        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal("ok", (await get.JsonAsync()).GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, head.StatusCode);
    }

    [Fact]
    public async Task INT_SYS_02_Root_ReturnsOnlineMessage()
    {
        var response = await _f.CreateApiClient().GetAsync("/");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("online", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task INT_SYS_03_UnknownRoute_Returns404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _f.CreateApiClient().GetAsync("/api/DoesNotExist")).StatusCode);
    }

    [Fact]
    public async Task INT_SYS_04_Swagger_IsNotExposedOutsideDevelopment()
    {
        var client = _f.CreateApiClient();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/swagger/index.html")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/swagger/v1/swagger.json")).StatusCode);
    }

    [Fact]
    public async Task INT_SYS_05_EmailTemplates_EncodeUserSuppliedHtml()
    {
        var welcome = SeatingManagement.API.Services.EmailTemplates.Welcome("a@b.test", "<script>alert(1)</script>", "Seatly-abc123!", "Gestor");
        var contact = SeatingManagement.API.Services.EmailTemplates.SupportContact("a@b.test", "<img src=x onerror=alert(1)>");

        Assert.DoesNotContain("<script>alert(1)</script>", welcome);
        Assert.Contains("&lt;script&gt;", welcome);
        Assert.DoesNotContain("<img src=x onerror=alert(1)>", contact);
        await Task.CompletedTask;
    }
}
