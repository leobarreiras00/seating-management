package com.leonardobarreiras.seatingmanagement.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Email
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockPerson
import androidx.compose.material.icons.rounded.MailOutline
import androidx.compose.material.icons.rounded.Pin
import androidx.compose.material.icons.rounded.Security
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.leonardobarreiras.seatingmanagement.R
import com.leonardobarreiras.seatingmanagement.ui.components.ContactSupportDialog
import com.leonardobarreiras.seatingmanagement.ui.components.GradientButton
import com.leonardobarreiras.seatingmanagement.ui.components.LegalDocument
import com.leonardobarreiras.seatingmanagement.ui.components.LegalDocumentDialog
import com.leonardobarreiras.seatingmanagement.ui.components.LegalLinksRow
import com.leonardobarreiras.seatingmanagement.ui.components.ModernAlertDialog
import com.leonardobarreiras.seatingmanagement.ui.components.PasswordRulesHint
import com.leonardobarreiras.seatingmanagement.ui.components.PinDots
import com.leonardobarreiras.seatingmanagement.ui.components.PinKeypad
import com.leonardobarreiras.seatingmanagement.ui.components.SeatlyTextField
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurple
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurpleLight
import com.leonardobarreiras.seatingmanagement.ui.theme.BorderSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.BrandGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.CorporateBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.DarkHeroGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRed
import com.leonardobarreiras.seatingmanagement.ui.theme.LightBg
import com.leonardobarreiras.seatingmanagement.ui.theme.PrimaryBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.TextGray
import com.leonardobarreiras.seatingmanagement.viewmodel.MAX_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.viewmodel.MIN_PASSWORD_LENGTH
import com.leonardobarreiras.seatingmanagement.viewmodel.isStrongPassword
import com.leonardobarreiras.seatingmanagement.viewmodel.SeatViewModel
import kotlinx.coroutines.delay

/*
 * AuthScreens.kt
 * --------------
 * Ecrãs de acesso: configuração do PIN, desbloqueio por PIN e login (com redefinição no 1.º acesso,
 * recuperação de palavra-passe e links legais / contacto).
 */

/** Número de dígitos do PIN de acesso rápido. */
private const val PIN_LENGTH = 4

/** Fundo suave em degradê usado nos ecrãs de PIN. */
private val PinBackground = Brush.verticalGradient(listOf(Color(0xFFEDE9FE), LightBg, Color.White))

/**
 * Ecrã de configuração do PIN, mostrado após o primeiro login.
 * Passo 1: convite para criar o PIN (ou saltar). Passo 2: introdução dos 4 dígitos no teclado numérico.
 *
 * @param onComplete chamado quando o PIN é guardado ou o utilizador escolhe "Agora não".
 */
@Composable
fun PinSetupScreen(viewModel: SeatViewModel, onComplete: () -> Unit) {
    var isSettingPin by remember { mutableStateOf(false) }
    var pin by remember { mutableStateOf("") }

    Box(modifier = Modifier.fillMaxSize().background(PinBackground), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier.size(88.dp)
                    .shadow(14.dp, RoundedCornerShape(28.dp), ambientColor = AccentPurple.copy(alpha = 0.3f), spotColor = AccentPurple.copy(alpha = 0.4f))
                    .background(BrandGradient, RoundedCornerShape(28.dp)),
                contentAlignment = Alignment.Center
            ) { Icon(Icons.Rounded.LockPerson, contentDescription = null, tint = Color.White, modifier = Modifier.size(44.dp)) }

            Spacer(modifier = Modifier.height(24.dp))
            Text("Acesso Rápido e Seguro", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(8.dp))

            if (!isSettingPin) {
                Text(
                    "Não voltes a colocar a palavra-passe. Configura um PIN de $PIN_LENGTH dígitos para entrares na aplicação instantaneamente nas próximas vezes.",
                    fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 20.sp
                )
                Spacer(modifier = Modifier.height(40.dp))
                GradientButton(text = "Criar Código PIN", onClick = { isSettingPin = true }, icon = Icons.Rounded.Pin)
                Spacer(modifier = Modifier.height(12.dp))
                TextButton(onClick = onComplete) { Text("Agora Não", color = TextGray, fontWeight = FontWeight.Bold) }
            } else {
                Text("Escolhe um código de $PIN_LENGTH dígitos para proteger a tua sessão.", fontSize = 14.sp, color = TextGray, textAlign = TextAlign.Center)
                Spacer(modifier = Modifier.height(32.dp))
                PinDots(length = PIN_LENGTH, filled = pin.length)
                Spacer(modifier = Modifier.height(32.dp))
                PinKeypad(
                    onDigit = { digit -> if (pin.length < PIN_LENGTH) pin += digit },
                    onBackspace = { pin = pin.dropLast(1) },
                    keySize = 68.dp
                )
                Spacer(modifier = Modifier.height(28.dp))
                GradientButton(
                    text = "Guardar PIN e Entrar",
                    onClick = { viewModel.secureStorage.savePin(pin); onComplete() },
                    enabled = pin.length == PIN_LENGTH
                )
            }
        }
    }
}

