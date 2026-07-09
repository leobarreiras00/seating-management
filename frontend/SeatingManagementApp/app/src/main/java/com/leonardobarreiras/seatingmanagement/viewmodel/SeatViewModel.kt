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

class SeatViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: SeatRepository
    private val mqttManager: MqttManager

    val seatsFlow: Flow<List<SeatEntity>>
    var isAdminMode by mutableStateOf(false)

    var jwtToken: String? = null
    var loginError by mutableStateOf<String?>(null)

    var currentEventId by mutableStateOf<Int?>(null)
    var qrFeedbackMessage by mutableStateOf<String?>(null)

    init {
        val db = AppDatabase.getDatabase(application)
        repository = SeatRepository(db.seatDao())
        seatsFlow = repository.allSeats

        mqttManager = MqttManager { id, status ->
            viewModelScope.launch {
                repository.updateSeatStatusLocally(id, status)
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

    fun processRoomCheckIn(qrContent: String) {
        if (qrContent.startsWith("EVENT:")) {
            val idStr = qrContent.removePrefix("EVENT:")
            val id = idStr.toIntOrNull()
            if (id != null) {
                currentEventId = id
                qrFeedbackMessage = "✅ Check-in efetuado com sucesso na Sala $id!"
                fetchSeatsFromApi() // Sincroniza com a BD mal faz o check-in na sala
                mqttManager.subscribeToEventRoom(id)
            } else {
                qrFeedbackMessage = "❌ Erro: Formato de evento inválido."
            }
        } else {
            qrFeedbackMessage = "❌ Erro: Este QR Code não pertence a uma sala."
        }
    }

    fun validateTicketFromQr(ticketHash: String) {
        if (jwtToken == null) {
            qrFeedbackMessage = "❌ Erro: Sessão expirada. Faz login."
            return
        }

        val safeEventId = currentEventId
        if (safeEventId == null) {
            qrFeedbackMessage = "❌ Erro: Faz o Check-in na sala primeiro!"
            return
        }

        viewModelScope.launch {
            try {
                val request = ValidateTicketRequest(eventId = safeEventId, ticketHash = ticketHash)
                val response = RetrofitClient.apiService.validateTicket("Bearer $jwtToken", request)
                fetchSeatsFromApi()
                qrFeedbackMessage = "✅ Sucesso! Bilhete válido."
            } catch (e: retrofit2.HttpException) {
                qrFeedbackMessage = "❌ Erro: Bilhete inválido, evento errado ou lugar já ocupado!"
            } catch (e: Exception) {
                qrFeedbackMessage = "⚠️ Erro de ligação ao servidor."
            }
        }
    }

    fun clearQrFeedback() {
        qrFeedbackMessage = null
    }

    fun fetchSeatsFromApi() {
        val safeEventId = currentEventId
        if (safeEventId == null) {
            qrFeedbackMessage = "⚠️ Faz o Check-in na sala antes de sincronizar!"
            return
        }
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                // 👇 PUXA OS LUGARES APENAS DO EVENTO ONDE O STAFF ESTÁ LOGADO
                val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", safeEventId)
                repository.deleteAllSeats()
                repository.insertAll(seatsFromApi)
                Log.d("API", "Sincronização concluída com ${seatsFromApi.size} lugares.")
            } catch (e: retrofit2.HttpException) {
                if (e.code() == 404) {
                    qrFeedbackMessage = "⚠️ Nenhum dado encontrado no servidor para o Evento $safeEventId."
                } else {
                    Log.e("API", "Erro ao sincronizar: ${e.message}", e)
                }
            } catch (e: Exception) {
                Log.e("API", "Erro ao sincronizar: ${e.message}", e)
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

    // 👇 O IMPORTAR LOCAL (Agora o array de dados bate certo com as colunas!)
    fun importCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                context.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val reader = BufferedReader(InputStreamReader(inputStream))
                    val lines = reader.readLines()

                    if (lines.size > 1) {
                        val seats = lines.drop(1).mapIndexedNotNull { index, line ->
                            // Usa Expressão Regular para detetar ou Vírgula ou Ponto-e-Vírgula
                            val parts = line.split(Regex("[,;]"))

                            if (parts.size >= 4) {
                                val mesa = parts[0].trim()
                                val lugar = parts[1].trim()

                                SeatEntity(
                                    id = index + 1,
                                    // Junta a mesa ao lugar (ex: "A-A1") para bater certo com a Backend
                                    seatNumber = "$mesa-$lugar",
                                    eventName = parts[2].trim(), // Categoria
                                    status = 0, // Livre
                                    assignedTo = parts[3].trim().takeIf { it.isNotEmpty() }, // Nome da Pessoa
                                    version = 1
                                )
                            } else null
                        }
                        repository.deleteAllSeats()
                        repository.insertAll(seats)
                        Log.d("CSV", "Importação Local bem-sucedida! Foram inseridos ${seats.size} registos.")
                    }
                }
            } catch (e: Exception) { Log.e("CSV", "Erro ao importar: ${e.message}", e) }
        }
    }

    fun exportCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                val currentSeats = seatsFlow.first()
                context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                    val writer = BufferedWriter(OutputStreamWriter(outputStream))
                    writer.write("Id,SeatNumber,EventName,Status,AssignedTo\n")
                    currentSeats.forEach { seat ->
                        val assigned = seat.assignedTo ?: ""
                        writer.write("${seat.id},${seat.seatNumber},${seat.eventName},${seat.status},${assigned}\n")
                    }
                    writer.flush()
                }
            } catch (e: Exception) { Log.e("CSV", "Erro ao exportar", e) }
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