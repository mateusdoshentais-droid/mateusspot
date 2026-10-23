const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

// Set Application Identity for Windows Taskbar & Notifications
app.setName('SpotCry');
app.setAppUserModelId('com.spotcry.desktop');

// High-Performance & Low-Latency Chromium Audio Flags
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const db = require('./src/database/db');
const { scanLibrary, scanSingleFile, removeSingleFile } = require('./src/services/scanner');
const lyricsService = require('./src/services/lyricsService');
const artistService = require('./src/services/artistService');
const onlineMusicService = require('./src/services/onlineMusicService');
const recommender = require('./src/services/recommender');
const mobileServer = require('./src/services/mobileServer');
const chokidar = require('chokidar');

// Ensure app data directory exists
const appDataPath = path.join(app.getPath('userData'), 'MusicPlayerNode');
if (!fs.existsSync(appDataPath)) {
    fs.mkdirSync(appDataPath, { recursive: true });
}

// Initialize database & artist cache & online music service
db.init(appDataPath);
artistService.init(appDataPath);
onlineMusicService.init(appDataPath);

let mainWindow;
let watcher = null;
let mediaServerPort = 0;

// High-Performance Zero-Latency Local Streaming Server (Full Range & Chunked Audio)
const mediaServer = http.createServer((req, res) => {
    try {
        const reqUrl = new URL(req.url, `http://127.0.0.1:${mediaServerPort || 3000}`);
        
        // Zero-CORS Online Streaming Proxy Endpoint (Full Range & Audio Chunking)
        if (reqUrl.pathname === '/online-stream') {
            const targetUrl = reqUrl.searchParams.get('url');
            if (!targetUrl || !targetUrl.startsWith('http')) {
                res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
                return res.end('Bad URL');
            }

            if (req.method === 'OPTIONS') {
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                    'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
                    'Access-Control-Max-Age': '86400'
                });
                return res.end();
            }

            const fetchStream = (remoteUrl, redirectCount = 0) => {
                if (redirectCount > 5) {
                    if (!res.headersSent) res.writeHead(508, { 'Access-Control-Allow-Origin': '*' });
                    return res.end('Too many redirects');
                }

                const client = remoteUrl.startsWith('https') ? https : http;
                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*'
                };
                if (req.headers.range) {
                    headers.range = req.headers.range;
                }

                const remoteReq = client.get(remoteUrl, { headers }, (remoteRes) => {
                    if ([301, 302, 303, 307, 308].includes(remoteRes.statusCode) && remoteRes.headers.location) {
                        remoteRes.resume();
                        const nextUrl = new URL(remoteRes.headers.location, remoteUrl).href;
                        return fetchStream(nextUrl, redirectCount + 1);
                    }

                    const responseHeaders = {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
                        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
                        'Accept-Ranges': 'bytes'
                    };
                    if (remoteRes.headers['content-type']) responseHeaders['Content-Type'] = remoteRes.headers['content-type'];
                    if (remoteRes.headers['content-length']) responseHeaders['Content-Length'] = remoteRes.headers['content-length'];
                    if (remoteRes.headers['content-range']) responseHeaders['Content-Range'] = remoteRes.headers['content-range'];

                    res.writeHead(remoteRes.statusCode || 200, responseHeaders);
                    remoteRes.pipe(res);
                });

                remoteReq.on('error', (err) => {
                    console.error('[mediaServer] Stream proxy error:', err.message);
                    if (!res.headersSent) res.writeHead(502, { 'Access-Control-Allow-Origin': '*' });
                    res.end();
                });

                req.on('close', () => {
                    remoteReq.destroy();
                });
            };

            fetchStream(targetUrl);
            return;
        }

        const filePath = reqUrl.searchParams.get('file');
        if (!filePath || !fs.existsSync(filePath)) {
            res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
            return res.end('Not Found');
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;

        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'audio/mpeg';
        if (ext === '.flac') contentType = 'audio/flac';
        else if (ext === '.wav') contentType = 'audio/wav';
        else if (ext === '.ogg') contentType = 'audio/ogg';
        else if (ext === '.m4a' || ext === '.aac') contentType = 'audio/mp4';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.webp') contentType = 'image/webp';

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(filePath, { start, end });
            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            fileStream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*'
            });
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (e) {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
        res.end();
    }
});

