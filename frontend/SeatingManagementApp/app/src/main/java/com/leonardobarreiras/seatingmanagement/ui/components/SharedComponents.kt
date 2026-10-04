package com.leonardobarreiras.seatingmanagement.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.platform.LocalContext
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import android.util.Base64
import coil.ImageLoader
import coil.compose.AsyncImage
import coil.decode.SvgDecoder
import com.leonardobarreiras.seatingmanagement.viewmodel.MIN_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import com.leonardobarreiras.seatingmanagement.ui.theme.*
import com.leonardobarreiras.seatingmanagement.ui.utils.getMesaFromSeat
import com.leonardobarreiras.seatingmanagement.viewmodel.AppFeedback
import com.leonardobarreiras.seatingmanagement.viewmodel.FeedbackType

@Composable
fun ModernAlertDialog(
    title: String, message: String, icon: ImageVector, iconTint: Color, iconBg: Color,
    confirmText: String = "Confirmar", cancelText: String? = "Cancelar", confirmColor: Color = AccentPurple,
    isConfirmLoading: Boolean = false, onConfirm: () -> Unit, onDismiss: () -> Unit, content: @Composable (() -> Unit)? = null
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(32.dp), colors = CardDefaults.cardColors(containerColor = Color.White),
            elevation = CardDefaults.cardElevation(defaultElevation = 12.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
        ) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(modifier = Modifier.size(72.dp).background(iconBg, RoundedCornerShape(24.dp)).border(1.dp, iconTint.copy(alpha = 0.15f), RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(34.dp))
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
                        onClick = onConfirm, enabled = !isConfirmLoading, modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = confirmColor),
                        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
                        contentPadding = PaddingValues(horizontal = 4.dp)
                    ) {
                        if (isConfirmLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Text(confirmText, fontWeight = FontWeight.Bold, fontSize = 13.sp, maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable
fun AppFeedbackDialog(feedback: AppFeedback, onDismiss: () -> Unit) {
    val icon = when (feedback.type) { FeedbackType.SUCCESS -> Icons.Rounded.CheckCircle; FeedbackType.ERROR -> Icons.Rounded.Warning; FeedbackType.EXPORT -> Icons.Rounded.Download; FeedbackType.INFO -> Icons.Rounded.Info; FeedbackType.OFFLINE -> Icons.Rounded.CloudOff }
    val iconColor = when (feedback.type) { FeedbackType.SUCCESS -> SuccessGreen; FeedbackType.ERROR -> ErrorRed; FeedbackType.EXPORT -> PrimaryBlue; FeedbackType.INFO -> AccentPurple; FeedbackType.OFFLINE -> OfflineGray }
    val iconBg = when (feedback.type) { FeedbackType.SUCCESS -> SuccessGreenLight; FeedbackType.ERROR -> ErrorRedLight; FeedbackType.EXPORT -> Color(0xFFEFF6FF); FeedbackType.INFO -> AccentPurpleLight; FeedbackType.OFFLINE -> Color(0xFFF1F5F9) }
    ModernAlertDialog(title = feedback.title, message = feedback.message, icon = icon, iconTint = iconColor, iconBg = iconBg, confirmText = "Continuar", cancelText = null, confirmColor = iconColor, onConfirm = onDismiss, onDismiss = onDismiss)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PremiumFilterDropdown(
    label: String,
    options: List<String>,
    selectedOptions: Set<String>,
    onSelectionChange: (String) -> Unit,
    onClear: () -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val displayStr = if (selectedOptions.isEmpty()) "Todas as opções" else selectedOptions.joinToString(", ")

    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        Text(
            text = label,
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold,
            color = CorporateBlue,
            modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
        )

        Box(modifier = Modifier.fillMaxWidth()) {
            Card(
                modifier = Modifier.fillMaxWidth().clickable { expanded = true },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                border = BorderStroke(1.dp, if (expanded) AccentPurple else Color(0xFFE2E8F0)),
                elevation = CardDefaults.cardElevation(if (expanded) 4.dp else 0.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 18.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = displayStr,
                        color = if (selectedOptions.isEmpty()) TextGray else CorporateBlue,
                        fontWeight = if (selectedOptions.isEmpty()) FontWeight.Normal else FontWeight.Bold,
                        fontSize = 14.sp,
                        maxLines = 1,
                        modifier = Modifier.weight(1f)
                    )
                    Icon(
                        imageVector = if (expanded) Icons.Rounded.KeyboardArrowUp else Icons.Rounded.KeyboardArrowDown,
                        contentDescription = null,
                        tint = if (expanded) AccentPurple else TextGray,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            DropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .padding(8.dp)
            ) {
                DropdownMenuItem(
                    text = { Text("Limpar Seleção", fontWeight = FontWeight.Bold, color = ErrorRed, fontSize = 14.sp) },
                    onClick = { onClear(); expanded = false },
                    modifier = Modifier.clip(RoundedCornerShape(12.dp))
                )

                HorizontalDivider(color = Color(0xFFF1F5F9), thickness = 1.dp, modifier = Modifier.padding(vertical = 4.dp))

                options.forEach { option ->
                    val isSelected = selectedOptions.contains(option)
                    DropdownMenuItem(
                        text = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(22.dp)
                                        .background(if (isSelected) AccentPurple else Color(0xFFF8FAFC), RoundedCornerShape(6.dp))
                                        .border(if (isSelected) 0.dp else 1.dp, if (isSelected) Color.Transparent else Color(0xFFCBD5E1), RoundedCornerShape(6.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isSelected) {
                                        Icon(Icons.Rounded.Check, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                                    }
                                }
                                Spacer(Modifier.width(12.dp))
                                Text(
                                    text = option,
                                    color = if (isSelected) CorporateBlue else TextGray,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    fontSize = 14.sp,
                                    maxLines = 2
                                )
                            }
                        },
                        onClick = { onSelectionChange(option) },
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSelected) AccentPurpleLight.copy(alpha = 0.3f) else Color.Transparent)
                    )
                }
            }
        }
    }
}

@Composable
fun GuestListItem(seat: SeatEntity, onAssignClick: () -> Unit) {
    val isAssigned = seat.status != 0
    val statusColor = if (isAssigned) SuccessGreen else ErrorRed
    val statusBg = if (isAssigned) SuccessGreenLight else ErrorRedLight

    val name = seat.assignedTo?.takeIf { it.isNotBlank() } ?: "Convite Sem Nome"
    val initials = name.split(" ").take(2).mapNotNull { it.firstOrNull()?.uppercase() }.joinToString("")

    val avatarColor = remember(name) {
        val colors = listOf(Color(0xFF6366F1), Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF8B5CF6), Color(0xFF14B8A6))
        colors[name.length % colors.size]
    }

    Card(
        modifier = Modifier.fillMaxWidth().clickable { onAssignClick() },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(0.dp),
        border = BorderStroke(1.dp, BorderSoft),
        shape = RoundedCornerShape(24.dp)
    ) {
        Row(
            modifier = Modifier.padding(16.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(48.dp).background(avatarColor.copy(alpha = 0.1f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(initials, color = avatarColor, fontWeight = FontWeight.Black, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(name, fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, color = CorporateBlue, maxLines = 2)
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = seat.eventName,
                    color = AccentPurple,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .background(AccentPurpleLight, RoundedCornerShape(8.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp),
                    maxLines = 1
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Row(
                        modifier = Modifier.background(AccentPurpleLight.copy(alpha = 0.6f), RoundedCornerShape(8.dp)).padding(horizontal = 6.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Rounded.GridView, contentDescription = null, tint = TextGray, modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Mesa: ", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Medium)
                        Text(getMesaFromSeat(seat.seatNumber), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Row(
                        modifier = Modifier.background(AccentPurpleLight.copy(alpha = 0.6f), RoundedCornerShape(8.dp)).padding(horizontal = 6.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Rounded.Place, contentDescription = null, tint = TextGray, modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Lugar: ", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Medium)
                        val lugarStr = seat.seatNumber.split("-").let { if (it.size > 1) it[1] else seat.seatNumber }
                        Text(lugarStr, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                    }
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .background(statusBg)
                        .border(2.dp, statusColor.copy(alpha = 0.3f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isAssigned) Icons.Rounded.Check else Icons.Rounded.Close,
                        contentDescription = "Estado",
                        tint = statusColor,
                        modifier = Modifier.size(24.dp)
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (isAssigned) "Validado" else "Pendente",
                    color = statusColor,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.ExtraBold
                )
            }
        }
    }
}

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

/** Base do servidor (igual ao Retrofit) para logos que venham como caminho relativo. */
private const val LOGO_BASE_URL = "https://api-seatly.onrender.com/"

/** Converte o valor guardado em Company.LogoUrl (data URI base64, URL http ou caminho relativo) num modelo que o Coil entende. */
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

/** Logo da empresa (sempre o atual), com fallback para as iniciais/ícone. */
@Composable
fun CompanyLogo(logo: String, companyName: String, modifier: Modifier = Modifier, size: androidx.compose.ui.unit.Dp = 96.dp) {
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

/** Aviso permanente das regras da palavra-passe (mínimo de caracteres). Fica vermelho se o valor for curto. */
@Composable
fun PasswordRulesHint(currentValue: String = "", modifier: Modifier = Modifier) {
    val ok = currentValue.length >= MIN_PASSWORD_LENGTH
    val tooShort = currentValue.isNotEmpty() && !ok
    val tint = when { ok -> SuccessGreen; tooShort -> ErrorRed; else -> TextGray }
    Row(
        modifier = modifier.fillMaxWidth().background(tint.copy(alpha = 0.08f), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(if (ok) Icons.Rounded.CheckCircle else Icons.Rounded.Info, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(8.dp))
        Text("A palavra-passe tem de ter no mínimo $MIN_PASSWORD_LENGTH caracteres.", fontSize = 12.sp, color = tint, fontWeight = FontWeight.Medium, lineHeight = 16.sp)
    }
}

/** Botão principal com o gradiente da marca. */
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