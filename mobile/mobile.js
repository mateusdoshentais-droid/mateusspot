// ==========================================================================
// SPOTCRY MOBILE - CORE CLIENT SCRIPT
// ==========================================================================

const API_BASE = window.location.origin;
const DEFAULT_COVER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23282828'/><circle cx='50' cy='50' r='20' fill='%23121212'/><circle cx='50' cy='50' r='6' fill='%23383838'/></svg>";

let allTracks = [];
let allPlaylists = [];
let currentQueue = [];
let currentIndex = -1;
let currentTrack = null;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let isRemoteMode = false;

// HTML5 Audio Element for Mobile & iPadOS Safari
const audio = new Audio();
audio.preload = 'auto';
audio.playsInline = true;
audio.setAttribute('playsinline', 'true');
audio.setAttribute('webkit-playsinline', 'true');

// Safari iOS/iPadOS Audio Gesture Unlock Helper
let safariAudioUnlocked = false;
function unlockSafariAudio() {
    if (safariAudioUnlocked) return;
    safariAudioUnlocked = true;
    audio.load();
    window.removeEventListener('touchstart', unlockSafariAudio);
    window.removeEventListener('click', unlockSafariAudio);
}
window.addEventListener('touchstart', unlockSafariAudio, { passive: true });
window.addEventListener('click', unlockSafariAudio, { passive: true });

// ================= DOM ELEMENTS =================
const miniPlayer = document.getElementById('mobile-mini-player');
const miniThumb = document.getElementById('mini-thumb');
const miniTitle = document.getElementById('mini-title');
const miniArtist = document.getElementById('mini-artist');
const miniIconPlay = document.getElementById('mini-icon-play');
const miniIconPause = document.getElementById('mini-icon-pause');
const miniProgressBar = document.getElementById('mini-progress-bar');
const btnMiniPlay = document.getElementById('btn-mini-play');

const fsModal = document.getElementById('mobile-fullscreen-modal');
const btnCloseFsModal = document.getElementById('btn-close-fs-modal');
const fsModalArt = document.getElementById('fs-modal-art');
const fsTrackName = document.getElementById('fs-track-name');
const fsTrackArtist = document.getElementById('fs-track-artist');
const fsScrubSlider = document.getElementById('fs-scrub-slider');
const fsCurrentTime = document.getElementById('fs-current-time');
const fsTotalTime = document.getElementById('fs-total-time');
const btnFsPlay = document.getElementById('btn-fs-play');
const fsIconPlay = document.getElementById('fs-icon-play');
const fsIconPause = document.getElementById('fs-icon-pause');
const btnFsPrev = document.getElementById('btn-fs-prev');
const btnFsNext = document.getElementById('btn-fs-next');
const btnFsShuffle = document.getElementById('btn-fs-shuffle');
const btnFsRepeat = document.getElementById('btn-fs-repeat');
const btnFsFav = document.getElementById('btn-fs-fav');
const fsFavSvg = document.getElementById('fs-fav-svg');

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
    setupGreeting();
    setupNavigation();
    setupAudioListeners();
    setupPlayerControls();
    setupSearch();
    setupConnectMode();
    await loadServerData();
});

function setupGreeting() {
    const hour = new Date().getHours();
    const greet = document.getElementById('mobile-greeting');
    if (hour >= 5 && hour < 12) greet.innerText = 'Bom dia ☀️';
    else if (hour >= 12 && hour < 18) greet.innerText = 'Boa tarde 🌤️';
    else greet.innerText = 'Boa noite 🌙';
}

function setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab-item');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.dataset.tab;
            if (!targetId) return;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            document.querySelectorAll('.mobile-tab-view').forEach(view => {
                view.classList.toggle('active', view.id === targetId);
            });
        });
    });
}

// ================= DATA LOADING =================
async function loadServerData() {
    try {
        const infoRes = await fetch(`${API_BASE}/api/info`);
        if (infoRes.ok) {
            const info = await infoRes.json();
            document.getElementById('status-dot').classList.add('connected');
            document.getElementById('server-ip-label').innerText = `${info.name} • ${info.ip}`;
        }

        const tracksRes = await fetch(`${API_BASE}/api/tracks`);
        if (tracksRes.ok) {
            allTracks = await tracksRes.json();
            renderHome();
        }

        const plRes = await fetch(`${API_BASE}/api/playlists`);
        if (plRes.ok) {
            allPlaylists = await plRes.json();
            renderLibrary();
        }
    } catch (err) {
        console.error('Falha ao conectar no PC:', err);
        document.getElementById('status-dot').classList.remove('connected');
        document.getElementById('server-ip-label').innerText = 'Reconectando ao PC...';
        setTimeout(loadServerData, 4000);
    }
}

