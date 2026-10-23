package com.spotcry.music.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.spotcry.music.data.model.Track
import com.spotcry.music.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LyricsScreen(
    track: Track?,
    lyrics: String?,
    onBackClick: () -> Unit
) {
    if (track == null) return

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(track.title, style = MaterialTheme.typography.titleMedium, color = SpotTextPrimary)
                        Text(track.artist, style = MaterialTheme.typography.bodySmall, color = SpotTextSecondary)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Voltar", tint = SpotTextPrimary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = SpotBackground)
            )
        },
        containerColor = SpotBackground
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(SpotBackground)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            if (!lyrics.isNullOrBlank()) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = lyrics,
                        color = SpotGreenLight,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.SemiBold,
                        lineHeight = 32.sp,
                        textAlign = TextAlign.Start,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            } else {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Letra não encontrada",
                        style = MaterialTheme.typography.titleMedium,
                        color = SpotTextPrimary
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Insira um arquivo .lrc na mesma pasta da música com o mesmo nome para exibir a letra.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = SpotTextSecondary,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}
