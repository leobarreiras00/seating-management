package com.leonardobarreiras.seatingmanagement

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.viewmodel.AppFeedback
import com.leonardobarreiras.seatingmanagement.viewmodel.FeedbackType
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel
import java.text.SimpleDateFormat
import java.util.Locale

// Paleta de Cores Modernizada (Estilo Pastel/Liquid)
val CorporateBlue = Color(0xFF1E293B)
val LightBg = Color(0xFFF8FAFC)
val PrimaryBlue = Color(0xFF3B82F6)
val AccentPurple = Color(0xFFA855F7)
val AccentPurpleLight = Color(0xFFF3E8FF)
val SuccessGreen = Color(0xFF22C55E)
val SuccessGreenLight = Color(0xFFDCFCE7)
val ErrorRed = Color(0xFFEF4444)
val ErrorRedLight = Color(0xFFFEE2E2)
val OfflineGray = Color(0xFF94A3B8)
val TextGray = Color(0xFF64748B)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = CorporateBlue, secondary = SuccessGreen, background = LightBg)) {
                val navController = rememberNavController()
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val sharedViewModel: SeatViewModel = viewModel()
                    NavHost(navController = navController, startDestination = "login") {
                        composable("login") { LoginScreen(onLoginSuccess = { navController.navigate("event_selection") { popUpTo("login") { inclusive = true } } }, viewModel = sharedViewModel) }
                        composable("event_selection") { EventSelectionScreen(viewModel = sharedViewModel, onEventSelected = { navController.navigate("dashboard") { popUpTo("event_selection") { inclusive = true } } }) }
                        composable("dashboard") { SeatScreen(viewModel = sharedViewModel, navController = navController) }
                    }
                }
            }
        }
    }
}

fun getMesaFromSeat(seatNumber: String): String {
    val split = seatNumber.split("-")
    if (split.size > 1) return split[0].trim()
    return "Geral"
}

fun formatEventDate(dateString: String?): String {
    if (dateString.isNullOrEmpty() || dateString == "0001-01-01T00:00:00") return "Data a definir"
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("pt", "PT"))
        val date = inputFormat.parse(dateString.substringBefore("Z").substringBefore("."))
        if (date != null) outputFormat.format(date) else "Data a definir"
    } catch (e: Exception) {
        "Data a definir"
    }
}

// ==========================================
// COMPONENTES UI MODERNIZADOS (SQUIRCLES & LIQUID)
// ==========================================

@Composable
fun ModernAlertDialog(
    title: String,
    message: String,
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    confirmText: String = "Confirmar",
    cancelText: String? = "Cancelar",
    confirmColor: Color = AccentPurple,
    content: @Composable (() -> Unit)? = null,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(32.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier.size(64.dp).background(iconBg, RoundedCornerShape(20.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(32.dp))
                }

                Spacer(modifier = Modifier.height(20.dp))
                Text(title, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(8.dp))
                Text(message, fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp)

                if (content != null) {
                    Spacer(modifier = Modifier.height(16.dp))
                    content()
                }

                Spacer(modifier = Modifier.height(24.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (cancelText != null) {
                        OutlinedButton(
                            onClick = onDismiss, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(16.dp),
                            border = BorderStroke(1.dp, Color(0xFFE2E8F0)), colors = ButtonDefaults.outlinedButtonColors(contentColor = TextGray),
                            contentPadding = PaddingValues(horizontal = 4.dp)
                        ) { Text(cancelText, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1) }
                    }
                    Button(
                        onClick = onConfirm, modifier = Modifier.weight(1f).height(48.dp), shape = RoundedCornerShape(16.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = confirmColor),
                        contentPadding = PaddingValues(horizontal = 4.dp)
                    ) { Text(confirmText, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1) }
                }
            }
        }
    }
}

