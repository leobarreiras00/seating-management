package com.leonardobarreiras.seatingmanagement.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel

@Composable
fun ManagementScreen(
    onBack: () -> Unit,
    viewModel: SeatViewModel = viewModel() // Injetamos o ViewModel aqui
) {
    val context = LocalContext.current
    var showClearDialog by remember { mutableStateOf(false) }

    // ==========================================
    // LAUNCHERS DE FICHEIROS (Storage Access Framework)
    // ==========================================

    // Launcher para IMPORTAR (Abre explorador para escolher um ficheiro)
    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            viewModel.importCsv(uri, context)
        }
    }

    // Launcher para EXPORTAR (Abre explorador para guardar um ficheiro)
    val exportLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("text/csv")
    ) { uri ->
        if (uri != null) {
            viewModel.exportCsv(uri, context)
        }
    }

    // ==========================================
    // INTERFACE DE UTILIZADOR
    // ==========================================

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Gestão de Dados", style = MaterialTheme.typography.headlineMedium)
        Spacer(modifier = Modifier.height(16.dp))

        // BOTÃO IMPORTAR
        Button(
            onClick = { importLauncher.launch(arrayOf("text/comma-separated-values", "text/csv", "*/*")) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Importar Ficheiro CSV")
        }

        // BOTÃO EXPORTAR
        Button(
            onClick = { exportLauncher.launch("Lugares_Exportados.csv") },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Exportar para CSV")
        }

        // BOTÃO LIMPAR (Abre um diálogo de confirmação)
        Button(
            onClick = { showClearDialog = true },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
        ) {
            Text("Limpar Todos os Dados")
        }

        Spacer(modifier = Modifier.weight(1f))

        OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
            Text("Voltar ao Dashboard")
        }
    }

    // ==========================================
    // DIÁLOGO DE SEGURANÇA PARA LIMPAR DADOS
    // ==========================================
    if (showClearDialog) {
        AlertDialog(
            onDismissRequest = { showClearDialog = false },
            title = { Text("Atenção!") },
            text = { Text("Tens a certeza que queres apagar todos os lugares? Esta ação não pode ser desfeita.") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.clearAllData()
                        showClearDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Sim, Apagar Tudo")
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}