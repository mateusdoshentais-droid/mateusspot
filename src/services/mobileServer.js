const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

let server = null;
let currentPort = 3000; // Matches Windows Firewall rule 'SpotCry iPad Player'
let dbRef = null;
let mainWindowRef = null;
let lastPlaybackState = { is_playing: false, track: null, progress: 0, duration: 0 };

function getLocalIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.flac': return 'audio/flac';
        case '.wav': return 'audio/wav';
        case '.ogg': return 'audio/ogg';
        case '.m4a':
        case '.aac':
        case '.mp4': return 'audio/mp4';
        case '.mp3': return 'audio/mpeg';
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        case '.webp': return 'image/webp';
        case '.svg': return 'image/svg+xml';
        case '.html': return 'text/html; charset=utf-8';
        case '.css': return 'text/css; charset=utf-8';
        case '.js': return 'application/javascript; charset=utf-8';
        case '.json': return 'application/json; charset=utf-8';
        default: return 'application/octet-stream';
    }
}

function handleStream(filePath, req, res) {
    if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        return res.end('File Not Found');
    }

    try {
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        const contentType = getContentType(filePath);

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            let start = parseInt(parts[0], 10);
            let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (isNaN(start)) {
                start = fileSize - parseInt(parts[1], 10);
                end = fileSize - 1;
            }
            if (isNaN(end) || end >= fileSize) {
                end = fileSize - 1;
            }
            start = Math.max(0, start);

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
}

function init(db, mainWindow) {
    dbRef = db;
    mainWindowRef = mainWindow;

    server = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }

        try {
            const localIp = getLocalIp();
            const baseUrl = `http://${localIp}:${currentPort}`;
            const reqUrl = new URL(req.url, baseUrl);
            const pathname = reqUrl.pathname;

            // 1. Audio and Cover Streaming
            if (pathname === '/stream' || pathname === '/cover') {
                const file = reqUrl.searchParams.get('file');
                return handleStream(file, req, res);
            }

            // 2. REST API: Server Information & Health
            if (pathname === '/api/info') {
                const tracks = dbRef ? dbRef.getAllTracks() : [];
                const playlists = dbRef ? dbRef.getPlaylists() : [];
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    name: 'SpotCry Server',
                    version: '2.0.0',
                    ip: localIp,
                    port: currentPort,
                    trackCount: tracks.length,
                    playlistCount: playlists.length
                }));
            }

            // 3. REST API: Library Tracks
            if (pathname === '/api/tracks') {
                const tracks = dbRef ? dbRef.getAllTracks() : [];
                // Format paths as network stream URLs
                const formatted = tracks.map(t => ({
                    ...t,
                    stream_url: `${baseUrl}/stream?file=${encodeURIComponent(t.file_path)}`,
                    cover_url: t.cover_path ? `${baseUrl}/stream?file=${encodeURIComponent(t.cover_path)}` : null
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(formatted));
            }

            // 4. REST API: Playlists
            if (pathname === '/api/playlists') {
                const playlists = dbRef ? dbRef.getPlaylists() : [];
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(playlists));
            }

            if (pathname.startsWith('/api/playlists/')) {
                const id = parseInt(pathname.split('/')[3], 10);
                const pl = dbRef ? dbRef.getPlaylistById(id) : null;
                if (!pl) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Playlist não encontrada' }));
                }
                const tracks = (pl.tracks || []).map(t => ({
                    ...t,
                    stream_url: `${baseUrl}/stream?file=${encodeURIComponent(t.file_path)}`,
                    cover_url: t.cover_path ? `${baseUrl}/stream?file=${encodeURIComponent(t.cover_path)}` : null
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ...pl, tracks }));
            }

            // 5. REST API: Favorites
            if (pathname === '/api/favorites') {
                const favs = dbRef ? dbRef.getFavorites() : [];
                const formatted = favs.map(t => ({
                    ...t,
                    stream_url: `${baseUrl}/stream?file=${encodeURIComponent(t.file_path)}`,
                    cover_url: t.cover_path ? `${baseUrl}/stream?file=${encodeURIComponent(t.cover_path)}` : null
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(formatted));
            }

            if (pathname === '/api/favorites/toggle' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        if (dbRef && parsed.trackId) {
                            const result = dbRef.toggleFavorite(parsed.trackId);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ success: true, is_favorite: result }));
                        }
                    } catch (e) {}
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bad request' }));
                });
                return;
            }

            // 6. Spotify Connect Remote Control
            if (pathname === '/api/playback') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(lastPlaybackState));
            }

            if (pathname === '/api/control' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
                            mainWindowRef.webContents.send('remote-control-command', data);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ success: true }));
                    } catch (e) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Invalid command' }));
                    }
                });
                return;
            }

            // 7. Serve Mobile Web App Static Files (mobile/ folder)
            const mobileDir = path.join(__dirname, '..', '..', 'mobile');
            let filePath = path.join(mobileDir, pathname === '/' || pathname === '/mobile' ? 'index.html' : pathname.replace(/^\/mobile\//, ''));
            
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                res.writeHead(200, { 'Content-Type': getContentType(filePath) });
                return fs.createReadStream(filePath).pipe(res);
            }

            // Fallback for SPA routing inside mobile app
            const fallbackIndex = path.join(mobileDir, 'index.html');
            if (fs.existsSync(fallbackIndex)) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                return fs.createReadStream(fallbackIndex).pipe(res);
            }

            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');

        } catch (err) {
            console.error('[mobileServer] Request error:', err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    });

    // Try default port 3579, or fallback to random available port
    server.listen(currentPort, '0.0.0.0', () => {
        currentPort = server.address().port;
        console.log(`[mobileServer] SpotCry Mobile Server rodando em http://${getLocalIp()}:${currentPort}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[mobileServer] Porta ${currentPort} em uso, tentando porta dinâmica...`);
            server.listen(0, '0.0.0.0', () => {
                currentPort = server.address().port;
                console.log(`[mobileServer] SpotCry Mobile Server rodando em http://${getLocalIp()}:${currentPort}`);
            });
        } else {
            console.error('[mobileServer] Erro no servidor:', err);
        }
    });
}

function updatePlaybackState(state) {
    if (!state) return;
    lastPlaybackState = {
        is_playing: state.isPlaying !== undefined ? !!state.isPlaying : lastPlaybackState.is_playing,
        track: state.title ? { title: state.title, artist: state.artist || 'SpotCry' } : lastPlaybackState.track,
        progress: state.progress || 0,
        duration: state.duration || 0
    };
}

function getServerInfo() {
    return {
        ip: getLocalIp(),
        port: currentPort,
        url: `http://${getLocalIp()}:${currentPort}`
    };
}

module.exports = {
    init,
    updatePlaybackState,
    getServerInfo,
    getLocalIp
};
