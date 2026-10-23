package com.spotcry.music.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "tracks")
data class Track(
    @PrimaryKey val id: Long,
    val mediaStoreId: Long,
    val title: String,
    val artist: String,
    val album: String,
    val genre: String = "Desconhecido",
    val duration: Long = 0L,
    val filePath: String,
    val albumArtUri: String? = null,
    val isFavorite: Boolean = false,
    val playCount: Int = 0,
    val lastPlayed: Long = 0L,
    val trackNumber: Int = 0
)
