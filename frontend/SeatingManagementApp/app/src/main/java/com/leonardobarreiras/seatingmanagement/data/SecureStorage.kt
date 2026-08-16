package com.leonardobarreiras.seatingmanagement.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

data class UserSession(
    val token: String,
    val role: String,
    val companyName: String,
    val companyLogo: String,
    val managerName: String,
    val userGuid: String
)

class SecureStorage(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "seatly_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveSession(session: UserSession) {
        prefs.edit()
            .putString("token", session.token)
            .putString("role", session.role)
            .putString("companyName", session.companyName)
            .putString("companyLogo", session.companyLogo)
            .putString("managerName", session.managerName)
            .putString("userGuid", session.userGuid)
            .apply()
    }

    fun getSession(): UserSession? {
        val token = prefs.getString("token", null) ?: return null
        return UserSession(
            token = token,
            role = prefs.getString("role", "Utilizador") ?: "Utilizador",
            companyName = prefs.getString("companyName", "Seatly") ?: "Seatly",
            companyLogo = prefs.getString("companyLogo", "") ?: "",
            managerName = prefs.getString("managerName", "") ?: "",
            userGuid = prefs.getString("userGuid", "") ?: ""
        )
    }

    fun savePin(pin: String) = prefs.edit().putString("pin", pin).apply()
    fun getPin(): String? = prefs.getString("pin", null)
    fun hasPin(): Boolean = prefs.contains("pin")
    fun clearPin() = prefs.edit().remove("pin").apply()

    fun clearSession() = prefs.edit().clear().apply()
}