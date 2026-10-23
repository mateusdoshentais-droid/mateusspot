const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Media streaming
    getMediaServerPort: () => ipcRenderer.invoke('get-media-server-port'),
    
    // Database queries
    getTracks: () => ipcRenderer.invoke('get-tracks'),
    searchTracks: (query) => ipcRenderer.invoke('search-tracks', query),
    getFavorites: () => ipcRenderer.invoke('get-favorites'),
    toggleFavorite: (trackId) => ipcRenderer.invoke('toggle-favorite', trackId),
    getMostPlayed: (limit) => ipcRenderer.invoke('get-most-played', limit),
    getTopPlayedByPeriod: (period, limit) => ipcRenderer.invoke('get-top-played-by-period', period, limit),
    getListeningStats: () => ipcRenderer.invoke('get-listening-stats'),
    getRecommended: (limit) => ipcRenderer.invoke('get-recommended', limit),
    getSmartRecommendations: (options) => ipcRenderer.invoke('get-smart-recommendations', options),
    getUserPreferences: () => ipcRenderer.invoke('get-user-preferences'),
    updateUserPreferenceWeights: (weights) => ipcRenderer.invoke('update-user-preference-weights', weights),
    recordPreferenceEvent: (event) => ipcRenderer.invoke('record-preference-event', event),
    getRelatedArtists: (artistIdOrName, limit) => ipcRenderer.invoke('get-related-artists', artistIdOrName, limit),
    getDailyMixes: () => ipcRenderer.invoke('get-daily-mixes'),
    getSimilarTracks: (trackId, limit) => ipcRenderer.invoke('get-similar-tracks', trackId, limit),
    incrementPlayCount: (trackId) => ipcRenderer.invoke('increment-play-count', trackId),
    getGenres: () => ipcRenderer.invoke('get-genres'),
    getTracksByGenre: (genreName) => ipcRenderer.invoke('get-tracks-by-genre', genreName),
    
    // Playlists
    getPlaylists: () => ipcRenderer.invoke('get-playlists'),
    getPlaylistById: (id) => ipcRenderer.invoke('get-playlist-by-id', id),
    createPlaylist: (name, description, gradient) => ipcRenderer.invoke('create-playlist', name, description, gradient),
    renamePlaylist: (id, newName) => ipcRenderer.invoke('rename-playlist', id, newName),
    updatePlaylist: (id, newName, newDesc, newGradient) => ipcRenderer.invoke('update-playlist', id, newName, newDesc, newGradient),
    deletePlaylist: (id) => ipcRenderer.invoke('delete-playlist', id),
    getPlaylistTracks: (id) => ipcRenderer.invoke('get-playlist-tracks', id),
    addToPlaylist: (playlistId, trackId) => ipcRenderer.invoke('add-to-playlist', playlistId, trackId),
    removeFromPlaylist: (playlistId, trackId) => ipcRenderer.invoke('remove-from-playlist', playlistId, trackId),
    
    // File & Lyrics utilities
    openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
    getLocalLyrics: (filePath) => ipcRenderer.invoke('get-local-lyrics', filePath),
    saveLocalLyrics: (filePath, lrcContent) => ipcRenderer.invoke('save-local-lyrics', filePath, lrcContent),
    searchOnlineLyrics: (artist, title, album, duration) => ipcRenderer.invoke('search-online-lyrics', artist, title, album, duration),
    getArtistInfo: (artistName) => ipcRenderer.invoke('get-artist-info', artistName),
    searchOnlineArtists: (query) => ipcRenderer.invoke('search-online-artists', query),
    searchOnlineAlbums: (query) => ipcRenderer.invoke('search-online-albums', query),
    getArtistAlbums: (artistId) => ipcRenderer.invoke('get-artist-albums', artistId),
    getArtistTopTracks: (artistId) => ipcRenderer.invoke('get-artist-top-tracks', artistId),
    getAlbumTracks: (albumId) => ipcRenderer.invoke('get-album-tracks', albumId),
    
    // Settings & Scanning
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    updateSettings: (newSettings) => ipcRenderer.invoke('update-settings', newSettings),
    addScanFolder: (folder) => ipcRenderer.invoke('add-scan-folder', folder),
    removeScanFolder: (folder) => ipcRenderer.invoke('remove-scan-folder', folder),
    
    // Desktop integration & Tag editing
    updateTrackTags: (trackId, tags) => ipcRenderer.invoke('update-track-tags', trackId, tags),
    handleDroppedFiles: (filePaths) => ipcRenderer.invoke('handle-dropped-files', filePaths),
    updatePlaybackState: (state) => ipcRenderer.send('update-playback-state', state),
    
    onMediaKeyPlayPause: (callback) => ipcRenderer.on('media-key-play-pause', () => callback()),
    onMediaKeyNext: (callback) => ipcRenderer.on('media-key-next', () => callback()),
    onMediaKeyPrev: (callback) => ipcRenderer.on('media-key-prev', () => callback()),
    onMediaKeyStop: (callback) => ipcRenderer.on('media-key-stop', () => callback()),
    
    startScan: () => ipcRenderer.send('start-scan'),
    onScanProgress: (callback) => ipcRenderer.on('scan-progress', (_event, data) => callback(data)),
    onScanFinished: (callback) => ipcRenderer.on('scan-finished', () => callback()),
    onScanError: (callback) => ipcRenderer.on('scan-error', (_event, err) => callback(err)),
    onLibraryUpdated: (callback) => ipcRenderer.on('library-updated', () => callback()),
    
    // Mobile Server & SpotCry Connect
    getMobileServerInfo: () => ipcRenderer.invoke('get-mobile-server-info'),
    onRemoteControlCommand: (callback) => ipcRenderer.on('remote-control-command', (_event, data) => callback(data)),
    
    // Online Music Search & Download & Offline Management
    searchOnlineMusic: (query) => ipcRenderer.invoke('search-online-music', query),
    getOnlineMusicStream: (videoUrlOrId) => ipcRenderer.invoke('get-online-stream', videoUrlOrId),
    getDownloadFolder: () => ipcRenderer.invoke('get-download-folder'),
    downloadOnlineMusic: (track) => ipcRenderer.invoke('download-online-music', track),
    cancelDownload: (trackId) => ipcRenderer.invoke('cancel-download', trackId),
    deleteOfflineTrack: (trackId) => ipcRenderer.invoke('delete-offline-track', trackId),
    checkTrackOffline: (trackIdOrTrack) => ipcRenderer.invoke('check-track-offline', trackIdOrTrack),
    toggleFavoriteAlbum: (album) => ipcRenderer.invoke('toggle-favorite-album', album),
    isAlbumLiked: (albumIdOrTitle) => ipcRenderer.invoke('is-album-liked', albumIdOrTitle),
    getLikedAlbums: () => ipcRenderer.invoke('get-liked-albums'),
    setTracksFavorite: (tracks, isFav) => ipcRenderer.invoke('set-tracks-favorite', tracks, isFav),
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, data) => callback(data)),
    getOnlineCharts: () => ipcRenderer.invoke('get-online-charts'),

    // Cleanup listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

