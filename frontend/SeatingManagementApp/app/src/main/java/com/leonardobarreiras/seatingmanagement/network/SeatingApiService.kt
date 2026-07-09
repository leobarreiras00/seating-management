package com.leonardobarreiras.seatingmanagement.network

import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

// Modelos para o Login
data class LoginRequest(val username: String, val password: String)
data class AuthResponse(val token: String)

// MODELOS PARA O QR CODE
data class ValidateTicketRequest(val eventId: Int, val ticketHash: String)
data class ValidateTicketResponse(val message: String, val seat: SeatEntity)

interface SeatingApiService {

    @POST("api/Auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @GET("api/Seat")
    suspend fun getAllSeats(@Header("Authorization") token: String): List<SeatEntity>

    // 👇 NOVA ROTA: Validar o Bilhete 👇
    @POST("api/Seat/validate-ticket")
    suspend fun validateTicket(
        @Header("Authorization") token: String,
        @Body request: ValidateTicketRequest
    ): ValidateTicketResponse
}

object RetrofitClient {
    private const val BASE_URL = "http://10.0.2.2:5162/"

    val apiService: SeatingApiService by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(SeatingApiService::class.java)
    }
}