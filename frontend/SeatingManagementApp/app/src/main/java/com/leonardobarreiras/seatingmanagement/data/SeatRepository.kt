package com.leonardobarreiras.seatingmanagement.data

import kotlinx.coroutines.flow.Flow

class SeatRepository(private val seatDao: SeatDao) {

    val allSeats: Flow<List<SeatEntity>> = seatDao.getAllSeats()

    suspend fun updateSeatStatusLocally(id: Int, status: Int, isPendingSync: Boolean = false, markedAt: String? = null) {
        seatDao.updateSeatStatus(id, status, isPendingSync, markedAt)
    }

    suspend fun insertAll(seats: List<SeatEntity>) {
        seatDao.insertAll(seats)
    }

    suspend fun deleteAllSeats() {
        seatDao.deleteAllSeats()
    }

    suspend fun getPendingSyncSeats(): List<SeatEntity> {
        return seatDao.getPendingSyncSeats()
    }
}