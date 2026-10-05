using System.Net;
using System.Net.Http.Headers;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Security;

/// <summary>
/// SEC-CFG: CORS policy, documentation exposure and response hardening.
/// Tests marked Status=KnownOpen assert the SECURE behaviour that the system does not yet have.
/// </summary>
[Trait("Suite", "Security")]
public class SecurityConfigTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public SecurityConfigTests(SeatlyWebApplicationFactory f) => _f = f;

    private static HttpRequestMessage WithOrigin(HttpMethod method, string url, string origin)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.TryAddWithoutValidation("Origin", origin);
        return request;
    }

    private static string? AllowOrigin(HttpResponseMessage r) =>
        r.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? values.FirstOrDefault() : null;

    // ---------------------------------------------------------------- CORS

    [Theory]
    [InlineData("https://seatly-backoffice.vercel.app")]
    [InlineData("https://seatly-backoffice-git-develop-leo.vercel.app")]
    [InlineData("http://localhost:3000")]
    [InlineData("http://127.0.0.1:3000")]
    public async Task SEC_CFG_01_AllowedOrigins_ReceiveTheCorsHeader(string origin)
    {
        var response = await _f.CreateApiClient().SendAsync(WithOrigin(HttpMethod.Get, "/health", origin));
        Assert.Equal(origin, AllowOrigin(response));
    }

    [Theory]
    [InlineData("https://evil.example")]
    [InlineData("https://seatly-backoffice.vercel.app.evil.com")]
    [InlineData("https://seatly-backoffice-x.vercel.app.evil.com")]
    [InlineData("https://evilseatly-backoffice.vercel.app")]
    [InlineData("https://localhost.evil.com")]
    [InlineData("https://other-project.vercel.app")]
    public async Task SEC_CFG_02_ForeignOrigins_DoNotReceiveTheCorsHeader(string origin)
    {
        var response = await _f.CreateApiClient().SendAsync(WithOrigin(HttpMethod.Get, "/health", origin));
        Assert.Null(AllowOrigin(response));
    }

    [Fact]
    public async Task SEC_CFG_03_Preflight_FromAllowedOrigin_IsAnswered()
    {
        var request = WithOrigin(HttpMethod.Options, "/api/Auth/login", "https://seatly-backoffice.vercel.app");
        request.Headers.TryAddWithoutValidation("Access-Control-Request-Method", "POST");
        request.Headers.TryAddWithoutValidation("Access-Control-Request-Headers", "authorization,content-type");

        var response = await _f.CreateApiClient().SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("https://seatly-backoffice.vercel.app", AllowOrigin(response));
    }

    [Fact]
    public async Task SEC_CFG_04_Preflight_FromForeignOrigin_IsNotAuthorised()
    {
        var request = WithOrigin(HttpMethod.Options, "/api/Auth/login", "https://evil.example");
        request.Headers.TryAddWithoutValidation("Access-Control-Request-Method", "POST");

        var response = await _f.CreateApiClient().SendAsync(request);

        Assert.Null(AllowOrigin(response));
    }

    [Fact]
    public async Task SEC_CFG_05_CorsPolicy_DoesNotAllowCredentialsWithWildcard()
    {
        var response = await _f.CreateApiClient().SendAsync(WithOrigin(HttpMethod.Get, "/health", "https://evil.example"));
        Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
        Assert.NotEqual("*", AllowOrigin(response));
    }

    // ---------------------------------------------------------------- documentation exposure

    [Theory]
    [InlineData("/swagger")]
    [InlineData("/swagger/index.html")]
    [InlineData("/swagger/v1/swagger.json")]
    [InlineData("/openapi/v1.json")]
    public async Task SEC_CFG_10_SwaggerAndOpenApi_AreNotExposedOutsideDevelopment(string url)
    {
        var response = await _f.CreateApiClient().GetAsync(url);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---------------------------------------------------------------- information leakage

    [Fact]
    public async Task SEC_CFG_20_ErrorResponses_DoNotLeakInfrastructureDetails()
    {
        var client = _f.CreateApiClient();
        var responses = new[]
        {
            await client.GetAsync("/api/Seat/1"),
            await client.GetAsync("/does-not-exist"),
            await client.PostAsync("/api/Auth/login", new StringContent("{", System.Text.Encoding.UTF8, "application/json"))
        };
        foreach (var r in responses)
        {
            var body = await r.Content.ReadAsStringAsync();
            foreach (var marker in new[] { "Npgsql", "Microsoft.", "System.", "StackTrace", "ConnectionString", "Host=", "Password=" })
                Assert.DoesNotContain(marker, body);
            Assert.False(r.Headers.Contains("X-Powered-By"));
        }
    }

    [Fact]
    public async Task SEC_CFG_21_LoginResponse_ContainsNoPasswordHashOrResetToken()
    {
        var response = await _f.CreateApiClient().PostAsync("/api/Auth/login",
            JsonContentOf(new { email = TestAccounts.GestorAcme, password = TestAccounts.Password }));
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("passwordHash", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("resetToken", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("$2", body);   // bcrypt prefix
    }

    [Fact]
    public async Task SEC_CFG_22_UserList_ContainsNoPasswordHashOrResetToken()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var body = await (await admin.GetAsync("/api/Auth/users")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("passwordHash", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("passwordResetToken", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("$2a$", body);
        Assert.DoesNotContain("$2b$", body);
    }

    private static StringContent JsonContent_(string json) => new(json, System.Text.Encoding.UTF8, "application/json");
    private static StringContent JsonContentOf(object o) => JsonContent_(System.Text.Json.JsonSerializer.Serialize(o));

    // ================================================================ KNOWN OPEN FINDINGS

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-22")]
    public async Task SEC_CFG_30_Responses_CarryXContentTypeOptionsNosniff()
    {
        var response = await _f.CreateApiClient().GetAsync("/health");
        Assert.True(response.Headers.TryGetValues("X-Content-Type-Options", out var values) && values.Contains("nosniff"));
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-22")]
    public async Task SEC_CFG_31_Responses_CarryAFramingProtectionHeader()
    {
        var response = await _f.CreateApiClient().GetAsync("/health");
        Assert.True(response.Headers.Contains("X-Frame-Options") || response.Headers.Contains("Content-Security-Policy"));
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-24")]
    public async Task SEC_CFG_32_OriginHeaderWithTheLiteralNull_DoesNotCrashTheCorsPolicy()
    {
        // Sandboxed iframes and file:// pages send "Origin: null"; the policy does new Uri(origin) and throws.
        var response = await _f.CreateApiClient().SendAsync(WithOrigin(HttpMethod.Get, "/health", "null"));
        Assert.True((int)response.StatusCode < 500, $"-> {(int)response.StatusCode}");
    }

    [Fact, Trait("Status", "KnownOpen"), Trait("Finding", "S-24")]
    public async Task SEC_CFG_33_MalformedOriginHeader_DoesNotCrashTheCorsPolicy()
    {
        var response = await _f.CreateApiClient().SendAsync(WithOrigin(HttpMethod.Get, "/health", "not a url"));
        Assert.True((int)response.StatusCode < 500, $"-> {(int)response.StatusCode}");
    }
}
