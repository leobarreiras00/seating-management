package com.leonardobarreiras.seatingmanagement.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Backspace
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurple
import com.leonardobarreiras.seatingmanagement.ui.theme.BorderSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.CorporateBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRed
import com.leonardobarreiras.seatingmanagement.ui.theme.TextGray

/*
 * PinComponents.kt
 * ----------------
 * Indicadores e teclado numérico próprios para o código PIN. Têm duas vantagens face ao campo de
 * texto do sistema: não dependem do teclado do telemóvel (sem foco para pedir) e mostram o
 * progresso com animação.
 */

/**
 * Indicadores do PIN: uma bolinha por dígito que "salta" quando preenchida.
 *
 * @param length número total de dígitos do PIN.
 * @param filled quantos já foram introduzidos.
 * @param isError pinta as bolinhas de vermelho (PIN incorreto).
 */
@Composable
fun PinDots(length: Int, filled: Int, isError: Boolean = false, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(18.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(length) { index ->
            val isFilled = index < filled
            val scale by animateFloatAsState(if (isFilled) 1.15f else 1f, spring(dampingRatio = 0.5f, stiffness = 500f), label = "pinDotScale")
            val color by animateColorAsState(
                targetValue = when { isError -> ErrorRed; isFilled -> AccentPurple; else -> Color.White },
                label = "pinDotColor"
            )
            Box(
                modifier = Modifier
                    .size(18.dp)
                    .graphicsLayer { scaleX = scale; scaleY = scale }
                    .background(color, CircleShape)
                    .border(2.dp, if (isError) ErrorRed else if (isFilled) AccentPurple else BorderSoft, CircleShape)
            )
        }
    }
}

/**
 * Teclado numérico 0-9 com tecla de apagar.
 *
 * @param onDigit chamado com o dígito tocado.
 * @param onBackspace chamado ao tocar na tecla de apagar.
 * @param keySize diâmetro das teclas (reduzido quando o teclado está dentro de um diálogo).
 */
@Composable
fun PinKeypad(onDigit: (Char) -> Unit, onBackspace: () -> Unit, modifier: Modifier = Modifier, keySize: Dp = 72.dp) {
    val rows = listOf(listOf('1', '2', '3'), listOf('4', '5', '6'), listOf('7', '8', '9'))
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        rows.forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                row.forEach { digit -> KeypadKey(label = digit.toString(), size = keySize) { onDigit(digit) } }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(22.dp), verticalAlignment = Alignment.CenterVertically) {
            Spacer(modifier = Modifier.size(keySize)) // espaço vazio para alinhar o 0 ao centro
            KeypadKey(label = "0", size = keySize) { onDigit('0') }
            Box(
                modifier = Modifier.size(keySize).clip(CircleShape).clickable(onClick = onBackspace),
                contentAlignment = Alignment.Center
            ) { Icon(Icons.AutoMirrored.Rounded.Backspace, contentDescription = "Apagar", tint = TextGray, modifier = Modifier.size(keySize / 3)) }
        }
    }
}

/** Tecla circular individual do teclado numérico. */
@Composable
private fun KeypadKey(label: String, size: Dp, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(Color.White, CircleShape)
            .border(1.dp, BorderSoft, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) { Text(label, fontSize = (size.value / 2.8f).sp, fontWeight = FontWeight.Bold, color = CorporateBlue) }
}
