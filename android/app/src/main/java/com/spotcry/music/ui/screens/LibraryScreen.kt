package com.spotcry.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.QueueMusic
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
fun LibraryScreen(
    tracks: List<Track>,
    favoriteTracks: List<Track>,
    playlists: List<Playlist>,
    genres: List<String>,
    currentPlayingTrack: Track?,
    onTrackClick: (Track) -> Unit,
    onFavoriteToggle: (Track) -> Unit,
    onPlaylistClick: (Playlist) -> Unit,
    onCreatePlaylist: (String, String) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: Músicas, 1: Playlists, 2: Favoritos, 3: Gêneros
    var showCreateDialog by remember { mutableStateOf(false) }

    val tabs = listOf("Músicas", "Playlists", "Favoritos", "Gêneros")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SpotBackground)
    ) {
        // Header & Tab Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Sua Biblioteca",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = SpotTextPrimary
            )

            if (selectedTab == 1) {
                IconButton(onClick = { showCreateDialog = true }) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = "Nova Playlist",
                        tint = SpotGreen,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }
        }

        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color.Transparent,
            contentColor = SpotGreen,
            edgePadding = 16.dp
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = title,
                            color = if (selectedTab == index) SpotGreen else SpotTextSecondary,
                            style = MaterialTheme.typography.titleMedium
                        )
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Content List according to Tab
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 96.dp)
        ) {
            when (selectedTab) {
                0 -> { // Músicas
                    items(tracks) { track ->
                        TrackItem(
                            track = track,
                            isPlaying = currentPlayingTrack?.id == track.id,
                            onClick = { onTrackClick(track) },
                            onFavoriteToggle = { onFavoriteToggle(track) }
                        )
                    }
                }
                1 -> { // Playlists
                    items(playlists) { playlist ->
                        PlaylistItem(
                            playlist = playlist,
                            onClick = { onPlaylistClick(playlist) }
                        )
                    }
                }
                2 -> { // Favoritos
                    items(favoriteTracks) { track ->
                        TrackItem(
                            track = track,
                            isPlaying = currentPlayingTrack?.id == track.id,
                            onClick = { onTrackClick(track) },
                            onFavoriteToggle = { onFavoriteToggle(track) }
                        )
                    }
                }
                3 -> { // Gêneros
                    items(genres) { genre ->
                        GenreItem(genre = genre)
                    }
                }
            }
        }
    }

    // Create Playlist Dialog
    if (showCreateDialog) {
        var playlistName by remember { mutableStateOf("") }
        var playlistDesc by remember { mutableStateOf("") }

        AlertDialog(
            onDismissRequest = { showCreateDialog = false },
            title = { Text("Criar Nova Playlist", color = SpotTextPrimary) },
            text = {
                Column {
                    OutlinedTextField(
                        value = playlistName,
                        onValueChange = { playlistName = it },
                        label = { Text("Nome da Playlist") },
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedTextField(
                        value = playlistDesc,
                        onValueChange = { playlistDesc = it },
                        label = { Text("Descrição (opcional)") },
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (playlistName.isNotBlank()) {
                            onCreatePlaylist(playlistName, playlistDesc)
                            showCreateDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = SpotGreen)
                ) {
                    Text("Criar", color = SpotBackground)
                }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = false }) {
                    Text("Cancelar", color = SpotTextSecondary)
                }
            },
            containerColor = SpotSurfaceVariant
        )
    }
}

@Composable
private fun PlaylistItem(
    playlist: Playlist,
    onClick: () -> Unit
) {
    val gradientColors = PlaylistGradients.getOrElse(playlist.gradientIndex % PlaylistGradients.size) { PlaylistGradients[0] }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Brush.linearGradient(gradientColors)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.QueueMusic,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(28.dp)
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = playlist.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = SpotTextPrimary
                )
                if (playlist.description.isNotBlank()) {
                    Text(
                        text = playlist.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = SpotTextSecondary
                    )
                }
            }
        }
    }
}

@Composable
private fun GenreItem(genre: String) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp)),
        color = SpotSurfaceVariant
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LibraryMusic,
                contentDescription = null,
                tint = SpotGreen
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = genre,
                style = MaterialTheme.typography.titleMedium,
                color = SpotTextPrimary
            )
        }
    }
}
