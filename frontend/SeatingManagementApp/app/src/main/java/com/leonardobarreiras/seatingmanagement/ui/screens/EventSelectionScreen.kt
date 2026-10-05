package com.leonardobarreiras.seatingmanagement.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Dialpad
import androidx.compose.material.icons.rounded.Event
import androidx.compose.material.icons.rounded.EventBusy
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.leonardobarreiras.seatingmanagement.ui.components.CompanyLogo
import com.leonardobarreiras.seatingmanagement.ui.components.ContactSupportDialog
import com.leonardobarreiras.seatingmanagement.ui.components.EmptyState
import com.leonardobarreiras.seatingmanagement.ui.components.GradientButton
import com.leonardobarreiras.seatingmanagement.ui.components.LegalDocument
import com.leonardobarreiras.seatingmanagement.ui.components.LegalDocumentDialog
import com.leonardobarreiras.seatingmanagement.ui.components.LegalLinksRow
import com.leonardobarreiras.seatingmanagement.ui.components.PasswordRulesHint
import com.leonardobarreiras.seatingmanagement.ui.components.PinDots
import com.leonardobarreiras.seatingmanagement.ui.components.PinKeypad
import com.leonardobarreiras.seatingmanagement.ui.components.SeatlyTextField
import com.leonardobarreiras.seatingmanagement.ui.components.ShimmerBlock
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurple
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurpleLight
import com.leonardobarreiras.seatingmanagement.ui.theme.BorderSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.BrandGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.BrandGradientSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.CorporateBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.DarkHeroGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRed
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRedLight
import com.leonardobarreiras.seatingmanagement.ui.theme.FieldBg
import com.leonardobarreiras.seatingmanagement.ui.theme.LightBg
import com.leonardobarreiras.seatingmanagement.ui.theme.OfflineGray
import com.leonardobarreiras.seatingmanagement.ui.theme.PrimaryBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.SuccessGreen
import com.leonardobarreiras.seatingmanagement.ui.theme.SuccessGreenLight
import com.leonardobarreiras.seatingmanagement.ui.theme.TextGray
import com.leonardobarreiras.seatingmanagement.ui.utils.EventPhase
import com.leonardobarreiras.seatingmanagement.ui.utils.eventPhase
import com.leonardobarreiras.seatingmanagement.ui.utils.formatEventDate
import com.leonardobarreiras.seatingmanagement.viewmodel.MIN_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

/*
 * EventSelectionScreen.kt
 * -----------------------
 * Painel de gestão: o utilizador vê o logo e nome da empresa, a saudação com o seu nome e a lista
 * de eventos a que tem acesso. Inclui também o diálogo de perfil (palavra-passe, PIN, sessão).
 */

/** Comprimento do PIN de acesso rápido (igual ao dos ecrãs de autenticação). */
private const val PROFILE_PIN_LENGTH = 4

/**
 * Diálogo "O Meu Perfil": dados da pessoa, alteração de palavra-passe, configuração do PIN,
 * links legais e terminar sessão.
 */
