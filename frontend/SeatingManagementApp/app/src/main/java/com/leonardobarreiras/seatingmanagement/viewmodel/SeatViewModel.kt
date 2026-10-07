package com.leonardobarreiras.seatingmanagement.viewmodel

import android.app.Application
import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.annotations.SerializedName
import com.leonardobarreiras.seatingmanagement.data.JwtUtils
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.data.SeatRepository
import com.leonardobarreiras.seatingmanagement.data.SecureStorage
import com.leonardobarreiras.seatingmanagement.data.UserSession
import com.leonardobarreiras.seatingmanagement.network.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import retrofit2.HttpException
import java.io.BufferedWriter
import java.io.OutputStreamWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/**
 * Política de palavra-passe (igual à da API): entre 8 e 72 caracteres, com pelo menos uma letra e um número.
 */
const val MIN_PASSWORD_LENGTH = 8
const val MAX_PASSWORD_LENGTH = 72

fun isStrongPassword(password: String): Boolean =
    password.length in MIN_PASSWORD_LENGTH..MAX_PASSWORD_LENGTH && password.any { it.isLetter() } && password.any { it.isDigit() }

/**
 * Tipos de aviso mostrados ao utilizador (determinam ícone e cor do banner).
 */
enum class FeedbackType { SUCCESS, ERROR, EXPORT, INFO, OFFLINE }
/**
 * Aviso a apresentar no banner global (ver FeedbackToastHost).
 */
data class AppFeedback(val type: FeedbackType, val title: String, val message: String)

/**
 * Erro de validação de uma linha do CSV devolvido pelo servidor.
 */
data class CsvValidationError(
    @SerializedName(value = "line", alternate = ["Line"]) val line: Int?,
    @SerializedName(value = "errorType", alternate = ["ErrorType"]) val errorType: String?
) {
    val actualLine: Int get() = line ?: 0
    val actualErrorType: String get() = errorType ?: "Erro Desconhecido"
}

/**
 * Resposta de erro da importação de CSV: resumo e lista de erros por linha.
 */
data class UploadErrorResponse(
    @SerializedName(value = "message", alternate = ["Message"]) val message: String?,
    @SerializedName(value = "totalRows", alternate = ["TotalRows"]) val totalRows: Int?,
    @SerializedName(value = "errors", alternate = ["Errors"]) val errors: List<CsvValidationError>?
)

/**
 * Corpo de erro do login; `requiresPasswordReset` indica que é o primeiro acesso.
 */
data class AuthErrorResponse(
    val message: String?,
    val requiresPasswordReset: Boolean?
)

/**
 * ViewModel partilhado por toda a aplicação (sessão, eventos, lugares, MQTT e avisos).
 *
 * Responsabilidades:
 *  - autenticação (login, primeiro acesso, recuperação e alteração de palavra-passe);
 *  - estado da pessoa autenticada: nome (lido do JWT), função, empresa e logo atual;
 *  - eventos do utilizador e lugares do evento aberto (base local Room + sincronização com a API);
 *  - tempo real via MQTT (lugares, perfil/logout remoto, atualização de eventos);
 *  - ações do gestor (importar/exportar CSV, validar em massa, limpar dados).
 *
 * O estado de interface é exposto como `mutableStateOf` para o Compose recompor automaticamente.
 */