// ================= RENDER HOME =================
function renderHome() {
    // 1. Quick Mix Grid (Top 6)
    const quickGrid = document.getElementById('mobile-quick-grid');
    quickGrid.innerHTML = '';
    const quickTracks = allTracks.slice(0, 6);
    quickTracks.forEach(t => {
        const card = document.createElement('div');
        card.className = 'mobile-quick-card';
        card.innerHTML = `
            <img class="mobile-quick-thumb" src="${t.cover_url || DEFAULT_COVER}" onerror="this.src='${DEFAULT_COVER}'">
            <span class="mobile-quick-name">${t.title}</span>
        `;
        card.addEventListener('click', () => playTrack(t, allTracks));
        quickGrid.appendChild(card);
    });

    // 2. Recent Row
    const recentRow = document.getElementById('mobile-recent-row');
    recentRow.innerHTML = '';
    allTracks.slice(0, 10).forEach(t => {
        const item = document.createElement('div');
        item.className = 'mobile-card-item';
        item.innerHTML = `
            <img class="mobile-card-thumb" src="${t.cover_url || DEFAULT_COVER}" onerror="this.src='${DEFAULT_COVER}'">
            <div class="mobile-card-title">${t.title}</div>
            <div class="mobile-card-sub">${t.artist || 'Artista'}</div>
        `;
        item.addEventListener('click', () => playTrack(t, allTracks));
        recentRow.appendChild(item);
    });

    // 3. Top Most Played List
    const topList = document.getElementById('mobile-top-list');
    topList.innerHTML = '';
    const sorted = [...allTracks].sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 5);
    sorted.forEach(t => {
        topList.appendChild(createTrackRow(t, sorted));
    });

    // 4. Artists Row
    const artistsRow = document.getElementById('mobile-artists-row');
    artistsRow.innerHTML = '';
    const artists = [...new Set(allTracks.map(t => (t.artist || '').trim()).filter(Boolean))].slice(0, 8);
    artists.forEach(art => {
        const first = allTracks.find(t => t.artist === art);
        const item = document.createElement('div');
        item.className = 'mobile-card-item artist';
        item.innerHTML = `
            <img class="mobile-card-thumb" src="${first?.cover_url || DEFAULT_COVER}" onerror="this.src='${DEFAULT_COVER}'">
            <div class="mobile-card-title" style="text-align:center;">${art}</div>
            <div class="mobile-card-sub" style="text-align:center;">Artista</div>
        `;
        item.addEventListener('click', () => {
            const artistTracks = allTracks.filter(t => t.artist === art);
            if (artistTracks.length > 0) playTrack(artistTracks[0], artistTracks);
        });
        artistsRow.appendChild(item);
    });
}

function createTrackRow(t, queue) {
    const row = document.createElement('div');
    row.className = 'mobile-track-row';
    if (currentTrack && currentTrack.id === t.id) row.classList.add('playing');
    row.innerHTML = `
        <img class="mobile-row-thumb" src="${t.cover_url || DEFAULT_COVER}" onerror="this.src='${DEFAULT_COVER}'">
        <div class="mobile-row-info">
            <div class="mobile-row-title">${t.title}</div>
            <div class="mobile-row-artist">${t.artist || 'Desconhecido'}</div>
        </div>
        <button class="mobile-row-action">⋮</button>
    `;
    row.addEventListener('click', () => playTrack(t, queue));
    return row;
}

// ================= RENDER LIBRARY =================
function renderLibrary() {
    const plList = document.getElementById('mobile-playlists-list');
    plList.innerHTML = '';
    const favCount = allTracks.filter(t => t.is_favorite).length;
    document.getElementById('lib-fav-count-text').innerText = `Playlist • ${favCount} músicas`;

    document.getElementById('row-liked-songs').onclick = () => {
        const favs = allTracks.filter(t => t.is_favorite);
        if (favs.length > 0) playTrack(favs[0], favs);
    };

    allPlaylists.forEach(pl => {
        const row = document.createElement('div');
        row.className = 'mobile-track-row';
        row.innerHTML = `
            <div class="mobile-row-thumb" style="background:#282828; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
            </div>
            <div class="mobile-row-info">
                <div class="mobile-row-title">${pl.name}</div>
                <div class="mobile-row-artist">Playlist • ${pl.tracks ? pl.tracks.length : 0} músicas</div>
            </div>
        `;
        row.addEventListener('click', async () => {
            const res = await fetch(`${API_BASE}/api/playlists/${pl.id}`);
            if (res.ok) {
                const data = await res.json();
                if (data.tracks && data.tracks.length > 0) playTrack(data.tracks[0], data.tracks);
            }
        });
        plList.appendChild(row);
    });
}

