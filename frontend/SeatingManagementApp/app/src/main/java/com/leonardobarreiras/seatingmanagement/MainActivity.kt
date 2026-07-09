package com.leonardobarreiras.seatingmanagement

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
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
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel
import kotlinx.coroutines.launch

val CorporateBlue = Color(0xFF1C2536)
val PrimaryBlue = Color(0xFF293950)
val SuccessGreen = Color(0xFF10B981)
val ErrorRed = Color(0xFFEF4444)
val LightBg = Color(0xFFF8FAFC)
val AccentPurple = Color(0xFF8B5CF6)

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
                        composable("dashboard") { SeatScreen(viewModel = sharedViewModel) }
                    }
                }
            }
        }
    }
}

fun getMesaFromSeat(seatNumber: String): String {
    val split = seatNumber.split("-")
    if (split.size > 1) return "Mesa ${split[0].trim()}"
    return "Mesa Geral"
}

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
                Box(modifier = Modifier.size(72.dp).background(CorporateBlue, RoundedCornerShape(18.dp)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Default.Lock, contentDescription = null, tint = Color.White, modifier = Modifier.size(36.dp))
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Seating Management", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                Text("Acesso Restrito", fontSize = 14.sp, color = Color.Gray)
                Spacer(modifier = Modifier.height(32.dp))
                OutlinedTextField(
                    value = username, onValueChange = { username = it }, label = { Text("Utilizador") },
                    leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = Color.Gray) },
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), singleLine = true
                )
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = password, onValueChange = { password = it }, label = { Text("Palavra-passe") },
                    leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Color.Gray) },
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), singleLine = true
                )
                if (viewModel.loginError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = viewModel.loginError!!, color = ErrorRed, fontSize = 12.sp)
                }
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = { isLoading = true; viewModel.authenticate(username, password) { isLoading = false; onLoginSuccess() } },
                    modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
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
    var manualEventId by remember { mutableStateOf("") }
    var localError by remember { mutableStateOf<String?>(null) }
    val roomScanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        if (result.contents != null) { viewModel.processRoomCheckIn(result.contents.trim()); if (viewModel.currentEventId != null) onEventSelected() }
    }
    LaunchedEffect(viewModel.currentEventId) { if (viewModel.currentEventId != null) onEventSelected() }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFFF1F5F9))) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {

            Box(modifier = Modifier.size(80.dp).background(Color.White, CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.QrCode, contentDescription = null, tint = AccentPurple, modifier = Modifier.size(40.dp))
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text("Configuração de Sala", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = CorporateBlue)
            Text("Sintoniza o dispositivo no evento", color = Color.Gray, modifier = Modifier.padding(bottom = 32.dp))

            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(2.dp), shape = RoundedCornerShape(16.dp)) {
                Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {

                    Button(
                        onClick = { val options = ScanOptions().apply { setDesiredBarcodeFormats(ScanOptions.QR_CODE); setPrompt("Aponta para o QR Code da Sala"); setBeepEnabled(true) }; roomScanLauncher.launch(options) },
                        modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = CorporateBlue)
                    ) {
                        Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(12.dp))
                        Text("Ler QR Code da Porta", fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFFE2E8F0))
                        Text(" OU MANUAL ", color = Color.Gray, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        HorizontalDivider(modifier = Modifier.weight(1f), color = Color(0xFFE2E8F0))
                    }
                    Spacer(modifier = Modifier.height(24.dp))

                    OutlinedTextField(
                        value = manualEventId, onValueChange = { manualEventId = it; localError = null },
                        label = { Text("ID do Evento (ex: 101)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp), singleLine = true, isError = localError != null,
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple)
                    )
                    if (localError != null) Text(text = localError!!, color = ErrorRed, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))

                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = { if (manualEventId.isNotBlank()) viewModel.processRoomCheckIn("EVENT:${manualEventId.trim()}") else localError = "Insere um ID." },
                        modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF64748B))
                    ) { Text("Aceder Manualmente", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}

@Composable
fun TicketFeedbackDialog(message: String, onDismiss: () -> Unit) {
    val isSuccess = message.contains("Sucesso", ignoreCase = true) || message.contains("✅")
    val icon = if (isSuccess) Icons.Default.CheckCircle else Icons.Default.Error
    val iconColor = if (isSuccess) SuccessGreen else ErrorRed
    val titleText = if (isSuccess) "Bilhete Válido!" else "Atenção!"

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(24.dp), modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(72.dp))
                Spacer(modifier = Modifier.height(16.dp))
                Text(titleText, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                Spacer(modifier = Modifier.height(8.dp))
                Text(message, fontSize = 16.sp, color = Color.DarkGray, textAlign = TextAlign.Center, lineHeight = 22.sp)
                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = onDismiss, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(12.dp), colors = ButtonDefaults.buttonColors(containerColor = CorporateBlue)
                ) { Text("CONTINUAR", fontWeight = FontWeight.Bold, fontSize = 14.sp) }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SeatScreen(viewModel: SeatViewModel) {
    val seats by viewModel.seatsFlow.collectAsState(initial = emptyList())
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    var searchQuery by remember { mutableStateOf("") }
    var showFilters by remember { mutableStateOf(false) }
    var showActionsSheet by remember { mutableStateOf(false) }
    var showPinDialog by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var requireConfirmation by remember { mutableStateOf(true) }
    var seatToConfirmClick by remember { mutableStateOf<SeatEntity?>(null) }

    var selectedTable by remember { mutableStateOf("Todas") }
    var selectedStatus by remember { mutableStateOf("Todos") }

    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        if (result.contents != null) viewModel.validateTicketFromQr(result.contents.trim())
    }

    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) { viewModel.importCsv(uri, context); showActionsSheet = false }
    }

    val totalSeats = seats.size
    val treatedSeats = seats.count { it.status != 0 }
    val pendingSeats = totalSeats - treatedSeats
    val progress = if (totalSeats > 0) treatedSeats.toFloat() / totalSeats else 0f

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Gestão de Entradas", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        Text("Evento: ${viewModel.currentEventId ?: "Nenhum"}", color = Color.LightGray, fontSize = 12.sp)
                    }
                },
                navigationIcon = { IconButton(onClick = { showPinDialog = true }) { Icon(Icons.Default.Lock, contentDescription = "Admin", tint = Color.White) } },
                actions = {
                    TextButton(onClick = { viewModel.fetchSeatsFromApi() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Sync", tint = Color.White)
                        Spacer(Modifier.width(4.dp))
                        Text("Sync DB", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CorporateBlue)
            )
        },
        bottomBar = {
            Box(modifier = Modifier.fillMaxWidth().background(Color.White).padding(16.dp)) {
                Button(
                    onClick = {
                        val options = ScanOptions().apply { setDesiredBarcodeFormats(ScanOptions.QR_CODE); setPrompt("Aponta para o Bilhete"); setBeepEnabled(true) }
                        scanLauncher.launch(options)
                    },
                    modifier = Modifier.fillMaxWidth().height(64.dp), shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = AccentPurple),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 8.dp)
                ) {
                    Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = Color.White, modifier = Modifier.size(28.dp))
                    Spacer(modifier = Modifier.width(12.dp))
                    Text("LER BILHETE (QR)", fontWeight = FontWeight.Bold, fontSize = 18.sp, letterSpacing = 1.sp)
                }
            }
        },
        containerColor = LightBg
    ) { paddingValues ->
        Column(modifier = Modifier.fillMaxSize().padding(paddingValues).padding(horizontal = 16.dp)) {

            Spacer(modifier = Modifier.height(16.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Progresso Geral", fontWeight = FontWeight.Bold, color = Color.DarkGray)
                Text("${(progress * 100).toInt()}%", fontWeight = FontWeight.Bold, color = Color.DarkGray)
            }
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 16.dp).height(8.dp).clip(RoundedCornerShape(4.dp)), color = SuccessGreen, trackColor = Color(0xFFE2E8F0))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard(modifier = Modifier.weight(1f), title = "Total", count = totalSeats, iconColor = AccentPurple, bgTint = Color(0xFFEEF2FF), icon = Icons.Default.Person)
                StatCard(modifier = Modifier.weight(1f), title = "Tratados", count = treatedSeats, iconColor = SuccessGreen, bgTint = Color(0xFFECFDF5), icon = Icons.Default.CheckCircle)
                StatCard(modifier = Modifier.weight(1f), title = "Pendentes", count = pendingSeats, iconColor = ErrorRed, bgTint = Color(0xFFFEF2F2), icon = Icons.Default.Info)
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = searchQuery, onValueChange = { searchQuery = it }, placeholder = { Text("Pesquisar pessoa, mesa...") },
                    leadingIcon = { Icon(Icons.Default.Search, tint = Color.Gray, contentDescription = null) },
                    modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(12.dp), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White, unfocusedBorderColor = Color(0xFFE2E8F0))
                )
                Spacer(modifier = Modifier.width(8.dp))
                IconButton(onClick = { showFilters = !showFilters }, modifier = Modifier.size(52.dp).background(Color.White, RoundedCornerShape(12.dp))) {
                    Icon(Icons.AutoMirrored.Filled.List, contentDescription = "Filtros", tint = AccentPurple)
                }
            }

            AnimatedVisibility(visible = showFilters) {
                Column(modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                    Text("MESA", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                    Spacer(modifier = Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChipCustom("Todas", selectedTable == "Todas") { selectedTable = "Todas" }
                        val mesasUnicas = seats.map { getMesaFromSeat(it.seatNumber) }.distinct().sorted()
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

            val filteredSeats = seats.filter { seat ->
                val matchesSearch = seat.assignedTo?.contains(searchQuery, ignoreCase = true) == true || seat.seatNumber.contains(searchQuery, ignoreCase = true) || seat.eventName.contains(searchQuery, ignoreCase = true)
                val matchesTable = if (selectedTable == "Todas") true else getMesaFromSeat(seat.seatNumber) == selectedTable
                val matchesStatus = when (selectedStatus) { "Tratados" -> seat.status != 0; "Pendentes" -> seat.status == 0; else -> true }
                matchesSearch && matchesTable && matchesStatus
            }

            Text("${filteredSeats.size} convidados", color = Color.Gray, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 8.dp))

            LazyColumn(contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(filteredSeats) { seat ->
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

    if (showPinDialog) {
        var pin by remember { mutableStateOf("") }
        var isError by remember { mutableStateOf(false) }

        Dialog(onDismissRequest = { showPinDialog = false }) {
            Card(shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(16.dp)) {
                Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(64.dp).background(Color(0xFFFEF2F2), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Default.Lock, contentDescription = "Admin", tint = ErrorRed, modifier = Modifier.size(32.dp)) }
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Área Restrita", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                    Text("Insere o PIN de Gestão", fontSize = 14.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedTextField(
                        value = pin, onValueChange = { pin = it; isError = false }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                        singleLine = true, shape = RoundedCornerShape(12.dp), isError = isError, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple)
                    )
                    if (isError) Text("PIN Incorreto", color = ErrorRed, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
                    Spacer(modifier = Modifier.height(32.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        TextButton(onClick = { showPinDialog = false }) { Text("Cancelar", color = Color.Gray) }
                        Button(onClick = { if (viewModel.verifyPin(pin)) { showPinDialog = false; showActionsSheet = true } else isError = true }, colors = ButtonDefaults.buttonColors(containerColor = CorporateBlue), shape = RoundedCornerShape(12.dp)) { Text("Desbloquear") }
                    }
                }
            }
        }
    }

    if (seatToConfirmClick != null) {
        val novoEstado = if (seatToConfirmClick!!.status == 0) 1 else 0
        val acao = if (novoEstado == 1) "ATRIBUIR entrada a" else "REMOVER entrada de"
        val nomeConvidado = seatToConfirmClick!!.assignedTo ?: "Convite Sem Nome"
        AlertDialog(
            onDismissRequest = { seatToConfirmClick = null }, title = { Text("Confirmação", fontWeight = FontWeight.Bold) }, text = { Text("Queres $acao $nomeConvidado?") },
            confirmButton = { Button(onClick = { viewModel.updateSeatStatus(seatToConfirmClick!!, novoEstado); seatToConfirmClick = null }, colors = ButtonDefaults.buttonColors(containerColor = CorporateBlue)) { Text("Confirmar") } },
            dismissButton = { TextButton(onClick = { seatToConfirmClick = null }) { Text("Cancelar", color = Color.Gray) } }
        )
    }

    if (viewModel.qrFeedbackMessage != null) {
        TicketFeedbackDialog(message = viewModel.qrFeedbackMessage!!) { viewModel.clearQrFeedback() }
    }

    if (showActionsSheet) {
        ModalBottomSheet(onDismissRequest = { showActionsSheet = false }, containerColor = Color.White, windowInsets = WindowInsets.navigationBars) {
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 16.dp)) {
                Text("Gestão de Dados", fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 16.dp))

                BottomSheetItem(icon = Icons.Default.Add, title = "Importar Novo Ficheiro", subtitle = "Substituir dados locais com CSV", iconTint = SuccessGreen) { csvLauncher.launch("*/*") }
                BottomSheetItem(icon = Icons.Default.Check, title = "Marcar Todos como Tratados", subtitle = "$pendingSeats registos pendentes", iconTint = Color.Gray) { coroutineScope.launch { seats.filter { it.status == 0 }.forEach { viewModel.updateSeatStatus(it, 1) } }; showActionsSheet = false }
                BottomSheetItem(icon = Icons.Default.Clear, title = "Desmarcar Todos", subtitle = "$treatedSeats registos tratados", iconTint = Color.Gray) { coroutineScope.launch { seats.filter { it.status != 0 }.forEach { viewModel.updateSeatStatus(it, 0) } }; showActionsSheet = false }
                BottomSheetItem(icon = Icons.Default.Delete, title = "Limpar Dados", subtitle = "Eliminar todos os registos do telemóvel", iconTint = ErrorRed) { viewModel.clearAllData(); showActionsSheet = false }
                BottomSheetItem(icon = Icons.Default.Settings, title = "Configurações Locais", subtitle = "Preferências da aplicação", iconTint = AccentPurple) { showActionsSheet = false; showSettingsSheet = true }

                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = { showActionsSheet = false }, modifier = Modifier.fillMaxWidth().height(50.dp), colors = ButtonDefaults.buttonColors(containerColor = LightBg, contentColor = Color.Black)) { Text("Fechar Menu", fontWeight = FontWeight.Bold) }
                Spacer(modifier = Modifier.navigationBarsPadding())
            }
        }
    }

    if (showSettingsSheet) {
        ModalBottomSheet(onDismissRequest = { showSettingsSheet = false }, containerColor = Color.White, windowInsets = WindowInsets.navigationBars) {
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).padding(bottom = 16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 16.dp)) {
                    Icon(Icons.Default.Settings, contentDescription = null, tint = AccentPurple)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Configurações", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                }
                Card(colors = CardDefaults.cardColors(containerColor = Color.White), border = BorderStroke(1.dp, Color(0xFFE2E8F0)), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Confirmar ao atribuir", fontWeight = FontWeight.Bold)
                            Text("Será apresentado um modal antes de alterar o estado na lista.", color = Color.Gray, fontSize = 12.sp, lineHeight = 16.sp)
                        }
                        Switch(checked = requireConfirmation, onCheckedChange = { requireConfirmation = it }, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = AccentPurple))
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
                Button(onClick = { showSettingsSheet = false }, modifier = Modifier.fillMaxWidth().height(50.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)) { Text("Guardar e Fechar", fontWeight = FontWeight.Bold) }
                Spacer(modifier = Modifier.navigationBarsPadding())
            }
        }
    }
}