@HiltViewModel
class SeatViewModel @Inject constructor(
    application: Application,
    private val repository: SeatRepository,
    val secureStorage: SecureStorage,
    private val apiService: SeatingApiService
) : AndroidViewModel(application) {

    private val mqttManager: MqttManager
    private val networkMonitor = NetworkMonitor(application)

    val seatsFlow: Flow<List<SeatEntity>> = repository.allSeats

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

    var isAuthLoading by mutableStateOf(false)
    var isResetLoading by mutableStateOf(false)
    var loginError by mutableStateOf<String?>(null)
    var firstLoginError by mutableStateOf<String?>(null)
    var requiresFirstLoginReset by mutableStateOf(false)

    var currentEventId by mutableStateOf<Int?>(null)
    var appFeedback by mutableStateOf<AppFeedback?>(null)
    var forceLogoutEvent by mutableStateOf(false)

    var validationErrorsList by mutableStateOf<List<CsvValidationError>>(emptyList())
    var totalValidationRows by mutableIntStateOf(0)
    var showValidationScreen by mutableStateOf(false)

    private val announcedCapacityThresholds = mutableSetOf<Int>()

    /** Impede que o envio das validações pendentes e a substituição da cache local corram ao mesmo tempo. */
    private val syncMutex = Mutex()

    init {
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

        mqttManager.onManagerEventsUpdated = { viewModelScope.launch { fetchMyEvents() } }
        mqttManager.onProfileLogout = { viewModelScope.launch { forceLogoutEvent = true } }
        mqttManager.onProfileRefresh = {
            viewModelScope.launch {
                fetchMyCompany()
                fetchMyEvents()
                appFeedback = AppFeedback(FeedbackType.INFO, "Dados Atualizados", "Os dados ou acessos da tua empresa foram modificados pelo Administrador.")
            }
        }
        mqttManager.onReconnected = {
            // Ligação restabelecida: refaz subscrições e sincroniza logo empresa (logo) e eventos
            viewModelScope.launch {
                if (userGuid.isNotEmpty()) mqttManager.subscribeToManagerEvents(userGuid)
                currentEventId?.let { mqttManager.subscribeToEventRoom(it) }
                fetchMyCompany()
                fetchMyEvents()
                // Durante a quebra podem ter-se perdido mensagens (o MQTT não guarda histórico): recarrega os lugares
                if (currentEventId != null) fetchSeatsFromApi()
            }
        }
        // REMOVIDO: mqttManager.connect() daqui, passa a ser chamado nas funções de auth e startup.
    }

    // --- FUNÇÃO DE SUPORTE PARA GERIR LIGAÇÃO ---
    /**
     * Liga ao broker MQTT e subscreve os tópicos do gestor e do evento aberto (se existirem).
     */
    private fun connectMqttAndSubscribe() {
        mqttManager.connect {
            if (userGuid.isNotEmpty()) {
                mqttManager.subscribeToManagerEvents(userGuid)
            }
            if (currentEventId != null) {
                mqttManager.subscribeToEventRoom(currentEventId!!)
            }
        }
    }

    /**
     * Restaura a sessão guardada (token, empresa, nome) e devolve a rota inicial da navegação.
     *
     * Também pede logo ao servidor os dados atuais da empresa, porque os guardados podem estar desatualizados.
     */
    fun getStartDestination(): String {
        val session = secureStorage.getSession()
        // O token dura 8 horas: se já expirou, volta ao login em vez de falhar em silêncio nos pedidos.
        if (session != null && JwtUtils.isExpired(session.token)) {
            secureStorage.clearSession()
            return "login"
        }
        return if (session != null) {
            jwtToken = session.token
            userRole = session.role
            companyName = session.companyName
            companyLogo = session.companyLogo
            // Sessões antigas guardaram o e-mail como nome: recalcula a partir do token
            managerName = if (session.managerName.isBlank() || JwtUtils.looksLikeEmail(session.managerName))
                JwtUtils.resolveName(session.token, session.managerName)
            else session.managerName
            userGuid = session.userGuid

            // Ligar ao MQTT apenas quando recuperamos a sessão
            connectMqttAndSubscribe()
            fetchMyEvents()
            // Garante o logo/nome atuais da empresa (a sessão guardada pode estar desatualizada)
            fetchMyCompany()

            if (secureStorage.hasPin()) "pin_auth" else "event_selection"
        } else {
            "login"
        }
    }

    /** Guarda no armazenamento seguro o estado atual (nome/logo da empresa atualizados). */
    private fun persistSession() {
        val token = jwtToken ?: return
        secureStorage.saveSession(UserSession(token, userRole, companyName, companyLogo, managerName, userGuid))
    }

    /**
     * Obtém o nome e o logo atuais da empresa (GET api/Company/my-company) e persiste-os na sessão.
     */
    fun fetchMyCompany() {
        val token = jwtToken ?: return
        viewModelScope.launch {
            try {
                val response = apiService.getMyCompany("Bearer $token")
                if (response.isSuccessful) {
                    val companyData = response.body()
                    if (companyData != null) {
                        companyName = companyData.name
                        companyLogo = companyData.logoUrl ?: ""
                        persistSession()
                    }
                }
            } catch (e: Exception) { Log.e("API", "Erro ao atualizar dados da empresa: ${e.message}") }
        }
    }

    /**
     * Termina a sessão: limpa estado em memória, desliga o MQTT, apaga a sessão guardada e os lugares locais.
     */
    fun logout() {
        val tokenToFlush = jwtToken
        val eventToFlush = currentEventId
        jwtToken = null
        currentEventId = null
        myEvents = emptyList()
        userRole = "Utilizador"
        companyName = "Seatly"
        companyLogo = ""
        managerName = ""
        userGuid = ""
        requiresFirstLoginReset = false
        announcedCapacityThresholds.clear()

        mqttManager.disconnect() // Desliga o MQTT no logout
        secureStorage.clearSession()
        viewModelScope.launch {
            // Se houver rede, tenta enviar as validações ainda pendentes antes de apagar os lugares locais
            if (tokenToFlush != null && eventToFlush != null && !isOffline) {
                syncMutex.withLock { flushPendingSeats(eventToFlush, tokenToFlush) }
            }
            repository.deleteAllSeats()
        }
    }

    /**
     * Fecha o evento aberto e apaga os lugares locais (usado ao mudar de evento).
     */
    fun clearCurrentEvent() {
        currentEventId = null
        announcedCapacityThresholds.clear()
        viewModelScope.launch { repository.deleteAllSeats() }
    }

    /**
     * Muda de evento sem perder validações: primeiro tenta enviar as pendentes; se alguma continuar por enviar
     * (sem rede ou erro do servidor), não muda e avisa o utilizador. Só depois fecha o evento e chama [onSwitched].
     */
    fun switchEvent(onSwitched: () -> Unit) {
        val eventId = currentEventId
        viewModelScope.launch {
            if (eventId != null) {
                if (!isOffline) syncMutex.withLock { flushPendingSeats(eventId) }
                val remaining = repository.getPendingSyncSeats().size
                if (remaining > 0) {
                    appFeedback = AppFeedback(
                        FeedbackType.ERROR, "Validações por enviar",
                        "Tens $remaining validações guardadas só neste telemóvel. Liga-te à internet para as enviar antes de mudar de evento."
                    )
                    return@launch
                }
            }
            clearCurrentEvent()
            onSwitched()
        }
    }

    /**
     * Inicia sessão com e-mail e palavra-passe.
     *
     * Em caso de sucesso guarda a sessão, liga o MQTT e chama [onSuccess]. Se o servidor responder 403 com
     * `requiresPasswordReset`, ativa `requiresFirstLoginReset` para pedir a palavra-passe definitiva.
     */
    fun authenticate(email: String, pass: String, onSuccess: () -> Unit) {
        if (isOffline) { loginError = "Sem ligação à internet."; return }
        viewModelScope.launch {
            isAuthLoading = true
            try {
                loginError = null
                val response: AuthResponse = apiService.login(LoginRequest(email, pass))

                jwtToken = response.token
                if (response.role != null) userRole = response.role
                if (response.companyName != null) companyName = response.companyName
                if (response.companyLogo != null) companyLogo = response.companyLogo

                managerName = JwtUtils.resolveName(response.token, email)
                userGuid = response.userGuid ?: ""

                secureStorage.saveSession(UserSession(jwtToken!!, userRole, companyName, companyLogo, managerName, userGuid))

                // Ligar ao MQTT após sucesso do Login
                connectMqttAndSubscribe()

                fetchMyEvents()
                onSuccess()
            } catch (e: HttpException) {
                if (e.code() == 403) {
                    val errorJson = e.response()?.errorBody()?.string()
                    try {
                        val errorData = com.google.gson.Gson().fromJson(errorJson, AuthErrorResponse::class.java)
                        if (errorData.requiresPasswordReset == true) requiresFirstLoginReset = true
                        else loginError = errorData.message ?: "Credenciais inválidas."
                    } catch (ex: Exception) { loginError = "Conta bloqueada." }
                } else if (e.code() == 429) {
                    loginError = "Demasiadas tentativas falhadas. Tenta novamente dentro de 15 minutos."
                } else if (e.code() == 401 || e.code() == 400 || e.code() == 404) {
                    loginError = "Palavra-passe ou E-mail incorretos."
                } else { loginError = "Erro no servidor (${e.code()})." }
            } catch (e: Exception) { loginError = "Sem acesso ao servidor." }
            finally { isAuthLoading = false }
        }
    }

    /**
     * Pede o envio do e-mail de recuperação de palavra-passe (a resposta é sempre genérica por segurança).
     */
    fun requestPasswordReset(email: String) {
        if (isOffline) { appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "Precisas de internet para recuperar a palavra-passe."); return }
        viewModelScope.launch {
            appFeedback = try {
                val res = apiService.forgotPassword(ForgotPasswordRequest(email))
                if (res.isSuccessful) AppFeedback(FeedbackType.SUCCESS, "E-mail Enviado", "Se a conta existir, enviámos as instruções para ti.")
                else AppFeedback(FeedbackType.ERROR, "Erro", "Não foi possível processar o pedido.")
            } catch (e: Exception) {
                AppFeedback(FeedbackType.ERROR, "Erro de Rede", "Verifica a tua ligação.")
            }
        }
    }

    /**
     * Conclui o primeiro acesso: troca a palavra-passe temporária pela definitiva e inicia sessão.
     *
     * Valida localmente o mínimo de [MIN_PASSWORD_LENGTH] caracteres antes de chamar o servidor.
     */
    fun firstLoginReset(email: String, tempPass: String, newPass: String, onSuccess: () -> Unit) {
        if (isOffline) { firstLoginError = "Sem ligação à internet."; return }
        if (!isStrongPassword(newPass)) { firstLoginError = "A palavra-passe tem de ter entre $MIN_PASSWORD_LENGTH e $MAX_PASSWORD_LENGTH caracteres, com pelo menos uma letra e um número."; return }
        viewModelScope.launch {
            isResetLoading = true
            try {
                firstLoginError = null
                val response: AuthResponse = apiService.firstLoginReset(FirstLoginResetRequest(email, tempPass, newPass))

                jwtToken = response.token
                if (response.role != null) userRole = response.role
                if (response.companyName != null) companyName = response.companyName
                if (response.companyLogo != null) companyLogo = response.companyLogo

                managerName = JwtUtils.resolveName(response.token, email)
                userGuid = response.userGuid ?: ""

                secureStorage.saveSession(UserSession(jwtToken!!, userRole, companyName, companyLogo, managerName, userGuid))

                // Ligar ao MQTT após sucesso do Reset
                connectMqttAndSubscribe()

                fetchMyEvents()
                onSuccess()
            } catch (e: HttpException) { firstLoginError = "A palavra-passe temporária expirou ou ocorreu um erro de segurança." }
            catch (e: Exception) { firstLoginError = "Sem acesso ao servidor. Tenta novamente." }
            finally { isResetLoading = false }
        }
    }

    /**
     * Atualiza a lista de eventos a que o utilizador tem acesso (GET api/Event/my-events).
     */
    fun fetchMyEvents() {
        val token = jwtToken ?: return
        viewModelScope.launch {
            isLoadingEvents = true
            try {
                val response = apiService.getMyEvents("Bearer $token")
                if (response.isSuccessful) { myEvents = response.body() ?: emptyList() }
            } catch (e: Exception) { Log.e("API", "Erro ao carregar eventos: ${e.message}") }
            finally { isLoadingEvents = false }
        }
    }

    /**
     * Envia uma mensagem ao suporte (formulário de contacto do login/perfil).
     *
     * @param onSuccess chamado quando o servidor aceita a mensagem.
     * @param onError chamado com um texto pronto a mostrar ao utilizador.
     */
    fun sendSupportMessage(email: String, message: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        if (isOffline) { onError("Sem ligação à internet."); return }
        viewModelScope.launch {
            try {
                val res = apiService.contactSupport(ContactRequest(email, message))
                if (res.isSuccessful) {
                    onSuccess()
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Mensagem Enviada", "A equipa de suporte vai responder para o e-mail que indicaste.")
                } else if (res.code() == 503) {
                    onError("O contacto está indisponível de momento. Tenta mais tarde.")
                } else {
                    onError("Não foi possível enviar a mensagem. Verifica os dados.")
                }
            } catch (e: Exception) { onError("Falha na comunicação com o servidor.") }
        }
    }

    /**
     * Altera a palavra-passe da pessoa autenticada.
     *
     * @param onSuccess chamado quando o servidor aceita a alteração.
     * @param onError chamado com uma mensagem pronta a mostrar (inclui a regra do mínimo de caracteres).
     */
    fun changePassword(oldPass: String, newPass: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        val token = jwtToken ?: return
        if (!isStrongPassword(newPass)) { onError("A palavra-passe tem de ter entre $MIN_PASSWORD_LENGTH e $MAX_PASSWORD_LENGTH caracteres, com pelo menos uma letra e um número."); return }
        viewModelScope.launch {
            try {
                val res = apiService.changePassword("Bearer $token", ChangePasswordRequest(oldPass, newPass))
                if (res.isSuccessful) {
                    onSuccess()
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Perfil Atualizado", "Palavra-passe alterada com sucesso!")
                } else { onError("A palavra-passe atual está incorreta.") }
            } catch (e: Exception) { onError("Falha na comunicação com o servidor.") }
        }
    }

    /**
     * Abre um evento a partir do conteúdo de um QR ("EVENT:{id}") ou de um id direto.
     *
     * Confirma que o utilizador tem acesso ao evento, descarrega os lugares para a base local e
     * subscreve as atualizações em tempo real desse evento.
     */
    fun processRoomCheckIn(qrContent: String) {
        if (isOffline) { appFeedback = AppFeedback(FeedbackType.ERROR, "Modo Offline", "Precisas de internet para entrar num evento."); return }
        val sanitizedQr = qrContent.replace("\\s".toRegex(), "").uppercase()
        val idString = if (sanitizedQr.startsWith("EVENT:")) sanitizedQr.removePrefix("EVENT:") else sanitizedQr
        val id = idString.toIntOrNull()

        if (id != null) {
            if (jwtToken == null) { appFeedback = AppFeedback(FeedbackType.ERROR, "Sessão Expirada", "Por favor faz login."); return }
            val hasAccess = myEvents.any { it.id == id }
            if (!hasAccess) { appFeedback = AppFeedback(FeedbackType.ERROR, "Acesso Negado", "O Evento $id não existe ou não tens permissão."); return }

            viewModelScope.launch {
                try {
                    val seatsFromApi = apiService.getSeatsByEvent("Bearer $jwtToken", id)
                    currentEventId = id
                    announcedCapacityThresholds.clear()
                    val discarded = syncMutex.withLock {
                        // Preserva validações pendentes que sobraram de uma sessão anterior deste evento e envia-as já
                        val notInThisEvent = replaceLocalSeats(seatsFromApi)
                        flushPendingSeats(id)
                        notInThisEvent
                    }
                    if (discarded > 0) {
                        appFeedback = AppFeedback(
                            FeedbackType.ERROR, "Validações descartadas",
                            "$discarded validações pendentes não pertenciam a este evento e não puderam ser enviadas."
                        )
                    }

                    // Só subscrevemos se não ocorreram erros até aqui
                    mqttManager.subscribeToEventRoom(id)
                } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Verifica a tua ligação.") }
            }
        } else { appFeedback = AppFeedback(FeedbackType.ERROR, "Formato Inválido", "O código não pertence a uma sala.") }
    }

    /**
     * Marca ou desmarca a entrada de um convidado.
     *
     * Grava sempre primeiro na base local; offline fica pendente de sincronização. Online publica a alteração
     * por MQTT (para os outros telemóveis) e envia-a para a API. Também emite alertas de lotação (50/75/90/100%).
     */
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
                    apiService.updateSingleSeat("Bearer $jwtToken", safeEventId, seat.id, UpdateSingleSeatRequest(newStatus))
                } catch (e: Exception) { repository.updateSeatStatusLocally(seat.id, newStatus, isPendingSync = true, markedAt = timestamp) }
            }

            if (!isOffline && newStatus != 0) {
                val allSeats = repository.allSeats.first()
                val totalSeats = allSeats.size

                if (totalSeats > 0) {
                    var validatedCount = 0
                    allSeats.forEach { s ->
                        if (s.id == seat.id) validatedCount++
                        else if (s.status != 0) validatedCount++
                    }

                    val percentage = (validatedCount * 100) / totalSeats
                    val threshold = when (percentage) {
                        100 -> 100
                        in 90..99 -> 90
                        in 75..89 -> 75
                        in 50..74 -> 50
                        in 25..49 -> 25
                        else -> 0
                    }

                    if (threshold > 0 && !announcedCapacityThresholds.contains(threshold)) {
                        announcedCapacityThresholds.addAll(listOf(25, 50, 75, 90, 100).filter { it <= threshold })
                        val eventName = myEvents.find { it.id == safeEventId }?.name ?: "Evento #${safeEventId}"
                        mqttManager.publishCapacityAlert(eventName, threshold, validatedCount, totalSeats)
                    }
                }
            }
        }
    }

    /**
     * Envia para o servidor as validações guardadas offline do evento aberto (corre quando a rede volta).
     */
    private suspend fun syncPendingSeats() {
        val safeEventId = currentEventId ?: return
        syncMutex.withLock { flushPendingSeats(safeEventId) }
    }

    /**
     * Envia, uma a uma, as validações com `isPendingSync` e devolve quantas foram aceites pelo servidor.
     *
     * Uma falha de rede ou de servidor mantém o lugar na fila para tentar mais tarde. Se o servidor responder
     * 400, 403 ou 404 (o lugar já não existe ou não pertence ao evento), repetir não resolve: o pedido é
     * descartado, para não bloquear a fila nem a mudança de evento. Deve ser chamada com [syncMutex] já obtido.
     */
    private suspend fun flushPendingSeats(eventId: Int, token: String? = jwtToken): Int {
        val authToken = token ?: return 0
        val pendingSeats = repository.getPendingSyncSeats()
        if (pendingSeats.isEmpty()) return 0

        Log.d("SYNC", "A sincronizar ${pendingSeats.size} registos offline...")
        var successCount = 0

        pendingSeats.forEach { seat ->
            try {
                val response = apiService.updateSingleSeat("Bearer $authToken", eventId, seat.id, UpdateSingleSeatRequest(seat.status))
                if (response.isSuccessful) {
                    mqttManager.publishSeatUpdate(eventId, seat.id, seat.status)
                    repository.updateSeatStatusLocally(seat.id, seat.status, isPendingSync = false, markedAt = seat.markedAt)
                    successCount++
                } else if (response.code() in listOf(400, 403, 404)) {
                    Log.w("SYNC", "Lugar ${seat.id} recusado (${response.code()}), removido da fila.")
                    repository.updateSeatStatusLocally(seat.id, seat.status, isPendingSync = false, markedAt = seat.markedAt)
                }
            } catch (e: Exception) { Log.e("SYNC", "Falha ao enviar lugar ${seat.id}, continua na fila.") }
        }
        if (successCount > 0) { appFeedback = AppFeedback(FeedbackType.SUCCESS, "Rede Restabelecida", "$successCount lugares offline gravados na BD Central.") }
        return successCount
    }

    /**
     * Substitui a cache local pelos lugares do servidor sem perder validações ainda por enviar: os lugares
     * pendentes mantêm o estado local e a marca `isPendingSync`. Devolve quantos pendentes não existem nesta lista.
     */
    private suspend fun replaceLocalSeats(serverSeats: List<SeatEntity>): Int {
        val pending = repository.getPendingSyncSeats().associateBy { it.id }
        val serverIds = serverSeats.map { it.id }.toSet()
        val merged = serverSeats.map { seat ->
            pending[seat.id]?.let { p -> seat.copy(status = p.status, markedAt = p.markedAt, isPendingSync = true) } ?: seat
        }
        repository.deleteAllSeats()
        repository.insertAll(merged)
        return pending.keys.count { it !in serverIds }
    }

    /**
     * Sincroniza manualmente: envia as validações pendentes e depois substitui os lugares locais pelos do
     * servidor (ignorado offline). Usado também quando chega um comando REFRESH por MQTT.
     */
    fun fetchSeatsFromApi() {
        if (isOffline) return
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            syncMutex.withLock {
                try {
                    flushPendingSeats(safeEventId)
                    val seatsFromApi = apiService.getSeatsByEvent("Bearer $jwtToken", safeEventId)
                    // Se entretanto mudou de evento, a resposta já não interessa
                    if (currentEventId == safeEventId) replaceLocalSeats(seatsFromApi)
                } catch (e: Exception) { Log.e("API", "Erro ao sincronizar") }
            }
        }
    }

    /**
     * Marca ou desmarca todos os convidados do evento no servidor (apenas online).
     */
    fun bulkUpdateStatus(novoEstado: String) {
        if (isOffline) { appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "As ações em massa requerem internet."); return }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                // Primeiro o que ficou pendente, para a ação em massa ser a última palavra
                syncMutex.withLock { flushPendingSeats(safeEventId) }
                val response = apiService.bulkUpdateStatus("Bearer $jwtToken", safeEventId, BulkUpdateStatusRequest(novoEstado))
                if (response.isSuccessful) {
                    fetchSeatsFromApi()
                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Sucesso", "Registos atualizados com sucesso.")

                    if (novoEstado != "0" && novoEstado.lowercase() != "pendente") {
                        val allSeats = repository.allSeats.first()
                        val totalSeats = allSeats.size

                        if (totalSeats > 0) {
                            val threshold = 100
                            if (!announcedCapacityThresholds.contains(threshold)) {
                                announcedCapacityThresholds.addAll(listOf(25, 50, 75, 90, 100))
                                val eventName = myEvents.find { it.id == safeEventId }?.name ?: "Evento #${safeEventId}"
                                mqttManager.publishCapacityAlert(eventName, threshold, totalSeats, totalSeats)
                            }
                        }
                    } else { announcedCapacityThresholds.clear() }
                } else { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro no Servidor", "O servidor recusou a atualização. (Código: ${response.code()})") }
            }
            catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha na comunicação com o servidor.") }
        }
    }

    /**
     * Exporta para um ficheiro CSV o relatório de erros da última importação recusada.
     */
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
            } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha ao gravar o relatório.") }
        }
    }

    /**
     * Envia um CSV de convidados para o servidor.
     *
     * @param mode `"replace"` apaga a lista atual; `"append"` acrescenta aos existentes.
     * Em caso de erro de validação abre o relatório de importação.
     */
    fun uploadCsvToServer(uri: Uri, context: Context, mode: String) {
        if (isOffline) { appFeedback = AppFeedback(FeedbackType.ERROR, "Sem Rede", "Upload requer internet."); return }
        val safeEventId = currentEventId ?: return
        if (jwtToken == null) return

        viewModelScope.launch {
            try {
                appFeedback = AppFeedback(FeedbackType.INFO, "A processar...", "A importar e a validar ficheiro...")

                val inputStream = context.contentResolver.openInputStream(uri) ?: throw Exception("Erro a ler ficheiro")
                val tempFile = java.io.File(context.cacheDir, "upload_temp.csv")
                tempFile.outputStream().use { inputStream.copyTo(it) }

                val requestFile = tempFile.asRequestBody("text/csv".toMediaTypeOrNull())
                val body = okhttp3.MultipartBody.Part.createFormData("file", "upload.csv", requestFile)

                val response = apiService.uploadCsv("Bearer $jwtToken", safeEventId, mode, body)

                if (response.isSuccessful) {
                    fetchSeatsFromApi()
                    val finalMessage = try {
                        val responseBodyStr = response.body().toString()
                        val regex = "removidos (\\d+) registos".toRegex()
                        val match = regex.find(responseBodyStr)

                        if (match != null) "Importação concluída com sucesso!\n\nA inteligência do servidor detetou e removeu ${match.groupValues[1]} lugares duplicados."
                        else "Importação concluída. A lista foi otimizada com sucesso."
                    } catch (e: Exception) { "Dados importados e otimizados pelo servidor." }

                    appFeedback = AppFeedback(FeedbackType.SUCCESS, "Importação Limpa", finalMessage)
                } else {
                    appFeedback = null
                    val errorJson = response.errorBody()?.string()

                    try {
                        val errorResponse = com.google.gson.Gson().fromJson(errorJson, UploadErrorResponse::class.java)
                        val apiErrors = errorResponse?.errors
                        val apiTotalRows = errorResponse?.totalRows ?: 0

                        if (!apiErrors.isNullOrEmpty()) {
                            validationErrorsList = apiErrors
                            totalValidationRows = apiTotalRows
                            showValidationScreen = true
                        } else {
                            val regex = "\"[Mm]essage\":\"([^\"]+)\"".toRegex()
                            val match = errorJson?.let { regex.find(it) }
                            val errorMessage = match?.groupValues?.get(1) ?: "O ficheiro excede a capacidade ou contém erros."
                            appFeedback = AppFeedback(FeedbackType.ERROR, "Falha na Leitura", errorMessage)
                        }
                    } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Importação Recusada", "O ficheiro excede a capacidade ou contém erros de formatação.") }
                }
            } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Falha de comunicação.") }
        }
    }

    /**
     * Apaga permanentemente os convidados e lugares do evento (servidor e dispositivo).
     */
    fun clearEventData() {
        val safeEventId = currentEventId ?: return
        val token = jwtToken ?: return

        viewModelScope.launch {
            try {
                val response = apiService.clearEventData("Bearer $token", safeEventId)
                if (response.isSuccessful) {
                    repository.deleteAllSeats()
                    appFeedback = AppFeedback(FeedbackType.INFO, "Base de Dados Limpa", "Os dados foram apagados permanentemente do servidor e deste dispositivo.")
                } else { appFeedback = AppFeedback(FeedbackType.ERROR, "Erro", "Não foi possível apagar os dados no servidor.") }
            } catch (e: Exception) { appFeedback = AppFeedback(FeedbackType.ERROR, "Falha de Rede", "Erro de comunicação ao contactar o servidor.") }
        }
    }

    /**
     * Exporta os lugares do evento aberto, com o estado atual, para um ficheiro CSV.
     */
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

    /**
     * Fecha o aviso atual (chamado pelo banner ao expirar ou ao ser fechado).
     */
    fun clearFeedback() { appFeedback = null }

    override fun onCleared() {
        super.onCleared()
        mqttManager.disconnect()
    }
}