@Composable
fun AppFeedbackDialog(feedback: AppFeedback, onDismiss: () -> Unit) {
    val icon = when (feedback.type) {
        FeedbackType.SUCCESS -> Icons.Rounded.CheckCircle
        FeedbackType.ERROR -> Icons.Rounded.Warning
        FeedbackType.EXPORT -> Icons.Rounded.Download
        FeedbackType.INFO -> Icons.Rounded.Info
        FeedbackType.OFFLINE -> Icons.Rounded.CloudOff
    }
    val iconColor = when (feedback.type) {
        FeedbackType.SUCCESS -> SuccessGreen
        FeedbackType.ERROR -> ErrorRed
        FeedbackType.EXPORT -> PrimaryBlue
        FeedbackType.INFO -> AccentPurple
        FeedbackType.OFFLINE -> OfflineGray
    }
    val iconBg = when (feedback.type) {
        FeedbackType.SUCCESS -> SuccessGreenLight
        FeedbackType.ERROR -> ErrorRedLight
        FeedbackType.EXPORT -> Color(0xFFEFF6FF)
        FeedbackType.INFO -> AccentPurpleLight
        FeedbackType.OFFLINE -> Color(0xFFF1F5F9)
    }

    ModernAlertDialog(
        title = feedback.title, message = feedback.message, icon = icon, iconTint = iconColor, iconBg = iconBg,
        confirmText = "Continuar", cancelText = null, confirmColor = iconColor, onConfirm = onDismiss, onDismiss = onDismiss
    )
}

