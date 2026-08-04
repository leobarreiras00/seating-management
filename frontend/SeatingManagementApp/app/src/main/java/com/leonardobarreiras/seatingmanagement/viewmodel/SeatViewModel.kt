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
import com.google.gson.annotations.SerializedName // 👇 Importação do Gson adicionada
import com.leonardobarreiras.seatingmanagement.data.AppDatabase
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.data.SeatRepository
import com.leonardobarreiras.seatingmanagement.network.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.BufferedWriter
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class FeedbackType { SUCCESS, ERROR, EXPORT, INFO, OFFLINE }
data class AppFeedback(val type: FeedbackType, val title: String, val message: String)

// 👇 Correção do Clash: O Gson mapeia ambas as variações de chaves JSON para uma única variável 👇
data class CsvValidationError(
    @SerializedName(value = "line", alternate = ["Line"])
    val line: Int?,

    @SerializedName(value = "errorType", alternate = ["ErrorType"])
    val errorType: String?
) {
    val actualLine: Int get() = line ?: 0
    val actualErrorType: String get() = errorType ?: "Erro Desconhecido"
}

data class UploadErrorResponse(
    @SerializedName(value = "message", alternate = ["Message"])
    val message: String?,

    @SerializedName(value = "totalRows", alternate = ["TotalRows"])
    val totalRows: Int?,

    @SerializedName(value = "errors", alternate = ["Errors"])
    val errors: List<CsvValidationError>?
)

class SeatViewModel(application: Application) : AndroidViewModel(application) {

    private val repository: SeatRepository
    private val mqttManager: MqttManager
    private val networkMonitor = NetworkMonitor(application)

    val seatsFlow: Flow<List<SeatEntity>>
    var isAdminMode by mutableStateOf(false)
    var isOffline by mutableStateOf(false)

    var jwtToken: String? = null

    var userRole by mutableStateOf("Utilizador")

    var companyName by mutableStateOf("Seatly")
    var companyLogo by mutableStateOf("")

    var managerName by mutableStateOf("")
    var userGuid by mutableStateOf("")

    var myEvents by mutableStateOf<List<EventDto>>(emptyList())
    var isLoadingEvents by mutableStateOf(false)

    var loginError by mutableStateOf<String?>(null)
    var currentEventId by mutableStateOf<Int?>(null)
    var appFeedback by mutableStateOf<AppFeedback?>(null)

    var forceLogoutEvent by mutableStateOf(false)

    var validationErrorsList by mutableStateOf<List<CsvValidationError>>(emptyList())
    var totalValidationRows by mutableStateOf(0)
    var showValidationScreen by mutableStateOf(false)

    init {
        val db = AppDatabase.getDatabase(application)
        repository = SeatRepository(db.seatDao())
        seatsFlow = repository.allSeats

        viewModelScope.launch {
            networkMonitor.isConnected.collect { connected ->
                isOffline = !connected
                if (connected && currentEventId != null) {
                    syncPendingSeats()
                }
            }
        }

        mqttManager = MqttManager { id, status ->
            viewModelScope.launch {
                if (id == -1 && status == -1) {
                    fetchSeatsFromApi()
                } else {
                    val timestamp = if (status != 0) SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()) else null
                    repository.updateSeatStatusLocally(id, status, isPendingSync = false, markedAt = timestamp)
                }
            }
        }

        mqttManager.onManagerEventsUpdated = {
            viewModelScope.launch {
                fetchMyEvents()
            }
        }

        mqttManager.onProfileLogout = {
            viewModelScope.launch {
                forceLogoutEvent = true
            }
        }

        mqttManager.onProfileRefresh = {
            viewModelScope.launch {
                fetchMyCompany()
                fetchMyEvents()

                appFeedback = AppFeedback(
                    FeedbackType.INFO,
                    "Dados Atualizados",
                    "Os dados ou acessos da tua empresa foram modificados pelo Administrador."
                )
            }
        }

