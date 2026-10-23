const https = require('https');
const fs = require('fs');
const path = require('path');

let cacheFilePath = null;
const memoryCache = new Map();

/**
 * Initializes the artist cache with the app data directory.
 */
function init(appDataPath) {
    try {
        cacheFilePath = path.join(appDataPath, 'artist_cache.json');
        if (fs.existsSync(cacheFilePath)) {
            const raw = fs.readFileSync(cacheFilePath, 'utf8');
            const parsed = JSON.parse(raw);
            Object.keys(parsed).forEach(k => {
                memoryCache.set(k.toLowerCase(), parsed[k]);
            });
        }
    } catch (e) {
        console.warn('[artistService] Failed to load artist cache:', e.message);
    }
}

let saveTimeout = null;
function persistCache() {
    if (!cacheFilePath) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            const obj = {};
            for (const [k, v] of memoryCache.entries()) {
                obj[k] = v;
            }
            fs.writeFileSync(cacheFilePath, JSON.stringify(obj, null, 2), 'utf8');
        } catch (e) {
            console.warn('[artistService] Failed to persist artist cache:', e.message);
        }
    }, 500);
}

/**
 * Performs an HTTPS GET with a timeout.
 */
function getJson(url, timeoutMs = 3500) {
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
 * Clean artist name to increase match accuracy (e.g. remove "feat.", "(live)", etc.)
 */
function cleanArtistQuery(name) {
    if (!name) return '';
    return name
        .replace(/\s*[\(\[](feat\.|ft\.|participação|part\.).*?[\)\]]/gi, '')
        .replace(/\s*[\(\[](ao vivo|live|remastered).*?[\)\]]/gi, '')
        .replace(/\s*,\s*.*$/g, '') // Take first artist if separated by comma
        .replace(/\s*;\s*.*$/g, '')
        .trim();
}

/**
 * Searches and fetches official artist picture & listeners from Deezer.
 * Returns cached results instantly.
 */
async function getArtistInfo(rawName) {
    if (!rawName || typeof rawName !== 'string') return null;
    const cleanName = rawName.trim();
    if (!cleanName || cleanName === 'Desconhecido' || cleanName === 'Unknown' || cleanName === 'SpotCry') {
        return null;
    }

    const cacheKey = cleanName.toLowerCase();
    if (memoryCache.has(cacheKey)) {
        return memoryCache.get(cacheKey);
    }

    const query = cleanArtistQuery(cleanName) || cleanName;
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}`;

    try {
        const json = await getJson(url);
        if (!json || !json.data || json.data.length === 0) {
            // Save negative cache briefly to avoid spamming
            memoryCache.set(cacheKey, null);
            return null;
        }

        const target = query.toLowerCase();
        // Filter out empty placeholder pictures
        const validList = json.data.filter(x => x.picture_big && !x.picture_big.includes('//500x500'));
        const candidates = validList.length > 0 ? validList : json.data;

        // Find exact matches first
        const exacts = candidates.filter(x => x.name && x.name.trim().toLowerCase() === target);
        if (exacts.length > 0) {
            exacts.sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0));
        }

        let best = exacts.length > 0 ? exacts[0] : null;
        if (!best) {
            // Pick candidate with most fans
            const sortedByFans = [...candidates].sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0));
            best = sortedByFans[0];
        }

        if (!best) {
            memoryCache.set(cacheKey, null);
            return null;
        }

        const result = {
            id: best.id,
            name: best.name,
            picture_xl: best.picture_xl || best.picture_big,
            picture_big: best.picture_big,
            picture_medium: best.picture_medium,
            picture_small: best.picture_small,
            nb_fan: best.nb_fan || 0,
            nb_album: best.nb_album || 0,
            link: best.link || null
        };

        memoryCache.set(cacheKey, result);
        persistCache();
        return result;
    } catch (err) {
        console.warn(`[artistService] Error fetching artist ${cleanName}:`, err.message);
        return null;
    }
}

/**
 * Searches artists by query using Deezer API.
 */
async function searchArtists(query, limit = 8) {
    if (!query || typeof query !== 'string' || !query.trim()) return [];
    const clean = cleanArtistQuery(query.trim()) || query.trim();
    const target = clean.toLowerCase();
    const url = `https://api.deezer.com/search/artist?q=${encodeURIComponent(clean)}&limit=20`;
    try {
        const json = await getJson(url);
        if (!json || !Array.isArray(json.data)) return [];
        
        // Filter valid pictures and sort by exact match, then fan popularity
        const valid = json.data.filter(x => x.picture_big && !x.picture_big.includes('//500x500'));
        const candidates = valid.length > 0 ? valid : json.data;

        candidates.sort((a, b) => {
            const aExact = (a.name || '').trim().toLowerCase() === target ? 1 : 0;
            const bExact = (b.name || '').trim().toLowerCase() === target ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;
            return (b.nb_fan || 0) - (a.nb_fan || 0);
        });

        const seenNames = new Set();
        const uniqueList = [];
        for (const item of candidates) {
            const k = (item.name || '').trim().toLowerCase();
            if (!seenNames.has(k)) {
                seenNames.add(k);
                uniqueList.push({
                    id: item.id,
                    name: item.name,
                    picture_xl: item.picture_xl || item.picture_big,
                    picture_big: item.picture_big,
                    picture_medium: item.picture_medium,
                    picture_small: item.picture_small,
                    nb_fan: item.nb_fan || 0,
                    nb_album: item.nb_album || 0,
                    link: item.link
                });
            }
            if (uniqueList.length >= limit) break;
        }

        return uniqueList;
    } catch (e) {
        console.warn('[artistService] Error searching artists:', e.message);
        return [];
    }
}

