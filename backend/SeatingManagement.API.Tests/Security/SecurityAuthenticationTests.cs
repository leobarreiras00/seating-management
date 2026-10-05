using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Security;

/// <summary>
/// SEC-AUTH: authentication, token handling, enumeration and credential hygiene.
/// Every test asserts the SECURE behaviour. Tests tagged Finding=S-xx are regression tests for findings
/// that were confirmed (and, at the time, failing) in the first security run and remediated afterwards.
/// </summary>
[Trait("Suite", "Security")]
public class SecurityAuthenticationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public SecurityAuthenticationTests(SeatlyWebApplicationFactory f) => _f = f;

    /// <summary>Every protected endpoint of the API, with a placeholder identifier.</summary>
    public static readonly (string Method, string Url)[] ProtectedEndpoints =
    {
        ("GET", "/api/Auth/users"), ("PUT", "/api/Auth/user/1/avatar"), ("POST", "/api/Auth/register"),
        ("DELETE", "/api/Auth/user/1"), ("PUT", "/api/Auth/change-password"),
        ("GET", "/api/Event/my-events"), ("POST", "/api/Event"), ("PUT", "/api/Event/1"),
        ("POST", "/api/Event/1/assign-user"), ("DELETE", "/api/Event/1"),
        ("GET", "/api/Seat"), ("GET", "/api/Seat/1"), ("PUT", "/api/Seat/1"), ("PUT", "/api/Seat/1/update/1"),
        ("POST", "/api/Seat/validate-ticket"), ("PUT", "/api/Seat/1/bulk-status"),
        ("POST", "/api/Seat/event/1/walkin"), ("PUT", "/api/Seat/1/edit"), ("DELETE", "/api/Seat/1"),
        ("POST", "/api/SeatCsv/import/1"), ("POST", "/api/SeatCsv/clear/1"),
        ("GET", "/api/Company"), ("GET", "/api/Company/my-company"), ("POST", "/api/Company"),
        ("PUT", "/api/Company/1"), ("PUT", "/api/Company/1/logo"), ("DELETE", "/api/Company/1"),
        ("GET", "/api/Company/1/managers"), ("GET", "/api/Company/1/users"), ("GET", "/api/Company/1/events"),
        ("POST", "/api/Company/1/events"), ("POST", "/api/Company/1/events/1/assign/x"),
        ("DELETE", "/api/Company/1/events/1/assign/1"),
        ("GET", "/api/Analytics/dashboard"), ("GET", "/api/Audit/events-overview"), ("GET", "/api/Audit/event/1")
    };

    internal static async Task<List<string>> ProbeAsync(HttpClient client, IEnumerable<(string Method, string Url)> calls, params HttpStatusCode[] expected)
    {
        var failures = new List<string>();
        foreach (var (method, url) in calls)
        {
            var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), url));
            if (!expected.Contains(response.StatusCode))
                failures.Add($"{method} {url} -> {(int)response.StatusCode}");
        }
        return failures;
    }

    // ---------------------------------------------------------------- token handling

    [Fact]
    public async Task SEC_AUTH_01_EveryProtectedEndpoint_RejectsAnonymousCallers()
    {
        var failures = await ProbeAsync(_f.CreateApiClient(), ProtectedEndpoints, HttpStatusCode.Unauthorized);
        Assert.True(failures.Count == 0, "Endpoints reachable without a token:\n" + string.Join("\n", failures));
    }

    [Theory]
    [InlineData("Bearer ")]
    [InlineData("Bearer abc")]
    [InlineData("Bearer abc.def.ghi")]
    [InlineData("Basic YWRtaW46YWRtaW4=")]
    [InlineData("Token eyJhbGciOiJIUzI1NiJ9.e30.x")]
    public async Task SEC_AUTH_02_MalformedAuthorizationHeaders_AreRejectedWith401(string header)
    {
        var client = _f.CreateApiClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/Auth/users");
        request.Headers.TryAddWithoutValidation("Authorization", header);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SEC_AUTH_03_TokenSignedWithAnotherKey_IsRejected()
    {
        var forged = TestJwt.Create("SuperAdmin", TestAccounts.SeatlyCompanyId, key: "attacker-controlled-key-with-32-characters!!");
        var response = await _f.ClientWithToken(forged).GetAsync("/api/Auth/users");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SEC_AUTH_04_UnsignedAlgNoneToken_IsRejected()
    {
        var response = await _f.ClientWithToken(TestJwt.AlgNone()).GetAsync("/api/Auth/users");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SEC_AUTH_05_ExpiredToken_IsRejected()
    {
        var expired = TestJwt.Create("SuperAdmin", TestAccounts.SeatlyCompanyId,
            notBefore: DateTime.UtcNow.AddHours(-3), expires: DateTime.UtcNow.AddHours(-2));
        var response = await _f.ClientWithToken(expired).GetAsync("/api/Auth/users");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SEC_AUTH_06_WrongIssuerOrAudience_IsRejected()
    {
        var wrongIssuer = TestJwt.Create("SuperAdmin", TestAccounts.SeatlyCompanyId, issuer: "SomeoneElse");
        var wrongAudience = TestJwt.Create("SuperAdmin", TestAccounts.SeatlyCompanyId, audience: "OtherClients");

        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.ClientWithToken(wrongIssuer).GetAsync("/api/Auth/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.ClientWithToken(wrongAudience).GetAsync("/api/Auth/users")).StatusCode);
    }

    [Fact]
    public async Task SEC_AUTH_07_TamperedPayloadWithOriginalSignature_IsRejected()
    {
        var genuine = await _f.GetTokenAsync(TestAccounts.UserAcme);
        var tampered = TestJwt.TamperPayloadKeepSignature(genuine, "SuperAdmin");

        var response = await _f.ClientWithToken(tampered).GetAsync("/api/Auth/users");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task SEC_AUTH_08_TokenNotYetValid_IsRejected()
    {
        var future = TestJwt.Create("SuperAdmin", TestAccounts.SeatlyCompanyId,
            notBefore: DateTime.UtcNow.AddHours(2), expires: DateTime.UtcNow.AddHours(3));
        var response = await _f.ClientWithToken(future).GetAsync("/api/Auth/users");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------------------------------------------------------------- enumeration and information leakage

    [Fact]
    public async Task SEC_AUTH_09_Login_WrongPasswordAndUnknownUser_AreIndistinguishable()
    {
        var client = _f.CreateApiClient();
        var wrongPassword = await client.PostAsJsonAsync("/api/Auth/login", new { email = TestAccounts.GestorAcme, password = "wrong" });
        var unknownUser = await client.PostAsJsonAsync("/api/Auth/login", new { email = "ghost@seatly.test", password = "wrong" });

        Assert.Equal(wrongPassword.StatusCode, unknownUser.StatusCode);
        Assert.Equal(await wrongPassword.Content.ReadAsStringAsync(), await unknownUser.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SEC_AUTH_10_ForgotPassword_KnownAndUnknownEmail_AreIndistinguishable()
    {
        var client = _f.CreateApiClient();
        var known = await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = TestAccounts.UserGlobex });
        var unknown = await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = "ghost@seatly.test" });

        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SEC_AUTH_11_FirstLoginReset_UnknownUserAndWrongTemporaryPassword_AreIndistinguishable()
    {
        var client = _f.CreateApiClient();
        var unknown = await client.PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email = "ghost@seatly.test", temporaryPassword = "x", newPassword = "Whatever1!" });
        var wrong = await client.PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email = TestAccounts.TempUser, temporaryPassword = "x", newPassword = "Whatever1!" });

        Assert.Equal(unknown.StatusCode, wrong.StatusCode);
        Assert.Equal(await unknown.Content.ReadAsStringAsync(), await wrong.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SEC_AUTH_12_ResetTokens_AreLongAndUniquePerRequest()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = _f.CreateApiClient();

        await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = user.Email });
        await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = user.Email });

        var tokens = _f.Email.For(user.Email).Where(e => e.ResetToken != null).Select(e => e.ResetToken!).ToList();
        Assert.Equal(2, tokens.Count);
        Assert.NotEqual(tokens[0], tokens[1]);
        Assert.All(tokens, t => Assert.True(t.Length >= 32));
    }

    [Fact]
    public async Task SEC_AUTH_13_ResponsesNeverExposeCredentialMaterial()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var login = await (await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login",
            new { email = TestAccounts.GestorAcme, password = TestAccounts.Password })).Content.ReadAsStringAsync();
        var users = await (await gestor.GetAsync("/api/Auth/users")).Content.ReadAsStringAsync();
        var seats = await (await gestor.GetAsync($"/api/Seat/{TestAccounts.AcmeEventAId}")).Content.ReadAsStringAsync();

        foreach (var body in new[] { login, users, seats })
        {
            Assert.DoesNotContain("passwordHash", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("$2a$", body);
            Assert.DoesNotContain("passwordResetToken", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("resetTokenExpiry", body, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task SEC_AUTH_14_ErrorResponses_DoNotLeakStackTracesOrProviderDetails()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var responses = new[]
        {
            await _f.CreateApiClient().GetAsync("/api/DoesNotExist"),
            await _f.CreateApiClient().GetAsync("/api/Auth/users"),
            await gestor.GetAsync($"/api/Seat/{TestAccounts.GlobexEventId}"),
            await gestor.PutAsJsonAsync("/api/Seat/999999", new { status = "Marcado" }),
            await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { email = "bad", password = "x" })
        };

        foreach (var response in responses)
        {
            var body = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain("Exception", body);
            Assert.DoesNotContain("   at ", body);
            Assert.DoesNotContain("Npgsql", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("SQLite", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("SeatingManagement.API", body);
        }
    }

    // ================================================================ REGRESSION TESTS FOR REMEDIATED FINDINGS (formerly KnownOpen; fixed on branch fix/audit-hardening)

    [Fact, Trait("Finding", "S-11")]
    public async Task SEC_AUTH_20_Login_RepeatedFailures_TriggerThrottlingOrLockout()
    {
        var victim = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);   // dedicated account: the lockout must not leak into other tests
        var client = _f.CreateApiClient();
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 30; i++)
            statuses.Add((await client.PostAsJsonAsync("/api/Auth/login", new { email = victim.Email, password = "bad-" + i })).StatusCode);

        var correct = await client.PostAsJsonAsync("/api/Auth/login", new { email = victim.Email, password = TestAccounts.Password });
        statuses.Add(correct.StatusCode);

        Assert.Contains(statuses, s => s == HttpStatusCode.TooManyRequests || s == HttpStatusCode.Locked);
    }

    [Fact, Trait("Finding", "S-11")]
    public async Task SEC_AUTH_21_ContactForm_IsRateLimited()
    {
        var client = _f.CreateApiClient();
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 30; i++)
            statuses.Add((await client.PostAsJsonAsync("/api/Auth/contact", new { email = "spam@seatly.test", message = "spam " + i })).StatusCode);

        Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
    }

    [Fact, Trait("Finding", "S-12")]
    public async Task SEC_AUTH_22_PasswordPolicy_RejectsSixCharacterPasswords()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = await _f.ClientForAsync(user.Email);

        var response = await client.PutAsJsonAsync("/api/Auth/change-password",
            new { oldPassword = TestAccounts.Password, newPassword = "123456" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact, Trait("Finding", "S-13")]
    public async Task SEC_AUTH_23_AccessTokenLifetime_IsAtMostOneWorkingDay()
    {
        var token = await _f.GetTokenAsync(TestAccounts.GestorAcme);
        var lifetime = TestJwt.ExpiryOf(token) - DateTime.UtcNow;
        // 8 h covers one event shift; the clients have no refresh-token flow, and revocation is covered by SEC_AUTH_24.
        Assert.True(lifetime <= TimeSpan.FromHours(8) + TimeSpan.FromMinutes(1), $"Token lifetime is {lifetime.TotalHours:F1} hours");
    }

    [Fact, Trait("Finding", "S-13")]
    public async Task SEC_AUTH_24_TokenOfDeletedUser_IsNoLongerAccepted()
    {
        var gestor = await _f.CreateUserAsync("Gestor", TestAccounts.AcmeCompanyId);
        var gestorClient = await _f.ClientForAsync(gestor.Email);
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        Assert.Equal(HttpStatusCode.OK, (await gestorClient.GetAsync($"/api/Seat/{TestAccounts.AcmeEventAId}")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await admin.DeleteAsync($"/api/Auth/user/{gestor.Id}")).StatusCode);
        var afterDeletion = await gestorClient.GetAsync($"/api/Seat/{TestAccounts.AcmeEventAId}");

        Assert.Equal(HttpStatusCode.Unauthorized, afterDeletion.StatusCode);
    }

    [Fact, Trait("Finding", "S-17")]
    public async Task SEC_AUTH_25_PasswordResetToken_IsStoredHashedNotInPlainText()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/forgot-password", new { email = user.Email });
        var emailed = _f.Email.For(user.Email).Single(e => e.ResetToken != null).ResetToken!;

        var stored = (await _f.FindUserAsync(user.Email))!.PasswordResetToken;

        Assert.NotEqual(emailed, stored);
    }

    [Fact, Trait("Finding", "S-18")]
    public async Task SEC_AUTH_26_TemporaryPassword_HasAtLeastTwelveRandomCharacters()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var email = $"tmp.{Guid.NewGuid():N}@seatly.test";
        await gestor.PostAsJsonAsync("/api/Auth/register", new { email, name = "Tmp", role = "Utilizador", companyId = TestAccounts.AcmeCompanyId });

        var temp = _f.Email.For(email).Single(e => e.TempPassword != null).TempPassword!;
        var randomPart = temp.Length - "Seatly-".Length - 1;

        Assert.True(randomPart >= 12, $"Temporary password has only {randomPart} random characters");
    }
}
