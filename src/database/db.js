const fs = require('fs');
const path = require('path');
const recommender = require('../services/recommender');
const genreClassifier = require('../services/genreClassifier');

let dbPath;
let data = {
    settings: { folders: [] },
    tracks: [],
    playlists: [],
    liked_albums: [],
    user_preferences: {
        weights: {
            likeTrack: 5,
            likeArtist: 5,
            repeatTrack: 4,
            completedPlay: 3,
            fastSkip: -2,
            dislikeTrack: -5
        },
        artistScores: {},
        genreScores: {},
        trackScores: {},
        recentPlays: [],
        events: []
    }
};

// Autoincrement IDs
let trackIdCounter = 1;
let playlistIdCounter = 1;

function init(appDataPath) {
    dbPath = path.join(appDataPath, 'library.json');
    if (fs.existsSync(dbPath)) {
        try {
            const fileData = fs.readFileSync(dbPath, 'utf8');
            data = JSON.parse(fileData);
            
            // Re-calculate max IDs
            if (data.tracks.length > 0) {
                trackIdCounter = Math.max(...data.tracks.map(t => t.id)) + 1;
            }
            if (data.playlists.length > 0) {
                playlistIdCounter = Math.max(...data.playlists.map(p => p.id)) + 1;
            }
            if (!data.liked_albums) {
                data.liked_albums = [];
            }
            if (!data.user_preferences) {
                data.user_preferences = {
                    weights: {
                        likeTrack: 5,
                        likeArtist: 5,
                        repeatTrack: 4,
                        completedPlay: 3,
                        fastSkip: -2,
                        dislikeTrack: -5
                    },
                    artistScores: {},
                    genreScores: {},
                    trackScores: {},
                    recentPlays: [],
                    events: []
                };
            }
            if (!data.user_preferences.weights) {
                data.user_preferences.weights = {
                    likeTrack: 5,
                    likeArtist: 5,
                    repeatTrack: 4,
                    completedPlay: 3,
                    fastSkip: -2,
                    dislikeTrack: -5
                };
            }

            // Auto-identify & upgrade genres for existing library tracks
            let upgraded = false;
            data.tracks.forEach(track => {
                if (!track.genre || track.genre === 'Unknown' || track.genre === 'Desconhecido' || track.genre === 'Outros' || !track.genre_identified) {
                    const identified = genreClassifier.identifyGenre(track);
                    if (identified && (identified !== track.genre || !track.genre_identified)) {
                        track.genre = identified;
                        track.genre_identified = true;
                        upgraded = true;
                    }
                }
            });
            if (upgraded) {
                save();
            }
        } catch (e) {
            console.error("Failed to load JSON db", e);
        }
    } else {
        save();
    }
}

let saveTimer = null;
function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveSync();
    }, 150);
}

function saveSync() {
    try {
        if (!dbPath) return;
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) return;
        fs.writeFileSync(dbPath, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save JSON db", e);
    }
}

function getSettings() {
    return data.settings;
}

function addFolder(folder) {
    if (!data.settings.folders.includes(folder)) {
        data.settings.folders.push(folder);
        save();
    }
}

function removeFolder(folder) {
    data.settings.folders = data.settings.folders.filter(f => f !== folder);
    save();
}

function updateSettings(newSettings) {
    data.settings = { ...data.settings, ...newSettings };
    save();
    return data.settings;
}

// Tracks
function getTrackById(id) {
    return data.tracks.find(t => t.id == id) || null;
}