@Composable
fun ProfileDialog(viewModel: SeatViewModel, onDismiss: () -> Unit) {
    var oldPass by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var confirmPass by remember { mutableStateOf("") }
    var isChanging by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }

    var isConfiguringPin by remember { mutableStateOf(false) }
    var newPin by remember { mutableStateOf("") }
    var hasPinConfigured by remember { mutableStateOf(viewModel.secureStorage.hasPin()) }

    var legalDocument by remember { mutableStateOf<LegalDocument?>(null) }
    var showContactDialog by remember { mutableStateOf(false) }

    val initials = viewModel.managerName.split(" ").filter { it.isNotBlank() }.take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("").ifEmpty { "?" }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(32.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                // Cabeçalho: avatar com iniciais, nome, função e empresa
                Box(modifier = Modifier.fillMaxWidth().background(DarkHeroGradient)) {
                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(54.dp).background(BrandGradient, CircleShape).border(2.dp, Color.White.copy(alpha = 0.4f), CircleShape), contentAlignment = Alignment.Center) {
                            Text(initials, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp)
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(viewModel.managerName.ifBlank { "O Meu Perfil" }, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("${viewModel.userRole} · ${viewModel.companyName}", fontSize = 12.sp, color = Color.White.copy(alpha = 0.75f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton(onClick = onDismiss, modifier = Modifier.size(36.dp).background(Color.White.copy(alpha = 0.16f), CircleShape)) {
                            Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                }

                Column(modifier = Modifier.padding(20.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    // --- Palavra-passe ---
                    Text("Alterar Palavra-passe", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = CorporateBlue)
                    SeatlyTextField(value = oldPass, onValueChange = { oldPass = it; errorMsg = "" }, label = "Palavra-passe atual", leadingIcon = Icons.Rounded.Lock, isPassword = true)
                    // Aviso permanente do mínimo de caracteres (criar/alterar palavra-passe)
                    PasswordRulesHint(currentValue = newPass)
                    SeatlyTextField(value = newPass, onValueChange = { newPass = it; errorMsg = "" }, label = "Nova palavra-passe", leadingIcon = Icons.Rounded.Lock, isPassword = true)
                    // Confirmação obrigatória para evitar erros de escrita
                    SeatlyTextField(value = confirmPass, onValueChange = { confirmPass = it; errorMsg = "" }, label = "Confirmar nova palavra-passe", leadingIcon = Icons.Rounded.Lock, isPassword = true)

                    if (errorMsg.isNotEmpty()) {
                        Text(errorMsg, color = ErrorRed, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth())
                    }

                    GradientButton(
                        text = "Guardar Alteração",
                        loading = isChanging,
                        onClick = {
                            if (oldPass.isEmpty() || newPass.isEmpty()) {
                                errorMsg = "Preenche todos os campos."
                                return@GradientButton
                            }
                            // Restrição de segurança: mínimo de caracteres
                            if (newPass.length < MIN_PASSWORD_LENGTH) {
                                errorMsg = "A palavra-passe tem de ter no mínimo $MIN_PASSWORD_LENGTH caracteres."
                                return@GradientButton
                            }
                            if (newPass != confirmPass) {
                                errorMsg = "As palavras-passe não coincidem."
                                return@GradientButton
                            }
                            isChanging = true
                            viewModel.changePassword(
                                oldPass = oldPass,
                                newPass = newPass,
                                onSuccess = { onDismiss(); isChanging = false },
                                onError = { errorMsg = it; isChanging = false }
                            )
                        }
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(BorderSoft))
                    Spacer(modifier = Modifier.height(4.dp))

                    // --- PIN de acesso ---
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(if (hasPinConfigured) "Alterar Código PIN" else "Configurar PIN de Acesso", fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = CorporateBlue)
                        if (hasPinConfigured) {
                            Icon(Icons.Rounded.CheckCircle, contentDescription = "PIN configurado", tint = SuccessGreen, modifier = Modifier.size(20.dp))
                        }
                    }

                    if (isConfiguringPin) {
                        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
                            PinDots(length = PROFILE_PIN_LENGTH, filled = newPin.length)
                            PinKeypad(
                                onDigit = { digit -> if (newPin.length < PROFILE_PIN_LENGTH) newPin += digit },
                                onBackspace = { newPin = newPin.dropLast(1) },
                                keySize = 56.dp
                            )
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            OutlinedButton(
                                onClick = { isConfiguringPin = false; newPin = "" },
                                modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, BorderSoft)
                            ) { Text("Cancelar", color = TextGray, fontWeight = FontWeight.Bold) }
                            GradientButton(
                                text = "Gravar PIN",
                                enabled = newPin.length == PROFILE_PIN_LENGTH,
                                modifier = Modifier.weight(1f),
                                onClick = { viewModel.secureStorage.savePin(newPin); hasPinConfigured = true; isConfiguringPin = false; newPin = "" }
                            )
                        }
                    } else {
                        OutlinedButton(
                            onClick = { isConfiguringPin = true },
                            modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(18.dp),
                            border = BorderStroke(1.dp, AccentPurple.copy(alpha = 0.3f)),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = AccentPurpleLight, contentColor = AccentPurple)
                        ) {
                            Icon(Icons.Rounded.Dialpad, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (hasPinConfigured) "Redefinir PIN" else "Ativar Acesso por PIN", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(BorderSoft))
                    Spacer(modifier = Modifier.height(4.dp))

                    // --- Sessão ---
                    OutlinedButton(
                        onClick = { onDismiss(); viewModel.forceLogoutEvent = true },
                        modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, ErrorRed.copy(alpha = 0.3f)),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = ErrorRedLight.copy(alpha = 0.4f), contentColor = ErrorRed)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Terminar Sessão", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }

                    LegalLinksRow(
                        onContact = { showContactDialog = true },
                        onPrivacy = { legalDocument = LegalDocument.PRIVACY },
                        onTerms = { legalDocument = LegalDocument.TERMS }
                    )
                }
            }
        }
    }

    legalDocument?.let { doc -> LegalDocumentDialog(document = doc, onDismiss = { legalDocument = null }) }
    if (showContactDialog) {
        ContactSupportDialog(
            onSend = { email, message, onSuccess, onError -> viewModel.sendSupportMessage(email, message, onSuccess, onError) },
            onDismiss = { showContactDialog = false }
        )
    }
}

/** Etiqueta com a fase temporal do evento (A decorrer / Brevemente / Terminado). */
@Composable
private fun EventPhaseChip(phase: EventPhase) {
    val (label, color, bg) = when (phase) {
        EventPhase.LIVE -> Triple("A decorrer", SuccessGreen, SuccessGreenLight)
        EventPhase.UPCOMING -> Triple("Brevemente", AccentPurple, AccentPurpleLight)
        EventPhase.FINISHED -> Triple("Fechado", OfflineGray, Color(0xFFF1F5F9))
    }
    Row(modifier = Modifier.background(bg, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(6.dp).background(color, CircleShape))
        Spacer(modifier = Modifier.width(5.dp))
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = color)
    }
}