// ================= SEARCH =================
function setupSearch() {
    const input = document.getElementById('mobile-search-input');
    const container = document.getElementById('mobile-search-results');
    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        container.innerHTML = '';
        if (!q) return;

        const results = allTracks.filter(t => 
            (t.title || '').toLowerCase().includes(q) || 
            (t.artist || '').toLowerCase().includes(q) || 
            (t.album || '').toLowerCase().includes(q)
        );

        results.slice(0, 20).forEach(t => {
            container.appendChild(createTrackRow(t, results));
        });
    });
}

// ================= AUDIO ENGINE & PLAYBACK =================
function playTrack(track, queue) {
    if (isRemoteMode) {
        // Send command to PC
        fetch(`${API_BASE}/api/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'playTrack', trackId: track.id })
        });
        return;
    }

    currentTrack = track;
    currentQueue = queue && queue.length > 0 ? queue : [track];
    currentIndex = currentQueue.findIndex(t => t.id === track.id);

    audio.src = track.stream_url;
    audio.load();
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            isPlaying = true;
            updateUI();
            updateMediaSession();
        }).catch(e => console.warn('Play error:', e));
    }
}

function togglePlay() {
    if (!currentTrack) {
        if (allTracks.length > 0) playTrack(allTracks[0], allTracks);
        return;
    }

    if (isRemoteMode) {
        fetch(`${API_BASE}/api/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: isPlaying ? 'pause' : 'play' })
        });
        isPlaying = !isPlaying;
        updatePlayIcons();
        return;
    }

    if (audio.paused) {
        audio.play();
        isPlaying = true;
    } else {
        audio.pause();
        isPlaying = false;
    }
    updatePlayIcons();
}

function playNext() {
    if (isRemoteMode) {
        fetch(`${API_BASE}/api/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next' }) });
        return;
    }
    if (currentQueue.length === 0) return;
    if (isShuffle) {
        currentIndex = Math.floor(Math.random() * currentQueue.length);
    } else {
        currentIndex = (currentIndex + 1) % currentQueue.length;
    }
    playTrack(currentQueue[currentIndex], currentQueue);
}

function playPrev() {
    if (isRemoteMode) {
        fetch(`${API_BASE}/api/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prev' }) });
        return;
    }
    if (currentQueue.length === 0) return;
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    currentIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
    playTrack(currentQueue[currentIndex], currentQueue);
}

function setupAudioListeners() {
    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        const progress = (audio.currentTime / audio.duration) * 100;
        miniProgressBar.style.width = `${progress}%`;
        fsScrubSlider.value = progress;
        fsCurrentTime.innerText = formatTime(audio.currentTime);
        fsTotalTime.innerText = formatTime(audio.duration);
    });

    audio.addEventListener('ended', () => {
        if (isRepeat) {
            audio.currentTime = 0;
            audio.play();
        } else {
            playNext();
        }
    });

    audio.addEventListener('play', () => { isPlaying = true; updatePlayIcons(); });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayIcons(); });
}

