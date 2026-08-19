package com.leonardobarreiras.seatingmanagement.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.HelpOutline
import androidx.compose.material.icons.automirrored.rounded.ListAlt
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.navigation.NavController
import com.leonardobarreiras.seatingmanagement.ui.components.*
import com.leonardobarreiras.seatingmanagement.ui.theme.*
import com.leonardobarreiras.seatingmanagement.ui.utils.getMesaFromSeat
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun SeatScreen(viewModel: SeatViewModel, navController: NavController) {
    val seats by viewModel.seatsFlow.collectAsState(initial = emptyList())
    val context = LocalContext.current

    var searchQuery by remember { mutableStateOf("") }
    var showFilters by remember { mutableStateOf(false) }
    var showActionsSheet by remember { mutableStateOf(false) }
    var showDataActionsSheet by remember { mutableStateOf(false) }
    var showSettingsSheet by remember { mutableStateOf(false) }
    var requireConfirmation by remember { mutableStateOf(true) }
    var seatToConfirmClick by remember { mutableStateOf<com.leonardobarreiras.seatingmanagement.data.SeatEntity?>(null) }

    var selectedTables by remember { mutableStateOf(setOf<String>()) }
    var selectedCategories by remember { mutableStateOf(setOf<String>()) }
    var selectedStatus by remember { mutableStateOf(setOf<String>()) }

    var pendingCsvUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var showCsvModeDialog by remember { mutableStateOf(false) }
    var confirmActionType by remember { mutableStateOf<String?>(null) }

    val activeFiltersCount = selectedTables.size + selectedCategories.size + selectedStatus.size

    var isProgressVisible by remember { mutableStateOf(true) }
    val nestedScrollConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(available: Offset, source: NestedScrollSource): Offset {
                if (available.y < -15) isProgressVisible = false
                if (available.y > 15) isProgressVisible = true
                return Offset.Zero
            }
        }
    }

    val totalSeats by remember(seats) { derivedStateOf { seats.size } }
    val treatedSeats by remember(seats) { derivedStateOf { seats.count { it.status != 0 } } }
    val pendingSeats by remember(totalSeats, treatedSeats) { derivedStateOf { totalSeats - treatedSeats } }
    val progress by remember(totalSeats, treatedSeats) { derivedStateOf { if (totalSeats > 0) treatedSeats.toFloat() / totalSeats else 0f } }

    val exportCsvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri ->
        if (uri != null) { viewModel.exportCsv(uri, context) }
    }

    val csvLauncher = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            if (seats.isNotEmpty()) {
                pendingCsvUri = uri
                showCsvModeDialog = true
            } else {
                viewModel.uploadCsvToServer(uri, context, "replace")
            }
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
                            IconButton(
                                onClick = { showActionsSheet = true },
                                modifier = Modifier.size(48.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.1f))
                            ) { Icon(imageVector = Icons.Rounded.Menu, contentDescription = "Menu", tint = Color.White, modifier = Modifier.size(22.dp)) }

                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(text = viewModel.companyName, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp, maxLines = 1)
                                    if (viewModel.isOffline) {
                                        Spacer(modifier = Modifier.width(6.dp))
                                        Box(modifier = Modifier.background(ErrorRed, RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp)) {
                                            Text("OFFLINE", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                                        }
                                    }
                                }
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(text = currentEventName, color = Color(0xFF94A3B8), fontSize = 12.sp, fontWeight = FontWeight.Medium, maxLines = 1)
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

                AnimatedVisibility(
                    visible = isProgressVisible,
                    enter = expandVertically(expandFrom = Alignment.Top),
                    exit = shrinkVertically(shrinkTowards = Alignment.Top)
                ) {
                    Card(
                        shape = RoundedCornerShape(24.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(2.dp), modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
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
                }

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
                                if (searchQuery.isEmpty()) { Text("Pesquisar por nome, mesa...", fontSize = 14.sp, color = Color.Gray) }
                                innerTextField()
                            },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Box(modifier = Modifier.size(48.dp)) {
                        IconButton(
                            onClick = { showFilters = !showFilters },
                            modifier = Modifier.fillMaxSize().background(if (showFilters) AccentPurple else Color.White, RoundedCornerShape(16.dp))
                        ) { Icon(Icons.Rounded.Tune, contentDescription = "Filtros", tint = if (showFilters) Color.White else TextGray) }
                        if (activeFiltersCount > 0) {
                            Box(
                                modifier = Modifier.align(Alignment.BottomEnd).padding(bottom = 6.dp, end = 6.dp).size(16.dp).background(ErrorRed, CircleShape),
                                contentAlignment = Alignment.Center
                            ) { Text(text = activeFiltersCount.toString(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center) }
                        }
                    }
                }

                val mesasUnicas by remember(seats) { derivedStateOf { seats.map { getMesaFromSeat(it.seatNumber) }.distinct().sorted() } }
                val categoriasUnicas by remember(seats) { derivedStateOf { seats.map { it.eventName }.distinct().filter { it.isNotBlank() }.sorted() } }

                val filteredSeats by remember(seats, searchQuery, selectedTables, selectedStatus, selectedCategories) {
                    derivedStateOf {
                        seats.filter { seat ->
                            val matchesSearch = seat.assignedTo?.contains(searchQuery, ignoreCase = true) == true || seat.seatNumber.contains(searchQuery, ignoreCase = true) || seat.eventName.contains(searchQuery, ignoreCase = true)
                            val matchesTable = if (selectedTables.isEmpty()) true else selectedTables.contains(getMesaFromSeat(seat.seatNumber))
                            val matchesCategory = if (selectedCategories.isEmpty()) true else selectedCategories.contains(seat.eventName)
                            val matchesStatus = if (selectedStatus.isEmpty()) true else { val seatStatusStr = if (seat.status != 0) "Tratados" else "Pendentes"; selectedStatus.contains(seatStatusStr) }
                            matchesSearch && matchesTable && matchesStatus && matchesCategory
                        }
                    }
                }

                AnimatedVisibility(
                    visible = showFilters,
                    modifier = if (showFilters) Modifier.weight(1f) else Modifier
                ) {
                    Column(
                        modifier = Modifier.fillMaxSize().padding(vertical = 12.dp).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Filtragem Avançada", fontSize = 16.sp, fontWeight = FontWeight.Black, color = CorporateBlue)
                            TextButton(
                                onClick = { selectedTables = emptySet(); selectedCategories = emptySet(); selectedStatus = emptySet() },
                                contentPadding = PaddingValues(0.dp), modifier = Modifier.height(24.dp)
                            ) { Text("Limpar Tudo", color = ErrorRed, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
                        }

                        PremiumFilterDropdown(label = "Selecionar Mesa", options = mesasUnicas, selectedOptions = selectedTables, onSelectionChange = { mesa -> selectedTables = if (selectedTables.contains(mesa)) selectedTables - mesa else selectedTables + mesa }, onClear = { selectedTables = emptySet() })
                        PremiumFilterDropdown(label = "Categoria de Convite", options = categoriasUnicas, selectedOptions = selectedCategories, onSelectionChange = { cat -> selectedCategories = if (selectedCategories.contains(cat)) selectedCategories - cat else selectedCategories + cat }, onClear = { selectedCategories = emptySet() })
                        PremiumFilterDropdown(label = "Estado da Validação", options = listOf("Tratados", "Pendentes"), selectedOptions = selectedStatus, onSelectionChange = { stat -> selectedStatus = if (selectedStatus.contains(stat)) selectedStatus - stat else selectedStatus + stat }, onClear = { selectedStatus = emptySet() })
                    }
                }

                AnimatedVisibility(
                    visible = !showFilters,
                    modifier = if (!showFilters) Modifier.weight(1f) else Modifier
                ) {
                    Column(modifier = Modifier.fillMaxSize().nestedScroll(nestedScrollConnection)) {
                        Spacer(modifier = Modifier.height(16.dp))

                        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("${filteredSeats.size} registos", color = CorporateBlue, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text("Toque para validar", color = Color.Gray, fontSize = 12.sp)
                        }

                        if (seats.isEmpty()) {
                            Column(modifier = Modifier.fillMaxWidth().weight(1f).padding(top = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(modifier = Modifier.size(96.dp).background(AccentPurpleLight, RoundedCornerShape(32.dp)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Description, contentDescription = null, tint = AccentPurple, modifier = Modifier.size(48.dp)) }
                                Spacer(modifier = Modifier.height(24.dp))
                                Text("Sem dados carregados", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = CorporateBlue)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Importe um ficheiro CSV com as colunas\nMESA;LUGAR;CATEGORIA;NOME\npara começar a gerir.", fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp)
                                Spacer(modifier = Modifier.height(32.dp))

                                if (viewModel.userRole == "Gestor" || viewModel.userRole == "SuperAdmin") {
                                    Button(
                                        onClick = { csvLauncher.launch("*/*") },
                                        modifier = Modifier.fillMaxWidth(0.8f).height(52.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
                                    ) {
                                        Icon(Icons.Rounded.Upload, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Importar Ficheiro", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                                    }
                                }
                            }
                        } else {
                            LazyColumn(modifier = Modifier.fillMaxWidth().weight(1f), contentPadding = PaddingValues(bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                items(items = filteredSeats, key = { seat -> seat.id }) { seat ->
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
            }
        }

        if (seatToConfirmClick != null) {
            val novoEstado = if (seatToConfirmClick!!.status == 0) 1 else 0
            val acao = if (novoEstado == 1) "ATRIBUIR entrada a" else "REMOVER entrada de"
            val nomeConvidado = seatToConfirmClick!!.assignedTo ?: "Convite Sem Nome"
            ModernAlertDialog(
                title = "Confirmação", message = "Queres $acao $nomeConvidado?", icon = Icons.AutoMirrored.Rounded.HelpOutline, iconTint = CorporateBlue, iconBg = Color(0xFFF1F5F9),
                onConfirm = { viewModel.updateSeatStatus(seatToConfirmClick!!, novoEstado); seatToConfirmClick = null }, onDismiss = { seatToConfirmClick = null }
            )
        }

        if (showCsvModeDialog && pendingCsvUri != null) {
            ModernAlertDialog(
                title = "Atenção: Sala Ocupada", message = "Esta sala já possui $totalSeats convidados. Queres SUBSTITUIR a lista apagando tudo, ou ADICIONAR à lista?",
                icon = Icons.Rounded.Warning, iconTint = ErrorRed, iconBg = ErrorRedLight, confirmText = "Substituir", confirmColor = ErrorRed, cancelText = "Adicionar",
                onConfirm = { viewModel.uploadCsvToServer(pendingCsvUri!!, context, "replace"); showCsvModeDialog = false }, onDismiss = { viewModel.uploadCsvToServer(pendingCsvUri!!, context, "append"); showCsvModeDialog = false; pendingCsvUri = null }
            )
        }

        if (confirmActionType != null) {
            val title = when (confirmActionType) { "MARK_ALL" -> "Validar Todos"; "UNMARK_ALL" -> "Desmarcar Todos"; "CLEAR" -> "Limpar Base de Dados"; else -> "" }
            val msg = when (confirmActionType) { "MARK_ALL" -> "Isto marcará $pendingSeats pendentes como Tratados."; "UNMARK_ALL" -> "Vais remover a validação de $treatedSeats convidados."; "CLEAR" -> "Atenção: Esta ação é irreversível. Vais apagar permanentemente todos os convidados e lugares deste evento na base de dados central."; else -> "" }
            val btnColor = if (confirmActionType == "MARK_ALL") SuccessGreen else ErrorRed
            val icon = if (confirmActionType == "MARK_ALL") Icons.Rounded.CheckCircle else Icons.Rounded.Warning
            val bg = if (confirmActionType == "MARK_ALL") SuccessGreenLight else ErrorRedLight

            ModernAlertDialog(
                title = title, message = msg, icon = icon, iconTint = btnColor, iconBg = bg, confirmText = "Confirmar", confirmColor = btnColor,
                onConfirm = {
                    when (confirmActionType) { "MARK_ALL" -> viewModel.bulkUpdateStatus("Tratado"); "UNMARK_ALL" -> viewModel.bulkUpdateStatus("Vazio"); "CLEAR" -> viewModel.clearEventData() }
                    confirmActionType = null
                }, onDismiss = { confirmActionType = null }
            )
        }

        if (viewModel.appFeedback != null) { AppFeedbackDialog(feedback = viewModel.appFeedback!!) { viewModel.clearFeedback() } }

        if (viewModel.showValidationScreen) {
            val exportErrorsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri -> if (uri != null) viewModel.exportErrorsCsv(uri, context) }

            Dialog(onDismissRequest = { viewModel.showValidationScreen = false }, properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)) {
                Surface(modifier = Modifier.fillMaxSize(), color = LightBg) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        Row(modifier = Modifier.fillMaxWidth().background(Color.White).padding(horizontal = 8.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { viewModel.showValidationScreen = false }) { Icon(Icons.Rounded.Close, contentDescription = "Fechar") }
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Relatório de Importação", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = CorporateBlue)
                        }

                        Column(modifier = Modifier.padding(16.dp).weight(1f)) {
                            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = ErrorRedLight), shape = RoundedCornerShape(16.dp)) {
                                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.Warning, contentDescription = null, tint = ErrorRed, modifier = Modifier.size(32.dp))
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text("Ficheiro Recusado", fontWeight = FontWeight.Bold, color = ErrorRed)
                                        Text("${viewModel.validationErrorsList.size} erros em ${viewModel.totalValidationRows} linhas", color = ErrorRed, fontSize = 14.sp)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            val grouped = viewModel.validationErrorsList.groupBy { it.actualErrorType }

                            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                items(grouped.entries.toList()) { entry ->
                                    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(2.dp), shape = RoundedCornerShape(16.dp)) {
                                        Column(modifier = Modifier.padding(16.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(modifier = Modifier.size(8.dp).background(ErrorRed, CircleShape))
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(entry.key, fontWeight = FontWeight.Bold, color = CorporateBlue, fontSize = 15.sp)
                                            }
                                            Text("${entry.value.size} ocorrências", color = TextGray, fontSize = 12.sp, modifier = Modifier.padding(start = 16.dp, top = 2.dp))
                                            Spacer(modifier = Modifier.height(12.dp))
                                            val linhas = entry.value.joinToString(", ") { if(it.actualLine == 0) "Geral" else it.actualLine.toString() }
                                            Text("Linhas: $linhas", color = Color.Gray, fontSize = 13.sp, lineHeight = 20.sp)
                                        }
                                    }
                                }
                            }
                        }

                        Box(modifier = Modifier.fillMaxWidth().background(Color.White).padding(16.dp)) {
                            Button(
                                onClick = { exportErrorsLauncher.launch("Relatorio_Erros_Importacao.csv") },
                                modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = CorporateBlue)
                            ) {
                                Icon(Icons.Rounded.Download, contentDescription = null, tint = Color.White)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Exportar Relatório CSV", fontWeight = FontWeight.Bold, color = Color.White)
                            }
                        }
                    }
                }
            }
        }

        if (showActionsSheet) {
            ModalBottomSheet(onDismissRequest = { showActionsSheet = false }, containerColor = Color.White) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    Text("Menu de Ações", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = CorporateBlue, modifier = Modifier.padding(bottom = 24.dp))

                    BottomSheetItem(icon = Icons.Rounded.SwapHoriz, title = "Mudar de Evento", subtitle = "Voltar à lista de eventos atribuídos", iconColor = PrimaryBlue, iconBg = Color(0xFFEFF6FF)) {
                        showActionsSheet = false; viewModel.clearCurrentEvent(); navController.navigate("event_selection") { popUpTo("event_selection") { inclusive = true } }
                    }

                    if (viewModel.userRole == "Gestor" || viewModel.userRole == "SuperAdmin") {
                        BottomSheetItem(icon = Icons.AutoMirrored.Rounded.ListAlt, title = "Ações", subtitle = "Exportar, importar e gerir dados", iconColor = AccentPurple, iconBg = AccentPurpleLight) {
                            showActionsSheet = false; showDataActionsSheet = true
                        }
                    } else {
                        BottomSheetItem(icon = Icons.Rounded.Settings, title = "Configurações Marcação", subtitle = "Preferências da aplicação", iconColor = AccentPurple, iconBg = AccentPurpleLight) {
                            showActionsSheet = false; showSettingsSheet = true
                        }
                    }

                    BottomSheetItem(icon = Icons.AutoMirrored.Rounded.Logout, title = "Logout", subtitle = "Terminar sessão atual", iconColor = ErrorRed, iconBg = ErrorRedLight) {
                        showActionsSheet = false; viewModel.logout(); navController.navigate("login") { popUpTo(0) { inclusive = true } }
                    }

                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedButton(onClick = { showActionsSheet = false }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color(0xFFE2E8F0))) { Text("Cancelar", color = TextGray, fontWeight = FontWeight.Bold) }
                }
            }
        }

        if (showDataActionsSheet) {
            ModalBottomSheet(onDismissRequest = { showDataActionsSheet = false }, containerColor = Color.White) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    Text("Ações", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = CorporateBlue, modifier = Modifier.padding(bottom = 24.dp))

                    BottomSheetItem(icon = Icons.Rounded.Download, title = "Exportar CSV", subtitle = "$totalSeats registos com estado atual", iconColor = PrimaryBlue, iconBg = Color(0xFFEFF6FF)) { showDataActionsSheet = false; exportCsvLauncher.launch("Export_Evento_${viewModel.currentEventId ?: "0"}.csv") }
                    BottomSheetItem(icon = Icons.Rounded.Upload, title = "Importar Novo Ficheiro", subtitle = "Substituir ou adicionar dados", iconColor = SuccessGreen, iconBg = SuccessGreenLight) { showDataActionsSheet = false; csvLauncher.launch("*/*") }
                    BottomSheetItem(icon = Icons.Rounded.CheckCircle, title = "Marcar Todos como Tratados", subtitle = "$pendingSeats registos pendentes", iconColor = SuccessGreen, iconBg = SuccessGreenLight) { showDataActionsSheet = false; confirmActionType = "MARK_ALL" }
                    BottomSheetItem(icon = Icons.Rounded.Cancel, title = "Desmarcar Todos", subtitle = "$treatedSeats registos tratados", iconColor = TextGray, iconBg = Color(0xFFF1F5F9)) { showDataActionsSheet = false; confirmActionType = "UNMARK_ALL" }
                    BottomSheetItem(icon = Icons.Rounded.DeleteForever, title = "Limpar Base de Dados", subtitle = "Apagar permanentemente todos os dados", iconColor = ErrorRed, iconBg = ErrorRedLight) { showDataActionsSheet = false; confirmActionType = "CLEAR" }
                    BottomSheetItem(icon = Icons.Rounded.Settings, title = "Configurações Marcação", subtitle = "Preferências da aplicação", iconColor = AccentPurple, iconBg = AccentPurpleLight) { showDataActionsSheet = false; showSettingsSheet = true }

                    Spacer(modifier = Modifier.height(24.dp))
                    OutlinedButton(onClick = { showDataActionsSheet = false; showActionsSheet = true }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, Color(0xFFE2E8F0))) { Text("Voltar", color = TextGray, fontWeight = FontWeight.Bold) }
                }
            }
        }

        if (showSettingsSheet) {
            ModalBottomSheet(onDismissRequest = { showSettingsSheet = false }, containerColor = Color.White) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
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
                    Button(
                        onClick = { showSettingsSheet = false; if (viewModel.userRole == "Gestor" || viewModel.userRole == "SuperAdmin") { showDataActionsSheet = true } },
                        modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = AccentPurple)
                    ) { Text("Guardar e Fechar", fontWeight = FontWeight.Bold) }
                }
            }
        }
    }
}