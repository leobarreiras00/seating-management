package com.leonardobarreiras.seatingmanagement.ui.components

import android.util.Base64
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.GridView
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurple
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurpleLight
import com.leonardobarreiras.seatingmanagement.ui.theme.BorderSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.BrandGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.CorporateBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRed
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRedLight
import com.leonardobarreiras.seatingmanagement.ui.theme.FieldBg
import com.leonardobarreiras.seatingmanagement.ui.theme.LightBg
import com.leonardobarreiras.seatingmanagement.ui.theme.OfflineGray
import com.leonardobarreiras.seatingmanagement.ui.theme.PrimaryBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.SuccessGreen
import com.leonardobarreiras.seatingmanagement.ui.theme.SuccessGreenLight
import com.leonardobarreiras.seatingmanagement.ui.theme.TextGray
import com.leonardobarreiras.seatingmanagement.ui.utils.getMesaFromSeat
import com.leonardobarreiras.seatingmanagement.viewmodel.AppFeedback
import com.leonardobarreiras.seatingmanagement.viewmodel.FeedbackType
import com.leonardobarreiras.seatingmanagement.viewmodel.MAX_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.viewmodel.MIN_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.viewmodel.isStrongPassword
import kotlinx.coroutines.delay

/*
 * SharedComponents.kt
 * -------------------
 * Biblioteca de componentes visuais reutilizáveis da aplicação Seatly.
 * Todos os ecrãs devem compor-se a partir daqui para manter a identidade visual
 * (gradiente roxo → azul, cantos generosos, bordas suaves) consistente.
 */

// ---------------------------------------------------------------------------------------------
// Diálogos e avisos
// ---------------------------------------------------------------------------------------------

/**
 * Diálogo modal genérico com ícone, título, mensagem e conteúdo opcional.
 *
 * @param title título em destaque.
 * @param message texto explicativo por baixo do título.
 * @param icon ícone apresentado no topo; [iconTint]/[iconBg] definem a cor do ícone e do fundo.
 * @param confirmText texto do botão principal.
 * @param cancelText texto do botão secundário; `null` esconde o botão (diálogo só informativo).
 * @param confirmColor cor do botão principal (ex.: vermelho para ações destrutivas).
 * @param isConfirmLoading mostra um indicador de progresso no botão principal e bloqueia-o.
 * @param content conteúdo extra opcional (ex.: campos de texto) apresentado entre a mensagem e os botões.
 */
@Composable
fun ModernAlertDialog(
    title: String, message: String, icon: ImageVector, iconTint: Color, iconBg: Color,
    confirmText: String = "Confirmar", cancelText: String? = "Cancelar", confirmColor: Color = AccentPurple,
    isConfirmLoading: Boolean = false, onConfirm: () -> Unit, onDismiss: () -> Unit, content: @Composable (() -> Unit)? = null
) {
    // Entrada com ligeiro "pop" para o diálogo parecer vivo
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val scale by animateFloatAsState(if (shown) 1f else 0.92f, spring(dampingRatio = 0.7f, stiffness = 400f), label = "dialogScale")

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(32.dp),
            colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp),
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp).graphicsLayer { scaleX = scale; scaleY = scale }
        ) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier.size(72.dp).background(iconBg, RoundedCornerShape(24.dp)).border(1.dp, iconTint.copy(alpha = 0.15f), RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) { Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(34.dp)) }

                Spacer(modifier = Modifier.height(20.dp))
                Text(title, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(8.dp))
                Text(message, fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp)

                if (content != null) {
                    Spacer(modifier = Modifier.height(16.dp))
                    content()
                }

                Spacer(modifier = Modifier.height(24.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (cancelText != null) {
                        // Botão secundário "tonal": menos peso visual do que o principal
                        Box(
                            modifier = Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(18.dp)).background(LightBg)
                                .clickable(onClick = onDismiss),
                            contentAlignment = Alignment.Center
                        ) { Text(cancelText, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = TextGray, maxLines = 1) }
                    }
                    Button(
                        onClick = onConfirm, enabled = !isConfirmLoading,
                        modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(18.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = confirmColor, disabledContainerColor = confirmColor.copy(alpha = 0.6f)),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp)
                    ) {
                        if (isConfirmLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Text(confirmText, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1)
                    }
                }
            }
        }
    }
}

/** Aparência de cada tipo de aviso (ícone, cor do ícone e cor de fundo). */
private data class FeedbackStyle(val icon: ImageVector, val tint: Color, val bg: Color)

