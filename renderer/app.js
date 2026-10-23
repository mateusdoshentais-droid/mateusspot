// ==========================================================================
// SPOTCRY DESKTOP - CORE CLIENT ENGINE
// ==========================================================================

const audio = document.getElementById('audio-player');

// Player controls
const btnPlay = document.getElementById('btn-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const btnMute = document.getElementById('btn-mute');
const iconVolHigh = document.getElementById('icon-vol-high');
const iconVolMute = document.getElementById('icon-vol-mute');

const volumeSlider = document.getElementById('volume-slider');
const progressSlider = document.getElementById('progress-slider');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const lblTitle = document.getElementById('now-title');
const lblArtist = document.getElementById('now-artist');
const coverImg = document.getElementById('now-cover');
const nowPlayingFav = document.getElementById('btn-now-fav');

// Tool buttons
const btnLyrics = document.getElementById('btn-lyrics');
const btnQueue = document.getElementById('btn-queue');
const btnEqualizer = document.getElementById('btn-equalizer');
const btnFullscreen = document.getElementById('btn-fullscreen');

const DEFAULT_COVER_SVG = "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23535353'%3E%3Crect width='24' height='24' fill='%23282828'/%3E%3Cpath d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z' fill='%23757575'/%3E%3C/svg%3E";

let mediaServerPort = 0;
let currentQueue = [];
let userQueue = []; // Priority user queue (Adicionar à Fila / Tocar a Seguir)
let currentIndex = -1;
let isShuffle = false;
let repeatMode = 0; // 0 = off, 1 = all, 2 = one
let originalQueue = [];
let allTracksCache = [];
let currentOpenPlaylistId = null;

// Global Track Registry for seamless 100% online & local tracks integration
const trackRegistry = new Map();

function registerTrack(track) {
    if (!track || !track.id) return track;
    const strId = String(track.id);
    trackRegistry.set(strId, track);
    if (track.url) trackRegistry.set(String(track.url), track);
    return track;
}

function findTrack(trackId) {
    if (!trackId) return null;
    const strId = String(trackId);
    if (trackRegistry.has(strId)) return trackRegistry.get(strId);
    if (allTracksCache && allTracksCache.length) {
        const found = allTracksCache.find(t => String(t.id) === strId);
        if (found) return found;
    }
    if (currentQueue && currentQueue.length) {
        const found = currentQueue.find(t => String(t.id) === strId);
        if (found) return found;
    }
    if (userQueue && userQueue.length) {
        const found = userQueue.find(t => String(t.id) === strId);
        if (found) return found;
    }
    return null;
}

// ==========================================================================
// UNIVERSAL LIKED SONGS & GLOBAL HEART SYNCHRONIZATION
// ==========================================================================
const FILLED_HEART_SVG = `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="#1ED760"><path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z"></path></svg>`;
const OUTLINE_HEART_SVG = `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.626 3.161a2.766 2.766 0 0 1 3.91 0l.464.465.465-.465a2.766 2.766 0 0 1 3.91 3.91l-4.375 4.375-4.374-4.375a2.766 2.766 0 0 1 0-3.91zM2.686 4.22a1.266 1.266 0 0 0 0 1.79l3.315 3.314 3.314-3.314a1.266 1.266 0 0 0-1.79-1.79l-1.524 1.524-1.524-1.524a1.266 1.266 0 0 0-1.791 0z"></path></svg>`;

let currentOpenPlaylistIsFavorites = false;
let currentPlaylistMasterTracks = [];

function syncHeartButtonsGlobally(trackId, isFav) {
    if (!trackId) return;
    const strId = String(trackId);

    // 1. Update in-memory track references
    const updateFavProp = (t) => {
        if (t && (String(t.id) === strId || t.id == trackId)) {
            t.is_favorite = !!isFav;
        }
    };
    if (trackRegistry.has(strId)) {
        trackRegistry.get(strId).is_favorite = !!isFav;
    }
    if (allTracksCache) allTracksCache.forEach(updateFavProp);
    if (currentQueue) currentQueue.forEach(updateFavProp);
    if (userQueue) userQueue.forEach(updateFavProp);
    if (typeof activeOnlineTracks !== 'undefined' && activeOnlineTracks) activeOnlineTracks.forEach(updateFavProp);

    // 2. Now-playing player heart
    const curr = currentQueue[currentIndex];
    if (curr && (String(curr.id) === strId || curr.id == trackId)) {
        curr.is_favorite = !!isFav;
        if (nowPlayingFav) {
            nowPlayingFav.classList.toggle('active', !!isFav);
            nowPlayingFav.title = isFav ? "Remover dos Favoritos" : "Salvar em Músicas Curtidas";
        }
    }

    // 3. Update all matching heart elements in the DOM
    const selectors = [
        `.track-row[data-track-id="${trackId}"] .heart-btn`,
        `.sp-song-row[data-track-id="${trackId}"] .heart-btn`,
        `#sp-heart-top-${trackId}`,
        `#sp-heart-${trackId}`,
        `#sp-heart-card-${trackId}`,
        `.queue-item[data-track-id="${trackId}"] .queue-item-heart-btn`,
        `[data-heart-track-id="${trackId}"]`
    ];

    document.querySelectorAll(selectors.join(', ')).forEach(btn => {
        btn.classList.toggle('active', !!isFav);
        btn.innerHTML = isFav ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
        btn.title = isFav ? "Remover dos Favoritos" : "Salvar nos Favoritos";
    });

    // 4. Update sidebar count and quick card count
    if (window.api && window.api.getFavorites) {
        window.api.getFavorites().then(favs => {
            const count = favs ? favs.length : 0;
            const libFavCountEl = document.getElementById('lib-fav-count');
            if (libFavCountEl) libFavCountEl.innerText = count;
            const homeFavCountEl = document.getElementById('quick-fav-count');
            if (homeFavCountEl) homeFavCountEl.innerText = `${count} músicas`;
        }).catch(() => {});
    }
}

async function toggleFavoriteTrack(track) {
    if (!track) return false;
    registerTrack(track);
    const isFav = await window.api.toggleFavorite(track);
    track.is_favorite = isFav;
    syncHeartButtonsGlobally(track.id, isFav);

    if (isFav) {
        // Check if track is already available offline
        let isAlreadyOffline = track.isOfflineAvailable ||
            track.download_status === 'downloaded' ||
            (track.file_path && !track.isOnline && !String(track.id).startsWith('dz_'));

        if (!isAlreadyOffline && window.api.checkTrackOffline) {
            isAlreadyOffline = await window.api.checkTrackOffline(track.id).catch(() => false);
        }

        if (isAlreadyOffline) {
            track.isOfflineAvailable = true;
            track.download_status = 'downloaded';
            updateTrackOfflineBadges(track.id, 'downloaded');
            showToast(`"${track.title}" curtida! ❤️ (Disponível offline)`);
        } else if (track.download_status !== 'downloading') {
            showToast(`"${track.title}" curtida! Baixando para ouvir offline... ⬇️`);
            queueTrackForDownload(track, null, true);
        } else {
            showToast(`"${track.title}" curtida! ❤️ (Download em andamento... ⏳)`);
        }
    } else {
        showToast(`"${track.title}" removida de Músicas Curtidas.`);
    }

    if (window.api && window.api.recordPreferenceEvent) {
        window.api.recordPreferenceEvent({
            type: isFav ? 'like_track' : 'unlike_track',
            track
        }).catch(() => {});
    }
    setTimeout(() => {
        loadSmartRecommendations(true);
    }, 500);

    return isFav;
}

async function openLikedSongsView() {
    const favs = (await window.api.getFavorites()) || [];
    openPlaylistDetailView({
        title: 'Músicas Curtidas',
        type: 'Playlist',
        desc: 'Suas músicas favoritas salvas no SpotCry',
        cover: null,
        isFavorites: true,
        tracks: favs
    });
}

function getTrackCover(t) {
    if (!t) return DEFAULT_COVER_SVG;
    const candidates = [
        t.coverUrl,
        t.thumbnail,
        t.cover,
        t.picture_xl,
        t.picture_big,
        t.picture_medium,
        t.picture_small,
        t.cover_xl,
        t.cover_big,
        t.cover_medium,
        t.cover_small,
        t.cover_path
    ];
    for (const c of candidates) {
        if (c && typeof c === 'string' && c.trim().length > 0) {
            const trimmed = c.trim();
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
                return trimmed;
            }
            return getMediaUrl(trimmed);
        }
    }
    return DEFAULT_COVER_SVG;
}


// Playlist Modal State & Colors
let editingPlaylistId = null;
let deletingPlaylistId = null;
let selectedModalGradient = 'emerald';
let pendingAddTrackId = null;

const GRADIENT_MAP = {
    emerald: {
        banner: 'linear-gradient(180deg, #059669 0%, rgba(18, 18, 18, 0.9) 100%)',
        thumb: 'linear-gradient(135deg, #10b981, #047857)'
    },
    purple: {
        banner: 'linear-gradient(180deg, #7c3aed 0%, rgba(18, 18, 18, 0.9) 100%)',
        thumb: 'linear-gradient(135deg, #8b5cf6, #4c1d95)'
    },
    ocean: {
        banner: 'linear-gradient(180deg, #0284c7 0%, rgba(18, 18, 18, 0.9) 100%)',
        thumb: 'linear-gradient(135deg, #06b6d4, #0e7490)'
    },
    sunset: {
        banner: 'linear-gradient(180deg, #ea580c 0%, rgba(18, 18, 18, 0.9) 100%)',
        thumb: 'linear-gradient(135deg, #f59e0b, #dc2626)'
    },
    neon: {
        banner: 'linear-gradient(180deg, #db2777 0%, rgba(18, 18, 18, 0.9) 100%)',
        thumb: 'linear-gradient(135deg, #ec4899, #be185d)'
    },
    midnight: {
        banner: 'linear-gradient(180deg, #2563eb 0%, rgba(18, 18, 18, 0.9) 100%)',
        thumb: 'linear-gradient(135deg, #3b82f6, #1e3a8a)'
    }
};

// Audio Context & Equalizer & Crossfade State
let audioCtx = null;
let audioSource = null;
let eqFilters = [];
const EQ_FREQUENCIES = [60, 250, 1000, 4000, 12000];
const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0],
    bass: [8, 5, 0, -1, -2],
    rock: [5, 3, -1, 4, 6],
    pop: [-1, 2, 5, 3, -2],
    vocal: [-3, -1, 4, 5, 2],
    club: [6, 4, 2, 4, 3],
    treble: [-4, -2, 0, 5, 8]
};
let crossfadeDuration = parseInt(localStorage.getItem('spotcry_crossfade') || '0', 10);

// Lyrics State
let activeLyrics = [];
let activeLyricsIndex = -1;
let lyricsFetchController = null;

// Context Menu State
let selectedContextTrack = null;
let selectedContextPlaylistId = null;

async function initMediaServer() {
    try {
        mediaServerPort = await window.api.getMediaServerPort();
    } catch(e) {
        console.error('Error fetching media server port:', e);
    }
}

function getMediaUrl(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
    }
    if (mediaServerPort) {
        return `http://127.0.0.1:${mediaServerPort}/media?file=${encodeURIComponent(trimmed)}`;
    }
    const clean = trimmed.replace(/\\/g, '/');
    return encodeURI('file:///' + (clean.startsWith('/') ? clean.slice(1) : clean));
}

// Toast Notification
function showToast(msg) {
    const toast = document.getElementById('toast-notify');
    const text = document.getElementById('toast-text');
    if (!toast || !text) return;
    text.innerText = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds === null || seconds === undefined) return '0:00';
    seconds = Math.floor(seconds);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch(e) {
        return '';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Navigation & Views
let previousViewId = 'view-home';
function showView(viewId) {
    const currentActive = document.querySelector('.view.active');
    if (currentActive && currentActive.id !== viewId && currentActive.id !== 'view-lyrics') {
        previousViewId = currentActive.id;
    }
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');

    // Hide top pill filter bar on lyrics and settings view
    const pillsBar = document.querySelector('.main-top-pills-bar');
    if (pillsBar) {
        if (viewId === 'view-lyrics' || viewId === 'view-settings') {
            pillsBar.style.display = 'none';
        } else {
            pillsBar.style.display = 'flex';
        }
    }

    if (viewId === 'view-lyrics') {
        startLyricsSyncLoop();
    } else {
        stopLyricsSyncLoop();
    }
}

// Top Bar Events
document.getElementById('btn-top-home').addEventListener('click', () => {
    showView('view-home');
    loadHomeView();
});

document.getElementById('btn-lib-home').addEventListener('click', () => {
    showView('view-home');
    loadHomeView();
});

document.getElementById('btn-user-settings').addEventListener('click', () => {
    showView('view-settings');
    loadSettings();
});

document.getElementById('btn-sidebar-add').addEventListener('click', () => {
    openCreatePlaylistModal();
});

// Search input with debounce (Unified Spotify Search)
let searchTimer = null;
const globalSearchInput = document.getElementById('global-search-input');

if (globalSearchInput) {
    globalSearchInput.addEventListener('focus', () => {
        const query = globalSearchInput.value.trim();
        openOnlineSearchView(query);
    });

    globalSearchInput.addEventListener('click', () => {
        const query = globalSearchInput.value.trim();
        openOnlineSearchView(query);
    });

    globalSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            openOnlineSearchView(query);
        }, 180);
    });

    globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const query = e.target.value.trim();
            if (searchTimer) clearTimeout(searchTimer);
            openOnlineSearchView(query);
        }
    });
}

document.querySelector('.search-browse-btn')?.addEventListener('click', () => {
    openOnlineSearchView('');
});

// Sidebar Pill Filters (Playlists, Artistas, Álbuns, Estilos)
document.querySelectorAll('.sidebar-pills-row .pill-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-pills-row .pill-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-pill');
        if (filter === 'albums') {
            document.querySelectorAll('.main-pill-btn').forEach(b => b.classList.remove('active'));
            const albBtn = document.querySelector('.main-pill-btn[data-main-filter="albums"]');
            if (albBtn) albBtn.classList.add('active');
            openAllAlbumsView();
        } else if (filter === 'genres') {
            document.querySelectorAll('.main-pill-btn').forEach(b => b.classList.remove('active'));
            const genBtn = document.querySelector('.main-pill-btn[data-main-filter="genres"]');
            if (genBtn) genBtn.classList.add('active');
            openAllGenresView();
        }
        renderSidebarList(filter);
    });
});

// Main top filter pills (Tudo, Feito para Você, Músicas em Alta, Artistas, Álbuns, Estilos & Gêneros)
document.querySelectorAll('.main-pill-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        document.querySelectorAll('.main-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const f = btn.getAttribute('data-main-filter');
        if (f === 'for-you') {
            showView('view-home');
            const targetEl = document.getElementById('section-smart-made-for-you');
            if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
        } else if (f === 'music') {
            if (homeChartsCache && homeChartsCache.tracks && homeChartsCache.tracks.length > 0) {
                openPlaylistDetailView({
                    title: 'Músicas em Alta no Brasil & Mundo',
                    type: 'Top Hits',
                    desc: `${homeChartsCache.tracks.length} músicas mais ouvidas no momento`,
                    cover: homeChartsCache.tracks[0]?.cover || null,
                    tracks: homeChartsCache.tracks
                });
            } else {
                showView('view-home');
                loadHomeView();
            }
        } else if (f === 'artists') {
            openAllArtistsView();
        } else if (f === 'albums') {
            await openAllAlbumsView();
        } else if (f === 'genres') {
            await openAllGenresView();
        } else {
            showView('view-home');
            loadHomeView();
        }
    });
});

// Top Search Capsule Web Button
document.getElementById('btn-top-web-search')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const input = document.getElementById('global-search-input');
    const query = input?.value?.trim() || '';
    if (input) {
        input.focus();
        input.select();
    }
    openOnlineSearchView(query);
});

// Click anywhere on search capsule focuses input
document.getElementById('top-search-capsule')?.addEventListener('click', (e) => {
    if (e.target !== globalSearchInput && !e.target.closest('button')) {
        globalSearchInput?.focus();
    }
});

// Liked Songs in Sidebar
document.getElementById('item-liked-songs').addEventListener('click', async () => {
    await openLikedSongsView();
});

// Click on artist in bottom player
lblArtist.addEventListener('click', () => {
    const currentTrack = currentQueue[currentIndex];
    if (currentTrack && currentTrack.artist && currentTrack.artist !== 'SpotCry' && currentTrack.artist !== 'Desconhecido') {
        openArtistView(currentTrack.artist);
    }
});

// ==========================================================================
// WEB AUDIO API - EQUALIZER & AUDIO GRAPH
// ==========================================================================

function initAudioContext() {
    if (audioCtx) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        audioSource = audioCtx.createMediaElementSource(audio);

        // Build 5-band filter chain
        eqFilters = EQ_FREQUENCIES.map((freq, i) => {
            const filter = audioCtx.createBiquadFilter();
            if (i === 0) {
                filter.type = 'lowshelf';
            } else if (i === EQ_FREQUENCIES.length - 1) {
                filter.type = 'highshelf';
            } else {
                filter.type = 'peaking';
                filter.Q.value = 1.0;
            }
            filter.frequency.value = freq;
            filter.gain.value = 0;
            return filter;
        });

        // Connect chain: source -> filter[0] -> filter[1] -> ... -> destination
        let lastNode = audioSource;
        eqFilters.forEach(f => {
            lastNode.connect(f);
            lastNode = f;
        });
        lastNode.connect(audioCtx.destination);

        // Load saved equalizer settings
        loadSavedEqualizer();
    } catch (e) {
        console.warn("Web Audio API not supported or failed to initialize:", e);
    }
}

function loadSavedEqualizer() {
    try {
        const savedGains = JSON.parse(localStorage.getItem('spotcry_eq_gains') || '[0,0,0,0,0]');
        applyEqualizerGains(savedGains);
    } catch(e) {}
}

function applyEqualizerGains(gains) {
    gains.forEach((g, i) => {
        if (eqFilters[i]) {
            eqFilters[i].gain.value = g;
        }
        const slider = document.getElementById(`eq-band-${i}`);
        const valLabel = document.getElementById(`eq-val-${i}`);
        if (slider) slider.value = g;
        if (valLabel) valLabel.innerText = `${g > 0 ? '+' : ''}${g} dB`;
    });
    localStorage.setItem('spotcry_eq_gains', JSON.stringify(gains));
}

// Equalizer Modal Setup
btnEqualizer.addEventListener('click', () => {
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    document.getElementById('equalizer-modal').classList.add('open');
});

document.getElementById('btn-close-eq').addEventListener('click', () => {
    document.getElementById('equalizer-modal').classList.remove('open');
});
document.getElementById('btn-done-eq').addEventListener('click', () => {
    document.getElementById('equalizer-modal').classList.remove('open');
    showToast("Ajustes do equalizador salvos!");
});

document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const presetKey = btn.getAttribute('data-eq');
        if (EQ_PRESETS[presetKey]) {
            applyEqualizerGains(EQ_PRESETS[presetKey]);
        }
    });
});

for (let i = 0; i < 5; i++) {
    const slider = document.getElementById(`eq-band-${i}`);
    if (slider) {
        slider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (eqFilters[i]) eqFilters[i].gain.value = val;
            const valLabel = document.getElementById(`eq-val-${i}`);
            if (valLabel) valLabel.innerText = `${val > 0 ? '+' : ''}${val} dB`;
            
            // Save manual adjustment
            const currentGains = eqFilters.map(f => f.gain.value);
            localStorage.setItem('spotcry_eq_gains', JSON.stringify(currentGains));
            
            document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(b => b.classList.remove('active'));
        });
    }
}

document.getElementById('btn-reset-eq').addEventListener('click', () => {
    applyEqualizerGains(EQ_PRESETS.flat);
    document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(b => b.classList.remove('active'));
    const flatBtn = document.querySelector('.eq-presets-bar .pill-chip[data-eq="flat"]');
    if (flatBtn) flatBtn.classList.add('active');
    showToast("Equalizador restaurado");
});

// ==========================================================================
// HOME VIEW RENDERING
// ==========================================================================

let homeChartsCache = null;
let smartRecsData = null;

async function loadHomeView() {
    let favs = [];
    try {
        favs = (await window.api.getFavorites()) || [];
        const favCountEl = document.getElementById('lib-fav-count');
        if (favCountEl) favCountEl.innerText = favs.length;
    } catch(e) {}

    let charts = { tracks: [], artists: [], albums: [] };
    try {
        charts = (await window.api.getOnlineCharts()) || { tracks: [], artists: [], albums: [] };
        homeChartsCache = charts;
    } catch(e) {
        console.error('Error fetching online charts:', e);
    }

    try { renderHomeQuickMixes(charts, favs); } catch(e) { console.error(e); }
    try { await loadSmartRecommendations(); } catch(e) { console.error('Error loading smart recommendations:', e); }
    try { renderHomeTrendingTracks(charts.tracks || []); } catch(e) { console.error(e); }
    try { renderHomeOnlineArtists(charts.artists || []); } catch(e) { console.error(e); }
    try { renderHomeOnlineAlbums(charts.albums || []); } catch(e) { console.error(e); }
    try {
        renderHomeGenres();
    } catch(e) { console.error(e); }

    try { renderSidebarList('playlists'); } catch(e) { console.error(e); }
}

async function loadSmartRecommendations(forceRefresh = false) {
    if (!window.api || !window.api.getSmartRecommendations) return;
    try {
        const recs = await window.api.getSmartRecommendations({ forceRefresh });
        if (!recs || !recs.categories) return;
        smartRecsData = recs;

        const cats = recs.categories;

        // 1. Feito para você
        if (cats.madeForYou) {
            updateRecommendationHeader('made-for-you', cats.madeForYou);
            renderRecommendationTrackRow('row-made-for-you', cats.madeForYou.tracks || []);
        }

        // 2. Artistas semelhantes
        if (cats.similarArtists) {
            updateRecommendationHeader('similar-artists', cats.similarArtists);
            renderRecommendationArtistRow('row-similar-artists', cats.similarArtists.artists || []);
        }

        // 3. Novas descobertas
        if (cats.newDiscoveries) {
            updateRecommendationHeader('new-discoveries', cats.newDiscoveries);
            renderRecommendationTrackRow('row-new-discoveries', cats.newDiscoveries.tracks || []);
        }

        // 4. Mais do que você curte
        if (cats.moreOfWhatYouLike) {
            updateRecommendationHeader('more-liked', cats.moreOfWhatYouLike);
            renderRecommendationTrackRow('row-more-liked', cats.moreOfWhatYouLike.tracks || []);
        }

        // 5. Continue explorando
        if (cats.continueExploring) {
            updateRecommendationHeader('continue-exploring', cats.continueExploring);
            renderRecommendationTrackRow('row-continue-exploring', cats.continueExploring.tracks || []);
        }
    } catch (err) {
        console.warn('[SmartRecs] Failed to load recommendations:', err);
    }
}

function updateRecommendationHeader(key, catData) {
    const titleEl = document.getElementById(`title-${key}`);
    const subEl = document.getElementById(`sub-${key}`);
    const badgeEl = document.getElementById(`badge-${key}`);

    if (titleEl && catData.title) {
        titleEl.childNodes[0].nodeValue = `${catData.title} `;
    }
    if (subEl && catData.subtitle) {
        subEl.innerText = catData.subtitle;
    }
    if (badgeEl && catData.badge) {
        badgeEl.innerText = catData.badge;
    }
}

function renderRecommendationTrackRow(containerId, tracks) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-subdued); padding: 12px;">Nenhuma recomendação disponível no momento.</p>';
        return;
    }

    tracks.slice(0, 10).forEach(t => {
        const card = document.createElement('div');
        card.className = 'spotify-card';
        card.dataset.trackId = t.id;
        const coverSrc = t.cover || t.thumbnail || t.coverUrl || DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${coverSrc}" alt="${escapeHtml(t.title)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Tocar ${escapeHtml(t.title)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
            <div class="card-desc clickable" title="Ver Artista">${escapeHtml(t.artist)}</div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('card-desc')) {
                openArtistView(t.artist);
                return;
            }
            if (t.offline_path || (t.file_path && !t.isOnline && !String(t.id).startsWith('dz_'))) {
                playTrack(t, tracks);
            } else {
                playOnlineFullTrack(t, tracks);
            }
        });

        container.appendChild(card);
    });
}

function renderRecommendationArtistRow(containerId, artists) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    if (!artists || artists.length === 0) {
        container.innerHTML = '<p style="color: var(--text-subdued); padding: 12px;">Carregando artistas...</p>';
        return;
    }

    artists.slice(0, 10).forEach(art => {
        const card = document.createElement('div');
        card.className = 'spotify-card artist-card';
        const pic = art.picture || art.picture_big || DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap round">
                <img src="${pic}" alt="${escapeHtml(art.name)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Ver perfil de ${escapeHtml(art.name)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" style="text-align: center;" title="${escapeHtml(art.name)}">${escapeHtml(art.name)}</div>
            <div class="card-desc" style="text-align: center;">${art.fans ? formatViews(art.fans) + ' fãs' : 'Artista Relacionado'}</div>
        `;

        card.addEventListener('click', () => {
            openArtistView(art.name);
        });

        container.appendChild(card);
    });
}

function renderHomeQuickMixes(charts, favs) {
    const container = document.getElementById('home-quick-mixes');
    if (!container) return;
    container.innerHTML = '';

    // 1. Músicas Curtidas
    const favCard = document.createElement('div');
    favCard.className = 'quick-card';
    favCard.innerHTML = `
        <div class="quick-card-thumb fav-gradient">
            <svg viewBox="0 0 16 16" width="24" height="24"><path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z" fill="#fff"/></svg>
        </div>
        <span class="quick-card-title">Músicas Curtidas</span>
        <button class="quick-card-play" title="Tocar Músicas Curtidas">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
        </button>
    `;
    favCard.addEventListener('click', async (e) => {
        if (e.target.closest('.quick-card-play')) {
            const currentFavs = (await window.api.getFavorites()) || [];
            if (currentFavs && currentFavs.length > 0) playTrack(currentFavs[0], currentFavs);
            else showToast('Você ainda não tem músicas curtidas.');
        } else {
            await openLikedSongsView();
        }
    });
    container.appendChild(favCard);

    // 2. Top Hits Brasil & Mundo
    const topTracks = (charts && charts.tracks) ? charts.tracks : [];
    const topCard = document.createElement('div');
    topCard.className = 'quick-card';
    topCard.innerHTML = `
        <div class="quick-card-thumb" style="background: linear-gradient(135deg, #1DB954, #128C7E); display:flex; align-items:center; justify-content:center; font-size:24px;">🔥</div>
        <span class="quick-card-title">Top Hits Brasil & Mundo</span>
        <button class="quick-card-play" title="Tocar Top Hits">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
        </button>
    `;
    topCard.addEventListener('click', (e) => {
        if (topTracks.length > 0) {
            playOnlineFullTrack(topTracks[0], topTracks);
        }
    });
    container.appendChild(topCard);

    // 3-6. Top 4 Albums from online charts
    const albums = (charts && charts.albums) ? charts.albums : [];
    albums.slice(0, 4).forEach(alb => {
        const card = document.createElement('div');
        card.className = 'quick-card';
        const coverSrc = alb.cover || DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="quick-card-thumb">
                <img src="${coverSrc}" alt="${escapeHtml(alb.title)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
            </div>
            <span class="quick-card-title">${escapeHtml(alb.title)}</span>
            <button class="quick-card-play" title="Abrir ${escapeHtml(alb.title)}">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
            </button>
        `;
        card.addEventListener('click', () => {
            openOnlineAlbumView(alb);
        });
        container.appendChild(card);
    });
}

