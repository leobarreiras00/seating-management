package com.leonardobarreiras.seatingmanagement.data

import android.util.Base64
import org.json.JSONObject

/**
 * Utilitários para ler claims do JWT localmente (sem validar assinatura —
 * a validação é sempre feita pelo servidor; aqui só queremos o nome para mostrar).
 */
object JwtUtils {
    private const val CLAIM_NAME = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"

    private fun payload(token: String): JSONObject? = try {
        val part = token.split(".").getOrNull(1) ?: return null
        val bytes = Base64.decode(part, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        JSONObject(String(bytes, Charsets.UTF_8))
    } catch (e: Exception) {
        null
    }

    /** Nome da pessoa (gestor/staff) presente no token, ou null se não existir. */
    fun displayName(token: String?): String? {
        if (token.isNullOrBlank()) return null
        val json = payload(token) ?: return null
        val name = json.optString(CLAIM_NAME).ifBlank { json.optString("name") }
        return name.trim().takeIf { it.isNotEmpty() }
    }

    /** Indica se um texto parece um e-mail (para corrigir sessões antigas guardadas com e-mail). */
    fun looksLikeEmail(value: String): Boolean = value.contains("@")

    /** Nome a mostrar: claim do token → fallback legível a partir do e-mail. */
    fun resolveName(token: String?, emailFallback: String): String {
        displayName(token)?.let { if (!looksLikeEmail(it)) return it }
        val base = (displayName(token) ?: emailFallback).substringBefore("@")
        return base.replace('.', ' ').replace('_', ' ')
            .split(' ').filter { it.isNotBlank() }
            .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
            .ifBlank { emailFallback }
    }
}
