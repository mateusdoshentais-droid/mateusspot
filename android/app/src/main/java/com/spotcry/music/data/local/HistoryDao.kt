package com.spotcry.music.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.spotcry.music.data.model.PlayHistory
import kotlinx.coroutines.flow.Flow

data class PeriodStats(
    val dayPlays: Int,
    val weekPlays: Int,
    val monthPlays: Int,
    val totalPlays: Int
)

@Dao
interface HistoryDao {

    @Insert
    suspend fun insertHistory(history: PlayHistory)

    @Query("SELECT COUNT(*) FROM play_history WHERE timestamp >= :since")
    fun getPlaysSince(since: Long): Flow<Int>

    @Query("SELECT COUNT(*) FROM play_history")
    fun getTotalPlays(): Flow<Int>

    @Query("""
        SELECT trackId, COUNT(*) as playCount 
        FROM play_history 
        WHERE timestamp >= :since 
        GROUP BY trackId 
        ORDER BY playCount DESC 
        LIMIT :limit
    """)
    suspend fun getTopTrackIdsSince(since: Long, limit: Int): List<TopTrackStat>
}

data class TopTrackStat(
    val trackId: Long,
    val playCount: Int
)
