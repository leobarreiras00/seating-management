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

    init {
        val seatDao = AppDatabase.getDatabase(application).seatDao()
        repository = SeatRepository(seatDao)
        seatsFlow = repository.allSeats

        mqttManager = MqttManager(
            onSeatUpdated = { id, status ->
                viewModelScope.launch {
                    repository.updateSeatStatusLocally(id, status)
                }
            }
        )
        mqttManager.connectAndSubscribe()
    }

    fun authenticate(user: String, pass: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            try {
                loginError = null
                val response = RetrofitClient.apiService.login(LoginRequest(user, pass))
                jwtToken = response.token
                Log.d("API", "Login efetuado! Token recebido.")
                onSuccess()
            } catch (e: Exception) {
                loginError = "Credenciais inválidas ou erro de rede."
                Log.e("API", "Erro no login", e)
            }
        }
    }

    fun fetchSeatsFromApi() {
        if (jwtToken == null) {
            Log.e("API", "Erro: Tentativa de sincronizar sem Token JWT.")
            return
        }

        viewModelScope.launch {
            try {
                val seatsFromApi = RetrofitClient.apiService.getAllSeats("Bearer $jwtToken")
                repository.deleteAllSeats()
                repository.insertAll(seatsFromApi)
                Log.d("API", "Sincronizados ${seatsFromApi.size} lugares com sucesso!")
            } catch (e: Exception) {
                Log.e("API", "Erro ao sincronizar com a API", e)
            }
        }
    }

    // VARIÁVEIS PARA O SCANNER
    var qrFeedbackMessage by mutableStateOf<String?>(null)
    var currentEventId = 101 // Hardcoded temporariamente

    // FUNÇÃO PARA VALIDAR O BILHETE LIDO
    fun validateTicketFromQr(ticketHash: String) {
        if (jwtToken == null) {
            qrFeedbackMessage = "Erro: Precisas de fazer login primeiro."
            return
        }

        viewModelScope.launch {
            try {
                val request = ValidateTicketRequest(eventId = currentEventId, ticketHash = ticketHash)
                val response = RetrofitClient.apiService.validateTicket("Bearer $jwtToken", request)

                // Pede à API a grelha atualizada para garantir sincronização perfeita
                fetchSeatsFromApi()

                qrFeedbackMessage = "Sucesso: ${response.message} (${response.seat.seatNumber})"
            } catch (e: retrofit2.HttpException) {
                qrFeedbackMessage = "Erro: Bilhete inválido ou lugar já ocupado!"
            } catch (e: Exception) {
                qrFeedbackMessage = "Erro de ligação ao servidor."
            }
        }
    }

    fun clearQrFeedback() {
        qrFeedbackMessage = null
    }

    // FUNÇÃO ATUALIZADA: Atualiza para QUALQUER estado (0, 1 ou 2)
    fun updateSeatStatus(seat: SeatEntity, newStatus: Int) {
        viewModelScope.launch {
            // 1. Atualiza localmente no Room
            repository.updateSeatStatusLocally(seat.id, newStatus)
            // 2. Publica no Mosquitto para avisar o ecossistema
            mqttManager.publishSeatUpdate(seat.id, newStatus)
        }
    }

    fun verifyPin(inputPin: String): Boolean {
        if (inputPin == "1234") {
            isAdminMode = true
            return true
        }
        return false
    }

    fun importCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                context.contentResolver.openInputStream(uri)?.use { inputStream ->
                    val reader = BufferedReader(InputStreamReader(inputStream))
                    val lines = reader.readLines()
                    if (lines.size > 1) {
                        val seats = lines.drop(1).mapNotNull { line ->
                            val parts = line.split(",")
                            if (parts.size >= 4) {
                                SeatEntity(
                                    id = parts[0].trim().toIntOrNull() ?: return@mapNotNull null,
                                    seatNumber = parts[1].trim(),
                                    eventName = parts[2].trim(),
                                    status = parts[3].trim().toIntOrNull() ?: 0,
                                    assignedTo = parts.getOrNull(4)?.trim()?.takeIf { it.isNotEmpty() },
                                    version = 1
                                )
                            } else null
                        }
                        repository.insertAll(seats)
                    }
                }
            } catch (e: Exception) { Log.e("CSV", "Erro ao importar", e) }
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