function updateTrackTags(trackId, updatedFields) {
    const track = data.tracks.find(t => t.id == trackId);
    if (!track) return null;
    if (updatedFields.title !== undefined) track.title = String(updatedFields.title).trim();
    if (updatedFields.artist !== undefined) track.artist = String(updatedFields.artist).trim();
    if (updatedFields.album !== undefined) track.album = String(updatedFields.album).trim();
    if (updatedFields.genre !== undefined) track.genre = String(updatedFields.genre).trim();
    if (updatedFields.year !== undefined) track.year = parseInt(updatedFields.year, 10) || 0;
    if (updatedFields.track_number !== undefined) track.track_number = parseInt(updatedFields.track_number, 10) || 0;
    save();
    return track;
}
function getAllTracks() {
    // Sort by artist, album, track_number, and filename natural order
    return [...data.tracks].sort((a, b) => {
        const artistCmp = (a.artist || '').localeCompare(b.artist || '', undefined, { sensitivity: 'base' });
        if (artistCmp !== 0) return artistCmp;

        const albumCmp = (a.album || '').localeCompare(b.album || '', undefined, { sensitivity: 'base' });
        if (albumCmp !== 0) return albumCmp;

        const trackNoA = (a.track_number && a.track_number > 0) ? a.track_number : 999;
        const trackNoB = (b.track_number && b.track_number > 0) ? b.track_number : 999;
        if (trackNoA !== trackNoB) return trackNoA - trackNoB;

        return (a.file_path || a.title || '').localeCompare(b.file_path || b.title || '', undefined, { numeric: true, sensitivity: 'base' });
    });
}

function searchTracks(query) {
    const q = query.toLowerCase();
    return getAllTracks().filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q) ||
        (t.genre && t.genre.toLowerCase().includes(q))
    );
}

function verifyOfflineAvailability(track) {
    if (!track) return false;
    const targetPath = track.offline_path || track.file_path;
    if (!targetPath) return false;
    try {
        if (fs.existsSync(targetPath)) {
            const stat = fs.statSync(targetPath);
            return stat.size > 1024;
        }
    } catch (e) {
        return false;
    }
    return false;
}

function getFavorites() {
    const favs = data.tracks.filter(t => !!t.is_favorite);
    favs.forEach(t => {
        t.isOfflineAvailable = verifyOfflineAvailability(t);
        if (t.isOfflineAvailable) {
            t.download_status = 'downloaded';
        } else if (t.download_status !== 'downloading') {
            t.download_status = 'none';
        }
    });

    // Sort by liked_at descending (most recent first)
    return favs.sort((a, b) => {
        const timeA = a.liked_at ? new Date(a.liked_at).getTime() : (a.date_added ? new Date(a.date_added).getTime() : 0);
        const timeB = b.liked_at ? new Date(b.liked_at).getTime() : (b.date_added ? new Date(b.date_added).getTime() : 0);
        return timeB - timeA;
    });
}

function toggleFavorite(trackOrId) {
    const trackId = (typeof trackOrId === 'object' && trackOrId !== null) ? trackOrId.id : trackOrId;
    let track = data.tracks.find(t => t.id == trackId);
    const nowIso = new Date().toISOString();

    if (!track && typeof trackOrId === 'object' && trackOrId !== null) {
        track = {
            id: trackOrId.id,
            title: trackOrId.title || 'Música Online',
            artist: trackOrId.artist || 'Artista',
            album: trackOrId.album || '',
            cover_path: trackOrId.cover_path || '',
            coverUrl: trackOrId.coverUrl || trackOrId.thumbnail || '',
            thumbnail: trackOrId.thumbnail || trackOrId.coverUrl || '',
            duration: trackOrId.durationSeconds || trackOrId.seconds || (typeof trackOrId.duration === 'number' ? trackOrId.duration : 0),
            durationFormatted: trackOrId.durationFormatted || (typeof trackOrId.duration === 'string' ? trackOrId.duration : ''),
            url: trackOrId.url || '',
            isOnline: true,
            is_favorite: true,
            liked_at: nowIso,
            date_added: nowIso,
            download_status: 'none'
        };
        data.tracks.push(track);
        recordPreferenceEvent({ type: 'like_track', track });
        saveSync();
        return true;
    }

    if (track) {
        track.is_favorite = !track.is_favorite;
        if (track.is_favorite) {
            track.liked_at = nowIso;
            recordPreferenceEvent({ type: 'like_track', track });
        } else {
            delete track.liked_at;
            recordPreferenceEvent({ type: 'unlike_track', track });
            // Preserves download files and offline paths when unliking!
        }
        saveSync();
        return !!track.is_favorite;
    }
    return false;
}