function renderHomeTrendingTracks(tracks) {
    const container = document.getElementById('home-recent-row');
    if (!container) return;
    container.innerHTML = '';

    if (!tracks || tracks.length === 0) {
        container.innerHTML = '<p style="color: var(--text-subdued); padding: 16px;">Carregando músicas em alta...</p>';
        return;
    }

    tracks.slice(0, 10).forEach(t => {
        const card = document.createElement('div');
        card.className = 'spotify-card';
        card.dataset.trackId = t.id;
        const coverSrc = t.cover || t.thumbnail || DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${coverSrc}" alt="${escapeHtml(t.title)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Tocar ${escapeHtml(t.title)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>
            <div class="card-desc clickable" title="Ver Artista">${escapeHtml(t.artist)}</div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('card-desc')) {
                openArtistView(t.artist);
                return;
            }
            playOnlineFullTrack(t, tracks);
        });

        container.appendChild(card);
    });
}

function renderHomeOnlineArtists(artists) {
    const container = document.getElementById('home-artists-row');
    if (!container) return;
    container.innerHTML = '';

    const wrap = document.getElementById('section-artists-home');
    if (!artists || artists.length === 0) {
        if (wrap) wrap.style.display = 'none';
        return;
    }
    if (wrap) wrap.style.display = 'block';

    artists.slice(0, 10).forEach(art => {
        const card = document.createElement('div');
        card.className = 'spotify-card artist-card';
        const pic = art.picture || DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap round">
                <img src="${pic}" alt="${escapeHtml(art.name)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Ver perfil de ${escapeHtml(art.name)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" style="text-align: center;" title="${escapeHtml(art.name)}">${escapeHtml(art.name)}</div>
            <div class="card-desc" style="text-align: center;">Artista</div>
        `;

        card.addEventListener('click', () => {
            openArtistView(art.name);
        });

        container.appendChild(card);
    });
}

function renderHomeOnlineAlbums(albums) {
    const container = document.getElementById('home-recommended-row');
    if (!container) return;
    container.innerHTML = '';

    if (!albums || albums.length === 0) {
        return;
    }

    albums.slice(0, 10).forEach(alb => {
        const card = document.createElement('div');
        card.className = 'spotify-card';
        const coverSrc = alb.cover || DEFAULT_COVER_SVG;

        const albumKey = alb.id ? String(alb.id) : (alb.title ? alb.title.toLowerCase() : '');
        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${coverSrc}" alt="${escapeHtml(alb.title)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-like" data-album-like-key="${albumKey}" title="Curtir Álbum e Baixar Offline">
                    ${OUTLINE_HEART_SVG}
                </button>
                <button class="card-floating-play" title="Abrir Álbum ${escapeHtml(alb.title)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" title="${escapeHtml(alb.title)}">${escapeHtml(alb.title)}</div>
            <div class="card-desc" title="${escapeHtml(alb.artist)}">${escapeHtml(alb.artist)}</div>
        `;

        if (window.api && window.api.isAlbumLiked) {
            window.api.isAlbumLiked(alb.id || alb.title).then(liked => {
                if (liked) {
                    const likeBtn = card.querySelector('.card-floating-like');
                    if (likeBtn) {
                        likeBtn.classList.add('active');
                        likeBtn.innerHTML = FILLED_HEART_SVG;
                        likeBtn.title = 'Remover Álbum dos Favoritos';
                    }
                }
            }).catch(() => {});
        }

        const likeBtn = card.querySelector('.card-floating-like');
        if (likeBtn) {
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await toggleFavoriteAlbumHandler(alb);
            });
        }

        card.addEventListener('click', () => {
            openOnlineAlbumView(alb);
        });

        container.appendChild(card);
    });
}

function renderCardRow(tracks, containerId, fullQueue) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    tracks.slice(0, 8).forEach(t => {
        const card = document.createElement('div');
        card.className = 'spotify-card';
        card.dataset.trackId = t.id;
        const coverSrc = t.cover_path ? getMediaUrl(t.cover_path) : DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${coverSrc}" alt="${t.title}" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Tocar ${t.title}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title">${t.title}</div>
            <div class="card-desc clickable" title="Ver Artista">${t.artist || 'Artista Desconhecido'}</div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('card-desc')) {
                openArtistView(t.artist);
                return;
            }
            playTrack(t, fullQueue || tracks);
        });

        container.appendChild(card);
    });
}

// Render Top Artists on Home Page (Spotify Round Cards)
function renderHomeArtists(tracks) {
    const container = document.getElementById('home-artists-row');
    if (!container) return;
    container.innerHTML = '';

    const artistMap = {};
    (tracks || []).forEach(t => {
        const art = (t.artist || '').trim();
        if (!art || art === 'Desconhecido' || art === 'SpotCry') return;
        if (!artistMap[art]) artistMap[art] = [];
        artistMap[art].push(t);
    });

    const topArtists = Object.keys(artistMap)
        .sort((a, b) => artistMap[b].length - artistMap[a].length)
        .slice(0, 8);

    const wrap = document.getElementById('section-artists-home');
    if (topArtists.length === 0) {
        if (wrap) wrap.style.display = 'none';
        return;
    }
    if (wrap) wrap.style.display = 'block';

    topArtists.forEach(artName => {
        const aTracks = artistMap[artName];
        const card = document.createElement('div');
        card.className = 'spotify-card artist-card';
        const firstCover = aTracks.find(t => t.cover_path)?.cover_path;
        const fallbackCover = firstCover ? getMediaUrl(firstCover) : DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${fallbackCover}" alt="${artName}" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Tocar ${artName}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title">${artName}</div>
            <div class="card-desc">Artista</div>
        `;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-floating-play')) {
                if (aTracks.length > 0) playTrack(aTracks[0], aTracks);
            } else {
                openArtistView(artName);
            }
        });

        container.appendChild(card);

        // Asynchronously upgrade with official Deezer artist photo
        getArtistInfoUnified(artName).then(info => {
            if (info && (info.picture_big || info.picture_medium)) {
                const img = card.querySelector('img');
                if (img) img.src = info.picture_big || info.picture_medium;
            }
        }).catch(() => {});
    });
}

// Sidebar Dynamic List (Playlists, Artistas, Álbuns)
async function renderSidebarList(filter) {
    const list = document.getElementById('sidebar-dynamic-list');
    if (!list) return;
    list.innerHTML = '';

    if (filter === 'artists') {
        const onlineArtistsMap = new Map();
        try {
            const favs = (await window.api.getFavorites()) || [];
            favs.forEach(f => {
                if (f.artist && !onlineArtistsMap.has(f.artist)) {
                    onlineArtistsMap.set(f.artist, { name: f.artist, picture: getTrackCover(f) });
                }
            });
        } catch(e) {}

        if (homeChartsCache && homeChartsCache.artists) {
            homeChartsCache.artists.forEach(a => {
                if (!onlineArtistsMap.has(a.name)) {
                    onlineArtistsMap.set(a.name, { name: a.name, picture: a.picture || a.picture_medium || DEFAULT_COVER_SVG });
                }
            });
        }

        onlineArtistsMap.forEach(art => {
            const item = document.createElement('div');
            item.className = 'lib-item';
            item.innerHTML = `
                <div class="lib-item-thumb" style="border-radius: 50%; overflow: hidden;">
                    <img src="${art.picture}" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'" style="border-radius: 50%; width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div class="lib-item-meta">
                    <span class="lib-item-name">${escapeHtml(art.name)}</span>
                    <span class="lib-item-sub">Artista</span>
                </div>
            `;
            item.addEventListener('click', () => {
                openArtistView(art.name);
            });
            list.appendChild(item);
        });
    } else if (filter === 'playlists') {
        const playlists = (await window.api.getPlaylists()) || [];
        playlists.forEach(pl => {
            const item = document.createElement('div');
            item.className = 'lib-item';
            const grad = GRADIENT_MAP[pl.gradient] || GRADIENT_MAP.emerald;
            item.innerHTML = `
                <div class="lib-item-thumb" style="background: ${grad.thumb}; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="rgba(255,255,255,0.85)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
                <div class="lib-item-meta">
                    <span class="lib-item-name">${pl.name}</span>
                    <span class="lib-item-sub">Playlist • ${pl.tracks ? pl.tracks.length : 0} músicas</span>
                </div>
            `;
            item.addEventListener('click', () => {
                openPlaylistById(pl.id);
            });

            // Drag and Drop support
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                item.classList.remove('drag-over');
                try {
                    const rawData = e.dataTransfer.getData('text/plain');
                    if (rawData) {
                        const data = JSON.parse(rawData);
                        if (data && data.trackId) {
                            const trackObj = findTrack(data.trackId) || data.trackId;
                            const added = await window.api.addToPlaylist(pl.id, trackObj);
                            if (added) {
                                showToast(`"${data.title || 'Música'}" adicionada à playlist "${pl.name}"!`);
                                renderSidebarList('playlists');
                                if (currentOpenPlaylistId === pl.id) {
                                    openPlaylistById(pl.id);
                                }
                            } else {
                                showToast(`"${data.title || 'Música'}" já está nesta playlist.`);
                            }
                        }
                    }
                } catch (err) {
                    console.error('Drop error:', err);
                }
            });

            list.appendChild(item);
        });
    } else if (filter === 'genres') {
        SPOTIFY_CATEGORIES.forEach(cat => {
            const item = document.createElement('div');
            item.className = 'lib-item';
            item.innerHTML = `
                <div class="lib-item-thumb" style="background: ${cat.color}; display: flex; align-items: center; justify-content: center; font-size: 20px;">
                    🎵
                </div>
                <div class="lib-item-meta">
                    <span class="lib-item-name">${escapeHtml(cat.title)}</span>
                    <span class="lib-item-sub">Estilo Musical</span>
                </div>
            `;
            item.addEventListener('click', () => {
                openOnlineSearchView(cat.query);
            });
            list.appendChild(item);
        });
    } else {
        // Online Trending Albums
        const onlineAlbumsMap = new Map();
        if (homeChartsCache && homeChartsCache.albums) {
            homeChartsCache.albums.forEach(alb => {
                if (!onlineAlbumsMap.has(alb.title)) {
                    onlineAlbumsMap.set(alb.title, alb);
                }
            });
        }

        onlineAlbumsMap.forEach(alb => {
            const item = document.createElement('div');
            item.className = 'lib-item';
            const coverSrc = alb.cover || alb.coverUrl || alb.cover_xl || alb.cover_big || DEFAULT_COVER_SVG;

            item.innerHTML = `
                <div class="lib-item-thumb">
                    <img src="${coverSrc}" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                </div>
                <div class="lib-item-meta">
                    <span class="lib-item-name">${escapeHtml(alb.title)}</span>
                    <span class="lib-item-sub">Álbum • ${escapeHtml(alb.artist)}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                openOnlineAlbumView(alb);
            });
            list.appendChild(item);
        });
    }
}

function renderHomeGenres() {
    const container = document.getElementById('home-genres-row');
    const section = document.getElementById('section-genres-home');
    if (!container || !section) return;
    container.innerHTML = '';
    section.style.display = 'block';

    SPOTIFY_CATEGORIES.slice(0, 8).forEach(cat => {
        const card = document.createElement('div');
        card.className = 'genre-card';
        card.style.background = `linear-gradient(135deg, ${cat.color}, #181818)`;
        card.innerHTML = `
            <div class="genre-card-title">${escapeHtml(cat.title)}</div>
            <div class="genre-card-meta">Explorar estilo</div>
            <img class="genre-card-cover-img" src="${cat.img}" alt="${escapeHtml(cat.title)}" loading="lazy">
            <button class="genre-floating-play" title="Abrir ${escapeHtml(cat.title)}">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
            </button>
        `;
        card.addEventListener('click', () => {
            openOnlineSearchView(cat.query);
        });
        container.appendChild(card);
    });
}

// Show all genres link
const linkShowAllGenres = document.getElementById('link-show-all-genres');
if (linkShowAllGenres) {
    linkShowAllGenres.addEventListener('click', () => {
        document.querySelectorAll('.main-pill-btn').forEach(b => b.classList.remove('active'));
        const genBtn = document.querySelector('.main-pill-btn[data-main-filter="genres"]');
        if (genBtn) genBtn.classList.add('active');
        openAllGenresView();
    });
}

async function openAllGenresView() {
    showView('view-genres-grid');
    const container = document.getElementById('all-genres-grid-container');
    const countEl = document.getElementById('genres-grid-count');
    if (!container) return;
    container.innerHTML = '';

    if (countEl) {
        countEl.innerText = `${SPOTIFY_CATEGORIES.length} estilos e gêneros musicais disponíveis`;
    }

    SPOTIFY_CATEGORIES.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'genre-card';
        card.style.background = `linear-gradient(135deg, ${cat.color}, #181818)`;
        card.innerHTML = `
            <div class="genre-card-title">${escapeHtml(cat.title)}</div>
            <div class="genre-card-meta">Explorar músicas</div>
            <img class="genre-card-cover-img" src="${cat.img}" alt="${escapeHtml(cat.title)}" loading="lazy">
            <button class="genre-floating-play" title="Abrir ${escapeHtml(cat.title)}">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
            </button>
        `;
        card.addEventListener('click', () => {
            openOnlineSearchView(cat.query);
        });
        container.appendChild(card);
    });
}

async function openAllAlbumsView() {
    showView('view-albums-grid');
    const container = document.getElementById('all-albums-grid-container');
    const countEl = document.getElementById('albums-grid-count');
    if (!container) return;
    container.innerHTML = '';

    let albums = (homeChartsCache && homeChartsCache.albums) ? homeChartsCache.albums : [];
    if (!albums || albums.length === 0) {
        const charts = (await window.api.getOnlineCharts()) || { albums: [] };
        albums = charts.albums || [];
    }

    if (countEl) countEl.innerText = `${albums.length} álbuns em destaque mundial`;

    albums.forEach(alb => {
        const card = document.createElement('div');
        card.className = 'spotify-card';
        const coverSrc = alb.cover || alb.coverUrl || alb.cover_xl || alb.cover_big || DEFAULT_COVER_SVG;

        const albumKey = alb.id ? String(alb.id) : (alb.title ? alb.title.toLowerCase() : '');
        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${coverSrc}" alt="${escapeHtml(alb.title)}" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-like" data-album-like-key="${albumKey}" title="Curtir Álbum e Baixar Offline">
                    ${OUTLINE_HEART_SVG}
                </button>
                <button class="card-floating-play" title="Abrir Álbum ${escapeHtml(alb.title)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" title="${escapeHtml(alb.title)}">${escapeHtml(alb.title)}</div>
            <div class="card-desc clickable" title="Ver Artista">${escapeHtml(alb.artist)}</div>
        `;

        if (window.api && window.api.isAlbumLiked) {
            window.api.isAlbumLiked(alb.id || alb.title).then(liked => {
                if (liked) {
                    const likeBtn = card.querySelector('.card-floating-like');
                    if (likeBtn) {
                        likeBtn.classList.add('active');
                        likeBtn.innerHTML = FILLED_HEART_SVG;
                        likeBtn.title = 'Remover Álbum dos Favoritos';
                    }
                }
            }).catch(() => {});
        }

        const likeBtn = card.querySelector('.card-floating-like');
        if (likeBtn) {
            likeBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await toggleFavoriteAlbumHandler(alb);
            });
        }

        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-floating-like')) return;
            if (e.target.classList.contains('card-desc')) {
                openArtistView(alb.artist);
                return;
            }
            openOnlineAlbumView(alb);
        });

        container.appendChild(card);
    });
}

async function openAllArtistsView() {
    showView('view-artists-grid');
    const container = document.getElementById('all-artists-grid-container');
    const countEl = document.getElementById('artists-grid-count');
    if (!container) return;
    container.innerHTML = '';

    let artists = (homeChartsCache && homeChartsCache.artists) ? homeChartsCache.artists : [];
    if (!artists || artists.length === 0) {
        const charts = (await window.api.getOnlineCharts()) || { artists: [] };
        artists = charts.artists || [];
    }

    if (countEl) countEl.innerText = `${artists.length} artistas mais ouvidos no momento`;

    artists.forEach(art => {
        const card = document.createElement('div');
        card.className = 'spotify-card';
        const pic = art.picture || art.picture_big || art.picture_medium || art.picture_xl || DEFAULT_COVER_SVG;

        card.innerHTML = `
            <div class="card-img-wrap" style="border-radius: 50%;">
                <img src="${pic}" alt="${escapeHtml(art.name)}" loading="lazy" style="border-radius: 50%;" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <button class="card-floating-play" title="Ver perfil de ${escapeHtml(art.name)}">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M8 5v14l11-7z" fill="#000"/></svg>
                </button>
            </div>
            <div class="card-title" style="text-align: center;" title="${escapeHtml(art.name)}">${escapeHtml(art.name)}</div>
            <div class="card-desc" style="text-align: center;">Artista</div>
        `;
        card.addEventListener('click', () => {
            openArtistView(art.name);
        });
        container.appendChild(card);
    });
}

// Helper: Unified artist info fetcher with dual IPC & direct browser fallback
async function getArtistInfoUnified(artistName) {
    if (!artistName || artistName === 'Desconhecido' || artistName === 'SpotCry') return null;
    const cacheKey = 'spotcry_art_' + artistName.trim().toLowerCase();
    try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
    } catch(e) {}

    // 1. Try Electron IPC
    if (window.api && typeof window.api.getArtistInfo === 'function') {
        try {
            const res = await window.api.getArtistInfo(artistName);
            if (res && (res.picture_xl || res.picture_big)) {
                try { sessionStorage.setItem(cacheKey, JSON.stringify(res)); } catch(e) {}
                return res;
            }
        } catch(e) {}
    }

    // 2. Direct browser fetch fallback
    try {
        const clean = artistName.replace(/\s*[\(\[](feat\.|ft\.|ao vivo|live|remaster).*?[\)\]]/gi, '').trim();
        const resp = await fetch('https://api.deezer.com/search/artist?q=' + encodeURIComponent(clean || artistName));
        if (resp.ok) {
            const j = await resp.json();
            if (j.data && j.data.length > 0) {
                const target = (clean || artistName).toLowerCase();
                const valid = j.data.filter(x => x.picture_big && !x.picture_big.includes('//500x500'));
                const candidates = valid.length > 0 ? valid : j.data;
                const exacts = candidates.filter(x => x.name && x.name.trim().toLowerCase() === target);
                exacts.sort((a,b) => (b.nb_fan||0) - (a.nb_fan||0));
                const best = exacts[0] || [...candidates].sort((a,b) => (b.nb_fan||0) - (a.nb_fan||0))[0];
                if (best) {
                    const res = {
                        id: best.id,
                        name: best.name,
                        picture_xl: best.picture_xl || best.picture_big,
                        picture_big: best.picture_big,
                        picture_medium: best.picture_medium,
                        picture_small: best.picture_small,
                        nb_fan: best.nb_fan || 0,
                        nb_album: best.nb_album || 0
                    };
                    try { sessionStorage.setItem(cacheKey, JSON.stringify(res)); } catch(e) {}
                    return res;
                }
            }
        }
    } catch(e) {}
    return null;
}

// ==========================================================================
// ARTIST PROFILE VIEW
// ==========================================================================

async function openArtistView(artistName) {
    if (!artistName || artistName === 'Desconhecido' || artistName === 'SpotCry') return;
    if (!allTracksCache || allTracksCache.length === 0) {
        allTracksCache = (await window.api.getTracks()) || [];
    }

    const artistTracks = allTracksCache.filter(t => (t.artist || '').trim().toLowerCase() === artistName.trim().toLowerCase());

    showView('view-artist');

    document.getElementById('artist-page-name').innerText = artistName;
    const albumCount = new Set(artistTracks.map(t => t.album)).size;
    const statsEl = document.getElementById('artist-page-stats');
    if (artistTracks.length > 0) {
        statsEl.innerText = `${artistTracks.length} músicas na sua biblioteca`;
    } else {
        statsEl.innerHTML = `<span>Perfil Oficial</span> • <span style="color: #1ed760; font-weight: 700;">SpotCry Online ✨</span>`;
    }

    // Dynamic Spotify-style artist banner with fallback
    const banner = document.getElementById('artist-banner');
    const firstCover = artistTracks.find(t => t.cover_path)?.cover_path;
    const fallbackCoverUrl = firstCover ? getMediaUrl(firstCover) : null;

    if (fallbackCoverUrl) {
        banner.style.backgroundImage = `url("${fallbackCoverUrl}")`;
    } else {
        banner.style.backgroundImage = 'none';
    }
    banner.style.backgroundSize = 'cover';
    banner.style.backgroundPosition = 'center 25%';

    const followBtn = document.getElementById('btn-artist-follow');
    if (followBtn) {
        followBtn.onclick = () => {
            const isFollowing = followBtn.classList.toggle('following');
            followBtn.innerText = isFollowing ? 'Seguir' : 'Seguindo';
            showToast(isFollowing ? `Deixou de seguir ${artistName}` : `Seguindo ${artistName}`);
        };
    }

    const shuffleBtn = document.getElementById('btn-artist-shuffle');
    if (shuffleBtn) {
        shuffleBtn.onclick = () => {
            if (artistTracks.length > 0) {
                const shuffled = [...artistTracks].sort(() => Math.random() - 0.5);
                playTrack(shuffled[0], shuffled);
            }
        };
    }

    // Default Play All button
    document.getElementById('btn-artist-play-all').onclick = () => {
        if (artistTracks.length > 0) playTrack(artistTracks[0], artistTracks);
    };

    // Render local tracks immediately if available
    if (artistTracks.length > 0) {
        const sortedByPlays = [...artistTracks].sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
        renderArtistTable(sortedByPlays.slice(0, 5), 'artist-top-tbody', artistTracks);
        renderArtistTable(artistTracks, 'artist-all-tbody', artistTracks);
    } else {
        const topTb = document.getElementById('artist-top-tbody');
        if (topTb) topTb.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 28px; color: var(--text-subdued);">Carregando faixas populares de ${escapeHtml(artistName)}...</td></tr>`;
        const allTb = document.getElementById('artist-all-tbody');
        if (allTb) allTb.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 28px; color: var(--text-subdued);">Carregando faixas e discografia de ${escapeHtml(artistName)}...</td></tr>`;
    }

    // Local albums map
    const localAlbumMap = {};
    artistTracks.forEach(t => {
        const k = t.album || 'Álbum Desconhecido';
        if (!localAlbumMap[k]) localAlbumMap[k] = { title: k, artist: t.artist, cover: t.cover_path, tracks: [] };
        localAlbumMap[k].tracks.push(t);
    });

    const albumsRow = document.getElementById('artist-albums-row');
    if (albumsRow) albumsRow.innerHTML = '<div style="color: var(--text-subdued); padding: 16px;">Carregando discografia oficial...</div>';

    // Fetch official Spotify-grade artist photo, metrics and online discography
    (async () => {
        try {
            const info = await getArtistInfoUnified(artistName);
            if (info) {
                if (info.picture_xl || info.picture_big) {
                    const picUrl = info.picture_xl || info.picture_big;
                    banner.style.backgroundImage = `url("${picUrl}")`;
                    banner.style.backgroundSize = 'cover';
                    banner.style.backgroundPosition = 'center 25%';
                }

                if (info.nb_fan > 0) {
                    const fanFormatted = Number(info.nb_fan).toLocaleString('pt-BR');
                    const libPart = artistTracks.length > 0 ? ` • <span>${artistTracks.length} músicas na biblioteca</span>` : ' • <span>Artista Verificado ✨</span>';
                    statsEl.innerHTML = `<span style="font-weight: 700; color: #fff;">${fanFormatted} ouvintes mensais</span>${libPart}`;
                } else {
                    statsEl.innerHTML = `<span>Perfil Oficial</span> • <span>SpotCry Online ✨</span>`;
                }

                // If artist ID found, load official Deezer albums and top tracks
                let onlineAlbums = [];
                let onlineTopTracks = [];
                if (info.id) {
                    [onlineAlbums, onlineTopTracks] = await Promise.all([
                        window.api.getArtistAlbums(info.id).catch(() => []),
                        window.api.getArtistTopTracks(info.id).catch(() => [])
                    ]);
                }

                // Update Play All & Shuffle button if no local tracks
                if (artistTracks.length === 0 && onlineTopTracks.length > 0) {
                    document.getElementById('btn-artist-play-all').onclick = () => {
                        playOnlineFullTrack(onlineTopTracks[0], onlineTopTracks);
                    };
                    if (shuffleBtn) {
                        shuffleBtn.onclick = () => {
                            const shuffled = [...onlineTopTracks].sort(() => Math.random() - 0.5);
                            playOnlineFullTrack(shuffled[0], shuffled);
                        };
                    }
                }

                // 1. Discografia & Álbuns Row
                if (albumsRow) {
                    albumsRow.innerHTML = '';
                    const combinedAlbums = [];
                    const seenAlbumTitles = new Set();

                    // Add local albums first
                    Object.values(localAlbumMap).forEach(alb => {
                        seenAlbumTitles.add(alb.title.toLowerCase().trim());
                        combinedAlbums.push(alb);
                    });

                    // Add official online albums
                    (onlineAlbums || []).forEach(oAlb => {
                        const k = (oAlb.title || '').toLowerCase().trim();
                        if (!seenAlbumTitles.has(k)) {
                            seenAlbumTitles.add(k);
                            combinedAlbums.push({
                                id: oAlb.id,
                                title: oAlb.title,
                                artist: artistName,
                                coverUrl: oAlb.cover_big || oAlb.cover_medium,
                                year: oAlb.year || '',
                                record_type: oAlb.record_type,
                                isOnline: true
                            });
                        }
                    });

                    if (combinedAlbums.length === 0) {
                        albumsRow.innerHTML = '<div style="color: var(--text-subdued); padding: 12px;">Nenhum álbum encontrado.</div>';
                    }

                    combinedAlbums.forEach(alb => {
                        const card = document.createElement('div');
                        card.className = 'spotify-card';
                        const coverSrc = alb.coverUrl || (alb.cover ? getMediaUrl(alb.cover) : DEFAULT_COVER_SVG);
                        const desc = alb.tracks ? `${alb.tracks.length} músicas na biblioteca` : (alb.year ? `${alb.year} • Álbum` : 'Álbum');

                        card.innerHTML = `
                            <div class="card-img-wrap">
                                <img src="${coverSrc}" alt="${escapeHtml(alb.title)}" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                                <button class="card-floating-play" title="Tocar ${escapeHtml(alb.title)}">
                                    <svg viewBox="0 0 24 24" width="24" height="24"><path d="M7.05 3.606l13.49 7.788a.7.7 0 010 1.212L7.05 20.394A.7.7 0 016 19.788V4.212a.7.7 0 011.05-.606z" fill="#000"/></svg>
                                </button>
                            </div>
                            <div class="card-title">${escapeHtml(alb.title)}</div>
                            <div class="card-desc">${escapeHtml(desc)}</div>
                        `;

                        card.addEventListener('click', (e) => {
                            if (e.target.closest('.card-floating-play')) {
                                if (alb.tracks && alb.tracks.length > 0) {
                                    playTrack(alb.tracks[0], alb.tracks);
                                } else {
                                    openOnlineAlbumView(alb, true);
                                }
                            } else {
                                if (alb.tracks && alb.tracks.length > 0) {
                                    openPlaylistDetailView({
                                        title: alb.title,
                                        type: 'Álbum',
                                        desc: `${alb.artist} • ${alb.tracks.length} músicas`,
                                        cover: alb.cover,
                                        tracks: alb.tracks
                                    });
                                } else {
                                    openOnlineAlbumView(alb);
                                }
                            }
                        });
                        albumsRow.appendChild(card);
                    });
                }

                // 2. Populares (Top 5 tracks)
                if (onlineTopTracks.length > 0) {
                    const top5 = onlineTopTracks.slice(0, 5);
                    const mappedTop5 = top5.map(t => {
                        const local = artistTracks.find(lt => lt.title && lt.title.toLowerCase().trim() === t.title.toLowerCase().trim());
                        return local || t;
                    });
                    renderArtistTable(mappedTop5, 'artist-top-tbody', mappedTop5);

                    if (artistTracks.length === 0) {
                        const rest = onlineTopTracks.slice(5);
                        renderArtistTable(rest, 'artist-all-tbody', onlineTopTracks);
                    }
                }
            }
        } catch(e) {
            console.warn('Could not complete artist view loading:', e);
        }
    })();
}

function renderArtistTable(tracks, tbodyId, fullArtistQueue) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!tracks || tracks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--text-subdued);">Nenhuma música disponível.</td></tr>`;
        return;
    }

    tracks.forEach((track, index) => {
        const tr = document.createElement('tr');
        tr.className = 'track-row';
        tr.dataset.trackId = track.id;

        const isLocal = !!track.file_path;
        const isCurrentPlaying = (isLocal && currentQueue[currentIndex] && currentQueue[currentIndex].id == track.id) ||
            (!isLocal && currentOnlinePlayingId === track.id && !audio.paused);

        if (isCurrentPlaying) tr.classList.add('playing');

        registerTrack(track);
        const coverSrc = getTrackCover(track);
        const durationText = track.durationFormatted || (typeof track.duration === 'number' ? formatTime(track.duration) : (track.duration || '3:30'));

        const heartSvg = track.is_favorite 
            ? `<svg role="img" height="16" width="16" viewBox="0 0 16 16"><path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z" fill="#1ED760"></path></svg>`
            : `<svg role="img" height="16" width="16" viewBox="0 0 16 16"><path d="M1.626 3.161a2.766 2.766 0 0 1 3.91 0l.464.465.465-.465a2.766 2.766 0 0 1 3.91 3.91l-4.375 4.375-4.374-4.375a2.766 2.766 0 0 1 0-3.91zM2.686 4.22a1.266 1.266 0 0 0 0 1.79l3.315 3.314 3.314-3.314a1.266 1.266 0 0 0-1.79-1.79l-1.524 1.524-1.524-1.524a1.266 1.266 0 0 0-1.791 0z" fill="currentColor"></path></svg>`;

        const isOffline = track.isOfflineAvailable || track.download_status === 'downloaded' || (track.file_path && !track.isOnline && !String(track.id).startsWith('dz_'));
        const dlTitle = isOffline ? 'Disponível offline (arquivo salvo no computador). Clique para gerenciar...' : (track.download_status === 'downloading' ? 'Baixando... (Clique para cancelar)' : 'Baixar Música para ouvir offline');
        const dlClass = isOffline ? 'sp-btn-download-icon completed offline-row-badge downloaded' : (track.download_status === 'downloading' ? 'sp-btn-download-icon downloading offline-row-badge' : 'sp-btn-download-icon offline-row-badge not-downloaded');
        const dlSvg = isOffline
            ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="#1ed760"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm-1.5 14.5L5.75 11.75l1.41-1.41L10.5 13.67l6.34-6.34 1.41 1.41z"/></svg>`
            : (track.download_status === 'downloading'
                ? `<svg class="spin-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`
                : `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`
            );

        tr.innerHTML = `
            <td style="text-align: center; width: 40px;">
                <span class="track-num">${index + 1}</span>
            </td>
            <td>
                <div class="tr-title-cell">
                    <img src="${coverSrc}" alt="Capa" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                    <div class="tr-info">
                        <span class="tr-title">${escapeHtml(track.title)}</span>
                        <span class="tr-artist clickable" title="Ver Artista">${escapeHtml(track.artist || '')}</span>
                    </div>
                </div>
            </td>
            <td><span class="tr-album-name clickable" title="Ver Álbum">${escapeHtml(track.album || '—')}</span></td>
            <td>${isLocal ? formatDate(track.date_added) : '<span style="color: #1ed760; font-size: 11px; font-weight: 700;">SpotCry Web 🌐</span>'}</td>
            <td style="text-align: right; padding-right: 16px;">
                <button class="add-to-pl-btn" title="Adicionar à Playlist">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/></svg>
                </button>
                <button class="heart-btn ${track.is_favorite ? 'active' : ''}" style="margin-right: 12px;" title="${track.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}">${heartSvg}</button>
                <button class="${dlClass}" id="art-dl-${track.id}" data-offline-track-id="${track.id}" title="${dlTitle}" style="display: inline-flex; margin-right: 14px;">
                    ${dlSvg}
                </button>
                <span style="font-variant-numeric: tabular-nums;">${durationText}</span>
            </td>
        `;

        tr.addEventListener('dblclick', () => {
            if (isLocal) {
                playTrack(track, fullArtistQueue);
            } else {
                playOnlineFullTrack(track, fullArtistQueue);
            }
        });

        tr.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-pl-btn') || e.target.closest('.heart-btn') || e.target.closest('.sp-btn-download-icon') || e.target.closest('.offline-row-badge')) return;
            if (isLocal) {
                playTrack(track, fullArtistQueue);
            } else {
                playOnlineFullTrack(track, fullArtistQueue);
            }
        });

        tr.querySelector('.add-to-pl-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openAddToPlaylistPicker(track);
        });

        tr.querySelector('.heart-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleFavoriteTrack(track);
            renderArtistTable(tracks, tbodyId, fullArtistQueue);
        });

        const dlBtn = tr.querySelector(`#art-dl-${track.id}`);
        if (dlBtn) {
            dlBtn.onclick = async (e) => {
                e.stopPropagation();
                if (dlBtn.classList.contains('downloaded') || dlBtn.classList.contains('completed')) {
                    const confirmDel = confirm(`Música: "${track.title}"\nStatus: Baixada offline.\n\nDeseja excluir o arquivo baixado do computador?\n(A música permanecerá nos seus favoritos).`);
                    if (confirmDel) {
                        const res = await window.api.deleteOfflineTrack(track.id);
                        if (res && res.success) {
                            track.isOfflineAvailable = false;
                            track.download_status = 'none';
                            track.offline_path = '';
                            updateTrackOfflineBadges(track.id, 'none');
                            showToast(`Arquivo offline de "${track.title}" removido.`);
                            updateAlbumOfflineCount();
                        }
                    }
                } else if (dlBtn.classList.contains('downloading')) {
                    const res = await window.api.cancelDownload(track.id);
                    if (res && res.success) {
                        track.download_status = 'none';
                        updateTrackOfflineBadges(track.id, 'none');
                        showToast(`Download de "${track.title}" cancelado.`);
                    }
                } else {
                    queueTrackForDownload(track, dlBtn);
                }
            };
        }

        tr.querySelector('.tr-artist')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (track.artist) openArtistView(track.artist);
        });

        tr.querySelector('.tr-album-name')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (track.album) {
                if (track.albumId) {
                    openOnlineAlbumView({ id: track.albumId, title: track.album, artist: track.artist });
                } else {
                    const albQuery = `${track.artist || ''} ${track.album}`.trim();
                    const albs = await window.api.searchOnlineAlbums(albQuery).catch(() => []);
                    if (albs && albs.length > 0) openOnlineAlbumView(albs[0]);
                    else openOnlineSearchView(track.album);
                }
            }
        });

        tbody.appendChild(tr);
    });
}