/**
 * Searches albums by query using Deezer API.
 */
async function searchAlbums(query, limit = 12) {
    if (!query || typeof query !== 'string' || !query.trim()) return [];
    const clean = query.trim();
    const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(clean)}&limit=${limit}`;
    try {
        const json = await getJson(url);
        if (!json || !Array.isArray(json.data)) return [];
        return json.data.map(item => ({
            id: item.id,
            title: item.title,
            cover_xl: item.cover_xl || item.cover_big,
            cover_big: item.cover_big,
            cover_medium: item.cover_medium,
            cover_small: item.cover_small,
            release_date: item.release_date || '',
            year: item.release_date ? item.release_date.substring(0, 4) : '',
            nb_tracks: item.nb_tracks || 0,
            record_type: item.record_type || 'album',
            artist: {
                id: item.artist?.id,
                name: item.artist?.name || 'Artista'
            }
        }));
    } catch (e) {
        console.warn('[artistService] Error searching albums:', e.message);
        return [];
    }
}

/**
 * Fetches discography / albums for an artist ID.
 */
async function getArtistAlbums(artistId, limit = 30) {
    if (!artistId) return [];
    const url = `https://api.deezer.com/artist/${encodeURIComponent(artistId)}/albums?limit=${limit}`;
    try {
        const json = await getJson(url);
        if (!json || !Array.isArray(json.data)) return [];
        return json.data.map(item => ({
            id: item.id,
            title: item.title,
            cover_xl: item.cover_xl || item.cover_big,
            cover_big: item.cover_big,
            cover_medium: item.cover_medium,
            cover_small: item.cover_small,
            release_date: item.release_date || '',
            year: item.release_date ? item.release_date.substring(0, 4) : '',
            record_type: item.record_type || 'album',
            fans: item.fans || 0
        }));
    } catch (e) {
        console.warn(`[artistService] Error fetching albums for artist ${artistId}:`, e.message);
        return [];
    }
}

/**
 * Fetches top popular tracks for an artist ID.
 */
async function getArtistTopTracks(artistId, limit = 15) {
    if (!artistId) return [];
    const url = `https://api.deezer.com/artist/${encodeURIComponent(artistId)}/top?limit=${limit}`;
    try {
        const json = await getJson(url);
        if (!json || !Array.isArray(json.data)) return [];
        return json.data.map(item => {
            const minutes = Math.floor((item.duration || 0) / 60);
            const seconds = Math.floor((item.duration || 0) % 60);
            const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            return {
                id: `dz_${item.id}`,
                deezerId: item.id,
                title: item.title,
                artist: item.artist?.name || 'Artista',
                album: item.album?.title || '',
                albumId: item.album?.id || null,
                cover: item.album?.cover_big || item.album?.cover_medium,
                thumbnail: item.album?.cover_big || item.album?.cover_medium,
                duration: durationStr,
                durationSeconds: item.duration || 0,
                preview: item.preview || null,
                isDeezer: true
            };
        });
    } catch (e) {
        console.warn(`[artistService] Error fetching top tracks for artist ${artistId}:`, e.message);
        return [];
    }
}

/**
 * Fetches tracks from an album by album ID.
 */
