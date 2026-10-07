package com.leonardobarreiras.seatingmanagement.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.material.icons.rounded.Cancel
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CheckCircleOutline
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteForever
import androidx.compose.material.icons.rounded.Description
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.SearchOff
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SwapHoriz
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material.icons.rounded.Upload
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.navigation.NavController
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.ui.components.ActionTile
import com.leonardobarreiras.seatingmanagement.ui.components.CompanyLogo
import com.leonardobarreiras.seatingmanagement.ui.components.EmptyState
import com.leonardobarreiras.seatingmanagement.ui.components.FilterChipGroup
import com.leonardobarreiras.seatingmanagement.ui.components.GradientButton
import com.leonardobarreiras.seatingmanagement.ui.components.GuestListItem
import com.leonardobarreiras.seatingmanagement.ui.components.ModernAlertDialog
import com.leonardobarreiras.seatingmanagement.ui.components.StatCard
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurple
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurpleLight
import com.leonardobarreiras.seatingmanagement.ui.theme.BorderSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.CorporateBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.DarkHeroGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRed
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRedLight
import com.leonardobarreiras.seatingmanagement.ui.theme.LightBg
import com.leonardobarreiras.seatingmanagement.ui.theme.PrimaryBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.SuccessGreen
import com.leonardobarreiras.seatingmanagement.ui.theme.SuccessGreenLight
import com.leonardobarreiras.seatingmanagement.ui.theme.TextGray
import com.leonardobarreiras.seatingmanagement.ui.utils.getMesaFromSeat
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

/*
 * SeatScreen.kt
 * -------------
 * Dashboard do evento: barra superior, progresso, estatísticas, pesquisa, filtros e lista de convidados,
 * mais os menus de ações (importar/exportar/validar em massa) e os respetivos diálogos de confirmação.
 */

/** Entrada de um mosaico de ação nos menus em painel inferior. */
private data class ActionItem(
    val icon: ImageVector,
    val title: String,
    val subtitle: String,
    val iconColor: Color,
    val iconBg: Color,
    val onClick: () -> Unit
)

/** Distribui as ações em mosaicos de duas colunas, todos com a mesma altura por linha. */
@Composable
private fun ActionGrid(items: List<ActionItem>) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        items.chunked(2).forEach { pair ->
            Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                pair.forEach { item ->
                    ActionTile(
                        icon = item.icon, title = item.title, subtitle = item.subtitle, iconColor = item.iconColor, iconBg = item.iconBg,
                        modifier = Modifier.weight(1f).fillMaxHeight(), onClick = item.onClick
                    )
                }
                // Linha ímpar: mantém o último mosaico com a largura de uma coluna
                if (pair.size == 1) Spacer(modifier = Modifier.weight(1f))
            }
        }
    }
}

/** Chip de um filtro ativo, com "x" para o remover sem abrir o painel de filtros. */
@Composable
private fun ActiveFilterChip(label: String, onRemove: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier = Modifier.clip(shape).background(AccentPurpleLight, shape).clickable(onClick = onRemove).padding(start = 12.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = AccentPurple, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.defaultMinSize(minWidth = 0.dp))
        Spacer(modifier = Modifier.width(4.dp))
        Icon(Icons.Rounded.Close, contentDescription = "Remover filtro $label", tint = AccentPurple, modifier = Modifier.size(14.dp))
    }
}

/**
 * Ecrã principal do evento.
 *
 * Toda a lógica (atualização de lugares, importação/exportação CSV, validação em massa) vive no
 * [SeatViewModel]; aqui só há estado de interface (filtros, pesquisa, painéis abertos).
 */