        mqttManager.connect()
    }

    fun fetchMyCompany() {
        val token = jwtToken ?: return
        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.getMyCompany("Bearer $token")
                if (response.isSuccessful) {
                    val companyData = response.body()
                    if (companyData != null) {
                        companyName = companyData.name
                        companyLogo = companyData.logoUrl ?: ""
                    }
                }
            } catch (e: Exception) {
                Log.e("API", "Erro ao atualizar dados da empresa: ${e.message}")
            }
        }
    }

    fun logout() {
        jwtToken = null
        currentEventId = null
        myEvents = emptyList()
        userRole = "Utilizador"
        companyName = "Seatly"
        companyLogo = ""
        managerName = ""
        userGuid = ""
        viewModelScope.launch {
            repository.deleteAllSeats()
        }
    }

    fun clearCurrentEvent() {
        currentEventId = null
        viewModelScope.launch {
            repository.deleteAllSeats()
        }
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

                if (response.role != null) {
                    userRole = response.role
                }

                if (response.companyName != null) companyName = response.companyName
                if (response.companyLogo != null) companyLogo = response.companyLogo

                managerName = user
                userGuid = response.userGuid ?: ""

                if (userGuid.isNotEmpty()) {
                    mqttManager.subscribeToManagerEvents(userGuid)
                }

                fetchMyEvents()

                loginError = null
                onSuccess()
            } catch (e: Exception) {
                loginError = "Credenciais inválidas ou erro de rede."
            }
        }
    }

    fun fetchMyEvents() {
        val token = jwtToken ?: return
        viewModelScope.launch {
            isLoadingEvents = true
            try {
                val response = RetrofitClient.apiService.getMyEvents("Bearer $token")
                if (response.isSuccessful) {
                    myEvents = response.body() ?: emptyList()
                }
            } catch (e: Exception) {
                Log.e("API", "Erro ao carregar eventos: ${e.message}")
            } finally {
                isLoadingEvents = false
            }
        }
    }

    fun changePassword(oldPass: String, newPass: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        val token = jwtToken ?: return
        viewModelScope.launch {
            try {
                val res = RetrofitClient.apiService.changePassword("Bearer $token", ChangePasswordRequest(oldPass, newPass))
                if (res.isSuccessful) {
                    onSuccess()
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Perfil Atualizado", "Palavra-passe alterada com sucesso!")
                } else {
                    onError("A palavra-passe atual está incorreta.")
                }
            } catch (e: Exception) {
                onError("Falha na comunicação com o servidor.")
            }
        }
    }

    fun processRoomCheckIn(qrContent: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Modo Offline", "Precisas de internet para entrar num evento.")
            return
        }

        val sanitizedQr = qrContent.replace("\\s".toRegex(), "").uppercase()

        val idString = if (sanitizedQr.startsWith("EVENT:")) {
            sanitizedQr.removePrefix("EVENT:")
        } else {
            sanitizedQr
        }

        val id = idString.toIntOrNull()

        if (id != null) {
            if (jwtToken == null) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Sessão Expirada", "Por favor faz login.")
                return
            }

            val hasAccess = myEvents.any { it.id == id }
            if (!hasAccess) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado", "O Evento $id não existe ou não tens permissão.")
                return
            }

            viewModelScope.launch {
                try {
                    val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", id)

                    currentEventId = id
                    repository.deleteAllSeats()
                    repository.insertAll(seatsFromApi)
                    mqttManager.subscribeToEventRoom(id)

                } catch (e: Exception) {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Verifica a tua ligação.")
                }
            }
        } else {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Formato Inválido", "O código não pertence a uma sala.")
        }
    }

    fun updateSeatStatus(seat: SeatEntity, newStatus: Int) {
        val safeEventId = currentEventId ?: return
        viewModelScope.launch {
            val timestamp = if (newStatus != 0) SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()) else null

            if (isOffline) {
                repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = true, markedAt = timestamp)
                appFeedback = AppFeedback(FeedbackType.OFFLINE, "Modo Offline", "Gravado no telemóvel. Será enviado quando houver rede.")
            } else {
                repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = false, markedAt = timestamp)
                mqttManager.publishSeatUpdate(safeEventId, seat.id, newStatus)

                try {
                    RetrofitClient.apiService.updateSingleSeat(
                        "Bearer $jwtToken", safeEventId, seat.id, UpdateSingleSeatRequest(newStatus)
                    )
                } catch (e: Exception) {
                    repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = true, markedAt = timestamp)
                }
            }
        }
    }

    private suspend fun syncPendingSeats() {
        val safeEventId = currentEventId ?: return
        val pendingSeats = repository.getPendingSyncSeats()

        if (pendingSeats.isNotEmpty()) {
            Log.d("SYNC", "A sincronizar ${pendingSeats.size} registos offline...")
            var successCount = 0

            pendingSeats.forEach { seat ->
                try {
                    val response = RetrofitClient.apiService.updateSingleSeat(
                        "Bearer $jwtToken", safeEventId, seat.id, UpdateSingleSeatRequest(seat.status)
                    )

                    if (response.isSuccessful) {
                        mqttManager.publishSeatUpdate(safeEventId, seat.id, seat.status)
                        repository.updateSeatStatusLocally(seat.id, seat.status, isPendingSync = false, markedAt = seat.markedAt)
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
                    fetchSeatsFromApi()
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Sucesso", "Registos atualizados com sucesso.")
                } else {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Erro no Servidor", "O servidor recusou a atualização. (Código: ${response.code()})")
                }
            }
            catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha na comunicação com o servidor.") }
        }
    }

    fun exportErrorsCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                    val writer = BufferedWriter(OutputStreamWriter(outputStream))
                    writer.write("Linha;Erro\n")
                    validationErrorsList.forEach { err ->
                        val l = if (err.actualLine == 0) "Geral" else err.actualLine.toString()
                        writer.write("$l;${err.actualErrorType}\n")
                    }
                    writer.flush()
                }
                appFeedback = AppFeedback(FeedbackType.EXPORT, "Relatório Exportado", "Ficheiro de erros guardado com sucesso.")
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha ao gravar o relatório.")
            }
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
                appFeedback = AppFeedback(FeedbackType.INFO, "A processar...", "A importar e a validar ficheiro...")

                val inputStream = context.contentResolver.openInputStream(uri) ?: throw Exception("Erro a ler ficheiro")
                val tempFile = java.io.File(context.cacheDir, "upload_temp.csv")
                tempFile.outputStream().use { inputStream.copyTo(it) }

                val requestFile = okhttp3.RequestBody.create("text/csv".toMediaTypeOrNull(), tempFile)
                val body = okhttp3.MultipartBody.Part.createFormData("file", "upload.csv", requestFile)

                val response = RetrofitClient.apiService.uploadCsv("Bearer $jwtToken", safeEventId, mode, body)

                if (response.isSuccessful) {
                    fetchSeatsFromApi()

                    val finalMessage = try {
                        val responseBodyStr = response.body().toString()
                        val regex = "removidos (\\d+) registos".toRegex()
                        val match = regex.find(responseBodyStr)

                        if (match != null) {
                            "Importação concluída com sucesso!\n\nA inteligência do servidor detetou e removeu ${match.groupValues[1]} lugares duplicados."
                        } else {
                            "Importação concluída. A lista foi otimizada com sucesso."
                        }
                    } catch (e: Exception) {
                        "Dados importados e otimizados pelo servidor."
                    }

                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Importação Limpa", finalMessage)
                } else {
                    appFeedback = null
                    val errorJson = response.errorBody()?.string()

                    try {
                        val errorResponse = com.google.gson.Gson().fromJson(errorJson, UploadErrorResponse::class.java)

                        // 👇 Adaptado à nova estrutura limpa sem propriedades duplicadas 👇
                        val apiErrors = errorResponse?.errors
                        val apiTotalRows = errorResponse?.totalRows ?: 0

                        if (apiErrors != null && apiErrors.isNotEmpty()) {
                            validationErrorsList = apiErrors
                            totalValidationRows = apiTotalRows
                            showValidationScreen = true
                        } else {
                            val regex = "\"[Mm]essage\":\"([^\"]+)\"".toRegex()
                            val match = errorJson?.let { regex.find(it) }
                            val errorMessage = match?.groupValues?.get(1) ?: "O ficheiro excede a capacidade ou contém erros."
                            appFeedback = AppFeedback(FeedbackType.ERROR, "Falha na Leitura", errorMessage)
                        }
                    } catch (e: Exception) {
                        appFeedback = AppFeedback(FeedbackType.ERROR, "Importação Recusada", "O ficheiro excede a capacidade ou contém erros de formatação.")
                    }
                }
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha de comunicação.")
            }
        }
    }

    fun clearEventData() {
        val safeEventId = currentEventId ?: return
        val token = jwtToken ?: return

        viewModelScope.launch {
            try {
                val response = RetrofitClient.apiService.clearEventData("Bearer $token", safeEventId)

                if (response.isSuccessful) {
                    repository.deleteAllSeats()
                    appFeedback = AppFeedback(
                        FeedbackType.INFO,
                        "Base de Dados Limpa",
                        "Os dados foram apagados permanentemente do servidor e deste dispositivo."
                    )
                } else {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Não foi possível apagar os dados no servidor.")
                }
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Falha de Rede", "Erro de comunicação ao contactar o servidor.")
            }
        }
    }

    fun exportCsv(uri: Uri, context: Context) {
        viewModelScope.launch {
            try {
                val currentSeats = seatsFlow.first()
                context.contentResolver.openOutputStream(uri)?.use { outputStream ->
                    val writer = BufferedWriter(OutputStreamWriter(outputStream))

                    writer.write("MESA;LUGAR;CATEGORIA;ESTADO;NOME;DATA_HORA\n")

                    currentSeats.forEach { seat ->
                        val assigned = seat.assignedTo ?: ""
                        val statusText = when(seat.status) { 1 -> "Validado"; 2 -> "Tratado"; else -> "Pendente" }
                        val partes = seat.seatNumber.split("-")
                        val mesa = if (partes.size > 1) partes[0] else ""
                        val lugar = if (partes.size > 1) partes[1] else seat.seatNumber

                        val dataHora = seat.markedAt?.replace("T", " ")?.substringBefore(".") ?: ""

                        writer.write("${mesa};${lugar};${seat.eventName};${statusText};${assigned};${dataHora}\n")
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