private fun feedbackStyle(type: FeedbackType): FeedbackStyle = when (type) {
    FeedbackType.SUCCESS -> FeedbackStyle(Icons.Rounded.CheckCircle, SuccessGreen, SuccessGreenLight)
    FeedbackType.ERROR -> FeedbackStyle(Icons.Rounded.Warning, ErrorRed, ErrorRedLight)
    FeedbackType.EXPORT -> FeedbackStyle(Icons.Rounded.Download, PrimaryBlue, Color(0xFFE0E7FF))
    FeedbackType.INFO -> FeedbackStyle(Icons.Rounded.Info, AccentPurple, AccentPurpleLight)
    FeedbackType.OFFLINE -> FeedbackStyle(Icons.Rounded.CloudOff, OfflineGray, Color(0xFFF1F5F9))
}

/**
 * Anfitrião dos avisos da aplicação: mostra um banner animado no topo do ecrã (em vez de um diálogo
 * que bloqueia a utilização) e fecha-o sozinho passado uns segundos.
 *
 * Deve ser colocado uma única vez, por cima do `NavHost`, para os avisos funcionarem em todos os ecrãs.
 *
 * @param feedback aviso atual (`null` quando não há nada para mostrar).
 * @param onDismiss chamado quando o aviso expira ou o utilizador o fecha.
 */
