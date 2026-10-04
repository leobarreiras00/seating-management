package com.leonardobarreiras.seatingmanagement.ui.theme

import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// --- Identidade Seatly (alinhada com o backoffice: roxo → azul vibrante) ---
val CorporateBlue = Color(0xFF1E1B4B)      // Índigo profundo (texto principal / superfícies escuras)
val LightBg = Color(0xFFF5F3FF)            // Fundo lavanda suave
val PrimaryBlue = Color(0xFF4F46E5)        // Índigo vivo
val AccentPurple = Color(0xFF7C3AED)       // Roxo da marca
val AccentPurpleLight = Color(0xFFEDE9FE)
val SuccessGreen = Color(0xFF10B981)
val SuccessGreenLight = Color(0xFFD1FAE5)
val ErrorRed = Color(0xFFEF4444)
val ErrorRedLight = Color(0xFFFEE2E2)
val WarningAmber = Color(0xFFF59E0B)
val WarningAmberLight = Color(0xFFFEF3C7)
val OfflineGray = Color(0xFF94A3B8)
val TextGray = Color(0xFF6B7280)
val BorderSoft = Color(0xFFE9E5FF)
val SurfaceWhite = Color(0xFFFFFFFF)

// Gradientes reutilizáveis
val BrandGradient: Brush = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF4F46E5), Color(0xFF2563EB)))
val BrandGradientSoft: Brush = Brush.linearGradient(listOf(Color(0xFFEDE9FE), Color(0xFFDBEAFE)))
val DarkHeroGradient: Brush = Brush.linearGradient(listOf(Color(0xFF1E1B4B), Color(0xFF4C1D95), Color(0xFF312E81)))
