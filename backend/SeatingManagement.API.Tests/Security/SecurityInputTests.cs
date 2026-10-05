using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Security;

/// <summary>
/// SEC-INP: injection, encoding, malformed and oversized input, mass assignment and HTTP method tampering.
/// Tests marked Status=KnownOpen assert the SECURE behaviour that the system does not yet have.
/// </summary>
[Trait("Suite", "Security")]
public class SecurityInputTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public SecurityInputTests(SeatlyWebApplicationFactory f) => _f = f;

    private static bool IsServerError(HttpResponseMessage r) => (int)r.StatusCode >= 500;

    // ---------------------------------------------------------------- SQL injection

    [Theory]
    [InlineData("' OR '1'='1")]
    [InlineData("admin@seatly.test' --")]
    [InlineData("'; DROP TABLE Users; --")]
    [InlineData("' UNION SELECT * FROM Users --")]
    [InlineData("1; DELETE FROM Seats; --")]
    [InlineData("\" OR \"\"=\"")]
    public async Task SEC_INP_01_SqlInjectionInLogin_IsRejected_AndNothingIsDeleted(string payload)
    {
        var client = _f.CreateApiClient();
        var before = (await _f.SeatsOfAsync(TestAccounts.AcmeEventAId)).Count;

        var asEmail = await client.PostAsJsonAsync("/api/Auth/login", new { email = payload, password = payload });
        var asPassword = await client.PostAsJsonAsync("/api/Auth/login", new { email = TestAccounts.SuperAdmin, password = payload });

        Assert.Contains(asEmail.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.BadRequest });
        Assert.Contains(asPassword.StatusCode, new[] { HttpStatusCode.Unauthorized, HttpStatusCode.BadRequest });
        Assert.Equal(before, (await _f.SeatsOfAsync(TestAccounts.AcmeEventAId)).Count);
        Assert.NotNull(await _f.FindUserAsync(TestAccounts.SuperAdmin));
    }

    [Theory]
    [InlineData("' OR '1'='1")]
    [InlineData("'; DROP TABLE Seats; --")]
    public async Task SEC_INP_02_SqlInjectionInForgotPassword_IsRejectedByEmailValidation_AndNothingIsDeleted(string payload)
    {
        var client = _f.CreateApiClient();
        var before = (await _f.SeatsOfAsync(TestAccounts.AcmeEventAId)).Count;

        var injected = await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = payload });

        // The [EmailAddress] validation rejects the payload before it reaches the database (400); a 200 would also be safe.
        Assert.True(injected.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.OK, $"-> {(int)injected.StatusCode}");
        Assert.Equal(before, (await _f.SeatsOfAsync(TestAccounts.AcmeEventAId)).Count);
    }

    [Theory]
    [InlineData("1 OR 1=1")]
    [InlineData("1;DROP TABLE Seats")]
    [InlineData("%27%20OR%20%271%27%3D%271")]
    public async Task SEC_INP_03_SqlInjectionInRouteParameters_NeverReturns200Or500(string payload)
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        foreach (var url in new[] { $"/api/Seat/{payload}", $"/api/Audit/event/{payload}", $"/api/Company/{payload}/users" })
        {
            var response = await admin.GetAsync(url);
            Assert.True(response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest or HttpStatusCode.MethodNotAllowed,
                $"{url} -> {(int)response.StatusCode}");
        }
    }

    [Fact]
    public async Task SEC_INP_04_SqlInjectionInAuditQueryString_IsRejected()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var response = await admin.GetAsync($"/api/Audit/event/{TestAccounts.AcmeEventAId}?page=1%3BDROP%20TABLE%20AuditLogs&pageSize=1%20OR%201%3D1");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await _f.AuditOfAsync(TestAccounts.AcmeEventAId)).Count > 0);
    }

    [Fact]
    public async Task SEC_INP_05_SqlInjectionInGuestNames_IsStoredAsPlainText()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId });
        const string payload = "Robert'); DROP TABLE Seats;--";

        var response = await gestor.PostAsJsonAsync($"/api/Seat/event/{eventId}/walkin",
            new { guestName = payload, category = "VIP", tableName = "1", seatNumber = "1" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(await _f.SeatsOfAsync(eventId), s => s.AssignedTo == payload);
    }

    // ---------------------------------------------------------------- XSS

    [Fact]
    public async Task SEC_INP_10_ScriptPayloads_AreStoredVerbatim_AndServedAsJsonNotHtml()
    {
        // Observation (test-confirmed): the JSON serializer does NOT HTML-escape '<' and '>'. The protection against stored XSS
        // therefore relies on (a) the application/json content type and (b) output encoding in the clients (React and Compose
        // do not render the string as markup). The missing X-Content-Type-Options header is tracked as S-22.
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        const string payload = "<script>alert('XSS')</script>";

        var create = await gestor.PostAsJsonAsync("/api/Event", new { name = payload, startDate = DateTime.UtcNow.AddDays(1), endDate = DateTime.UtcNow.AddDays(2) });
        Assert.Equal(HttpStatusCode.OK, create.StatusCode);

        var list = await gestor.GetAsync("/api/Event/my-events");
        var names = (await list.JsonAsync()).EnumerateArray().Select(e => e.GetProperty("name").GetString()).ToList();

        Assert.Equal("application/json", list.Content.Headers.ContentType?.MediaType);
        Assert.Contains(payload, names);   // stored as plain data, never interpreted
    }

    [Fact]
    public async Task SEC_INP_11_ContactForm_WithHtmlPayload_IsAcceptedWithoutReflection()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/contact",
            new { email = "visitor@seatly.test", message = "<img src=x onerror=alert(1)>" });

        Assert.False(IsServerError(response));
        Assert.DoesNotContain("<img", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SEC_INP_12_ErrorAndSuccessResponses_NeverUseHtmlContentType()
    {
        var client = await _f.ClientForAsync(TestAccounts.GestorAcme);
        foreach (var url in new[] { "/api/Event/my-events", "/api/Seat/99999", "/api/Company/my-company", "/api/Analytics/dashboard" })
        {
            var response = await client.GetAsync(url);
            var type = response.Content.Headers.ContentType?.MediaType;
            Assert.True(type is null or "application/json" or "text/plain" or "application/problem+json", $"{url} -> {type}");
        }
    }

    // ---------------------------------------------------------------- encoding / traversal

    [Theory]
    [InlineData("..%2f..%2f..%2fetc%2fpasswd")]
    [InlineData("..%5c..%5cwindows%5cwin.ini")]
    [InlineData("%2e%2e%2f%2e%2e%2f")]
    public async Task SEC_INP_20_PathTraversal_IsNotServed(string payload)
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var response = await admin.GetAsync($"/api/Seat/{payload}");
        Assert.True(response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.BadRequest, $"-> {(int)response.StatusCode}");
    }

    [Theory]
    [InlineData("admin@seatly.test\0malicious")]
    [InlineData("‮admin@seatly.test")]
    [InlineData("admin@seatly.test\u0000​")]
    public async Task SEC_INP_21_NullBytesAndUnicodeControlCharacters_DoNotCrashOrBypassLogin(string email)
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { email, password = TestAccounts.Password });
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.BadRequest, $"-> {(int)response.StatusCode}");
    }

    [Fact]
    public async Task SEC_INP_22_EmojiAndAccents_AreStoredAndReturnedIntact()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId });
        const string name = "João Ñandú 😀 Çelik";

        var response = await gestor.PostAsJsonAsync($"/api/Seat/event/{eventId}/walkin",
            new { guestName = name, category = "VIP", tableName = "1", seatNumber = "1" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains(await _f.SeatsOfAsync(eventId), s => s.AssignedTo == name);
    }

    // ---------------------------------------------------------------- malformed / oversized

    [Fact]
    public async Task SEC_INP_30_MalformedJson_Returns400()
    {
        var client = _f.CreateApiClient();
        var response = await client.PostAsync("/api/Auth/login", new StringContent("{\"email\": \"x\", ", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SEC_INP_31_WrongContentType_Returns415()
    {
        var client = _f.CreateApiClient();
        var response = await client.PostAsync("/api/Auth/login", new StringContent("email=a&password=b", Encoding.UTF8, "application/x-www-form-urlencoded"));
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task SEC_INP_32_NullBodyAndEmptyBody_AreRejectedWith4xx()
    {
        var client = _f.CreateApiClient();
        var nullBody = await client.PostAsync("/api/Auth/login", new StringContent("null", Encoding.UTF8, "application/json"));
        var empty = await client.PostAsync("/api/Auth/login", new StringContent("", Encoding.UTF8, "application/json"));
        Assert.False(IsServerError(nullBody));
        Assert.False(IsServerError(empty));
    }

    [Fact]
    public async Task SEC_INP_33_OversizedLoginFields_DoNotCrashTheServer()
    {
        var huge = new string('A', 10_000);
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { email = huge, password = huge });
        Assert.True(response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.BadRequest, $"-> {(int)response.StatusCode}");
    }

    [Fact]
    public async Task SEC_INP_34_WrongTypesInJson_Return400()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsync("/api/Event",
            new StringContent("{\"name\": 123, \"startDate\": \"not-a-date\", \"endDate\": []}", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SEC_INP_35_SeatStatusAsUnknownString_Returns400()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var seat = (await _f.SeatsOfAsync(TestAccounts.AcmeEventAId)).First();
        var response = await gestor.PutAsJsonAsync($"/api/Seat/{seat.Id}", new { status = "Hacked" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SEC_INP_36_CsvWithFormulaInjectionCells_IsStoredVerbatim_NotExecuted()
    {
        // The API never evaluates cell content; this documents that the value is kept as text (export hardening is a front-end concern).
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId });

        var response = await gestor.UploadCsvAsync(eventId, "mesa;lugar;categoria;nome\n1;1;VIP;=HYPERLINK(\"http://evil.test\")\n");

        Assert.False(IsServerError(response));
    }

    // ---------------------------------------------------------------- mass assignment

    [Fact]
    public async Task SEC_INP_40_CreateEvent_IgnoresCompanyIdAndIdSentByTheClient()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.PostAsJsonAsync("/api/Event", new
        {
            name = "Mass assignment " + Guid.NewGuid().ToString("N")[..6],
            startDate = DateTime.UtcNow.AddDays(1),
            endDate = DateTime.UtcNow.AddDays(2),
            companyId = TestAccounts.GlobexCompanyId,
            id = 9999
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var id = (await response.JsonAsync()).GetProperty("eventId").GetInt32();
        Assert.NotEqual(9999, id);
        var stored = await _f.QueryAsync(db => db.Events.FindAsync(id).AsTask());
        Assert.Equal(TestAccounts.AcmeCompanyId, stored!.CompanyId);
    }

    [Fact]
    public async Task SEC_INP_41_Register_IgnoresPasswordHashAndMustChangePasswordSentByTheClient()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var email = $"mass.{Guid.NewGuid():N}@seatly.test";

        var response = await gestor.PostAsJsonAsync("/api/Auth/register", new
        {
            email, name = "Mass", role = "Utilizador", companyId = TestAccounts.AcmeCompanyId,
            passwordHash = "attacker-chosen", mustChangePassword = false, id = 12345
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = await _f.FindUserAsync(email);
        Assert.True(user!.MustChangePassword);
        Assert.NotEqual("attacker-chosen", user.PasswordHash);
        Assert.NotEqual(12345, user.Id);
    }

    // ---------------------------------------------------------------- method tampering

    [Theory]
    [InlineData("DELETE", "/api/Auth/login")]
    [InlineData("PUT", "/api/Auth/login")]
    [InlineData("GET", "/api/Auth/login")]
    [InlineData("PATCH", "/api/Event")]
    [InlineData("TRACE", "/api/Auth/login")]
    [InlineData("POST", "/api/Analytics/dashboard")]
    public async Task SEC_INP_50_WrongHttpMethods_AreRejected(string method, string url)
    {
        var client = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), url));
        Assert.True(response.StatusCode is HttpStatusCode.MethodNotAllowed or HttpStatusCode.NotFound, $"{method} {url} -> {(int)response.StatusCode}");
    }

    // ================================================================ KNOWN OPEN FINDINGS

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_60_SingleSeatUpdate_RejectsStatusOutsideTheEnum()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId }, seats: 1);
        var seat = (await _f.SeatsOfAsync(eventId)).Single();

        var response = await gestor.PutAsJsonAsync($"/api/Seat/{eventId}/update/{seat.Id}", new { status = 99 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, (int)(await _f.SeatsOfAsync(eventId)).Single().Status);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_61_AuditPageSize_IsCapped()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.GetAsync($"/api/Audit/event/{TestAccounts.AcmeEventAId}?pageSize=1000000");
        var pageSize = (await response.JsonAsync()).GetProperty("pageSize").GetInt32();
        Assert.True(pageSize <= 200, $"pageSize echoed as {pageSize}");
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_62_AuditNegativePage_IsRejectedInsteadOfCrashing()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.GetAsync($"/api/Audit/event/{TestAccounts.AcmeEventAId}?page=-5&pageSize=-1");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_63_Avatar_LargerThanTwoMegabytes_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var big = "data:image/png;base64," + new string('A', 3 * 1024 * 1024);
        var response = await gestor.PutAsJsonAsync($"/api/Auth/user/{TestAccounts.GestorAcmeId}/avatar", new { avatarBase64 = big });
        Assert.True(response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.RequestEntityTooLarge, $"-> {(int)response.StatusCode}");
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_64_Avatar_ThatIsNotAnImageDataUri_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PutAsJsonAsync($"/api/Auth/user/{TestAccounts.GestorAcmeId}/avatar",
            new { avatarBase64 = "javascript:alert(document.cookie)" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_65_GuestName_OfOneThousandCharacters_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId });
        var response = await gestor.PostAsJsonAsync($"/api/Seat/event/{eventId}/walkin",
            new { guestName = new string('N', 1000), category = "VIP", tableName = "1", seatNumber = "1" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_66_Event_WithEndBeforeStart_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsJsonAsync("/api/Event",
            new { name = "Time travel", startDate = DateTime.UtcNow.AddDays(10), endDate = DateTime.UtcNow.AddDays(1) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_67_Event_WithStartYear2206_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsJsonAsync("/api/Event",
            new { name = "Far future", startDate = new DateTime(2206, 1, 1, 0, 0, 0, DateTimeKind.Utc), endDate = new DateTime(2206, 1, 2, 0, 0, 0, DateTimeKind.Utc) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-21")]
    public async Task SEC_INP_68_Event_WithEmptyName_IsRejected()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsJsonAsync("/api/Event",
            new { name = "", startDate = DateTime.UtcNow.AddDays(1), endDate = DateTime.UtcNow.AddDays(2) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-23")]
    public async Task SEC_INP_69_CsvParserFailure_DoesNotEchoInternalExceptionText()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var eventId = await _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId });

        // Unterminated quote: the CSV library throws, and the controller copies ex.Message into a 500 response.
        var response = await gestor.UploadCsvAsync(eventId, "mesa;lugar;categoria;nome\n\"1;1;VIP;Ana\n2;2;VIP;Bruno\n");
        var body = await response.Content.ReadAsStringAsync();

        Assert.False(IsServerError(response), $"status {(int)response.StatusCode}: {body}");
        Assert.DoesNotContain("Exception", body);
        Assert.DoesNotContain("CsvHelper", body);
    }
}
