package com.spotcry.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spotcry.music.data.model.Track
import com.spotcry.music.ui.components.TrackItem
import com.spotcry.music.ui.theme.*

@Composable
fun StatsScreen(
    mostPlayed: List<Track>,
    totalTracks: Int,
    currentPlayingTrack: Track?,
    onTrackClick: (Track) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SpotBackground)
    ) {
        // Header
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "Estatísticas de Reprodução",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = SpotTextPrimary
            )
            Text(
                text = "Resumo dos seus hábitos musicais no SpotCry",
                style = MaterialTheme.typography.bodyMedium,
                color = SpotTextSecondary
            )
        }

        // Summary Cards
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = SpotSurfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Icon(imageVector = Icons.Default.Headphones, contentDescription = null, tint = SpotGreen)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "$totalTracks", style = MaterialTheme.typography.headlineSmall, color = SpotTextPrimary)
                    Text(text = "Músicas Salvas", style = MaterialTheme.typography.bodySmall, color = SpotTextSecondary)
                }
            }

            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = SpotSurfaceVariant)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Icon(imageVector = Icons.Default.BarChart, contentDescription = null, tint = SpotPurple)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "${mostPlayed.sumOf { it.playCount }}", style = MaterialTheme.typography.headlineSmall, color = SpotTextPrimary)
                    Text(text = "Reproduções Totais", style = MaterialTheme.typography.bodySmall, color = SpotTextSecondary)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Top Músicas Mais Tocadas",
            style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
            color = SpotTextPrimary,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 96.dp)
        ) {
            items(mostPlayed) { track ->
                TrackItem(
                    track = track,
                    isPlaying = currentPlayingTrack?.id == track.id,
                    onClick = { onTrackClick(track) },
                    onFavoriteToggle = { }
                )
            }
        }
    }
}