@Composable
fun FeedbackToastHost(feedback: AppFeedback?, onDismiss: () -> Unit) {
    // Mantém a última mensagem para a animação de saída não mostrar um cartão vazio
    var lastFeedback by remember { mutableStateOf<AppFeedback?>(null) }
    if (feedback != null) lastFeedback = feedback

    LaunchedEffect(feedback) {
        if (feedback != null) {
            delay(if (feedback.type == FeedbackType.ERROR) 6000L else 4000L)
            onDismiss()
        }
    }

    Box(
        modifier = Modifier.fillMaxSize().statusBarsPadding().padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.TopCenter
    ) {
        AnimatedVisibility(
            visible = feedback != null,
            enter = slideInVertically(tween(300)) { -it } + fadeIn(tween(300)),
            exit = slideOutVertically(tween(250)) { -it } + fadeOut(tween(250))
        ) {
            lastFeedback?.let { current ->
                val style = feedbackStyle(current.type)
                Card(
                    shape = RoundedCornerShape(22.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 14.dp),
                    border = BorderStroke(1.dp, style.tint.copy(alpha = 0.25f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(44.dp).background(style.bg, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
                            Icon(style.icon, contentDescription = null, tint = style.tint, modifier = Modifier.size(24.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(current.title, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = CorporateBlue, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(current.message, fontSize = 13.sp, color = TextGray, lineHeight = 17.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
                        }
                        IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                            Icon(Icons.Rounded.Close, contentDescription = "Fechar aviso", tint = TextGray, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Campos e botões
// ---------------------------------------------------------------------------------------------

/**
 * Campo de texto com a identidade Seatly (fundo suave, cantos arredondados, ícone à esquerda).
 *
 * @param isPassword esconde o texto e mostra o botão "ver/esconder palavra-passe".
 * @param minLines/[singleLine] permitem usar o mesmo campo para mensagens longas.
 */
@Composable
fun SeatlyTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    minLines: Int = 1
) {
    var passwordVisible by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        leadingIcon = if (leadingIcon != null) { { Icon(leadingIcon, contentDescription = null, tint = TextGray) } } else null,
        trailingIcon = if (isPassword) {
            {
                IconButton(onClick = { passwordVisible = !passwordVisible }) {
                    Icon(
                        imageVector = if (passwordVisible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility,
                        contentDescription = if (passwordVisible) "Esconder palavra-passe" else "Mostrar palavra-passe",
                        tint = TextGray
                    )
                }
            }
        } else null,
        visualTransformation = if (isPassword && !passwordVisible) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (isPassword) KeyboardType.Password else keyboardType),
        singleLine = singleLine,
        minLines = minLines,
        shape = RoundedCornerShape(18.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = AccentPurple,
            unfocusedBorderColor = BorderSoft,
            focusedLabelColor = AccentPurple,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = FieldBg,
            cursorColor = AccentPurple
        ),
        modifier = modifier.fillMaxWidth()
    )
}

/**
 * Aviso permanente das regras da palavra-passe (mínimo de [MIN_PASSWORD_LENGTH] caracteres).
 * Neutro enquanto vazio, vermelho se o valor for curto e verde quando cumpre a regra.
 */
@Composable
fun PasswordRulesHint(currentValue: String = "", modifier: Modifier = Modifier) {
    val ok = isStrongPassword(currentValue)
    val tooShort = currentValue.isNotEmpty() && !ok
    val tint = when { ok -> SuccessGreen; tooShort -> ErrorRed; else -> TextGray }
    Row(
        modifier = modifier.fillMaxWidth().background(tint.copy(alpha = 0.08f), RoundedCornerShape(14.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(if (ok) Icons.Rounded.CheckCircle else Icons.Rounded.Info, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text("A palavra-passe tem de ter entre $MIN_PASSWORD_LENGTH e $MAX_PASSWORD_LENGTH caracteres, com pelo menos uma letra e um número.", fontSize = 12.sp, color = tint, fontWeight = FontWeight.Medium, lineHeight = 16.sp)
    }
}

/**
 * Botão principal com o gradiente da marca.
 *
 * @param loading mostra um indicador de progresso e bloqueia cliques.
 * @param icon ícone opcional à esquerda do texto.
 */
@Composable
fun GradientButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, loading: Boolean = false, icon: ImageVector? = null) {
    val alpha by animateFloatAsState(if (enabled && !loading) 1f else 0.55f, label = "btnAlpha")
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(56.dp)
            .alpha(alpha)
            .shadow(if (enabled) 10.dp else 0.dp, RoundedCornerShape(18.dp), ambientColor = AccentPurple.copy(alpha = 0.3f), spotColor = AccentPurple.copy(alpha = 0.4f))
            .clip(RoundedCornerShape(18.dp))
            .background(BrandGradient, RoundedCornerShape(18.dp))
            .clickable(enabled = enabled && !loading) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        if (loading) {
            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.5.dp)
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                if (icon != null) { Icon(icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)) }
                Text(text, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp)
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Filtros e menus
// ---------------------------------------------------------------------------------------------

/** "Pílula" selecionável usada nos filtros; muda de cor com animação ao ser (des)ativada. */
@Composable
fun SelectableChip(label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(14.dp)
    Row(
        modifier = modifier
            .clip(shape)
            .background(if (selected) AccentPurple else FieldBg, shape)
            .border(1.dp, if (selected) AccentPurple else BorderSoft, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (selected) {
            Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(15.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(label, color = if (selected) Color.White else CorporateBlue, fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * Grupo de filtros multi-seleção apresentado como chips que quebram de linha.
 * Substitui o antigo dropdown: todas as opções ficam visíveis de uma vez.
 *
 * @param options opções disponíveis.
 * @param selected opções atualmente ativas.
 * @param onToggle chamado com a opção tocada (adiciona ou remove da seleção).
 * @param onClear limpa a seleção deste grupo.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun FilterChipGroup(label: String, options: List<String>, selected: Set<String>, onToggle: (String) -> Unit, onClear: () -> Unit) {
    // Grupos longos começam compactados (só o título + resumo); grupos curtos começam abertos.
    var expanded by remember { mutableStateOf(options.size <= COMPACT_THRESHOLD) }
    val summary = when {
        selected.isEmpty() -> "${options.size} opções"
        selected.size == 1 -> selected.first()
        else -> "${selected.size} selecionadas"
    }
    Column(modifier = Modifier.fillMaxWidth().animateContentSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .clickable { expanded = !expanded }
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(label, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                if (!expanded) {
                    Text(summary, fontSize = 12.sp, color = if (selected.isEmpty()) TextGray else PrimaryBlue, fontWeight = if (selected.isEmpty()) FontWeight.Normal else FontWeight.SemiBold, maxLines = 1)
                }
            }
            if (selected.isNotEmpty()) {
                Text("Limpar (${selected.size})", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = ErrorRed, modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClear).padding(horizontal = 6.dp, vertical = 2.dp))
            }
            Text(if (expanded) "▴" else "▾", fontSize = 16.sp, color = PrimaryBlue, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 8.dp))
        }
        if (expanded) {
            Spacer(Modifier.height(6.dp))
            if (options.isEmpty()) {
                Text("Sem opções disponíveis.", fontSize = 13.sp, color = TextGray)
            } else {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    options.forEach { option -> SelectableChip(label = option, selected = selected.contains(option), onClick = { onToggle(option) }) }
                }
            }
        }
    }
}

/** Nº de opções a partir do qual um grupo de filtros começa compactado. */
private const val COMPACT_THRESHOLD = 6

/**
 * Mosaico de ação usado nos menus em painel inferior (ícone grande + título + legenda).
 * Pensado para ser colocado dois por linha, cada um com `Modifier.weight(1f)`.
 */
@Composable
fun ActionTile(icon: ImageVector, title: String, subtitle: String, iconColor: Color, iconBg: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Column(
        modifier = modifier
            .clip(shape)
            .background(Color.White, shape)
            .border(1.dp, BorderSoft, shape)
            .clickable(onClick = onClick)
            .padding(16.dp)
    ) {
        Box(modifier = Modifier.size(44.dp).background(iconBg, RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 14.sp, color = CorporateBlue, maxLines = 2, lineHeight = 18.sp)
        Spacer(Modifier.height(2.dp))
        Text(subtitle, fontSize = 11.sp, color = TextGray, maxLines = 2, lineHeight = 14.sp)
    }
}

// ---------------------------------------------------------------------------------------------
// Estados vazios e carregamento
// ---------------------------------------------------------------------------------------------

/**
 * Estado vazio padronizado (ícone, título, texto e ação opcional).
 *
 * @param actionLabel texto do botão; se `null`, o botão não aparece.
 */
@Composable
fun EmptyState(icon: ImageVector, title: String, message: String, modifier: Modifier = Modifier, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Column(modifier = modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(modifier = Modifier.size(88.dp).background(AccentPurpleLight, RoundedCornerShape(30.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = AccentPurple, modifier = Modifier.size(42.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text(title, fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(message, fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp)
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(24.dp))
            GradientButton(text = actionLabel, onClick = onAction, modifier = Modifier.fillMaxWidth(0.8f))
        }
    }
}

/** Bloco cinzento pulsante usado como "esqueleto" enquanto os dados carregam. */
@Composable
fun ShimmerBlock(modifier: Modifier = Modifier, shape: RoundedCornerShape = RoundedCornerShape(24.dp)) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val alpha by transition.animateFloat(
        initialValue = 0.35f, targetValue = 0.8f,
        animationSpec = infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "shimmerAlpha"
    )
    Box(modifier = modifier.clip(shape).background(AccentPurpleLight.copy(alpha = alpha)))
}

// ---------------------------------------------------------------------------------------------
// Logo da empresa
// ---------------------------------------------------------------------------------------------

/** Base do servidor (igual ao Retrofit) para logos que venham como caminho relativo. */
private val LOGO_BASE_URL: String = com.leonardobarreiras.seatingmanagement.BuildConfig.API_BASE_URL

/**
 * Converte o valor guardado em `Company.LogoUrl` num modelo que o Coil entende:
 * data URI base64 → bytes; URL http(s) → tal como está; caminho relativo → prefixado com o servidor.
 * Devolve `null` quando não há logo.
 */
private fun resolveLogoModel(logo: String): Any? {
    val value = logo.trim()
    if (value.isEmpty()) return null
    return when {
        value.startsWith("data:", ignoreCase = true) -> try {
            // data:image/png;base64,AAAA... → bytes
            Base64.decode(value.substringAfter("base64,"), Base64.DEFAULT)
        } catch (e: Exception) { null }
        value.startsWith("http://", true) || value.startsWith("https://", true) -> value
        else -> LOGO_BASE_URL + value.trimStart('/')
    }
}

/**
 * Logo da empresa (sempre o atual), com a inicial do nome sobre o gradiente da marca como alternativa.
 *
 * @param logo valor bruto vindo da API/sessão (data URI, URL ou caminho relativo).
 * @param size lado do quadrado; o raio dos cantos acompanha o tamanho.
 */
@Composable
fun CompanyLogo(logo: String, companyName: String, modifier: Modifier = Modifier, size: Dp = 96.dp) {
    val context = LocalContext.current
    val imageLoader = remember { ImageLoader.Builder(context).components { add(SvgDecoder.Factory()) }.build() }
    val model = remember(logo) { resolveLogoModel(logo) }
    val shape = RoundedCornerShape(size / 3.2f)

    Box(
        modifier = modifier
            .size(size)
            .shadow(14.dp, shape, ambientColor = AccentPurple.copy(alpha = 0.25f), spotColor = AccentPurple.copy(alpha = 0.35f))
            .clip(shape)
            .background(Color.White)
            .border(1.dp, BorderSoft, shape),
        contentAlignment = Alignment.Center
    ) {
        if (model != null) {
            AsyncImage(
                model = model,
                imageLoader = imageLoader,
                contentDescription = "Logo de $companyName",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().padding(size / 8)
            )
        } else {
            Box(modifier = Modifier.fillMaxSize().background(BrandGradient), contentAlignment = Alignment.Center) {
                Text(
                    text = companyName.trim().firstOrNull()?.uppercase() ?: "S",
                    color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = (size.value / 2.2f).sp
                )
            }
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Lista de convidados e estatísticas
// ---------------------------------------------------------------------------------------------

/**
 * Linha da lista de convidados: avatar com iniciais, nome, categoria, mesa/lugar e estado de validação.
 * Uma barra lateral colorida indica o estado de relance (verde = validado, vermelho = pendente).
 *
 * @param onAssignClick chamado ao tocar na linha (o ecrã decide se pede confirmação).
 */
@Composable
fun GuestListItem(seat: SeatEntity, onAssignClick: () -> Unit) {
    val isAssigned = seat.status != 0
    val statusColor by androidx.compose.animation.animateColorAsState(if (isAssigned) SuccessGreen else ErrorRed, label = "statusColor")
    val statusBg = if (isAssigned) SuccessGreenLight else ErrorRedLight

    val name = seat.assignedTo?.takeIf { it.isNotBlank() } ?: "Convite Sem Nome"
    val initials = name.split(" ").take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("")

    // Cor do avatar determinística a partir do nome (a mesma pessoa tem sempre a mesma cor)
    val avatarColor = remember(name) {
        val colors = listOf(Color(0xFF6366F1), Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF8B5CF6), Color(0xFF14B8A6))
        colors[name.length % colors.size]
    }

    val shape = RoundedCornerShape(24.dp)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .clip(shape)
            .background(Color.White, shape)
            .border(1.dp, BorderSoft, shape)
            .clickable { onAssignClick() }
    ) {
        // Barra de estado à esquerda (ocupa a altura toda da linha)
        Box(modifier = Modifier.width(5.dp).fillMaxHeight().background(statusColor))
        Row(modifier = Modifier.padding(14.dp).weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(48.dp).background(avatarColor.copy(alpha = 0.12f), CircleShape), contentAlignment = Alignment.Center) {
                Text(initials, color = avatarColor, fontWeight = FontWeight.Black, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(name, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = CorporateBlue, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = seat.eventName,
                    color = AccentPurple, fontSize = 10.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.background(AccentPurpleLight, RoundedCornerShape(8.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
                    maxLines = 1, overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    InfoPill(icon = Icons.Rounded.GridView, label = "Mesa", value = getMesaFromSeat(seat.seatNumber))
                    Spacer(modifier = Modifier.width(8.dp))
                    val lugarStr = seat.seatNumber.split("-").let { if (it.size > 1) it[1] else seat.seatNumber }
                    InfoPill(icon = Icons.Rounded.Place, label = "Lugar", value = lugarStr)
                }
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier.size(44.dp).clip(CircleShape).background(statusBg).border(2.dp, statusColor.copy(alpha = 0.3f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isAssigned) Icons.Rounded.Check else Icons.Rounded.Close,
                        contentDescription = "Estado", tint = statusColor, modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = if (isAssigned) "Validado" else "Pendente", color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

/** Pequena etiqueta "ícone + rótulo + valor" (ex.: Mesa: A) usada nos cartões de convidado. */
@Composable
private fun InfoPill(icon: ImageVector, label: String, value: String) {
    Row(
        modifier = Modifier.background(AccentPurpleLight.copy(alpha = 0.6f), RoundedCornerShape(8.dp)).padding(horizontal = 6.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = TextGray, modifier = Modifier.size(12.dp))
        Spacer(modifier = Modifier.width(4.dp))
        Text("$label: ", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Medium)
        Text(value, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
    }
}

/**
 * Cartão de estatística (ícone, número e legenda) com todo o conteúdo centrado.
 * Usado em trio no dashboard: Total, Tratados e Pendentes.
 */
@Composable
fun StatCard(modifier: Modifier = Modifier, title: String, count: Int, iconColor: Color, bgTint: Color, icon: ImageVector) {
    Card(modifier = modifier, colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(0.dp), border = BorderStroke(1.dp, BorderSoft), shape = RoundedCornerShape(22.dp)) {
        // fillMaxWidth + CenterHorizontally: o conteúdo fica sempre centrado dentro do cartão
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(modifier = Modifier.size(40.dp).background(bgTint, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) { Icon(icon, contentDescription = title, tint = iconColor, modifier = Modifier.size(20.dp)) }
            Spacer(modifier = Modifier.height(10.dp))
            Text(text = count.toString(), fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, color = CorporateBlue, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            Text(text = title, fontSize = 12.sp, color = iconColor, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.fillMaxWidth())
        }
    }
}
