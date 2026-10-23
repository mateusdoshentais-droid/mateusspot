package com.spotcry.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.spotcry.music.data.model.Playlist
import com.spotcry.music.data.model.Track
import com.spotcry.music.ui.components.TrackItem
import com.spotcry.music.ui.theme.*

@Composable
fun PlaylistDetailScreen(
    playlist: Playlist,
    tracks: List<Track>,
    currentPlayingTrack: Track?,
    onBackClick: () -> Unit,
    onPlayAllClick: () -> Unit,
    onShuffleClick: () -> Unit,
    onTrackClick: (Track) -> Unit,
    onRemoveTrack: (Track) -> Unit,
    onDeletePlaylist: () -> Unit
) {
    val gradientColors = PlaylistGradients.getOrElse(playlist.gradientIndex % PlaylistGradients.size) { PlaylistGradients[0] }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SpotBackground)
    ) {
        // Top Header
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp)
                .background(Brush.verticalGradient(gradientColors + listOf(SpotBackground)))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                IconButton(onClick = onBackClick) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Voltar",
                        tint = Color.White
                    )
                }

                Spacer(modifier = Modifier.weight(1f))

                Text(
                    text = playlist.name,
                    style = MaterialTheme.typography.headlineLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
                if (playlist.description.isNotBlank()) {
                    Text(
                        text = playlist.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = SpotTextSecondary
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${tracks.size} músicas",
                    style = MaterialTheme.typography.labelMedium,
                    color = SpotTextMuted
                )
            }
        }

        // Action Buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                FloatingActionButton(
                    onClick = onPlayAllClick,
                    containerColor = SpotGreen,
                    contentColor = SpotBackground,
                    shape = CircleShape,
                    modifier = Modifier.size(52.dp)
                ) {
                    Icon(imageVector = Icons.Default.PlayArrow, contentDescription = "Reproduzir")
                }

                Spacer(modifier = Modifier.width(16.dp))

                IconButton(onClick = onShuffleClick) {
                    Icon(imageVector = Icons.Default.Shuffle, contentDescription = "Aleatório", tint = SpotGreen)
                }
            }

            IconButton(onClick = onDeletePlaylist) {
                Icon(imageVector = Icons.Default.Delete, contentDescription = "Excluir Playlist", tint = SpotTextMuted)
            }
        }

        // Playlist Tracks List
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 96.dp)
        ) {
            items(tracks) { track ->
                TrackItem(
                    track = track,
                    isPlaying = currentPlayingTrack?.id == track.id,
                    onClick = { onTrackClick(track) },
                    onFavoriteToggle = { },
                    onMoreClick = { onRemoveTrack(track) }
                )
            }
        }
    }
}