function setTracksFavorite(tracks, isFavorite = true) {
    if (!Array.isArray(tracks) || tracks.length === 0) return 0;
    const nowIso = new Date().toISOString();
    let changed = 0;

    tracks.forEach(trackOrId => {
        const trackId = (typeof trackOrId === 'object' && trackOrId !== null) ? trackOrId.id : trackOrId;
        let track = data.tracks.find(t => t.id == trackId);

        if (!track && typeof trackOrId === 'object' && trackOrId !== null) {
            track = {
                id: trackOrId.id,
                title: trackOrId.title || 'Música Online',
                artist: trackOrId.artist || 'Artista',
                album: trackOrId.album || '',
                cover_path: trackOrId.cover_path || '',
                coverUrl: trackOrId.coverUrl || trackOrId.thumbnail || '',
                thumbnail: trackOrId.thumbnail || trackOrId.coverUrl || '',
                duration: trackOrId.durationSeconds || trackOrId.seconds || (typeof trackOrId.duration === 'number' ? trackOrId.duration : 0),
                durationFormatted: trackOrId.durationFormatted || (typeof trackOrId.duration === 'string' ? trackOrId.duration : ''),
                url: trackOrId.url || '',
                isOnline: true,
                is_favorite: isFavorite,
                liked_at: isFavorite ? nowIso : undefined,
                date_added: nowIso,
                download_status: 'none'
            };
            data.tracks.push(track);
            changed++;
        } else if (track) {
            track.is_favorite = isFavorite;
            if (isFavorite) {
                track.liked_at = nowIso;
            } else {
                delete track.liked_at;
            }
            changed++;
        }
    });

    if (changed > 0) {
        saveSync();
    }
    return changed;
}

function getLikedAlbums() {
    if (!data.liked_albums) data.liked_albums = [];
    return data.liked_albums;
}

function isAlbumLiked(albumIdOrTitle) {
    if (!data.liked_albums) data.liked_albums = [];
    if (!albumIdOrTitle) return false;
    const str = String(albumIdOrTitle).trim().toLowerCase();
    return data.liked_albums.some(a => 
        String(a.id).toLowerCase() === str || 
        (a.title && a.title.trim().toLowerCase() === str)
    );
}

function toggleFavoriteAlbum(album) {
    if (!data.liked_albums) data.liked_albums = [];
    if (!album) return false;

    const idx = data.liked_albums.findIndex(a => 
        (album.id && String(a.id) === String(album.id)) ||
        (album.title && a.title && a.title.trim().toLowerCase() === album.title.trim().toLowerCase())
    );

    if (idx !== -1) {
        const removed = data.liked_albums.splice(idx, 1)[0];
        if (removed && removed.artist) {
            recordPreferenceEvent({ type: 'unlike_artist', artistName: removed.artist });
        }
        saveSync();
        return false;
    } else {
        const newAlbumEntry = {
            id: album.id || `alb_${Date.now()}`,
            title: album.title || 'Álbum',
            artist: album.artist?.name || album.artist || 'Artista',
            coverUrl: album.coverUrl || album.cover_xl || album.cover_big || album.cover || '',
            year: album.year || '',
            liked_at: new Date().toISOString()
        };
        data.liked_albums.push(newAlbumEntry);
        recordPreferenceEvent({ type: 'like_artist', artistName: newAlbumEntry.artist });
        saveSync();
        return true;
    }
}

function recordTrackDownload(trackOrId, downloadInfo) {
    const trackId = (typeof trackOrId === 'object' && trackOrId !== null) ? trackOrId.id : trackOrId;
    let track = data.tracks.find(t => t.id == trackId);
    const nowIso = new Date().toISOString();

    if (!track && typeof trackOrId === 'object' && trackOrId !== null) {
        track = {
            id: trackOrId.id,
            title: trackOrId.title || 'Música Online',
            artist: trackOrId.artist || 'Artista',
            album: trackOrId.album || '',
            cover_path: '',
            coverUrl: trackOrId.coverUrl || trackOrId.thumbnail || '',
            thumbnail: trackOrId.thumbnail || trackOrId.coverUrl || '',
            duration: trackOrId.durationSeconds || trackOrId.seconds || (typeof trackOrId.duration === 'number' ? trackOrId.duration : 0),
            durationFormatted: trackOrId.durationFormatted || (typeof trackOrId.duration === 'string' ? trackOrId.duration : ''),
            url: trackOrId.url || '',
            isOnline: true,
            is_favorite: !!trackOrId.is_favorite,
            date_added: nowIso
        };
        data.tracks.push(track);
    }

    if (track) {
        track.file_path = downloadInfo.filePath;
        track.offline_path = downloadInfo.filePath;
        track.file_size = downloadInfo.fileSize || 0;
        track.download_status = 'downloaded';
        track.downloaded_at = nowIso;
        track.isOfflineAvailable = true;
        if (downloadInfo.coverPath && !track.cover_path) {
            track.cover_path = downloadInfo.coverPath;
        }
        saveSync();
        return track;
    }
    return null;
}

