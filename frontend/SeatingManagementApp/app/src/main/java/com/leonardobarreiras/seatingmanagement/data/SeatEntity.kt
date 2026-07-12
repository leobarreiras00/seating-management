package com.leonardobarreiras.seatingmanagement.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "seats")
data class SeatEntity(
    @PrimaryKey val id: Int,
    val seatNumber: String,
    val eventName: String,
    val status: Int,
    val assignedTo: String?,
    val version: Long,
    val isPendingSync: Boolean = false
)