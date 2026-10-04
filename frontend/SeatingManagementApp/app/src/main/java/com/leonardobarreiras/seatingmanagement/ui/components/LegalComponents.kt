package com.leonardobarreiras.seatingmanagement.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Gavel
import androidx.compose.material.icons.rounded.PrivacyTip
import androidx.compose.material.icons.rounded.SupportAgent
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material.icons.rounded.Email
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurple
import com.leonardobarreiras.seatingmanagement.ui.theme.AccentPurpleLight
import com.leonardobarreiras.seatingmanagement.ui.theme.BorderSoft
import com.leonardobarreiras.seatingmanagement.ui.theme.BrandGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.CorporateBlue
import com.leonardobarreiras.seatingmanagement.ui.theme.DarkHeroGradient
import com.leonardobarreiras.seatingmanagement.ui.theme.ErrorRed
import com.leonardobarreiras.seatingmanagement.ui.theme.LightBg
import com.leonardobarreiras.seatingmanagement.ui.theme.TextGray
import java.util.Calendar

/*
 * LegalComponents.kt
 * ------------------
 * Informação legal e de suporte acessível a partir do login e do perfil:
 *  - links (Contactar suporte · Política de privacidade · Termos de serviço);
 *  - ecrãs com o texto dos Termos e da Política (o mesmo conteúdo do backoffice);
 *  - formulário de contacto com o suporte (POST /api/Auth/contact).
 */

/** Documento legal que pode ser aberto a partir dos links. */
enum class LegalDocument { TERMS, PRIVACY }

/** Parágrafo de um documento legal; [lead] e [boldTail] aparecem a negrito. */
private data class LegalBlock(
    val text: String,
    val lead: String? = null,
    val boldTail: String? = null,
    val end: String = "",
    val bullet: Boolean = false
)

private data class LegalSection(val title: String, val blocks: List<LegalBlock>)

private const val LEGAL_UPDATED = "Última Atualização: Setembro de 2026"

/** Conteúdo dos Termos de Serviço (texto legal idêntico ao do backoffice). */
private val termsSections = listOf(
    LegalSection("Aceitação dos Termos", listOf(LegalBlock("Ao aceder e utilizar o Backoffice Web ou a Aplicação Mobile do Seatly, concorda em ficar vinculado a estes Termos de Serviço. A plataforma Seatly é desenvolvida por Leonardo Barreiras (\"Seatly\") e é-lhe fornecida em nome do organizador do seu evento."))),
    LegalSection("Uso Permitido", listOf(
        LegalBlock("A plataforma Seatly destina-se estritamente a:"),
        LegalBlock("Gestão e planeamento da capacidade de eventos.", bullet = true),
        LegalBlock("Importação de listas de convidados autorizadas via upload de ficheiros CSV.", bullet = true),
        LegalBlock("Validação da entrada de convidados nas portas do recinto.", bullet = true)
    )),
    LegalSection("Contas de Utilizador e Responsabilidades", listOf(LegalBlock("É responsável por manter a confidencialidade das credenciais da sua conta (palavra-passe e PIN mobile de 4 dígitos). Concorda em não partilhar as suas credenciais nem tentar contornar as medidas de segurança de Controlo de Acesso Baseado em Funções (RBAC) da plataforma."))),
    LegalSection("Limitação de Responsabilidade", listOf(LegalBlock("O Seatly fornece a plataforma \"tal como está\" e \"conforme disponível\", sem garantias de qualquer tipo. O Seatly é uma plataforma tecnológica, não uma empresa de produção de eventos. Não nos responsabilizamos por interrupções de eventos, violações da capacidade física do recinto ou por entradas de dados imprecisos carregados pelos gestores."))),
    LegalSection("Lei Aplicável", listOf(LegalBlock("Estes Termos de Serviço serão regidos e interpretados de acordo com as leis de Portugal. Quaisquer litígios decorrentes destes termos estarão sujeitos à jurisdição exclusiva dos tribunais portugueses.")))
)