function deleteOfflineDownload(trackId) {
    const track = data.tracks.find(t => t.id == trackId);
    if (!track) return false;

    const targetPath = track.offline_path || track.file_path;
    if (targetPath) {
        try {
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
        } catch (err) {
            console.error('[db] Error unlinking offline audio file:', err);
        }
    }

    track.offline_path = '';
    track.download_status = 'none';
    track.file_size = 0;
    delete track.downloaded_at;
    track.isOfflineAvailable = false;

    // If it was purely an online track, clear file_path so it reverts to streamable online track
    if (track.isOnline || String(track.id).startsWith('dz_')) {
        track.file_path = '';
    }

    // Notice: track.is_favorite is intentionally kept intact!
    saveSync();
    return true;
}

function hasTrack(filePath) {
    return data.tracks.some(t => t.file_path === filePath);
}

function removeTrackByPath(filePath) {
    const initialLen = data.tracks.length;
    data.tracks = data.tracks.filter(t => t.file_path !== filePath);
    if (data.tracks.length !== initialLen) {
        save();
        return true;
    }
    return false;
}

function incrementPlayCount(trackId) {
    const track = data.tracks.find(t => t.id == trackId);
    if (track) {
        const now = new Date().toISOString();
        track.play_count = (track.play_count || 0) + 1;
        track.last_played = now;
        if (!track.play_history) track.play_history = [];
        track.play_history.push(now);
        // Keep last 1000 play timestamps to save space
        if (track.play_history.length > 1000) {
            track.play_history = track.play_history.slice(-1000);
        }
        save();
        return track.play_count;
    }
    return 0;
}

function getTrackPlayStats(track) {
    if (!track || !track.play_history) {
        const c = track ? (track.play_count || 0) : 0;
        return { day: 0, week: 0, month: 0, total: c };
    }
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    let day = 0, week = 0, month = 0;
    track.play_history.forEach(ts => {
        const time = new Date(ts).getTime();
        const diff = now - time;
        if (diff <= oneDay) day++;
        if (diff <= oneWeek) week++;
        if (diff <= oneMonth) month++;
    });

    return {
        day,
        week,
        month,
        total: track.play_count || track.play_history.length
    };
}

function getMostPlayed(limit = 10) {
    return getTopPlayedByPeriod('all', limit);
}

function getTopPlayedByPeriod(period = 'all', limit = 50) {
    const tracksWithStats = data.tracks.map(t => {
        const stats = getTrackPlayStats(t);
        let periodCount = stats.total;
        if (period === 'day') periodCount = stats.day;
        else if (period === 'week') periodCount = stats.week;
        else if (period === 'month') periodCount = stats.month;

        return {
            ...t,
            stats,
            period_play_count: periodCount
        };
    });

    return tracksWithStats
        .sort((a, b) => b.period_play_count - a.period_play_count || (b.play_count || 0) - (a.play_count || 0))
        .slice(0, limit);
}

function getGlobalListeningStats() {
    let todayPlays = 0;
    let weekPlays = 0;
    let monthPlays = 0;
    let totalPlays = 0;

    data.tracks.forEach(t => {
        const s = getTrackPlayStats(t);
        todayPlays += s.day;
        weekPlays += s.week;
        monthPlays += s.month;
        totalPlays += s.total;
    });

    return {
        todayPlays,
        weekPlays,
        monthPlays,
        totalPlays
    };
}

function getRecommended(limit = 15) {
    return recommender.getRecommendedTracks(data.tracks, limit);
}

function getDailyMixes() {
    return recommender.generateDailyMixes(data.tracks);
}

