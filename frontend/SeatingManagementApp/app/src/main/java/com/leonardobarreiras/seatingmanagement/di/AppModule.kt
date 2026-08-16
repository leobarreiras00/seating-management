package com.leonardobarreiras.seatingmanagement.di

import android.content.Context
import com.leonardobarreiras.seatingmanagement.data.AppDatabase
import com.leonardobarreiras.seatingmanagement.data.SeatDao
import com.leonardobarreiras.seatingmanagement.data.SeatRepository
import com.leonardobarreiras.seatingmanagement.data.SecureStorage
import com.leonardobarreiras.seatingmanagement.network.SeatingApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): AppDatabase {
        return AppDatabase.getDatabase(context)
    }

    @Provides
    @Singleton
    fun provideSeatDao(database: AppDatabase): SeatDao {
        return database.seatDao()
    }

    @Provides
    @Singleton
    fun provideSeatRepository(seatDao: SeatDao): SeatRepository {
        return SeatRepository(seatDao)
    }

    @Provides
    @Singleton
    fun provideSecureStorage(@ApplicationContext context: Context): SecureStorage {
        return SecureStorage(context)
    }

    // O Hilt constrói a API
    @Provides
    @Singleton
    fun provideSeatingApiService(): SeatingApiService {
        return Retrofit.Builder()
            .baseUrl("https://api-seatly-f4e8bqh0e2bvd5hb.francecentral-01.azurewebsites.net/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(SeatingApiService::class.java)
    }
}