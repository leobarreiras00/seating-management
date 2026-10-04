package com.leonardobarreiras.seatingmanagement.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.leonardobarreiras.seatingmanagement.R
import com.leonardobarreiras.seatingmanagement.ui.components.GradientButton
import com.leonardobarreiras.seatingmanagement.ui.components.ModernAlertDialog
import com.leonardobarreiras.seatingmanagement.ui.components.PasswordRulesHint
import androidx.compose.ui.draw.shadow
import com.leonardobarreiras.seatingmanagement.ui.theme.*
import com.leonardobarreiras.seatingmanagement.viewmodel.MIN_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel
import kotlinx.coroutines.delay

@Composable
fun PinSetupScreen(viewModel: SeatViewModel, onComplete: () -> Unit) {
    var isSettingPin by remember { mutableStateOf(false) }
    var pin by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFEDE9FE), LightBg, Color.White))), contentAlignment = Alignment.Center) {
        Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(88.dp).shadow(14.dp, RoundedCornerShape(28.dp), ambientColor = AccentPurple.copy(alpha = 0.3f), spotColor = AccentPurple.copy(alpha = 0.4f)).background(BrandGradient, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.LockPerson, contentDescription = null, tint = Color.White, modifier = Modifier.size(44.dp))
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text("Acesso Rápido e Seguro", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(8.dp))

            if (!isSettingPin) {
                Text("Não voltes a colocar a palavra-passe. Configura um PIN de 4 dígitos para entrares na aplicação instantaneamente nas próximas vezes.", fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp)
                Spacer(modifier = Modifier.height(40.dp))
                GradientButton(text = "Criar Código PIN", onClick = { isSettingPin = true }, icon = Icons.Rounded.Pin)
                Spacer(modifier = Modifier.height(16.dp))
                TextButton(onClick = onComplete) { Text("Agora Não", color = TextGray, fontWeight = FontWeight.Bold) }
            } else {
                Text("Escreve um código de 4 dígitos para proteger a tua sessão.", fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(40.dp))
                BasicTextField(
                    value = pin, onValueChange = { if (it.length <= 4 && it.all { char -> char.isDigit() }) pin = it },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                    decorationBox = {
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            repeat(4) { index ->
                                val isFilled = index < pin.length
                                val isFocused = index == pin.length
                                Box(
                                    modifier = Modifier.weight(1f).aspectRatio(1f)
                                        .background(Color.White, RoundedCornerShape(16.dp))
                                        .border(2.dp, if (isFocused) AccentPurple else if (isFilled) AccentPurple.copy(alpha = 0.4f) else BorderSoft, RoundedCornerShape(18.dp)),
                                    contentAlignment = Alignment.Center
                                ) { if (isFilled) { Box(modifier = Modifier.size(16.dp).background(BrandGradient, CircleShape)) } }
                            }
                        }
                    }
                )
                Spacer(modifier = Modifier.height(40.dp))
                GradientButton(text = "Guardar PIN e Entrar", onClick = { viewModel.secureStorage.savePin(pin); onComplete() }, enabled = pin.length == 4)
            }
        }
    }
}

