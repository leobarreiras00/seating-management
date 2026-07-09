package com.leonardobarreiras.seatingmanagement.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun PinDialog(
    showDialog: Boolean,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var pin by remember { mutableStateOf("") }

    if (showDialog) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Autenticação Necessária") },
            text = {
                OutlinedTextField(
                    value = pin,
                    onValueChange = {
                        // Permite apenas números e no máximo 4 dígitos
                        if (it.length <= 4 && it.all { char -> char.isDigit() }) {
                            pin = it
                        }
                    },
                    label = { Text("Inserir PIN") },
                    visualTransformation = PasswordVisualTransformation(),
                    // Traz o teclado numérico automaticamente para melhor UX
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(onClick = {
                    onConfirm(pin)
                    pin = "" // Limpa o pin ao confirmar
                }) {
                    Text("Confirmar")
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    pin = ""
                    onDismiss()
                }) {
                    Text("Cancelar")
                }
            }
        )
    }
}