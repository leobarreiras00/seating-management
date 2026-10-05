using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Integration;

/// <summary>INT-AUTH: login, first-login reset, password recovery, registration, contact form, user administration.</summary>
[Trait("Suite", "Integration")]
public class AuthIntegrationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public AuthIntegrationTests(SeatlyWebApplicationFactory f) => _f = f;

    private const string GenericRecoveryMessage = "Se o e-mail existir, enviámos as instruções de recuperação.";

    // ---------------------------------------------------------------- login

    [Fact]
    public async Task INT_AUTH_01_Login_ValidCredentials_ReturnsTokenRoleAndCompany()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login",
            new { email = TestAccounts.GestorAcme, password = TestAccounts.Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.JsonAsync();
        Assert.False(string.IsNullOrWhiteSpace(json.GetProperty("token").GetString()));
        Assert.Equal("Gestor", json.GetProperty("role").GetString());
        Assert.Equal("Acme Test", json.GetProperty("companyName").GetString());
    }

    [Fact]
    public async Task INT_AUTH_02_Login_WrongPassword_Returns401()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login",
            new { email = TestAccounts.GestorAcme, password = "wrong-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_03_Login_UnknownUser_Returns401()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login",
            new { email = "nobody@seatly.test", password = TestAccounts.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("")]
    public async Task INT_AUTH_04_Login_InvalidEmailFormat_Returns400(string email)
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { email, password = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_05_Login_EmptyBody_Returns400()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_06_Login_UserMustChangePassword_Returns403WithResetFlag()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login",
            new { email = TestAccounts.TempUser, password = TestAccounts.Password });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True((await response.JsonAsync()).GetProperty("requiresPasswordReset").GetBoolean());
    }

    // ---------------------------------------------------------------- first login reset

    [Fact]
    public async Task INT_AUTH_07_FirstLoginReset_ValidTemporaryPassword_ReturnsTokenAndClearsFlag()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId, mustChangePassword: true);
        var client = _f.CreateApiClient();

        var reset = await client.PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email = user.Email, temporaryPassword = TestAccounts.Password, newPassword = "NewPassw0rd!" });

        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);
        Assert.False(string.IsNullOrWhiteSpace((await reset.JsonAsync()).GetProperty("token").GetString()));
        Assert.False((await _f.FindUserAsync(user.Email))!.MustChangePassword);

        var oldLogin = await client.PostAsJsonAsync("/api/Auth/login", new { email = user.Email, password = TestAccounts.Password });
        var newLogin = await client.PostAsJsonAsync("/api/Auth/login", new { email = user.Email, password = "NewPassw0rd!" });
        Assert.Equal(HttpStatusCode.Unauthorized, oldLogin.StatusCode);
        Assert.Equal(HttpStatusCode.OK, newLogin.StatusCode);
        Assert.Contains(await _f.AuditByActionAsync("FIRST_LOGIN_RESET"), a => a.PerformedBy == user.Username);
    }

    [Fact]
    public async Task INT_AUTH_08_FirstLoginReset_WrongTemporaryPassword_Returns401()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email = TestAccounts.TempUser, temporaryPassword = "wrong", newPassword = "NewPassw0rd!" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_09_FirstLoginReset_AlreadyCompleted_Returns400()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email = TestAccounts.UserAcme, temporaryPassword = TestAccounts.Password, newPassword = "NewPassw0rd!" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_10_FirstLoginReset_NewPasswordTooShort_Returns400()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email = TestAccounts.TempUser, temporaryPassword = TestAccounts.Password, newPassword = "Ab1" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- password recovery

    [Fact]
    public async Task INT_AUTH_11_ForgotPassword_ExistingUser_SendsEmailWithOneHourToken()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);

        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/forgot-password", new { email = user.Email });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(GenericRecoveryMessage, (await response.JsonAsync()).GetProperty("message").GetString());

        var mail = Assert.Single(_f.Email.For(user.Email), e => e.ResetToken != null);
        Assert.True(mail.ResetToken!.Length >= 32);

        var stored = (await _f.FindUserAsync(user.Email))!;
        // Only the SHA-256 hash of the emailed token is stored.
        var expectedHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(mail.ResetToken)));
        Assert.Equal(expectedHash, stored.PasswordResetToken);
        var remaining = stored.ResetTokenExpiry!.Value - DateTime.UtcNow;
        Assert.InRange(remaining.TotalMinutes, 55, 61);
    }

    [Fact]
    public async Task INT_AUTH_12_ForgotPassword_UnknownEmail_ReturnsSameMessageAndSendsNothing()
    {
        var email = $"ghost.{Guid.NewGuid():N}@seatly.test";
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/forgot-password", new { email });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(GenericRecoveryMessage, (await response.JsonAsync()).GetProperty("message").GetString());
        Assert.Empty(_f.Email.For(email));
    }

    [Fact]
    public async Task INT_AUTH_13_ResetPassword_ValidToken_ChangesPasswordAndTokenIsSingleUse()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = _f.CreateApiClient();
        await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = user.Email });
        var token = _f.Email.For(user.Email).Single(e => e.ResetToken != null).ResetToken!;

        var first = await client.PostAsJsonAsync("/api/Auth/reset-password", new { token, newPassword = "Recovered1!" });
        var second = await client.PostAsJsonAsync("/api/Auth/reset-password", new { token, newPassword = "Another1!x" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        var login = await client.PostAsJsonAsync("/api/Auth/login", new { email = user.Email, password = "Recovered1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Contains(await _f.AuditByActionAsync("PASSWORD_RECOVERED"), a => a.PerformedBy == user.Username);
    }

    [Fact]
    public async Task INT_AUTH_14_ResetPassword_InvalidToken_Returns400()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/reset-password",
            new { token = "not-a-real-token", newPassword = "Recovered1!" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_15_ResetPassword_ExpiredToken_Returns400()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = _f.CreateApiClient();
        await client.PostAsJsonAsync("/api/Auth/forgot-password", new { email = user.Email });
        var token = _f.Email.For(user.Email).Single(e => e.ResetToken != null).ResetToken!;

        await _f.MutateAsync(async db =>
        {
            var u = db.Users.Single(x => x.Id == user.Id);
            u.ResetTokenExpiry = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        });

        var response = await client.PostAsJsonAsync("/api/Auth/reset-password", new { token, newPassword = "Recovered1!" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- change password

    [Fact]
    public async Task INT_AUTH_16_ChangePassword_WrongOldPassword_Returns400()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = await _f.ClientForAsync(user.Email);

        var response = await client.PutAsJsonAsync("/api/Auth/change-password", new { oldPassword = "wrong", newPassword = "Changed1!x" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_17_ChangePassword_CorrectOldPassword_UpdatesPasswordAndAudits()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = await _f.ClientForAsync(user.Email);

        var response = await client.PutAsJsonAsync("/api/Auth/change-password",
            new { oldPassword = TestAccounts.Password, newPassword = "Changed1!x" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { email = user.Email, password = "Changed1!x" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Contains(await _f.AuditByActionAsync("CHANGE_PASSWORD"), a => a.PerformedBy == user.Username);
    }

    [Fact]
    public async Task INT_AUTH_18_ChangePassword_Anonymous_Returns401()
    {
        var response = await _f.CreateApiClient().PutAsJsonAsync("/api/Auth/change-password",
            new { oldPassword = "a", newPassword = "Changed1!x" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ---------------------------------------------------------------- registration

    [Fact]
    public async Task INT_AUTH_19_Register_GestorCreatesUserInOwnCompany_FullOnboardingFlowWorks()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var email = $"new.{Guid.NewGuid():N}@seatly.test";

        var register = await gestor.PostAsJsonAsync("/api/Auth/register",
            new { email, name = "New Staff", role = "Utilizador", companyId = TestAccounts.AcmeCompanyId });

        Assert.Equal(HttpStatusCode.OK, register.StatusCode);
        var mail = Assert.Single(_f.Email.For(email), e => e.TempPassword != null);
        Assert.Matches(new Regex(@"^Seatly-[A-Za-z0-9]{14}!$"), mail.TempPassword!);
        Assert.Contains(await _f.AuditByActionAsync("CREATE_USER"), a => a.Description.Contains(email));

        var anonymous = _f.CreateApiClient();
        var blocked = await anonymous.PostAsJsonAsync("/api/Auth/login", new { email, password = mail.TempPassword });
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);

        var reset = await anonymous.PostAsJsonAsync("/api/Auth/first-login-reset",
            new { email, temporaryPassword = mail.TempPassword, newPassword = "Definitive1!" });
        Assert.Equal(HttpStatusCode.OK, reset.StatusCode);

        var login = await anonymous.PostAsJsonAsync("/api/Auth/login", new { email, password = "Definitive1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_20_Register_DuplicateEmail_Returns409()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsJsonAsync("/api/Auth/register",
            new { email = TestAccounts.UserAcme, name = "Dup", role = "Utilizador", companyId = TestAccounts.AcmeCompanyId });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_21_Register_NonExistentCompany_Returns400()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var response = await admin.PostAsJsonAsync("/api/Auth/register",
            new { email = $"x.{Guid.NewGuid():N}@seatly.test", name = "X", role = "Utilizador", companyId = 9999 });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_22_Register_AsUtilizador_Returns403()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        var response = await user.PostAsJsonAsync("/api/Auth/register",
            new { email = $"x.{Guid.NewGuid():N}@seatly.test", name = "X", role = "Utilizador", companyId = TestAccounts.AcmeCompanyId });
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ---------------------------------------------------------------- contact form

    [Fact]
    public async Task INT_AUTH_23_Contact_ValidMessage_SendsEmailToSupport()
    {
        var sender = $"visitor.{Guid.NewGuid():N}@seatly.test";
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/contact", new { email = sender, message = "Hello support" });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var mail = Assert.Single(_f.Email.Sent, e => e.Subject.Contains(sender));
        Assert.Equal(SeatlyWebApplicationFactory.ContactRecipient, mail.To);
        Assert.Contains("Hello support", mail.Body);
    }

    [Theory]
    [InlineData("", "message")]
    [InlineData("a@b.test", "")]
    public async Task INT_AUTH_24_Contact_MissingField_Returns400(string email, string message)
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/contact", new { email, message });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_25_Contact_MessageOver2000Characters_Returns400()
    {
        var response = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/contact",
            new { email = "a@b.test", message = new string('x', 2001) });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- user administration

    [Fact]
    public async Task INT_AUTH_26_GetUsers_SuperAdminSeesEveryone_GestorSeesOnlyOwnCompanyWithoutSuperAdmins()
    {
        var admin = await _f.ClientForAsync(TestAccounts.SuperAdmin);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var all = await (await admin.GetAsync("/api/Auth/users")).JsonAsync();
        var scoped = await (await gestor.GetAsync("/api/Auth/users")).JsonAsync();

        var allEmails = all.EnumerateArray().Select(u => u.GetProperty("email").GetString()).ToList();
        var scopedEmails = scoped.EnumerateArray().Select(u => u.GetProperty("email").GetString()).ToList();

        Assert.Contains(TestAccounts.GestorGlobex, allEmails);
        Assert.Contains(TestAccounts.SuperAdmin, allEmails);
        Assert.Contains(TestAccounts.UserAcme, scopedEmails);
        Assert.DoesNotContain(TestAccounts.GestorGlobex, scopedEmails);
        Assert.DoesNotContain(TestAccounts.SuperAdmin, scopedEmails);
    }

    [Fact]
    public async Task INT_AUTH_27_GetUsers_AsUtilizadorOrAnonymous_IsDenied()
    {
        var user = await _f.ClientForAsync(TestAccounts.UserAcme);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/Auth/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _f.CreateApiClient().GetAsync("/api/Auth/users")).StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_28_DeleteUser_GestorDeletesOwnCompanyUser_AuditsAndBlocksLogin()
    {
        var target = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.DeleteAsync($"/api/Auth/user/{target.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(await _f.FindUserAsync(target.Email));
        Assert.Contains(await _f.AuditByActionAsync("DELETE_USER"), a => a.Description.Contains(target.Username));
        var login = await _f.CreateApiClient().PostAsJsonAsync("/api/Auth/login", new { email = target.Email, password = TestAccounts.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_29_DeleteUser_OtherCompanyOrSuperAdmin_Returns404()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.DeleteAsync($"/api/Auth/user/{TestAccounts.UserGlobexId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.DeleteAsync($"/api/Auth/user/{TestAccounts.SuperAdminId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await gestor.DeleteAsync("/api/Auth/user/99999")).StatusCode);
    }

    [Fact]
    public async Task INT_AUTH_30_UpdateAvatar_OwnAccountSucceeds_OtherUserIsNotFound()
    {
        var user = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var other = await _f.CreateUserAsync("Utilizador", TestAccounts.AcmeCompanyId);
        var client = await _f.ClientForAsync(user.Email);

        var own = await client.PutAsJsonAsync($"/api/Auth/user/{user.Id}/avatar", new { avatarBase64 = "data:image/png;base64,AAAA" });
        var foreign = await client.PutAsJsonAsync($"/api/Auth/user/{other.Id}/avatar", new { avatarBase64 = "data:image/png;base64,BBBB" });

        Assert.Equal(HttpStatusCode.OK, own.StatusCode);
        Assert.Equal("data:image/png;base64,AAAA", (await _f.FindUserAsync(user.Email))!.AvatarUrl);
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }
}
