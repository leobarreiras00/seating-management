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
import com.leonardobarreiras.seatingmanagement.network.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.io.BufferedWriter
import java.io.OutputStreamWriter

enum class FeedbackType { SUCCESS, ERROR, EXPORT, INFO, OFFLINE }
data class AppFeedback(val type: FeedbackType, val title: String, val message: String)

class SeatViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: SeatRepository
    private val mqttManager: MqttManager
    private val networkMonitor = NetworkMonitor(application) // 👈 O Olheiro de Rede

    val seatsFlow: Flow<List<SeatEntity>>
    var isAdminMode by mutableStateOf(false)
    var isOffline by mutableStateOf(false) // 👈 Estado global de rede

    var jwtToken: String? = null
    var loginError by mutableStateOf<String?>(null)
    var currentEventId by mutableStateOf<Int?>(null)
    var appFeedback by mutableStateOf<AppFeedback?>(null)

    init {
        val db = AppDatabase.getDatabase(application)
        repository = SeatRepository(db.seatDao())
        seatsFlow = repository.allSeats

        // 👇 MOTOR OFFLINE: Escuta a rede continuamente 👇
        viewModelScope.launch {
            networkMonitor.isConnected.collect { connected ->
                isOffline = !connected
                if (connected && currentEventId != null) {
                    syncPendingSeats() // REDE VOLTOU! Envia a Fila de Espera
                }
            }
        }

        mqttManager = MqttManager { id, status ->
            viewModelScope.launch {
                if (id == -1 && status == -1) {
                    fetchSeatsFromApi()
                } else {
                    repository.updateSeatStatusLocally(id, status, isPendingSync = false)
                }
            }
        }
        mqttManager.connect()
    }

    fun authenticate(user: String, pass: String, onSuccess: () -> Unit) {
        if (isOffline) {
            loginError = "Sem ligação à internet."
            return
        }
        viewModelScope.launch {
            try {
                val response: AuthResponse = RetrofitClient.apiService.login(LoginRequest(user, pass))
                jwtToken = response.token
                loginError = null
                onSuccess()
            } catch (e: Exception) {
                loginError = "Credenciais inválidas ou erro de rede."
            }
        }
    }

    fun verifyPin(pin: String): Boolean = pin == "1234"

    fun processRoomCheckIn(qrContent: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Modo Offline", "Precisas de internet para configurar uma sala.")
            return
        }
        if (qrContent.startsWith("EVENT:")) {
            val id = qrContent.removePrefix("EVENT:").toIntOrNull()
            if (id != null) {
                if (jwtToken == null) {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Sessão Expirada", "Por favor faz login.")
                    return
                }
                viewModelScope.launch {
                    try {
                        val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", id)
                        if (seatsFromApi.isEmpty()) {
                            appFeedback = AppFeedback(FeedbackType.ERROR, "ID Inválido", "O Evento $id não existe.")
                            return@launch
                        }
                        currentEventId = id
                        repository.deleteAllSeats()
                        repository.insertAll(seatsFromApi)
                        mqttManager.subscribeToEventRoom(id)
                        appFeedback = AppFeedback(FeedbackType.SUCCESS, "Acesso Permitido", "Entraste no Evento $id com sucesso.")
                    } catch (e: Exception) {
                        appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Verifica a tua ligação.")
                    }
                }
            } else appFeedback = AppFeedback(FeedbackType.ERROR, "Formato Inválido", "O ID deve ser numérico.")
        } else appFeedback = AppFeedback(FeedbackType.ERROR, "QR Inválido", "Código não pertence a uma sala.")
    }

    fun validateTicketFromQr(ticketHash: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.OFFLINE, "Sem Rede", "Leitura QR bloqueada em modo Offline.")
            return
        }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                RetrofitClient.apiService.validateTicket("Bearer $jwtToken", ValidateTicketRequest(safeEventId, ticketHash))
                fetchSeatsFromApi()
                appFeedback = AppFeedback(FeedbackType.SUCCESS, "Bilhete Válido!", "Entrada registada.")
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado", "Bilhete inválido ou já ocupado.")
            }
        }
    }

    // 👇 O MOTOR DE ATRIBUIÇÃO CORRIGIDO 👇
    fun updateSeatStatus(seat: SeatEntity, newStatus: Int) {
        val safeEventId = currentEventId ?: return
        viewModelScope.launch {
            if (isOffline) {
                // OFFLINE: Vai para a Fila de Espera
                repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = true)
                appFeedback = AppFeedback(FeedbackType.OFFLINE, "Modo Offline", "Gravado no telemóvel. Será enviado quando houver rede.")
            } else {
                // ONLINE: 1. Atualiza ecrã 2. MQTT (Rápido) 3. Grava no Servidor (Permanente)
                repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = false)
                mqttManager.publishSeatUpdate(safeEventId, seat.id, newStatus)

                try {
                    // O ELO PERDIDO: Avisar o .NET para gravar no SQL Server!
                    RetrofitClient.apiService.updateSingleSeat(
                        "Bearer $jwtToken", safeEventId, seat.id, UpdateSingleSeatRequest(newStatus)
                    )
                } catch (e: Exception) {
                    // Se a net falhar milissegundos antes de enviar ao servidor, vai para a fila!
                    repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = true)
                }
            }
        }
    }

    // 👇 O MOTOR DE SINCRONIZAÇÃO DA FILA DE ESPERA 👇
    private suspend fun syncPendingSeats() {
        val safeEventId = currentEventId ?: return
        val pendingSeats = repository.getPendingSyncSeats()

        if (pendingSeats.isNotEmpty()) {
            Log.d("SYNC", "A sincronizar ${pendingSeats.size} registos offline...")
            var successCount = 0

            pendingSeats.forEach { seat ->
                try {
                    // 1. Grava na BD Central primeiro
                    val response = RetrofitClient.apiService.updateSingleSeat(
                        "Bearer $jwtToken", safeEventId, seat.id, UpdateSingleSeatRequest(seat.status)
                    )

                    if (response.isSuccessful) {
                        // 2. Avisa os outros telemóveis e retira a flag
                        mqttManager.publishSeatUpdate(safeEventId, seat.id, seat.status)
                        repository.updateSeatStatusLocally(seat.id, seat.status, isPendingSync = false)
                        successCount++
                    }
                } catch (e: Exception) {
                    Log.e("SYNC", "Falha ao enviar lugar ${seat.id}, continua na fila.")
                }
            }

            if (successCount > 0) {
                appFeedback = AppFeedback(FeedbackType.SUCCESS, "Rede Restabelecida", "$successCount lugares offline gravados na BD Central.")
            }
        }
    }

    fun fetchSeatsFromApi() {
        if (isOffline) return
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", safeEventId)
                repository.deleteAllSeats()
                repository.insertAll(seatsFromApi)
            } catch (e: Exception) { Log.e("API", "Erro ao sincronizar") }
        }
    }

    fun bulkUpdateStatus(novoEstado: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "As ações em massa requerem internet.")
            return
        }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.bulkUpdateStatus("Bearer $jwtToken", safeEventId, BulkUpdateStatusRequest(novoEstado))

                if (response.isSuccessful) {
                    // A LINHA MÁGICA: Força o telemóvel a descarregar os dados novos imediatamente!
                    fetchSeatsFromApi()
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Sucesso", "Registos atualizados com sucesso.")
                } else {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Erro no Servidor", "O servidor recusou a atualização. (Código: ${response.code()})")
                }
            }
            catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha na comunicação com o servidor.") }
        }
    }

    fun uploadCsvToServer(uri: Uri, context: Context, mode: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "Upload requer internet.")
            return
        }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                appFeedback = AppFeedback(FeedbackType.INFO, "A enviar...", "A processar o ficheiro para o servidor.")
                val inputStream = context.contentResolver.openInputStream(uri) ?: throw Exception("Erro a ler ficheiro")
                val tempFile = java.io.File(context.cacheDir, "upload_temp.csv")
                tempFile.outputStream().use { inputStream.copyTo(it) }

                val requestFile = okhttp3.RequestBody.create(okhttp3.MediaType.parse("text/csv"), tempFile)
                val body = okhttp3.MultipartBody.Part.createFormData("file", "upload.csv", requestFile)

                val response = RetrofitClient.apiService.uploadCsv("Bearer $jwtToken", safeEventId, mode, body)
                if (response.isSuccessful) appFeedback = AppFeedback(FeedbackType.SUCCESS, "Concluído", "Dados enviados para o servidor.")
                else appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Servidor rejeitou o ficheiro.")
            } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha de comunicação.") }
        }
    }

    fun clearEventData(pin: String) {
        viewModelScope.launch {
            // Apaga apenas o SQLite (memória) do telemóvel. O servidor fica intocável.
            repository.deleteAllSeats()
            appFeedback = AppFeedback(
                FeedbackType.INFO,
                "Ecrã Limpo",
                "Os dados foram removidos deste dispositivo. Clica em 'Sync DB' para os recuperar do servidor."
            )
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
                        val statusText = when(seat.status) { 1 -> "Validado"; 2 -> "Tratado"; else -> "Pendente" }
                        val partes = seat.seatNumber.split("-")
                        val mesa = if (partes.size > 1) partes[0] else ""
                        val lugar = if (partes.size > 1) partes[1] else seat.seatNumber
                        writer.write("${mesa};${lugar};${seat.eventName};${statusText};${assigned}\n")
                    }
                    writer.flush()
                }
                appFeedback = AppFeedback(FeedbackType.EXPORT, "Ficheiro Exportado", "Guardado nos Downloads do dispositivo.")
            } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha ao gravar.") }
        }
    }

    fun clearFeedback() { appFeedback = null }

    override fun onCleared() {
        super.onCleared()
        mqttManager.disconnect()
    }
}