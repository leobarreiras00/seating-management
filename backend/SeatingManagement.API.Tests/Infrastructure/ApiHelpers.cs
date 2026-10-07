using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace SeatingManagement.API.Tests.Infrastructure;

public static class ApiHelpers
{
    public static async Task<JsonElement> JsonAsync(this HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>();

    public static Task<HttpResponseMessage> UploadCsvAsync(this HttpClient client, int eventId, string content,
        string fileName = "guests.csv", string mode = "replace")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(Encoding.UTF8.GetBytes(content));
        file.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        form.Add(file, "file", fileName);
        return client.PostAsync($"/api/SeatCsv/import/{eventId}?mode={mode}", form);
    }

    public static Task<HttpResponseMessage> SendJsonAsync(this HttpClient client, HttpMethod method, string url, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (body != null) request.Content = JsonContent.Create(body);
        return client.SendAsync(request);
    }

    public const string ValidCsv =
        "mesa;lugar;categoria;nome\n" +
        "1;1;VIP;Ana\n" +
        "1;2;VIP;Bruno\n" +
        "2;1;Standard;Carla\n";
}