// ==========================================
// ECRÃS PRINCIPAIS
// ==========================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, viewModel: SeatViewModel) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth().background(CorporateBlue))
            Box(modifier = Modifier.weight(1.5f).fillMaxWidth().background(LightBg))
        }
        Card(
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 24.dp).fillMaxWidth(),
            shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(12.dp)
        ) {
            Column(modifier = Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {

                Image(
                    painter = painterResource(id = R.drawable.seatly_icon),
                    contentDescription = "Seatly Logo",
                    modifier = Modifier.height(72.dp).clip(RoundedCornerShape(16.dp))
                )

                Spacer(modifier = Modifier.height(16.dp))
                Text("Seatly", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                Text("Acesso Restrito", fontSize = 14.sp, color = TextGray)
                Spacer(modifier = Modifier.height(32.dp))

                OutlinedTextField(
                    value = username, onValueChange = { username = it }, label = { Text("Utilizador") },
                    leadingIcon = { Icon(Icons.Rounded.Person, contentDescription = null, tint = Color.Gray) },
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple)
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = password, onValueChange = { password = it }, label = { Text("Palavra-passe") },
                    leadingIcon = { Icon(Icons.Rounded.Lock, contentDescription = null, tint = Color.Gray) },
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple)
                )
                if (viewModel.loginError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = viewModel.loginError!!, color = ErrorRed, fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = { isLoading = true; viewModel.authenticate(username, password) { isLoading = false; onLoginSuccess() } },
                    modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
                ) {
                    if (isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    else Text("ENTRAR", fontWeight = FontWeight.Bold, fontSize = 16.sp, letterSpacing = 1.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EventSelectionScreen(viewModel: SeatViewModel, onEventSelected: () -> Unit) {
    LaunchedEffect(viewModel.currentEventId) { if (viewModel.currentEventId != null) onEventSelected() }

    val context = LocalContext.current

    // 👇 CARREGADOR DE IMAGENS COM SUPORTE A SVG 👇
    val imageLoader = remember {
        ImageLoader.Builder(context)
            .components {
                add(SvgDecoder.Factory())
            }
            .build()
    }

    Box(modifier = Modifier.fillMaxSize().background(LightBg)) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {

            Spacer(modifier = Modifier.height(24.dp))

            // 👇 CARREGAMENTO DE IMAGEM DA WEB VIA COIL 👇
            if (viewModel.companyLogo.isNotEmpty()) {
                AsyncImage(
                    model = viewModel.companyLogo,
                    imageLoader = imageLoader,
                    contentDescription = "Logotipo da Empresa",
                    modifier = Modifier.height(72.dp).clip(RoundedCornerShape(20.dp)),
                    contentScale = androidx.compose.ui.layout.ContentScale.Fit,
                    placeholder = painterResource(id = R.drawable.seatly_icon), // Mostra enquanto carrega
                    error = painterResource(id = R.drawable.seatly_icon)        // Mostra se o link falhar ou for inválido
                )
            } else {
                Image(
                    painter = painterResource(id = R.drawable.seatly_icon),
                    contentDescription = "Seatly Logo",
                    modifier = Modifier.height(72.dp).clip(RoundedCornerShape(20.dp))
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
            Text(
                text = if (viewModel.userRole == "Gestor") "Painel de Gestão" else "Os Meus Eventos",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = CorporateBlue
            )
            Text(
                text = "Seleciona um evento para começar",
                color = TextGray,
                modifier = Modifier.padding(bottom = 32.dp)
            )

            if (viewModel.isLoadingEvents) {
                CircularProgressIndicator(color = AccentPurple, modifier = Modifier.padding(top = 40.dp))
            } else if (viewModel.myEvents.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(2.dp),
                    shape = RoundedCornerShape(24.dp)
                ) {
                    Column(modifier = Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Rounded.EventBusy, contentDescription = null, tint = OfflineGray, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Sem Eventos Atribuídos", fontWeight = FontWeight.Bold, color = CorporateBlue, fontSize = 18.sp, textAlign = TextAlign.Center)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Não tens permissões ativas para aceder a nenhum evento neste momento.", color = TextGray, fontSize = 14.sp, textAlign = TextAlign.Center)
                    }
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxWidth().weight(1f)
                ) {
                    items(viewModel.myEvents) { event ->
                        Card(
                            onClick = { viewModel.processRoomCheckIn("EVENT:${event.id}") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White),
                            elevation = CardDefaults.cardElevation(4.dp),
                            shape = RoundedCornerShape(20.dp)
                        ) {
                            Row(
                                modifier = Modifier.padding(20.dp).fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier.size(48.dp).background(AccentPurpleLight, RoundedCornerShape(12.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(Icons.Rounded.Event, contentDescription = null, tint = AccentPurple)
                                }
                                Spacer(modifier = Modifier.width(16.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(event.name, fontWeight = FontWeight.ExtraBold, fontSize = 18.sp, color = CorporateBlue)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(formatEventDate(event.startDate), color = TextGray, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                }
                                Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = Color(0xFFCBD5E1))
                            }
                        }
                    }
                }
            }
        }

        if (viewModel.appFeedback != null) {
            AppFeedbackDialog(feedback = viewModel.appFeedback!!) { viewModel.clearFeedback() }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SeatScreen(viewModel: SeatViewModel, navController: androidx.navigation.NavController) {
    val seats by viewModel.seatsFlow.collectAsState(initial = emptyList())
    val context = LocalContext.current

    var searchQuery by remember { mutableStateOf("") }
    var showFilters by remember { mutableStateOf(false) }
    var showActionsSheet by remember { mutableStateOf(false) }
    var showDataActionsSheet by remember { mutableStateOf(false) } // Sub-menu de Ações
    var showPinDialog by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var requireConfirmation by remember { mutableStateOf(true) }
    var seatToConfirmClick by remember { mutableStateOf<SeatEntity?>(null) }

    var selectedTable by remember { mutableStateOf("Todas") }
    var selectedStatus by remember { mutableStateOf("Todos") }

    var pendingCsvUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var showCsvModeDialog by remember { mutableStateOf(false) }
    var confirmActionType by remember { mutableStateOf<String?>(null) }
    var validatedAdminPin by remember { mutableStateOf("1234") }

    var pendingAdminAction by remember { mutableStateOf<(() -> Unit)?>(null) }

    val totalSeats by remember(seats) { derivedStateOf { seats.size } }
    val treatedSeats by remember(seats) { derivedStateOf { seats.count { it.status != 0 } } }
    val pendingSeats by remember(totalSeats, treatedSeats) { derivedStateOf { totalSeats - treatedSeats } }
    val progress by remember(totalSeats, treatedSeats) { derivedStateOf { if (totalSeats > 0) treatedSeats.toFloat() / totalSeats else 0f } }

    val exportCsvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) { viewModel.exportCsv(uri, context); showDataActionsSheet = false }
    }

    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            if (seats.isNotEmpty()) {
                pendingCsvUri = uri
                showCsvModeDialog = true
            } else {
                viewModel.uploadCsvToServer(uri, context, "replace")
            }
            showDataActionsSheet = false
        }
    }

    val currentEventName = remember(viewModel.currentEventId, viewModel.myEvents) {
        viewModel.myEvents.find { it.id == viewModel.currentEventId }?.name ?: "Nenhum"
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            topBar = {
                Surface(
                    color = Color.Transparent,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 8.dp)
                ) {
                    Card(
                        shape = RoundedCornerShape(24.dp),
                        colors = CardDefaults.cardColors(containerColor = CorporateBlue),
                        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            val isGestor = viewModel.userRole == "Gestor"

                            IconButton(
                                onClick = {
                                    if (isGestor) {
                                        showActionsSheet = true
                                    } else {
                                        if (viewModel.isPinTimeoutValid()) {
                                            showActionsSheet = true
                                        } else {
                                            pendingAdminAction = { showActionsSheet = true }
                                            showPinDialog = true
                                        }
                                    }
                                },
                                modifier = Modifier.size(48.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f))
                            ) {
                                Icon(
                                    imageVector = if (isGestor) Icons.Rounded.Menu else Icons.Rounded.Lock,
                                    contentDescription = if (isGestor) "Menu" else "Admin",
                                    tint = Color.White,
                                    modifier = Modifier.size(22.dp)
                                )
                            }

                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = viewModel.companyName,
                                        color = Color.White,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 0.5.sp,
                                        maxLines = 1
                                    )
                                    if (viewModel.isOffline) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Box(modifier = Modifier.background(ErrorRed, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                                            Text("OFFLINE", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = currentEventName,
                                    color = Color(0xFF94A3B8),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Medium,
                                    maxLines = 1
                                )
                            }

                            val syncAlpha = if (viewModel.isOffline) 0.05f else 0.15f
                            val syncColor = if (viewModel.isOffline) Color.Gray else Color.White

                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(Color.White.copy(alpha = syncAlpha))
                                    .clickable(enabled = !viewModel.isOffline) { viewModel.fetchSeatsFromApi() }
                                    .padding(horizontal = 14.dp, vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Rounded.Refresh, contentDescription = "Sync", tint = syncColor, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Sync", color = syncColor, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }
                        }
                    }
                }
            },
            containerColor = LightBg
        ) { paddingValues ->
            Column(modifier = Modifier.fillMaxSize().padding(paddingValues).padding(horizontal = 16.dp)) {

                Card(
                    shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(2.dp), modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Progresso", fontWeight = FontWeight.Bold, color = TextGray, fontSize = 14.sp)
                            Text("${(progress * 100).toInt()}%", fontWeight = FontWeight.Bold, color = CorporateBlue, fontSize = 14.sp)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                        LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)), color = SuccessGreen, trackColor = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(20.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            StatCard(modifier = Modifier.weight(1f), title = "Total", count = totalSeats, iconColor = AccentPurple, bgTint = AccentPurpleLight, icon = Icons.Rounded.Groups)
                            StatCard(modifier = Modifier.weight(1f), title = "Tratados", count = treatedSeats, iconColor = SuccessGreen, bgTint = SuccessGreenLight, icon = Icons.Rounded.CheckCircleOutline)
                            StatCard(modifier = Modifier.weight(1f), title = "Pendentes", count = pendingSeats, iconColor = ErrorRed, bgTint = ErrorRedLight, icon = Icons.Rounded.Schedule)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .background(Color.White, RoundedCornerShape(16.dp))
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Rounded.Search, tint = Color.Gray, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        BasicTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            singleLine = true,
                            textStyle = TextStyle(fontSize = 14.sp, color = CorporateBlue),
                            decorationBox = { innerTextField ->
                                if (searchQuery.isEmpty()) {
                                    Text("Pesquisar por nome, mesa...", fontSize = 14.sp, color = Color.Gray)
                                }
                                innerTextField()
                            },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(onClick = { showFilters = !showFilters }, modifier = Modifier.size(48.dp).background(Color.White, RoundedCornerShape(16.dp))) {
                        Icon(Icons.Rounded.Tune, contentDescription = "Filtros", tint = TextGray)
                    }
                }

                val mesasUnicas by remember(seats) {
                    derivedStateOf { seats.map { getMesaFromSeat(it.seatNumber) }.distinct().sorted() }
                }

                AnimatedVisibility(visible = showFilters) {
                    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                        Text("MESA", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                        Spacer(modifier = Modifier.height(8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FilterChipCustom("Todas", selectedTable == "Todas") { selectedTable = "Todas" }
                            mesasUnicas.forEach { mesa -> FilterChipCustom(mesa, selectedTable == mesa) { selectedTable = mesa } }
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("ESTADO", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("Todos", "Tratados", "Pendentes").forEach { status -> FilterChipCustom(status, selectedStatus == status) { selectedStatus = status } }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                val filteredSeats by remember(seats, searchQuery, selectedTable, selectedStatus) {
                    derivedStateOf {
                        seats.filter { seat ->
                            val matchesSearch = seat.assignedTo?.contains(searchQuery, ignoreCase = true) == true || seat.seatNumber.contains(searchQuery, ignoreCase = true) || seat.eventName.contains(searchQuery, ignoreCase = true)
                            val matchesTable = if (selectedTable == "Todas") true else getMesaFromSeat(seat.seatNumber) == selectedTable
                            val matchesStatus = when (selectedStatus) { "Tratados" -> seat.status != 0; "Pendentes" -> seat.status == 0; else -> true }
                            matchesSearch && matchesTable && matchesStatus
                        }
                    }
                }

                Row(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("${filteredSeats.size} registos", color = CorporateBlue, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Text("Toque para validar", color = Color.Gray, fontSize = 12.sp)
                }

                if (seats.isEmpty()) {
                    Column(modifier = Modifier.fillMaxSize().padding(top = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(modifier = Modifier.size(96.dp).background(AccentPurpleLight, RoundedCornerShape(32.dp)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.Description, contentDescription = null, tint = AccentPurple, modifier = Modifier.size(48.dp))
                        }
                        Spacer(modifier = Modifier.height(24.dp))
                        Text("Sem dados carregados", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Importe um ficheiro CSV com separador \";\"\npara começar a gerir os seus dados.", fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp)
                        Spacer(modifier = Modifier.height(32.dp))

                        Button(
                            onClick = {
                                val isGestor = viewModel.userRole == "Gestor"
                                if (isGestor) {
                                    csvLauncher.launch("*/*")
                                } else {
                                    if (viewModel.isPinTimeoutValid()) {
                                        csvLauncher.launch("*/*")
                                    } else {
                                        pendingAdminAction = { csvLauncher.launch("*/*") }
                                        showPinDialog = true
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(0.8f).height(52.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
                        ) {
                            Icon(Icons.Rounded.Upload, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Importar Ficheiro", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                    }
                } else {
                    LazyColumn(contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(
                            items = filteredSeats,
                            key = { seat -> seat.id }
                        ) { seat ->
                            GuestListItem(
                                seat = seat,
                                onAssignClick = {
                                    val novoEstado = if (seat.status == 0) 1 else 0
                                    if (requireConfirmation) seatToConfirmClick = seat else viewModel.updateSeatStatus(seat, novoEstado)
                                }
                            )
                        }
                    }
                }
            }
        }

        // ==========================================
        // DIALOGS & OVERLAYS DO ECRÃ SEATSCREEN
        // ==========================================

        @OptIn(ExperimentalMaterial3Api::class)
        if (showPinDialog) {
            var pin by remember { mutableStateOf("") }
            var isError by remember { mutableStateOf(false) }

            ModernAlertDialog(
                title = "Área Restrita",
                message = "Insere o PIN de Gestão para acederes às definições.",
                icon = Icons.Rounded.Lock,
                iconTint = CorporateBlue,
                iconBg = Color(0xFFF1F5F9),
                confirmText = "Desbloquear",
                confirmColor = CorporateBlue,
                content = {
                    OutlinedTextField(
                        value = pin,
                        onValueChange = { pin = it; isError = false },
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp),
                        isError = isError,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = AccentPurple,
                            unfocusedBorderColor = Color(0xFFE2E8F0)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (isError) {
                        Text("PIN Incorreto", color = ErrorRed, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp).fillMaxWidth(), textAlign = TextAlign.Start)
                    }
                },
                onConfirm = {
                    if (viewModel.verifyPin(pin)) {
                        validatedAdminPin = pin
                        viewModel.registerPinSuccess()
                        showPinDialog = false
                        pendingAdminAction?.invoke()
                        pendingAdminAction = null
                    } else {
                        isError = true
                    }
                },
                onDismiss = {
                    showPinDialog = false
                    pendingAdminAction = null
                }
            )
        }

        if (seatToConfirmClick != null) {
            val novoEstado = if (seatToConfirmClick!!.status == 0) 1 else 0
            val acao = if (novoEstado == 1) "ATRIBUIR entrada a" else "REMOVER entrada de"
            val nomeConvidado = seatToConfirmClick!!.assignedTo ?: "Convite Sem Nome"
            ModernAlertDialog(
                title = "Confirmação", message = "Queres $acao $nomeConvidado?",
                icon = Icons.Rounded.HelpOutline, iconTint = CorporateBlue, iconBg = Color(0xFFF1F5F9),
                onConfirm = { viewModel.updateSeatStatus(seatToConfirmClick!!, novoEstado); seatToConfirmClick = null },
                onDismiss = { seatToConfirmClick = null }
            )
        }

        if (showCsvModeDialog && pendingCsvUri != null) {
            ModernAlertDialog(
                title = "Atenção: Sala Ocupada", message = "Esta sala já possui $totalSeats convidados. Queres SUBSTITUIR a lista apagando tudo, ou ADICIONAR à lista?",
                icon = Icons.Rounded.Warning, iconTint = ErrorRed, iconBg = ErrorRedLight,
                confirmText = "Substituir", confirmColor = ErrorRed,
                onConfirm = { viewModel.uploadCsvToServer(pendingCsvUri!!, context, "replace"); showCsvModeDialog = false },
                onDismiss = { viewModel.uploadCsvToServer(pendingCsvUri!!, context, "append"); showCsvModeDialog = false; pendingCsvUri = null },
                cancelText = "Adicionar"
            )
        }

        if (confirmActionType != null) {
            val title = when (confirmActionType) {
                "MARK_ALL" -> "Validar Todos"
                "UNMARK_ALL" -> "Desmarcar Todos"
                "CLEAR" -> "Limpar Ecrã"
                else -> ""
            }
            val msg = when (confirmActionType) {
                "MARK_ALL" -> "Isto marcará $pendingSeats pendentes como Tratados."
                "UNMARK_ALL" -> "Vais remover a validação de $treatedSeats convidados."
                "CLEAR" -> "Isto vai limpar o ecrã. Usa o Sync para recuperar os dados."
                else -> ""
            }

            val btnColor = if (confirmActionType == "MARK_ALL") SuccessGreen else ErrorRed
            val icon = if (confirmActionType == "MARK_ALL") Icons.Rounded.CheckCircle else Icons.Rounded.Warning
            val bg = if (confirmActionType == "MARK_ALL") SuccessGreenLight else ErrorRedLight

            ModernAlertDialog(
                title = title, message = msg, icon = icon, iconTint = btnColor, iconBg = bg, confirmText = "Confirmar", confirmColor = btnColor,
                onConfirm = {
                    when (confirmActionType) {
                        "MARK_ALL" -> viewModel.bulkUpdateStatus("Tratado")
                        "UNMARK_ALL" -> viewModel.bulkUpdateStatus("Vazio")
                        "CLEAR" -> viewModel.clearEventData(validatedAdminPin)
                    }
                    confirmActionType = null
                }, onDismiss = { confirmActionType = null }
            )
        }

        if (viewModel.appFeedback != null) {
            AppFeedbackDialog(feedback = viewModel.appFeedback!!) { viewModel.clearFeedback() }
        }

        // ==========================================
        // MENU DE AÇÕES SIMPLIFICADO (3 LINHAS)
        // ==========================================
        @OptIn(ExperimentalMaterial3Api::class)
        if (showActionsSheet) {
            ModalBottomSheet(onDismissRequest = { showActionsSheet = false }, containerColor = Color.White, windowInsets = WindowInsets.navigationBars) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).padding(bottom = 56.dp)) {
                    Text("Menu de Ações", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = CorporateBlue, modifier = Modifier.padding(bottom = 24.dp))

                    BottomSheetItem(
                        icon = Icons.Rounded.SwapHoriz,
                        title = "Mudar de Evento",
                        subtitle = "Voltar à lista de eventos atribuídos",
                        iconColor = PrimaryBlue,
                        iconBg = Color(0xFFEFF6FF)
                    ) {
                        showActionsSheet = false
                        viewModel.clearCurrentEvent()
                        navController.navigate("event_selection") {
                            popUpTo("event_selection") { inclusive = true }
                        }
                    }

                    BottomSheetItem(
                        icon = Icons.Rounded.ListAlt,
                        title = "Ações",
                        subtitle = "Exportar, importar e gerir dados",
                        iconColor = AccentPurple,
                        iconBg = AccentPurpleLight
                    ) {
                        showActionsSheet = false
                        showDataActionsSheet = true
                    }

                    BottomSheetItem(
                        icon = Icons.Rounded.Logout,
                        title = "Logout",
                        subtitle = "Terminar sessão atual",
                        iconColor = ErrorRed,
                        iconBg = ErrorRedLight
                    ) {
                        showActionsSheet = false
                        viewModel.logout()
                        navController.navigate("login") {
                            popUpTo(0) { inclusive = true }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedButton(onClick = { showActionsSheet = false }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color(0xFFE2E8F0))) { Text("Cancelar", color = TextGray, fontWeight = FontWeight.Bold) }
                    Spacer(modifier = Modifier.navigationBarsPadding())
                }
            }
        }

        // ==========================================
        // SUB-MENU DE AÇÕES DETALHADAS
        // ==========================================
        @OptIn(ExperimentalMaterial3Api::class)
        if (showDataActionsSheet) {
            ModalBottomSheet(onDismissRequest = { showDataActionsSheet = false }, containerColor = Color.White, windowInsets = WindowInsets.navigationBars) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).padding(bottom = 56.dp)) {
                    Text("Ações", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = CorporateBlue, modifier = Modifier.padding(bottom = 24.dp))

                    BottomSheetItem(icon = Icons.Rounded.Download, title = "Exportar CSV", subtitle = "$totalSeats registos com estado atual", iconColor = PrimaryBlue, iconBg = Color(0xFFEFF6FF)) { exportCsvLauncher.launch("Export_Evento_${viewModel.currentEventId ?: "0"}.csv") }
                    BottomSheetItem(icon = Icons.Rounded.Upload, title = "Importar Novo Ficheiro", subtitle = "Substituir ou adicionar dados", iconColor = SuccessGreen, iconBg = SuccessGreenLight) { csvLauncher.launch("*/*") }
                    BottomSheetItem(icon = Icons.Rounded.CheckCircle, title = "Marcar Todos como Tratados", subtitle = "$pendingSeats registos pendentes", iconColor = SuccessGreen, iconBg = SuccessGreenLight) { confirmActionType = "MARK_ALL"; showDataActionsSheet = false }
                    BottomSheetItem(icon = Icons.Rounded.Cancel, title = "Desmarcar Todos", subtitle = "$treatedSeats registos tratados", iconColor = TextGray, iconBg = Color(0xFFF1F5F9)) { confirmActionType = "UNMARK_ALL"; showDataActionsSheet = false }
                    BottomSheetItem(icon = Icons.Rounded.Delete, title = "Limpar Ecrã", subtitle = "Remover dados locais", iconColor = ErrorRed, iconBg = ErrorRedLight) { confirmActionType = "CLEAR"; showDataActionsSheet = false }
                    BottomSheetItem(icon = Icons.Rounded.Settings, title = "Configurações Marcação", subtitle = "Preferências da aplicação", iconColor = AccentPurple, iconBg = AccentPurpleLight) { showDataActionsSheet = false; showSettingsSheet = true }

                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedButton(onClick = { showDataActionsSheet = false; showActionsSheet = true }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color(0xFFE2E8F0))) { Text("Voltar", color = TextGray, fontWeight = FontWeight.Bold) }
                    Spacer(modifier = Modifier.navigationBarsPadding())
                }
            }
        }

        @OptIn(ExperimentalMaterial3Api::class)
        if (showSettingsSheet) {
            ModalBottomSheet(onDismissRequest = { showSettingsSheet = false }, containerColor = Color.White, windowInsets = WindowInsets.navigationBars) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).padding(bottom = 56.dp)) {
                    Text("Configurações Marcação", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = CorporateBlue, modifier = Modifier.padding(bottom = 24.dp))
                    Card(colors = CardDefaults.cardColors(containerColor = LightBg), border = BorderStroke(1.dp, Color(0xFFE2E8F0)), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
                        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Confirmar ao atribuir", fontWeight = FontWeight.Bold, color = CorporateBlue)
                                Text("Apresentar modal antes de alterar estado.", color = TextGray, fontSize = 12.sp, lineHeight = 16.sp)
                            }
                            Switch(checked = requireConfirmation, onCheckedChange = { requireConfirmation = it }, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = AccentPurple))
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(onClick = { showSettingsSheet = false; showDataActionsSheet = true }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)) { Text("Guardar e Fechar", fontWeight = FontWeight.Bold) }
                    Spacer(modifier = Modifier.navigationBarsPadding())
                }
            }
        }
    }
}

@Composable
fun StatCard(modifier: Modifier = Modifier, title: String, count: Int, iconColor: Color, bgTint: Color, icon: ImageVector) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(0.dp), border = BorderStroke(1.dp, Color(0xFFF1F5F9)), shape = RoundedCornerShape(20.dp)) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(40.dp).background(bgTint, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) { Icon(icon, contentDescription = title, tint = iconColor, modifier = Modifier.size(20.dp)) }
            Spacer(modifier = Modifier.height(12.dp))
            Text(text = count.toString(), fontWeight = FontWeight.Bold, fontSize = 22.sp, color = CorporateBlue)
            Text(text = title, fontSize = 12.sp, color = iconColor, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
fun BottomSheetItem(icon: ImageVector, title: String, subtitle: String, iconColor: Color, iconBg: Color, onClick: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(44.dp).background(iconBg, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = title, tint = iconColor, modifier = Modifier.size(22.dp))
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = CorporateBlue)
            Text(subtitle, color = TextGray, fontSize = 12.sp)
        }
        Icon(Icons.Rounded.ChevronRight, contentDescription = null, tint = Color(0xFFCBD5E1), modifier = Modifier.size(20.dp))
    }
}