/** Conteúdo da Política de Privacidade (texto legal idêntico ao do backoffice). */
private val privacySections = listOf(
    LegalSection("Introdução: O Nosso Papel e os Seus Dados", listOf(LegalBlock("A plataforma Seatly é fornecida por Leonardo Barreiras (\"Processador de Dados\") em nome do organizador do evento, promotor ou recinto específico que forneceu as suas credenciais de acesso (\"Controlador de Dados\"). Ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD), o organizador do evento é responsável por determinar como e porquê os seus dados pessoais são processados. O Seatly atua exclusivamente como um prestador de serviços técnicos, armazenando e gerindo estes dados de forma segura e estritamente de acordo com as instruções do organizador."))),
    LegalSection("Informação que Recolhemos", listOf(
        LegalBlock("Para facilitar a gestão de capacidade e acesso aos eventos, o Seatly recolhe:"),
        LegalBlock(" Identificação pessoal (nome, endereço de e-mail), credenciais criptográficas e registos de auditoria das ações no sistema (ex: validações de bilhetes).", lead = "Do Staff (Utilizadores e Gestores):", bullet = true),
        LegalBlock(" Nomes dos convidados, atribuição de lugares e estado de validação do bilhete. O Seatly não processa informações de pagamento nem dados pessoais sensíveis.", lead = "Dos Convidados (Via Importação CSV):", bullet = true)
    )),
    LegalSection("Armazenamento, Localização e Segurança dos Dados", listOf(
        LegalBlock(" Todos os dados pessoais são armazenados de forma segura na infraestrutura cloud do Render (Frankfurt, Alemanha) e Neon PostgreSQL. Os dados permanecem estritamente dentro do Espaço Económico Europeu (EEE), garantindo total conformidade com as exigências do RGPD.", lead = "Alojamento Europeu:"),
        LegalBlock(" O Seatly implementa validação End-to-End JWT Bearer, Controlo de Acesso Baseado em Funções (RBAC) e isolamento multi-tenant ao nível da base de dados.", lead = "Medidas de Segurança:")
    )),
    LegalSection("Contacte-nos", listOf(
        LegalBlock("Para questões técnicas relativas à plataforma, por favor contacte o Suporte Seatly em: ", boldTail = SUPPORT_EMAIL, end = "."),
        LegalBlock("Para exercer os seus direitos RGPD (Acesso, Apagamento, Portabilidade), por favor contacte diretamente a administração do Organizador do seu Evento, uma vez que estes detêm a autoridade legal sobre os seus dados.")
    ))
)

/** Endereço público de suporte (o mesmo que consta na Política de Privacidade). */
private const val SUPPORT_EMAIL = "leo.gbarreiras@gmail.com"

/**
 * Linha de links legais: "Contactar suporte · Política de privacidade · Termos de serviço".
 * Quebra para duas linhas em ecrãs estreitos.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun LegalLinksRow(onContact: () -> Unit, onPrivacy: () -> Unit, onTerms: () -> Unit, modifier: Modifier = Modifier) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        LegalLink("Contactar suporte", onContact)
        Dot()
        LegalLink("Política de privacidade", onPrivacy)
        Dot()
        LegalLink("Termos de serviço", onTerms)
    }
}

@Composable
private fun LegalLink(text: String, onClick: () -> Unit) {
    Text(
        text = text, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = TextGray,
        modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onClick).padding(horizontal = 4.dp, vertical = 6.dp)
    )
}

@Composable
private fun Dot() {
    Box(modifier = Modifier.size(4.dp).background(AccentPurple.copy(alpha = 0.35f), CircleShape))
}

/**
 * Ecrã completo com um documento legal (Termos ou Privacidade).
 * Cabeçalho em gradiente, secções numeradas e botão "Entendi" fixo em baixo.
 */