// Open and browse an album online or local
async function openOnlineAlbumView(album, autoPlay = false) {
    if (!album) return;
    showView('view-playlist');
    currentOpenPlaylistId = null;

    const btnEdit = document.getElementById('btn-pl-edit');
    const btnDel = document.getElementById('btn-pl-delete');
    const addTracksSection = document.getElementById('pl-add-tracks-section');
    const periodPills = document.getElementById('period-pills-bar');
    if (btnEdit) btnEdit.style.display = 'none';
    if (btnDel) btnDel.style.display = 'none';
    if (addTracksSection) addTracksSection.style.display = 'none';
    if (periodPills) periodPills.style.display = 'none';

    const banner = document.getElementById('pl-banner');
    const coverImgEl = document.getElementById('pl-cover');
    const artistName = album.artist?.name || album.artist || 'Artista';

    document.getElementById('pl-title').innerText = album.title || 'Álbum';
    document.getElementById('pl-type').innerText = 'Álbum';
    document.getElementById('pl-desc').innerHTML = `<span class="clickable" onclick="openArtistView('${escapeHtml(artistName).replace(/'/g, "\\'")}')" style="font-weight: 700; color: #fff;">${escapeHtml(artistName)}</span> • ${album.year || 'Álbum Oficial'}`;

    const coverUrl = album.coverUrl || album.cover_xl || album.cover_big || album.cover_medium || (album.cover ? getMediaUrl(album.cover) : DEFAULT_COVER_SVG);
    coverImgEl.src = coverUrl;
    banner.style.background = 'linear-gradient(180deg, #2a2a2a 0%, rgba(18, 18, 18, 0.95) 100%)';

    const tbody = document.getElementById('pl-track-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-subdued);">Carregando faixas do álbum...</td></tr>`;
    }

    if (!allTracksCache || allTracksCache.length === 0) {
        allTracksCache = (await window.api.getTracks()) || [];
    }

    let tracks = [];
    if (album.tracks && album.tracks.length > 0) {
        tracks = album.tracks;
    } else if (album.id) {
        const rawTracks = await window.api.getAlbumTracks(album.id);
        tracks = (rawTracks || []).map((t, idx) => {
            const localMatch = allTracksCache.find(lt => 
                lt.title && lt.title.trim().toLowerCase() === t.title.trim().toLowerCase() &&
                lt.artist && lt.artist.trim().toLowerCase().includes(artistName.trim().toLowerCase())
            );
            if (localMatch) {
                return { ...localMatch, track_number: idx + 1, isLocal: true };
            }
            return {
                id: t.id || `dz_alb_${album.id}_${idx}`,
                deezerId: t.deezerId,
                track_number: idx + 1,
                title: t.title,
                artist: artistName,
                album: album.title,
                duration: t.durationSeconds || 0,
                durationFormatted: t.duration || '3:30',
                preview: t.preview,
                coverUrl: coverUrl,
                thumbnail: coverUrl,
                isOnline: true
            };
        });
    }

    // Check offline availability and favorite status for album tracks
    const favTracks = (await window.api.getFavorites().catch(() => [])) || [];
    const favMap = new Map();
    favTracks.forEach(f => favMap.set(String(f.id), f));

    tracks.forEach(t => {
        const strId = String(t.id);
        if (favMap.has(strId)) {
            const f = favMap.get(strId);
            t.is_favorite = true;
            if (f.isOfflineAvailable) {
                t.isOfflineAvailable = true;
                t.download_status = 'downloaded';
                t.file_path = f.file_path || f.offline_path;
                t.offline_path = f.offline_path || f.file_path;
            }
        }
        if (t.file_path && !t.isOnline && !strId.startsWith('dz_')) {
            t.isOfflineAvailable = true;
            t.download_status = 'downloaded';
        }
    });

    const offlineCount = tracks.filter(t => t.isOfflineAvailable || t.download_status === 'downloaded').length;
    document.getElementById('pl-count').innerText = `${tracks.length} músicas • ${offlineCount} disponíveis offline`;

    // Setup and wire #btn-pl-like for album
    const btnLike = document.getElementById('btn-pl-like');
    if (btnLike) {
        btnLike.style.display = 'inline-flex';
        let isAlbumLikedState = await window.api.isAlbumLiked(album.id || album.title).catch(() => false);
        if (!isAlbumLikedState && tracks.length > 0 && tracks.every(t => t.is_favorite)) {
            isAlbumLikedState = true;
        }
        btnLike.classList.toggle('active', !!isAlbumLikedState);
        btnLike.innerHTML = isAlbumLikedState ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
        btnLike.title = isAlbumLikedState ? 'Remover Álbum dos Favoritos' : 'Curtir Álbum e Baixar Offline';
        btnLike.onclick = async () => {
            await toggleFavoriteAlbumHandler(album, tracks);
        };
    }

    // Big play button
    document.getElementById('btn-pl-play-all').onclick = () => {
        if (tracks.length > 0) {
            const first = tracks[0];
            if (first.file_path) {
                playTrack(first, tracks);
            } else {
                playOnlineFullTrack(first, tracks);
            }
        }
    };

    if (autoPlay && tracks.length > 0) {
        const first = tracks[0];
        if (first.file_path) playTrack(first, tracks);
        else playOnlineFullTrack(first, tracks);
    }

    renderArtistTable(tracks, 'pl-track-tbody', tracks);
}

// ==========================================================================
// PLAYLIST / ALBUM / TABLE VIEW
// ==========================================================================

async function openMostPlayedView(period = 'all') {
    const periodPills = document.getElementById('period-pills-bar');
    if (periodPills) {
        periodPills.style.display = 'flex';
        periodPills.querySelectorAll('.pill-chip').forEach(chip => {
            chip.classList.toggle('active', chip.getAttribute('data-period') === period);
            chip.onclick = () => openMostPlayedView(chip.getAttribute('data-period'));
        });
    }

    let title = 'Mais Ouvidas 🔥';
    let desc = 'Músicas mais executadas em todos os tempos';
    if (period === 'day') {
        title = 'Mais Ouvidas Hoje 🔥';
        desc = 'Músicas que você mais escutou nas últimas 24 horas';
    } else if (period === 'week') {
        title = 'Mais Ouvidas da Semana 🔥';
        desc = 'Músicas que você mais escutou nos últimos 7 dias';
    } else if (period === 'month') {
        title = 'Mais Ouvidas do Mês 🔥';
        desc = 'Músicas que você mais escutou nos últimos 30 dias';
    }

    const tracks = (await window.api.getTopPlayedByPeriod(period, 50)) || [];

    openPlaylistDetailView({
        title,
        type: 'Ranking de Reproduções',
        desc,
        cover: null,
        tracks,
        isStatsMode: true,
        period
    });
}

async function openPlaylistById(playlistId) {
    if (!playlistId) return;
    const pl = await window.api.getPlaylistById(playlistId);
    if (!pl) return;
    const tracks = (await window.api.getPlaylistTracks(playlistId)) || [];
    openPlaylistDetailView({
        title: pl.name,
        type: 'Playlist',
        desc: pl.description || `Criada em ${formatDate(pl.date_created)}`,
        cover: null,
        gradient: pl.gradient || 'emerald',
        playlistId: pl.id,
        tracks
    });
}

function updatePlaylistOfflineCount() {
    if (!currentPlaylistMasterTracks) return;
    const offlineCount = currentPlaylistMasterTracks.filter(t => t.isOfflineAvailable || t.download_status === 'downloaded').length;
    const plCountEl = document.getElementById('pl-count');
    if (plCountEl && currentOpenPlaylistIsFavorites) {
        plCountEl.innerText = `${currentPlaylistMasterTracks.length} músicas • ${offlineCount} disponíveis offline`;
    }
}

function applyPlaylistFilteringAndSorting() {
    if (!currentPlaylistMasterTracks) return;
    const searchVal = document.getElementById('pl-table-filter-input')?.value?.toLowerCase().trim() || '';
    const sortVal = document.getElementById('pl-sort-select')?.value || 'default';
    const offlineOnly = document.getElementById('pl-filter-offline-btn')?.classList.contains('active');

    let result = [...currentPlaylistMasterTracks];

    // Filter by search query
    if (searchVal) {
        result = result.filter(t => 
            (t.title && t.title.toLowerCase().includes(searchVal)) ||
            (t.artist && t.artist.toLowerCase().includes(searchVal)) ||
            (t.album && t.album.toLowerCase().includes(searchVal))
        );
    }

    // Filter by offline only
    if (offlineOnly) {
        result = result.filter(t => t.isOfflineAvailable || t.download_status === 'downloaded');
    }

    // Sort
    if (sortVal === 'title') {
        result.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    } else if (sortVal === 'artist') {
        result.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', undefined, { sensitivity: 'base' }));
    } else if (sortVal === 'album') {
        result.sort((a, b) => (a.album || '').localeCompare(b.album || '', undefined, { sensitivity: 'base' }));
    } else if (sortVal === 'duration') {
        result.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else if (sortVal === 'date') {
        result.sort((a, b) => new Date(b.liked_at || b.date_added || 0) - new Date(a.liked_at || a.date_added || 0));
    } else {
        // default: if favorites, keep db's liked_at descending order; otherwise keep original
        if (currentOpenPlaylistIsFavorites) {
            result.sort((a, b) => new Date(b.liked_at || b.date_added || 0) - new Date(a.liked_at || a.date_added || 0));
        }
    }

    // Update count display
    const offlineCount = currentPlaylistMasterTracks.filter(t => t.isOfflineAvailable || t.download_status === 'downloaded').length;
    const plCountEl = document.getElementById('pl-count');
    if (plCountEl) {
        if (currentOpenPlaylistIsFavorites) {
            const filterLabel = (searchVal || offlineOnly) ? `${result.length} de ` : '';
            plCountEl.innerText = `${filterLabel}${currentPlaylistMasterTracks.length} músicas • ${offlineCount} disponíveis offline`;
        } else {
            plCountEl.innerText = `${result.length} músicas`;
        }
    }

    // Play All plays filtered list in sequence
    const btnPlayAll = document.getElementById('btn-pl-play-all');
    if (btnPlayAll) {
        btnPlayAll.onclick = () => {
            if (result.length > 0) playTrack(result[0], result);
            else showToast('Nenhuma música para reproduzir neste filtro.');
        };
    }

    renderTrackTable(result, false, 'all', true);
}

async function refreshFavoritesView() {
    if (!currentOpenPlaylistIsFavorites) return;
    const favs = (await window.api.getFavorites()) || [];
    currentPlaylistMasterTracks = favs;
    applyPlaylistFilteringAndSorting();
}

function openPlaylistDetailView(opts) {
    showView('view-playlist');
    currentOpenPlaylistId = opts.playlistId || null;
    currentOpenPlaylistIsFavorites = !!opts.isFavorites;

    const periodPills = document.getElementById('period-pills-bar');
    if (periodPills && !opts.isStatsMode) {
        periodPills.style.display = 'none';
    }

    let tracks = opts.tracks ? [...opts.tracks] : [];
    if (!opts.isFavorites && (opts.type === 'Álbum' || !opts.isStatsMode)) {
        tracks.sort((a, b) => {
            const noA = (a.track_number && a.track_number > 0) ? a.track_number : 999;
            const noB = (b.track_number && b.track_number > 0) ? b.track_number : 999;
            if (noA !== noB) return noA - noB;
            return (a.file_path || a.title || '').localeCompare(b.file_path || b.title || '', undefined, { numeric: true, sensitivity: 'base' });
        });
    }

    currentPlaylistMasterTracks = [...tracks];

    document.getElementById('pl-title').innerText = opts.title || '';
    document.getElementById('pl-type').innerText = opts.type || 'Playlist';
    document.getElementById('pl-desc').innerText = opts.desc || '';

    // Update Date column header
    const thDateCol = document.getElementById('th-date-col');
    if (thDateCol) {
        thDateCol.innerText = opts.isFavorites ? 'Curtida em' : 'Data adicionada';
    }

    const offlineCount = tracks.filter(t => t.isOfflineAvailable || t.download_status === 'downloaded').length;
    if (opts.isFavorites) {
        document.getElementById('pl-count').innerText = `${tracks.length} músicas • ${offlineCount} disponíveis offline`;
    } else {
        document.getElementById('pl-count').innerText = `${tracks.length} músicas`;
    }

    const banner = document.getElementById('pl-banner');
    const coverImgEl = document.getElementById('pl-cover');

    // Action buttons for custom user playlist (Edit & Delete)
    const btnEdit = document.getElementById('btn-pl-edit');
    const btnDel = document.getElementById('btn-pl-delete');
    const addTracksSection = document.getElementById('pl-add-tracks-section');

    if (currentOpenPlaylistId) {
        if (btnEdit) {
            btnEdit.style.display = 'inline-flex';
            btnEdit.onclick = () => openEditPlaylistModal(currentOpenPlaylistId);
        }
        if (btnDel) {
            btnDel.style.display = 'inline-flex';
            btnDel.onclick = () => openDeletePlaylistModal(currentOpenPlaylistId);
        }
        if (addTracksSection) {
            addTracksSection.style.display = 'block';
            const searchInput = document.getElementById('pl-search-tracks-input');
            if (searchInput) searchInput.value = '';
            renderInlineTrackFinder('', tracks);
        }
    } else {
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDel) btnDel.style.display = 'none';
        if (addTracksSection) addTracksSection.style.display = 'none';
    }

    if (opts.gradient && GRADIENT_MAP[opts.gradient]) {
        const grad = GRADIENT_MAP[opts.gradient];
        banner.style.background = grad.banner;
        coverImgEl.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'><rect width='24' height='24' fill='%23282828'/><path d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z' fill='%23ffffff'/></svg>`;
    } else if (opts.bannerGradient) {
        banner.style.background = opts.bannerGradient;
        coverImgEl.src = opts.customCoverSrc || (opts.cover ? getMediaUrl(opts.cover) : DEFAULT_COVER_SVG);
    } else if (opts.isFavorites) {
        banner.style.background = 'linear-gradient(180deg, #450af5 0%, rgba(18, 18, 18, 0.9) 100%)';
        coverImgEl.src = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'><rect width='24' height='24' fill='%23450af5'/><path d='M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z'/></svg>`;
    } else if (opts.cover) {
        banner.style.background = 'linear-gradient(180deg, #333333 0%, rgba(18, 18, 18, 0.9) 100%)';
        coverImgEl.src = getMediaUrl(opts.cover);
    } else {
        banner.style.background = 'linear-gradient(180deg, #1DB954 0%, rgba(18, 18, 18, 0.9) 100%)';
        coverImgEl.src = DEFAULT_COVER_SVG;
    }

    // Wire #btn-pl-like
    const btnLike = document.getElementById('btn-pl-like');
    if (btnLike) {
        if (opts.isFavorites) {
            btnLike.style.display = 'inline-flex';
            btnLike.classList.add('active');
            btnLike.innerHTML = FILLED_HEART_SVG;
            btnLike.title = 'Músicas Curtidas';
            btnLike.onclick = null;
        } else if (opts.type === 'Álbum') {
            btnLike.style.display = 'inline-flex';
            window.api.isAlbumLiked(opts.title).then(isLiked => {
                btnLike.classList.toggle('active', !!isLiked);
                btnLike.innerHTML = isLiked ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
                btnLike.title = isLiked ? 'Remover Álbum dos Favoritos' : 'Curtir Álbum e Baixar Offline';
            }).catch(() => {});
            btnLike.onclick = async () => {
                await toggleFavoriteAlbumHandler({ title: opts.title, coverUrl: opts.cover }, tracks);
            };
        } else if (opts.isStatsMode) {
            btnLike.style.display = 'none';
        } else {
            // User Playlist
            btnLike.style.display = 'inline-flex';
            btnLike.classList.remove('active');
            btnLike.innerHTML = OUTLINE_HEART_SVG;
            btnLike.title = 'Curtir todas as faixas e baixar offline';
            btnLike.onclick = async () => {
                await toggleFavoritePlaylistHandler(opts, tracks);
            };
        }
    }

    // Setup controls (Search, Sort, Offline filter)
    const filterInput = document.getElementById('pl-table-filter-input');
    const clearFilterBtn = document.getElementById('pl-table-filter-clear');
    const sortSelect = document.getElementById('pl-sort-select');
    const offlineFilterBtn = document.getElementById('pl-filter-offline-btn');

    if (filterInput) {
        filterInput.value = '';
        filterInput.oninput = () => {
            if (clearFilterBtn) clearFilterBtn.style.display = filterInput.value ? 'inline-flex' : 'none';
            applyPlaylistFilteringAndSorting();
        };
    }
    if (clearFilterBtn) {
        clearFilterBtn.style.display = 'none';
        clearFilterBtn.onclick = () => {
            if (filterInput) filterInput.value = '';
            clearFilterBtn.style.display = 'none';
            applyPlaylistFilteringAndSorting();
        };
    }
    if (sortSelect) {
        sortSelect.value = 'default';
        sortSelect.onchange = () => applyPlaylistFilteringAndSorting();
    }
    if (offlineFilterBtn) {
        offlineFilterBtn.classList.remove('active');
        offlineFilterBtn.onclick = () => {
            offlineFilterBtn.classList.toggle('active');
            applyPlaylistFilteringAndSorting();
        };
    }

    document.getElementById('btn-pl-play-all').onclick = () => {
        if (tracks.length > 0) playTrack(tracks[0], tracks);
        else showToast('Nenhuma música para reproduzir.');
    };

    renderTrackTable(tracks, opts.isStatsMode, opts.period);
}

// ==========================================================================
// PLAYLIST MODALS & INLINE TRACK FINDER
// ==========================================================================

function openCreatePlaylistModal(trackIdToAppend = null) {
    editingPlaylistId = null;
    pendingAddTrackId = trackIdToAppend;
    selectedModalGradient = 'emerald';

    document.getElementById('playlist-modal-title').innerText = 'Criar Playlist';
    document.getElementById('playlist-name-input').value = '';
    document.getElementById('playlist-desc-input').value = '';

    document.querySelectorAll('.pl-color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.gradient === 'emerald');
    });
    updateModalCoverPreview('emerald');

    document.getElementById('playlist-modal').classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('playlist-name-input');
        if (input) input.focus();
    }, 80);
}

async function openEditPlaylistModal(playlistId) {
    if (!playlistId) return;
    const pl = await window.api.getPlaylistById(playlistId);
    if (!pl) return;

    editingPlaylistId = playlistId;
    pendingAddTrackId = null;
    selectedModalGradient = pl.gradient || 'emerald';

    document.getElementById('playlist-modal-title').innerText = 'Editar Detalhes';
    document.getElementById('playlist-name-input').value = pl.name || '';
    document.getElementById('playlist-desc-input').value = pl.description || '';

    document.querySelectorAll('.pl-color-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.gradient === selectedModalGradient);
    });
    updateModalCoverPreview(selectedModalGradient);

    document.getElementById('playlist-modal').classList.add('open');
    setTimeout(() => {
        const input = document.getElementById('playlist-name-input');
        if (input) input.focus();
    }, 80);
}

function updateModalCoverPreview(gradientKey) {
    const grad = GRADIENT_MAP[gradientKey] || GRADIENT_MAP.emerald;
    const preview = document.getElementById('pl-modal-cover-preview');
    if (preview) preview.style.background = grad.thumb;
}

// Color theme selector clicks
document.querySelectorAll('.pl-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        document.querySelectorAll('.pl-color-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        selectedModalGradient = dot.dataset.gradient || 'emerald';
        updateModalCoverPreview(selectedModalGradient);
    });
});

// Modal close / cancel
document.getElementById('btn-close-playlist-modal').addEventListener('click', () => {
    document.getElementById('playlist-modal').classList.remove('open');
});
document.getElementById('btn-cancel-playlist-modal').addEventListener('click', () => {
    document.getElementById('playlist-modal').classList.remove('open');
});

