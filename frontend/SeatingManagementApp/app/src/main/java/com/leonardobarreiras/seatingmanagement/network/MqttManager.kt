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
        .serverHost("cec974b49a5f43c8a19ef81e6f877b64.s1.eu.hivemq.cloud") // Host do HiveMQ Cloud
        .serverPort(8883) // Porta segura SSL/TLS
        .sslWithDefaultConfig() // Ativa a encriptação SSL exigida pelo HiveMQ Cloud
        .buildAsync()

    private var currentTopic: String? = null

    fun connect() {
        client.connectWith()
            .simpleAuth()
            .username("lbseatly-mqtt") // <-- Substitui pelo username da tua conta HiveMQ
            .password("Dvs.8713".toByteArray()) // <-- Substitui pela password da tua conta HiveMQ
            .applySimpleAuth()
            .send()
            .whenComplete { _, throwable ->
                if (throwable != null) {
                    Log.e("MQTT", "Erro ao ligar ao HiveMQ Cloud", throwable)
                } else {
                    Log.d("MQTT", "Ligado ao HiveMQ Cloud com sucesso!")
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

    // Dispara a notificação de lotação para o Backoffice
    fun publishCapacityAlert(eventName: String, threshold: Int, validated: Int, total: Int) {
        val topic = "seating/alerts/capacity"

        val title = if (threshold == 100) "Lotação Esgotada!" else "Lotação a $threshold%!"
        val type = if (threshold >= 90) "warning" else "info"

        val msg = if (threshold == 100) {
            "O evento '$eventName' atingiu a capacidade máxima ($validated/$total lugares validados)."
        } else {
            "O evento '$eventName' já ultrapassou os $threshold% da sua lotação ($validated/$total lugares)."
        }

        val payload = "{\"title\": \"$title\", \"message\": \"$msg\", \"type\": \"$type\"}".toByteArray()

        client.publishWith()
            .topic(topic)
            .payload(payload)
            .send()
            .whenComplete { _, exception ->
                if (exception != null) {
                    Log.e("MQTT", "Erro ao publicar alerta de capacidade", exception)
                } else {
                    Log.d("MQTT", "Alerta de lotação ($threshold%) publicado com sucesso!")
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