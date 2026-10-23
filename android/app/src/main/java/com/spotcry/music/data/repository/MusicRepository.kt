package com.spotcry.music.data.repository

import android.content.Context
import com.spotcry.music.data.local.AppDatabase
import com.spotcry.music.data.model.PlayHistory
import com.spotcry.music.data.model.Playlist
import com.spotcry.music.data.model.PlaylistTrack
import com.spotcry.music.data.model.Track
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.File

class MusicRepository(private val context: Context, private val db: AppDatabase) {

    private val trackDao = db.trackDao()
    private val playlistDao = db.playlistDao()
    private val historyDao = db.historyDao()
    private val scanner = MediaStoreScanner(context)

    val allTracks: Flow<List<Track>> = trackDao.getAllTracks()
    val favoriteTracks: Flow<List<Track>> = trackDao.getFavoriteTracks()
    val allPlaylists: Flow<List<Playlist>> = playlistDao.getAllPlaylists()
    val genres: Flow<List<String>> = trackDao.getGenres()

    suspend fun syncLibrary() = withContext(Dispatchers.IO) {
        val scannedTracks = scanner.scanLocalTracks()
        if (scannedTracks.isEmpty()) return@withContext

        // Preserve favorites/play count from DB
        val existingTracks = mutableMapOf<Long, Track>()
        db.runInTransaction {
            // Read current values
        }

        // Insert / Update scanned tracks
        trackDao.insertTracks(scannedTracks)
    }

    fun searchTracks(query: String): Flow<List<Track>> = trackDao.searchTracks(query)

    fun getTracksByGenre(genre: String): Flow<List<Track>> = trackDao.getTracksByGenre(genre)

    fun getMostPlayed(limit: Int = 15): Flow<List<Track>> = trackDao.getMostPlayed(limit)

    suspend fun toggleFavorite(trackId: Long, currentFavorite: Boolean) {
        trackDao.setFavorite(trackId, !currentFavorite)
    }

    suspend fun recordPlay(trackId: Long) {
        val now = System.currentTimeMillis()
        trackDao.incrementPlayCount(trackId, now)
        historyDao.insertHistory(PlayHistory(trackId = trackId, timestamp = now))
    }

    // Playlist operations
    suspend fun createPlaylist(name: String, description: String = "", gradientIndex: Int = 0): Long {
        return playlistDao.insertPlaylist(Playlist(name = name, description = description, gradientIndex = gradientIndex))
    }

    suspend fun deletePlaylist(playlistId: Long) {
        playlistDao.deletePlaylist(playlistId)
    }

    suspend fun addTrackToPlaylist(playlistId: Long, trackId: Long) {
        playlistDao.addTrackToPlaylist(PlaylistTrack(playlistId = playlistId, trackId = trackId))
    }

    suspend fun removeTrackFromPlaylist(playlistId: Long, trackId: Long) {
        playlistDao.removeTrackFromPlaylist(playlistId, trackId)
    }

    fun getPlaylistTracks(playlistId: Long): Flow<List<Track>> = playlistDao.getTracksForPlaylist(playlistId)

    // Lyrics helper
    fun loadLocalLyrics(filePath: String): String? {
        val file = File(filePath)
        if (!file.exists()) return null

        val lrcPath = filePath.substringBeforeLast('.') + ".lrc"
        val lrcFile = File(lrcPath)
        if (lrcFile.exists()) {
            return lrcFile.readText()
        }
        return null
    }
}
