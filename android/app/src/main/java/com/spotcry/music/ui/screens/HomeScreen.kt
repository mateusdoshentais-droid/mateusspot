package com.spotcry.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.spotcry.music.data.model.Track
import com.spotcry.music.ui.components.TrackItem
import com.spotcry.music.ui.theme.*
import java.util.Calendar

@Composable
fun HomeScreen(
    tracks: List<Track>,
    mostPlayed: List<Track>,
    currentPlayingTrack: Track?,
    onTrackClick: (Track) -> Unit,
    onFavoriteToggle: (Track) -> Unit,
    onScanRequest: () -> Unit
) {
    val greeting = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
        in 5..11 -> "Bom dia"
        in 12..17 -> "Boa tarde"
        else -> "Boa noite"
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(SpotBackground),
        contentPadding = PaddingValues(bottom = 96.dp)
    ) {
        // Top Header Greeting
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 20.dp)
            ) {
                Text(
                    text = greeting,
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = SpotTextPrimary
                )
                Text(
                    text = "SpotCry Android",
                    style = MaterialTheme.typography.bodyMedium,
                    color = SpotGreen
                )
            }
        }

        // Quick Scan / Info Banner if library is empty
        if (tracks.isEmpty()) {
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    colors = CardDefaults.cardColors(containerColor = SpotSurfaceVariant)
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Nenhuma música encontrada",
                            style = MaterialTheme.typography.titleMedium,
                            color = SpotTextPrimary
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Escaneie o armazenamento do dispositivo para encontrar suas músicas locais.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = SpotTextSecondary,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = onScanRequest,
                            colors = ButtonDefaults.buttonColors(containerColor = SpotGreen)
                        ) {
                            Text("Escanear Músicas", color = SpotBackground)
                        }
                    }
                }
            }
        } else {
            // Recently / Top Played Grid Cards
            item {
                Text(
                    text = "Mais Tocadas",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = SpotTextPrimary,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )

                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(mostPlayed.take(8)) { track ->
                        TopTrackCard(
                            track = track,
                            onClick = { onTrackClick(track) }
                        )
                    }
                }
            }

            // All Tracks Header
            item {
                Spacer(modifier = Modifier.height(24.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Sua Biblioteca (${tracks.size})",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = SpotTextPrimary
                    )
                    TextButton(onClick = onScanRequest) {
                        Text("Atualizar", color = SpotGreen)
                    }
                }
            }

            // Track List
            items(tracks) { track ->
                TrackItem(
                    track = track,
                    isPlaying = currentPlayingTrack?.id == track.id,
                    onClick = { onTrackClick(track) },
                    onFavoriteToggle = { onFavoriteToggle(track) }
                )
            }
        }
    }
}

@Composable
private fun TopTrackCard(
    track: Track,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier
            .width(140.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() },
        color = SpotSurfaceVariant
    ) {
        Column(
            modifier = Modifier.padding(10.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(SpotSurface),
                contentAlignment = Alignment.Center
            ) {
                if (!track.albumArtUri.isNullOrEmpty()) {
                    AsyncImage(
                        model = track.albumArtUri,
                        contentDescription = track.album,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Default.MusicNote,
                        contentDescription = null,
                        tint = SpotTextMuted,
                        modifier = Modifier.size(48.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = track.title,
                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                color = SpotTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = track.artist,
                style = MaterialTheme.typography.bodySmall,
                color = SpotTextSecondary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