@Composable
fun LegalDocumentDialog(document: LegalDocument, onDismiss: () -> Unit) {
    val isTerms = document == LegalDocument.TERMS
    val title = if (isTerms) "Termos de Serviço" else "Política de Privacidade"
    val sections = if (isTerms) termsSections else privacySections

    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(modifier = Modifier.fillMaxSize(), color = LightBg) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Cabeçalho
                Box(modifier = Modifier.fillMaxWidth().background(DarkHeroGradient).statusBarsPadding().padding(horizontal = 20.dp, vertical = 18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(46.dp).background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                            Icon(if (isTerms) Icons.Rounded.Gavel else Icons.Rounded.PrivacyTip, contentDescription = null, tint = Color.White)
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(title, color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
                            Text(LEGAL_UPDATED, color = Color.White.copy(alpha = 0.75f), fontSize = 12.sp)
                        }
                        IconButton(onClick = onDismiss, modifier = Modifier.size(40.dp).background(Color.White.copy(alpha = 0.16f), CircleShape)) {
                            Icon(Icons.Rounded.Close, contentDescription = "Fechar", tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                    }
                }

                // Corpo com scroll
                Column(
                    modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    sections.forEachIndexed { index, section ->
                        Column(
                            modifier = Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(24.dp)).border(1.dp, BorderSoft, RoundedCornerShape(24.dp)).padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(28.dp).background(BrandGradient, CircleShape), contentAlignment = Alignment.Center) {
                                    Text("${index + 1}", color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 13.sp)
                                }
                                Spacer(Modifier.width(10.dp))
                                Text(section.title, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, color = CorporateBlue, modifier = Modifier.weight(1f))
                            }
                            section.blocks.forEach { block -> LegalParagraph(block) }
                        }
                    }
                    Text(
                        "Copyright © Seatly ${Calendar.getInstance().get(Calendar.YEAR)}.",
                        fontSize = 12.sp, color = TextGray, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp)
                    )
                }

                // Rodapé fixo
                Box(modifier = Modifier.fillMaxWidth().background(Color.White).navigationBarsPadding().padding(16.dp)) {
                    GradientButton(text = "Entendi", onClick = onDismiss)
                }
            }
        }
    }
}

/** Renderiza um parágrafo (com marcador, se for item de lista, e partes a negrito). */
@Composable
private fun LegalParagraph(block: LegalBlock) {
    val annotated = buildAnnotatedString {
        if (block.lead != null) withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = CorporateBlue)) { append(block.lead) }
        append(block.text)
        if (block.boldTail != null) withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = CorporateBlue)) { append(block.boldTail) }
        append(block.end)
    }
    Row {
        if (block.bullet) {
            Box(modifier = Modifier.padding(top = 8.dp, end = 10.dp).size(6.dp).background(AccentPurple, CircleShape))
        }
        Text(annotated, fontSize = 14.sp, color = TextGray, lineHeight = 21.sp, modifier = Modifier.weight(1f))
    }
}

/**
 * Formulário de contacto com o suporte.
 *
 * @param onSend envia a mensagem; deve chamar `onSuccess` ou `onError(mensagem)` quando terminar.
 * @param onDismiss fecha o diálogo.
 */
@Composable
fun ContactSupportDialog(
    onSend: (email: String, message: String, onSuccess: () -> Unit, onError: (String) -> Unit) -> Unit,
    onDismiss: () -> Unit
) {
    var email by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }

    ModernAlertDialog(
        title = "Contactar Suporte",
        message = "Envia uma mensagem direta para a equipa técnica. Respondemos para o e-mail que indicares.",
        icon = Icons.Rounded.SupportAgent, iconTint = AccentPurple, iconBg = AccentPurpleLight,
        confirmText = "Enviar", cancelText = "Cancelar", confirmColor = AccentPurple,
        isConfirmLoading = loading,
        onConfirm = {
            when {
                !email.contains("@") || email.length > 254 -> error = "Indica um e-mail válido."
                message.isBlank() -> error = "Escreve a tua mensagem."
                message.length > 2000 -> error = "A mensagem é demasiado longa (máx. 2000 caracteres)."
                else -> {
                    error = ""
                    loading = true
                    onSend(email.trim(), message.trim(), { loading = false; onDismiss() }, { msg -> loading = false; error = msg })
                }
            }
        },
        onDismiss = { if (!loading) onDismiss() },
        content = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SeatlyTextField(value = email, onValueChange = { email = it; error = "" }, label = "O teu e-mail", leadingIcon = Icons.Rounded.Email, keyboardType = KeyboardType.Email)
                SeatlyTextField(value = message, onValueChange = { message = it; error = "" }, label = "Mensagem", singleLine = false, minLines = 3)
                if (error.isNotEmpty()) {
                    Text(error, color = ErrorRed, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
                }
            }
        }
    )
}
