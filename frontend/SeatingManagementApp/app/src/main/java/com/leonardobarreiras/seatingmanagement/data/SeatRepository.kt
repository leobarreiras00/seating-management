package com.leonardobarreiras.seatingmanagement.data

import kotlinx.coroutines.flow.Flow

class SeatRepository(private val seatDao: SeatDao) {

    // O Ecrã (UI) vai ler esta variável.
    // Como é um 'Flow', sempre que a Base de Dados mudar, o ecrã atualiza sozinho!
    val allSeats: Flow<List<SeatEntity>> = seatDao.getAllSeats()

    // O MQTT vai chamar esta função quando receber a mensagem {"id": X, "s": Y}
    suspend fun updateSeatStatusLocally(id: Int, status: Int) {
        seatDao.updateSeatStatus(id, status)
    }

    suspend fun insertAll(seats: List<SeatEntity>) {
        seatDao.insertAll(seats)
    }

    suspend fun deleteAllSeats() {
        seatDao.deleteAllSeats()
    }

    // Mais tarde, adicionaremos aqui a chamada à API (Retrofit)
    // suspend fun syncWithServer() { ... }
}