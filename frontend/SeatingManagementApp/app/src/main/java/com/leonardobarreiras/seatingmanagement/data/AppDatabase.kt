package com.leonardobarreiras.seatingmanagement.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

// 1. Declaramos que esta base de dados tem a tabela SeatEntity
@Database(entities = [SeatEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    // 2. Ligamos a base de dados ao nosso DAO
    abstract fun seatDao(): SeatDao

    // 3. O Padrão Singleton (Para poupar a bateria do telemóvel)
    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "seating_database" // O nome do ficheiro físico no telemóvel
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}