@Composable
fun PinAuthScreen(viewModel: SeatViewModel, onSuccess: () -> Unit, onLogout: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }

    LaunchedEffect(pin) {
        if (pin.length == 4) {
            val savedPin = viewModel.secureStorage.getPin()
            if (pin == savedPin) {
                isError = false
                delay(200)
                onSuccess()
            } else {
                isError = true
                pin = ""
            }
        } else { isError = false }
    }

    Box(modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFEDE9FE), LightBg, Color.White))), contentAlignment = Alignment.Center) {
        Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(modifier = Modifier.size(88.dp).shadow(14.dp, RoundedCornerShape(28.dp), ambientColor = AccentPurple.copy(alpha = 0.25f), spotColor = AccentPurple.copy(alpha = 0.35f)).background(Color.White, RoundedCornerShape(28.dp)).border(1.dp, BorderSoft, RoundedCornerShape(28.dp)), contentAlignment = Alignment.Center) {
                Image(painter = painterResource(id = R.drawable.seatly_wrt), contentDescription = null, modifier = Modifier.size(50.dp).clip(RoundedCornerShape(12.dp)))
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text("Bem-vindo de volta", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Insere o teu código PIN para entrar", fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(40.dp))

            BasicTextField(
                value = pin, onValueChange = { if (it.length <= 4 && it.all { char -> char.isDigit() }) pin = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                decorationBox = {
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp), modifier = Modifier.fillMaxWidth(0.8f), verticalAlignment = Alignment.CenterVertically) {
                        repeat(4) { index ->
                            val isFilled = index < pin.length
                            Box(
                                modifier = Modifier.weight(1f).aspectRatio(1f)
                                    .background(Color.White, RoundedCornerShape(16.dp))
                                    .border(2.dp, if (isError) ErrorRed else if (isFilled) AccentPurple else BorderSoft, RoundedCornerShape(18.dp)),
                                contentAlignment = Alignment.Center
                            ) { if (isFilled) { Box(modifier = Modifier.size(16.dp).background(if (isError) ErrorRed else AccentPurple, CircleShape)) } }
                        }
                    }
                }
            )

            if (isError) {
                Spacer(modifier = Modifier.height(16.dp))
                Text("Código PIN incorreto.", color = ErrorRed, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
            Spacer(modifier = Modifier.height(60.dp))
            TextButton(onClick = onLogout) { Text("Esqueci-me do PIN (Terminar Sessão)", color = TextGray, fontWeight = FontWeight.Medium, textDecoration = TextDecoration.Underline) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, viewModel: SeatViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showForgotPasswordDialog by remember { mutableStateOf(false) }
    var resetEmail by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmNewPassword by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth().background(DarkHeroGradient)) {
                // Círculos decorativos (identidade visual, tal como no backoffice)
                Box(modifier = Modifier.align(Alignment.TopEnd).offset(x = 60.dp, y = (-40).dp).size(220.dp).background(AccentPurple.copy(alpha = 0.35f), CircleShape))
                Box(modifier = Modifier.align(Alignment.BottomStart).offset(x = (-50).dp, y = 40.dp).size(160.dp).background(PrimaryBlue.copy(alpha = 0.3f), CircleShape))
            }
            Box(modifier = Modifier.weight(1.5f).fillMaxWidth().background(LightBg))
        }

        Card(
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 24.dp).fillMaxWidth(),
            shape = RoundedCornerShape(32.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(16.dp)
        ) {
            Column(modifier = Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Image(painter = painterResource(id = R.drawable.seatly_wrt), contentDescription = "Seatly Logo", modifier = Modifier.height(72.dp).clip(RoundedCornerShape(16.dp)))
                Spacer(modifier = Modifier.height(16.dp))
                Text("Seatly", fontSize = 28.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                Text("Gestão de lugares, com estilo.", fontSize = 14.sp, color = TextGray)
                Spacer(modifier = Modifier.height(32.dp))

                OutlinedTextField(
                    value = email, onValueChange = { email = it }, label = { Text("E-mail") },
                    leadingIcon = { Icon(Icons.Rounded.Email, contentDescription = null, tint = Color.Gray) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple, unfocusedBorderColor = BorderSoft, focusedLabelColor = AccentPurple)
                )
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = password, onValueChange = { password = it }, label = { Text("Palavra-passe") },
                    leadingIcon = { Icon(Icons.Rounded.Lock, contentDescription = null, tint = Color.Gray) },
                    visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple, unfocusedBorderColor = BorderSoft, focusedLabelColor = AccentPurple)
                )

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = { showForgotPasswordDialog = true }, contentPadding = PaddingValues(0.dp)) {
                        Text("Esqueci-me?", color = AccentPurple, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }

                if (viewModel.loginError != null && !viewModel.requiresFirstLoginReset) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = viewModel.loginError!!, color = ErrorRed, fontSize = 12.sp, textAlign = TextAlign.Center)
                }
                Spacer(modifier = Modifier.height(24.dp))

                GradientButton(
                    text = "Entrar",
                    onClick = { viewModel.authenticate(email, password) { onLoginSuccess() } },
                    enabled = !viewModel.isAuthLoading,
                    loading = viewModel.isAuthLoading
                )
            }
        }

        if (showForgotPasswordDialog) {
            ModernAlertDialog(
                title = "Recuperar Acesso",
                message = "Insere o teu e-mail associado à conta. Iremos enviar-te um link seguro para redefinir a palavra-passe.",
                icon = Icons.Rounded.MailOutline, iconTint = PrimaryBlue, iconBg = Color(0xFFE0E7FF),
                confirmText = "Enviar E-mail", cancelText = "Cancelar", confirmColor = AccentPurple,
                onConfirm = {
                    if (resetEmail.isNotEmpty()) {
                        viewModel.requestPasswordReset(resetEmail)
                        showForgotPasswordDialog = false
                        resetEmail = ""
                    }
                },
                onDismiss = { showForgotPasswordDialog = false; resetEmail = "" },
                content = {
                    OutlinedTextField(
                        value = resetEmail, onValueChange = { resetEmail = it }, label = { Text("O teu e-mail") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryBlue)
                    )
                }
            )
        }

        if (viewModel.requiresFirstLoginReset) {
            var localError by remember { mutableStateOf("") }
            LaunchedEffect(viewModel.firstLoginError) {
                if (viewModel.firstLoginError != null) localError = viewModel.firstLoginError!!
            }

            ModernAlertDialog(
                title = "Segurança em 1º Lugar",
                message = "Bem-vindo! Estás a usar uma palavra-passe temporária. Define agora a tua palavra-passe definitiva.",
                icon = Icons.Rounded.Security, iconTint = AccentPurple, iconBg = AccentPurpleLight,
                confirmText = "Guardar e Entrar", cancelText = "Cancelar", confirmColor = AccentPurple,
                isConfirmLoading = viewModel.isResetLoading,
                onConfirm = {
                    if (newPassword.length < MIN_PASSWORD_LENGTH) { localError = "A palavra-passe tem de ter no mínimo 6 caracteres." }
                    else if (newPassword != confirmNewPassword) { localError = "As palavras-passe não coincidem." }
                    else if (newPassword == password) { localError = "A nova palavra-passe tem de ser diferente da temporária." }
                    else {
                        localError = ""
                        viewModel.firstLoginReset(email, password, newPassword) {
                            viewModel.requiresFirstLoginReset = false
                            onLoginSuccess()
                        }
                    }
                },
                onDismiss = { viewModel.requiresFirstLoginReset = false; viewModel.logout() },
                content = {
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        // Aviso sempre visível do mínimo de caracteres
                        PasswordRulesHint(currentValue = newPassword)
                        OutlinedTextField(
                            value = newPassword, onValueChange = { newPassword = it; localError = "" }, label = { Text("Nova Palavra-passe") },
                            visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple)
                        )
                        OutlinedTextField(
                            value = confirmNewPassword, onValueChange = { confirmNewPassword = it; localError = "" }, label = { Text("Confirmar Palavra-passe") },
                            visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp), singleLine = true, colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = AccentPurple)
                        )
                        if (localError.isNotEmpty()) { Text(localError, color = ErrorRed, fontSize = 12.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center, fontWeight = FontWeight.Bold) }
                    }
                }
            )
        }
    }
}