function getSimilarTracks(trackId, limit = 20) {
    const seed = data.tracks.find(t => t.id === trackId);
    return recommender.getSimilarTracks(seed, data.tracks, limit);
}

// Genres & Styles
function getGenres() {
    const genreMap = {};
    data.tracks.forEach(track => {
        const genreName = track.genre || genreClassifier.identifyGenre(track) || 'Outros';
        if (!genreMap[genreName]) {
            const def = genreClassifier.getGenreDefinition(genreName);
            genreMap[genreName] = {
                name: genreName,
                icon: def.icon,
                color: def.color,
                gradient: def.gradient,
                banner: def.banner,
                desc: def.desc,
                tracks: [],
                sampleCover: null
            };
        }
        genreMap[genreName].tracks.push(track);
        if (!genreMap[genreName].sampleCover && track.cover_path) {
            genreMap[genreName].sampleCover = track.cover_path;
        }
    });

    return Object.values(genreMap).map(g => {
        const uniqueArtists = [...new Set(g.tracks.map(t => t.artist).filter(Boolean))].slice(0, 3);
        const coverTrack = g.tracks.filter(t => t.cover_path).sort((a, b) => (b.play_count || 0) - (a.play_count || 0))[0];
        const sampleCover = coverTrack ? coverTrack.cover_path : g.sampleCover;
        return {
            name: g.name,
            icon: g.icon,
            color: g.color,
            gradient: g.gradient,
            banner: g.banner,
            desc: g.desc,
            trackCount: g.tracks.length,
            sampleCover: sampleCover,
            artistsPreview: uniqueArtists.join(', ')
        };
    }).sort((a, b) => b.trackCount - a.trackCount);
}

function getTracksByGenre(genreName) {
    if (!genreName) return [];
    return data.tracks.filter(t => {
        const g = t.genre || genreClassifier.identifyGenre(t);
        return g.toLowerCase() === genreName.toLowerCase();
    }).sort((a, b) => {
        const artistCmp = (a.artist || '').localeCompare(b.artist || '', undefined, { sensitivity: 'base' });
        if (artistCmp !== 0) return artistCmp;
        return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    });
}

function insertOrUpdateTrack(trackData, autoSave = false) {
    const existingIndex = data.tracks.findIndex(t => t.file_path === trackData.file_path);
    if (existingIndex !== -1) {
        const existing = data.tracks[existingIndex];
        data.tracks[existingIndex] = {
            ...existing,
            title: trackData.title,
            artist: trackData.artist,
            album: trackData.album,
            genre: trackData.genre,
            genre_identified: trackData.genre_identified || true,
            year: trackData.year,
            track_number: trackData.track_number,
            duration: trackData.duration,
            cover_path: trackData.cover_path
        };
    } else {
        data.tracks.push({
            ...trackData,
            id: trackIdCounter++,
            is_favorite: 0,
            genre_identified: true,
            date_added: new Date().toISOString()
        });
    }
    if (autoSave) save();
}

function deleteMissingTracks(existingPaths) {
    const existingSet = new Set(existingPaths);
    const initialLen = data.tracks.length;
    
    data.tracks = data.tracks.filter(t => existingSet.has(t.file_path));
    
    if (data.tracks.length !== initialLen) {
        save();
    }
}

function saveBatch() {
    saveSync();
}

// Playlists
function getPlaylists() {
    return [...data.playlists].sort((a, b) => a.name.localeCompare(b.name));
}

