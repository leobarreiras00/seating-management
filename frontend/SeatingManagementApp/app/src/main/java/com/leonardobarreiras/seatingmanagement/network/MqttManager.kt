package com.leonardobarreiras.seatingmanagement.network

import android.util.Log
import com.hivemq.client.mqtt.MqttClient
import com.hivemq.client.mqtt.mqtt3.Mqtt3AsyncClient
import org.json.JSONObject
import java.util.UUID

class MqttManager(private val onSeatUpdated: (Int, Int) -> Unit) {

    var onManagerEventsUpdated: (() -> Unit)? = null

    var onProfileLogout: (() -> Unit)? = null
    var onProfileRefresh: (() -> Unit)? = null

    private var currentManagerTopic: String? = null
    private val client: Mqtt3AsyncClient = MqttClient.builder()
        .useMqttVersion3()
        .identifier(UUID.randomUUID().toString())
        .serverHost("10.0.2.2") // IP padrão do emulador
        .serverPort(1883)
        .buildAsync()

    private var currentTopic: String? = null

    fun connect() {
        client.connectWith()
            .send()
            .whenComplete { _, throwable ->
                if (throwable != null) {
                    Log.e("MQTT", "Erro ao ligar ao broker Mosquitto", throwable)
                } else {
                    Log.d("MQTT", "Ligado ao Mosquitto com sucesso!")
                }
            }
    }

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

                    if (json.has("cmd")) {
                        val cmd = json.getString("cmd")
                        if (cmd == "REFRESH") {
                            Log.d("MQTT", "Comando recebido: Sincronização em massa necessária.")
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

    fun subscribeToManagerEvents(userGuid: String) {
        val novoTopico = "seating/managers/$userGuid/#"
        if (currentManagerTopic == novoTopico) return

        currentManagerTopic?.let { topicoAntigo ->
            client.unsubscribeWith().topicFilter(topicoAntigo).send()
        }

        client.subscribeWith()
            .topicFilter(novoTopico)
            .callback { publish ->
                val topic = publish.topic.toString()
                val payload = String(publish.payloadAsBytes)

                Log.d("MQTT", "Mensagem recebida Gestor ($topic): $payload")

                when {
                    topic.endsWith("/profile") && payload == "LOGOUT" -> {
                        onProfileLogout?.invoke()
                    }
                    topic.endsWith("/profile") && payload == "REFRESH_PROFILE" -> {
                        onProfileRefresh?.invoke()
                    }
                    topic.endsWith("/events") -> {
                        onManagerEventsUpdated?.invoke()
                    }
                }
            }
            .send()
            .whenComplete { _, throwable ->
                if (throwable == null) currentManagerTopic = novoTopico
            }
    }

    fun disconnect() {
        client.disconnect()
    }
}