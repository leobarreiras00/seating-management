using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace SeatingManagement.API.Tests.Infrastructure;

/// <summary>Builds tokens the way AuthController does, so tests can forge, expire or mis-sign them.</summary>
public static class TestJwt
{
    public static string Create(string role, int companyId, Guid? userGuid = null,
        string key = SeatlyWebApplicationFactory.JwtKey,
        string issuer = SeatlyWebApplicationFactory.JwtIssuer,
        string audience = SeatlyWebApplicationFactory.JwtAudience,
        DateTime? expires = null, DateTime? notBefore = null)
    {
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, (userGuid ?? Guid.NewGuid()).ToString()),
            new Claim(ClaimTypes.Name, "Forged User"),
            new Claim(ClaimTypes.Role, role),
            new Claim("CompanyId", companyId.ToString())
        };
        var token = new JwtSecurityToken(issuer, audience, claims, notBefore, expires ?? DateTime.UtcNow.AddHours(1), creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static DateTime ExpiryOf(string token) => new JwtSecurityTokenHandler().ReadJwtToken(token).ValidTo;

    private static string B64(string json) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(json)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    /// <summary>An unsigned token ("alg":"none") claiming to be a SuperAdmin.</summary>
    public static string AlgNone(string role = "SuperAdmin") =>
        B64("{\"alg\":\"none\",\"typ\":\"JWT\"}") + "." +
        B64("{\"http://schemas.microsoft.com/ws/2008/06/identity/claims/role\":\"" + role + "\",\"CompanyId\":\"1\",\"exp\":" +
            DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeSeconds() + ",\"iss\":\"" + SeatlyWebApplicationFactory.JwtIssuer +
            "\",\"aud\":\"" + SeatlyWebApplicationFactory.JwtAudience + "\"}") + ".";

    /// <summary>Takes a genuine token and swaps its payload for a SuperAdmin payload, keeping the old signature.</summary>
    public static string TamperPayloadKeepSignature(string genuineToken, string newRole = "SuperAdmin")
    {
        var parts = genuineToken.Split('.');
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.ReadJwtToken(genuineToken);
        var payload = jwt.Claims.ToDictionary(c => c.Type, c => c.Value);
        var roleKey = payload.Keys.First(k => k.EndsWith("role", StringComparison.OrdinalIgnoreCase));
        payload[roleKey] = newRole;
        var json = System.Text.Json.JsonSerializer.Serialize(payload);
        return parts[0] + "." + B64(json) + "." + parts[2];
    }
}
