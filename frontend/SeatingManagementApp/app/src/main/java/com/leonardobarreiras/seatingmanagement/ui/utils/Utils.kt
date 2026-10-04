package com.leonardobarreiras.seatingmanagement.ui.utils

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Extrai o nome da mesa a partir do número do lugar (formato "MESA-LUGAR", ex.: "A-12" → "A").
 * Lugares sem separador ficam agrupados em "Geral".
 */
fun getMesaFromSeat(seatNumber: String): String {
    val split = seatNumber.split("-")
    if (split.size > 1) return split[0].trim()
    return "Geral"
}

/** Formata a data ISO do servidor ("yyyy-MM-ddTHH:mm:ss") para "dd MMM yyyy"; devolve "Data a definir" se inválida. */
fun formatEventDate(dateString: String?): String {
    if (dateString.isNullOrEmpty() || dateString == "0001-01-01T00:00:00") return "Data a definir"
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd MMM yyyy", Locale("pt", "PT"))
        val date = inputFormat.parse(dateString.substringBefore("Z").substringBefore("."))
        if (date != null) outputFormat.format(date) else "Data a definir"
    } catch (e: Exception) { "Data a definir" }
}

/** Fase temporal de um evento, usada para mostrar uma etiqueta no cartão. */
enum class EventPhase { UPCOMING, LIVE, FINISHED }

/**
 * Calcula a fase do evento face à data atual.
 *
 * Se a data de fim não tiver hora (meia-noite), considera-se que o evento decorre até ao fim desse dia.
 * Devolve `null` quando as datas não existem ou não podem ser lidas (a etiqueta simplesmente não aparece).
 */
fun eventPhase(startDate: String?, endDate: String?, now: Date = Date()): EventPhase? {
    fun parse(value: String?): Date? {
        if (value.isNullOrEmpty() || value.startsWith("0001")) return null
        return try {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault()).parse(value.substringBefore("Z").substringBefore("."))
        } catch (e: Exception) { null }
    }
    val parsedStart = parse(startDate)
    val parsedEnd = parse(endDate)
    if (parsedStart == null && parsedEnd == null) return null
    val oneDayMs = 24L * 60 * 60 * 1000
    val endsAtMidnight = (endDate ?: startDate ?: "").contains("T00:00:00")
    val endRaw = parsedEnd ?: parsedStart!!
    val end = if (endsAtMidnight) Date(endRaw.time + oneDayMs) else endRaw
    // Data de início inválida (ex.: ano 2206 por engano, posterior ao fim) é ignorada:
    // o evento considera-se iniciado e o estado depende apenas da data de fim.
    val start = if (parsedStart == null || parsedStart.after(end)) Date(0) else parsedStart
    return when {
        now.before(start) -> EventPhase.UPCOMING
        now.after(end) -> EventPhase.FINISHED
        else -> EventPhase.LIVE
    }
}
