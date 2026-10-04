package com.leonardobarreiras.seatingmanagement.network

import android.util.Log
import com.leonardobarreiras.seatingmanagement.BuildConfig
import com.hivemq.client.mqtt.MqttClient
import com.hivemq.client.mqtt.mqtt3.Mqtt3AsyncClient
import org.json.JSONObject
import java.util.UUID

/**
 * Cliente MQTT (HiveMQ Cloud, TLS) usado para tempo real entre dispositivos e backoffice.
 *
 * Tópicos:
 *  - `seating/events/{id}/updates`: alterações de lugares de um evento;
 *  - `seating/managers/{userGuid}/#`: mensagens para o gestor (`/profile` → LOGOUT | REFRESH_PROFILE, `/events` → REFRESH);
 *  - `seating/alerts/capacity`: alertas de lotação publicados pela app.
 *
 * As credenciais vêm do BuildConfig (local.properties) e nunca ficam no código.
 */
class MqttManager(private val onSeatUpdated: (Int, Int) -> Unit) {

    var onManagerEventsUpdated: (() -> Unit)? = null

    var onProfileLogout: (() -> Unit)? = null
    var onProfileRefresh: (() -> Unit)? = null

    private var currentManagerTopic: String? = null
    private var currentTopic: String? = null
    private var hasConnectedOnce = false

    /** Chamado quando a ligação é restabelecida automaticamente (subscrições têm de ser refeitas). */
    var onReconnected: (() -> Unit)? = null

    private val client: Mqtt3AsyncClient = MqttClient.builder()
        .useMqttVersion3()
        .identifier(UUID.randomUUID().toString())
        .serverHost("cec974b49a5f43c8a19ef81e6f877b64.s1.eu.hivemq.cloud") // Host do HiveMQ Cloud
        .serverPort(8883) // Porta segura SSL/TLS
        .sslWithDefaultConfig() // Ativa a encriptação SSL exigida pelo HiveMQ Cloud
        .automaticReconnectWithDefaultConfig() // <-- ADICIONADO: Mantém o cliente vivo e reconecta após quebras de rede
        .addConnectedListener {
            // Após uma reconexão automática as subscrições perdem-se: limpa o estado e pede para voltar a subscrever
            if (hasConnectedOnce) {
                currentTopic = null
                currentManagerTopic = null
                onReconnected?.invoke()
            }
            hasConnectedOnce = true
        }
        .buildAsync()

    /**
     * Liga ao broker; [onConnected] é chamado quando a ligação inicial fica pronta.
     */
    fun connect(onConnected: (() -> Unit)? = null) {
        client.connectWith()
            .simpleAuth()
            .username(BuildConfig.MQTT_USERNAME)
            .password(BuildConfig.MQTT_PASSWORD.toByteArray())
            .applySimpleAuth()
            .send()
            .whenComplete { _, throwable ->
                if (throwable != null) {
                    Log.e("MQTT", "Erro ao ligar ao HiveMQ Cloud", throwable)
                } else {
                    Log.d("MQTT", "Ligado ao HiveMQ Cloud com sucesso!")
                    onConnected?.invoke()
                }
            }
    }

    /**
     * Subscreve as atualizações de um evento (e cancela a subscrição do evento anterior).
     */
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

    /**
     * Publica a alteração de estado de um lugar para os restantes dispositivos do evento.
     */
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
    /**
     * Publica um alerta de lotação (ex.: 90%) para o backoffice mostrar notificações.
     */
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

    /**
     * Subscreve as mensagens dirigidas a este gestor (logout remoto, atualização de perfil e de eventos).
     */
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

    /**
     * Desliga do broker e esquece as subscrições (voltam a ser feitas numa nova ligação).
     */
    fun disconnect() {
        currentTopic = null
        currentManagerTopic = null
        hasConnectedOnce = false
        client.disconnect()
    }
}