async function getAlbumTracks(albumId) {
    if (!albumId) return [];
    const url = `https://api.deezer.com/album/${encodeURIComponent(albumId)}/tracks?limit=100`;
    try {
        const json = await getJson(url);
        if (!json || !Array.isArray(json.data)) return [];
        return json.data.map((item, index) => {
            const minutes = Math.floor((item.duration || 0) / 60);
            const seconds = Math.floor((item.duration || 0) % 60);
            const durationStr = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            return {
                id: `dz_alb_${item.id}`,
                deezerId: item.id,
                track_number: index + 1,
                title: item.title,
                artist: item.artist?.name || 'Artista',
                duration: durationStr,
                durationSeconds: item.duration || 0,
                preview: item.preview || null,
                isDeezer: true
            };
        });
    } catch (e) {
        console.warn(`[artistService] Error fetching tracks for album ${albumId}:`, e.message);
        return [];
    }
}

/**
 * Fetches top trending tracks, artists, and albums for the 100% online Home screen
 */
let chartCache = null;
let chartCacheTime = 0;

async function getOnlineCharts() {
    const now = Date.now();
    // Cache for 15 minutes
    if (chartCache && (now - chartCacheTime) < 15 * 60 * 1000) {
        return chartCache;
    }

    try {
        const json = await getJson('https://api.deezer.com/chart');
        if (!json) return chartCache || { tracks: [], artists: [], albums: [] };

        const tracks = (json.tracks?.data || []).map((t, idx) => {
            const minutes = Math.floor((t.duration || 0) / 60);
            const seconds = Math.floor((t.duration || 0) % 60);
            return {
                id: `dz_${t.id}`,
                deezerId: t.id,
                track_number: idx + 1,
                title: t.title,
                artist: t.artist?.name || 'Artista',
                album: t.album?.title || '',
                cover: t.album?.cover_big || t.album?.cover_medium,
                thumbnail: t.album?.cover_big || t.album?.cover_medium,
                duration: `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`,
                durationSeconds: t.duration || 0,
                isOnline: true
            };
        });

        const artists = (json.artists?.data || []).map(a => ({
            id: a.id,
            name: a.name,
            picture: a.picture_big || a.picture_medium,
            fans: a.nb_fan || 0,
            isOnline: true
        }));

        const albums = (json.albums?.data || []).map(alb => ({
            id: alb.id,
            title: alb.title,
            artist: alb.artist?.name || 'Artista',
            cover: alb.cover_big || alb.cover_medium,
            cover_path: alb.cover_big || alb.cover_medium,
            isOnline: true
        }));

        chartCache = { tracks, artists, albums };
        chartCacheTime = now;
        return chartCache;
    } catch (e) {
        console.warn('[artistService] Error fetching online charts:', e.message);
        return chartCache || { tracks: [], artists: [], albums: [] };
    }
}

/**
 * Fetches real related artists using Deezer API.
 * Accepts either an artist ID or artist name.
 */
async function getRelatedArtists(artistIdOrName, limit = 10) {
    if (!artistIdOrName) return [];

    let artistId = null;
    if (typeof artistIdOrName === 'number' || /^\d+$/.test(String(artistIdOrName).trim())) {
        artistId = String(artistIdOrName).trim();
    } else {
        const info = await getArtistInfo(String(artistIdOrName).trim());
        if (info && info.id) {
            artistId = info.id;
        }
    }

    if (!artistId) return [];

    const cacheKey = `related_${artistId}`;
    if (memoryCache.has(cacheKey)) {
        const cached = memoryCache.get(cacheKey);
        if (Array.isArray(cached)) return cached.slice(0, limit);
    }

    const url = `https://api.deezer.com/artist/${encodeURIComponent(artistId)}/related?limit=${limit * 2}`;
    try {
        const json = await getJson(url, 4000);
        if (!json || !Array.isArray(json.data)) return [];

        const valid = json.data.filter(a => a.picture_big && !a.picture_big.includes('//500x500'));
        const candidates = valid.length > 0 ? valid : json.data;

        const results = candidates.map(a => ({
            id: a.id,
            name: a.name,
            picture: a.picture_big || a.picture_medium || a.picture_xl,
            picture_big: a.picture_big,
            fans: a.nb_fan || 0,
            nb_album: a.nb_album || 0,
            isOnline: true
        })).slice(0, limit);

        memoryCache.set(cacheKey, results);
        persistCache();
        return results;
    } catch (e) {
        console.warn(`[artistService] Error fetching related artists for ${artistId}:`, e.message);
        return [];
    }
}

module.exports = {
    init,
    getArtistInfo,
    searchArtists,
    searchAlbums,
    getArtistAlbums,
    getArtistTopTracks,
    getAlbumTracks,
    getOnlineCharts,
    getRelatedArtists
};