@Composable
fun FilterChipCustom(text: String, isSelected: Boolean, onClick: () -> Unit) {
    val bgColor = if (isSelected) AccentPurple else Color.White
    val textColor = if (isSelected) Color.White else TextGray
    Box(modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(bgColor).clickable { onClick() }.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(text, color = textColor, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun GuestListItem(seat: SeatEntity, onAssignClick: () -> Unit) {
    val isAssigned = seat.status != 0
    val statusColor = if (isAssigned) SuccessGreen else ErrorRed

    Card(modifier = Modifier.fillMaxWidth().clickable { onAssignClick() }, colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp), shape = RoundedCornerShape(20.dp)) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            Box(modifier = Modifier.fillMaxHeight().width(6.dp).background(statusColor))

            Row(modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {

                Column(modifier = Modifier.weight(1f)) {
                    val name = seat.assignedTo ?: "Convite / Sem Nome"
                    Text(name, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = CorporateBlue)
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(modifier = Modifier.background(AccentPurpleLight, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp)) {
                        Text(seat.eventName, color = AccentPurple, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.GridView, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Mesa", fontSize = 12.sp, color = Color.Gray)
                        Text(" ${getMesaFromSeat(seat.seatNumber)}", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)

                        Spacer(modifier = Modifier.width(12.dp))
                        Icon(Icons.Rounded.Place, contentDescription = null, tint = Color.Gray, modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Lugar", fontSize = 12.sp, color = Color.Gray)
                        val lugarStr = seat.seatNumber.split("-").let { if (it.size > 1) it[1] else seat.seatNumber }
                        Text(" $lugarStr", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (isAssigned) {
                        Text("Validado", color = SuccessGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(end = 8.dp))
                    }
                    Box(
                        modifier = Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isAssigned) SuccessGreen else Color.Transparent)
                            .border(if (isAssigned) 0.dp else 2.dp, if (isAssigned) Color.Transparent else Color(0xFFE2E8F0), RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isAssigned) {
                            Icon(Icons.Rounded.Check, contentDescription = "Validado", tint = Color.White, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}