mediaServer.listen(0, '127.0.0.1', () => {
    mediaServerPort = mediaServer.address().port;
    console.log('Zero-latency media server running on port:', mediaServerPort);
});

let updateNotifyTimer = null;
function notifyLibraryUpdated() {
    if (updateNotifyTimer) clearTimeout(updateNotifyTimer);
    updateNotifyTimer = setTimeout(() => {
        if (mainWindow) {
            mainWindow.webContents.send('library-updated');
        }
    }, 500);
}

function setupWatcher() {
    // 100% Online mode - no local filesystem watching needed
    if (watcher) {
        try { watcher.close(); } catch(e) {}
        watcher = null;
    }
}

let isQuitting = false;
let tray = null;
let currentPlaybackState = { isPlaying: false, title: 'SpotCry', artist: '' };

function updateTrayMenu(state) {
    if (state) currentPlaybackState = { ...currentPlaybackState, ...state };
    if (!tray) return;

    const tooltip = currentPlaybackState.title && currentPlaybackState.title !== 'SpotCry'
        ? `${currentPlaybackState.isPlaying ? '▶ Tocando: ' : '⏸ '} ${currentPlaybackState.title} - ${currentPlaybackState.artist || 'SpotCry'}`
        : 'SpotCry Desktop';
    tray.setToolTip(tooltip.slice(0, 127));

    const template = [
        {
            label: currentPlaybackState.title ? `🎵 ${currentPlaybackState.title}` : '🎵 SpotCry',
            enabled: false
        }
    ];

    if (currentPlaybackState.artist && currentPlaybackState.artist !== 'SpotCry') {
        template.push({
            label: `👤 ${currentPlaybackState.artist}`,
            enabled: false
        });
    }

    template.push(
        { type: 'separator' },
        {
            label: currentPlaybackState.isPlaying ? '⏸️ Pausar' : '▶️ Reproduzir',
            click: () => {
                if (mainWindow) mainWindow.webContents.send('media-key-play-pause');
            }
        },
        {
            label: '⏭️ Próxima Faixa',
            click: () => {
                if (mainWindow) mainWindow.webContents.send('media-key-next');
            }
        },
        {
            label: '⏮️ Faixa Anterior',
            click: () => {
                if (mainWindow) mainWindow.webContents.send('media-key-prev');
            }
        },
        { type: 'separator' },
        {
            label: '🪟 Abrir Janela',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                }
            }
        },
        {
            label: '❌ Fechar SpotCry',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    );

    tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
    const iconIco = path.join(__dirname, 'build', 'icon.ico');
    const iconPng = path.join(__dirname, 'build', 'icon.png');
    const trayIconPath = fs.existsSync(iconIco) ? iconIco : iconPng;

    try {
        tray = new Tray(trayIconPath);
        updateTrayMenu();

        tray.on('double-click', () => {
            if (mainWindow) {
                if (mainWindow.isVisible()) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        });

        tray.on('click', () => {
            if (mainWindow) {
                if (!mainWindow.isVisible() || mainWindow.isMinimized()) {
                    mainWindow.show();
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.focus();
                }
            }
        });
    } catch (e) {
        console.warn('Tray creation warning:', e.message);
    }
}

function registerGlobalShortcuts() {
    try {
        globalShortcut.register('MediaPlayPause', () => {
            if (mainWindow) mainWindow.webContents.send('media-key-play-pause');
        });
        globalShortcut.register('MediaNextTrack', () => {
            if (mainWindow) mainWindow.webContents.send('media-key-next');
        });
        globalShortcut.register('MediaPreviousTrack', () => {
            if (mainWindow) mainWindow.webContents.send('media-key-prev');
        });
        globalShortcut.register('MediaStop', () => {
            if (mainWindow) mainWindow.webContents.send('media-key-stop');
        });
    } catch(err) {
        console.warn('Global media shortcuts error:', err.message);
    }
}

