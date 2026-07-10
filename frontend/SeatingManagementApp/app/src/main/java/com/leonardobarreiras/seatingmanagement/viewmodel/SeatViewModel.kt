package com.leonardobarreiras.seatingmanagement.viewmodel

import android.app.Application
import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.leonardobarreiras.seatingmanagement.data.AppDatabase
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.data.SeatRepository
import com.leonardobarreiras.seatingmanagement.network.AuthResponse
import com.leonardobarreiras.seatingmanagement.network.BulkUpdateStatusRequest
import com.leonardobarreiras.seatingmanagement.network.LoginRequest
import com.leonardobarreiras.seatingmanagement.network.MqttManager
import com.leonardobarreiras.seatingmanagement.network.RetrofitClient
import com.leonardobarreiras.seatingmanagement.network.ValidateTicketRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.BufferedWriter
import java.io.InputStreamReader
import java.io.OutputStreamWriter

// 👇 O NOVO SISTEMA DINÂMICO DE FEEDBACK PARA A UI 👇
enum class FeedbackType { SUCCESS, ERROR, EXPORT, INFO }
data class AppFeedback(val type: FeedbackType, val title: String, val message: String)

class SeatViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: SeatRepository
    private val mqttManager: MqttManager

    val seatsFlow: Flow<List<SeatEntity>>
    var isAdminMode by mutableStateOf(false)

    var jwtToken: String? = null
    var loginError by mutableStateOf<String?>(null)

    var currentEventId by mutableStateOf<Int?>(null)

    // Substituímos o qrFeedbackMessage pela nova classe robusta
    var appFeedback by mutableStateOf<AppFeedback?>(null)

    init {
        val db = AppDatabase.getDatabase(application)
        repository = SeatRepository(db.seatDao())
        seatsFlow = repository.allSeats

        mqttManager = MqttManager { id, status ->
            viewModelScope.launch {
                if (id == -1 && status == -1) {
                    Log.d("ViewModel", "Comando de Broadcast recebido! A atualizar lista toda...")
                    fetchSeatsFromApi()
                } else {
                    repository.updateSeatStatusLocally(id, status)
                }
            }
        }
        mqttManager.connect()
    }

    fun authenticate(user: String, pass: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            try {
                val request = LoginRequest(user, pass)
                val response: AuthResponse = RetrofitClient.apiService.login(request)
                jwtToken = response.token
                loginError = null
                onSuccess()
            } catch (e: Exception) {
                loginError = "Credenciais inválidas ou erro de rede."
            }
        }
    }

    fun verifyPin(pin: String): Boolean {
        return pin == "1234"
    }

    // 👇 O NOVO CHECK-IN SEGURO 👇
    fun processRoomCheckIn(qrContent: String) {
        if (qrContent.startsWith("EVENT:")) {
            val idStr = qrContent.removePrefix("EVENT:")
            val id = idStr.toIntOrNull()

            if (id != null) {
                if (jwtToken == null) {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Sessão Expirada", "Por favor faz login novamente.")
                    return
                }

                viewModelScope.launch {
                    try {
                        val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", id)

                        // 👇 A CORREÇÃO DE SEGURANÇA: Bloqueia se o Evento não existir ou não tiver dados
                        if (seatsFromApi.isEmpty()) {
                            appFeedback = AppFeedback(FeedbackType.ERROR, "ID Inválido", "O Evento $id não existe ou não tem lugares atribuídos.")
                            return@launch
                        }

                        currentEventId = id
                        repository.deleteAllSeats()
                        repository.insertAll(seatsFromApi)
                        mqttManager.subscribeToEventRoom(id)

                        appFeedback = AppFeedback(FeedbackType.SUCCESS, "Acesso Permitido", "Entraste no Evento $id com sucesso.")
                    } catch (e: retrofit2.HttpException) {
                        appFeedback = AppFeedback(FeedbackType.ERROR, "Erro no Servidor", "Não foi possível validar o evento (Code: ${e.code()}).")
                    } catch (e: Exception) {
                        appFeedback = AppFeedback(FeedbackType.ERROR, "Erro de Rede", "Verifica a tua ligação à Internet.")
                    }
                }
            } else {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Formato Inválido", "O ID do evento deve ser um número.")
            }
        } else {
            appFeedback = AppFeedback(FeedbackType.ERROR, "QR Inválido", "O código não pertence a uma configuração de sala.")
        }
    }

    fun validateTicketFromQr(ticketHash: String) {
        val safeEventId = currentEventId
        if (safeEventId == null || jwtToken == null) return

        viewModelScope.launch {
            try {
                val request = ValidateTicketRequest(eventId = safeEventId, ticketHash = ticketHash)
                RetrofitClient.apiService.validateTicket("Bearer $jwtToken", request)
                fetchSeatsFromApi()
                appFeedback = AppFeedback(FeedbackType.SUCCESS, "Bilhete Válido!", "A entrada foi registada com sucesso.")
            } catch (e: retrofit2.HttpException) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado!", "Bilhete inválido, de outro evento ou já ocupado.")
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro de Comunicação", "Falha de ligação ao servidor.")
            }
        }
    }

    fun clearFeedback() {
        appFeedback = null
    }

    fun fetchSeatsFromApi() {
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", safeEventId)
                repository.deleteAllSeats()
                repository.insertAll(seatsFromApi)
            } catch (e: retrofit2.HttpException) {
                if (e.code() == 404) {
                    appFeedback = AppFeedback(FeedbackType.INFO, "Aviso", "A sala $safeEventId foi limpa ou não tem dados.")
                }
            } catch (e: Exception) {
                Log.e("API", "Erro ao sincronizar: ${e.message}")
            }
        }
    }

    fun updateSeatStatus(seat: SeatEntity, newStatus: Int) {
        val safeEventId = currentEventId ?: return
        viewModelScope.launch {
            repository.updateSeatStatusLocally(seat.id, newStatus)
            mqttManager.publishSeatUpdate(safeEventId, seat.id, newStatus)
        }
    }

    fun bulkUpdateStatus(novoEstado: String) {
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                RetrofitClient.apiService.bulkUpdateStatus("Bearer $jwtToken", safeEventId, BulkUpdateStatusRequest(status = novoEstado))
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro de Gestão", "Não foi possível atualizar em massa.")
            }
        }
    }

    fun importCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                context.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val reader = BufferedReader(InputStreamReader(inputStream))
                    val lines = reader.readLines()

                    if (lines.size > 1) {
                        val seats = lines.drop(1).mapIndexedNotNull { index, line ->
                            val parts = line.split(Regex("[,;]"))
                            if (parts.size >= 4) {
                                val mesa = parts[0].trim()
                                val lugar = parts[1].trim()
                                SeatEntity(
                                    id = index + 1,
                                    seatNumber = "$mesa-$lugar",
                                    eventName = parts[2].trim(),
                                    status = 0,
                                    assignedTo = parts[3].trim().takeIf { it.isNotEmpty() },
                                    version = 1
                                )
                            } else null
                        }
                        repository.deleteAllSeats()
                        repository.insertAll(seats)
                        appFeedback = AppFeedback(FeedbackType.SUCCESS, "Importação Concluída", "${seats.size} lugares foram carregados localmente.")
                    }
                }
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Falha ao Importar", "O ficheiro tem um formato inválido.")
            }
        }
    }

    fun exportCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                val currentSeats = seatsFlow.first()
                context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                    val writer = BufferedWriter(OutputStreamWriter(outputStream))
                    writer.write("MESA;LUGAR;CATEGORIA;ESTADO;NOME\n")
                    currentSeats.forEach { seat ->
                        val assigned = seat.assignedTo ?: ""
                        val statusText = when(seat.status) {
                            1 -> "Validado"
                            2 -> "Tratado"
                            else -> "Pendente"
                        }
                        val partes = seat.seatNumber.split("-")
                        val mesa = if (partes.size > 1) partes[0] else ""
                        val lugar = if (partes.size > 1) partes[1] else seat.seatNumber
                        writer.write("${mesa};${lugar};${seat.eventName};${statusText};${assigned}\n")
                    }
                    writer.flush()
                }
                // 👇 MENSAGEM ESPECÍFICA COM ÍCONE DE EXPORTAÇÃO 👇
                appFeedback = AppFeedback(FeedbackType.EXPORT, "Ficheiro Exportado", "O estado da sala foi gravado com sucesso na pasta Downloads.")
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro ao Exportar", "Falha ao gravar o ficheiro no telemóvel.")
            }
        }
    }

    fun clearAllData() {
        viewModelScope.launch { repository.deleteAllSeats() }
    }

    override fun onCleared() {
        super.onCleared()
        mqttManager.disconnect()
    }
}