// Modal save / create
document.getElementById('btn-save-playlist-modal').addEventListener('click', async () => {
    const nameInput = document.getElementById('playlist-name-input');
    const descInput = document.getElementById('playlist-desc-input');
    const name = nameInput.value.trim();
    const desc = descInput.value.trim();

    if (!name) {
        showToast("Digite um nome para a playlist.");
        nameInput.focus();
        return;
    }

    if (editingPlaylistId) {
        const ok = await window.api.updatePlaylist(editingPlaylistId, name, desc, selectedModalGradient);
        if (ok) {
            showToast(`Playlist atualizada!`);
            document.getElementById('playlist-modal').classList.remove('open');
            renderSidebarList('playlists');
            if (currentOpenPlaylistId === editingPlaylistId) {
                openPlaylistById(editingPlaylistId);
            }
        } else {
            showToast("Erro ao atualizar playlist.");
        }
    } else {
        const newId = await window.api.createPlaylist(name, desc, selectedModalGradient);
        if (newId) {
            if (pendingAddTrackId) {
                await window.api.addToPlaylist(newId, pendingAddTrackId);
            }
            showToast(`Playlist "${name}" criada!`);
            document.getElementById('playlist-modal').classList.remove('open');
            renderSidebarList('playlists');
            openPlaylistById(newId);
            pendingAddTrackId = null;
        } else {
            showToast("Já existe uma playlist com esse nome.");
        }
    }
});

// Delete confirmation modal
async function openDeletePlaylistModal(playlistId) {
    if (!playlistId) return;
    const pl = await window.api.getPlaylistById(playlistId);
    if (!pl) return;
    deletingPlaylistId = playlistId;
    document.getElementById('delete-pl-message').innerText = `Isso vai excluir permanentemente "${pl.name}" da Sua Biblioteca. As músicas continuarão salvas no seu computador.`;
    document.getElementById('delete-playlist-modal').classList.add('open');
}

document.getElementById('btn-close-delete-pl').addEventListener('click', () => {
    document.getElementById('delete-playlist-modal').classList.remove('open');
});
document.getElementById('btn-cancel-delete-pl').addEventListener('click', () => {
    document.getElementById('delete-playlist-modal').classList.remove('open');
});
document.getElementById('btn-confirm-delete-pl').addEventListener('click', async () => {
    if (deletingPlaylistId) {
        await window.api.deletePlaylist(deletingPlaylistId);
        showToast("Playlist excluída.");
        document.getElementById('delete-playlist-modal').classList.remove('open');
        renderSidebarList('playlists');
        if (currentOpenPlaylistId === deletingPlaylistId) {
            currentOpenPlaylistId = null;
            showView('view-home');
            loadHomeView();
        }
        deletingPlaylistId = null;
    }
});

// Inline Track Search & Category Filter in Playlist View
let inlineFinderTimer = null;
let activeFinderFilter = 'all';

const plSearchInput = document.getElementById('pl-search-tracks-input');
if (plSearchInput) {
    plSearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (inlineFinderTimer) clearTimeout(inlineFinderTimer);
        inlineFinderTimer = setTimeout(async () => {
            if (!currentOpenPlaylistId) return;
            const currentPlTracks = (await window.api.getPlaylistTracks(currentOpenPlaylistId)) || [];
            renderInlineTrackFinder(q, currentPlTracks);
        }, 150);
    });
}

document.querySelectorAll('#pl-finder-chips .pill-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
        document.querySelectorAll('#pl-finder-chips .pill-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        activeFinderFilter = chip.getAttribute('data-finder-filter') || 'all';
        if (currentOpenPlaylistId) {
            const currentPlTracks = (await window.api.getPlaylistTracks(currentOpenPlaylistId)) || [];
            const query = document.getElementById('pl-search-tracks-input')?.value || '';
            renderInlineTrackFinder(query, currentPlTracks);
        }
    });
});

async function renderInlineTrackFinder(query = '', currentPlTracks = []) {
    const list = document.getElementById('pl-search-results-list');
    if (!list) return;
    list.innerHTML = '';

    const currentTrackIds = new Set(currentPlTracks.map(t => String(t.id)));
    let candidates = [];

    if (activeFinderFilter === 'favs') {
        candidates = (await window.api.getFavorites()) || [];
    } else if (activeFinderFilter === 'top') {
        candidates = (await window.api.getTopPlayedByPeriod('all', 50)) || [];
    } else {
        candidates = (allTracksCache && allTracksCache.length > 0)
            ? allTracksCache
            : ((homeChartsCache && homeChartsCache.tracks) ? homeChartsCache.tracks : []);
    }
    if ((!candidates || candidates.length === 0) && homeChartsCache && homeChartsCache.tracks) {
        candidates = homeChartsCache.tracks;
    }

    if (query && query.trim()) {
        const qTrim = query.trim();
        const qLower = qTrim.toLowerCase();
        let localMatches = candidates.filter(t => 
            (t.title && t.title.toLowerCase().includes(qLower)) ||
            (t.artist && t.artist.toLowerCase().includes(qLower)) ||
            (t.album && t.album.toLowerCase().includes(qLower))
        );

        // Search online tracks for 100% online experience
        try {
            list.innerHTML = `<div style="padding: 12px; color: var(--text-subdued); font-size: 13px;">Buscando músicas online...</div>`;
            const onlineResults = (await window.api.searchOnlineMusic(qTrim)) || [];
            const seenIds = new Set(localMatches.map(t => String(t.id)));
            onlineResults.forEach(ot => {
                if (!seenIds.has(String(ot.id))) {
                    seenIds.add(String(ot.id));
                    localMatches.push(ot);
                }
            });
        } catch(e) {
            console.warn('Inline online search error:', e);
        }
        candidates = localMatches;
    }

    const displayList = candidates.slice(0, 25);
    list.innerHTML = '';

    if (displayList.length === 0) {
        list.innerHTML = `<div style="padding: 16px; color: var(--text-subdued); font-size: 13px;">Nenhuma música encontrada para adicionar. Digite o nome de uma música ou artista.</div>`;
        return;
    }

    displayList.forEach(track => {
        registerTrack(track);
        const item = document.createElement('div');
        item.className = 'pl-search-item';
        item.dataset.trackId = track.id;
        const isAdded = currentTrackIds.has(String(track.id));
        const coverSrc = getTrackCover(track);

        item.innerHTML = `
            <div class="pl-search-item-left">
                <img src="${coverSrc}" alt="Capa" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                <div class="pl-search-item-info">
                    <span class="pl-search-item-title">${escapeHtml(track.title)}</span>
                    <span class="pl-search-item-artist">${escapeHtml(track.artist)}</span>
                </div>
            </div>
            <button class="btn-pl-add-track ${isAdded ? 'added' : ''}" data-track-id="${track.id}">
                ${isAdded ? '✓ Adicionada' : '+ Adicionar'}
            </button>
        `;

        const addBtn = item.querySelector('.btn-pl-add-track');
        addBtn.addEventListener('click', async () => {
            if (!currentOpenPlaylistId) return;

            if (addBtn.classList.contains('added')) {
                await window.api.removeFromPlaylist(currentOpenPlaylistId, track.id);
                addBtn.classList.remove('added');
                addBtn.innerText = '+ Adicionar';
                showToast(`"${track.title}" removida da playlist`);
            } else {
                await window.api.addToPlaylist(currentOpenPlaylistId, track);
                addBtn.classList.add('added');
                addBtn.innerText = '✓ Adicionada';
                showToast(`"${track.title}" adicionada à playlist!`);
            }
            
            const updatedTracks = (await window.api.getPlaylistTracks(currentOpenPlaylistId)) || [];
            renderTrackTable(updatedTracks);
            document.getElementById('pl-count').innerText = `${updatedTracks.length} músicas`;
            renderSidebarList('playlists');
        });

        list.appendChild(item);
    });
}

// ==========================================================================
// QUICK ADD TO PLAYLIST PICKER MODAL
// ==========================================================================

let activePickerTrack = null;

async function openAddToPlaylistPicker(track) {
    if (!track) return;
    registerTrack(track);
    activePickerTrack = track;

    const coverSrc = getTrackCover(track);
    document.getElementById('pl-picker-track-cover').src = coverSrc;
    document.getElementById('pl-picker-track-title').innerText = track.title;
    document.getElementById('pl-picker-track-artist').innerText = track.artist;

    const searchInput = document.getElementById('pl-picker-search-input');
    if (searchInput) searchInput.value = '';

    await renderPlaylistPickerList('');
    document.getElementById('add-to-playlist-modal').classList.add('open');
}

async function renderPlaylistPickerList(query = '') {
    const list = document.getElementById('pl-picker-list');
    if (!list || !activePickerTrack) return;
    list.innerHTML = '';

    let playlists = (await window.api.getPlaylists()) || [];

    if (query) {
        const qLower = query.toLowerCase();
        playlists = playlists.filter(p => p.name.toLowerCase().includes(qLower));
    }

    if (playlists.length === 0) {
        list.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-subdued); font-size: 13px;">Nenhuma playlist encontrada.</div>`;
        return;
    }

    playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'pl-picker-item';
        const isAdded = pl.tracks && pl.tracks.some(tid => String(tid) === String(activePickerTrack.id));
        const grad = GRADIENT_MAP[pl.gradient] || GRADIENT_MAP.emerald;

        item.innerHTML = `
            <div class="pl-picker-item-left">
                <div class="pl-picker-item-thumb" style="background: ${grad.thumb};">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="rgba(255,255,255,0.85)"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                </div>
                <div class="pl-picker-item-meta">
                    <span class="pl-picker-item-title">${pl.name}</span>
                    <span class="pl-picker-item-sub">${pl.tracks ? pl.tracks.length : 0} músicas</span>
                </div>
            </div>
            <div class="pl-picker-checkbox ${isAdded ? 'checked' : ''}">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="#000"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
            </div>
        `;

        item.addEventListener('click', async () => {
            const checkbox = item.querySelector('.pl-picker-checkbox');
            const nowChecked = checkbox.classList.contains('checked');

            if (nowChecked) {
                await window.api.removeFromPlaylist(pl.id, activePickerTrack.id);
                checkbox.classList.remove('checked');
                showToast(`Removido de "${pl.name}"`);
            } else {
                await window.api.addToPlaylist(pl.id, activePickerTrack);
                checkbox.classList.add('checked');
                showToast(`Adicionado à playlist "${pl.name}"!`);
            }

            renderSidebarList('playlists');
            if (currentOpenPlaylistId === pl.id) {
                const updatedTracks = (await window.api.getPlaylistTracks(pl.id)) || [];
                renderTrackTable(updatedTracks);
                document.getElementById('pl-count').innerText = `${updatedTracks.length} músicas`;
            }
        });

        list.appendChild(item);
    });
}

// Picker event listeners
document.getElementById('btn-close-pl-picker')?.addEventListener('click', () => {
    document.getElementById('add-to-playlist-modal').classList.remove('open');
});
document.getElementById('btn-done-pl-picker')?.addEventListener('click', () => {
    document.getElementById('add-to-playlist-modal').classList.remove('open');
});
document.getElementById('btn-pl-picker-create-new')?.addEventListener('click', () => {
    document.getElementById('add-to-playlist-modal').classList.remove('open');
    openCreatePlaylistModal(activePickerTrack ? activePickerTrack.id : null);
});

const pickerSearchInput = document.getElementById('pl-picker-search-input');
if (pickerSearchInput) {
    pickerSearchInput.addEventListener('input', (e) => {
        renderPlaylistPickerList(e.target.value.trim());
    });
}

// Bottom Bar "+ Adicionar à Playlist" Button
const btnNowAddPl = document.getElementById('btn-now-add-pl');
if (btnNowAddPl) {
    btnNowAddPl.addEventListener('click', () => {
        const currentTrack = currentQueue[currentIndex];
        if (currentTrack) {
            openAddToPlaylistPicker(currentTrack);
        } else {
            showToast("Nenhuma música em reprodução no momento.");
        }
    });
}

let currentSortCol = null;
let currentSortAsc = true;

function setupTableSorting(originalTracks, isStatsMode, period) {
    const ths = document.querySelectorAll('.track-table thead th');
    ths.forEach((th, idx) => {
        th.classList.add('sortable-th');
        th.onclick = () => {
            if (currentSortCol === idx) {
                currentSortAsc = !currentSortAsc;
            } else {
                currentSortCol = idx;
                currentSortAsc = true;
            }
            ths.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
            th.classList.add(currentSortAsc ? 'sorted-asc' : 'sorted-desc');

            const sorted = [...originalTracks].sort((a, b) => {
                let cmp = 0;
                if (idx === 0) { // #
                    cmp = (a.track_number || 0) - (b.track_number || 0);
                } else if (idx === 1) { // Título
                    cmp = (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
                } else if (idx === 2) { // Álbum
                    cmp = (a.album || '').localeCompare(b.album || '', undefined, { sensitivity: 'base' });
                } else if (idx === 3) { // Data adicionada / Curtida em
                    cmp = new Date(a.liked_at || a.date_added || 0).getTime() - new Date(b.liked_at || b.date_added || 0).getTime();
                } else if (idx === 4) { // Duração
                    cmp = (a.duration || 0) - (b.duration || 0);
                }
                return currentSortAsc ? cmp : -cmp;
            });
            renderTrackTable(sorted, isStatsMode, period, true);
        };
    });
}

function renderTrackTable(tracks, isStatsMode = false, period = 'all', skipSortSetup = false) {
    const tbody = document.getElementById('pl-track-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!skipSortSetup && tracks && tracks.length > 0) {
        setupTableSorting(tracks, isStatsMode, period);
    }

    if (!tracks || tracks.length === 0) {
        const activeSearch = document.getElementById('global-search-input')?.value?.trim();
        if (activeSearch) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align:center; padding: 48px 16px;">
                        <p style="font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 6px;">Nenhuma música encontrada na biblioteca local para "${escapeHtml(activeSearch)}"</p>
                        <p style="font-size: 13px; color: var(--text-subdued); margin-bottom: 16px;">Você pode pesquisar e baixar essa música diretamente da internet.</p>
                        <button class="btn-spotify-primary" style="display: inline-flex; align-items: center; gap: 8px; margin: 0 auto; padding: 10px 22px; font-weight: 800;" onclick="openOnlineSearchView('${escapeHtml(activeSearch).replace(/'/g, "\\'")}')">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM17 13l-5 5-5-5h3V9h4v4h3z"/></svg>
                            <span>Pesquisar e Baixar da Internet 🌐</span>
                        </button>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 32px; color: var(--text-subdued);">Nenhuma música para exibir aqui.</td></tr>`;
        }
        return;
    }

    const fragment = document.createDocumentFragment();

    tracks.forEach((track, index) => {
        const tr = document.createElement('tr');
        tr.className = 'track-row';
        tr.dataset.trackId = track.id;
        tr.setAttribute('draggable', 'true');

        tr.addEventListener('dragstart', (e) => {
            tr.classList.add('dragging');
            e.dataTransfer.setData('text/plain', JSON.stringify({ trackId: track.id, title: track.title }));
            e.dataTransfer.effectAllowed = 'copy';
        });
        tr.addEventListener('dragend', () => {
            tr.classList.remove('dragging');
        });

        const trackNumDisplay = index + 1;
        tr.dataset.trackNum = trackNumDisplay;

        registerTrack(track);
        const isCurrentPlaying = currentQueue[currentIndex] && (currentQueue[currentIndex].id == track.id || String(currentQueue[currentIndex].id) === String(track.id));
        if (isCurrentPlaying) tr.classList.add('playing');

        const coverSrc = getTrackCover(track);
        const heartSvg = track.is_favorite ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;

        // Offline download indicator badge
        let downloadBadgeHtml = '';
        const isOffline = !!(track.isOfflineAvailable || track.download_status === 'downloaded');
        const isDownloading = track.download_status === 'downloading';

        if (isOffline) {
            downloadBadgeHtml = `
                <button class="offline-row-badge downloaded" id="row-dl-${track.id}" data-offline-track-id="${track.id}" title="Disponível offline (arquivo salvo no computador). Clique para gerenciar...">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#1ed760"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm-1.5 14.5L5.75 11.75l1.41-1.41L10.5 13.67l6.34-6.34 1.41 1.41z"/></svg>
                </button>
            `;
        } else if (isDownloading) {
            downloadBadgeHtml = `
                <button class="offline-row-badge downloading" id="row-dl-${track.id}" data-offline-track-id="${track.id}" title="Baixando... Clique para cancelar.">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="#1e90ff"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
                </button>
            `;
        } else {
            downloadBadgeHtml = `
                <button class="offline-row-badge not-downloaded" id="row-dl-${track.id}" data-offline-track-id="${track.id}" title="Baixar música para ouvir offline">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>
                </button>
            `;
        }

        let statBadgeHtml = '';
        if (track.stats) {
            let count = track.stats.total;
            let label = 'total';
            if (period === 'day') { count = track.stats.day; label = 'hoje'; }
            else if (period === 'week') { count = track.stats.week; label = 'esta semana'; }
            else if (period === 'month') { count = track.stats.month; label = 'este mês'; }

            if (count > 0 || isStatsMode) {
                statBadgeHtml = `<span class="play-stat-badge" title="${track.stats.day}x hoje • ${track.stats.week}x na semana • ${track.stats.month}x no mês • ${track.stats.total}x total">🔥 ${count}x ${label}</span>`;
            }
        }

        const isAudioActive = !audio.paused && !!audio.src;
        const displayDate = track.liked_at ? formatDate(track.liked_at) : formatDate(track.date_added);

        tr.innerHTML = `
            <td style="text-align: center; width: 40px;">
                <span class="track-num">${isCurrentPlaying ? `<span class="equalizer-bars ${isAudioActive ? '' : 'paused'}"><span></span><span></span><span></span></span>` : trackNumDisplay}</span>
            </td>
            <td>
                <div class="tr-title-cell">
                    <img src="${coverSrc}" alt="Capa" loading="lazy" decoding="async" onerror="this.src='${DEFAULT_COVER_SVG}'">
                    <div class="tr-info">
                        <span class="tr-title">${escapeHtml(track.title)}</span>
                        <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
                            <span class="tr-artist clickable" title="Ver Artista">${escapeHtml(track.artist)}</span>
                            ${statBadgeHtml}
                        </div>
                    </div>
                </div>
            </td>
            <td><span class="clickable" title="Ver Álbum">${escapeHtml(track.album || '—')}</span></td>
            <td>${displayDate}</td>
            <td style="text-align: right; padding-right: 16px;">
                ${downloadBadgeHtml}
                <button class="add-to-pl-btn" title="Adicionar à Playlist">
                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/></svg>
                </button>
                <button class="heart-btn ${track.is_favorite ? 'active' : ''}" data-heart-track-id="${track.id}" style="margin-right: 16px;" title="${track.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}">${heartSvg}</button>
                <span style="font-variant-numeric: tabular-nums;">${formatTime(track.duration)}</span>
            </td>
        `;

        tr.addEventListener('dblclick', () => {
            playTrack(track, tracks);
        });

        tr.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-pl-btn') || e.target.closest('.heart-btn') || e.target.closest('.offline-row-badge') || e.target.closest('.clickable')) return;
            playTrack(track, tracks);
        });

        tr.querySelector('.tr-artist')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openArtistView(track.artist);
        });

        const albumEl = tr.querySelector('td:nth-child(3) .clickable');
        if (albumEl) {
            albumEl.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (track.album && track.album !== '—') {
                    if (track.albumId) {
                        openOnlineAlbumView({ id: track.albumId, title: track.album, artist: track.artist });
                    } else {
                        const albQuery = `${track.artist || ''} ${track.album}`.trim();
                        const albs = await window.api.searchOnlineAlbums(albQuery).catch(() => []);
                        if (albs && albs.length > 0) openOnlineAlbumView(albs[0]);
                        else openOnlineSearchView(track.album);
                    }
                }
            });
        }

        tr.querySelector('.add-to-pl-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openAddToPlaylistPicker(track);
        });

        // Offline row badge handler
        const dlBtn = tr.querySelector(`#row-dl-${track.id}`);
        if (dlBtn) {
            dlBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (dlBtn.classList.contains('downloaded')) {
                    // Option to delete offline download while strictly keeping favorite!
                    const confirmDel = confirm(`Música: "${track.title}"\nStatus: Baixada e disponível para reprodução offline.\n\nDeseja excluir o arquivo de áudio offline do seu computador?\n(A faixa continuará salva na sua biblioteca de favoritos).`);
                    if (confirmDel) {
                        const res = await window.api.deleteOfflineTrack(track.id);
                        if (res && res.success) {
                            track.isOfflineAvailable = false;
                            track.download_status = 'none';
                            track.offline_path = '';
                            dlBtn.className = 'offline-row-badge not-downloaded';
                            dlBtn.title = 'Baixar música para ouvir offline';
                            dlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
                            showToast(`Arquivo offline de "${track.title}" excluído. Favorito mantido!`);
                            updatePlaylistOfflineCount();
                        }
                    }
                } else if (dlBtn.classList.contains('downloading')) {
                    // Cancel download in progress
                    const res = await window.api.cancelDownload(track.id);
                    if (res && res.success) {
                        track.download_status = 'none';
                        dlBtn.className = 'offline-row-badge not-downloaded';
                        dlBtn.title = 'Baixar música para ouvir offline';
                        dlBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
                        showToast(`Download de "${track.title}" cancelado.`);
                    }
                } else {
                    startSpotifyDownload(track, dlBtn);
                }
            });
        }

        tr.querySelector('.heart-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleFavoriteTrack(track);
            if (currentOpenPlaylistIsFavorites) {
                setTimeout(() => {
                    refreshFavoritesView();
                }, 250);
            }
        });

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

function updatePlayingRow() {
    const currentTrack = currentQueue[currentIndex];
    const isPlaying = !audio.paused && !!audio.src;

    document.querySelectorAll('.track-row').forEach(row => {
        const rowTrackId = row.dataset.trackId;
        const defaultNum = row.dataset.trackNum || '';
        const numSpan = row.querySelector('.track-num');

        if (currentTrack && rowTrackId == currentTrack.id) {
            row.classList.add('playing');
            if (numSpan) {
                numSpan.innerHTML = `<span class="equalizer-bars ${isPlaying ? '' : 'paused'}"><span></span><span></span><span></span></span>`;
            }
        } else {
            row.classList.remove('playing');
            if (numSpan) {
                numSpan.innerText = defaultNum;
            }
        }
    });
}

// Smart Listening & Preference Tracking
let currentActiveTrackForTracking = null;
let trackPlayStartTime = 0;
let trackCompletedReported = false;
let trackSkipReported = false;

function handleTrackTransitionTracking() {
    if (currentActiveTrackForTracking && !trackCompletedReported && !trackSkipReported) {
        const listened = audio.currentTime;
        if (listened < 20 && (audio.duration > 30 || !audio.duration)) {
            trackSkipReported = true;
            if (window.api && window.api.recordPreferenceEvent) {
                window.api.recordPreferenceEvent({
                    type: 'fast_skip',
                    track: currentActiveTrackForTracking
                }).catch(() => {});
            }
        }
    }
}

function startTrackPlaybackTracking(track) {
    handleTrackTransitionTracking();
    currentActiveTrackForTracking = track;
    trackPlayStartTime = Date.now();
    trackCompletedReported = false;
    trackSkipReported = false;
}

function playTrack(track, queue) {
    if (!track) return;
    startTrackPlaybackTracking(track);
    const targetPath = track.offline_path || track.file_path;
    if (!targetPath) {
        playOnlineFullTrack(track, queue || currentQueue);
        return;
    }
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (queue) {
        originalQueue = [...queue];
        if (isShuffle) {
            currentQueue = [...queue].sort(() => Math.random() - 0.5);
            currentQueue = [track, ...currentQueue.filter(t => t.id != track.id)];
        } else {
            currentQueue = [...queue];
        }
    }

    currentIndex = currentQueue.findIndex(t => t.id == track.id);
    if (currentIndex === -1) {
        currentQueue.unshift(track);
        currentIndex = 0;
    }

    const audioUrl = getMediaUrl(targetPath);
    if (audio.src !== audioUrl) {
        audio.src = audioUrl;
        audio.load();
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(err => {
            console.error('Playback error:', err);
        });
    }

    // Increment play count
    try { window.api.incrementPlayCount(track.id); } catch(e) {}

    // Update bottom player
    lblTitle.innerText = track.title;
    lblArtist.innerText = track.artist;
    const coverSrc = getTrackCover(track);
    coverImg.src = coverSrc;

    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';

    nowPlayingFav.classList.toggle('active', !!track.is_favorite);
    nowPlayingFav.title = track.is_favorite ? "Remover dos Favoritos" : "Salvar em Músicas Curtidas";
    nowPlayingFav.onclick = async () => {
        await toggleFavoriteTrack(track);
    };

    updatePlayingRow();
    updateMediaSession(track);
    syncFullscreenPlayer(track);

    if (window.api.updatePlaybackState) {
        window.api.updatePlaybackState({ isPlaying: true, title: track.title, artist: track.artist });
    }

    // If lyrics view is open, load lyrics immediately
    if (document.getElementById('view-lyrics').classList.contains('active')) {
        loadLyrics(track);
    }

    renderQueueDrawer();
    showToast(`Tocando: ${track.title}`);
}

function updateMediaSession(track) {
    if ('mediaSession' in navigator) {
        const coverSrc = track.cover_path ? getMediaUrl(track.cover_path) : '';
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title,
            artist: track.artist,
            album: track.album || 'SpotCry',
            artwork: coverSrc ? [{ src: coverSrc, sizes: '512x512', type: 'image/jpeg' }] : []
        });

        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) {
                audio.currentTime = details.seekTime;
            }
        });
    }
}

async function togglePlay() {
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    if (!audio.src) {
        if (currentQueue && currentQueue.length > 0) {
            playTrack(currentQueue[0], currentQueue);
            return;
        }
        if (allTracksCache && allTracksCache.length > 0) {
            playTrack(allTracksCache[0], allTracksCache);
            return;
        }
        const favs = (await window.api.getFavorites()) || [];
        if (favs.length > 0) {
            playTrack(favs[0], favs);
            return;
        }
        if (homeChartsCache && homeChartsCache.tracks && homeChartsCache.tracks.length > 0) {
            playOnlineFullTrack(homeChartsCache.tracks[0], homeChartsCache.tracks);
            return;
        }
        return;
    }
    const curr = currentQueue[currentIndex];
    if (audio.paused) {
        audio.play().catch(err => console.error(err));
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
        document.getElementById('icon-fs-play').style.display = 'none';
        document.getElementById('icon-fs-pause').style.display = 'block';
        if (window.api.updatePlaybackState && curr) {
            window.api.updatePlaybackState({ isPlaying: true, title: curr.title, artist: curr.artist });
        }
    } else {
        audio.pause();
        iconPlay.style.display = 'block';
        iconPause.style.display = 'none';
        document.getElementById('icon-fs-play').style.display = 'block';
        document.getElementById('icon-fs-pause').style.display = 'none';
        if (window.api.updatePlaybackState && curr) {
            window.api.updatePlaybackState({ isPlaying: false, title: curr.title, artist: curr.artist });
        }
    }
    updatePlayingRow();
}

btnPlay.addEventListener('click', togglePlay);

audio.addEventListener('play', () => {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
    document.getElementById('icon-fs-play').style.display = 'none';
    document.getElementById('icon-fs-pause').style.display = 'block';
    updatePlayingRow();
    syncQueuePlaybackState(true);
});

audio.addEventListener('pause', () => {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    document.getElementById('icon-fs-play').style.display = 'block';
    document.getElementById('icon-fs-pause').style.display = 'none';
    updatePlayingRow();
    syncQueuePlaybackState(false);
});

