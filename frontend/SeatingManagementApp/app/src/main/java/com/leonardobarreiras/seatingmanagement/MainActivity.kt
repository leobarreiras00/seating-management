package com.leonardobarreiras.seatingmanagement

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.ui.LoginScreen
import com.leonardobarreiras.seatingmanagement.ui.ManagementScreen
import com.leonardobarreiras.seatingmanagement.ui.PinDialog
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                val navController = rememberNavController()

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    // ViewModel criado no topo para partilhar o Estado (e o Token JWT) entre ecrãs
                    val sharedViewModel: SeatViewModel = viewModel()

                    NavHost(navController = navController, startDestination = "login") {
                        composable("login") {
                            LoginScreen(
                                onLoginSuccess = {
                                    navController.navigate("dashboard") {
                                        popUpTo("login") { inclusive = true }
                                    }
                                },
                                viewModel = sharedViewModel
                            )
                        }
                        composable("dashboard") {
                            SeatScreen(
                                onNavigateToManagement = {
                                    navController.navigate("management")
                                },
                                viewModel = sharedViewModel
                            )
                        }
                        composable("management") {
                            ManagementScreen(
                                onBack = { navController.popBackStack() }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SeatScreen(onNavigateToManagement: () -> Unit, viewModel: SeatViewModel) {
    val seats by viewModel.seatsFlow.collectAsState(initial = emptyList())
    var showPinDialog by remember { mutableStateOf(false) }

    var seatToConfirmClick by remember { mutableStateOf<SeatEntity?>(null) }
    var seatToConfirmLongClick by remember { mutableStateOf<SeatEntity?>(null) }

    // Launcher Oficial da Câmara ZXing
    val scanLauncher = rememberLauncherForActivityResult(ScanContract()) { result ->
        if (result.contents != null) {
            // Envia o conteúdo do QR Code para validação na API
            viewModel.validateTicketFromQr(result.contents.trim())
        }
    }

    Column(modifier = Modifier.padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Dashboard",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )

            Column(horizontalAlignment = Alignment.End) {
                // Botão Oficial para Ler Bilhete
                Button(
                    onClick = {
                        val options = ScanOptions().apply {
                            setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                            setPrompt("Aponta para o QR Code do Bilhete")
                            setCameraId(0) // 0 = Câmara Traseira
                            setBeepEnabled(true)
                            setOrientationLocked(false)
                        }
                        scanLauncher.launch(options)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2196F3))
                ) {
                    Text("📷 Ler Bilhete")
                }

                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { viewModel.fetchSeatsFromApi() }) {
                    Text("Sincronizar API")
                }
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { showPinDialog = true }) {
                    Text("Gestão de Dados")
                }
            }
        }

        // Diálogo de Feedback do QR Code
        if (viewModel.qrFeedbackMessage != null) {
            AlertDialog(
                onDismissRequest = { viewModel.clearQrFeedback() },
                title = { Text("Leitura de Bilhete") },
                text = { Text(viewModel.qrFeedbackMessage!!) },
                confirmButton = {
                    Button(onClick = { viewModel.clearQrFeedback() }) { Text("OK") }
                }
            )
        }

        // Diálogo de PIN de Segurança
        PinDialog(
            showDialog = showPinDialog,
            onDismiss = { showPinDialog = false },
            onConfirm = { pin ->
                if (viewModel.verifyPin(pin)) {
                    showPinDialog = false
                    onNavigateToManagement()
                }
            }
        )

        // Diálogo para Toque Simples (Marcar/Desmarcar)
        if (seatToConfirmClick != null) {
            val novoEstado = if (seatToConfirmClick!!.status == 0) 1 else 0
            val acao = if (novoEstado == 1) "marcar" else "desmarcar"
            AlertDialog(
                onDismissRequest = { seatToConfirmClick = null },
                title = { Text("Confirmar Alteração") },
                text = { Text("Queres $acao o lugar ${seatToConfirmClick!!.seatNumber}?") },
                confirmButton = {
                    Button(onClick = {
                        viewModel.updateSeatStatus(seatToConfirmClick!!, novoEstado)
                        seatToConfirmClick = null
                    }) { Text("Sim") }
                },
                dismissButton = {
                    TextButton(onClick = { seatToConfirmClick = null }) { Text("Cancelar") }
                }
            )
        }

        // Diálogo para Toque Longo (Estado Tratado)
        if (seatToConfirmLongClick != null) {
            val novoEstado = if (seatToConfirmLongClick!!.status == 2) 0 else 2
            val textoAcao = if (novoEstado == 2) "marcar como TRATADO (Vermelho)" else "reverter para LIVRE"

            AlertDialog(
                onDismissRequest = { seatToConfirmLongClick = null },
                title = { Text("Gestão do Lugar") },
                text = { Text("Queres $textoAcao o lugar ${seatToConfirmLongClick!!.seatNumber}?") },
                confirmButton = {
                    Button(
                        onClick = {
                            viewModel.updateSeatStatus(seatToConfirmLongClick!!, novoEstado)
                            seatToConfirmLongClick = null
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = if (novoEstado == 2) Color(0xFFF44336) else MaterialTheme.colorScheme.primary)
                    ) { Text("Confirmar") }
                },
                dismissButton = {
                    TextButton(onClick = { seatToConfirmLongClick = null }) { Text("Cancelar") }
                }
            )
        }

        // Grelha de Apresentação de Lugares
        if (seats.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Nenhum lugar na base de dados.\nClica em 'Sincronizar API'.")
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(seats) { seat ->
                    SeatItem(
                        seat = seat,
                        onClick = { seatToConfirmClick = seat },
                        onLongClick = { seatToConfirmLongClick = seat }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun SeatItem(seat: SeatEntity, onClick: () -> Unit, onLongClick: () -> Unit) {
    val backgroundColor = when (seat.status) {
        0 -> Color(0xFFE0E0E0) // Livre (Cinzento)
        1 -> Color(0xFF4CAF50) // Ocupado (Verde)
        2 -> Color(0xFFF44336) // Tratado (Vermelho)
        else -> Color.DarkGray
    }

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(16.dp))
            .background(backgroundColor)
            .combinedClickable(
                onClick = onClick,
                onLongClick = onLongClick
            )
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = seat.seatNumber,
            color = if (seat.status == 0) Color.Black else Color.White,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleLarge
        )
    }
}