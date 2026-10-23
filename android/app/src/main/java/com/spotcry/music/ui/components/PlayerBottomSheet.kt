package com.spotcry.music.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.spotcry.music.data.model.Track
import com.spotcry.music.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerBottomSheet(
    track: Track?,
    isPlaying: Boolean,
    currentPosition: Long,
    duration: Long,
    isShuffle: Boolean,
    isRepeat: Boolean,
    onPlayPauseClick: () -> Unit,
    onSkipNextClick: () -> Unit,
    onSkipPreviousClick: () -> Unit,
    onSeekTo: (Long) -> Unit,
    onShuffleToggle: () -> Unit,
    onRepeatToggle: () -> Unit,
    onFavoriteToggle: () -> Unit,
    onLyricsClick: () -> Unit,
    onDismiss: () -> Unit
) {
    if (track == null) return

    val bgBrush = Brush.verticalGradient(
        colors = listOf(
            SpotSurfaceVariant,
            SpotBackground,
            SpotBackground
        )
    )

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = SpotBackground
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(bgBrush)
                .padding(horizontal = 24.dp)
                .padding(top = 16.dp, bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.KeyboardArrowDown,
                        contentDescription = "Fechar Player",
                        tint = SpotTextPrimary,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Text(
                    text = "TOCANDO DO ÁLBUM",
                    style = MaterialTheme.typography.labelMedium,
                    color = SpotTextMuted
                )

                IconButton(onClick = { /* More options */ }) {
                    Icon(
                        imageVector = Icons.Default.MoreVert,
                        contentDescription = "Opções",
                        tint = SpotTextPrimary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Large Album Artwork
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .clip(RoundedCornerShape(16.dp))
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
                        modifier = Modifier.size(96.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Track Info & Favorite
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = track.title,
                        style = MaterialTheme.typography.headlineSmall,
                        color = SpotTextPrimary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "${track.artist} • ${track.album}",
                        style = MaterialTheme.typography.bodyLarge,
                        color = SpotTextSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                IconButton(onClick = onFavoriteToggle) {
                    Icon(
                        imageVector = if (track.isFavorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        contentDescription = "Favoritar",
                        tint = if (track.isFavorite) SpotGreen else SpotTextPrimary,
                        modifier = Modifier.size(28.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Seek Bar & Timers
            Column(
                modifier = Modifier.fillMaxWidth()
            ) {
                val sliderPosition = if (duration > 0) currentPosition.toFloat() / duration.toFloat() else 0f

                Slider(
                    value = sliderPosition,
                    onValueChange = { percent ->
                        onSeekTo((percent * duration).toLong())
                    },
                    colors = SliderDefaults.colors(
                        thumbColor = SpotTextPrimary,
                        activeTrackColor = SpotGreen,
                        inactiveTrackColor = SpotSurfaceVariant
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val posMin = (currentPosition / 1000) / 60
                    val posSec = (currentPosition / 1000) % 60
                    val durMin = (duration / 1000) / 60
                    val durSec = (duration / 1000) % 60

                    Text(
                        text = String.format("%d:%02d", posMin, posSec),
                        style = MaterialTheme.typography.labelSmall,
                        color = SpotTextMuted
                    )
                    Text(
                        text = String.format("%d:%02d", durMin, durSec),
                        style = MaterialTheme.typography.labelSmall,
                        color = SpotTextMuted
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Main Controls (Shuffle, Prev, Play/Pause, Next, Repeat)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onShuffleToggle) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = "Aleatório",
                        tint = if (isShuffle) SpotGreen else SpotTextMuted
                    )
                }

                IconButton(onClick = onSkipPreviousClick) {
                    Icon(
                        imageVector = Icons.Default.SkipPrevious,
                        contentDescription = "Anterior",
                        tint = SpotTextPrimary,
                        modifier = Modifier.size(36.dp)
                    )
                }

                // Play / Pause Circle
                Surface(
                    onClick = onPlayPauseClick,
                    shape = CircleShape,
                    color = SpotGreen,
                    modifier = Modifier.size(64.dp)
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier.fillMaxSize()
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                            contentDescription = if (isPlaying) "Pausar" else "Play",
                            tint = SpotBackground,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }

                IconButton(onClick = onSkipNextClick) {
                    Icon(
                        imageVector = Icons.Default.SkipNext,
                        contentDescription = "Próxima",
                        tint = SpotTextPrimary,
                        modifier = Modifier.size(36.dp)
                    )
                }

                IconButton(onClick = onRepeatToggle) {
                    Icon(
                        imageVector = Icons.Default.Repeat,
                        contentDescription = "Repetir",
                        tint = if (isRepeat) SpotGreen else SpotTextMuted
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Bottom Actions (Lyrics)
            OutlinedButton(
                onClick = onLyricsClick,
                shape = RoundedCornerShape(20.dp),
                border = ButtonDefaults.outlinedButtonBorder.copy(brush = Brush.horizontalGradient(listOf(SpotGreen, SpotPurple)))
            ) {
                Icon(
                    imageVector = Icons.Default.Subtitles,
                    contentDescription = null,
                    tint = SpotTextPrimary,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Letras da Música",
                    color = SpotTextPrimary,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}
