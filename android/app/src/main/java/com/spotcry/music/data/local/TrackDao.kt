package com.spotcry.music.data.local

import androidx.room.*
import com.spotcry.music.data.model.Track
import kotlinx.coroutines.flow.Flow

@Dao
interface TrackDao {

    @Query("SELECT * FROM tracks ORDER BY title ASC")
    fun getAllTracks(): Flow<List<Track>>

    @Query("SELECT * FROM tracks WHERE id = :id")
    suspend fun getTrackById(id: Long): Track?

    @Query("SELECT * FROM tracks WHERE isFavorite = 1 ORDER BY title ASC")
    fun getFavoriteTracks(): Flow<List<Track>>

    @Query("SELECT * FROM tracks WHERE title LIKE '%' || :query || '%' OR artist LIKE '%' || :query || '%' OR album LIKE '%' || :query || '%' OR genre LIKE '%' || :query || '%' ORDER BY title ASC")
    fun searchTracks(query: String): Flow<List<Track>>

    @Query("SELECT DISTINCT genre FROM tracks WHERE genre != '' AND genre != 'Desconhecido' ORDER BY genre ASC")
    fun getGenres(): Flow<List<String>>

    @Query("SELECT * FROM tracks WHERE genre = :genre ORDER BY title ASC")
    fun getTracksByGenre(genre: String): Flow<List<Track>>

    @Query("SELECT * FROM tracks ORDER BY playCount DESC LIMIT :limit")
    fun getMostPlayed(limit: Int): Flow<List<Track>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTracks(tracks: List<Track>)

    @Update
    suspend fun updateTrack(track: Track)

    @Query("UPDATE tracks SET isFavorite = :isFavorite WHERE id = :trackId")
    suspend fun setFavorite(trackId: Long, isFavorite: Boolean)

    @Query("UPDATE tracks SET playCount = playCount + 1, lastPlayed = :lastPlayed WHERE id = :trackId")
    suspend fun incrementPlayCount(trackId: Long, lastPlayed: Long = System.currentTimeMillis())

    @Query("DELETE FROM tracks WHERE id NOT IN (:validIds)")
    suspend fun deleteTracksNotIn(validIds: List<Long>)
}
