package com.leonardobarreiras.seatingmanagement.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import com.leonardobarreiras.seatingmanagement.R
import com.leonardobarreiras.seatingmanagement.ui.components.GradientButton
import com.leonardobarreiras.seatingmanagement.ui.components.PasswordRulesHint
import com.leonardobarreiras.seatingmanagement.ui.components.CompanyLogo
import com.leonardobarreiras.seatingmanagement.ui.theme.*
import com.leonardobarreiras.seatingmanagement.viewmodel.MIN_PASSWORD_LENGTH
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import com.leonardobarreiras.seatingmanagement.ui.utils.formatEventDate
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileDialog(viewModel: SeatViewModel, onDismiss: () -> Unit) {
    var oldPass by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var isChanging by remember { mutableStateOf(false) }
    var errorMsg by remember { mutableStateOf("") }

    var isConfiguringPin by remember { mutableStateOf(false) }
    var newPin by remember { mutableStateOf("") }
    var hasPinConfigured by remember { mutableStateOf(viewModel.secureStorage.hasPin()) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(32.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp), modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                Row(modifier = Modifier.fillMaxWidth().background(BrandGradientSoft).padding(horizontal = 20.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(44.dp).background(BrandGradient, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Person, contentDescription = null, tint = Color.White) }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text("O Meu Perfil", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = CorporateBlue)
                            Text(viewModel.managerName, fontSize = 13.sp, color = TextGray)
                        }
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(36.dp).background(Color.White, CircleShape).border(1.dp, BorderSoft, CircleShape)) {
                        Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = TextGray, modifier = Modifier.size(18.dp))
                    }
                }

                HorizontalDivider(color = BorderSoft)

                Column(modifier = Modifier.padding(24.dp).fillMaxWidth()) {
                    Text("Alterar Palavra-passe", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = CorporateBlue, modifier = Modifier.padding(bottom = 12.dp))

                    OutlinedTextField(
                        value = oldPass, onValueChange = { oldPass = it; errorMsg = "" }, label = { Text("Palavra-passe atual", fontSize = 13.sp) },
                        visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple, unfocusedBorderColor = BorderSoft, focusedLabelColor = AccentPurple)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    // Aviso permanente do mínimo de caracteres (criar/alterar palavra-passe)
                    PasswordRulesHint(currentValue = newPass)
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = newPass, onValueChange = { newPass = it; errorMsg = "" }, label = { Text("Nova palavra-passe", fontSize = 13.sp) },
                        visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple, unfocusedBorderColor = BorderSoft, focusedLabelColor = AccentPurple)
                    )

                    if (errorMsg.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(errorMsg, color = ErrorRed, fontSize = 12.sp, modifier = Modifier.fillMaxWidth())
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            if (oldPass.isEmpty() || newPass.isEmpty()) {
                                errorMsg = "Preenche todos os campos."
                                return@Button
                            }

                            // 👇 Adicionada a restrição de segurança de 6 caracteres 👇
                            if (newPass.length < MIN_PASSWORD_LENGTH) {
                                errorMsg = "A palavra-passe tem de ter no mínimo $MIN_PASSWORD_LENGTH caracteres."
                                return@Button
                            }

                            isChanging = true
                            viewModel.changePassword(
                                oldPass = oldPass,
                                newPass = newPass,
                                onSuccess = { onDismiss(); isChanging = false },
                                onError = { errorMsg = it; isChanging = false }
                            )
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
                    ) {
                        if (isChanging) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Text("Guardar Alteração", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                    HorizontalDivider(color = BorderSoft)
                    Spacer(modifier = Modifier.height(24.dp))

                    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text(if (hasPinConfigured) "Alterar Código PIN" else "Configurar PIN de Acesso", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = CorporateBlue)
                        if (hasPinConfigured) {
                            Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = SuccessGreen, modifier = Modifier.size(18.dp))
                        }
                    }

                    if (isConfiguringPin) {
                        BasicTextField(
                            value = newPin, onValueChange = { if (it.length <= 4 && it.all { char -> char.isDigit() }) newPin = it },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                            decorationBox = {
                                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    repeat(4) { index ->
                                        val isFilled = index < newPin.length
                                        Box(
                                            modifier = Modifier.weight(1f).aspectRatio(1f).background(Color(0xFFF1F5F9), RoundedCornerShape(12.dp)).border(2.dp, if (isFilled) AccentPurple else Color.Transparent, RoundedCornerShape(12.dp)),
                                            contentAlignment = Alignment.Center
                                        ) { if (isFilled) { Box(modifier = Modifier.size(12.dp).background(CorporateBlue, CircleShape)) } }
                                    }
                                }
                            }
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { isConfiguringPin = false; newPin = "" }, modifier = Modifier.weight(1f).height(40.dp), shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, BorderSoft)) { Text("Cancelar", color = TextGray) }
                            Button(
                                onClick = { viewModel.secureStorage.savePin(newPin); hasPinConfigured = true; isConfiguringPin = false; newPin = "" },
                                enabled = newPin.length == 4, modifier = Modifier.weight(1f).height(40.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
                            ) { Text("Gravar PIN") }
                        }
                    } else {
                        Button(
                            onClick = { isConfiguringPin = true },
                            modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurpleLight, contentColor = AccentPurple)
                        ) {
                            Icon(Icons.Rounded.Dialpad, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(if (hasPinConfigured) "Redefinir PIN" else "Ativar Acesso por PIN", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                    HorizontalDivider(color = BorderSoft)
                    Spacer(modifier = Modifier.height(24.dp))

                    OutlinedButton(
                        onClick = { onDismiss(); viewModel.forceLogoutEvent = true },
                        modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, ErrorRedLight), colors = ButtonDefaults.outlinedButtonColors(contentColor = ErrorRed)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = "Terminar Sessão", modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Terminar Sessão", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}

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

    Box(modifier = Modifier.fillMaxSize().background(LightBg)) {
        // Cabeçalho com gradiente e círculos decorativos
        Box(modifier = Modifier.fillMaxWidth().height(260.dp).background(DarkHeroGradient)) {
            Box(modifier = Modifier.align(Alignment.TopEnd).offset(x = 70.dp, y = (-50).dp).size(240.dp).background(AccentPurple.copy(alpha = 0.35f), CircleShape))
            Box(modifier = Modifier.align(Alignment.BottomStart).offset(x = (-60).dp, y = 50.dp).size(180.dp).background(PrimaryBlue.copy(alpha = 0.3f), CircleShape))
        }

        Column(modifier = Modifier.fillMaxSize()) {
            Row(modifier = Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp), horizontalArrangement = Arrangement.End) {
                IconButton(
                    onClick = { showProfileDialog = true },
                    modifier = Modifier.size(44.dp).background(Color.White.copy(alpha = 0.16f), CircleShape).border(1.dp, Color.White.copy(alpha = 0.3f), CircleShape)
                ) { Icon(Icons.Rounded.Person, contentDescription = "Perfil", tint = Color.White) }
            }

            // Ordem pedida: 1) logo  2) nome da empresa  3) boas-vindas com nome  4) eventos associados
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp)) {
                CompanyLogo(logo = viewModel.companyLogo, companyName = viewModel.companyName, size = 88.dp)
                Spacer(modifier = Modifier.height(14.dp))
                Text(viewModel.companyName, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Color.White, textAlign = TextAlign.Center, maxLines = 2)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    if (viewModel.managerName.isNotBlank()) "Olá, ${viewModel.managerName} 👋" else "Olá 👋",
                    fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Color.White.copy(alpha = 0.85f), textAlign = TextAlign.Center, maxLines = 1
                )
            }

            Spacer(modifier = Modifier.height(28.dp))

            Column(modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp)) {
                Text(if (isManager) "Painel de Gestão" else "Os Meus Eventos", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                Text("Eventos associados · seleciona um para começar", color = TextGray, fontSize = 13.sp, modifier = Modifier.padding(bottom = 16.dp))

                if (viewModel.isLoadingEvents && sortedEvents.isEmpty()) {
                    Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(color = AccentPurple)
                    }
                } else if (sortedEvents.isEmpty()) {
                    Card(
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(0.dp), border = BorderStroke(1.dp, BorderSoft), shape = RoundedCornerShape(28.dp)
                    ) {
                        Column(modifier = Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Box(modifier = Modifier.size(64.dp).background(AccentPurpleLight, RoundedCornerShape(20.dp)), contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.EventBusy, contentDescription = null, tint = AccentPurple, modifier = Modifier.size(32.dp))
                            }
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Sem Eventos Atribuídos", fontWeight = FontWeight.Bold, color = CorporateBlue, fontSize = 18.sp, textAlign = TextAlign.Center)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Não tens permissões ativas para aceder a nenhum evento neste momento.", color = TextGray, fontSize = 14.sp, textAlign = TextAlign.Center)
                        }
                    }
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        contentPadding = PaddingValues(bottom = 24.dp),
                        modifier = Modifier.fillMaxWidth().weight(1f)
                    ) {
                        items(sortedEvents, key = { it.id }) { event ->
                            Card(
                                onClick = { viewModel.processRoomCheckIn("EVENT:${event.id}") }, modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(0.dp),
                                border = BorderStroke(1.dp, BorderSoft), shape = RoundedCornerShape(24.dp)
                            ) {
                                Row(modifier = Modifier.padding(18.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                    Box(modifier = Modifier.size(52.dp).background(BrandGradient, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Event, contentDescription = null, tint = Color.White) }
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(event.name, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = CorporateBlue, maxLines = 2)
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
}
