namespace SeatingManagement.API.Tests.Infrastructure;

/// <summary>Deterministic seed data used by every test class (each class gets its own database).</summary>
public static class TestAccounts
{
    public const string Password = "Passw0rd!test";

    public const string SuperAdmin = "superadmin@seatly.test";
    public const string GestorAcme = "gestor.acme@seatly.test";
    public const string UserAcme = "user.acme@seatly.test";
    public const string GestorGlobex = "gestor.globex@seatly.test";
    public const string UserGlobex = "user.globex@seatly.test";
    public const string TempUser = "temp.user@seatly.test";

    public const int SuperAdminId = 1;
    public const int GestorAcmeId = 2;
    public const int UserAcmeId = 3;
    public const int GestorGlobexId = 4;
    public const int UserGlobexId = 5;
    public const int TempUserId = 6;

    public const int SeatlyCompanyId = 1;   // "Seatly Admin" (created by the model seed)
    public const int AcmeCompanyId = 2;
    public const int GlobexCompanyId = 3;

    /// <summary>Acme event, assigned to GestorAcme and UserAcme; 5 seats (A-1, A-2, A-3 Marcado, B-1, B-2 Tratado).</summary>
    public const int AcmeEventAId = 1;
    /// <summary>Acme event, assigned only to GestorAcme (UserAcme is NOT assigned); 3 seats.</summary>
    public const int AcmeEventBId = 2;
    /// <summary>Globex event, assigned to GestorGlobex and UserGlobex; 3 seats.</summary>
    public const int GlobexEventId = 3;
}
