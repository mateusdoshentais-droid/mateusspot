package com.spotcry.music.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = SpotGreen,
    secondary = SpotPurple,
    background = SpotBackground,
    surface = SpotSurface,
    surfaceVariant = SpotSurfaceVariant,
    onPrimary = SpotBackground,
    onSecondary = SpotBackground,
    onBackground = SpotTextPrimary,
    onSurface = SpotTextPrimary,
    onSurfaceVariant = SpotTextSecondary
)

@Composable
fun SpotCryTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