audio.addEventListener('error', () => {
    console.error('Audio Error:', audio.error);
    showToast("Erro ao carregar áudio. Verifique se o arquivo existe.");
    syncQueuePlaybackState(false);
});

function playNextTrack() {
    // 1. If there are items in the user queue, play first
    if (userQueue.length > 0) {
        const nextTrack = userQueue.shift();
        if (currentIndex >= 0 && currentIndex < currentQueue.length) {
            currentQueue.splice(currentIndex + 1, 0, nextTrack);
            currentIndex = currentIndex + 1;
        } else {
            currentQueue.push(nextTrack);
            currentIndex = currentQueue.length - 1;
        }
        playTrack(nextTrack, currentQueue);
        renderQueueDrawer();
        return;
    }

    // 2. Play from current playlist/queue
    if (currentQueue.length === 0) return;
    if (currentIndex < currentQueue.length - 1) {
        currentIndex++;
        playTrack(currentQueue[currentIndex], currentQueue);
    } else if (repeatMode === 1 || repeatMode === 2) {
        currentIndex = 0;
        playTrack(currentQueue[0], currentQueue);
    }
}

function playPrevTrack() {
    if (currentQueue.length === 0) return;
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else if (currentIndex > 0) {
        currentIndex--;
        playTrack(currentQueue[currentIndex], currentQueue);
    } else if (repeatMode === 1 || repeatMode === 2) {
        currentIndex = currentQueue.length - 1;
        playTrack(currentQueue[currentIndex], currentQueue);
    }
}

btnNext.addEventListener('click', playNextTrack);
btnPrev.addEventListener('click', playPrevTrack);

let lastSec = -1;
audio.addEventListener('timeupdate', () => {
    const sec = Math.floor(audio.currentTime);
    if (sec !== lastSec) {
        lastSec = sec;
        progressSlider.value = audio.currentTime;
        timeCurrent.innerText = formatTime(sec);

        // Update Fullscreen scrubber
        const fsProgress = document.getElementById('fs-progress-slider');
        const fsTimeCurr = document.getElementById('fs-time-current');
        if (fsProgress) fsProgress.value = audio.currentTime;
        if (fsTimeCurr) fsTimeCurr.innerText = formatTime(sec);

        // Update active lyrics highlight
        updateLyricsProgress(audio.currentTime);

        // Track completion tracking (>= 75% completed or >= 60s for long songs)
        if (!trackCompletedReported && currentActiveTrackForTracking && audio.duration && audio.duration > 15) {
            const pct = audio.currentTime / audio.duration;
            if (pct >= 0.75 || (audio.currentTime >= 60 && pct >= 0.5)) {
                trackCompletedReported = true;
                if (window.api && window.api.recordPreferenceEvent) {
                    window.api.recordPreferenceEvent({
                        type: 'play_complete',
                        track: currentActiveTrackForTracking
                    }).catch(() => {});
                }
            }
        }
    }
});

audio.addEventListener('loadedmetadata', () => {
    progressSlider.max = audio.duration;
    timeTotal.innerText = formatTime(audio.duration);
    const fsProgress = document.getElementById('fs-progress-slider');
    const fsTimeTot = document.getElementById('fs-time-total');
    if (fsProgress) fsProgress.max = audio.duration;
    if (fsTimeTot) fsTimeTot.innerText = formatTime(audio.duration);
    lastSec = -1;
});

audio.addEventListener('ended', () => {
    if (!trackCompletedReported && currentActiveTrackForTracking) {
        trackCompletedReported = true;
        if (window.api && window.api.recordPreferenceEvent) {
            window.api.recordPreferenceEvent({
                type: 'play_complete',
                track: currentActiveTrackForTracking
            }).catch(() => {});
        }
    }
    if (repeatMode === 2 && currentActiveTrackForTracking) {
        if (window.api && window.api.recordPreferenceEvent) {
            window.api.recordPreferenceEvent({
                type: 'repeat_track',
                track: currentActiveTrackForTracking
            }).catch(() => {});
        }
    }
    if (sleepTimerMode === 'end_of_track') {
        audio.pause();
        setSleepTimer('0');
        showToast("Temporizador de sono finalizado após o fim da faixa 🌙");
        return;
    }
    if (repeatMode === 2) {
        audio.currentTime = 0;
        audio.play();
    } else {
        playNextTrack();
    }
});

progressSlider.addEventListener('input', () => {
    audio.currentTime = progressSlider.value;
});

volumeSlider.addEventListener('input', () => {
    audio.volume = volumeSlider.value / 100;
    if (audio.volume === 0) {
        iconVolHigh.style.display = 'none';
        iconVolMute.style.display = 'block';
    } else {
        iconVolHigh.style.display = 'block';
        iconVolMute.style.display = 'none';
    }
});

btnMute.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (audio.muted) {
        iconVolHigh.style.display = 'none';
        iconVolMute.style.display = 'block';
        showToast("Áudio mutado");
    } else {
        iconVolHigh.style.display = 'block';
        iconVolMute.style.display = 'none';
        showToast("Áudio desmutado");
    }
});

btnShuffle.addEventListener('click', () => {
    isShuffle = !isShuffle;
    btnShuffle.classList.toggle('active', isShuffle);
    document.getElementById('btn-fs-shuffle').classList.toggle('active', isShuffle);
    const currentTrack = currentQueue[currentIndex];
    if (isShuffle) {
        currentQueue = [...originalQueue].sort(() => Math.random() - 0.5);
        if (currentTrack) {
            currentQueue = [currentTrack, ...currentQueue.filter(t => t.id != currentTrack.id)];
            currentIndex = 0;
        }
        showToast("Ordem aleatória ativada");
    } else {
        currentQueue = [...originalQueue];
        if (currentTrack) currentIndex = currentQueue.findIndex(t => t.id == currentTrack.id);
        showToast("Ordem sequencial ativada");
    }
});

const iconRepeat = document.getElementById('icon-repeat');
const iconRepeatOne = document.getElementById('icon-repeat-one');

btnRepeat.addEventListener('click', () => {
    repeatMode = (repeatMode + 1) % 3;
    if (repeatMode === 0) {
        btnRepeat.classList.remove('active');
        iconRepeat.style.display = 'block';
        iconRepeatOne.style.display = 'none';
        showToast("Repetição desativada");
    } else if (repeatMode === 1) {
        btnRepeat.classList.add('active');
        iconRepeat.style.display = 'block';
        iconRepeatOne.style.display = 'none';
        showToast("Repetindo fila inteira");
    } else if (repeatMode === 2) {
        btnRepeat.classList.add('active');
        iconRepeat.style.display = 'none';
        iconRepeatOne.style.display = 'block';
        showToast("Repetindo música em loop");
    }
});

// ==========================================================================
// QUEUE DRAWER & QUEUE MANAGEMENT
// ==========================================================================

let activeQueueMenu = null; // { track, queueType, index }
let dragSrcInfo = null;     // { queueType, index, track }
let isDraggingActive = false;

// Elements
const queueDrawerEl = document.getElementById('queue-drawer');
const queueCloseBtnEl = document.getElementById('btn-close-queue');
const queueClearBtnEl = document.getElementById('btn-clear-queue');
const queueConfirmBarEl = document.getElementById('queue-clear-confirm');
const queueConfirmBtnEl = document.getElementById('btn-confirm-clear');
const queueCancelBtnEl = document.getElementById('btn-cancel-clear');
const queueCountBadgeEl = document.getElementById('queue-count-badge');
const queueContextMenuEl = document.getElementById('queue-context-menu');

if (btnQueue) {
    btnQueue.addEventListener('click', toggleQueueDrawer);
}
if (queueCloseBtnEl) {
    queueCloseBtnEl.addEventListener('click', closeQueueDrawer);
}

function toggleQueueDrawer() {
    if (!queueDrawerEl) return;
    const isOpen = queueDrawerEl.classList.toggle('open');
    if (btnQueue) {
        btnQueue.classList.toggle('active', isOpen);
    }
    if (isOpen) {
        renderQueueDrawer();
    } else {
        closeQueueContextMenu();
        if (queueConfirmBarEl) queueConfirmBarEl.style.display = 'none';
    }
}

function closeQueueDrawer() {
    if (!queueDrawerEl) return;
    queueDrawerEl.classList.remove('open');
    if (btnQueue) btnQueue.classList.remove('active');
    closeQueueContextMenu();
    if (queueConfirmBarEl) queueConfirmBarEl.style.display = 'none';
}

function syncQueuePlaybackState(isPlayingOverride) {
    const isPlaying = (typeof isPlayingOverride === 'boolean')
        ? isPlayingOverride
        : (!audio.paused && !audio.ended && audio.currentTime > 0);

    const nowPlayingItem = document.querySelector('.queue-item.now-playing');
    if (!nowPlayingItem) return;

    nowPlayingItem.classList.toggle('is-paused', !isPlaying);
    const eqBars = nowPlayingItem.querySelector('.queue-eq-bars');
    if (eqBars) {
        eqBars.classList.toggle('animating', isPlaying);
        eqBars.classList.toggle('is-paused', !isPlaying);
    }
    const tag = nowPlayingItem.querySelector('.queue-item-status-tag');
    if (tag) {
        tag.textContent = isPlaying ? '• Tocando' : '• Pausado';
    }
}

function getTrackDurationDisplay(track) {
    if (!track) return '';
    if (track.durationFormatted && typeof track.durationFormatted === 'string') {
        return track.durationFormatted;
    }
    if (typeof track.duration === 'string' && track.duration.includes(':')) {
        return track.duration;
    }
    if (typeof track.duration === 'number' && track.duration > 0) {
        return formatTime(track.duration);
    }
    if (typeof track.seconds === 'number' && track.seconds > 0) {
        return formatTime(track.seconds);
    }
    if (typeof track.duration_seconds === 'number' && track.duration_seconds > 0) {
        return formatTime(track.duration_seconds);
    }
    return '';
}

function addToUserQueue(track) {
    if (!track) return;
    registerTrack(track);
    userQueue.push(track);
    showToast(`"${track.title}" adicionada à fila`);
    renderQueueDrawer();
}

function playNextUserQueue(track) {
    if (!track) return;
    registerTrack(track);
    const idx = userQueue.findIndex(t => String(t.id) === String(track.id));
    if (idx !== -1) userQueue.splice(idx, 1);
    userQueue.unshift(track);
    showToast(`"${track.title}" tocará a seguir`);
    renderQueueDrawer();
}

function removeFromUserQueue(index) {
    if (index >= 0 && index < userQueue.length) {
        const removed = userQueue.splice(index, 1)[0];
        if (removed) showToast(`"${removed.title}" removida da fila`);
        renderQueueDrawer();
    }
}

// Clear Queue Button & Confirmation
if (queueClearBtnEl) {
    queueClearBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const totalUpcoming = userQueue.length + Math.max(0, currentQueue.length - (currentIndex + 1));
        if (totalUpcoming === 0) return;
        if (queueConfirmBarEl) {
            queueConfirmBarEl.style.display = (queueConfirmBarEl.style.display === 'none' ? 'flex' : 'none');
        }
    });
}

if (queueCancelBtnEl) {
    queueCancelBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (queueConfirmBarEl) queueConfirmBarEl.style.display = 'none';
    });
}

if (queueConfirmBtnEl) {
    queueConfirmBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        userQueue = [];
        if (currentQueue.length > currentIndex + 1) {
            currentQueue = currentQueue.slice(0, currentIndex + 1);
            originalQueue = currentQueue.slice(0, currentIndex + 1);
        }
        if (queueConfirmBarEl) queueConfirmBarEl.style.display = 'none';
        renderQueueDrawer();
        showToast("Fila de reprodução limpa");
    });
}

// Queue Context Menu Actions
function openQueueContextMenu(btnEl, track, queueType, index) {
    if (!queueContextMenuEl || !btnEl || !track) return;
    activeQueueMenu = { track, queueType, index };

    const rect = btnEl.getBoundingClientRect();
    queueContextMenuEl.style.display = 'flex';

    const menuWidth = 180;
    const menuHeight = 135;
    let top = rect.bottom + 4;
    let left = rect.right - menuWidth;

    if (top + menuHeight > window.innerHeight - 15) {
        top = rect.top - menuHeight - 4;
    }
    if (left < 10) left = 10;

    queueContextMenuEl.style.top = `${top}px`;
    queueContextMenuEl.style.left = `${left}px`;
}

function closeQueueContextMenu() {
    if (queueContextMenuEl) {
        queueContextMenuEl.style.display = 'none';
    }
    activeQueueMenu = null;
}

document.addEventListener('click', (e) => {
    if (queueContextMenuEl && queueContextMenuEl.style.display !== 'none') {
        if (!queueContextMenuEl.contains(e.target) && !e.target.closest('.queue-item-more-btn')) {
            closeQueueContextMenu();
        }
    }
    if (queueConfirmBarEl && queueConfirmBarEl.style.display !== 'none') {
        if (!queueConfirmBarEl.contains(e.target) && !e.target.closest('#btn-clear-queue')) {
            queueConfirmBarEl.style.display = 'none';
        }
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (queueContextMenuEl && queueContextMenuEl.style.display !== 'none') {
            closeQueueContextMenu();
            return;
        }
        if (queueConfirmBarEl && queueConfirmBarEl.style.display !== 'none') {
            queueConfirmBarEl.style.display = 'none';
            return;
        }
        if (queueDrawerEl && queueDrawerEl.classList.contains('open')) {
            closeQueueDrawer();
        }
    }
});

const menuPlayNowEl = document.getElementById('queue-ctx-play-now');
const menuPlayNextEl = document.getElementById('queue-ctx-play-next');
const menuRemoveEl = document.getElementById('queue-ctx-remove');

if (menuPlayNowEl) {
    menuPlayNowEl.addEventListener('click', () => {
        if (!activeQueueMenu) return;
        const { track, queueType, index } = activeQueueMenu;
        closeQueueContextMenu();
        if (queueType === 'now_playing') {
            if (audio.paused) {
                audio.play().catch(e => console.error(e));
            } else {
                audio.currentTime = 0;
                audio.play().catch(e => console.error(e));
            }
        } else if (queueType === 'user') {
            userQueue.splice(index, 1);
            if (currentIndex >= 0 && currentIndex < currentQueue.length) {
                currentQueue.splice(currentIndex + 1, 0, track);
                currentIndex++;
            } else {
                currentQueue.push(track);
                currentIndex = currentQueue.length - 1;
            }
            playTrack(track, currentQueue);
        } else if (queueType === 'playlist') {
            playTrack(track, currentQueue);
        }
        renderQueueDrawer();
    });
}

if (menuPlayNextEl) {
    menuPlayNextEl.addEventListener('click', () => {
        if (!activeQueueMenu) return;
        const { track, queueType, index } = activeQueueMenu;
        closeQueueContextMenu();
        if (queueType === 'now_playing') {
            showToast("Esta música já está tocando");
            return;
        }
        if (queueType === 'user') {
            userQueue.splice(index, 1);
            userQueue.unshift(track);
        } else if (queueType === 'playlist') {
            const existingIdx = userQueue.findIndex(t => String(t.id) === String(track.id));
            if (existingIdx !== -1) userQueue.splice(existingIdx, 1);
            userQueue.unshift(track);
        }
        showToast(`"${track.title}" tocará a seguir`);
        renderQueueDrawer();
    });
}

if (menuRemoveEl) {
    menuRemoveEl.addEventListener('click', () => {
        if (!activeQueueMenu) return;
        const { track, queueType, index } = activeQueueMenu;
        closeQueueContextMenu();
        if (queueType === 'now_playing') {
            showToast(`"${track.title}" removida da reprodução`);
            playNextTrack();
        } else if (queueType === 'user') {
            userQueue.splice(index, 1);
            showToast(`"${track.title}" removida da fila`);
            renderQueueDrawer();
        } else if (queueType === 'playlist') {
            const actualIndex = currentIndex + 1 + index;
            if (actualIndex < currentQueue.length) {
                currentQueue.splice(actualIndex, 1);
                originalQueue = originalQueue.filter(t => String(t.id) !== String(track.id));
                showToast(`"${track.title}" removida da fila`);
                renderQueueDrawer();
            }
        }
    });
}

function handleQueueReorder(src, destQueueType, destIndex) {
    if (!src) return;

    let movedTrack = null;

    // 1. Extract item from source
    if (src.queueType === 'user') {
        if (src.index >= 0 && src.index < userQueue.length) {
            movedTrack = userQueue.splice(src.index, 1)[0];
        }
    } else if (src.queueType === 'playlist') {
        const actualSrcIndex = currentIndex + 1 + src.index;
        if (actualSrcIndex < currentQueue.length) {
            movedTrack = currentQueue.splice(actualSrcIndex, 1)[0];
        }
    }

    if (!movedTrack) return;

    // 2. Insert item into destination
    if (destQueueType === 'user') {
        let insertAt = destIndex;
        if (src.queueType === 'user' && src.index < destIndex) {
            insertAt = Math.max(0, insertAt - 1);
        }
        insertAt = Math.max(0, Math.min(insertAt, userQueue.length));
        userQueue.splice(insertAt, 0, movedTrack);
    } else if (destQueueType === 'playlist') {
        let insertAt = currentIndex + 1 + destIndex;
        if (src.queueType === 'playlist' && (currentIndex + 1 + src.index) < insertAt) {
            insertAt = Math.max(currentIndex + 1, insertAt - 1);
        }
        insertAt = Math.max(currentIndex + 1, Math.min(insertAt, currentQueue.length));
        currentQueue.splice(insertAt, 0, movedTrack);
        originalQueue = [...currentQueue];
    }

    renderQueueDrawer();
    showToast("Ordem da fila atualizada");
}

