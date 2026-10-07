using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using SeatingManagement.API.Models;
using SeatingManagement.API.Tests.Infrastructure;
using Xunit;

namespace SeatingManagement.API.Tests.Integration;

/// <summary>INT-CSV: guest list import (semicolon-separated CSV) and event data clearing.</summary>
[Trait("Suite", "Integration")]
public class CsvIntegrationTests : IClassFixture<SeatlyWebApplicationFactory>
{
    private readonly SeatlyWebApplicationFactory _f;
    public CsvIntegrationTests(SeatlyWebApplicationFactory f) => _f = f;

    private Task<int> OwnEventAsync(int seats = 0) =>
        _f.CreateEventAsync(TestAccounts.AcmeCompanyId, new[] { TestAccounts.GestorAcmeId }, seats);

    [Fact]
    public async Task INT_CSV_01_Import_ValidFile_CreatesSeatsAuditsAndNotifiesClients()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.UploadCsvAsync(eventId, ApiHelpers.ValidCsv);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var seats = await _f.SeatsOfAsync(eventId);
        Assert.Equal(new[] { "1-1", "1-2", "2-1" }, seats.Select(s => s.SeatNumber).OrderBy(x => x).ToArray());
        Assert.Equal("Ana", seats.Single(s => s.SeatNumber == "1-1").AssignedTo);
        Assert.Equal("VIP", seats.Single(s => s.SeatNumber == "1-1").EventName);
        Assert.All(seats, s => Assert.Equal(SeatStatus.Vazio, s.Status));
        Assert.Contains(await _f.AuditOfAsync(eventId), a => a.ActionType == "IMPORT_CSV" && a.Description.Contains("3 lugares"));
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == "seating/backoffice/companies");
        Assert.Contains(_f.Mqtt.Messages, m => m.Topic == $"seating/events/{eventId}/updates" && m.Payload.Contains("REFRESH"));
    }

    [Fact]
    public async Task INT_CSV_02_Import_ReplaceMode_RemovesPreviousSeats()
    {
        var eventId = await OwnEventAsync(seats: 5);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        await gestor.UploadCsvAsync(eventId, ApiHelpers.ValidCsv, mode: "replace");

        Assert.Equal(3, (await _f.SeatsOfAsync(eventId)).Count);
    }

    [Fact]
    public async Task INT_CSV_03_Import_AddMode_KeepsPreviousSeats()
    {
        var eventId = await OwnEventAsync(seats: 5);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        await gestor.UploadCsvAsync(eventId, ApiHelpers.ValidCsv, mode: "add");

        Assert.Equal(8, (await _f.SeatsOfAsync(eventId)).Count);
    }

    [Fact]
    public async Task INT_CSV_04_Import_DuplicateSeatNumbers_AreCollapsedToOne()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var csv = "mesa;lugar;categoria;nome\n1;1;VIP;Ana\n1;1;VIP;Ana Duplicada\n1;2;VIP;Bruno\n";

        var response = await gestor.UploadCsvAsync(eventId, csv);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, (await _f.SeatsOfAsync(eventId)).Count);
        Assert.Contains("1 registos duplicados", (await response.JsonAsync()).GetProperty("message").GetString());
    }

    [Fact]
    public async Task INT_CSV_05_Import_DuplicateKeepsTheAlreadyValidatedSeat()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        await gestor.UploadCsvAsync(eventId, "mesa;lugar;categoria;nome\n1;1;VIP;Ana\n");
        var seat = (await _f.SeatsOfAsync(eventId)).Single();
        await gestor.PutAsJsonAsync($"/api/Seat/{seat.Id}", new { status = "Tratado" });

        await gestor.UploadCsvAsync(eventId, "mesa;lugar;categoria;nome\n1;1;VIP;Ana Reimportada\n", mode: "add");

        var remaining = Assert.Single(await _f.SeatsOfAsync(eventId));
        Assert.Equal(SeatStatus.Tratado, remaining.Status);
    }

    [Fact]
    public async Task INT_CSV_06_Import_MissingMesaOrLugar_Returns400WithLineNumbers()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var csv = "mesa;lugar;categoria;nome\n;1;VIP;Ana\n1;;VIP;Bruno\n2;1;VIP;Carla\n";

        var response = await gestor.UploadCsvAsync(eventId, csv);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await response.JsonAsync();
        Assert.Equal("Falha na Validação do Ficheiro", json.GetProperty("message").GetString());
        Assert.Equal(2, json.GetProperty("errors").GetArrayLength());
        Assert.Empty(await _f.SeatsOfAsync(eventId));
    }

    [Fact]
    public async Task INT_CSV_07_Import_ColumnCompletelyEmpty_ReportsConsolidatedError()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var csv = "mesa;lugar;categoria;nome\n;1;VIP;Ana\n;2;VIP;Bruno\n";

        var response = await gestor.UploadCsvAsync(eventId, csv);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.JsonAsync()).GetProperty("errors").EnumerateArray().ToList();
        var single = Assert.Single(errors);
        Assert.Contains("MESA", single.GetProperty("errorType").GetString());
    }

    [Fact]
    public async Task INT_CSV_08_Import_CommaSeparatedFile_Returns400WithSeparatorHint()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.UploadCsvAsync(eventId, "mesa,lugar,categoria,nome\n1,1,VIP,Ana\n");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Ponto e Vírgula", (await response.JsonAsync()).GetProperty("message").GetString());
    }

    [Fact]
    public async Task INT_CSV_09_Import_UnsupportedExtensionOrEmptyFile_Returns400()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        Assert.Equal(HttpStatusCode.BadRequest, (await gestor.UploadCsvAsync(eventId, ApiHelpers.ValidCsv, fileName: "guests.pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await gestor.UploadCsvAsync(eventId, "", fileName: "empty.csv")).StatusCode);
    }

    [Fact]
    public async Task INT_CSV_10_Import_FileLargerThan5MB_Returns400()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var sb = new StringBuilder("mesa;lugar;categoria;nome\n");
        while (sb.Length < 5 * 1024 * 1024 + 1024) sb.Append("1;1;VIP;Some Very Long Guest Name To Fill The File Quickly\n");

        var response = await gestor.UploadCsvAsync(eventId, sb.ToString());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("5MB", (await response.JsonAsync()).GetProperty("message").GetString());
    }

    [Fact]
    public async Task INT_CSV_11_Import_NoFilePart_Returns400()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.PostAsync($"/api/SeatCsv/import/{eventId}", new MultipartFormDataContent());
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task INT_CSV_12_Import_ForbiddenEvent_Returns403()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var response = await gestor.UploadCsvAsync(TestAccounts.GlobexEventId, ApiHelpers.ValidCsv);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task INT_CSV_13_Import_AccentedNames_ArePreservedAsUtf8()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        await gestor.UploadCsvAsync(eventId, "mesa;lugar;categoria;nome\n1;1;Convidado;João da Conceição\n");

        Assert.Equal("João da Conceição", (await _f.SeatsOfAsync(eventId)).Single().AssignedTo);
    }

    [Fact]
    public async Task INT_CSV_14_Import_OneThousandGuests_CompletesAndPersistsAll()
    {
        var eventId = await OwnEventAsync();
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var sb = new StringBuilder("mesa;lugar;categoria;nome\n");
        for (var i = 0; i < 1000; i++) sb.Append($"{i / 10 + 1};{i % 10 + 1};Standard;Guest {i}\n");

        var clock = Stopwatch.StartNew();
        var response = await gestor.UploadCsvAsync(eventId, sb.ToString());
        clock.Stop();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1000, (await _f.SeatsOfAsync(eventId)).Count);
        Assert.True(clock.Elapsed < TimeSpan.FromSeconds(30), $"Import took {clock.Elapsed.TotalSeconds:F1}s");
    }

    [Fact]
    public async Task INT_CSV_15_Clear_RemovesAllSeatsOfTheEventAndAudits()
    {
        var eventId = await OwnEventAsync(seats: 6);
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);

        var response = await gestor.PostAsync($"/api/SeatCsv/clear/{eventId}", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty(await _f.SeatsOfAsync(eventId));
        Assert.Contains(await _f.AuditOfAsync(eventId), a => a.ActionType == "CLEAR_DB" && a.Description.Contains("6 lugares"));
    }

    [Fact]
    public async Task INT_CSV_16_Clear_ForeignEvent_Returns403AndKeepsData()
    {
        var gestor = await _f.ClientForAsync(TestAccounts.GestorAcme);
        var before = (await _f.SeatsOfAsync(TestAccounts.GlobexEventId)).Count;

        var response = await gestor.PostAsync($"/api/SeatCsv/clear/{TestAccounts.GlobexEventId}", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(before, (await _f.SeatsOfAsync(TestAccounts.GlobexEventId)).Count);
    }
}
