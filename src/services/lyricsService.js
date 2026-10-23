const https = require('https');

function getHtml(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', (err) => resolve({ error: err.message }));
    });
}

function normalizeSlug(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, 'e')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function cleanMusicTitle(str) {
    if (!str) return '';
    return str
        .replace(/\s*[\(\[](ao vivo|live|official video|vídeo oficial|clipe oficial|lyric video|letra|remaster(ed)?|áudio oficial|audio oficial|versão.*|version.*)[\)\]]/gi, '')
        .replace(/\s*[\(\[](feat\.|ft\.|participação|part\.).*?[\)\]]/gi, '')
        .replace(/\s*-\s*(ao vivo|live|oficial|official).*$/gi, '')
        .trim();
}

/**
 * Searches lyrics across LRCLIB and Letras.mus.br with automatic fallback.
 */
async function searchOnlineLyrics(artist, title, album = '', duration = 0) {
    const cleanT = cleanMusicTitle(title) || title;
    const cleanA = cleanMusicTitle(artist) || artist;

    // 1. LRCLIB Exact Match
    try {
        const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanA)}&track_name=${encodeURIComponent(cleanT)}&album_name=${encodeURIComponent(album || '')}&duration=${Math.round(duration || 0)}`;
        const res = await getHtml(url);
        if (res.status === 200 && res.data) {
            const data = JSON.parse(res.data);
            if (data && (data.syncedLyrics || data.plainLyrics)) {
                return {
                    content: data.syncedLyrics || data.plainLyrics,
                    isSynced: Boolean(data.syncedLyrics),
                    source: 'LRCLIB'
                };
            }
        }
    } catch (e) {}

    // 2. LRCLIB Search (Prioritizing Synced Results)
    try {
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanA + ' ' + cleanT)}`;
        const res = await getHtml(searchUrl);
        if (res.status === 200 && res.data) {
            const list = JSON.parse(res.data);
            if (Array.isArray(list) && list.length > 0) {
                const synced = list.find(item => item.syncedLyrics && item.syncedLyrics.trim().length > 0);
                if (synced) {
                    return {
                        content: synced.syncedLyrics,
                        isSynced: true,
                        source: 'LRCLIB'
                    };
                }
                const first = list[0];
                if (first.plainLyrics) {
                    return {
                        content: first.plainLyrics,
                        isSynced: false,
                        source: 'LRCLIB'
                    };
                }
            }
        }
    } catch (e) {}

    // 3. Fallback: Letras.mus.br (Comprehensive Brazilian/International Database)
    try {
        const aSlug = normalizeSlug(cleanA);
        const tSlug = normalizeSlug(cleanT);
        if (aSlug && tSlug) {
            const letrasUrl = `https://www.letras.mus.br/${aSlug}/${tSlug}/`;
            const lRes = await getHtml(letrasUrl);
            if (lRes.status === 200 && lRes.data) {
                const match = lRes.data.match(/<div class="lyric-original">([\s\S]*?)<\/div>/i);
                if (match) {
                    const text = match[1]
                        .replace(/<p>/gi, '\n')
                        .replace(/<\/p>/gi, '\n')
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .trim();
                    if (text.length > 20) {
                        return {
                            content: text,
                            isSynced: false,
                            source: 'Letras.mus.br'
                        };
                    }
                }
            }
        }
    } catch (e) {}

    // 4. Raw Title Fallback on LRCLIB
    try {
        const rawSearchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(artist + ' ' + title)}`;
        const res = await getHtml(rawSearchUrl);
        if (res.status === 200 && res.data) {
            const list = JSON.parse(res.data);
            if (Array.isArray(list) && list.length > 0) {
                const synced = list.find(item => item.syncedLyrics);
                return {
                    content: synced ? synced.syncedLyrics : (list[0].syncedLyrics || list[0].plainLyrics),
                    isSynced: Boolean(synced || list[0].syncedLyrics),
                    source: 'LRCLIB'
                };
            }
        }
    } catch (e) {}

    return null;
}

module.exports = {
    searchOnlineLyrics,
    cleanMusicTitle,
    normalizeSlug
};
