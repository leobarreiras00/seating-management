using System.ComponentModel.DataAnnotations;
using SeatingManagement.API.DTOs;
using Xunit;

namespace SeatingManagement.API.Tests;

public class AuthDtoValidationTests
{
    private static List<ValidationResult> Validate(object model)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(model, new ValidationContext(model), results, validateAllProperties: true);
        return results;
    }

    [Fact]
    public void Login_WithValidData_IsValid()
    {
        var dto = new LoginDto { Email = "user@seatly.test", Password = "secret1" };
        Assert.Empty(Validate(dto));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    public void Login_WithInvalidEmail_IsInvalid(string email)
    {
        var dto = new LoginDto { Email = email, Password = "secret1" };
        Assert.NotEmpty(Validate(dto));
    }

    [Fact]
    public void Login_WithoutPassword_IsInvalid()
    {
        var dto = new LoginDto { Email = "user@seatly.test", Password = "" };
        Assert.NotEmpty(Validate(dto));
    }

    [Theory]
    [InlineData("12345", false)]
    [InlineData("123456", true)]
    public void ResetPassword_EnforcesMinimumLength(string password, bool expectedValid)
    {
        var dto = new ResetPasswordDto { NewPassword = password };
        Assert.Equal(expectedValid, Validate(dto).Count == 0);
    }

    [Theory]
    [InlineData("12345", false)]
    [InlineData("123456", true)]
    public void ChangePassword_EnforcesMinimumLength(string password, bool expectedValid)
    {
        var dto = new ChangePasswordDto { OldPassword = "old", NewPassword = password };
        Assert.Equal(expectedValid, Validate(dto).Count == 0);
    }

    [Fact]
    public void FirstLoginReset_WithShortPassword_IsInvalid()
    {
        var dto = new FirstLoginResetDto { Email = "user@seatly.test", TemporaryPassword = "tmp", NewPassword = "abc" };
        Assert.NotEmpty(Validate(dto));
    }

    [Fact]
    public void ResetWithToken_RequiresToken()
    {
        var dto = new ResetPasswordWithTokenDto { Token = "", NewPassword = "123456" };
        Assert.NotEmpty(Validate(dto));
    }

    [Fact]
    public void Register_RequiresValidEmailAndName()
    {
        Assert.Empty(Validate(new RegisterDto { Email = "a@b.pt", Name = "Ana", Role = "Staff", CompanyId = 1 }));
        Assert.NotEmpty(Validate(new RegisterDto { Email = "bad", Name = "Ana" }));
        Assert.NotEmpty(Validate(new RegisterDto { Email = "a@b.pt", Name = "" }));
    }
}
