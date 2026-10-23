package com.spotcry.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.spotcry.music.data.model.Track
import com.spotcry.music.ui.components.SearchBar
import com.spotcry.music.ui.components.TrackItem
import com.spotcry.music.ui.theme.SpotBackground
import com.spotcry.music.ui.theme.SpotTextPrimary
import com.spotcry.music.ui.theme.SpotTextSecondary

@Composable
fun SearchScreen(
    tracks: List<Track>,
    currentPlayingTrack: Track?,
    onTrackClick: (Track) -> Unit,
    onFavoriteToggle: (Track) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }

    val filteredTracks = remember(searchQuery, tracks) {
        if (searchQuery.isBlank()) {
            emptyList()
        } else {
            val q = searchQuery.lowercase()
            tracks.filter {
                it.title.lowercase().contains(q) ||
                it.artist.lowercase().contains(q) ||
                it.album.lowercase().contains(q) ||
                it.genre.lowercase().contains(q)
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SpotBackground)
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        SearchBar(
            query = searchQuery,
            onQueryChange = { searchQuery = it }
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (searchQuery.isBlank()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Digite o nome de uma música, artista ou álbum para pesquisar.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = SpotTextSecondary
                )
            }
        } else if (filteredTracks.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "Nenhum resultado encontrado para \"$searchQuery\".",
                    style = MaterialTheme.typography.bodyLarge,
                    color = SpotTextSecondary
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 96.dp)
            ) {
                items(filteredTracks) { track ->
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
}
