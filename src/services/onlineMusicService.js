const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const yts = require('yt-search');

let appDataDir = '';
let binPath = '';

/**
 * Safely resolves the absolute physical path to yt-dlp.exe
 * CRITICAL: Must never return paths inside virtual app.asar archive because Windows cannot spawn them.
 */
function resolveBinaryPath() {
    const candidates = [
        // 1. Packaged extraResources (NSIS & Portable temporary directory)
        process.resourcesPath ? path.join(process.resourcesPath, 'bin', 'yt-dlp.exe') : null,
        process.resourcesPath ? path.join(process.resourcesPath, 'yt-dlp.exe') : null,
        // 2. Unpacked asar
        process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin', 'yt-dlp.exe') : null,
        // 3. Executable root directory (portable execution folder)
        process.execPath ? path.join(path.dirname(process.execPath), 'bin', 'yt-dlp.exe') : null,
        process.execPath ? path.join(path.dirname(process.execPath), 'resources', 'bin', 'yt-dlp.exe') : null,
        // 4. User data / AppData bin
        appDataDir ? path.join(appDataDir, 'bin', 'yt-dlp.exe') : null,
        // 5. Development mode (outside asar)
        path.join(__dirname, '..', '..', 'bin', 'yt-dlp.exe')
    ].filter(Boolean);

    for (const c of candidates) {
        // Prevent ENOENT crash: Windows OS cannot spawn an exe inside app.asar virtual archive
        if (c.includes('app.asar') && !c.includes('app.asar.unpacked')) {
            continue;
        }
        try {
            if (fs.existsSync(c)) {
                return c;
            }
        } catch (e) {}
    }
    return '';
}

// Initial resolution
binPath = resolveBinaryPath();

/**
 * Sanitize filename for Windows
 */
