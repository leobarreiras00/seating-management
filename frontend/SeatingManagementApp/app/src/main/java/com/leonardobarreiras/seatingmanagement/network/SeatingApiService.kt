package com.leonardobarreiras.seatingmanagement.network

import com.google.gson.annotations.SerializedName
import com.leonardobarreiras.seatingmanagement.data.SeatEntity
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

data class LoginRequest(val email: String, val password: String)
data class AuthResponse(val token: String, val userGuid: String?, val role: String?, val companyName: String?, val companyLogo: String?)

data class ForgotPasswordRequest(val email: String)
data class FirstLoginResetRequest(val email: String, val temporaryPassword: String, val newPassword: String)

data class ValidateTicketRequest(val eventId: Int, val ticketHash: String)
data class ValidateTicketResponse(val message: String, val seat: SeatEntity)
data class BulkUpdateStatusRequest(val status: String)
data class EventDto(val id: Int, val name: String, val startDate: String?, val endDate: String?)
data class UpdateSingleSeatRequest(val status: Int)
data class CompanyDto(@SerializedName("name") val name: String, @SerializedName("logoUrl") val logoUrl: String?)

/** Pedido do formulário de contacto com o suporte. */
data class ContactRequest(val email: String, val message: String)

data class ChangePasswordRequest(val oldPassword: String, val newPassword: String)
data class GenericResponse(val message: String)

/**
 * Endpoints REST do backend Seatly (Retrofit). Os pedidos autenticados enviam `Authorization: Bearer {token}`.
 */
interface SeatingApiService {

    @POST("api/Auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    // Novos Endpoints
    /** Envia uma mensagem para a equipa de suporte (endpoint público, sem token). */
    @POST("api/Auth/contact")
    suspend fun contactSupport(@Body request: ContactRequest): Response<GenericResponse>

    @POST("api/Auth/forgot-password")
    suspend fun forgotPassword(@Body request: ForgotPasswordRequest): Response<GenericResponse>

    @POST("api/Auth/first-login-reset")
    suspend fun firstLoginReset(@Body request: FirstLoginResetRequest): AuthResponse

    @GET("api/Company/my-company")
    suspend fun getMyCompany(@Header("Authorization") token: String): Response<CompanyDto>

    @GET("api/Event/my-events")
    suspend fun getMyEvents(@Header("Authorization") token: String): Response<List<EventDto>>

    @GET("api/Seat/{eventId}")
    suspend fun getSeatsByEvent(@Header("Authorization") token: String, @Path("eventId") eventId: Int): List<SeatEntity>

    @PUT("api/Auth/change-password")
    suspend fun changePassword(@Header("Authorization") token: String, @Body request: ChangePasswordRequest): Response<GenericResponse>

    @POST("api/Seat/validate-ticket")
    suspend fun validateTicket(@Header("Authorization") token: String, @Body request: ValidateTicketRequest): ValidateTicketResponse

    @PUT("api/seat/{eventId}/bulk-status")
    suspend fun bulkUpdateStatus(@Header("Authorization") token: String, @Path("eventId") eventId: Int, @Body request: BulkUpdateStatusRequest): Response<Unit>

    @PUT("api/seat/{eventId}/update/{seatId}")
    suspend fun updateSingleSeat(
        @Header("Authorization") token: String,
        @Path("eventId") eventId: Int,
        @Path("seatId") seatId: Int,
        @Body request: UpdateSingleSeatRequest
    ): Response<Unit>

    @Multipart
    @POST("api/SeatCsv/import/{eventId}")
    suspend fun uploadCsv(
        @Header("Authorization") token: String,
        @Path("eventId") eventId: Int,
        @Query("mode") mode: String,
        @Part file: MultipartBody.Part
    ): Response<Unit>

    @POST("api/SeatCsv/clear/{eventId}")
    suspend fun clearEventData(
        @Header("Authorization") token: String,
        @Path("eventId") eventId: Int
    ): Response<Unit>
}

/**
 * Cliente Retrofit de referência com o endereço do servidor de produção.
 */
object RetrofitClient {
    private val BASE_URL: String = com.leonardobarreiras.seatingmanagement.BuildConfig.API_BASE_URL

    val apiService: SeatingApiService by lazy {
        Retrofit.Builder().baseUrl(BASE_URL).addConverterFactory(GsonConverterFactory.create()).build().create(SeatingApiService::class.java)
    }
}