@OptIn(ExperimentalMaterial3Api::class)
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
    var seatToConfirmClick by remember { mutableStateOf<SeatEntity?>(null) }

    var selectedTables by remember { mutableStateOf(setOf<String>()) }
    var selectedCategories by remember { mutableStateOf(setOf<String>()) }
    var selectedStatus by remember { mutableStateOf(setOf<String>()) }

    var pendingCsvUri by remember { mutableStateOf<android.net.Uri?>(null) }
    var showCsvModeDialog by remember { mutableStateOf(false) }
    var confirmActionType by remember { mutableStateOf<String?>(null) }

    val activeFiltersCount = selectedTables.size + selectedCategories.size + selectedStatus.size
    val isManager = viewModel.userRole == "Gestor" || viewModel.userRole == "SuperAdmin"

    // O cartão de progresso esconde-se ao descer a lista e volta ao subir
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

    // Opções dos filtros e lista já filtrada
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
                // --- Barra superior: menu | empresa + evento (alinhados à esquerda) | sincronizar ---
                val barShape = RoundedCornerShape(26.dp)
                Box(modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 8.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .shadow(12.dp, barShape, ambientColor = AccentPurple.copy(alpha = 0.3f), spotColor = AccentPurple.copy(alpha = 0.4f))
                            .clip(barShape)
                            .background(DarkHeroGradient)
                            .padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = { showActionsSheet = true },
                            modifier = Modifier.size(48.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.12f))
                        ) { Icon(imageVector = Icons.Rounded.Menu, contentDescription = "Menu", tint = Color.White, modifier = Modifier.size(22.dp)) }

                        // Alinhado à esquerda, com margem face ao menu hambúrguer e reticências se o texto for longo
                        Column(modifier = Modifier.weight(1f).padding(start = 14.dp, end = 8.dp), horizontalAlignment = Alignment.Start) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                                Text(
                                    text = viewModel.companyName, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold,
                                    maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Start, modifier = Modifier.weight(1f, fill = false)
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
                                text = currentEventName, color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp, fontWeight = FontWeight.Medium,
                                maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Start, modifier = Modifier.fillMaxWidth()
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
                            Icon(Icons.Rounded.Refresh, contentDescription = "Sincronizar", tint = syncColor, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Sync", color = syncColor, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            },
            containerColor = LightBg
        ) { paddingValues ->
            Column(modifier = Modifier.fillMaxSize().padding(paddingValues).padding(horizontal = 16.dp)) {

                // --- Progresso + estatísticas ---
                AnimatedVisibility(
                    visible = isProgressVisible,
                    enter = expandVertically(expandFrom = Alignment.Top),
                    exit = shrinkVertically(shrinkTowards = Alignment.Top)
                ) {
                    Card(
                        shape = RoundedCornerShape(28.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
                        elevation = CardDefaults.cardElevation(0.dp), border = BorderStroke(1.dp, BorderSoft), modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                                Text("Progresso", fontWeight = FontWeight.Bold, color = TextGray, fontSize = 14.sp)
                                Text("${(progress * 100).toInt()}%", fontWeight = FontWeight.ExtraBold, color = CorporateBlue, fontSize = 14.sp)
                            }
                            Spacer(modifier = Modifier.height(8.dp))
                            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)), color = SuccessGreen, trackColor = AccentPurpleLight)
                            Spacer(modifier = Modifier.height(20.dp))
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                StatCard(modifier = Modifier.weight(1f), title = "Total", count = totalSeats, iconColor = AccentPurple, bgTint = AccentPurpleLight, icon = Icons.Rounded.Groups)
                                StatCard(modifier = Modifier.weight(1f), title = "Tratados", count = treatedSeats, iconColor = SuccessGreen, bgTint = SuccessGreenLight, icon = Icons.Rounded.CheckCircleOutline)
                                StatCard(modifier = Modifier.weight(1f), title = "Pendentes", count = pendingSeats, iconColor = ErrorRed, bgTint = ErrorRedLight, icon = Icons.Rounded.Schedule)
                            }
                        }
                    }
                }

                // --- Pesquisa + botão de filtros ---
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp)
                            .background(Color.White, RoundedCornerShape(16.dp))
                            .border(1.dp, BorderSoft, RoundedCornerShape(16.dp))
                            .padding(horizontal = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Rounded.Search, tint = TextGray, contentDescription = null, modifier = Modifier.size(20.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        BasicTextField(
                            value = searchQuery,
                            onValueChange = { searchQuery = it },
                            singleLine = true,
                            textStyle = TextStyle(fontSize = 14.sp, color = CorporateBlue),
                            decorationBox = { innerTextField ->
                                if (searchQuery.isEmpty()) { Text("Pesquisar por nome, mesa...", fontSize = 14.sp, color = TextGray) }
                                innerTextField()
                            },
                            modifier = Modifier.weight(1f)
                        )
                        if (searchQuery.isNotEmpty()) {
                            Icon(
                                Icons.Rounded.Close, contentDescription = "Limpar pesquisa", tint = TextGray,
                                modifier = Modifier.size(18.dp).clip(CircleShape).clickable { searchQuery = "" }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    // Box sem recorte: o contador pode sobressair do botão sem ficar cortado
                    Box(modifier = Modifier.size(48.dp)) {
                        val filtersActive = activeFiltersCount > 0
                        IconButton(
                            onClick = { showFilters = true },
                            modifier = Modifier.fillMaxSize()
                                .background(if (filtersActive) AccentPurple else Color.White, RoundedCornerShape(16.dp))
                                .border(1.dp, if (filtersActive) AccentPurple else BorderSoft, RoundedCornerShape(16.dp))
                        ) { Icon(Icons.Rounded.Tune, contentDescription = "Filtros", tint = if (filtersActive) Color.White else TextGray) }
                        if (filtersActive) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = 6.dp, y = (-6).dp)
                                    .defaultMinSize(minWidth = 20.dp, minHeight = 20.dp)
                                    .background(ErrorRed, CircleShape)
                                    .border(2.dp, LightBg, CircleShape)
                                    .padding(horizontal = 5.dp),
                                contentAlignment = Alignment.Center
                            ) { Text(text = if (activeFiltersCount > 9) "9+" else activeFiltersCount.toString(), color = Color.White, fontSize = 11.sp, lineHeight = 11.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center, maxLines = 1, softWrap = false) }
                        }
                    }
                }

                // --- Filtros ativos (podem ser removidos um a um) ---
                if (activeFiltersCount > 0) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp).horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        selectedTables.forEach { mesa -> ActiveFilterChip("Mesa $mesa") { selectedTables = selectedTables - mesa } }
                        selectedCategories.forEach { cat -> ActiveFilterChip(cat) { selectedCategories = selectedCategories - cat } }
                        selectedStatus.forEach { st -> ActiveFilterChip(st) { selectedStatus = selectedStatus - st } }
                    }
                }

                // --- Lista de convidados ---
                Column(modifier = Modifier.fillMaxSize().nestedScroll(nestedScrollConnection)) {
                    Spacer(modifier = Modifier.height(14.dp))

                    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("${filteredSeats.size} registos", color = CorporateBlue, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Toque para validar", color = TextGray, fontSize = 12.sp)
                    }

                    if (seats.isEmpty()) {
                        // Sala sem dados: convida o gestor a importar um CSV
                        Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.TopCenter) {
                            EmptyState(
                                icon = Icons.Rounded.Description,
                                title = "Sem dados carregados",
                                message = "Importe um ficheiro CSV com as colunas\nMESA;LUGAR;CATEGORIA;NOME\npara começar a gerir.",
                                actionLabel = if (isManager) "Importar Ficheiro" else null,
                                onAction = if (isManager) { { csvLauncher.launch("*/*") } } else null
                            )
                        }
                    } else if (filteredSeats.isEmpty()) {
                        // Há dados, mas a pesquisa/filtros não devolvem nada
                        Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.TopCenter) {
                            EmptyState(
                                icon = Icons.Rounded.SearchOff,
                                title = "Sem resultados",
                                message = "Nenhum convidado corresponde à pesquisa ou aos filtros aplicados.",
                                actionLabel = "Limpar pesquisa e filtros",
                                onAction = { searchQuery = ""; selectedTables = emptySet(); selectedCategories = emptySet(); selectedStatus = emptySet() }
                            )
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

        // ------------------------------------------------------------------------------------
        // Diálogos de confirmação
        // ------------------------------------------------------------------------------------

        if (seatToConfirmClick != null) {
            val novoEstado = if (seatToConfirmClick!!.status == 0) 1 else 0
            val acao = if (novoEstado == 1) "ATRIBUIR entrada a" else "REMOVER entrada de"
            val nomeConvidado = seatToConfirmClick!!.assignedTo ?: "Convite Sem Nome"
            ModernAlertDialog(
                title = "Confirmação", message = "Queres $acao $nomeConvidado?", icon = Icons.AutoMirrored.Rounded.HelpOutline, iconTint = AccentPurple, iconBg = AccentPurpleLight,
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

        // ------------------------------------------------------------------------------------
        // Relatório de erros de importação (ecrã completo)
        // ------------------------------------------------------------------------------------

        if (viewModel.showValidationScreen) {
            val exportErrorsLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/csv")) { uri -> if (uri != null) viewModel.exportErrorsCsv(uri, context) }

            Dialog(onDismissRequest = { viewModel.showValidationScreen = false }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
                Surface(modifier = Modifier.fillMaxSize(), color = LightBg) {
                    Column(modifier = Modifier.fillMaxSize()) {
                        Row(modifier = Modifier.fillMaxWidth().background(DarkHeroGradient).padding(horizontal = 12.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                            IconButton(onClick = { viewModel.showValidationScreen = false }, modifier = Modifier.size(40.dp).background(Color.White.copy(alpha = 0.16f), CircleShape)) {
                                Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = Color.White)
                            }
                            Spacer(modifier = Modifier.width(12.dp))
                            Text("Relatório de Importação", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = Color.White)
                        }

                        Column(modifier = Modifier.padding(16.dp).weight(1f)) {
                            Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = ErrorRedLight), shape = RoundedCornerShape(20.dp)) {
                                Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Rounded.Warning, contentDescription = null, tint = ErrorRed, modifier = Modifier.size(32.dp))
                                    Spacer(modifier = Modifier.width(16.dp))
                                    Column {
                                        Text("Ficheiro Recusado", fontWeight = FontWeight.ExtraBold, color = ErrorRed)
                                        Text("${viewModel.validationErrorsList.size} erros em ${viewModel.totalValidationRows} linhas", color = ErrorRed, fontSize = 14.sp)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            val grouped = viewModel.validationErrorsList.groupBy { it.actualErrorType }

                            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                items(grouped.entries.toList()) { entry ->
                                    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(0.dp), border = BorderStroke(1.dp, BorderSoft), shape = RoundedCornerShape(20.dp)) {
                                        Column(modifier = Modifier.padding(16.dp)) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Box(modifier = Modifier.size(8.dp).background(ErrorRed, CircleShape))
                                                Spacer(modifier = Modifier.width(8.dp))
                                                Text(entry.key, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, fontSize = 15.sp)
                                            }
                                            Text("${entry.value.size} ocorrências", color = TextGray, fontSize = 12.sp, modifier = Modifier.padding(start = 16.dp, top = 2.dp))
                                            Spacer(modifier = Modifier.height(12.dp))
                                            val linhas = entry.value.joinToString(", ") { if (it.actualLine == 0) "Geral" else it.actualLine.toString() }
                                            Text("Linhas: $linhas", color = TextGray, fontSize = 13.sp, lineHeight = 20.sp)
                                        }
                                    }
                                }
                            }
                        }

                        Box(modifier = Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding().padding(16.dp)) {
                            GradientButton(text = "Exportar Relatório CSV", icon = Icons.Rounded.Download, onClick = { exportErrorsLauncher.launch("Relatorio_Erros_Importacao.csv") })
                        }
                    }
                }
            }
        }

        // ------------------------------------------------------------------------------------
        // Painéis inferiores
        // ------------------------------------------------------------------------------------

        // Filtros: chips de seleção múltipla com botão de aplicar
        if (showFilters) {
            ModalBottomSheet(onDismissRequest = { showFilters = false }, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = Color.White) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(22.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Filtros", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                        if (activeFiltersCount > 0) {
                            Text(
                                "Limpar tudo", color = ErrorRed, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { selectedTables = emptySet(); selectedCategories = emptySet(); selectedStatus = emptySet() }.padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }

                    FilterChipGroup(label = "Estado da Validação", options = listOf("Tratados", "Pendentes"), selected = selectedStatus, onToggle = { stat -> selectedStatus = if (selectedStatus.contains(stat)) selectedStatus - stat else selectedStatus + stat }, onClear = { selectedStatus = emptySet() })
                    FilterChipGroup(label = "Mesa", options = mesasUnicas, selected = selectedTables, onToggle = { mesa -> selectedTables = if (selectedTables.contains(mesa)) selectedTables - mesa else selectedTables + mesa }, onClear = { selectedTables = emptySet() })
                    FilterChipGroup(label = "Categoria de Convite", options = categoriasUnicas, selected = selectedCategories, onToggle = { cat -> selectedCategories = if (selectedCategories.contains(cat)) selectedCategories - cat else selectedCategories + cat }, onClear = { selectedCategories = emptySet() })

                    GradientButton(text = "Ver ${filteredSeats.size} resultados", onClick = { showFilters = false })
                }
            }
        }

        // Menu principal (hambúrguer)
        if (showActionsSheet) {
            ModalBottomSheet(onDismissRequest = { showActionsSheet = false }, containerColor = Color.White) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    // Cabeçalho do menu: logo atual da empresa + evento aberto
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 20.dp)) {
                        CompanyLogo(logo = viewModel.companyLogo, companyName = viewModel.companyName, size = 52.dp)
                        Spacer(modifier = Modifier.width(14.dp))
                        Column {
                            Text(viewModel.companyName, fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(currentEventName, fontSize = 13.sp, color = TextGray, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }

                    val mainActions = buildList {
                        add(ActionItem(Icons.Rounded.SwapHoriz, "Mudar de Evento", "Voltar à lista de eventos", PrimaryBlue, Color(0xFFE0E7FF)) {
                            showActionsSheet = false; viewModel.switchEvent { navController.navigate("event_selection") { popUpTo("event_selection") { inclusive = true } } }
                        })
                        if (isManager) {
                            add(ActionItem(Icons.AutoMirrored.Rounded.ListAlt, "Ações", "Exportar, importar e gerir dados", AccentPurple, AccentPurpleLight) {
                                showActionsSheet = false; showDataActionsSheet = true
                            })
                        } else {
                            add(ActionItem(Icons.Rounded.Settings, "Marcação", "Preferências da aplicação", AccentPurple, AccentPurpleLight) {
                                showActionsSheet = false; showSettingsSheet = true
                            })
                        }
                    }
                    ActionGrid(mainActions)

                    Spacer(modifier = Modifier.height(16.dp))
                    OutlinedButton(
                        onClick = { showActionsSheet = false; viewModel.logout(); navController.navigate("login") { popUpTo(0) { inclusive = true } } },
                        modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(18.dp),
                        border = BorderStroke(1.dp, ErrorRed.copy(alpha = 0.3f)),
                        colors = ButtonDefaults.outlinedButtonColors(containerColor = ErrorRedLight.copy(alpha = 0.4f), contentColor = ErrorRed)
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Terminar sessão", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Ações sobre os dados (apenas gestores)
        if (showDataActionsSheet) {
            ModalBottomSheet(onDismissRequest = { showDataActionsSheet = false }, containerColor = Color.White) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    Text("Ações", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, modifier = Modifier.padding(bottom = 20.dp))

                    ActionGrid(
                        listOf(
                            ActionItem(Icons.Rounded.Download, "Exportar CSV", "$totalSeats registos com estado atual", PrimaryBlue, Color(0xFFE0E7FF)) { showDataActionsSheet = false; exportCsvLauncher.launch("Export_Evento_${viewModel.currentEventId ?: "0"}.csv") },
                            ActionItem(Icons.Rounded.Upload, "Importar Ficheiro", "Substituir ou adicionar dados", SuccessGreen, SuccessGreenLight) { showDataActionsSheet = false; csvLauncher.launch("*/*") },
                            ActionItem(Icons.Rounded.CheckCircle, "Marcar Todos", "$pendingSeats registos pendentes", SuccessGreen, SuccessGreenLight) { showDataActionsSheet = false; confirmActionType = "MARK_ALL" },
                            ActionItem(Icons.Rounded.Cancel, "Desmarcar Todos", "$treatedSeats registos tratados", TextGray, Color(0xFFF1F5F9)) { showDataActionsSheet = false; confirmActionType = "UNMARK_ALL" },
                            ActionItem(Icons.Rounded.DeleteForever, "Limpar Dados", "Apagar todos os dados do evento", ErrorRed, ErrorRedLight) { showDataActionsSheet = false; confirmActionType = "CLEAR" },
                            ActionItem(Icons.Rounded.Settings, "Marcação", "Preferências da aplicação", AccentPurple, AccentPurpleLight) { showDataActionsSheet = false; showSettingsSheet = true }
                        )
                    )

                    Spacer(modifier = Modifier.height(20.dp))
                    OutlinedButton(onClick = { showDataActionsSheet = false; showActionsSheet = true }, modifier = Modifier.fillMaxWidth().height(48.dp), shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, BorderSoft)) { Text("Voltar", color = TextGray, fontWeight = FontWeight.Bold) }
                }
            }
        }

        // Preferências de marcação
        if (showSettingsSheet) {
            ModalBottomSheet(onDismissRequest = { showSettingsSheet = false }, containerColor = Color.White) {
                Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp).verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    Text("Configurações de Marcação", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, modifier = Modifier.padding(bottom = 20.dp))
                    Card(colors = CardDefaults.cardColors(containerColor = LightBg), border = BorderStroke(1.dp, BorderSoft), modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(20.dp)) {
                        Row(modifier = Modifier.padding(16.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Confirmar ao atribuir", fontWeight = FontWeight.Bold, color = CorporateBlue)
                                Text("Apresentar modal antes de alterar estado.", color = TextGray, fontSize = 12.sp, lineHeight = 16.sp)
                            }
                            Switch(checked = requireConfirmation, onCheckedChange = { requireConfirmation = it }, colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = AccentPurple))
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    GradientButton(
                        text = "Guardar e Fechar",
                        onClick = { showSettingsSheet = false; if (isManager) { showDataActionsSheet = true } }
                    )
                }
            }
        }
    }
}
