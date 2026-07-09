package com.leonardobarreiras.seatingmanagement.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SeatDao {

    // 1. Vai buscar todos os lugares e envia-os para o ecrã.
    // O "Flow" é mágico: se a base de dados mudar, o ecrã atualiza automaticamente!
    @Query("SELECT * FROM seats")
    fun getAllSeats(): Flow<List<SeatEntity>>

    // 2. Guarda uma lista de lugares (útil quando sacas tudo da API na 1ª vez).
    // Se o lugar já existir (mesmo ID), ele substitui (REPLACE).
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(seats: List<SeatEntity>)

    // 3. O nosso update hiper-rápido para o MQTT!
    // Recebe o ID e o Estado novo, e muda APENAS esse lugar sem tocar no resto.
    @Query("UPDATE seats SET status = :newStatus WHERE id = :seatId")
    suspend fun updateSeatStatus(seatId: Int, newStatus: Int)

    @Query("DELETE FROM seats")
    suspend fun deleteAllSeats()
}