function sanitizeFilename(name) {
    return (name || '')
        .replace(/[\\/:*?"<>|]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Format view count
 */
function formatViews(views) {
    if (!views) return '';
    if (views >= 1000000000) return (views / 1000000000).toFixed(1) + 'B views';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M views';
    if (views >= 1000) return (views / 1000).toFixed(0) + 'K views';
    return views + ' views';
}

function init(customAppDataPath) {
    appDataDir = customAppDataPath || path.join(os.homedir(), 'AppData', 'Roaming', 'MusicPlayerNode');
    binPath = resolveBinaryPath();
}

/**
 * Parse and clean YouTube items into pure Spotify-like music tracks
 */
function cleanSpotifyTrack(v) {
    if (!v) return null;

    let clean = v.title || '';
    const rawTitle = clean;

    // 1. Duration filter: Songs are normally between 50s and 660s (10 mins)
    // Filter out long compilation shows, 1-hour loops, or short 15s clips
    if (v.seconds && (v.seconds > 660 || v.seconds < 50)) {
        return null;
    }

    // 2. Reject non-music content (interviews, podcasts, reactions, full movies, etc.)
    const nonMusicRegex = /\b(podcast|entrevista|interview|tutorial|react|reacting|review|bastidores|making\s*of|trailer|filme\s*completo|show\s*completo|dvd\s*completo|1\s*hora|1\s*hour|10\s*horas|parodia|paródia)\b/i;
    if (nonMusicRegex.test(clean)) {
        return null;
    }

    // 3. Strip video labels from title
    clean = clean.replace(/\s*[\(\[](official\s*(music\s*)?video|video\s*oficial|clipe\s*oficial|lyric\s*video|letra|audio\s*oficial|official\s*audio|visualizer|4k|hd|remaster(ed)?|ao\s*vivo|live|dvd.*?)[\)\]]/gi, '');
    clean = clean.replace(/\s*-\s*(official\s*video|clipe\s*oficial|audio\s*oficial|video\s*oficial|lyric\s*video).*$/gi, '');
    clean = clean.replace(/\|.*$/g, ''); // Remove '| DVD Paraiso...'

    // 4. Extract artist & track title
    let artist = v.author ? v.author.name.replace(/ - Topic$/i, '').replace(/VEVO$/i, '').trim() : 'Artista';
    let title = clean.trim();

    // Check if title has "Artist - Song Name"
    if (title.includes(' - ')) {
        const parts = title.split(' - ');
        if (parts.length >= 2) {
            artist = parts[0].trim();
            title = parts.slice(1).join(' - ').trim();
        }
    }

    // Extract feats from title (e.g. "Song (feat. Artist 2)")
    const featParenMatch = title.match(/[\(\[]\s*(?:feat\.|ft\.|part\.|participação)\s*([^)]+)[\)\]]/i);
    if (featParenMatch) {
        artist += ', ' + featParenMatch[1].trim();
        title = title.replace(/[\(\[]\s*(?:feat\.|ft\.|part\.|participação)[^)]+[\)\]]/gi, '').trim();
    }
    const featInlineMatch = title.match(/\s+(?:part\.|feat\.|ft\.)\s+([^-|\(\[]+)/i);
    if (featInlineMatch) {
        artist += ', ' + featInlineMatch[1].trim();
        title = title.replace(/\s+(?:part\.|feat\.|ft\.)\s+[^-|\(\[]+/gi, '').trim();
    }

    // Remove leading/trailing dashes, quotes or underscores
    title = title.replace(/^[\s\-_–—"“”']+|^[\s\-_–—"“”']+|[\s\-_–—"“”']+$/g, '').trim();
    artist = artist.replace(/^[\s\-_–—"“”']+|[\s\-_–—"“”']+$/g, '').trim();

    if (!title) title = rawTitle;

    const isTopic = Boolean(v.author && v.author.name && v.author.name.includes('- Topic'));

    // High resolution square thumbnail
    const thumb = v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

    return {
        id: v.videoId,
        title,
        rawTitle,
        artist: artist || 'Desconhecido',
        duration: v.timestamp || '0:00',
        seconds: v.seconds || 0,
        isTopic,
        views: formatViews(v.views),
        ago: v.ago || '',
        thumbnail: thumb,
        url: v.url
    };
}

/**
 * Fallback search using yt-dlp if primary parser fails
 */
function searchWithYtDlp(query, limit = 15) {
    return new Promise((resolve) => {
        if (!fs.existsSync(binPath)) return resolve([]);
        
        const proc = spawn(binPath, [
            '--flat-playlist',
            '-J',
            '--no-playlist',
            '--no-check-certificates',
            `ytsearch${limit * 2}:${query} audio`
        ]);

        let data = '';
        proc.stdout.on('data', d => data += d.toString());
        proc.on('close', (code) => {
            try {
                if (code === 0 && data) {
                    const json = JSON.parse(data);
                    const entries = json.entries || [];
                    const items = entries.map(e => {
                        const mins = Math.floor((e.duration || 0) / 60);
                        const secs = String(Math.floor((e.duration || 0) % 60)).padStart(2, '0');
                        return cleanSpotifyTrack({
                            videoId: e.id,
                            title: e.title,
                            author: { name: e.uploader || e.channel || 'Desconhecido' },
                            duration: e.duration,
                            timestamp: e.duration ? `${mins}:${secs}` : '0:00',
                            seconds: e.duration || 0,
                            views: e.view_count,
                            thumbnail: (e.thumbnails && e.thumbnails[0]) ? e.thumbnails[0].url : `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
                            url: e.url || `https://www.youtube.com/watch?v=${e.id}`
                        });
                    }).filter(Boolean);
                    
                    return resolve(items.slice(0, limit));
                }
            } catch (err) {
                console.warn('Fallback JSON parse error:', err);
            }
            resolve([]);
        });
        proc.on('error', () => resolve([]));
    });
}

function getDeezerJson(url, timeoutMs = 4000) {
    return new Promise((resolve) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return resolve(null);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(null);
        });
    });
}

/**
 * Search tracks with dual engine fallback:
 * 1. Deezer API (ultra-fast, official studio tracks, zero video clips, HD covers, authentic album & artist tags)
 * 2. YouTube Music / yts (fallback)
 * 3. yt-dlp (deep fallback)
 */
async function searchTracks(query, limit = 20) {
    if (!query || !query.trim()) return [];
    
    const trimmed = query.trim();

    // 1. Primary Engine: Official Deezer Music API
    try {
        const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
        const json = await getDeezerJson(deezerUrl, 3500);
        if (json && json.data && json.data.length > 0) {
            const tracks = json.data.map(item => {
                const duration = item.duration || 0;
                const m = Math.floor(duration / 60);
                const s = String(duration % 60).padStart(2, '0');
                const cover = item.album?.cover_big || item.album?.cover_medium || item.album?.cover_xl || (item.artist && (item.artist.picture_big || item.artist.picture_medium));
                return {
                    id: `dz_${item.id}`,
                    deezerId: item.id,
                    title: item.title_short || item.title,
                    artist: item.artist?.name || 'Artista',
                    artistId: item.artist?.id,
                    album: item.album?.title || 'Single',
                    albumId: item.album?.id,
                    duration: duration,
                    durationFormatted: `${m}:${s}`,
                    coverUrl: cover,
                    thumbnail: cover,
                    preview: item.preview,
                    isOnline: true
                };
            });
            if (tracks.length > 0) {
                return tracks;
            }
        }
    } catch (dzErr) {
        console.warn('[onlineMusicService] Deezer search error, trying YouTube fallback:', dzErr.message);
    }

    // 2. Secondary Engine: YouTube Music (yts)
    try {
        const searchResult = await yts(`${trimmed} audio`);
        const videos = searchResult.videos || [];
        
        const musicTracks = videos.map(cleanSpotifyTrack).filter(Boolean);

        // Sort: Official Studio/Topic tracks first
        musicTracks.sort((a, b) => (b.isTopic ? 1 : 0) - (a.isTopic ? 1 : 0));

        if (musicTracks.length > 0) {
            return musicTracks.slice(0, limit);
        }
    } catch (err) {
        console.warn('Primary audio search error, trying yt-dlp fallback:', err.message);
    }

    // 3. Fallback to yt-dlp
    try {
        return await searchWithYtDlp(trimmed, limit);
    } catch (err) {
        console.error('All online search engines failed:', err);
        return [];
    }
}

const streamUrlCache = new Map();

/**
 * Get direct playable audio stream URL for streaming full songs
 */
function getAudioStreamUrl(videoUrlOrId) {
    return new Promise((resolve) => {
        if (!binPath || !fs.existsSync(binPath)) {
            binPath = resolveBinaryPath();
        }

        if (!binPath || !fs.existsSync(binPath)) {
            return resolve({ error: 'Utilitário de streaming não encontrado no sistema.' });
        }

        let targetUrl = String(videoUrlOrId).trim();
        const cacheKey = targetUrl.toLowerCase();
        if (streamUrlCache.has(cacheKey)) {
            return resolve({ success: true, url: streamUrlCache.get(cacheKey) });
        }

        if (!targetUrl.startsWith('http')) {
            if (targetUrl.length === 11 && !targetUrl.includes(' ') && !targetUrl.startsWith('dz_')) {
                targetUrl = `https://www.youtube.com/watch?v=${targetUrl}`;
            } else {
                targetUrl = `ytsearch1:${targetUrl} audio`;
            }
        }

        const args = [
            '-g',
            '-f', 'ba[ext=m4a]/ba/b',
            '--no-playlist',
            '--no-check-certificates',
            targetUrl
        ];

        let proc;
        try {
            proc = spawn(binPath, args);
        } catch (spawnErr) {
            console.error('[onlineMusicService] Spawn failed:', spawnErr);
            return resolve({ error: 'Falha ao iniciar processo de áudio: ' + spawnErr.message });
        }

        let output = '';
        let errorOutput = '';

        proc.on('error', (err) => {
            console.error('[onlineMusicService] Process error:', err);
            resolve({ error: 'Erro no streaming: ' + err.message });
        });

        proc.stdout.on('data', (d) => {
            output += d.toString();
        });

        proc.stderr.on('data', (d) => {
            errorOutput += d.toString();
        });

        proc.on('close', (code) => {
            const streamUrl = output.trim().split('\n')[0];
            if (code === 0 && streamUrl && streamUrl.startsWith('http')) {
                streamUrlCache.set(cacheKey, streamUrl);
                resolve({ success: true, url: streamUrl });
            } else {
                console.warn('Failed to get audio stream url:', errorOutput);
                resolve({ error: 'Não foi possível carregar o áudio online.' });
            }
        });
    });
}

const activeDownloads = new Map();

/**
 * Cancel an ongoing download by track ID
 */
function cancelDownload(trackId) {
    const key = String(trackId);
    if (!activeDownloads.has(key)) {
        return { success: false, message: 'Nenhum download em andamento para esta faixa.' };
    }

    const item = activeDownloads.get(key);
    item.cancelled = true;

    try {
        if (item.proc && !item.proc.killed) {
            item.proc.kill('SIGTERM');
            setTimeout(() => {
                try {
                    if (item.proc && !item.proc.killed) item.proc.kill('SIGKILL');
                } catch (e) {}
            }, 300);
        }
    } catch (killErr) {
        console.warn('[onlineMusicService] Error killing download process:', killErr);
    }

    // Clean up temporary incomplete files (*.part, *.ytdl)
    setTimeout(() => {
        try {
            if (item.targetDir && fs.existsSync(item.targetDir)) {
                const files = fs.readdirSync(item.targetDir);
                files.forEach(f => {
                    if (f.startsWith(item.finalBaseName) && (f.endsWith('.part') || f.endsWith('.ytdl') || f.includes('.temp'))) {
                        try {
                            fs.unlinkSync(path.join(item.targetDir, f));
                        } catch (err) {}
                    }
                });
            }
        } catch (cleanErr) {
            console.warn('[onlineMusicService] Error cleaning partial download files:', cleanErr);
        }
    }, 400);

    if (item.progressCallback) {
        try {
            item.progressCallback({
                trackId,
                percent: 0,
                status: 'cancelled'
            });
        } catch (e) {}
    }

    activeDownloads.delete(key);
    return { success: true, message: 'Download cancelado com sucesso.' };
}

/**
 * Download a track into target directory
 */
function downloadTrack(track, targetDir, progressCallback) {
    return new Promise((resolve) => {
        if (!binPath || !fs.existsSync(binPath)) {
            binPath = resolveBinaryPath();
        }

        if (!binPath || !fs.existsSync(binPath)) {
            return resolve({ success: false, error: 'Binário yt-dlp não encontrado no sistema.' });
        }

        if (!fs.existsSync(targetDir)) {
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (e) {
                return resolve({ success: false, error: 'Não foi possível criar pasta de destino: ' + e.message });
            }
        }

        const safeArtist = sanitizeFilename(track.artist || 'Artista');
        const safeTitle = sanitizeFilename(track.title || 'Música');
        const finalBaseName = `${safeArtist} - ${safeTitle}`;
        const outputTemplate = path.join(targetDir, `${finalBaseName}.%(ext)s`);

        let targetUrl = track.url;
        if (!targetUrl) {
            if (track.id && !String(track.id).startsWith('dz_') && String(track.id).length === 11) {
                targetUrl = `https://www.youtube.com/watch?v=${track.id}`;
            } else {
                targetUrl = `ytsearch1:${track.artist || ''} - ${track.title || ''} audio`;
            }
        }

        const args = [
            '-f', 'ba[ext=m4a]/ba/b',
            '--no-playlist',
            '--no-check-certificates',
            '--newline',
            '-o', outputTemplate,
            targetUrl
        ];

        let proc;
        try {
            proc = spawn(binPath, args);
        } catch (spawnErr) {
            console.error('[onlineMusicService] Spawn download failed:', spawnErr);
            return resolve({ success: false, error: 'Falha ao iniciar download: ' + spawnErr.message });
        }

        const downloadKey = String(track.id);
        const downloadRecord = {
            proc,
            targetDir,
            finalBaseName,
            progressCallback,
            cancelled: false
        };
        activeDownloads.set(downloadKey, downloadRecord);

        proc.on('error', (err) => {
            activeDownloads.delete(downloadKey);
            if (downloadRecord.cancelled) {
                return resolve({ success: false, cancelled: true, error: 'Download cancelado pelo usuário.' });
            }
            console.error('[onlineMusicService] Download process error:', err);
            resolve({ success: false, error: 'Erro no processo de download: ' + err.message });
        });

        let downloadedFilePath = '';
        let lastPercent = 0;

        proc.stdout.on('data', (d) => {
            if (downloadRecord.cancelled) return;
            const str = d.toString();
            
            // Track destination file
            const destMatch = str.match(/\[download\] Destination:\s+(.+)/i);
            if (destMatch && destMatch[1]) {
                downloadedFilePath = destMatch[1].trim();
            }

            // Also match already downloaded destination
            const alreadyMatch = str.match(/\[download\]\s+(.+?)\s+has already been downloaded/i);
            if (alreadyMatch && alreadyMatch[1]) {
                downloadedFilePath = alreadyMatch[1].trim();
            }

            // Progress percentage
            const progMatch = str.match(/\[download\]\s+(\d+\.?\d*)%/);
            if (progMatch) {
                const percent = parseFloat(progMatch[1]);
                if (!isNaN(percent) && percent !== lastPercent) {
                    lastPercent = percent;
                    if (progressCallback && !downloadRecord.cancelled) {
                        progressCallback({
                            trackId: track.id,
                            percent: Math.min(100, Math.round(percent)),
                            status: 'downloading'
                        });
                    }
                }
            }
        });

        let errData = '';
        proc.stderr.on('data', (d) => {
            errData += d.toString();
        });

        proc.on('close', (code) => {
            const wasCancelled = downloadRecord.cancelled;
            activeDownloads.delete(downloadKey);

            if (wasCancelled) {
                return resolve({
                    success: false,
                    cancelled: true,
                    error: 'Download cancelado pelo usuário.'
                });
            }

            if (code === 0) {
                // Find final file if downloadedFilePath was not explicitly captured
                if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
                    const expectedM4a = path.join(targetDir, `${finalBaseName}.m4a`);
                    const expectedWebm = path.join(targetDir, `${finalBaseName}.webm`);
                    const expectedMp3 = path.join(targetDir, `${finalBaseName}.mp3`);
                    
                    if (fs.existsSync(expectedM4a)) downloadedFilePath = expectedM4a;
                    else if (fs.existsSync(expectedMp3)) downloadedFilePath = expectedMp3;
                    else if (fs.existsSync(expectedWebm)) downloadedFilePath = expectedWebm;
                }

                // Validate file existence and size
                let fileSize = 0;
                if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
                    try {
                        const stat = fs.statSync(downloadedFilePath);
                        fileSize = stat.size;
                    } catch (e) {}
                }

                if (!downloadedFilePath || fileSize < 1024) {
                    return resolve({
                        success: false,
                        error: 'Arquivo baixado inválido ou corrompido.'
                    });
                }

                if (progressCallback) {
                    progressCallback({
                        trackId: track.id,
                        percent: 100,
                        status: 'completed'
                    });
                }

                resolve({
                    success: true,
                    filePath: downloadedFilePath,
                    fileSize,
                    track
                });
            } else {
                console.error('Download failed with code', code, errData);
                resolve({
                    success: false,
                    error: `Falha no download (código ${code})`
                });
            }
        });
    });
}

module.exports = {
    init,
    searchTracks,
    getAudioStreamUrl,
    downloadTrack,
    cancelDownload
};