/**
 * Ecrã de desbloqueio por PIN (sessão já guardada). Valida automaticamente ao completar os dígitos.
 *
 * @param onSuccess PIN correto.
 * @param onLogout "Esqueci-me do PIN": termina a sessão e volta ao login.
 */
@Composable
fun PinAuthScreen(viewModel: SeatViewModel, onSuccess: () -> Unit, onLogout: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var isError by remember { mutableStateOf(false) }

    // Valida assim que o último dígito é introduzido
    LaunchedEffect(pin) {
        if (pin.length == PIN_LENGTH) {
            val savedPin = viewModel.secureStorage.getPin()
            if (pin == savedPin) {
                isError = false
                delay(200)
                onSuccess()
            } else {
                isError = true
                delay(350) // deixa o utilizador ver as bolinhas vermelhas antes de limpar
                pin = ""
            }
        } else { isError = false }
    }

    Box(modifier = Modifier.fillMaxSize().background(PinBackground), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier.size(88.dp)
                    .shadow(14.dp, RoundedCornerShape(28.dp), ambientColor = AccentPurple.copy(alpha = 0.25f), spotColor = AccentPurple.copy(alpha = 0.35f))
                    .background(Color.White, RoundedCornerShape(28.dp)).border(1.dp, BorderSoft, RoundedCornerShape(28.dp)),
                contentAlignment = Alignment.Center
            ) { Image(painter = painterResource(id = R.drawable.seatly_icon), contentDescription = null, modifier = Modifier.size(54.dp)) }

            Spacer(modifier = Modifier.height(24.dp))
            Text("Bem-vindo de volta", fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (isError) "Código PIN incorreto. Tenta novamente." else "Insere o teu código PIN para entrar",
                fontSize = 14.sp, color = if (isError) ErrorRed else TextGray, fontWeight = if (isError) FontWeight.Bold else FontWeight.Normal, textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            PinDots(length = PIN_LENGTH, filled = pin.length, isError = isError)
            Spacer(modifier = Modifier.height(32.dp))
            PinKeypad(
                onDigit = { digit -> if (pin.length < PIN_LENGTH && !isError) pin += digit },
                onBackspace = { if (!isError) pin = pin.dropLast(1) },
                keySize = 68.dp
            )
            Spacer(modifier = Modifier.height(20.dp))
            TextButton(onClick = onLogout) { Text("Esqueci-me do PIN (Terminar Sessão)", color = TextGray, fontWeight = FontWeight.Medium, textDecoration = TextDecoration.Underline, fontSize = 13.sp) }
        }
    }
}

/**
 * Ecrã de login.
 *
 * Inclui:
 *  - início de sessão por e-mail e palavra-passe;
 *  - recuperação de palavra-passe ("Esqueci-me?");
 *  - redefinição obrigatória no primeiro acesso (palavra-passe temporária);
 *  - links para Contactar suporte, Política de privacidade e Termos de serviço.
 *
 * @param onLoginSuccess chamado quando a autenticação (ou a redefinição) termina com sucesso.
 */
