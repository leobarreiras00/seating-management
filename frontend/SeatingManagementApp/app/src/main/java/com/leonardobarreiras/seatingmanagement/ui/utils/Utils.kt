package com.leonardobarreiras.seatingmanagement.ui.utils

import java.text.SimpleDateFormat
import java.util.Locale

fun getMesaFromSeat(seatNumber: String): String {
    val split = seatNumber.split("-")
    if (split.size > 1) return split[0].trim()
    return "Geral"
}

fun formatEventDate(dateString: String?): String {
    if (dateString.isNullOrEmpty() || dateString == "0001-01-01T00:00:00") return "Data a definir"
    return try {
        val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.getDefault())
        val outputFormat = SimpleDateFormat("dd MMM yyyy", Locale("pt", "PT"))
        val date = inputFormat.parse(dateString.substringBefore("Z").substringBefore("."))
        if (date != null) outputFormat.format(date) else "Data a definir"
    } catch (e: Exception) { "Data a definir" }
}