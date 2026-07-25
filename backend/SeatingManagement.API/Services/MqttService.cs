using MQTTnet;
using System.Text.Json;

namespace SeatingManagement.API.Services
{
    public interface IMqttService
    {
        Task PublishSeatUpdateAsync(int eventId, int seatId, int status);
        Task PublishCommandAsync(int eventId, string command);
        Task PublishMessageAsync(string topic, string payload); // Adicionado para notificações genéricas
    }

    public class MqttService : IMqttService, IHostedService
    {
        private IMqttClient? _mqttClient;
        private readonly MqttClientOptions _options;
        private readonly ILogger<MqttService> _logger;

        public MqttService(ILogger<MqttService> logger)
        {
            _logger = logger;
            var factory = new MqttClientFactory();
            _mqttClient = factory.CreateMqttClient();
            
            _options = new MqttClientOptionsBuilder()
                .WithClientId("SeatingManagementAPI_" + Guid.NewGuid().ToString())
                .WithTcpServer("localhost", 1883)
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