function createQueueItemElement(track, options) {
    const { queueType, index, isNowPlaying } = options;
    registerTrack(track);

    const item = document.createElement('div');
    item.className = 'queue-item' + (isNowPlaying ? ' now-playing' : ' draggable');
    item.dataset.trackId = track.id;
    item.dataset.queueType = queueType;
    item.dataset.index = index;
    item.tabIndex = 0;

    const isCurrentlyActiveAudio = isNowPlaying && !audio.paused && !audio.ended && audio.currentTime > 0;
    if (isNowPlaying && !isCurrentlyActiveAudio) {
        item.classList.add('is-paused');
    }

    // Drag and drop event listeners
    if (!isNowPlaying) {
        item.draggable = true;

        item.addEventListener('dragstart', (e) => {
            dragSrcInfo = { queueType, index, track };
            isDraggingActive = true;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', JSON.stringify({ queueType, index, id: track.id }));
            item.classList.add('is-dragging');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('is-dragging');
            document.querySelectorAll('.queue-item').forEach(el => {
                el.classList.remove('drop-target-above', 'drop-target-below');
            });
            setTimeout(() => { isDraggingActive = false; }, 80);
            dragSrcInfo = null;
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!dragSrcInfo) return;
            e.dataTransfer.dropEffect = 'move';

            const rect = item.getBoundingClientRect();
            const relY = e.clientY - rect.top;
            if (relY < rect.height / 2) {
                item.classList.add('drop-target-above');
                item.classList.remove('drop-target-below');
            } else {
                item.classList.add('drop-target-below');
                item.classList.remove('drop-target-above');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drop-target-above', 'drop-target-below');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove('drop-target-above', 'drop-target-below');

            if (!dragSrcInfo) return;
            const src = dragSrcInfo;
            const destQueueType = queueType;
            let destIndex = index;

            const rect = item.getBoundingClientRect();
            const isBelow = (e.clientY - rect.top) >= (rect.height / 2);
            if (isBelow) destIndex++;

            handleQueueReorder(src, destQueueType, destIndex);
        });
    }

    // Cover Box
    const coverBox = document.createElement('div');
    coverBox.className = 'queue-cover-container';

    const coverImg = document.createElement('img');
    coverImg.className = 'queue-cover-img';
    coverImg.alt = track.title || 'Capa';
    coverImg.loading = 'lazy';
    coverImg.decoding = 'async';
    coverImg.src = getTrackCover(track);
    coverImg.onerror = function() {
        if (this.src !== DEFAULT_COVER_SVG) {
            this.src = DEFAULT_COVER_SVG;
        }
    };
    coverBox.appendChild(coverImg);

    // Equalizer Overlay for Now Playing
    if (isNowPlaying) {
        const eqOverlay = document.createElement('div');
        eqOverlay.className = 'queue-eq-overlay';
        eqOverlay.innerHTML = `
            <div class="queue-eq-bars ${isCurrentlyActiveAudio ? 'animating' : 'is-paused'}">
                <span class="queue-eq-bar"></span>
                <span class="queue-eq-bar"></span>
                <span class="queue-eq-bar"></span>
                <span class="queue-eq-bar"></span>
            </div>
        `;
        coverBox.appendChild(eqOverlay);
    }

    item.appendChild(coverBox);

    // Metadata
    const meta = document.createElement('div');
    meta.className = 'queue-item-meta';

    const titleEl = document.createElement('div');
    titleEl.className = 'queue-item-title';
    titleEl.textContent = track.title || 'Música Desconhecida';
    titleEl.title = track.title || '';
    meta.appendChild(titleEl);

    const subEl = document.createElement('div');
    subEl.className = 'queue-item-sub';

    const artistEl = document.createElement('span');
    artistEl.className = 'queue-item-artist';
    artistEl.textContent = track.artist || 'Artista Desconhecido';
    artistEl.title = track.artist || '';
    subEl.appendChild(artistEl);

    if (isNowPlaying) {
        const statusTag = document.createElement('span');
        statusTag.className = 'queue-item-status-tag';
        statusTag.textContent = isCurrentlyActiveAudio ? '• Tocando' : '• Pausado';
        subEl.appendChild(statusTag);
    }

    meta.appendChild(subEl);
    item.appendChild(meta);

    // Actions Right
    const actions = document.createElement('div');
    actions.className = 'queue-item-actions';

    const durationStr = getTrackDurationDisplay(track);
    if (durationStr) {
        const durEl = document.createElement('span');
        durEl.className = 'queue-item-duration';
        durEl.textContent = durationStr;
        actions.appendChild(durEl);
    }

    // Drag Handle Icon
    if (!isNowPlaying) {
        const dragHandle = document.createElement('div');
        dragHandle.className = 'queue-item-drag-handle';
        dragHandle.title = 'Arrastar para reorganizar';
        dragHandle.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><circle cx="5" cy="3" r="1.2"/><circle cx="11" cy="3" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="13" r="1.2"/><circle cx="11" cy="13" r="1.2"/></svg>`;
        actions.appendChild(dragHandle);
    }

    // Heart Favorite Button in Queue
    const heartBtn = document.createElement('button');
    heartBtn.className = 'queue-item-heart-btn heart-btn' + (track.is_favorite ? ' active' : '');
    heartBtn.dataset.heartTrackId = track.id;
    heartBtn.title = track.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos';
    heartBtn.innerHTML = track.is_favorite ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
    heartBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFavoriteTrack(track);
    });
    actions.appendChild(heartBtn);

    // 3-Dots More Options Button
    const moreBtn = document.createElement('button');
    moreBtn.className = 'queue-item-more-btn';
    moreBtn.title = 'Opções da faixa';
    moreBtn.setAttribute('aria-label', `Opções para ${track.title}`);
    moreBtn.innerHTML = `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm5 1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`;
    moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openQueueContextMenu(moreBtn, track, queueType, index);
    });
    actions.appendChild(moreBtn);

    item.appendChild(actions);

    // Row Click Handler
    item.addEventListener('click', () => {
        if (isDraggingActive) return;
        if (isNowPlaying) {
            togglePlay();
        } else if (queueType === 'user') {
            userQueue.splice(index, 1);
            if (currentIndex >= 0 && currentIndex < currentQueue.length) {
                currentQueue.splice(currentIndex + 1, 0, track);
                currentIndex++;
            } else {
                currentQueue.push(track);
                currentIndex = currentQueue.length - 1;
            }
            playTrack(track, currentQueue);
        } else if (queueType === 'playlist') {
            playTrack(track, currentQueue);
        }
    });

    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            item.click();
        }
    });

    return item;
}

function renderQueueDrawer() {
    const container = document.getElementById('queue-drawer-content');
    if (!container) return;
    container.innerHTML = '';

    const currentTrack = currentQueue[currentIndex];
    const remainingInQueue = currentQueue.slice(currentIndex + 1);
    const totalUpcoming = userQueue.length + remainingInQueue.length;

    // Update Header Badge & Clear Button
    if (queueCountBadgeEl) {
        if (totalUpcoming > 0) {
            queueCountBadgeEl.textContent = String(totalUpcoming);
            queueCountBadgeEl.style.display = 'inline-block';
        } else {
            queueCountBadgeEl.style.display = 'none';
        }
    }

    if (queueClearBtnEl) {
        if (totalUpcoming === 0) {
            queueClearBtnEl.disabled = true;
            queueClearBtnEl.classList.add('disabled');
            queueClearBtnEl.title = 'Nenhuma faixa seguinte na fila';
        } else {
            queueClearBtnEl.disabled = false;
            queueClearBtnEl.classList.remove('disabled');
            queueClearBtnEl.title = `Limpar ${totalUpcoming} ${totalUpcoming === 1 ? 'música' : 'músicas'} da fila`;
        }
    }

    // 1. Now Playing Section
    const nowSection = document.createElement('div');
    nowSection.className = 'queue-section';
    nowSection.innerHTML = `
        <div class="queue-section-header">
            <span class="queue-section-title">Tocando agora</span>
        </div>
    `;

    if (currentTrack) {
        const nowItem = createQueueItemElement(currentTrack, {
            queueType: 'now_playing',
            index: currentIndex,
            isNowPlaying: true
        });
        nowSection.appendChild(nowItem);
    } else {
        const emptyNow = document.createElement('div');
        emptyNow.className = 'queue-sub-empty';
        emptyNow.textContent = 'Nenhuma música tocando no momento';
        nowSection.appendChild(emptyNow);
    }
    container.appendChild(nowSection);

    // 2. User Queue (A Seguir - Fila Prioritária do Usuário)
    if (userQueue.length > 0) {
        const userSection = document.createElement('div');
        userSection.className = 'queue-section';
        userSection.innerHTML = `
            <div class="queue-section-header">
                <span class="queue-section-title">Próximas da Fila</span>
                <span class="queue-section-count">${userQueue.length} ${userQueue.length === 1 ? 'música' : 'músicas'}</span>
            </div>
        `;

        userQueue.forEach((t, i) => {
            const item = createQueueItemElement(t, {
                queueType: 'user',
                index: i,
                isNowPlaying: false
            });
            userSection.appendChild(item);
        });

        container.appendChild(userSection);
    }

    // 3. Next in Playlist / Album
    if (remainingInQueue.length > 0) {
        const nextSection = document.createElement('div');
        nextSection.className = 'queue-section';
        nextSection.innerHTML = `
            <div class="queue-section-header">
                <span class="queue-section-title">A Seguir na Playlist</span>
                <span class="queue-section-count">${remainingInQueue.length} ${remainingInQueue.length === 1 ? 'música' : 'músicas'}</span>
            </div>
        `;

        // Render up to 50 tracks for high performance
        const displayLimit = Math.min(remainingInQueue.length, 50);
        for (let i = 0; i < displayLimit; i++) {
            const t = remainingInQueue[i];
            const item = createQueueItemElement(t, {
                queueType: 'playlist',
                index: i,
                isNowPlaying: false
            });
            nextSection.appendChild(item);
        }

        if (remainingInQueue.length > displayLimit) {
            const moreNote = document.createElement('div');
            moreNote.className = 'queue-sub-empty';
            moreNote.textContent = `+ ${remainingInQueue.length - displayLimit} outras músicas na sequência`;
            nextSection.appendChild(moreNote);
        }

        container.appendChild(nextSection);
    }

    // 4. Empty Queue State
    if (!currentTrack && totalUpcoming === 0) {
        container.innerHTML = `
            <div class="queue-empty-state">
                <div class="queue-empty-icon">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.6">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                    </svg>
                </div>
                <h4 class="queue-empty-title">Sua fila está vazia</h4>
                <p class="queue-empty-desc">Adicione músicas à fila pelo menu de três pontos (•••) em qualquer faixa ou dê play em um álbum.</p>
            </div>
        `;
    } else if (currentTrack && totalUpcoming === 0) {
        const endNote = document.createElement('div');
        endNote.className = 'queue-sub-empty';
        endNote.style.marginTop = '10px';
        endNote.textContent = 'Fim da fila. Adicione mais músicas pelo menu (•••) ou selecione outra playlist.';
        container.appendChild(endNote);
    }
}

// ==========================================================================
// LYRICS SYNCHRONIZER (HIGH-PRECISION & AUTO-SAVING OFFLINE)
// ==========================================================================

let lyricsRafId = null;
let userIsScrollingLyrics = false;
let userScrollLyricsTimer = null;

btnLyrics.addEventListener('click', () => {
    const currentTrack = currentQueue[currentIndex];
    if (!currentTrack) {
        showToast("Toque uma música para ver a letra");
        return;
    }
    showView('view-lyrics');
    loadLyrics(currentTrack);
    startLyricsSyncLoop();
});

document.getElementById('btn-close-lyrics').addEventListener('click', () => {
    stopLyricsSyncLoop();
    showView(previousViewId || 'view-home');
});

// Setup user scroll detection on lyrics container
const lyricsContainerEl = document.getElementById('lyrics-lines-container');
if (lyricsContainerEl) {
    const onUserScroll = () => {
        userIsScrollingLyrics = true;
        if (userScrollLyricsTimer) clearTimeout(userScrollLyricsTimer);
        userScrollLyricsTimer = setTimeout(() => {
            userIsScrollingLyrics = false;
        }, 1200);
    };
    lyricsContainerEl.addEventListener('wheel', onUserScroll, { passive: true });
    lyricsContainerEl.addEventListener('touchmove', onUserScroll, { passive: true });
}

function startLyricsSyncLoop() {
    stopLyricsSyncLoop();
    function loop() {
        if (document.getElementById('view-lyrics').classList.contains('active') && !audio.paused) {
            updateLyricsProgress(audio.currentTime);
        }
        lyricsRafId = requestAnimationFrame(loop);
    }
    lyricsRafId = requestAnimationFrame(loop);
}

function stopLyricsSyncLoop() {
    if (lyricsRafId) {
        cancelAnimationFrame(lyricsRafId);
        lyricsRafId = null;
    }
}

function cleanMusicTitle(str) {
    if (!str) return '';
    return str
        .replace(/\s*[\(\[](ao vivo|live|official video|vídeo oficial|clipe oficial|lyric video|letra|remaster(ed)?|áudio oficial|audio oficial|versão.*|version.*)[\)\]]/gi, '')
        .replace(/\s*[\(\[](feat\.|ft\.|participação|part\.).*?[\)\]]/gi, '')
        .replace(/\s*-\s*(ao vivo|live|oficial|official).*$/gi, '')
        .trim();
}

async function loadLyrics(track) {
    if (!track) return;
    registerTrack(track);
    const titleEl = document.getElementById('lyrics-track-title');
    const artistEl = document.getElementById('lyrics-track-artist');
    const coverEl = document.getElementById('lyrics-track-cover');
    const linesContainer = document.getElementById('lyrics-lines-container');

    titleEl.innerText = track.title;
    artistEl.innerText = track.artist;
    coverEl.src = getTrackCover(track);
    linesContainer.innerHTML = `<div class="lyrics-status-msg">Buscando letra de "${track.title}"...</div>`;

    activeLyrics = [];
    activeLyricsIndex = -1;
    userIsScrollingLyrics = false;

    // 1. Check local .lrc or cache file first
    let lrcRaw = null;
    if (track.file_path) {
        try {
            const localResult = await window.api.getLocalLyrics(track.file_path);
            if (localResult && localResult.content) {
                lrcRaw = localResult.content;
            }
        } catch(e) {}
    }

    // 2. Online fetch via Integrated Multi-Source Engine (LRCLIB + Letras.mus.br fallback)
    if (!lrcRaw) {
        try {
            const onlineRes = await window.api.searchOnlineLyrics(track.artist, track.title, track.album, track.duration);
            if (onlineRes && onlineRes.content) {
                lrcRaw = onlineRes.content;
                
                // Auto-save downloaded lyrics silently in background for offline use
                if (track.file_path) {
                    window.api.saveLocalLyrics(track.file_path, lrcRaw).catch(e => console.warn('Could not auto-save .lrc:', e));
                }
            }
        } catch (e) {
            console.warn('Lyrics fetch error:', e);
        }
    }

    if (!lrcRaw) {
        linesContainer.innerHTML = `<div class="lyrics-status-msg">Não encontramos a letra para esta faixa.</div>`;
        return;
    }

    // Parse LRC lines with high-precision timestamp handling
    linesContainer.innerHTML = '';
    const parsed = parseLRC(lrcRaw);
    activeLyrics = parsed;

    if (parsed.length === 0) {
        linesContainer.innerHTML = `<div class="lyrics-status-msg">Letra indisponível.</div>`;
        return;
    }

    parsed.forEach((line, index) => {
        const div = document.createElement('div');
        div.className = 'lyrics-line';
        div.dataset.index = index;
        div.innerText = line.text || '♪';

        if (line.time !== null) {
            div.addEventListener('click', () => {
                audio.currentTime = Math.max(0, line.time - 0.05);
                userIsScrollingLyrics = false;
                if (userScrollLyricsTimer) clearTimeout(userScrollLyricsTimer);
                activeLyricsIndex = -1;
                updateLyricsProgress(audio.currentTime);
            });
        }
        linesContainer.appendChild(div);
    });

    activeLyricsIndex = -1;
    updateLyricsProgress(audio.currentTime);
    startLyricsSyncLoop();

    // Immediate initial centering
    setTimeout(() => {
        const activeLineEl = document.querySelector('.lyrics-line.active');
        const container = document.getElementById('lyrics-lines-container');
        if (activeLineEl && container) {
            const targetScroll = activeLineEl.offsetTop - (container.clientHeight / 2) + (activeLineEl.offsetHeight / 2);
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }
    }, 60);
}

/**
 * Ultra-robust and precise LRC parser.
 * Handles offsets, multi-timestamp lines, milliseconds, and clean text stripping.
 */
function parseLRC(text) {
    if (!text || typeof text !== 'string') return [];
    const rawLines = text.split(/\r?\n/);
    const parsedItems = [];

    // Check for global offset tag: [offset:+/-ms]
    let globalOffsetSec = 0;
    const offsetMatch = text.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
    if (offsetMatch) {
        const offsetMs = parseInt(offsetMatch[1], 10);
        if (!isNaN(offsetMs)) {
            globalOffsetSec = offsetMs / 1000;
        }
    }

    const timeRegex = /\[(\d{1,2}):(\d{2})(?:[\.:](\d{1,3}))?\]/g;
    let hasSyncedTimestamps = false;

    for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Skip metadata header tags like [ti:], [ar:], [al:], [by:], [re:], [ve:]
        if (/^\[(ti|ar|al|by|re|ve|length|offset):/i.test(trimmed)) {
            continue;
        }

        const matches = [...trimmed.matchAll(timeRegex)];
        if (matches.length > 0) {
            hasSyncedTimestamps = true;
            let cleanText = trimmed.replace(timeRegex, '').trim();

            for (const match of matches) {
                const min = parseInt(match[1], 10);
                const sec = parseInt(match[2], 10);
                let ms = 0;
                if (match[3]) {
                    const msRaw = match[3];
                    if (msRaw.length === 1) ms = parseInt(msRaw, 10) * 100;
                    else if (msRaw.length === 2) ms = parseInt(msRaw, 10) * 10;
                    else ms = parseInt(msRaw.slice(0, 3), 10);
                }

                const totalSeconds = (min * 60) + sec + (ms / 1000) + globalOffsetSec;
                parsedItems.push({
                    time: Math.max(0, totalSeconds),
                    text: cleanText || '♪'
                });
            }
        } else if (!hasSyncedTimestamps) {
            parsedItems.push({ time: null, text: trimmed });
        }
    }

    if (hasSyncedTimestamps) {
        return parsedItems
            .filter(item => item.time !== null)
            .sort((a, b) => a.time - b.time);
    }

    return parsedItems;
}

/**
 * Real-time sub-second lyrics synchronization and centering.
 */
function updateLyricsProgress(currentTime) {
    if (!activeLyrics || activeLyrics.length === 0) return;
    if (activeLyrics[0].time === null) return; // Plain lyrics without timing

    // High-precision active index detection with 80ms lookahead
    const threshold = currentTime + 0.08;
    let currIdx = -1;

    for (let i = 0; i < activeLyrics.length; i++) {
        if (activeLyrics[i].time <= threshold) {
            currIdx = i;
        } else {
            break;
        }
    }

    if (currIdx !== activeLyricsIndex) {
        activeLyricsIndex = currIdx;
        const container = document.getElementById('lyrics-lines-container');
        const allLineEls = document.querySelectorAll('.lyrics-line');

        allLineEls.forEach((el, idx) => {
            const isActive = idx === currIdx;
            const isPassed = idx < currIdx;
            el.classList.toggle('active', isActive);
            el.classList.toggle('passed', isPassed);
        });

        if (container && currIdx >= 0 && allLineEls[currIdx] && !userIsScrollingLyrics) {
            const lineEl = allLineEls[currIdx];
            const targetScroll = lineEl.offsetTop - (container.clientHeight / 2) + (lineEl.offsetHeight / 2);
            container.scrollTo({
                top: Math.max(0, targetScroll),
                behavior: 'smooth'
            });
        }
    }
}

// ==========================================================================
// FULLSCREEN PLAYER OVERLAY
// ==========================================================================

btnFullscreen.addEventListener('click', toggleFullscreenPlayer);
document.getElementById('btn-close-fullscreen').addEventListener('click', () => {
    document.getElementById('view-fullscreen-player').classList.remove('open');
});

function toggleFullscreenPlayer() {
    const overlay = document.getElementById('view-fullscreen-player');
    overlay.classList.toggle('open');
    const currentTrack = currentQueue[currentIndex];
    if (overlay.classList.contains('open') && currentTrack) {
        syncFullscreenPlayer(currentTrack);
        initAudioContext();
    }
}

function syncFullscreenPlayer(track) {
    if (!track) return;
    registerTrack(track);
    const coverSrc = getTrackCover(track);
    document.getElementById('fs-cover').src = coverSrc;
    document.getElementById('fs-backdrop').style.backgroundImage = `url("${coverSrc}")`;
    document.getElementById('fs-title').innerText = track.title;
    document.getElementById('fs-artist').innerText = track.artist;
    document.getElementById('fs-album').innerText = track.album || '';
}

document.getElementById('btn-fs-play').addEventListener('click', togglePlay);
document.getElementById('btn-fs-prev').addEventListener('click', playPrevTrack);
document.getElementById('btn-fs-next').addEventListener('click', playNextTrack);
document.getElementById('btn-fs-shuffle').addEventListener('click', () => btnShuffle.click());
document.getElementById('btn-fs-repeat').addEventListener('click', () => btnRepeat.click());
document.getElementById('fs-progress-slider').addEventListener('input', (e) => {
    audio.currentTime = e.target.value;
});

// ==========================================================================
// CUSTOM CONTEXT MENU (RIGHT CLICK)
// ==========================================================================

const ctxMenu = document.getElementById('custom-context-menu');

document.addEventListener('contextmenu', async (e) => {
    const el = e.target.closest('[data-track-id], .track-row, .sp-song-row, .queue-item, .pl-search-item, .spotify-card, .sp-grid-card, .sp-top-result-card, .sp-album-card');

    let trackId = null;
    if (el) {
        trackId = el.dataset.trackId || el.id?.replace(/^sp-(?:row|card|btn-play-top)-/, '');
    }

    if (!trackId) {
        ctxMenu.style.display = 'none';
        return;
    }

    selectedContextTrack = findTrack(trackId);
    if (!selectedContextTrack) {
        ctxMenu.style.display = 'none';
        return;
    }

    e.preventDefault();

    // Position menu
    let x = e.clientX;
    let y = e.clientY;
    ctxMenu.style.display = 'block';
    
    // Bounds check
    const menuWidth = 230;
    const menuHeight = 340;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;

    // Update favorite label
    document.getElementById('ctx-fav-label').innerText = selectedContextTrack.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Seus Favoritos';

    // Show/hide download vs local file items
    const dlItem = document.getElementById('ctx-download-track');
    const openFileItem = document.getElementById('ctx-open-file');
    const editTagsItem = document.getElementById('ctx-edit-tags');

    const isLocal = !!selectedContextTrack.file_path;
    if (dlItem) dlItem.style.display = isLocal ? 'none' : 'flex';
    if (openFileItem) openFileItem.style.display = isLocal ? 'flex' : 'none';
    if (editTagsItem) editTagsItem.style.display = isLocal ? 'flex' : 'none';

    // Show/hide remove from playlist option
    const removePlItem = document.getElementById('ctx-remove-from-pl');
    if (currentOpenPlaylistId) {
        removePlItem.style.display = 'flex';
    } else {
        removePlItem.style.display = 'none';
    }

    // Populate playlists submenu
    const subContainer = document.getElementById('ctx-playlists-submenu');
    subContainer.innerHTML = '';
    const playlists = (await window.api.getPlaylists()) || [];

    const newPlOption = document.createElement('div');
    newPlOption.className = 'ctx-item';
    newPlOption.innerHTML = `<span>+ Nova Playlist...</span>`;
    newPlOption.addEventListener('click', () => {
        ctxMenu.style.display = 'none';
        openCreatePlaylistModal(selectedContextTrack ? selectedContextTrack.id : null);
    });
    subContainer.appendChild(newPlOption);

    playlists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'ctx-item';
        item.innerHTML = `<span>${escapeHtml(pl.name)}</span>`;
        item.addEventListener('click', async () => {
            ctxMenu.style.display = 'none';
            if (selectedContextTrack) {
                await window.api.addToPlaylist(pl.id, selectedContextTrack);
                showToast(`Adicionado à playlist "${pl.name}"`);
                renderSidebarList('playlists');
                if (currentOpenPlaylistId === pl.id) {
                    const updatedTracks = (await window.api.getPlaylistTracks(pl.id)) || [];
                    renderTrackTable(updatedTracks);
                    document.getElementById('pl-count').innerText = `${updatedTracks.length} músicas`;
                }
            }
        });
        subContainer.appendChild(item);
    });
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#custom-context-menu')) {
        ctxMenu.style.display = 'none';
    }
});

// Context Menu Actions
document.getElementById('ctx-play-now').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack) playTrack(selectedContextTrack);
});

document.getElementById('ctx-play-next').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack) playNextUserQueue(selectedContextTrack);
});

document.getElementById('ctx-add-queue').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack) addToUserQueue(selectedContextTrack);
});

document.getElementById('ctx-toggle-fav').addEventListener('click', async () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack) {
        await toggleFavoriteTrack(selectedContextTrack);
        if (currentOpenPlaylistIsFavorites) {
            refreshFavoritesView();
        }
    }
});

document.getElementById('ctx-go-artist').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack && selectedContextTrack.artist) {
        openArtistView(selectedContextTrack.artist);
    }
});

document.getElementById('ctx-go-album').addEventListener('click', async () => {
    ctxMenu.style.display = 'none';
    if (!selectedContextTrack || !selectedContextTrack.album) return;
    if (selectedContextTrack.albumId) {
        openOnlineAlbumView({ id: selectedContextTrack.albumId, title: selectedContextTrack.album, artist: selectedContextTrack.artist });
    } else if (allTracksCache && allTracksCache.some(t => t.album === selectedContextTrack.album && t.file_path)) {
        const albTracks = allTracksCache.filter(t => t.album === selectedContextTrack.album);
        openPlaylistDetailView({
            title: selectedContextTrack.album,
            type: 'Álbum',
            desc: `${selectedContextTrack.artist} • ${albTracks.length} músicas`,
            cover: selectedContextTrack.cover_path,
            tracks: albTracks
        });
    } else {
        showToast(`Buscando álbum: ${selectedContextTrack.album}...`);
        try {
            const albQuery = `${selectedContextTrack.artist || ''} ${selectedContextTrack.album}`.trim();
            const albs = await window.api.searchOnlineAlbums(albQuery);
            if (albs && albs.length > 0) {
                openOnlineAlbumView(albs[0]);
            } else {
                openOnlineSearchView(selectedContextTrack.album);
            }
        } catch(e) {
            openOnlineSearchView(selectedContextTrack.album);
        }
    }
});

document.getElementById('ctx-download-track')?.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack) {
        startSpotifyDownload(selectedContextTrack);
    }
});

document.getElementById('ctx-open-file')?.addEventListener('click', async () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack && selectedContextTrack.file_path) {
        await window.api.openFileLocation(selectedContextTrack.file_path);
    }
});

document.getElementById('ctx-remove-from-pl')?.addEventListener('click', async () => {
    ctxMenu.style.display = 'none';
    if (selectedContextTrack && currentOpenPlaylistId) {
        await window.api.removeFromPlaylist(currentOpenPlaylistId, selectedContextTrack.id);
        showToast("Faixa removida da playlist");
        const updatedTracks = (await window.api.getPlaylistTracks(currentOpenPlaylistId)) || [];
        renderTrackTable(updatedTracks);
        document.getElementById('pl-count').innerText = `${updatedTracks.length} músicas`;
        renderSidebarList('playlists');
    }
});

// ==========================================================================
// SETTINGS (100% ONLINE STREAMING)
// ==========================================================================

async function loadSettings() {
    const crossVal = document.getElementById('crossfade-val');
    const crossSlider = document.getElementById('crossfade-slider');
    if (crossSlider) crossSlider.value = crossfadeDuration;
    if (crossVal) crossVal.innerText = `${crossfadeDuration}s`;
}

document.getElementById('crossfade-slider')?.addEventListener('input', (e) => {
    crossfadeDuration = parseInt(e.target.value, 10);
    localStorage.setItem('spotcry_crossfade', crossfadeDuration);
    const crossVal = document.getElementById('crossfade-val');
    if (crossVal) crossVal.innerText = `${crossfadeDuration}s`;
});

let libUpdateTimer = null;
window.api.onLibraryUpdated(() => {
    if (libUpdateTimer) clearTimeout(libUpdateTimer);
    libUpdateTimer = setTimeout(() => {
        loadHomeView();
    }, 500);
});

// ==========================================================================
// EQUALIZER & AUDIO CONTEXT & SPECTRUM VISUALIZER
// ==========================================================================

let audioAnalyser = null;

function initAudioContext() {
    if (!audioCtx) {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();

            audioSource = audioCtx.createMediaElementSource(audio);

            eqFilters = EQ_FREQUENCIES.map((freq, i) => {
                const filter = audioCtx.createBiquadFilter();
                if (i === 0) filter.type = 'lowshelf';
                else if (i === EQ_FREQUENCIES.length - 1) filter.type = 'highshelf';
                else filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.gain.value = 0;
                return filter;
            });

            audioAnalyser = audioCtx.createAnalyser();
            audioAnalyser.fftSize = 128;
            audioAnalyser.smoothingTimeConstant = 0.82;

            let prevNode = audioSource;
            eqFilters.forEach(f => {
                prevNode.connect(f);
                prevNode = f;
            });
            prevNode.connect(audioAnalyser);
            audioAnalyser.connect(audioCtx.destination);

            const savedPreset = localStorage.getItem('spotcry_eq_preset') || 'flat';
            applyEqPreset(savedPreset);
        } catch(e) {
            console.warn('AudioContext init error:', e);
        }
    }
}

function applyEqPreset(presetName) {
    const gains = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
    gains.forEach((gain, i) => {
        if (eqFilters[i]) eqFilters[i].gain.value = gain;
        const slider = document.getElementById(`eq-band-${i}`);
        const valLabel = document.getElementById(`eq-val-${i}`);
        if (slider) slider.value = gain;
        if (valLabel) valLabel.innerText = `${gain > 0 ? '+' : ''}${gain} dB`;
    });
    document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.eq === presetName);
    });
    localStorage.setItem('spotcry_eq_preset', presetName);
}

EQ_FREQUENCIES.forEach((freq, i) => {
    const slider = document.getElementById(`eq-band-${i}`);
    if (slider) {
        slider.addEventListener('input', (e) => {
            initAudioContext();
            const val = parseFloat(e.target.value);
            if (eqFilters[i]) eqFilters[i].gain.value = val;
            const valLabel = document.getElementById(`eq-val-${i}`);
            if (valLabel) valLabel.innerText = `${val > 0 ? '+' : ''}${val} dB`;
            document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(c => c.classList.remove('active'));
        });
    }
});

document.querySelectorAll('.eq-presets-bar .pill-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        initAudioContext();
        applyEqPreset(chip.dataset.eq);
    });
});

btnEqualizer.addEventListener('click', () => {
    initAudioContext();
    document.getElementById('equalizer-modal').classList.add('open');
});

document.getElementById('btn-close-eq')?.addEventListener('click', () => {
    document.getElementById('equalizer-modal').classList.remove('open');
});

document.getElementById('btn-done-eq')?.addEventListener('click', () => {
    document.getElementById('equalizer-modal').classList.remove('open');
    showToast("Ajustes do equalizador salvos!");
});

document.getElementById('btn-reset-eq')?.addEventListener('click', () => {
    initAudioContext();
    applyEqPreset('flat');
    showToast("Equalizador restaurado");
});



// ==========================================================================
// SLEEP TIMER (TEMPORIZADOR DE SONO)
// ==========================================================================

let sleepTimerId = null;
let sleepTimerMode = 0;

const btnSleepTimer = document.getElementById('btn-sleep-timer');
const sleepTimerMenu = document.getElementById('sleep-timer-menu');
const sleepTimerBadge = document.getElementById('sleep-timer-status');

if (btnSleepTimer) {
    btnSleepTimer.addEventListener('click', (e) => {
        e.stopPropagation();
        sleepTimerMenu.classList.toggle('show');
    });
}

document.addEventListener('click', (e) => {
    if (sleepTimerMenu && !e.target.closest('#sleep-timer-menu') && !e.target.closest('#btn-sleep-timer')) {
        sleepTimerMenu.classList.remove('show');
    }
});

document.querySelectorAll('.sleep-timer-item').forEach(item => {
    item.addEventListener('click', () => {
        const val = item.dataset.timer;
        setSleepTimer(val);
        if (sleepTimerMenu) sleepTimerMenu.classList.remove('show');
    });
});

function setSleepTimer(val) {
    if (sleepTimerId) {
        clearTimeout(sleepTimerId);
        sleepTimerId = null;
    }

    document.querySelectorAll('.sleep-timer-item').forEach(i => i.classList.remove('active'));

    if (val === '0' || val === 0) {
        sleepTimerMode = 0;
        if (btnSleepTimer) btnSleepTimer.classList.remove('active');
        if (sleepTimerBadge) sleepTimerBadge.style.display = 'none';
        showToast("Temporizador de sono cancelado");
        return;
    }

    const activeItem = document.querySelector(`.sleep-timer-item[data-timer="${val}"]`);
    if (activeItem) activeItem.classList.add('active');
    if (btnSleepTimer) btnSleepTimer.classList.add('active');
    if (sleepTimerBadge) sleepTimerBadge.style.display = 'inline-block';

    if (val === 'end_of_track') {
        sleepTimerMode = 'end_of_track';
        showToast("A música pausará ao final desta faixa 🌙");
        return;
    }

    const minutes = parseInt(val, 10);
    sleepTimerMode = minutes;
    showToast(`Música pausará em ${minutes} minutos 🌙`);

    sleepTimerId = setTimeout(() => {
        triggerSleepTimerFade();
    }, minutes * 60 * 1000);
}

function triggerSleepTimerFade() {
    const initialVol = audio.volume;
    let fadeSteps = 15;
    let currentStep = 0;
    const interval = setInterval(() => {
        currentStep++;
        const newVol = initialVol * (1 - (currentStep / fadeSteps));
        audio.volume = Math.max(0, newVol);
        if (currentStep >= fadeSteps) {
            clearInterval(interval);
            audio.pause();
            audio.volume = initialVol;
            setSleepTimer('0');
            showToast("Temporizador de sono concluído. Boa noite! 🌙");
        }
    }, 200);
}

// ==========================================================================
// DRAG & DROP MUSIC IMPORT
// ==========================================================================

const dropOverlay = document.getElementById('drag-drop-overlay');
let dragCounter = 0;

if (dropOverlay) {
    window.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragCounter++;
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
            dropOverlay.classList.add('active');
        }
    });

    window.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
            dragCounter = 0;
            dropOverlay.classList.remove('active');
        }
    });

    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', async (e) => {
        e.preventDefault();
        dragCounter = 0;
        dropOverlay.classList.remove('active');

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) return;

        const filePaths = [];
        for (let i = 0; i < files.length; i++) {
            if (files[i].path) filePaths.push(files[i].path);
        }

        if (filePaths.length > 0) {
            showToast(`Importando ${filePaths.length} arquivo(s)...`);
            try {
                const res = await window.api.handleDroppedFiles(filePaths);
                if (res && res.added > 0) {
                    showToast(`Sucesso! ${res.added} música(s) adicionada(s)! 🎵`);
                    await loadHomeView();
                } else {
                    showToast("Arquivos já existem ou formato não suportado.");
                }
            } catch(err) {
                console.error('Drop error:', err);
                showToast("Erro ao importar arquivos.");
            }
        }
    });
}

// ==========================================================================
// ID3 TAG EDITOR
// ==========================================================================

document.getElementById('ctx-edit-tags')?.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (!selectedContextTrack) return;

    document.getElementById('edit-tag-title').value = selectedContextTrack.title || '';
    document.getElementById('edit-tag-artist').value = selectedContextTrack.artist || '';
    document.getElementById('edit-tag-album').value = selectedContextTrack.album || '';
    document.getElementById('edit-tag-genre').value = selectedContextTrack.genre || '';
    document.getElementById('edit-tag-year').value = selectedContextTrack.year || '';
    document.getElementById('edit-tag-trackno').value = selectedContextTrack.track_number || '';

    document.getElementById('edit-tags-modal').classList.add('open');
});

document.getElementById('btn-close-edit-tags')?.addEventListener('click', () => {
    document.getElementById('edit-tags-modal').classList.remove('open');
});
document.getElementById('btn-cancel-edit-tags')?.addEventListener('click', () => {
    document.getElementById('edit-tags-modal').classList.remove('open');
});

document.getElementById('btn-save-edit-tags')?.addEventListener('click', async () => {
    if (!selectedContextTrack) return;
    const newTags = {
        title: document.getElementById('edit-tag-title').value.trim() || selectedContextTrack.title,
        artist: document.getElementById('edit-tag-artist').value.trim() || selectedContextTrack.artist,
        album: document.getElementById('edit-tag-album').value.trim() || selectedContextTrack.album,
        genre: document.getElementById('edit-tag-genre').value.trim() || selectedContextTrack.genre,
        year: parseInt(document.getElementById('edit-tag-year').value, 10) || 0,
        track_number: parseInt(document.getElementById('edit-tag-trackno').value, 10) || 0
    };

    try {
        const res = await window.api.updateTrackTags(selectedContextTrack.id, newTags);
        document.getElementById('edit-tags-modal').classList.remove('open');
        if (res && res.success) {
            showToast("Informações salvas com sucesso! 🏷️");
            if (currentQueue[currentIndex] && currentQueue[currentIndex].id === selectedContextTrack.id) {
                lblTitle.innerText = newTags.title;
                lblArtist.innerText = newTags.artist;
                currentQueue[currentIndex].title = newTags.title;
                currentQueue[currentIndex].artist = newTags.artist;
                currentQueue[currentIndex].album = newTags.album;
                currentQueue[currentIndex].genre = newTags.genre;
            }
            await loadHomeView();
        } else {
            showToast("Erro ao gravar tags.");
        }
    } catch(err) {
        console.error('Save tags error:', err);
        showToast("Erro ao atualizar tags.");
    }
});

// ==========================================================================
// DESKTOP SYSTEM TRAY & GLOBAL MEDIA KEYS
// ==========================================================================

const trayCheckbox = document.getElementById('sett-tray-checkbox');
if (trayCheckbox) {
    window.api.getSettings().then(sett => {
        trayCheckbox.checked = sett.minimizeToTray !== false;
    });
    trayCheckbox.addEventListener('change', async (e) => {
        await window.api.updateSettings({ minimizeToTray: e.target.checked });
        showToast(e.target.checked ? "Minimizar para bandeja ativado" : "Minimizar para bandeja desativado");
    });
}

if (window.api.onMediaKeyPlayPause) {
    window.api.onMediaKeyPlayPause(() => togglePlay());
}
if (window.api.onMediaKeyNext) {
    window.api.onMediaKeyNext(() => playNextTrack());
}
if (window.api.onMediaKeyPrev) {
    window.api.onMediaKeyPrev(() => playPrevTrack());
}
if (window.api.onMediaKeyStop) {
    window.api.onMediaKeyStop(() => {
        if (!audio.paused) togglePlay();
    });
}

// ==========================================================================
// SPOTCRY CONNECT (MOBILE PHONE LINK & REMOTE CONTROL)
// ==========================================================================

const btnConnectPhone = document.getElementById('btn-connect-phone');
const modalConnectPhone = document.getElementById('connect-phone-modal');
const btnCloseConnectModal = document.getElementById('btn-close-connect-modal');
const connectUrlInput = document.getElementById('connect-url-input');
const btnCopyConnectUrl = document.getElementById('btn-copy-connect-url');
const connectQrImg = document.getElementById('connect-qr-img');
const connectQrLoading = document.getElementById('connect-qr-loading');

async function openConnectPhoneModal() {
    if (!modalConnectPhone) return;
    modalConnectPhone.classList.add('open');
    if (connectQrLoading) connectQrLoading.style.display = 'block';
    if (connectQrImg) connectQrImg.style.display = 'none';

    try {
        let info = null;
        if (window.api && typeof window.api.getMobileServerInfo === 'function') {
            info = await window.api.getMobileServerInfo();
        } else {
            const res = await fetch('http://127.0.0.1:3000/api/info');
            if (res.ok) {
                const data = await res.json();
                info = {
                    ip: data.ip,
                    port: data.port,
                    url: `http://${data.ip}:${data.port}`
                };
            }
        }

        if (info && info.url) {
            if (connectUrlInput) connectUrlInput.value = info.url;
            if (info.qrDataUrl && connectQrImg) {
                connectQrImg.src = info.qrDataUrl;
                connectQrImg.style.display = 'block';
                if (connectQrLoading) connectQrLoading.style.display = 'none';
            } else if (connectQrImg) {
                const fallbackQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(info.url)}`;
                connectQrImg.src = fallbackQr;
                connectQrImg.onload = () => {
                    connectQrImg.style.display = 'block';
                    if (connectQrLoading) connectQrLoading.style.display = 'none';
                };
            }
        }
    } catch (e) {
        console.error('Erro ao obter info do servidor móvel:', e);
        if (connectUrlInput) connectUrlInput.value = 'http://192.168.1.2:3000';
    }
}

if (btnConnectPhone) {
    btnConnectPhone.addEventListener('click', openConnectPhoneModal);
}

if (btnCloseConnectModal) {
    btnCloseConnectModal.addEventListener('click', () => {
        if (modalConnectPhone) modalConnectPhone.classList.remove('open');
    });
}

if (modalConnectPhone) {
    modalConnectPhone.addEventListener('click', (e) => {
        if (e.target === modalConnectPhone) {
            modalConnectPhone.classList.remove('open');
        }
    });
}

if (btnCopyConnectUrl) {
    btnCopyConnectUrl.addEventListener('click', () => {
        if (connectUrlInput && connectUrlInput.value && connectUrlInput.value.startsWith('http')) {
            navigator.clipboard.writeText(connectUrlInput.value);
            showToast("Link copiado para a área de transferência! 📋");
        }
    });
}

// Remote control command listener from mobile phone
if (window.api.onRemoteControlCommand) {
    window.api.onRemoteControlCommand((data) => {
        if (!data) return;
        if (data.action === 'playPause') {
            togglePlay();
        } else if (data.action === 'play') {
            if (audio.paused) togglePlay();
        } else if (data.action === 'pause') {
            if (!audio.paused) togglePlay();
        } else if (data.action === 'next') {
            playNextTrack();
        } else if (data.action === 'prev') {
            playPrevTrack();
        } else if (data.action === 'playTrack' && data.trackId) {
            playTrackById(data.trackId);
        } else if (data.action === 'seek' && typeof data.time === 'number') {
            audio.currentTime = data.time;
        } else if (data.action === 'volume' && typeof data.volume === 'number') {
            audio.volume = Math.max(0, Math.min(1, data.volume));
            if (volumeSlider) volumeSlider.value = Math.round(audio.volume * 100);
        }
    });
}

async function playTrackById(id) {
    if (!allTracksCache || allTracksCache.length === 0) {
        allTracksCache = (await window.api.getTracks()) || [];
    }
    const track = allTracksCache.find(t => t.id == id);
    if (track) {
        playTrack(track, allTracksCache);
    }
}

// ==========================================================================
// SHORTCUTS (ENHANCED)
// ==========================================================================

window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
    } else if (e.code === 'KeyM') {
        btnMute.click();
    } else if (e.code === 'KeyL') {
        btnLyrics.click();
    } else if (e.code === 'KeyQ') {
        toggleQueueDrawer();
    } else if (e.code === 'KeyE') {
        btnEqualizer.click();
    } else if (e.code === 'KeyF' || e.code === 'F11') {
        e.preventDefault();
        toggleFullscreenPlayer();
    } else if (e.code === 'Escape') {
        document.getElementById('view-fullscreen-player').classList.remove('open');
        document.getElementById('equalizer-modal').classList.remove('open');
        document.getElementById('queue-drawer').classList.remove('open');
        document.getElementById('playlist-modal').classList.remove('open');
        document.getElementById('delete-playlist-modal').classList.remove('open');
        document.getElementById('add-to-playlist-modal')?.classList.remove('open');
        document.getElementById('edit-tags-modal')?.classList.remove('open');
        document.getElementById('connect-phone-modal')?.classList.remove('open');
        if (sleepTimerMenu) sleepTimerMenu.classList.remove('show');
    } else if (e.code === 'ArrowRight' && (e.ctrlKey || e.metaKey)) {
        playNextTrack();
    } else if (e.code === 'ArrowLeft' && (e.ctrlKey || e.metaKey)) {
        playPrevTrack();
    } else if (e.code === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
        audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        audio.volume = Math.min(1, audio.volume + 0.05);
        volumeSlider.value = Math.round(audio.volume * 100);
        showToast(`Volume: ${Math.round(audio.volume * 100)}%`);
    } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        audio.volume = Math.max(0, audio.volume - 0.05);
        volumeSlider.value = Math.round(audio.volume * 100);
        showToast(`Volume: ${Math.round(audio.volume * 100)}%`);
    }
});

// ==========================================================================
// SPOTIFY SEARCH ENGINE LOGIC & BROWSE TILES
// ==========================================================================

const SPOTIFY_CATEGORIES = [
    { title: 'Podcasts', color: '#006450', img: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=200&auto=format&fit=crop&q=60', query: 'Podcasts Mais Ouvidos' },
    { title: 'Feito para você', color: '#1e3264', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=60', query: 'Top Hits 2026' },
    { title: 'Paradas', color: '#8d67ab', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=60', query: 'Top 50 Brasil' },
    { title: 'Novos lançamentos', color: '#e8115b', img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=60', query: 'Lançamentos 2026' },
    { title: 'Pop', color: '#148a08', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=60', query: 'Pop Internacional' },
    { title: 'Sertanejo', color: '#bc5900', img: 'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=200&auto=format&fit=crop&q=60', query: 'Sertanejo Mais Tocadas' },
    { title: 'Funk', color: '#e91429', img: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&auto=format&fit=crop&q=60', query: 'Funk Brasil' },
    { title: 'Hip-Hop & Trap', color: '#ba5d07', img: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&auto=format&fit=crop&q=60', query: 'Trap Brasil' },
    { title: 'Rock', color: '#e91429', img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=200&auto=format&fit=crop&q=60', query: 'Rock Clássico' },
    { title: 'Eletrônica / Dance', color: '#0d73ec', img: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200&auto=format&fit=crop&q=60', query: 'Eletrônica EDM' },
    { title: 'Indie', color: '#608108', img: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=200&auto=format&fit=crop&q=60', query: 'Indie Brasil' },
    { title: 'Relax & Lo-Fi', color: '#477d95', img: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=200&auto=format&fit=crop&q=60', query: 'Lo-Fi Hip Hop Beats' },
    { title: 'Dormir', color: '#1e3264', img: 'https://images.unsplash.com/photo-1511295742362-92c96b124e52?w=200&auto=format&fit=crop&q=60', query: 'Músicas Relaxantes para Dormir' },
    { title: 'Treino', color: '#777777', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&auto=format&fit=crop&q=60', query: 'Workout Motivation Music' },
    { title: 'Gospel', color: '#0d73ec', img: 'https://images.unsplash.com/photo-1445445290350-18a3b86e0b5b?w=200&auto=format&fit=crop&q=60', query: 'Gospel Mais Tocadas' },
    { title: 'MPB', color: '#e8115b', img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=60', query: 'MPB Clássicos' }
];

let activeOnlineTracks = [];
let currentOnlinePlayingId = null;
let browseCategoriesRendered = false;

async function updateOnlineFolderDisplay() {
    try {
        const folder = await window.api.getDownloadFolder();
        const f1 = document.getElementById('online-folder-path');
        const f2 = document.getElementById('online-folder-path-browse');
        if (folder) {
            if (f1) f1.textContent = folder;
            if (f2) f2.textContent = folder;
        }
    } catch (e) {
        console.warn('Could not get download folder:', e);
    }
}

function renderSpotifyBrowseCategories() {
    const grid = document.getElementById('sp-browse-categories-grid');
    if (!grid) return;
    grid.innerHTML = '';

    SPOTIFY_CATEGORIES.forEach(cat => {
        const tile = document.createElement('div');
        tile.className = 'sp-category-tile';
        tile.style.backgroundColor = cat.color;
        tile.innerHTML = `
            <div class="sp-category-title">${escapeHtml(cat.title)}</div>
            <img class="sp-category-img" src="${cat.img}" alt="${escapeHtml(cat.title)}" loading="lazy">
        `;
        tile.addEventListener('click', () => {
            const topSearch = document.getElementById('global-search-input');
            if (topSearch) topSearch.value = cat.query;
            performSpotifySearch(cat.query);
        });
        grid.appendChild(tile);
    });
    browseCategoriesRendered = true;
}

let currentSearchSeq = 0;

async function openOnlineSearchView(searchQuery = '') {
    showView('view-online-search');
    updateOnlineFolderDisplay();

    // Sync pill bar active state
    document.querySelectorAll('.main-pill-btn').forEach(b => b.classList.remove('active'));
    const onlinePill = document.getElementById('btn-pill-online-music');
    if (onlinePill) onlinePill.classList.add('active');

    if (!browseCategoriesRendered) {
        renderSpotifyBrowseCategories();
    }

    const trimmed = (searchQuery || '').trim();
    const topSearch = document.getElementById('global-search-input');
    if (topSearch && topSearch.value !== searchQuery && document.activeElement !== topSearch) {
        topSearch.value = searchQuery;
    }

    if (trimmed) {
        performSpotifySearch(trimmed);
    } else {
        // Show browse all section (empty search state)
        const browseSection = document.getElementById('sp-search-browse-section');
        const resultsSection = document.getElementById('sp-search-results-section');
        const pillsBar = document.getElementById('sp-search-pills-bar');
        const loadingSpinner = document.getElementById('online-search-loading');
        if (browseSection) browseSection.style.display = 'block';
        if (resultsSection) resultsSection.style.display = 'none';
        if (pillsBar) pillsBar.style.display = 'none';
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}
window.openOnlineSearchView = openOnlineSearchView;

let activeOnlineArtists = [];
let activeOnlineAlbums = [];
let activeLocalTracks = [];

async function performSpotifySearch(query) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
        document.getElementById('sp-search-browse-section').style.display = 'block';
        document.getElementById('sp-search-results-section').style.display = 'none';
        document.getElementById('sp-search-pills-bar').style.display = 'none';
        return;
    }

    const thisSeq = ++currentSearchSeq;

    const browseSection = document.getElementById('sp-search-browse-section');
    const resultsSection = document.getElementById('sp-search-results-section');
    const pillsBar = document.getElementById('sp-search-pills-bar');
    const loadingSpinner = document.getElementById('online-search-loading');
    const noResultsEl = document.getElementById('sp-search-no-results');
    const topSplit = document.getElementById('sp-search-top-split');
    const artistsWrap = document.getElementById('sp-artists-wrap');
    const albumsWrap = document.getElementById('sp-albums-wrap');
    const localWrap = document.getElementById('sp-local-wrap');
    const moreWrap = document.getElementById('sp-more-results-wrap');

    if (browseSection) browseSection.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    if (pillsBar) pillsBar.style.display = 'flex';
    if (loadingSpinner) loadingSpinner.style.display = 'flex';
    if (noResultsEl) noResultsEl.style.display = 'none';
    if (topSplit) topSplit.style.display = 'none';
    if (artistsWrap) artistsWrap.style.display = 'none';
    if (albumsWrap) albumsWrap.style.display = 'none';
    if (localWrap) localWrap.style.display = 'none';
    if (moreWrap) moreWrap.style.display = 'none';

    try {
        const pTracks = window.api.searchOnlineMusic(trimmed).catch(() => []);
        const pArtists = window.api.searchOnlineArtists(trimmed).catch(() => []);
        const pAlbums = window.api.searchOnlineAlbums(trimmed).catch(() => []);

        // Instant progressive rendering: show tracks as soon as Deezer responds!
        pTracks.then(t => {
            if (thisSeq !== currentSearchSeq) return;
            if (t && t.length > 0) {
                activeOnlineTracks = t;
                if (loadingSpinner) loadingSpinner.style.display = 'none';
                renderSpotifyResults(trimmed, activeOnlineTracks, activeOnlineArtists, activeOnlineAlbums);
            }
        });

        const [tracks, artists, albums] = await Promise.all([pTracks, pArtists, pAlbums]);

        // Discard outdated race responses
        if (thisSeq !== currentSearchSeq) {
            return;
        }

        activeOnlineTracks = tracks || [];
        activeOnlineArtists = artists || [];
        activeOnlineAlbums = albums || [];

        if (loadingSpinner) loadingSpinner.style.display = 'none';

        const totalResults = activeOnlineTracks.length + activeOnlineArtists.length + activeOnlineAlbums.length;
        if (totalResults === 0) {
            if (noResultsEl) {
                noResultsEl.style.display = 'block';
                const noResTitle = document.getElementById('sp-no-results-title');
                if (noResTitle) noResTitle.innerText = `Nenhum resultado encontrado para "${trimmed}"`;
            }
            return;
        }

        if (noResultsEl) noResultsEl.style.display = 'none';

        renderSpotifyResults(trimmed, activeOnlineTracks, activeOnlineArtists, activeOnlineAlbums);
    } catch (err) {
        if (thisSeq !== currentSearchSeq) return;
        console.error('Error in Spotify Search:', err);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        showToast('Erro ao carregar resultados de busca');
    }
}

function renderSpotifyResults(query, tracks, artists, albums, localTracks) {
    const topSplit = document.getElementById('sp-search-top-split');
    const artistsWrap = document.getElementById('sp-artists-wrap');
    const albumsWrap = document.getElementById('sp-albums-wrap');
    const localWrap = document.getElementById('sp-local-wrap');
    const moreWrap = document.getElementById('sp-more-results-wrap');

    // 1. TOP RESULT CARD (MELHOR RESULTADO)
    const qLower = (query || '').trim().toLowerCase();
    const exactArtist = artists && artists.find(a => (a.name || '').toLowerCase() === qLower);
    const dominantArtist = exactArtist || (artists && artists.length > 0 && (qLower.length >= 3 && (artists[0].name || '').toLowerCase().includes(qLower) || tracks.length === 0) ? artists[0] : null);

    const topCardEl = document.getElementById('sp-top-result-card');
    if (topCardEl) {
        if (dominantArtist) {
            // Artist is Top Result
            const artistPic = dominantArtist.picture_big || dominantArtist.picture_xl || dominantArtist.picture_medium;
            const fanFormatted = dominantArtist.nb_fan > 0 ? `${Number(dominantArtist.nb_fan).toLocaleString('pt-BR')} ouvintes` : 'Artista';

            topCardEl.innerHTML = `
                <img class="sp-top-result-img" src="${artistPic}" alt="${escapeHtml(dominantArtist.name)}" style="border-radius: 50%; box-shadow: 0 8px 24px rgba(0,0,0,0.6);">
                <h3 class="sp-top-result-title" title="${escapeHtml(dominantArtist.name)}">${escapeHtml(dominantArtist.name)}</h3>
                <div class="sp-top-result-meta">
                    <span class="sp-top-badge" style="background: rgba(255,255,255,0.15); border-radius: 12px; padding: 3px 10px; font-weight: 700;">Artista</span>
                    <span>${fanFormatted}</span>
                </div>
                <button class="sp-floating-play-btn" id="sp-btn-play-top-art" title="Ver perfil de ${escapeHtml(dominantArtist.name)}">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
            `;

            topCardEl.onclick = () => {
                openArtistView(dominantArtist.name);
            };
        } else if (tracks && tracks.length > 0) {
            // Track is Top Result
            const topTrack = tracks[0];
            registerTrack(topTrack);
            const isPlayingTop = (currentOnlinePlayingId === topTrack.id && !audio.paused);
            topCardEl.dataset.trackId = topTrack.id;
            
            const heartSvg = topTrack.is_favorite
                ? `<svg role="img" height="18" width="18" viewBox="0 0 16 16"><path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z" fill="#1ED760"></path></svg>`
                : `<svg role="img" height="18" width="18" viewBox="0 0 16 16"><path d="M1.626 3.161a2.766 2.766 0 0 1 3.91 0l.464.465.465-.465a2.766 2.766 0 0 1 3.91 3.91l-4.375 4.375-4.374-4.375a2.766 2.766 0 0 1 0-3.91zM2.686 4.22a1.266 1.266 0 0 0 0 1.79l3.315 3.314 3.314-3.314a1.266 1.266 0 0 0-1.79-1.79l-1.524 1.524-1.524-1.524a1.266 1.266 0 0 0-1.791 0z" fill="currentColor"></path></svg>`;

            topCardEl.innerHTML = `
                <img class="sp-top-result-img" src="${getTrackCover(topTrack)}" alt="${escapeHtml(topTrack.title)}">
                <h3 class="sp-top-result-title" title="${escapeHtml(topTrack.title)}">${escapeHtml(topTrack.title)}</h3>
                <div class="sp-top-result-meta">
                    <span class="clickable" onclick="event.stopPropagation(); openArtistView('${escapeHtml(topTrack.artist).replace(/'/g, "\\'")}')" style="font-weight: 600;">${escapeHtml(topTrack.artist)}</span>
                    <span class="sp-top-badge">Música</span>
                    <button class="add-to-pl-btn" id="sp-add-pl-top-${topTrack.id}" title="Adicionar à Playlist">
                        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/></svg>
                    </button>
                    <button class="heart-btn ${topTrack.is_favorite ? 'active' : ''}" id="sp-heart-top-${topTrack.id}" title="${topTrack.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}">
                        ${heartSvg}
                    </button>
                    <button class="sp-btn-download-icon" id="sp-dl-top-${topTrack.id}" title="Baixar Música">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>
                    </button>
                </div>
                <button class="sp-floating-play-btn ${isPlayingTop ? 'playing' : ''}" id="sp-btn-play-top-${topTrack.id}" title="${isPlayingTop ? 'Pausar' : 'Tocar'}">
                    ${isPlayingTop
                        ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
                        : '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                    }
                </button>
            `;

            topCardEl.onclick = (e) => {
                if (e.target.closest('.sp-btn-download-icon') || e.target.closest('.add-to-pl-btn') || e.target.closest('.heart-btn')) return;
                playOnlineFullTrack(topTrack, tracks);
            };

            const addPlTopBtn = topCardEl.querySelector(`#sp-add-pl-top-${topTrack.id}`);
            if (addPlTopBtn) {
                addPlTopBtn.onclick = (e) => {
                    e.stopPropagation();
                    openAddToPlaylistPicker(topTrack);
                };
            }

            const heartTopBtn = topCardEl.querySelector(`#sp-heart-top-${topTrack.id}`);
            if (heartTopBtn) {
                heartTopBtn.onclick = async (e) => {
                    e.stopPropagation();
                    await toggleFavoriteTrack(topTrack);
                };
            }

            const dlTopBtn = topCardEl.querySelector(`#sp-dl-top-${topTrack.id}`);
            if (dlTopBtn) {
                dlTopBtn.onclick = (e) => {
                    e.stopPropagation();
                    startSpotifyDownload(topTrack, dlTopBtn);
                };
            }
        }
    }

    // 2. TOP SONGS LIST (MÚSICAS - 4 TRACK ROWS)
    const songsListEl = document.getElementById('sp-songs-list');
    if (songsListEl) {
        songsListEl.innerHTML = '';
        const listTracks = tracks.slice(dominantArtist ? 0 : 1, dominantArtist ? 4 : 5);

        listTracks.forEach(track => {
            registerTrack(track);
            const isPlayingThis = (currentOnlinePlayingId === track.id && !audio.paused);
            const row = document.createElement('div');
            row.className = 'sp-song-row';
            row.id = `sp-row-${track.id}`;
            row.dataset.trackId = track.id;

                const heartSvg = track.is_favorite ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;

                row.innerHTML = `
                    <div class="sp-song-thumb-wrap">
                        <img class="sp-song-thumb-img" src="${getTrackCover(track)}" alt="${escapeHtml(track.title)}" loading="lazy">
                        <button class="sp-song-row-play-btn ${isPlayingThis ? 'playing' : ''}" id="sp-play-row-${track.id}">
                            ${isPlayingThis
                                ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
                                : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                            }
                        </button>
                    </div>
                    <div class="sp-song-meta">
                        <div class="sp-song-title" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</div>
                        <div class="sp-song-artist clickable" onclick="event.stopPropagation(); openArtistView('${escapeHtml(track.artist).replace(/'/g, "\\'")}')" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</div>
                    </div>
                    <div class="sp-song-right-actions">
                        <button class="add-to-pl-btn" id="sp-add-pl-${track.id}" title="Adicionar à Playlist">
                            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/></svg>
                        </button>
                        <button class="heart-btn ${track.is_favorite ? 'active' : ''}" id="sp-heart-${track.id}" data-heart-track-id="${track.id}" title="${track.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}">
                            ${heartSvg}
                        </button>
                        <button class="sp-btn-download-icon" id="sp-dl-row-${track.id}" title="Baixar Música">
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>
                        </button>
                        <span class="sp-song-duration">${track.durationFormatted || track.duration || '3:30'}</span>
                    </div>
                `;

                row.onclick = (e) => {
                    if (e.target.closest('.sp-btn-download-icon') || e.target.closest('.add-to-pl-btn') || e.target.closest('.heart-btn') || e.target.closest('.sp-song-artist')) return;
                    playOnlineFullTrack(track, tracks);
                };

                const addPlBtn = row.querySelector(`#sp-add-pl-${track.id}`);
                if (addPlBtn) {
                    addPlBtn.onclick = (e) => {
                        e.stopPropagation();
                        openAddToPlaylistPicker(track);
                    };
                }

                const heartBtn = row.querySelector(`#sp-heart-${track.id}`);
                if (heartBtn) {
                    heartBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await toggleFavoriteTrack(track);
                    };
                }

                const dlBtn = row.querySelector(`#sp-dl-row-${track.id}`);
                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.stopPropagation();
                        startSpotifyDownload(track, dlBtn);
                    };
                }

                songsListEl.appendChild(row);
            });
        }

    if (topSplit) topSplit.style.display = 'grid';

    // 3. ARTISTS ROW / GRID (ARTISTAS)
    if (artistsWrap) {
        const artistsGrid = document.getElementById('sp-artists-grid');
        if (artists && artists.length > 0 && artistsGrid) {
            artistsWrap.style.display = 'block';
            artistsGrid.innerHTML = '';
            artists.forEach(art => {
                const card = document.createElement('div');
                card.className = 'sp-artist-card';
                const artImg = art.picture_big || art.picture_medium || art.picture_xl;
                card.innerHTML = `
                    <div class="sp-artist-art-wrap">
                        <img class="sp-artist-art-img" src="${artImg}" alt="${escapeHtml(art.name)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                        <button class="sp-card-play-btn" title="Ver ${escapeHtml(art.name)}">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                    </div>
                    <div class="sp-card-info">
                        <div class="sp-card-title" title="${escapeHtml(art.name)}">${escapeHtml(art.name)}</div>
                        <div class="sp-card-subtitle">Artista</div>
                    </div>
                `;
                card.onclick = () => openArtistView(art.name);
                artistsGrid.appendChild(card);
            });
        } else {
            artistsWrap.style.display = 'none';
        }
    }

    // 4. ALBUMS GRID (ÁLBUNS DAS BANDAS)
    if (albumsWrap) {
        const albumsGrid = document.getElementById('sp-albums-grid');
        if (albums && albums.length > 0 && albumsGrid) {
            albumsWrap.style.display = 'block';
            albumsGrid.innerHTML = '';
            albums.forEach(alb => {
                const card = document.createElement('div');
                card.className = 'sp-album-card';
                const coverSrc = alb.cover_big || alb.cover_medium || alb.cover_xl;
                const yearPrefix = alb.year ? `${alb.year} • ` : '';
                const artistLabel = alb.artist?.name || 'Álbum';

                const albumKey = alb.id ? String(alb.id) : (alb.title ? alb.title.toLowerCase() : '');
                card.innerHTML = `
                    <div class="sp-card-art-wrap">
                        <img class="sp-card-art-img" src="${coverSrc}" alt="${escapeHtml(alb.title)}" loading="lazy" onerror="this.src='${DEFAULT_COVER_SVG}'">
                        <button class="card-floating-like" data-album-like-key="${albumKey}" title="Curtir Álbum e Baixar Offline">
                            ${OUTLINE_HEART_SVG}
                        </button>
                        <button class="sp-card-play-btn" title="Abrir Álbum ${escapeHtml(alb.title)}">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                    </div>
                    <div class="sp-card-info">
                        <div class="sp-card-title" title="${escapeHtml(alb.title)}">${escapeHtml(alb.title)}</div>
                        <div class="sp-card-subtitle" title="${escapeHtml(artistLabel)}">${yearPrefix}${escapeHtml(artistLabel)}</div>
                    </div>
                `;

                if (window.api && window.api.isAlbumLiked) {
                    window.api.isAlbumLiked(alb.id || alb.title).then(liked => {
                        if (liked) {
                            const likeBtn = card.querySelector('.card-floating-like');
                            if (likeBtn) {
                                likeBtn.classList.add('active');
                                likeBtn.innerHTML = FILLED_HEART_SVG;
                                likeBtn.title = 'Remover Álbum dos Favoritos';
                            }
                        }
                    }).catch(() => {});
                }

                const likeBtn = card.querySelector('.card-floating-like');
                if (likeBtn) {
                    likeBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        await toggleFavoriteAlbumHandler(alb);
                    });
                }

                card.onclick = (e) => {
                    if (e.target.closest('.card-floating-like')) return;
                    openOnlineAlbumView(alb);
                };
                albumsGrid.appendChild(card);
            });
        } else {
            albumsWrap.style.display = 'none';
        }
    }

    // 5. LOCAL LIBRARY TRACKS SECTION (Disabled for 100% online experience)
    if (localWrap) {
        localWrap.style.display = 'none';
    }

    // 6. MORE ONLINE TRACKS GRID (MAIS MÚSICAS)
    const gridEl = document.getElementById('online-results-grid');
    if (gridEl && moreWrap) {
        gridEl.innerHTML = '';
        const moreTracks = tracks.slice(dominantArtist ? 4 : 5);

        if (moreTracks.length > 0) {
            moreWrap.style.display = 'block';
            moreTracks.forEach(track => {
                registerTrack(track);
                const isPlayingThis = (currentOnlinePlayingId === track.id && !audio.paused);
                const card = document.createElement('div');
                card.className = 'sp-grid-card';
                card.id = `sp-card-${track.id}`;
                card.dataset.trackId = track.id;

                const heartSvg = track.is_favorite
                    ? `<svg role="img" height="16" width="16" viewBox="0 0 16 16"><path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z" fill="#1ED760"></path></svg>`
                    : `<svg role="img" height="16" width="16" viewBox="0 0 16 16"><path d="M1.626 3.161a2.766 2.766 0 0 1 3.91 0l.464.465.465-.465a2.766 2.766 0 0 1 3.91 3.91l-4.375 4.375-4.374-4.375a2.766 2.766 0 0 1 0-3.91zM2.686 4.22a1.266 1.266 0 0 0 0 1.79l3.315 3.314 3.314-3.314a1.266 1.266 0 0 0-1.79-1.79l-1.524 1.524-1.524-1.524a1.266 1.266 0 0 0-1.791 0z" fill="currentColor"></path></svg>`;

                card.innerHTML = `
                    <div class="sp-card-art-wrap">
                        <img class="sp-card-art-img" src="${getTrackCover(track)}" alt="${escapeHtml(track.title)}" loading="lazy">
                        <button class="sp-card-play-btn ${isPlayingThis ? 'playing' : ''}" id="sp-play-card-${track.id}" title="${isPlayingThis ? 'Pausar' : 'Tocar'}">
                            ${isPlayingThis
                                ? '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
                                : '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                            }
                        </button>
                    </div>
                    <div class="sp-card-info">
                        <div class="sp-card-title" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</div>
                        <div class="sp-card-subtitle clickable" onclick="event.stopPropagation(); openArtistView('${escapeHtml(track.artist).replace(/'/g, "\\'")}')" title="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</div>
                        <div class="sp-card-bottom-row" style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
                            <span class="sp-card-badge">${track.durationFormatted || track.duration || 'Música'}</span>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <button class="add-to-pl-btn" id="sp-add-card-${track.id}" title="Adicionar à Playlist">
                                    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M15.25 8a.75.75 0 0 1-.75.75H8.75v5.75a.75.75 0 0 1-1.5 0V8.75H1.5a.75.75 0 0 1 0-1.5h5.75V1.5a.75.75 0 0 1 1.5 0v5.75h5.75a.75.75 0 0 1 .75.75z"/></svg>
                                </button>
                                <button class="heart-btn ${track.is_favorite ? 'active' : ''}" id="sp-heart-card-${track.id}" title="${track.is_favorite ? 'Remover dos Favoritos' : 'Salvar nos Favoritos'}">
                                    ${heartSvg}
                                </button>
                                <button class="sp-btn-download-icon" id="sp-dl-card-${track.id}" title="Baixar Música">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                card.onclick = (e) => {
                    if (e.target.closest('.sp-btn-download-icon') || e.target.closest('.add-to-pl-btn') || e.target.closest('.heart-btn') || e.target.closest('.sp-card-subtitle')) return;
                    playOnlineFullTrack(track, tracks);
                };

                const addCardBtn = card.querySelector(`#sp-add-card-${track.id}`);
                if (addCardBtn) {
                    addCardBtn.onclick = (e) => {
                        e.stopPropagation();
                        openAddToPlaylistPicker(track);
                    };
                }

                const heartCardBtn = card.querySelector(`#sp-heart-card-${track.id}`);
                if (heartCardBtn) {
                    heartCardBtn.onclick = async (e) => {
                        e.stopPropagation();
                        await toggleFavoriteTrack(track);
                    };
                }

                const dlBtn = card.querySelector(`#sp-dl-card-${track.id}`);
                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.stopPropagation();
                        startSpotifyDownload(track, dlBtn);
                    };
                }

                gridEl.appendChild(card);
            });
        } else {
            moreWrap.style.display = 'none';
        }
    }
}