function createPlaylist(name, description = '', gradient = 'emerald') {
    const cleanName = (name || '').trim();
    if (!cleanName) return null;
    if (data.playlists.find(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
        return null; // Already exists
    }
    const newId = playlistIdCounter++;
    data.playlists.push({
        id: newId,
        name: cleanName,
        description: (description || '').trim(),
        gradient: gradient || 'emerald',
        tracks: [], // Array of track IDs in order
        date_created: new Date().toISOString()
    });
    save();
    return newId;
}

function getPlaylistById(id) {
    return data.playlists.find(p => p.id === id) || null;
}

function deletePlaylist(id) {
    data.playlists = data.playlists.filter(p => p.id !== id);
    save();
}

function getPlaylistTracks(playlistId) {
    const playlist = data.playlists.find(p => p.id === playlistId);
    if (!playlist) return [];
    
    const tracks = [];
    for (const trackId of playlist.tracks) {
        const t = data.tracks.find(t => t.id === trackId);
        if (t) tracks.push(t);
    }
    return tracks;
}

function addTrackToPlaylist(playlistId, trackIdOrTrack) {
    const playlist = data.playlists.find(p => p.id === playlistId);
    if (!playlist) return false;

    let trackId;
    if (typeof trackIdOrTrack === 'object' && trackIdOrTrack !== null) {
        trackId = trackIdOrTrack.id;
        let existing = data.tracks.find(t => t.id == trackId);
        if (!existing) {
            existing = {
                id: trackIdOrTrack.id,
                title: trackIdOrTrack.title || 'Música Online',
                artist: trackIdOrTrack.artist || 'Artista',
                album: trackIdOrTrack.album || '',
                cover_path: '',
                coverUrl: trackIdOrTrack.coverUrl || trackIdOrTrack.thumbnail || trackIdOrTrack.cover || '',
                thumbnail: trackIdOrTrack.thumbnail || trackIdOrTrack.coverUrl || trackIdOrTrack.cover || '',
                duration: trackIdOrTrack.durationSeconds || trackIdOrTrack.seconds || (typeof trackIdOrTrack.duration === 'number' ? trackIdOrTrack.duration : 0),
                durationFormatted: trackIdOrTrack.durationFormatted || (typeof trackIdOrTrack.duration === 'string' ? trackIdOrTrack.duration : ''),
                url: trackIdOrTrack.url || '',
                isOnline: true,
                is_favorite: !!trackIdOrTrack.is_favorite,
                date_added: new Date().toISOString()
            };
            data.tracks.push(existing);
        }
    } else {
        trackId = trackIdOrTrack;
    }

    if (!playlist.tracks.includes(trackId)) {
        playlist.tracks.push(trackId);
        save();
        return true;
    }
    return false;
}

function renamePlaylist(id, newName) {
    const playlist = data.playlists.find(p => p.id === id);
    if (playlist && newName && newName.trim()) {
        playlist.name = newName.trim();
        save();
        return true;
    }
    return false;
}

function updatePlaylist(id, newName, newDesc, newGradient) {
    const playlist = data.playlists.find(p => p.id === id);
    if (playlist) {
        if (newName && newName.trim()) playlist.name = newName.trim();
        if (newDesc !== undefined) playlist.description = newDesc.trim();
        if (newGradient) playlist.gradient = newGradient;
        save();
        return true;
    }
    return false;
}

function removeTrackFromPlaylist(playlistId, trackId) {
    const playlist = data.playlists.find(p => p.id === playlistId);
    if (playlist) {
        playlist.tracks = playlist.tracks.filter(id => id != trackId);
        save();
        return true;
    }
    return false;
}

// ==========================================================================
// USER PREFERENCES & RECOMMENDATION SCORING ENGINE
// ==========================================================================

function getUserPreferences() {
    if (!data.user_preferences) {
        data.user_preferences = {
            weights: {
                likeTrack: 5,
                likeArtist: 5,
                repeatTrack: 4,
                completedPlay: 3,
                fastSkip: -2,
                dislikeTrack: -5
            },
            artistScores: {},
            genreScores: {},
            trackScores: {},
            recentPlays: [],
            events: []
        };
    }

    const prefs = data.user_preferences;

    // Calculate top artists sorted by score
    const topArtists = Object.keys(prefs.artistScores || {})
        .map(name => ({
            name: prefs.artistScores[name].name || name,
            score: prefs.artistScores[name].score || 0,
            lastInteraction: prefs.artistScores[name].lastInteraction
        }))
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score);

    // Calculate top genres sorted by score
    const topGenres = Object.keys(prefs.genreScores || {})
        .map(name => ({
            name: prefs.genreScores[name].name || name,
            score: prefs.genreScores[name].score || 0
        }))
        .filter(g => g.score > 0)
        .sort((a, b) => b.score - a.score);

    // Calculate top tracks sorted by score
    const topTracks = Object.keys(prefs.trackScores || {})
        .map(id => ({
            id,
            score: prefs.trackScores[id].score || 0,
            title: prefs.trackScores[id].title,
            artist: prefs.trackScores[id].artist,
            coverUrl: prefs.trackScores[id].coverUrl,
            plays: prefs.trackScores[id].plays || 0
        }))
        .filter(t => t.score > 0)
        .sort((a, b) => b.score - a.score);

    // Check if user has real preferences established
    const favCount = data.tracks.filter(t => t.is_favorite).length;
    const albumFavCount = (data.liked_albums || []).length;
    const hasPreferences = favCount > 0 || albumFavCount > 0 || topArtists.length > 0 || (prefs.recentPlays && prefs.recentPlays.length >= 2);

    return {
        weights: prefs.weights,
        topArtists,
        topGenres,
        topTracks,
        recentPlays: (prefs.recentPlays || []).slice(0, 15),
        hasPreferences,
        stats: {
            favoritesCount: favCount,
            likedAlbumsCount: albumFavCount,
            totalInteractions: (prefs.events || []).length
        }
    };
}

