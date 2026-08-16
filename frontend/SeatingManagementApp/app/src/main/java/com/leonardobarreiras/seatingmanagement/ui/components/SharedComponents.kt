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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
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
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp), modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)
        ) {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Box(modifier = Modifier.size(64.dp).background(iconBg, RoundedCornerShape(20.dp)), contentAlignment = Alignment.Center) {
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
                        onClick = onConfirm, enabled = !isConfirmLoading, modifier = Modifier.weight(1f).height(48.dp),
                        shape = RoundedCornerShape(16.dp), colors = ButtonDefaults.buttonColors(containerColor = confirmColor),
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
        val colors = listOf(Color(0xFF3B82F6), Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF8B5CF6), Color(0xFF14B8A6))
        colors[name.length % colors.size]
    }

    Card(
        modifier = Modifier.fillMaxWidth().clickable { onAssignClick() },
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp),
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
                        modifier = Modifier.background(Color(0xFFF1F5F9), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Rounded.GridView, contentDescription = null, tint = TextGray, modifier = Modifier.size(12.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Mesa: ", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Medium)
                        Text(getMesaFromSeat(seat.seatNumber), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Row(
                        modifier = Modifier.background(Color(0xFFF1F5F9), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 4.dp),
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