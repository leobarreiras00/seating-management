package com.leonardobarreiras.seatingmanagement.network

import android.util.Log
import com.hivemq.client.mqtt.MqttClient
import com.hivemq.client.mqtt.mqtt3.Mqtt3AsyncClient
import org.json.JSONObject
import java.util.UUID

class MqttManager(private val onSeatUpdated: (Int, Int) -> Unit) {

    private val client: Mqtt3AsyncClient = MqttClient.builder()
        .useMqttVersion3()
        .identifier(UUID.randomUUID().toString())
        .serverHost("10.0.2.2") // IP padrão do emulador para chegar ao localhost do Mac
        .serverPort(1883)
        .buildAsync()

    fun connectAndSubscribe() {
        client.connectWith()
            .send()
            .whenComplete { _, throwable ->
                if (throwable != null) {
                    Log.e("MQTT", "Erro ao ligar ao broker Mosquitto", throwable)
                } else {
                    Log.d("MQTT", "Ligado ao Mosquitto com sucesso!")
                    subscribeToUpdates()
                }
            }
    }

    private fun subscribeToUpdates() {
        client.subscribeWith()
            .topicFilter("seating/updates")
            .callback { publish ->
                val payload = String(publish.payloadAsBytes)
                try {
                    val json = JSONObject(payload)
                    val id = json.getInt("id")
                    val status = json.getInt("s")
                    Log.d("MQTT", "Recebi atualização: Lugar $id -> Estado $status")
                    onSeatUpdated(id, status)
                } catch (e: Exception) {
                    Log.e("MQTT", "Erro ao processar mensagem: $payload", e)
                }
            }
            .send()
    }

    // NOVA FUNÇÃO: O Telemóvel agora também fala com o Servidor 👇
    fun publishSeatUpdate(id: Int, status: Int) {
        val payload = "{\"id\": $id, \"s\": $status}".toByteArray()
        client.publishWith()
            .topic("seating/updates")
            .payload(payload)
            .send()
            .whenComplete { _, exception ->
                if (exception != null) {
                    Log.e("MQTT", "Erro ao publicar: id=$id", exception)
                } else {
                    Log.d("MQTT", "Publicado com sucesso: id=$id, status=$status")
                }
            }
    }

    fun disconnect() {
        client.disconnect()
    }
}