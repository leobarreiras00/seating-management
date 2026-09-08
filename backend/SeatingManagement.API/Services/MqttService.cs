using MQTTnet;
using System.Text.Json;

namespace SeatingManagement.API.Services
{
    public interface IMqttService
    {
        Task PublishSeatUpdateAsync(int eventId, int seatId, int status);
        Task PublishCommandAsync(int eventId, string command);
        Task PublishMessageAsync(string topic, string payload);
    }

    public class MqttService : IMqttService, IHostedService
    {
        private IMqttClient? _mqttClient;
        private readonly MqttClientOptions _options;
        private readonly ILogger<MqttService> _logger;

        public MqttService(ILogger<MqttService> logger, IConfiguration config)
        {
            _logger = logger;
            var factory = new MqttClientFactory();
            _mqttClient = factory.CreateMqttClient();
            
            var host = config["MqttSettings:Host"];
            var port = int.Parse(config["MqttSettings:Port"] ?? "8883");
            var username = config["MqttSettings:Username"];
            var password = config["MqttSettings:Password"];

            _options = new MqttClientOptionsBuilder()
                .WithClientId("SeatingManagementAPI_" + Guid.NewGuid().ToString())
                .WithTcpServer(host, port)
                .WithCredentials(username, password)
                .WithTlsOptions(o => o.UseTls())
                .Build();
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            try { await _mqttClient!.ConnectAsync(_options, cancellationToken); }
            catch (Exception ex) { _logger.LogError($"Erro MQTT: {ex.Message}"); }
        }

        public async Task StopAsync(CancellationToken cancellationToken)
        {
            if (_mqttClient != null) await _mqttClient.DisconnectAsync();
        }

        public async Task PublishSeatUpdateAsync(int eventId, int seatId, int status)
        {
            var topic = $"seating/events/{eventId}/updates"; 
            var payload = $"{{\"SeatId\": {seatId}, \"Status\": {status}}}";

            var message = new MqttApplicationMessageBuilder()
                .WithTopic(topic)
                .WithPayload(payload)
                .WithQualityOfServiceLevel(MQTTnet.Protocol.MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();

            if (_mqttClient != null && _mqttClient.IsConnected)
            {
                await _mqttClient.PublishAsync(message);
            }
        }

        public async Task PublishCommandAsync(int eventId, string command)
        {
            var topic = $"seating/events/{eventId}/updates";
            var payload = $"{{\"cmd\": \"{command}\"}}";

            var message = new MqttApplicationMessageBuilder()
                .WithTopic(topic)
                .WithPayload(payload)
                .WithQualityOfServiceLevel(MQTTnet.Protocol.MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();

            if (_mqttClient != null && _mqttClient.IsConnected)
            {
                await _mqttClient.PublishAsync(message);
            }
        }

        public async Task PublishMessageAsync(string topic, string payload)
        {
            var message = new MqttApplicationMessageBuilder()
                .WithTopic(topic)
                .WithPayload(payload)
                .WithQualityOfServiceLevel(MQTTnet.Protocol.MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();

            if (_mqttClient != null && _mqttClient.IsConnected)
            {
                await _mqttClient.PublishAsync(message);
            }
        }
    }
}