/**
 * Painel de gestão / lista de eventos.
 *
 * Ordem de cima para baixo: logo da empresa, nome da empresa, saudação com o nome da pessoa e
 * eventos associados. Ao voltar ao ecrã atualiza eventos e dados da empresa (logo incluído).
 *
 * @param onEventSelected chamado quando um evento é escolhido e os lugares ficam carregados.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventSelectionScreen(viewModel: SeatViewModel, onEventSelected: () -> Unit) {
    LaunchedEffect(viewModel.currentEventId) { if (viewModel.currentEventId != null) onEventSelected() }

    val lifecycleOwner = androidx.lifecycle.compose.LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.fetchMyEvents()
                // Garante sempre o logo/nome atuais da empresa
                viewModel.fetchMyCompany()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    var showProfileDialog by remember { mutableStateOf(false) }
    val sortedEvents = remember(viewModel.myEvents) { viewModel.myEvents.sortedByDescending { it.startDate ?: "" } }
    val isManager = viewModel.userRole == "Gestor" || viewModel.userRole == "SuperAdmin"

    Column(modifier = Modifier.fillMaxSize().background(LightBg)) {
        // --- Cabeçalho: o conteúdo define a altura e os círculos decorativos ficam recortados lá dentro ---
        Box(
            modifier = Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(bottomStart = 36.dp, bottomEnd = 36.dp))
                .background(DarkHeroGradient)
        ) {
            Box(modifier = Modifier.matchParentSize()) {
                Box(modifier = Modifier.align(Alignment.TopEnd).offset(x = 70.dp, y = (-50).dp).size(240.dp).background(AccentPurple.copy(alpha = 0.35f), CircleShape))
                Box(modifier = Modifier.align(Alignment.BottomStart).offset(x = (-60).dp, y = 50.dp).size(180.dp).background(PrimaryBlue.copy(alpha = 0.3f), CircleShape))
            }

            // Ordem pedida: 1) logo  2) nome da empresa  3) boas-vindas com nome  (4) eventos abaixo)
            Column(modifier = Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    IconButton(
                        onClick = { showProfileDialog = true },
                        modifier = Modifier.size(44.dp).background(Color.White.copy(alpha = 0.16f), CircleShape).border(1.dp, Color.White.copy(alpha = 0.3f), CircleShape)
                    ) { Icon(Icons.Rounded.Person, contentDescription = "Perfil", tint = Color.White) }
                }
                CompanyLogo(logo = viewModel.companyLogo, companyName = viewModel.companyName, size = 88.dp)
                Spacer(modifier = Modifier.height(14.dp))
                Text(viewModel.companyName, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Color.White, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    if (viewModel.managerName.isNotBlank()) "Olá, ${viewModel.managerName} 👋" else "Olá 👋",
                    fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Color.White.copy(alpha = 0.85f), textAlign = TextAlign.Center, maxLines = 1, overflow = TextOverflow.Ellipsis
                )
            }
        }

        // --- Eventos associados ---
        Column(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
            Spacer(modifier = Modifier.height(24.dp))
            Text(if (isManager) "Painel de Gestão" else "Os Meus Eventos", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
            Text("Eventos associados · seleciona um para começar", color = TextGray, fontSize = 13.sp, modifier = Modifier.padding(bottom = 16.dp))

            if (viewModel.isLoadingEvents && sortedEvents.isEmpty()) {
                // Esqueleto enquanto os eventos carregam
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    repeat(3) { ShimmerBlock(modifier = Modifier.fillMaxWidth().height(92.dp)) }
                }
            } else if (sortedEvents.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(0.dp), border = BorderStroke(1.dp, BorderSoft), shape = RoundedCornerShape(28.dp)
                ) {
                    EmptyState(
                        icon = Icons.Rounded.EventBusy,
                        title = "Sem Eventos Atribuídos",
                        message = "Não tens permissões ativas para aceder a nenhum evento neste momento."
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    modifier = Modifier.fillMaxWidth().weight(1f)
                ) {
                    items(sortedEvents, key = { it.id }) { event ->
                        val phase = remember(event.startDate, event.endDate) { eventPhase(event.startDate, event.endDate) }
                        Card(
                            onClick = { viewModel.processRoomCheckIn("EVENT:${event.id}") }, modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(0.dp),
                            border = BorderStroke(1.dp, BorderSoft), shape = RoundedCornerShape(24.dp)
                        ) {
                            Row(modifier = Modifier.padding(18.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(52.dp).background(BrandGradient, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Event, contentDescription = null, tint = Color.White) }
                                Spacer(modifier = Modifier.width(16.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    if (phase != null) {
                                        EventPhaseChip(phase)
                                        Spacer(modifier = Modifier.height(6.dp))
                                    }
                                    Text(event.name, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = CorporateBlue, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text("Início: ${formatEventDate(event.startDate)}", color = TextGray, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                    if (event.endDate != null && event.endDate != event.startDate) {
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text("Fim: ${formatEventDate(event.endDate)}", color = TextGray, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                                Box(modifier = Modifier.size(32.dp).background(AccentPurpleLight, CircleShape), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = AccentPurple, modifier = Modifier.size(20.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showProfileDialog) {
        ProfileDialog(viewModel = viewModel, onDismiss = { showProfileDialog = false })
    }
}
