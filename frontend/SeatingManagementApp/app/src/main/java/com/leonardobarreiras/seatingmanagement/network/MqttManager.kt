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

    // 👇 Guarda o tópico onde estamos ligados neste momento
    private var currentTopic: String? = null

    fun connect() {
        client.connectWith()
            .send()
            .whenComplete { _, throwable ->
                if (throwable != null) {
                    Log.e("MQTT", "Erro ao ligar ao broker Mosquitto", throwable)
                } else {
                    Log.d("MQTT", "Ligado ao Mosquitto com sucesso!")
                    // AVISO DE SÉNIOR: Já não subscrevemos nada aqui!
                    // Esperamos que o utilizador faça Check-in na Sala primeiro.
                }
            }
    }

    // 👇 NOVA FUNÇÃO: Sintoniza apenas na Sala Correta 👇
    fun subscribeToEventRoom(eventId: Int) {
        val novoTopico = "seating/events/$eventId/updates"
        if (currentTopic == novoTopico) return

        currentTopic?.let { topicoAntigo ->
            client.unsubscribeWith().topicFilter(topicoAntigo).send()
        }

        client.subscribeWith()
            .topicFilter(novoTopico)
            .callback { publish ->
                val payload = String(publish.payloadAsBytes)
                try {
                    val json = JSONObject(payload)

                    // LÓGICA DE ROUTING SÉNIOR: É um comando ou um update simples?
                    if (json.has("cmd")) {
                        val cmd = json.getString("cmd")
                        if (cmd == "REFRESH") {
                            Log.d("MQTT", "Comando recebido: Sincronização em massa necessária.")
                            // Passamos um ID negativo especial (-1) para avisar o ViewModel que é um Refresh
                            onSeatUpdated(-1, -1)
                        }
                    } else {
                        val id = if (json.has("SeatId")) json.getInt("SeatId") else json.getInt("id")
                        val status = if (json.has("Status")) json.getInt("Status") else json.getInt("s")
                        onSeatUpdated(id, status)
                    }
                } catch (e: Exception) {
                    Log.e("MQTT", "Erro ao processar mensagem MQTT", e)
                }
            }
            .send()
            .whenComplete { _, throwable ->
                if (throwable == null) currentTopic = novoTopico
            }
    }

    // 👇 A publicação também tem de ir para a Sala correta 👇
    fun publishSeatUpdate(eventId: Int, id: Int, status: Int) {
        val topic = "seating/events/$eventId/updates"
        val payload = "{\"SeatId\": $id, \"Status\": $status}".toByteArray()

        client.publishWith()
            .topic(topic)
            .payload(payload)
            .send()
            .whenComplete { _, exception ->
                if (exception != null) {
                    Log.e("MQTT", "Erro ao publicar: id=$id", exception)
                } else {
                    Log.d("MQTT", "Publicado com sucesso no tópico $topic: id=$id, status=$status")
                }
            }
    }

    fun disconnect() {
        client.disconnect()
    }
}