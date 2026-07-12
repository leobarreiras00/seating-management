package com.leonardobarreiras.seatingmanagement.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface SeatDao {

    @Query("SELECT * FROM seats")
    fun getAllSeats(): Flow<List<SeatEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(seats: List<SeatEntity>)

    @Query("UPDATE seats SET status = :newStatus, isPendingSync = :isPending WHERE id = :seatId")
    suspend fun updateSeatStatus(seatId: Int, newStatus: Int, isPending: Boolean)

    @Query("SELECT * FROM seats WHERE isPendingSync = 1")
    suspend fun getPendingSyncSeats(): List<SeatEntity>

    @Query("DELETE FROM seats")
    suspend fun deleteAllSeats()
}