const onlineStreamCache = new Map();

async function playOnlineFullTrack(track, queue = null) {
    if (!track) return;

    // 1. If this track has already been downloaded to local storage, play directly!
    const localAudioPath = track.offline_path || track.file_path;
    if (localAudioPath) {
        playTrack(track, queue || currentQueue);
        return;
    }

    // 2. If device is offline and track is not downloaded, warn immediately without failing web calls
    if (!navigator.onLine) {
        showToast("⚠️ Música indisponível offline. Baixe a faixa para ouvir sem conexão.");
        syncPreviewButtonsState(track.id, false);
        return;
    }

    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

    // If clicking same online track that's currently active
    if (currentOnlinePlayingId === track.id) {
        if (!audio.paused) {
            audio.pause();
            syncPreviewButtonsState(track.id, false);
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        } else {
            audio.play().catch(e => console.error(e));
            syncPreviewButtonsState(track.id, true);
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        }
        return;
    }

    // Reset previous playing button state
    if (currentOnlinePlayingId) {
        syncPreviewButtonsState(currentOnlinePlayingId, false);
    }

    // Set queue for continuous track playback (albums / queue)
    if (queue && queue.length > 0) {
        originalQueue = [...queue];
        if (isShuffle) {
            currentQueue = [...queue].sort(() => Math.random() - 0.5);
            currentQueue = [track, ...currentQueue.filter(t => t.id != track.id)];
        } else {
            currentQueue = [...queue];
        }
        currentIndex = currentQueue.findIndex(t => t.id == track.id);
        if (currentIndex === -1) {
            currentQueue.unshift(track);
            currentIndex = 0;
        }
    } else {
        const existingIdx = currentQueue.findIndex(t => t.id == track.id);
        if (existingIdx !== -1) {
            currentIndex = existingIdx;
        } else {
            currentQueue = [track];
            currentIndex = 0;
        }
    }

    registerTrack(track);
    startTrackPlaybackTracking(track);
    currentOnlinePlayingId = track.id;

    // Immediately update bottom player UI with full track metadata
    if (lblTitle) lblTitle.textContent = track.title || '';
    if (lblArtist) lblArtist.textContent = track.artist || '';
    const coverSrc = getTrackCover(track);
    if (coverImg) coverImg.src = coverSrc;

    // Wire bottom player favorite button for online tracks
    nowPlayingFav.classList.toggle('active', !!track.is_favorite);
    nowPlayingFav.title = track.is_favorite ? "Remover dos Favoritos" : "Salvar em Músicas Curtidas";
    nowPlayingFav.onclick = async () => {
        await toggleFavoriteTrack(track);
    };

    // Display track duration immediately while audio stream is resolving
    timeCurrent.innerText = '0:00';
    if (track.durationFormatted) {
        timeTotal.innerText = track.durationFormatted;
    } else if (typeof track.duration === 'string') {
        timeTotal.innerText = track.duration;
    } else if (typeof track.duration === 'number' && track.duration > 0) {
        timeTotal.innerText = formatTime(track.duration);
    }

    syncPreviewButtonsState(track.id, true);
    updatePlayingRow();
    syncFullscreenPlayer(track);

    showToast(`Carregando música completa: ${track.title}...`);

    try {
        const cacheKey = (track.url || track.id || `${track.artist}-${track.title}`).toLowerCase();
        let streamUrl = onlineStreamCache.get(cacheKey);

        if (!streamUrl) {
            const queryOrUrl = track.url || (track.id && !String(track.id).startsWith('dz_') ? track.id : `${track.artist || ''} - ${track.title || ''}`);
            const res = await window.api.getOnlineMusicStream(queryOrUrl);
            if (res && res.success && res.url) {
                streamUrl = res.url;
                onlineStreamCache.set(cacheKey, streamUrl);
            } else if (track.preview) {
                console.warn('[OnlinePlayer] Stream resolution failed, falling back to preview:', res?.error);
                streamUrl = track.preview;
            } else {
                showToast('Não foi possível carregar a música completa online.');
                syncPreviewButtonsState(track.id, false);
                return;
            }
        }

        // Route through zero-CORS local streaming proxy with range headers
        let playableUrl = streamUrl;
        if (mediaServerPort && streamUrl.startsWith('http')) {
            playableUrl = `http://127.0.0.1:${mediaServerPort}/online-stream?url=${encodeURIComponent(streamUrl)}`;
        }

        audio.src = playableUrl;
        try {
            await audio.play();
        } catch (playErr) {
            console.warn('[OnlinePlayer] Proxied playback failed, attempting direct stream:', playErr);
            audio.src = streamUrl;
            await audio.play();
        }

        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = 'block';
        if (btnPlay) btnPlay.title = 'Pausar';

        updateMediaSession(track);
        renderQueueDrawer();
        showToast(`Tocando: ${track.title}`);

        try { window.api.incrementPlayCount(track.id); } catch(e) {}

        // If lyrics view is open, load lyrics immediately for online track
        if (document.getElementById('view-lyrics').classList.contains('active')) {
            loadLyrics(track);
        }

        if (window.api.updatePlaybackState) {
            window.api.updatePlaybackState({ isPlaying: true, title: track.title, artist: track.artist });
        }
    } catch (err) {
        console.error('Failed to play online full track:', err);
        showToast('Erro ao reproduzir música');
        syncPreviewButtonsState(track.id, false);
    }
}

