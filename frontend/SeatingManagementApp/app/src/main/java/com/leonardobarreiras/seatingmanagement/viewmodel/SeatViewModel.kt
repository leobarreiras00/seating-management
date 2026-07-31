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
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.BufferedWriter
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

enum class FeedbackType { SUCCESS, ERROR, EXPORT, INFO, OFFLINE }
data class AppFeedback(val type: FeedbackType, val title: String, val message: String)

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

    // Variáveis de estado para a Lista de Eventos Dinâmica
    var myEvents by mutableStateOf<List<EventDto>>(emptyList())
    var isLoadingEvents by mutableStateOf(false)

    var loginError by mutableStateOf<String?>(null)
    var currentEventId by mutableStateOf<Int?>(null)
    var appFeedback by mutableStateOf<AppFeedback?>(null)

    // Flag para forçar logout a partir do MQTT
    var forceLogoutEvent by mutableStateOf(false)

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
                    // Se o MQTT nos avisar de uma mudança, guardamos com a hora atual
                    val timestamp = if (status != 0) SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date()) else null
                    repository.updateSeatStatusLocally(id, status, isPendingSync = false, markedAt = timestamp)
                }
            }
        }

        // LIGAÇÃO MQTT -> PAINEL DE GESTÃO
        mqttManager.onManagerEventsUpdated = {
            viewModelScope.launch {
                // Atualiza a lista à frente dos olhos do utilizador!
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
                fetchMyCompany() // Atualiza UI em tempo real
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

    // NOVA FUNÇÃO: Chamada via MQTT para puxar os dados atualizados
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

    // LOGOUT COMPLETO: Limpa dados e estado da sessão
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

    // MUDAR DE EVENTO: Limpa o evento atual e respetivos lugares locais
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

                // Guarda o Role e Carrega os Eventos
                if (response.role != null) {
                    userRole = response.role
                }

                if (response.companyName != null) companyName = response.companyName
                if (response.companyLogo != null) companyLogo = response.companyLogo

                // Grava os dados do gestor e ouve o MQTT
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

    // Função que contacta a API para buscar a lista de eventos atribuídos
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

    // NOTA: Esta função foi mantida ativa porque o "Acesso Manual" a utiliza,
    // injetando a string "EVENT:id". O Input Sanitation está pronto se o QR
    // Scanner foi ativo no futuro.
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

            // Verifica se o ID clicado pertence à lista de eventos do utilizador
            val hasAccess = myEvents.any { it.id == id }
            if (!hasAccess) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado", "O Evento $id não existe ou não tens permissão.")
                return
            }

            viewModelScope.launch {
                try {
                    // Pede os lugares à API (pode vir vazio se for um evento novo, e não há problema!)
                    val seatsFromApi = RetrofitClient.apiService.getSeatsByEvent("Bearer $jwtToken", id)

                    currentEventId = id
                    repository.deleteAllSeats()
                    repository.insertAll(seatsFromApi)
                    mqttManager.subscribeToEventRoom(id)

                    // Opcional: Removi o AppFeedback de sucesso aqui para a navegação ser mais fluída
                    // e não chatear o utilizador com um popup sempre que entra num evento.

                } catch (e: Exception) {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Verifica a tua ligação.")
                }
            }
        } else {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Formato Inválido", "O código não pertence a uma sala.")
        }
    }

    /*
    // ====================================================================
    // [FEATURE] - VALIDAÇÃO DE BILHETES VIA QR CODE
    // ====================================================================
    // Lógica preparada para receber a String do ML Kit e procurar
    // instantaneamente na base de dados local (Room) ou na API.
    // Suspensa na V1.0. A validação atual é feita manualmente na UI.
    fun validateTicketFromQr(qrContent: String) {
        val safeEventId = currentEventId ?: return

        val sanitizedQr = qrContent.replace("\\s".toRegex(), "").uppercase()

        viewModelScope.launch {
            val currentSeats = seatsFlow.first()
            val targetSeat = currentSeats.find { seat ->
                seat.seatNumber.replace("\\s".toRegex(), "").uppercase() == sanitizedQr
            }

            if (targetSeat != null) {
                if (targetSeat.status == 0) {
                    updateSeatStatus(targetSeat, 1)
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Lugar Validado", "Acesso permitido para ${targetSeat.seatNumber}.")
                } else {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado", "O lugar ${targetSeat.seatNumber} já se encontra ocupado.")
                }
            } else {
                if (isOffline) {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Não Encontrado", "O QR lido ('$qrContent') não corresponde a nenhum lugar desta sala.")
                } else {
                    if (jwtToken == null) return@launch
                    try {
                        RetrofitClient.apiService.validateTicket("Bearer $jwtToken", ValidateTicketRequest(safeEventId, qrContent))
                        fetchSeatsFromApi()
                        appFeedback = AppFeedback(FeedbackType.SUCCESS, "Bilhete Válido", "Validado através do servidor.")
                    } catch (e: Exception) {
                        appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado", "Bilhete inválido ou não encontrado.")
                    }
                }
            }
        }
    }
    */

    fun updateSeatStatus(seat: SeatEntity, newStatus: Int) {
        val safeEventId = currentEventId ?: return
        viewModelScope.launch {
            // Gera a Data/Hora local exata em que o botão foi clicado
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
                        // Mantemos o markedAt que estava na fila, apenas removemos a flag de pendente
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

    /*
    // ====================================================================
    // NOTA DE ARQUITETURA:
    // A função removeDuplicateSeats() foi descontinuada do lado do cliente (App).
    // A responsabilidade de limpar "bad registers" e duplicados passou
    // a ser 100% do Backend. O C# agora executa o algoritmo de deduplicação
    // automaticamente no final do endpoint de Upload de CSV.
    // ====================================================================
    fun removeDuplicateSeats(pin: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "A remoção de duplicados requer internet.")
            return
        }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                appFeedback = AppFeedback(FeedbackType.INFO, "A Processar", "A limpar registos duplicados no servidor...")
                val response = RetrofitClient.apiService.removeDuplicates("Bearer $jwtToken", safeEventId, ClearDatabaseDto(pin))

                if (response.isSuccessful) {
                    fetchSeatsFromApi() // Recarrega os dados locais já limpos
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Limpeza Concluída", "Registos duplicados removidos com sucesso.")
                } else {
                    appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha ao processar a limpeza no servidor.")
                }
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha de comunicação com o servidor.")
            }
        }
    }
    */

    fun uploadCsvToServer(uri: Uri, context: Context, mode: String) {
        if (isOffline) {
            appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "Upload requer internet.")
            return
        }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                appFeedback = AppFeedback(FeedbackType.INFO, "A processar...", "A importar e a limpar duplicados no servidor...")

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
                    val errorMessage = try {
                        val errorJson = response.errorBody()?.string()
                        val regex = "\"Message\":\"([^\"]+)\"".toRegex()
                        val match = errorJson?.let { regex.find(it) }
                        match?.groupValues?.get(1) ?: "O ficheiro excede a capacidade ou contém erros."
                    } catch (e: Exception) {
                        "O ficheiro excede a capacidade ou contém erros."
                    }

                    appFeedback = AppFeedback(FeedbackType.ERROR, "Importação Recusada", errorMessage)
                }
            } catch (e: Exception) {
                appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha de comunicação.")
            }
        }
    }

    fun clearEventData(pin: String = "") {
        val safeEventId = currentEventId ?: return
        val token = jwtToken ?: return

        viewModelScope.launch {
            try {
                // Efetua a chamada ao novo endpoint que limpa a base de dados
                val response = RetrofitClient.apiService.clearEventData("Bearer $token", safeEventId)

                if (response.isSuccessful) {
                    // Limpa o Room local para refletir o estado do servidor
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