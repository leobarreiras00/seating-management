using MQTTnet;
using System.Text.Json;

namespace SeatingManagement.API.Services
{
    public interface IMqttService
    {
        Task PublishSeatUpdateAsync(int id, int status);
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

        // Otimização: Apenas ID e Status numérico para performance máxima
        public async Task PublishSeatUpdateAsync(int id, int status)
        {
            if (_mqttClient == null || !_mqttClient.IsConnected) return;

            var payload = new { id, s = status };

            var message = new MqttApplicationMessageBuilder()
                .WithTopic("seating/updates")
                .WithPayload(JsonSerializer.Serialize(payload))
                .WithQualityOfServiceLevel(MQTTnet.Protocol.MqttQualityOfServiceLevel.AtLeastOnce)
                .Build();

            await _mqttClient.PublishAsync(message);
        }
    }
}