function updateUserPreferenceWeights(newWeights) {
    if (!data.user_preferences) getUserPreferences();
    if (newWeights && typeof newWeights === 'object') {
        data.user_preferences.weights = {
            ...data.user_preferences.weights,
            ...newWeights
        };
        save();
    }
    return data.user_preferences.weights;
}

function recordPreferenceEvent(event) {
    if (!event || !event.type) return false;
    if (!data.user_preferences) getUserPreferences();
    const prefs = data.user_preferences;
    const weights = prefs.weights || {
        likeTrack: 5,
        likeArtist: 5,
        repeatTrack: 4,
        completedPlay: 3,
        fastSkip: -2,
        dislikeTrack: -5
    };

    const now = new Date().toISOString();
    const track = event.track || {};
    const trackId = track.id ? String(track.id) : (event.trackId ? String(event.trackId) : null);
    const rawArtist = track.artist || event.artistName || '';
    const artistClean = rawArtist && rawArtist !== 'Desconhecido' && rawArtist !== 'Artista' ? rawArtist.trim() : '';
    const artistKey = artistClean.toLowerCase();

    // Helper to adjust artist score safely
    const adjustArtist = (name, clean, delta) => {
        if (!clean) return;
        if (!prefs.artistScores[clean]) {
            prefs.artistScores[clean] = { name, score: 0, lastInteraction: now };
        }
        prefs.artistScores[clean].score = Math.max(0, Math.round((prefs.artistScores[clean].score + delta) * 10) / 10);
        prefs.artistScores[clean].lastInteraction = now;
        if (prefs.artistScores[clean].score === 0) {
            delete prefs.artistScores[clean];
        }
    };

    // Helper to adjust genre score safely
    const adjustGenre = (genreStr, delta) => {
        if (!genreStr || genreStr === 'Unknown' || genreStr === 'Desconhecido') return;
        const genres = genreStr.split(/[,/;&]/).map(g => g.trim()).filter(Boolean);
        genres.forEach(g => {
            const key = g.toLowerCase();
            if (!prefs.genreScores[key]) {
                prefs.genreScores[key] = { name: g, score: 0 };
            }
            prefs.genreScores[key].score = Math.max(0, Math.round((prefs.genreScores[key].score + delta) * 10) / 10);
            if (prefs.genreScores[key].score === 0) {
                delete prefs.genreScores[key];
            }
        });
    };

    // Helper to adjust track score safely
    const adjustTrack = (id, delta, trackObj) => {
        if (!id) return;
        if (!prefs.trackScores[id]) {
            prefs.trackScores[id] = {
                id,
                title: trackObj?.title || 'Música',
                artist: trackObj?.artist || 'Artista',
                coverUrl: trackObj?.coverUrl || trackObj?.thumbnail || '',
                score: 0,
                plays: 0,
                skips: 0,
                lastInteraction: now
            };
        }
        const entry = prefs.trackScores[id];
        entry.score = Math.max(-10, Math.round((entry.score + delta) * 10) / 10);
        entry.lastInteraction = now;
        if (trackObj?.title) entry.title = trackObj.title;
        if (trackObj?.artist) entry.artist = trackObj.artist;
        if (trackObj?.coverUrl || trackObj?.thumbnail) entry.coverUrl = trackObj.coverUrl || trackObj.thumbnail;
    };

    switch (event.type) {
        case 'like_track': {
            const delta = weights.likeTrack; // +5
            adjustTrack(trackId, delta, track);
            adjustArtist(artistClean, artistKey, delta);
            adjustGenre(track.genre, delta * 0.5);
            break;
        }
        case 'unlike_track':
        case 'dislike_track': {
            const delta = weights.dislikeTrack; // -5
            adjustTrack(trackId, delta, track);
            adjustArtist(artistClean, artistKey, delta * 0.6);
            adjustGenre(track.genre, delta * 0.4);
            break;
        }
        case 'like_artist': {
            const delta = weights.likeArtist; // +5
            adjustArtist(artistClean, artistKey, delta);
            break;
        }
        case 'unlike_artist': {
            const delta = -weights.likeArtist; // -5
            adjustArtist(artistClean, artistKey, delta);
            break;
        }
        case 'repeat_track': {
            const delta = weights.repeatTrack; // +4
            adjustTrack(trackId, delta, track);
            adjustArtist(artistClean, artistKey, delta * 0.5);
            break;
        }
        case 'play_complete': {
            const delta = weights.completedPlay; // +3
            adjustTrack(trackId, delta, track);
            if (prefs.trackScores[trackId]) {
                prefs.trackScores[trackId].plays = (prefs.trackScores[trackId].plays || 0) + 1;
            }
            adjustArtist(artistClean, artistKey, delta * 0.6);
            adjustGenre(track.genre, delta * 0.4);

            // Record into recentPlays (prevent duplicate immediate consecutive entries)
            if (trackId) {
                if (!prefs.recentPlays) prefs.recentPlays = [];
                const first = prefs.recentPlays[0];
                if (!first || String(first.id) !== trackId) {
                    prefs.recentPlays.unshift({
                        id: trackId,
                        title: track.title || 'Música',
                        artist: track.artist || 'Artista',
                        genre: track.genre || '',
                        coverUrl: track.coverUrl || track.thumbnail || track.cover_path || '',
                        timestamp: now
                    });
                    if (prefs.recentPlays.length > 50) {
                        prefs.recentPlays = prefs.recentPlays.slice(0, 50);
                    }
                }
            }
            break;
        }
        case 'fast_skip': {
            const delta = weights.fastSkip; // -2
            adjustTrack(trackId, delta, track);
            if (prefs.trackScores[trackId]) {
                prefs.trackScores[trackId].skips = (prefs.trackScores[trackId].skips || 0) + 1;
            }
            adjustArtist(artistClean, artistKey, delta * 0.5);
            break;
        }
    }

    // Keep log of last 100 interaction events
    if (!prefs.events) prefs.events = [];
    prefs.events.unshift({
        type: event.type,
        trackId,
        artist: artistClean,
        timestamp: now
    });
    if (prefs.events.length > 100) {
        prefs.events = prefs.events.slice(0, 100);
    }

    save();
    return true;
}

module.exports = {
    init, getSettings, updateSettings, addFolder, removeFolder,
    getAllTracks, searchTracks, getFavorites, toggleFavorite, insertOrUpdateTrack, deleteMissingTracks,
    hasTrack, removeTrackByPath, getTrackById, updateTrackTags,
    incrementPlayCount, getMostPlayed, getTopPlayedByPeriod, getGlobalListeningStats, getTrackPlayStats,
    getRecommended, getDailyMixes, getSimilarTracks,
    getGenres, getTracksByGenre,
    getPlaylists, getPlaylistById, createPlaylist, deletePlaylist, renamePlaylist, updatePlaylist, getPlaylistTracks, addTrackToPlaylist, removeTrackFromPlaylist,
    saveBatch,
    verifyOfflineAvailability,
    recordTrackDownload,
    deleteOfflineDownload,
    getLikedAlbums,
    isAlbumLiked,
    toggleFavoriteAlbum,
    setTracksFavorite,
    recordPreferenceEvent,
    getUserPreferences,
    updateUserPreferenceWeights,
    data
};


