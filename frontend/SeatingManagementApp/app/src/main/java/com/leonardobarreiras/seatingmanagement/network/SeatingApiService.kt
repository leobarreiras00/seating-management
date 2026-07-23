package com.leonardobarreiras.seatingmanagement.network

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

data class LoginRequest(val username: String, val password: String)
// 👇 ATUALIZADO: Recebe o Role do utilizador
data class AuthResponse(val token: String, val userGuid: String?, val pin: String?, val role: String?, val companyName: String?, val companyLogo: String?)
data class ValidateTicketRequest(val eventId: Int, val ticketHash: String)
data class ValidateTicketResponse(val message: String, val seat: SeatEntity)
data class BulkUpdateStatusRequest(val status: String)
data class ClearDatabaseDto(val pin: String)

// 👇 ADICIONADO: Modelo para listar os eventos do utilizador
data class EventDto(val id: Int, val name: String, val startDate: String?)

data class UpdateSingleSeatRequest(val status: Int)

interface SeatingApiService {

    @POST("api/Auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    // 👇 ADICIONADO: Endpoint para ir buscar os eventos com permissão
    @GET("api/Event/my-events")
    suspend fun getMyEvents(@Header("Authorization") token: String): Response<List<EventDto>>

    @GET("api/Seat/{eventId}")
    suspend fun getSeatsByEvent(@Header("Authorization") token: String, @Path("eventId") eventId: Int): List<SeatEntity>

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
        @Path("eventId") eventId: Int,
        @Body request: ClearDatabaseDto
    ): Response<Unit>

    @POST("api/SeatCsv/remove-duplicates/{eventId}")
    suspend fun removeDuplicates(
        @Header("Authorization") token: String,
        @Path("eventId") eventId: Int,
        @Body request: ClearDatabaseDto
    ): Response<Unit>
}

object RetrofitClient {
    private const val BASE_URL = "http://10.0.2.2:5162/"

    val apiService: SeatingApiService by lazy {
        Retrofit.Builder().baseUrl(BASE_URL).addConverterFactory(GsonConverterFactory.create()).build().create(SeatingApiService::class.java)
    }
}