@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, viewModel: SeatViewModel) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var showForgotPasswordDialog by remember { mutableStateOf(false) }
    var resetEmail by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmNewPassword by remember { mutableStateOf("") }

    // Janelas legais / suporte
    var legalDocument by remember { mutableStateOf<LegalDocument?>(null) }
    var showContactDialog by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        // Fundo em duas zonas: cabeçalho escuro com círculos decorativos + base lavanda
        Column(modifier = Modifier.fillMaxSize()) {
            Box(modifier = Modifier.weight(1f).fillMaxWidth().background(DarkHeroGradient)) {
                Box(modifier = Modifier.align(Alignment.TopEnd).offset(x = 60.dp, y = (-40).dp).size(220.dp).background(AccentPurple.copy(alpha = 0.35f), CircleShape))
                Box(modifier = Modifier.align(Alignment.BottomStart).offset(x = (-50).dp, y = 40.dp).size(160.dp).background(PrimaryBlue.copy(alpha = 0.3f), CircleShape))
            }
            Box(modifier = Modifier.weight(1.5f).fillMaxWidth().background(LightBg))
        }

        // Conteúdo com scroll e a reagir ao teclado, para o cartão nunca ficar tapado
        Column(
            modifier = Modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(32.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(16.dp)
            ) {
                Column(modifier = Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    // Só o logótipo da aplicação (a palavra "Seatly" já faz parte da imagem)
                    Image(painter = painterResource(id = R.drawable.seatly_wrt), contentDescription = "Seatly", modifier = Modifier.height(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Bem-vindo de volta", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = CorporateBlue)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Entra com a tua conta para gerir e validar convidados.", fontSize = 13.sp, color = TextGray, textAlign = TextAlign.Center, lineHeight = 18.sp)
                    Spacer(modifier = Modifier.height(28.dp))

                    SeatlyTextField(value = email, onValueChange = { email = it }, label = "E-mail", leadingIcon = Icons.Rounded.Email, keyboardType = KeyboardType.Email)
                    Spacer(modifier = Modifier.height(14.dp))
                    SeatlyTextField(value = password, onValueChange = { password = it }, label = "Palavra-passe", leadingIcon = Icons.Rounded.Lock, isPassword = true)

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { showForgotPasswordDialog = true }) {
                            Text("Esqueci-me?", color = AccentPurple, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    if (viewModel.loginError != null && !viewModel.requiresFirstLoginReset) {
                        Text(text = viewModel.loginError!!, color = ErrorRed, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp))
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    GradientButton(
                        text = "Entrar",
                        onClick = { viewModel.authenticate(email, password) { onLoginSuccess() } },
                        enabled = !viewModel.isAuthLoading,
                        loading = viewModel.isAuthLoading
                    )

                    Spacer(modifier = Modifier.height(18.dp))
                    LegalLinksRow(
                        onContact = { showContactDialog = true },
                        onPrivacy = { legalDocument = LegalDocument.PRIVACY },
                        onTerms = { legalDocument = LegalDocument.TERMS }
                    )
                }
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
                    SeatlyTextField(value = resetEmail, onValueChange = { resetEmail = it }, label = "O teu e-mail", leadingIcon = Icons.Rounded.Email, keyboardType = KeyboardType.Email)
                }
            )
        }

        if (viewModel.requiresFirstLoginReset) {
            var localError by remember { mutableStateOf("") }
            // Mostra o erro devolvido pelo servidor (ex.: palavra-passe temporária expirada)
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
                    if (!isStrongPassword(newPassword)) { localError = "A palavra-passe tem de ter entre $MIN_PASSWORD_LENGTH e $MAX_PASSWORD_LENGTH caracteres, com pelo menos uma letra e um número." }
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
                        SeatlyTextField(value = newPassword, onValueChange = { newPassword = it; localError = "" }, label = "Nova Palavra-passe", isPassword = true)
                        SeatlyTextField(value = confirmNewPassword, onValueChange = { confirmNewPassword = it; localError = "" }, label = "Confirmar Palavra-passe", isPassword = true)
                        if (localError.isNotEmpty()) { Text(localError, color = ErrorRed, fontSize = 12.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center, fontWeight = FontWeight.Bold) }
                    }
                }
            )
        }

        legalDocument?.let { doc -> LegalDocumentDialog(document = doc, onDismiss = { legalDocument = null }) }

        if (showContactDialog) {
            ContactSupportDialog(
                onSend = { contactEmail, message, onSuccess, onError -> viewModel.sendSupportMessage(contactEmail, message, onSuccess, onError) },
                onDismiss = { showContactDialog = false }
            )
        }
    }
}