@Composable
fun StatCard(modifier: Modifier = Modifier, title: String, count: Int, iconColor: Color, bgTint: Color, icon: ImageVector) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(2.dp), shape = RoundedCornerShape(16.dp)) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(44.dp).background(bgTint, CircleShape), contentAlignment = Alignment.Center) { Icon(icon, contentDescription = title, tint = iconColor, modifier = Modifier.size(24.dp)) }
            Spacer(modifier = Modifier.height(12.dp))
            Text(text = count.toString(), fontWeight = FontWeight.Bold, fontSize = 24.sp, color = iconColor)
            Text(text = title, fontSize = 13.sp, color = iconColor, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun BottomSheetItem(icon: ImageVector, title: String, subtitle: String, iconTint: Color, onClick: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(vertical = 12.dp, horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = title, tint = iconTint, modifier = Modifier.size(26.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = CorporateBlue)
            Text(subtitle, color = Color.Gray, fontSize = 12.sp)
        }
    }
}

@Composable
fun FilterChipCustom(text: String, isSelected: Boolean, onClick: () -> Unit) {
    val bgColor = if (isSelected) AccentPurple else Color.White
    val textColor = if (isSelected) Color.White else Color.DarkGray
    Box(modifier = Modifier.clip(RoundedCornerShape(16.dp)).background(bgColor).clickable { onClick() }.padding(horizontal = 16.dp, vertical = 8.dp)) {
        Text(text, color = textColor, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
fun GuestListItem(seat: SeatEntity, onAssignClick: () -> Unit) {
    val statusColor = if (seat.status != 0) SuccessGreen else ErrorRed
    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(defaultElevation = 2.dp), shape = RoundedCornerShape(16.dp)) {
        Row(modifier = Modifier.height(IntrinsicSize.Min)) {
            Box(modifier = Modifier.fillMaxHeight().width(6.dp).background(statusColor))
            Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                val name = seat.assignedTo ?: "Convite / Sem Nome"
                val initial = name.takeIf { it.isNotBlank() }?.take(1)?.uppercase() ?: "?"
                Box(modifier = Modifier.size(48.dp).background(LightBg, CircleShape), contentAlignment = Alignment.Center) { Text(initial, color = CorporateBlue, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(name, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = CorporateBlue)
                    Text("Lugar: ${seat.seatNumber}", fontSize = 13.sp, color = Color.Gray)
                    Spacer(modifier = Modifier.height(6.dp))
                    Box(modifier = Modifier.background(Color(0xFFE2E8F0), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp)) { Text(seat.eventName, color = PrimaryBlue, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                }
                Spacer(modifier = Modifier.width(8.dp))
                val isAssigned = seat.status != 0
                val buttonColor = if (!isAssigned) CorporateBlue else SuccessGreen
                val buttonText = if (!isAssigned) "ATRIBUIR" else "VALIDADO"
                Button(onClick = onAssignClick, colors = ButtonDefaults.buttonColors(containerColor = buttonColor), shape = RoundedCornerShape(8.dp), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 0.dp), modifier = Modifier.height(36.dp)) { Text(buttonText, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
}