function setupPlayerControls() {
    // Mini player tap -> open fullscreen
    miniPlayer.addEventListener('click', (e) => {
        if (e.target.closest('.mini-ctrl-btn')) return;
        fsModal.classList.add('open');
    });

    btnCloseFsModal.addEventListener('click', () => {
        fsModal.classList.remove('open');
    });

    const btnMiniPrev = document.getElementById('btn-mini-prev');
    const btnMiniNext = document.getElementById('btn-mini-next');
    const btnMiniExpand = document.getElementById('btn-mini-expand');

    if (btnMiniPrev) btnMiniPrev.addEventListener('click', (e) => { e.stopPropagation(); playPrev(); });
    if (btnMiniNext) btnMiniNext.addEventListener('click', (e) => { e.stopPropagation(); playNext(); });
    if (btnMiniExpand) btnMiniExpand.addEventListener('click', (e) => { e.stopPropagation(); fsModal.classList.add('open'); });

    btnMiniPlay.addEventListener('click', togglePlay);
    btnFsPlay.addEventListener('click', togglePlay);
    btnFsNext.addEventListener('click', playNext);
    btnFsPrev.addEventListener('click', playPrev);

    btnFsShuffle.addEventListener('click', () => {
        isShuffle = !isShuffle;
        btnFsShuffle.querySelector('svg').style.fill = isShuffle ? '#1ED760' : '#b3b3b3';
    });

    btnFsRepeat.addEventListener('click', () => {
        isRepeat = !isRepeat;
        btnFsRepeat.querySelector('svg').style.fill = isRepeat ? '#1ED760' : '#b3b3b3';
    });

    const onScrub = (e) => {
        if (audio.duration) {
            audio.currentTime = (e.target.value / 100) * audio.duration;
        }
    };
    fsScrubSlider.addEventListener('input', onScrub);
    fsScrubSlider.addEventListener('change', onScrub);

    btnFsFav.addEventListener('click', async () => {
        if (!currentTrack) return;
        try {
            const res = await fetch(`${API_BASE}/api/favorites/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId: currentTrack.id })
            });
            if (res.ok) {
                const d = await res.json();
                currentTrack.is_favorite = d.is_favorite;
                updateFavIcon();
            }
        } catch (e) {}
    });
}

function updateUI() {
    if (!currentTrack) return;
    miniPlayer.style.display = 'flex';

    const cover = currentTrack.cover_url || DEFAULT_COVER;
    miniThumb.src = cover;
    miniTitle.innerText = currentTrack.title;
    miniArtist.innerText = currentTrack.artist || 'Desconhecido';

    fsModalArt.src = cover;
    fsTrackName.innerText = currentTrack.title;
    fsTrackArtist.innerText = currentTrack.artist || 'Desconhecido';

    updatePlayIcons();
    updateFavIcon();

    // Highlight row in lists
    document.querySelectorAll('.mobile-track-row').forEach(row => {
        row.classList.remove('playing');
    });
}

function updatePlayIcons() {
    miniIconPlay.style.display = isPlaying ? 'none' : 'block';
    miniIconPause.style.display = isPlaying ? 'block' : 'none';
    fsIconPlay.style.display = isPlaying ? 'none' : 'block';
    fsIconPause.style.display = isPlaying ? 'block' : 'none';
}

function updateFavIcon() {
    if (!currentTrack) return;
    if (currentTrack.is_favorite) {
        fsFavSvg.innerHTML = `<path d="M15.724 4.22A4.313 4.313 0 0 0 12.192.814a4.269 4.269 0 0 0-3.622 1.13.837.837 0 0 1-1.14 0 4.272 4.272 0 0 0-6.21 5.855l5.916 7.05a1.128 1.128 0 0 0 1.727 0l5.916-7.05a4.228 4.228 0 0 0 .945-3.577z" fill="#1ED760"/>`;
    } else {
        fsFavSvg.innerHTML = `<path d="M1.626 3.161a2.766 2.766 0 0 1 3.91 0l.464.465.465-.465a2.766 2.766 0 0 1 3.91 3.91l-4.375 4.375-4.374-4.375a2.766 2.766 0 0 1 0-3.91zM2.686 4.22a1.266 1.266 0 0 0 0 1.79l3.315 3.314 3.314-3.314a1.266 1.266 0 0 0-1.79-1.79l-1.524 1.524-1.524-1.524a1.266 1.266 0 0 0-1.791 0z" fill="#fff"/>`;
    }
}

// Background Lock Screen Playback (Android MediaSession API)
function updateMediaSession() {
    if ('mediaSession' in navigator && currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist || 'SpotCry',
            album: currentTrack.album || 'SpotCry Library',
            artwork: [
                { src: currentTrack.cover_url || DEFAULT_COVER, sizes: '512x512', type: 'image/jpeg' }
            ]
        });

        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime && audio.duration) {
                audio.currentTime = details.seekTime;
            }
        });
    }
}

// ================= SPOTCRY CONNECT (REMOTE MODE) =================
function setupConnectMode() {
    const btnPhone = document.getElementById('btn-mode-phone');
    const btnRemote = document.getElementById('btn-mode-remote');
    const remoteBox = document.getElementById('pc-remote-control-box');

    btnPhone.addEventListener('click', () => {
        isRemoteMode = false;
        btnPhone.classList.add('active');
        btnRemote.classList.remove('active');
        remoteBox.style.display = 'none';
    });

    btnRemote.addEventListener('click', () => {
        isRemoteMode = true;
        btnRemote.classList.add('active');
        btnPhone.classList.remove('active');
        remoteBox.style.display = 'block';
        audio.pause();
        pollRemotePlayback();
    });

    document.getElementById('btn-remote-play').addEventListener('click', () => {
        fetch(`${API_BASE}/api/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'playPause' }) });
    });
    document.getElementById('btn-remote-prev').addEventListener('click', () => {
        fetch(`${API_BASE}/api/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'prev' }) });
    });
    document.getElementById('btn-remote-next').addEventListener('click', () => {
        fetch(`${API_BASE}/api/control`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'next' }) });
    });
}

async function pollRemotePlayback() {
    if (!isRemoteMode) return;
    try {
        const res = await fetch(`${API_BASE}/api/playback`);
        if (res.ok) {
            const data = await res.json();
            const infoEl = document.getElementById('remote-track-info');
            if (data.track) {
                infoEl.innerText = `${data.track.title} • ${data.track.artist || ''}`;
                document.getElementById('btn-remote-play').innerText = data.is_playing ? '⏸' : '▶';
            } else {
                infoEl.innerText = 'Nenhuma música tocando no PC';
            }
        }
    } catch(e) {}
    setTimeout(pollRemotePlayback, 2000);
}

function formatTime(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}