// Alias for compatibility
const toggleOnlinePreview = playOnlineFullTrack;

function syncPreviewButtonsState(trackId, isPlaying) {
    const playIcon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const pauseIcon = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    
    // Top card play button
    const btnTop = document.getElementById(`sp-btn-play-top-${trackId}`);
    if (btnTop) {
        btnTop.classList.toggle('playing', isPlaying);
        btnTop.innerHTML = isPlaying ? pauseIcon : playIcon;
    }

    // Row play button
    const btnRow = document.getElementById(`sp-play-row-${trackId}`);
    if (btnRow) {
        btnRow.classList.toggle('playing', isPlaying);
        btnRow.innerHTML = isPlaying
            ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
            : '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }

    // Grid card play button
    const btnCard = document.getElementById(`sp-play-card-${trackId}`);
    if (btnCard) {
        btnCard.classList.toggle('playing', isPlaying);
        btnCard.innerHTML = isPlaying ? pauseIcon : playIcon;
    }
}

// ==========================================================================
// DOWNLOAD QUEUE & OFFLINE MANAGER
// ==========================================================================
const downloadQueue = [];
let activeDownloadWorkers = 0;
const MAX_CONCURRENT_DOWNLOADS = 2;

function updateAlbumOfflineCount() {
    const plType = document.getElementById('pl-type')?.innerText;
    if (plType === 'Álbum') {
        const rows = document.querySelectorAll('#pl-track-tbody .track-row');
        const downloadedRows = document.querySelectorAll('#pl-track-tbody .track-row .offline-row-badge.downloaded, #pl-track-tbody .track-row .sp-btn-download-icon.completed');
        const total = rows.length;
        const count = downloadedRows.length;
        const countEl = document.getElementById('pl-count');
        if (countEl && total > 0) {
            countEl.innerText = `${total} músicas • ${count} disponíveis offline`;
        }
    }
}

function updateTrackOfflineBadges(trackId, status) {
    const strId = String(trackId);
    const targetTrack = findTrack(trackId);
    if (targetTrack) {
        if (status === 'downloading') {
            targetTrack.download_status = 'downloading';
        } else if (status === 'downloaded') {
            targetTrack.download_status = 'downloaded';
            targetTrack.isOfflineAvailable = true;
        } else if (status === 'none') {
            targetTrack.download_status = 'none';
            targetTrack.isOfflineAvailable = false;
        }
    }

    const elements = [
        document.getElementById(`sp-dl-top-${strId}`),
        document.getElementById(`sp-dl-row-${strId}`),
        document.getElementById(`sp-dl-card-${strId}`),
        document.getElementById(`art-dl-${strId}`),
        document.getElementById(`row-dl-${strId}`)
    ];

    document.querySelectorAll(`[data-offline-track-id="${strId}"]`).forEach(el => elements.push(el));

    elements.forEach(el => {
        if (!el) return;
        if (status === 'downloading') {
            el.className = el.classList.contains('sp-btn-download-icon') ? 'sp-btn-download-icon downloading offline-row-badge' : 'offline-row-badge downloading';
            el.title = 'Baixando para reprodução offline... (Clique para cancelar)';
            el.innerHTML = `<svg class="spin-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
        } else if (status === 'downloaded') {
            el.className = el.classList.contains('sp-btn-download-icon') ? 'sp-btn-download-icon completed offline-row-badge downloaded' : 'offline-row-badge downloaded';
            el.title = 'Disponível offline (arquivo salvo no computador). Clique para gerenciar...';
            el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="#1ed760"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm-1.5 14.5L5.75 11.75l1.41-1.41L10.5 13.67l6.34-6.34 1.41 1.41z"/></svg>`;
        } else {
            el.className = el.classList.contains('sp-btn-download-icon') ? 'sp-btn-download-icon offline-row-badge not-downloaded' : 'offline-row-badge not-downloaded';
            el.title = 'Baixar música para ouvir offline';
            el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
        }
    });

    if (currentOpenPlaylistIsFavorites) {
        updatePlaylistOfflineCount();
    }
    updateAlbumOfflineCount();
}

function queueTrackForDownload(track, btn = null, silent = false) {
    if (!track) return;
    registerTrack(track);

    // If already downloaded or local file, skip
    if (track.isOfflineAvailable || track.download_status === 'downloaded' || (track.file_path && !track.isOnline && !String(track.id).startsWith('dz_'))) {
        track.isOfflineAvailable = true;
        track.download_status = 'downloaded';
        updateTrackOfflineBadges(track.id, 'downloaded');
        return;
    }

    // If already downloading or queued, skip duplicate
    if (track.download_status === 'downloading' || downloadQueue.some(item => String(item.track.id) === String(track.id))) {
        return;
    }

    track.download_status = 'downloading';
    updateTrackOfflineBadges(track.id, 'downloading');

    if (btn) {
        btn.classList.add('downloading');
        btn.title = 'Baixando...';
        btn.innerHTML = `<svg class="spin-icon" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>`;
    }

    if (!silent) {
        showToast(`Baixando "${track.title}" para ouvir offline... ⬇️`);
    }

    downloadQueue.push({ track, btn, silent });
    processDownloadQueue();
}

async function processDownloadQueue() {
    if (activeDownloadWorkers >= MAX_CONCURRENT_DOWNLOADS) return;
    if (downloadQueue.length === 0) return;

    const item = downloadQueue.shift();
    activeDownloadWorkers++;

    try {
        await executeTrackDownload(item.track, item.btn, item.silent);
    } catch (e) {
        console.error('[DownloadQueue] Execution error:', e);
    } finally {
        activeDownloadWorkers--;
        processDownloadQueue();
    }
}

async function executeTrackDownload(track, btn = null, silent = false) {
    try {
        const result = await window.api.downloadOnlineMusic(track);
        if (result && result.success) {
            track.offline_path = result.filePath;
            track.file_path = result.filePath;
            track.isOfflineAvailable = true;
            track.download_status = 'downloaded';
            if (result.fileSize) track.file_size = result.fileSize;

            updateTrackOfflineBadges(track.id, 'downloaded');

            if (btn) {
                btn.classList.remove('downloading');
                btn.classList.add('completed');
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="#1ed760"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm-1.5 14.5L5.75 11.75l1.41-1.41L10.5 13.67l6.34-6.34 1.41 1.41z"/></svg>`;
                btn.title = 'Música disponível offline! Clique para tocar';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    playTrack(track);
                };
            }

            if (!silent) {
                showToast(`"${track.title}" salva para ouvir offline! 🎉`);
            }
        } else if (result && result.cancelled) {
            track.download_status = 'none';
            updateTrackOfflineBadges(track.id, 'none');
            if (btn) {
                btn.classList.remove('downloading');
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
                btn.title = 'Tentar Novamente';
            }
            if (!silent) {
                showToast(`Download de "${track.title}" cancelado.`);
            }
        } else {
            track.download_status = 'none';
            updateTrackOfflineBadges(track.id, 'none');
            if (btn) {
                btn.classList.remove('downloading');
                btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
                btn.title = 'Tentar Novamente';
            }
            if (!silent) {
                showToast(`Falha no download de "${track.title}": ${result?.error || 'Erro desconhecido'}`);
            }
        }
    } catch (err) {
        console.error('Download error:', err);
        track.download_status = 'none';
        updateTrackOfflineBadges(track.id, 'none');
        if (btn) {
            btn.classList.remove('downloading');
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
        }
        if (!silent) {
            showToast('Erro ao realizar download');
        }
    }
}

async function startSpotifyDownload(track, btn = null) {
    queueTrackForDownload(track, btn, false);
}

// Album Like & Auto-download Handler
async function toggleFavoriteAlbumHandler(album, tracks = null) {
    if (!album) return;

    const btnLike = document.getElementById('btn-pl-like');
    const isCurrentlyLiked = btnLike ? btnLike.classList.contains('active') : await window.api.isAlbumLiked(album.id || album.title).catch(() => false);
    const nextState = !isCurrentlyLiked;

    // Persist album in database
    await window.api.toggleFavoriteAlbum(album);

    // Sync hero button if viewing album
    if (btnLike) {
        btnLike.classList.toggle('active', nextState);
        btnLike.innerHTML = nextState ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
        btnLike.title = nextState ? 'Remover Álbum dos Favoritos' : 'Curtir Álbum e Baixar Offline';
    }

    // Sync any album card heart buttons in DOM
    const albumKey = album.id ? String(album.id) : (album.title ? album.title.toLowerCase() : '');
    document.querySelectorAll(`[data-album-like-key="${albumKey}"]`).forEach(b => {
        b.classList.toggle('active', nextState);
        b.innerHTML = nextState ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
    });

    if (nextState) {
        let albumTracks = tracks;
        if (!albumTracks || albumTracks.length === 0) {
            if (album.id) {
                showToast(`Buscando faixas do álbum "${album.title}"...`);
                const raw = await window.api.getAlbumTracks(album.id).catch(() => []);
                const artistName = album.artist?.name || album.artist || 'Artista';
                const coverUrl = album.coverUrl || album.cover_xl || album.cover_big || album.cover || DEFAULT_COVER_SVG;
                albumTracks = (raw || []).map((t, idx) => ({
                    id: t.id || `dz_alb_${album.id}_${idx}`,
                    deezerId: t.deezerId,
                    track_number: idx + 1,
                    title: t.title,
                    artist: artistName,
                    album: album.title,
                    duration: t.durationSeconds || 0,
                    durationFormatted: t.duration || '3:30',
                    preview: t.preview,
                    coverUrl: coverUrl,
                    thumbnail: coverUrl,
                    isOnline: true
                }));
            }
        }

        if (albumTracks && albumTracks.length > 0) {
            // Bulk favorite in database
            await window.api.setTracksFavorite(albumTracks, true);
            albumTracks.forEach(t => {
                t.is_favorite = true;
                syncHeartButtonsGlobally(t.id, true);
            });

            // Queue non-offline tracks for download
            const toDownload = albumTracks.filter(t => 
                !t.isOfflineAvailable && 
                t.download_status !== 'downloaded' && 
                !(t.file_path && !t.isOnline && !String(t.id).startsWith('dz_'))
            );

            if (toDownload.length > 0) {
                showToast(`Álbum "${album.title}" curtido! Baixando ${toDownload.length} faixas para ouvir offline... ⬇️`);
                toDownload.forEach(t => {
                    queueTrackForDownload(t, null, true);
                });
            } else {
                showToast(`Álbum "${album.title}" curtido! Todas as faixas já estão disponíveis offline 🎉`);
            }
        } else {
            showToast(`Álbum "${album.title}" adicionado aos favoritos ❤️`);
        }
    } else {
        showToast(`Álbum "${album.title}" removido dos favoritos.`);
    }
}

// Playlist Like & Auto-download Handler
async function toggleFavoritePlaylistHandler(opts, tracks) {
    if (!tracks || tracks.length === 0) {
        showToast('Nenhuma música na playlist para baixar.');
        return;
    }

    const btnLike = document.getElementById('btn-pl-like');
    if (btnLike) {
        btnLike.classList.toggle('active');
        const isActive = btnLike.classList.contains('active');
        btnLike.innerHTML = isActive ? FILLED_HEART_SVG : OUTLINE_HEART_SVG;
    }

    await window.api.setTracksFavorite(tracks, true);
    tracks.forEach(t => {
        t.is_favorite = true;
        syncHeartButtonsGlobally(t.id, true);
    });

    const toDownload = tracks.filter(t => 
        !t.isOfflineAvailable && 
        t.download_status !== 'downloaded' && 
        !(t.file_path && !t.isOnline && !String(t.id).startsWith('dz_'))
    );

    if (toDownload.length > 0) {
        showToast(`Playlist curtida! Baixando ${toDownload.length} músicas para ouvir offline... ⬇️`);
        toDownload.forEach(t => queueTrackForDownload(t, null, true));
    } else {
        showToast(`Todas as ${tracks.length} músicas já estão disponíveis offline! 🎉`);
    }
}

// Download progress listener from backend
if (window.api && window.api.onDownloadProgress) {
    window.api.onDownloadProgress((data) => {
        if (!data || !data.trackId) return;
        const targetTrack = findTrack(data.trackId);
        if (targetTrack) {
            if (data.status === 'downloading') targetTrack.download_status = 'downloading';
            else if (data.status === 'completed') {
                targetTrack.download_status = 'downloaded';
                targetTrack.isOfflineAvailable = true;
            } else if (data.status === 'cancelled') {
                targetTrack.download_status = 'none';
            }
        }

        const btns = [
            document.getElementById(`sp-dl-top-${data.trackId}`),
            document.getElementById(`sp-dl-row-${data.trackId}`),
            document.getElementById(`sp-dl-card-${data.trackId}`),
            document.getElementById(`art-dl-${data.trackId}`)
        ];

        document.querySelectorAll(`[data-offline-track-id="${data.trackId}"]`).forEach(b => btns.push(b));

        btns.forEach(b => {
            if (!b) return;
            if (data.status === 'downloading' && data.percent !== undefined) {
                b.classList.add('downloading');
                b.title = `Baixando... ${data.percent}% (Clique para cancelar)`;
            } else if (data.status === 'completed') {
                b.classList.remove('downloading');
                b.classList.add('downloaded');
                b.title = 'Disponível offline (arquivo salvo no computador)';
                b.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="#1ed760"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm-1.5 14.5L5.75 11.75l1.41-1.41L10.5 13.67l6.34-6.34 1.41 1.41z"/></svg>`;
            } else if (data.status === 'cancelled') {
                b.classList.remove('downloading');
                b.classList.remove('downloaded');
                b.title = 'Baixar música para ouvir offline';
                b.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 14.17l3.59-3.58 1.41 1.41L12 20l-6-6 1.41-1.41L11 16.17V4h2z"/></svg>`;
            }
        });
    });
}

// Network connectivity listeners (Offline resilience)
window.addEventListener('offline', () => {
    showToast("Modo Offline ativado — reproduzindo músicas baixadas.");
});

window.addEventListener('online', () => {
    showToast("Conexão com a internet restaurada 🌐");
});

// Pills filter click listeners (Tudo, Músicas, Artistas, Álbuns, Biblioteca)
document.querySelectorAll('#sp-search-pills-bar .pill-chip').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('#sp-search-pills-bar .pill-chip').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const filter = pill.getAttribute('data-sp-filter');
        const topSplit = document.getElementById('sp-search-top-split');
        const artistsWrap = document.getElementById('sp-artists-wrap');
        const albumsWrap = document.getElementById('sp-albums-wrap');
        const localWrap = document.getElementById('sp-local-wrap');
        const moreWrap = document.getElementById('sp-more-results-wrap');

        if (filter === 'songs') {
            if (topSplit) topSplit.style.display = 'grid';
            if (artistsWrap) artistsWrap.style.display = 'none';
            if (albumsWrap) albumsWrap.style.display = 'none';
            if (localWrap) localWrap.style.display = 'none';
            if (moreWrap) moreWrap.style.display = 'block';
        } else if (filter === 'artists') {
            if (topSplit) topSplit.style.display = 'none';
            if (artistsWrap) artistsWrap.style.display = 'block';
            if (albumsWrap) albumsWrap.style.display = 'none';
            if (localWrap) localWrap.style.display = 'none';
            if (moreWrap) moreWrap.style.display = 'none';
        } else if (filter === 'albums') {
            if (topSplit) topSplit.style.display = 'none';
            if (artistsWrap) artistsWrap.style.display = 'none';
            if (albumsWrap) albumsWrap.style.display = 'block';
            if (localWrap) localWrap.style.display = 'none';
            if (moreWrap) moreWrap.style.display = 'none';
        } else if (filter === 'local') {
            if (topSplit) topSplit.style.display = 'none';
            if (artistsWrap) artistsWrap.style.display = 'none';
            if (albumsWrap) albumsWrap.style.display = 'none';
            if (localWrap) localWrap.style.display = 'block';
            if (moreWrap) moreWrap.style.display = 'none';
        } else {
            // 'all'
            if (topSplit) topSplit.style.display = 'grid';
            if (artistsWrap) artistsWrap.style.display = activeOnlineArtists.length > 0 ? 'block' : 'none';
            if (albumsWrap) albumsWrap.style.display = activeOnlineAlbums.length > 0 ? 'block' : 'none';
            if (localWrap) localWrap.style.display = activeLocalTracks.length > 0 ? 'block' : 'none';
            if (moreWrap) moreWrap.style.display = activeOnlineTracks.length > 4 ? 'block' : 'none';
        }
    });
});

// Init
window.addEventListener('DOMContentLoaded', () => {
    loadHomeView();
});


