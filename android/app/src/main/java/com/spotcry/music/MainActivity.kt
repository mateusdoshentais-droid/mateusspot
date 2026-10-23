package com.spotcry.music

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LibraryMusic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.spotcry.music.data.model.Playlist
import com.spotcry.music.data.model.Track
import com.spotcry.music.data.repository.MusicRepository
import com.spotcry.music.ui.components.MiniPlayer
import com.spotcry.music.ui.components.PlayerBottomSheet
import com.spotcry.music.ui.screens.*
import com.spotcry.music.ui.theme.*
import com.spotcry.music.ui.viewmodel.MusicViewModel
import com.spotcry.music.ui.viewmodel.MusicViewModelFactory

class MainActivity : ComponentActivity() {

    private val viewModel: MusicViewModel by viewModels {
        val db = (application as SpotCryApp).database
        val repository = MusicRepository(this, db)
        MusicViewModelFactory(repository)
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.any { it }) {
            viewModel.syncLibrary()
        }
    }

    public override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        checkPermissions()
        viewModel.connectMediaController(this)

        setContent {
            SpotCryTheme {
                MainContent(viewModel = viewModel)
            }
        }
    }

    private fun checkPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_MEDIA_AUDIO)
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        } else {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }
}

@Composable
fun MainContent(viewModel: MusicViewModel) {
    var selectedScreen by remember { mutableStateOf(0) } // 0: Home, 1: Search, 2: Library, 3: Stats
    var selectedPlaylist by remember { mutableStateOf<Playlist?>(null) }
    var showFullPlayer by remember { mutableStateOf(false) }
    var showLyricsScreen by remember { mutableStateOf(false) }

    val tracks by viewModel.allTracks.collectAsState()
    val favoriteTracks by viewModel.favoriteTracks.collectAsState()
    val playlists by viewModel.playlists.collectAsState()
    val genres by viewModel.genres.collectAsState()
    val mostPlayed by viewModel.mostPlayed.collectAsState()

    val currentTrack by viewModel.currentPlayingTrack.collectAsState()
    val isPlaying by viewModel.isPlaying.collectAsState()
    val currentPosition by viewModel.currentPosition.collectAsState()
    val duration by viewModel.duration.collectAsState()
    val isShuffle by viewModel.isShuffle.collectAsState()
    val isRepeat by viewModel.isRepeat.collectAsState()
    val lyrics by viewModel.lyrics.collectAsState()

    val progress = if (duration > 0) currentPosition.toFloat() / duration.toFloat() else 0f

    Scaffold(
        bottomBar = {
            Column(modifier = Modifier.background(SpotSurface)) {
                // Floating MiniPlayer
                if (currentTrack != null && !showFullPlayer && !showLyricsScreen) {
                    MiniPlayer(
                        track = currentTrack,
                        isPlaying = isPlaying,
                        progress = progress,
                        onPlayPauseClick = { viewModel.togglePlayPause() },
                        onSkipNextClick = { viewModel.skipNext() },
                        onClick = { showFullPlayer = true }
                    )
                }

                // Bottom Navigation Bar
                NavigationBar(
                    containerColor = SpotSurface,
                    contentColor = SpotGreen
                ) {
                    NavigationBarItem(
                        selected = selectedScreen == 0,
                        onClick = {
                            selectedScreen = 0
                            selectedPlaylist = null
                        },
                        icon = { Icon(Icons.Default.Home, contentDescription = "Início") },
                        label = { Text("Início") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SpotGreen,
                            selectedTextColor = SpotGreen,
                            unselectedIconColor = SpotTextMuted,
                            unselectedTextColor = SpotTextMuted,
                            indicatorColor = SpotSurfaceVariant
                        )
                    )
                    NavigationBarItem(
                        selected = selectedScreen == 1,
                        onClick = {
                            selectedScreen = 1
                            selectedPlaylist = null
                        },
                        icon = { Icon(Icons.Default.Search, contentDescription = "Buscar") },
                        label = { Text("Buscar") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SpotGreen,
                            selectedTextColor = SpotGreen,
                            unselectedIconColor = SpotTextMuted,
                            unselectedTextColor = SpotTextMuted,
                            indicatorColor = SpotSurfaceVariant
                        )
                    )
                    NavigationBarItem(
                        selected = selectedScreen == 2,
                        onClick = {
                            selectedScreen = 2
                            selectedPlaylist = null
                        },
                        icon = { Icon(Icons.Default.LibraryMusic, contentDescription = "Sua Biblioteca") },
                        label = { Text("Biblioteca") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SpotGreen,
                            selectedTextColor = SpotGreen,
                            unselectedIconColor = SpotTextMuted,
                            unselectedTextColor = SpotTextMuted,
                            indicatorColor = SpotSurfaceVariant
                        )
                    )
                    NavigationBarItem(
                        selected = selectedScreen == 3,
                        onClick = {
                            selectedScreen = 3
                            selectedPlaylist = null
                        },
                        icon = { Icon(Icons.Default.BarChart, contentDescription = "Estatísticas") },
                        label = { Text("Stats") },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = SpotGreen,
                            selectedTextColor = SpotGreen,
                            unselectedIconColor = SpotTextMuted,
                            unselectedTextColor = SpotTextMuted,
                            indicatorColor = SpotSurfaceVariant
                        )
                    )
                }
            }
        },
        containerColor = SpotBackground
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            if (showLyricsScreen) {
                LyricsScreen(
                    track = currentTrack,
                    lyrics = lyrics,
                    onBackClick = { showLyricsScreen = false }
                )
            } else if (selectedPlaylist != null) {
                val playlistTracks by viewModel.getPlaylistTracks(selectedPlaylist!!.id).collectAsState(initial = emptyList())
                PlaylistDetailScreen(
                    playlist = selectedPlaylist!!,
                    tracks = playlistTracks,
                    currentPlayingTrack = currentTrack,
                    onBackClick = { selectedPlaylist = null },
                    onPlayAllClick = {
                        if (playlistTracks.isNotEmpty()) {
                            viewModel.playTrack(playlistTracks.first(), playlistTracks)
                        }
                    },
                    onShuffleClick = {
                        if (playlistTracks.isNotEmpty()) {
                            viewModel.toggleShuffle()
                            viewModel.playTrack(playlistTracks.shuffled().first(), playlistTracks)
                        }
                    },
                    onTrackClick = { track -> viewModel.playTrack(track, playlistTracks) },
                    onRemoveTrack = { track -> viewModel.removeTrackFromPlaylist(selectedPlaylist!!.id, track.id) },
                    onDeletePlaylist = {
                        viewModel.deletePlaylist(selectedPlaylist!!.id)
                        selectedPlaylist = null
                    }
                )
            } else {
                when (selectedScreen) {
                    0 -> HomeScreen(
                        tracks = tracks,
                        mostPlayed = mostPlayed,
                        currentPlayingTrack = currentTrack,
                        onTrackClick = { track -> viewModel.playTrack(track) },
                        onFavoriteToggle = { track -> viewModel.toggleFavorite(track) },
                        onScanRequest = { viewModel.syncLibrary() }
                    )
                    1 -> SearchScreen(
                        tracks = tracks,
                        currentPlayingTrack = currentTrack,
                        onTrackClick = { track -> viewModel.playTrack(track) },
                        onFavoriteToggle = { track -> viewModel.toggleFavorite(track) }
                    )
                    2 -> LibraryScreen(
                        tracks = tracks,
                        favoriteTracks = favoriteTracks,
                        playlists = playlists,
                        genres = genres,
                        currentPlayingTrack = currentTrack,
                        onTrackClick = { track -> viewModel.playTrack(track) },
                        onFavoriteToggle = { track -> viewModel.toggleFavorite(track) },
                        onPlaylistClick = { playlist -> selectedPlaylist = playlist },
                        onCreatePlaylist = { name, desc -> viewModel.createPlaylist(name, desc) }
                    )
                    3 -> StatsScreen(
                        mostPlayed = mostPlayed,
                        totalTracks = tracks.size,
                        currentPlayingTrack = currentTrack,
                        onTrackClick = { track -> viewModel.playTrack(track) }
                    )
                }
            }

            // Expanded Full Screen Player Sheet
            if (showFullPlayer) {
                PlayerBottomSheet(
                    track = currentTrack,
                    isPlaying = isPlaying,
                    currentPosition = currentPosition,
                    duration = duration,
                    isShuffle = isShuffle,
                    isRepeat = isRepeat,
                    onPlayPauseClick = { viewModel.togglePlayPause() },
                    onSkipNextClick = { viewModel.skipNext() },
                    onSkipPreviousClick = { viewModel.skipPrevious() },
                    onSeekTo = { pos -> viewModel.seekTo(pos) },
                    onShuffleToggle = { viewModel.toggleShuffle() },
                    onRepeatToggle = { viewModel.toggleRepeat() },
                    onFavoriteToggle = { currentTrack?.let { viewModel.toggleFavorite(it) } },
                    onLyricsClick = {
                        showFullPlayer = false
                        showLyricsScreen = true
                    },
                    onDismiss = { showFullPlayer = false }
                )
            }
        }
    }
}
