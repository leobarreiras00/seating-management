using Xunit;

namespace SeatingManagement.API.Tests;

public class PasswordHashingTests
{
    [Fact]
    public void BCrypt_VerifiesCorrectPassword()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("Seatly#2026");
        Assert.True(BCrypt.Net.BCrypt.Verify("Seatly#2026", hash));
    }

    [Fact]
    public void BCrypt_RejectsWrongPassword()
    {
        var hash = BCrypt.Net.BCrypt.HashPassword("Seatly#2026");
        Assert.False(BCrypt.Net.BCrypt.Verify("wrong", hash));
    }

    [Fact]
    public void BCrypt_HashesAreSalted()
    {
        Assert.NotEqual(BCrypt.Net.BCrypt.HashPassword("same"), BCrypt.Net.BCrypt.HashPassword("same"));
    }
}