function createWindow() {
    const iconPath = path.join(__dirname, 'build', 'icon.ico');
    mainWindow = new BrowserWindow({
        title: 'SpotCry',
        icon: fs.existsSync(iconPath) ? iconPath : path.join(__dirname, 'renderer', 'assets', 'spotcry_logo.png'),
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        backgroundColor: '#121212',
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false,
            spellcheck: false,
            webSecurity: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer] ${message}`);
    });

    mainWindow.on('close', (e) => {
        const settings = db.getSettings();
        if (!isQuitting && settings.minimizeToTray !== false) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
    registerGlobalShortcuts();
    setupWatcher();
    mobileServer.init(db, mainWindow);

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

app.on('before-quit', () => {
    isQuitting = true;
});

app.on('will-quit', () => {
    try {
        globalShortcut.unregisterAll();
    } catch(e) {}
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin' && db.getSettings().minimizeToTray === false) {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('get-media-server-port', () => {
    return mediaServerPort;
});

ipcMain.handle('get-mobile-server-info', async () => {
    const info = mobileServer.getServerInfo();
    try {
        const QRCode = require('qrcode');
        info.qrDataUrl = await QRCode.toDataURL(info.url, {
            margin: 1,
            width: 240,
            color: { dark: '#000000', light: '#ffffff' }
        });
    } catch (e) {
        info.qrDataUrl = null;
    }
    return info;
});

ipcMain.handle('get-tracks', () => {
    return db.getAllTracks();
});

ipcMain.handle('search-tracks', (event, query) => {
    return db.searchTracks(query);
});

ipcMain.handle('get-favorites', () => {
    return db.getFavorites();
});

ipcMain.handle('toggle-favorite', (event, trackId) => {
    return db.toggleFavorite(trackId);
});

ipcMain.handle('increment-play-count', (event, trackId) => {
    return db.incrementPlayCount(trackId);
});

ipcMain.handle('get-most-played', (event, limit) => {
    return db.getMostPlayed(limit || 12);
});

ipcMain.handle('get-top-played-by-period', (event, period, limit) => {
    return db.getTopPlayedByPeriod(period, limit || 50);
});

ipcMain.handle('get-listening-stats', () => {
    return db.getGlobalListeningStats();
});

ipcMain.handle('get-recommended', (event, limit) => {
    return db.getRecommended(limit || 12);
});

ipcMain.handle('get-smart-recommendations', async (event, options) => {
    return recommender.getSmartRecommendations(db, options);
});

ipcMain.handle('get-user-preferences', () => {
    return db.getUserPreferences();
});

ipcMain.handle('update-user-preference-weights', (event, weights) => {
    return db.updateUserPreferenceWeights(weights);
});

ipcMain.handle('record-preference-event', (event, prefEvent) => {
    const res = db.recordPreferenceEvent(prefEvent);
    if (res && ['like_track', 'unlike_track', 'dislike_track', 'like_artist', 'unlike_artist'].includes(prefEvent.type)) {
        recommender.invalidateRecommendationsCache();
    }
    return res;
});

ipcMain.handle('get-related-artists', async (event, artistIdOrName, limit) => {
    return artistService.getRelatedArtists(artistIdOrName, limit);
});

ipcMain.handle('get-daily-mixes', () => {
    return db.getDailyMixes();
});

ipcMain.handle('get-similar-tracks', (event, trackId, limit) => {
    return db.getSimilarTracks(trackId, limit || 20);
});

// Genres & Styles
ipcMain.handle('get-genres', () => {
    return db.getGenres();
});

ipcMain.handle('get-tracks-by-genre', (event, genreName) => {
    return db.getTracksByGenre(genreName);
});

// Playlists
ipcMain.handle('get-playlists', () => {
    return db.getPlaylists();
});

ipcMain.handle('get-playlist-by-id', (event, id) => {
    return db.getPlaylistById(id);
});

ipcMain.handle('create-playlist', (event, name, description, gradient) => {
    return db.createPlaylist(name, description, gradient);
});

ipcMain.handle('rename-playlist', (event, id, newName) => {
    return db.renamePlaylist(id, newName);
});

ipcMain.handle('update-playlist', (event, id, newName, newDesc, newGradient) => {
    return db.updatePlaylist(id, newName, newDesc, newGradient);
});

ipcMain.handle('delete-playlist', (event, id) => {
    return db.deletePlaylist(id);
});

ipcMain.handle('get-playlist-tracks', (event, id) => {
    return db.getPlaylistTracks(id);
});

ipcMain.handle('add-to-playlist', (event, playlistId, trackId) => {
    return db.addTrackToPlaylist(playlistId, trackId);
});

ipcMain.handle('remove-from-playlist', (event, playlistId, trackId) => {
    return db.removeTrackFromPlaylist(playlistId, trackId);
});

// File system & Lyrics utilities
const lyricsCachePath = path.join(appDataPath, 'lyrics_cache');
if (!fs.existsSync(lyricsCachePath)) {
    try { fs.mkdirSync(lyricsCachePath, { recursive: true }); } catch(e) {}
}

ipcMain.handle('open-file-location', (event, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
    }
    return false;
});

ipcMain.handle('get-local-lyrics', async (event, filePath) => {
    if (!filePath) return null;
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    
    // 1. Check direct .lrc match in track folder
    const lrcPath = path.join(dir, `${baseName}.lrc`);
    if (fs.existsSync(lrcPath)) {
        try {
            return { source: 'folder', path: lrcPath, content: fs.readFileSync(lrcPath, 'utf8') };
        } catch (e) {}
    }
    
    // 2. Check direct .txt match in track folder
    const txtPath = path.join(dir, `${baseName}.txt`);
    if (fs.existsSync(txtPath)) {
        try {
            return { source: 'folder', path: txtPath, content: fs.readFileSync(txtPath, 'utf8') };
        } catch (e) {}
    }

    // 3. Check persistent lyrics cache
    const cacheKey = baseName.replace(/[^a-zA-Z0-9_\-\.\s]/g, '_').trim();
    const cachedLrcPath = path.join(lyricsCachePath, `${cacheKey}.lrc`);
    if (fs.existsSync(cachedLrcPath)) {
        try {
            return { source: 'cache', path: cachedLrcPath, content: fs.readFileSync(cachedLrcPath, 'utf8') };
        } catch (e) {}
    }
    
    return null;
});

ipcMain.handle('save-local-lyrics', async (event, filePath, lrcContent) => {
    if (!filePath || !lrcContent || typeof lrcContent !== 'string') return false;
    let savedToFolder = false;
    let savedToCache = false;

    // 1. Try to save directly into the song folder alongside the audio file
    try {
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const lrcPath = path.join(dir, `${baseName}.lrc`);
        fs.writeFileSync(lrcPath, lrcContent, 'utf8');
        savedToFolder = true;
    } catch (e) {
        console.warn('Could not write .lrc directly to music folder (permission or read-only):', e.message);
    }

    // 2. Always persist a copy in the app lyrics cache as backup
    try {
        const baseName = path.basename(filePath, path.extname(filePath));
        const cacheKey = baseName.replace(/[^a-zA-Z0-9_\-\.\s]/g, '_').trim();
        const cachedPath = path.join(lyricsCachePath, `${cacheKey}.lrc`);
        fs.writeFileSync(cachedPath, lrcContent, 'utf8');
        savedToCache = true;
    } catch (e) {
        console.error('Could not write to lyrics cache:', e);
    }

    return savedToFolder || savedToCache;
});

ipcMain.handle('search-online-lyrics', async (event, artist, title, album, duration) => {
    try {
        return await lyricsService.searchOnlineLyrics(artist, title, album, duration);
    } catch (e) {
        console.error('Error searching online lyrics:', e);
        return null;
    }
});

// Artist info & pictures
ipcMain.handle('get-artist-info', async (event, artistName) => {
    try {
        return await artistService.getArtistInfo(artistName);
    } catch (e) {
        console.error('Error in get-artist-info IPC:', e);
        return null;
    }
});

ipcMain.handle('search-online-artists', async (event, query) => {
    try {
        return await artistService.searchArtists(query);
    } catch (e) {
        console.error('Error in search-online-artists IPC:', e);
        return [];
    }
});

ipcMain.handle('search-online-albums', async (event, query) => {
    try {
        return await artistService.searchAlbums(query);
    } catch (e) {
        console.error('Error in search-online-albums IPC:', e);
        return [];
    }
});

ipcMain.handle('get-artist-albums', async (event, artistId) => {
    try {
        return await artistService.getArtistAlbums(artistId);
    } catch (e) {
        console.error('Error in get-artist-albums IPC:', e);
        return [];
    }
});

ipcMain.handle('get-artist-top-tracks', async (event, artistId) => {
    try {
        return await artistService.getArtistTopTracks(artistId);
    } catch (e) {
        console.error('Error in get-artist-top-tracks IPC:', e);
        return [];
    }
});

ipcMain.handle('get-album-tracks', async (event, albumId) => {
    try {
        return await artistService.getAlbumTracks(albumId);
    } catch (e) {
        console.error('Error in get-album-tracks IPC:', e);
        return [];
    }
});

// Settings & Scan
ipcMain.handle('get-settings', () => {
    return db.getSettings();
});

ipcMain.handle('add-scan-folder', (event, folder) => {
    db.addFolder(folder);
    setupWatcher();
    return db.getSettings().folders;
});

ipcMain.handle('remove-scan-folder', (event, folder) => {
    db.removeFolder(folder);
    setupWatcher();
    return db.getSettings().folders;
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.on('start-scan', async (event) => {
    const folders = db.getSettings().folders;
    try {
        await scanLibrary(folders, appDataPath, (current, total) => {
            if (mainWindow) {
                mainWindow.webContents.send('scan-progress', { current, total });
            }
        });
        if (mainWindow) {
            mainWindow.webContents.send('scan-finished');
        }
    } catch (err) {
        console.error("Scan error:", err);
        if (mainWindow) {
            mainWindow.webContents.send('scan-error', err.message);
        }
    }
});

// Settings update
ipcMain.handle('update-settings', (event, newSettings) => {
    return db.updateSettings(newSettings);
});

// Update playback state for Tray tooltip, menu and mobile clients
ipcMain.on('update-playback-state', (event, state) => {
    updateTrayMenu(state);
    mobileServer.updatePlaybackState(state);
});

// ID3 Tag Editor
ipcMain.handle('update-track-tags', async (event, trackId, tags) => {
    try {
        const track = db.getTrackById(trackId);
        if (!track) return { success: false, error: 'Música não encontrada' };

        let fileWritten = false;
        try {
            const NodeID3 = require('node-id3');
            const id3Tags = {
                title: tags.title,
                artist: tags.artist,
                album: tags.album,
                genre: tags.genre
            };
            if (tags.year) id3Tags.year = String(tags.year);
            if (tags.track_number) id3Tags.trackNumber = String(tags.track_number);

            const writeResult = NodeID3.update(id3Tags, track.file_path);
            if (writeResult) fileWritten = true;
        } catch (e) {
            console.warn('Could not write ID3 tags to audio file:', e.message);
        }

        const updated = db.updateTrackTags(trackId, tags);
        notifyLibraryUpdated();
        return { success: true, track: updated, fileWritten };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Drag and drop audio files or folders
ipcMain.handle('handle-dropped-files', async (event, filePaths) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return { added: 0 };
    let addedCount = 0;
    for (const p of filePaths) {
        try {
            if (fs.existsSync(p)) {
                const stat = fs.statSync(p);
                if (stat.isDirectory()) {
                    db.addFolder(p);
                    setupWatcher();
                    await scanLibrary([p], appDataPath);
                    addedCount++;
                } else {
                    const added = await scanSingleFile(p, appDataPath);
                    if (added) addedCount++;
                }
            }
        } catch (e) {
            console.error('Error handling dropped path:', p, e);
        }
    }
    if (addedCount > 0) {
        notifyLibraryUpdated();
    }
    return { added: addedCount };
});

// ==========================================
// Online Music Search & Download Handlers
// ==========================================
ipcMain.handle('search-online-music', async (event, query) => {
    try {
        return await onlineMusicService.searchTracks(query);
    } catch (e) {
        console.error('Error in search-online-music IPC:', e);
        return [];
    }
});

ipcMain.handle('get-online-stream', async (event, videoUrlOrId) => {
    try {
        return await onlineMusicService.getAudioStreamUrl(videoUrlOrId);
    } catch (e) {
        console.error('Error in get-online-stream IPC:', e);
        return { error: e.message };
    }
});

ipcMain.handle('get-download-folder', () => {
    const settings = db.getSettings();
    if (settings.downloadFolder) return settings.downloadFolder;
    if (settings.folders && settings.folders.length > 0) return settings.folders[0];
    return path.join(app.getPath('music'), 'SpotCry');
});

ipcMain.handle('download-online-music', async (event, track) => {
    try {
        const settings = db.getSettings();
        let targetFolder = settings.downloadFolder || (settings.folders && settings.folders[0]);
        if (!targetFolder) {
            targetFolder = path.join(app.getPath('music'), 'SpotCry');
        }

        // Auto-add folder to library if not watched
        if (!settings.folders.includes(targetFolder)) {
            db.addFolder(targetFolder);
            setupWatcher();
        }

        const result = await onlineMusicService.downloadTrack(track, targetFolder, (progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('download-progress', progress);
            }
        });

        if (result.success && result.filePath) {
            // Record persistent offline metadata in database
            const recordedTrack = db.recordTrackDownload(track, {
                filePath: result.filePath,
                fileSize: result.fileSize || 0
            });

            // Scan and index downloaded track into SpotCry database immediately
            const addedTrack = await scanSingleFile(result.filePath, appDataPath);
            notifyLibraryUpdated();
            return {
                success: true,
                filePath: result.filePath,
                fileSize: result.fileSize,
                track: recordedTrack || addedTrack || track
            };
        } else {
            return {
                success: false,
                cancelled: result.cancelled || false,
                error: result.error || 'Erro desconhecido durante o download'
            };
        }
    } catch (err) {
        console.error('Error in download-online-music IPC:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('cancel-download', async (event, trackId) => {
    try {
        return onlineMusicService.cancelDownload(trackId);
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('delete-offline-track', async (event, trackId) => {
    try {
        const success = db.deleteOfflineDownload(trackId);
        notifyLibraryUpdated();
        return { success };
    } catch (e) {
        return { success: false, error: e.message };
    }
});

ipcMain.handle('check-track-offline', async (event, trackIdOrTrack) => {
    try {
        const track = (typeof trackIdOrTrack === 'object' && trackIdOrTrack !== null)
            ? (db.getTrackById(trackIdOrTrack.id) || trackIdOrTrack)
            : db.getTrackById(trackIdOrTrack);
        return db.verifyOfflineAvailability(track);
    } catch (e) {
        return false;
    }
});

ipcMain.handle('toggle-favorite-album', async (event, album) => {
    try {
        return db.toggleFavoriteAlbum(album);
    } catch (e) {
        console.error('Error in toggle-favorite-album IPC:', e);
        return false;
    }
});

ipcMain.handle('is-album-liked', async (event, albumIdOrTitle) => {
    try {
        return db.isAlbumLiked(albumIdOrTitle);
    } catch (e) {
        return false;
    }
});

ipcMain.handle('get-liked-albums', async () => {
    try {
        return db.getLikedAlbums();
    } catch (e) {
        return [];
    }
});

ipcMain.handle('set-tracks-favorite', async (event, tracks, isFav) => {
    try {
        const count = db.setTracksFavorite(tracks, isFav);
        notifyLibraryUpdated();
        return count;
    } catch (e) {
        console.error('Error in set-tracks-favorite IPC:', e);
        return 0;
    }
});

ipcMain.handle('get-online-charts', async () => {
    return await artistService.getOnlineCharts();
});


