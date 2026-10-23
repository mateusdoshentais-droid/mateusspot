const artistService = require('./artistService');

let smartRecsCache = null;
let smartRecsCacheTime = 0;
const SMART_RECS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Spotify-Style Recommendation & Audio Discovery Engine
 * Analyzes listening history, explicit likes, genres, artists, eras and freshness.
 */

class RecommendationEngine {
    constructor() {}

    invalidateRecommendationsCache() {
        smartRecsCache = null;
        smartRecsCacheTime = 0;
    }

    /**
     * Build User Affinity Profile from library and playback data
     */
    buildUserProfile(tracks) {
        const artistScores = {};
        const genreScores = {};
        const eraScores = {};
        let totalPlays = 0;
        let totalFavorites = 0;

        const now = Date.now();

        tracks.forEach(track => {
            const playCount = track.play_count || 0;
            const isFav = track.is_favorite ? 1 : 0;
            const lastPlayed = track.last_played ? new Date(track.last_played).getTime() : 0;

            if (playCount > 0) totalPlays += playCount;
            if (isFav) totalFavorites += 1;

            // Recency multiplier (played recently gives higher vibe weight)
            let recencyWeight = 1.0;
            if (lastPlayed > 0) {
                const daysDiff = (now - lastPlayed) / (1000 * 60 * 60 * 24);
                if (daysDiff < 2) recencyWeight = 2.0;
                else if (daysDiff < 7) recencyWeight = 1.5;
                else if (daysDiff < 30) recencyWeight = 1.2;
            }

            // Weight contribution of this track
            const trackWeight = ((isFav * 4.0) + Math.log2(1 + playCount) * 1.5 + 0.1) * recencyWeight;

            // 1. Artist Affinity
            if (track.artist && track.artist !== 'Desconhecido') {
                const art = track.artist.trim();
                artistScores[art] = (artistScores[art] || 0) + trackWeight;
            }

            // 2. Genre Affinity
            if (track.genre && track.genre !== 'Unknown') {
                const genres = track.genre.split(/[,/;&]/).map(g => g.trim().toLowerCase()).filter(Boolean);
                genres.forEach(g => {
                    genreScores[g] = (genreScores[g] || 0) + trackWeight;
                });
            }

            // 3. Era Affinity
            if (track.year && track.year > 1900) {
                const decade = Math.floor(track.year / 10) * 10;
                eraScores[decade] = (eraScores[decade] || 0) + trackWeight;
            }
        });

        return {
            artistScores,
            genreScores,
            eraScores,
            totalPlays,
            totalFavorites
        };
    }

    /**
     * Scores every track in library according to recommendation signals
     */
    scoreTracks(tracks, userProfile) {
        const { artistScores, genreScores, eraScores } = userProfile;
        const now = Date.now();

        return tracks.map(track => {
            let score = 0;
            const playCount = track.play_count || 0;
            const isFav = track.is_favorite ? 1 : 0;

            // Signal 1: Artist Match (Weight: 3.5)
            if (track.artist && artistScores[track.artist.trim()]) {
                score += Math.min(artistScores[track.artist.trim()], 20) * 3.5;
            }

            // Signal 2: Genre Match (Weight: 2.5)
            if (track.genre) {
                const genres = track.genre.split(/[,/;&]/).map(g => g.trim().toLowerCase()).filter(Boolean);
                genres.forEach(g => {
                    if (genreScores[g]) {
                        score += Math.min(genreScores[g], 15) * 2.5;
                    }
                });
            }

            // Signal 3: Era Match (Weight: 1.5)
            if (track.year && track.year > 1900) {
                const decade = Math.floor(track.year / 10) * 10;
                if (eraScores[decade]) {
                    score += Math.min(eraScores[decade], 10) * 1.5;
                }
            }

            // Signal 4: Discovery Gem (Serendipity)
            // Reward unplayed or rarely-played songs from favorite artists/genres
            if (playCount === 0 && score > 5) {
                score += 8.0; // Big boost for unplayed gems
            } else if (playCount <= 2 && score > 5) {
                score += 4.0;
            }

            // Signal 5: Freshness (Recently added to library)
            if (track.date_added) {
                const addedDays = (now - new Date(track.date_added).getTime()) / (1000 * 60 * 60 * 24);
                if (addedDays < 7) score += 3.0;
                else if (addedDays < 30) score += 1.5;
            }

            // Signal 6: Controlled Favorite Boost
            if (isFav) {
                score += 5.0;
            }

            // Add small organic noise to prevent static ranking
            const organicJitter = (Math.random() - 0.5) * 2.0;
            score += organicJitter;

            return {
                track,
                score
            };
        });
    }

    /**
     * Returns top recommended tracks with diversity filtering
     */
    getRecommendedTracks(tracks, limit = 20) {
        if (!tracks || tracks.length === 0) return [];

        const profile = this.buildUserProfile(tracks);
        const scored = this.scoreTracks(tracks, profile);

        // Sort descending by calculated score
        scored.sort((a, b) => b.score - a.score);

        // Apply diversity constraint: Max 2-3 tracks per artist in the top recommendations
        const artistCounts = {};
        const diverseResult = [];

        for (const item of scored) {
            const artist = (item.track.artist || 'Desconhecido').toLowerCase();
            artistCounts[artist] = (artistCounts[artist] || 0) + 1;

            if (artistCounts[artist] <= 2) {
                diverseResult.push(item.track);
            }
            if (diverseResult.length >= limit) break;
        }

        // If not enough diverse tracks, fill up with remaining highest scored
        if (diverseResult.length < limit) {
            for (const item of scored) {
                if (!diverseResult.includes(item.track)) {
                    diverseResult.push(item.track);
                }
                if (diverseResult.length >= limit) break;
            }
        }

        return diverseResult;
    }

    /**
     * Generates Curated "Daily Mixes" tailored to the user's library with real covers and Spotify metadata
     */
    generateDailyMixes(tracks) {
        if (!tracks || tracks.length === 0) return [];

        const profile = this.buildUserProfile(tracks);
        const topArtists = Object.keys(profile.artistScores || {})
            .sort((a, b) => profile.artistScores[b] - profile.artistScores[a])
            .slice(0, 5);

        const findBestCover = (mixTracks) => {
            if (!mixTracks || mixTracks.length === 0) return null;
            const withCover = mixTracks.filter(t => t.cover_path);
            if (withCover.length === 0) return null;
            const playedWithCover = withCover.filter(t => (t.play_count || 0) > 0).sort((a, b) => (b.play_count || 0) - (a.play_count || 0));
            return playedWithCover.length > 0 ? playedWithCover[0].cover_path : withCover[0].cover_path;
        };

        const getSubtitle = (mixTracks, fallbackDesc) => {
            const artists = [...new Set((mixTracks || []).map(t => t.artist).filter(Boolean))].slice(0, 3);
            if (artists.length >= 2) {
                return `Com ${artists.slice(0, 2).join(', ')} e mais`;
            } else if (artists.length === 1) {
                return `Com ${artists[0]} e outros`;
            }
            return fallbackDesc || 'Mix personalizado para você';
        };

        const mixes = [];

        // Mix 1: "Mix Descobertas" (Hidden Gems & Unplayed)
        const unplayedTracks = tracks.filter(t => (t.play_count || 0) === 0);
        if (unplayedTracks.length > 0) {
            const shuffledUnplayed = [...unplayedTracks].sort(() => Math.random() - 0.5).slice(0, 25);
            mixes.push({
                id: 'mix-discover',
                title: 'Descobertas da Semana',
                type: 'Mix Personalizado',
                desc: 'Músicas da sua biblioteca que você ainda não explorou',
                subtitle: getSubtitle(shuffledUnplayed, 'Músicas que você ainda não explorou'),
                cover_path: findBestCover(shuffledUnplayed),
                color: '#1DB954',
                gradient: 'linear-gradient(135deg, #1DB954 0%, #1e3264 100%)',
                tracks: shuffledUnplayed
            });
        }

        // Mix 2: "Mix Favoritos & Vibe"
        const favAndPlayed = tracks.filter(t => t.is_favorite || (t.play_count && t.play_count > 0));
        if (favAndPlayed.length > 0) {
            const favMix = [...favAndPlayed].sort((a, b) => (b.play_count || 0) - (a.play_count || 0)).slice(0, 30);
            mixes.push({
                id: 'mix-heavy-rotation',
                title: 'No Repeat / Em Alta',
                type: 'Mix Personalizado',
                desc: 'As faixas que não saem dos seus fones de ouvido',
                subtitle: getSubtitle(favMix, 'As faixas mais tocadas por você'),
                cover_path: findBestCover(favMix),
                color: '#e8115b',
                gradient: 'linear-gradient(135deg, #e8115b 0%, #331020 100%)',
                tracks: favMix
            });
        }

        // Mix 3: Artist-specific spotlight mix 1
        if (topArtists.length > 0) {
            const favoriteArtist = topArtists[0];
            const artistTracks = tracks.filter(t => t.artist && t.artist.toLowerCase() === favoriteArtist.toLowerCase());
            if (artistTracks.length >= 2) {
                const similar = this.getSimilarTracks(artistTracks[0], tracks, 15);
                const combined = [...new Set([...artistTracks, ...similar])].slice(0, 25);
                mixes.push({
                    id: 'mix-artist-spotlight-1',
                    title: `Mix de ${favoriteArtist}`,
                    type: 'Mix de Artista',
                    desc: `As melhores faixas de ${favoriteArtist} e similares`,
                    subtitle: getSubtitle(combined, `O melhor de ${favoriteArtist}`),
                    cover_path: findBestCover(artistTracks) || findBestCover(combined),
                    color: '#450af5',
                    gradient: 'linear-gradient(135deg, #450af5 0%, #8e8ee5 100%)',
                    tracks: combined
                });
            }
        }

        // Mix 4: Artist-specific spotlight mix 2
        if (topArtists.length > 1) {
            const secondArtist = topArtists[1];
            const artistTracks2 = tracks.filter(t => t.artist && t.artist.toLowerCase() === secondArtist.toLowerCase());
            if (artistTracks2.length >= 2) {
                const similar2 = this.getSimilarTracks(artistTracks2[0], tracks, 15);
                const combined2 = [...new Set([...artistTracks2, ...similar2])].slice(0, 25);
                mixes.push({
                    id: 'mix-artist-spotlight-2',
                    title: `Mix de ${secondArtist}`,
                    type: 'Mix de Artista',
                    desc: `As melhores faixas de ${secondArtist} e similares`,
                    subtitle: getSubtitle(combined2, `O melhor de ${secondArtist}`),
                    cover_path: findBestCover(artistTracks2) || findBestCover(combined2),
                    color: '#f59e0b',
                    gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                    tracks: combined2
                });
            }
        }

        return mixes;
    }

    /**
     * Similar Track Radio: Given a seed track, find closest matching tracks in library
     */
    getSimilarTracks(seedTrack, allTracks, limit = 20) {
        if (!seedTrack || !allTracks) return [];

        const candidates = allTracks.filter(t => t.id !== seedTrack.id);
        const scored = candidates.map(t => {
            let sim = 0;
            // Exact same artist
            if (t.artist && seedTrack.artist && t.artist.toLowerCase() === seedTrack.artist.toLowerCase()) {
                sim += 50;
            }
            // Same album
            if (t.album && seedTrack.album && t.album.toLowerCase() === seedTrack.album.toLowerCase()) {
                sim += 30;
            }
            // Same genre
            if (t.genre && seedTrack.genre && t.genre.toLowerCase() === seedTrack.genre.toLowerCase()) {
                sim += 20;
            }
            // Same decade
            if (t.year && seedTrack.year && Math.abs(t.year - seedTrack.year) <= 5) {
                sim += 10;
            }
            // Duration similarity (within 30 seconds)
            if (t.duration && seedTrack.duration && Math.abs(t.duration - seedTrack.duration) < 30) {
                sim += 5;
            }

            return { track: t, sim: sim + Math.random() * 2 };
        });

        scored.sort((a, b) => b.sim - a.sim);
        return scored.slice(0, limit).map(s => s.track);
    }

    /**
     * Intelligent Hybrid Music Recommendation System
     * Combines SpotCry local scoring engine with real YouTube Music / Deezer discovery.
     */
    async getSmartRecommendations(db, options = {}) {
        const now = Date.now();
        if (!options.forceRefresh && smartRecsCache && (now - smartRecsCacheTime) < SMART_RECS_CACHE_TTL) {
            return smartRecsCache;
        }

        const userPrefs = db ? db.getUserPreferences() : { hasPreferences: false, topArtists: [], topGenres: [], topTracks: [], recentPlays: [] };
        const allTracks = db ? (db.getAllTracks() || []) : [];
        const favorites = db ? (db.getFavorites() || []) : [];

        // 1. Handle Cold Start (New Users or empty preferences)
        if (!userPrefs.hasPreferences) {
            const charts = await artistService.getOnlineCharts().catch(() => ({ tracks: [], artists: [], albums: [] }));
            const chartTracks = charts.tracks || [];
            const chartArtists = charts.artists || [];

            smartRecsCache = {
                hasPreferences: false,
                isColdStart: true,
                message: "Músicas e artistas em alta no momento. Conforme você curtir músicas e ouvir faixas, o SpotCry aprenderá suas preferências reais para criar recomendações exclusivas.",
                summary: {
                    topArtists: [],
                    topGenres: []
                },
                categories: {
                    madeForYou: {
                        id: 'cat-made-for-you',
                        title: 'Feito para você',
                        badge: 'Em Alta',
                        subtitle: 'Seleção em alta no momento (curta músicas para personalizar)',
                        tracks: chartTracks.slice(0, 12)
                    },
                    similarArtists: {
                        id: 'cat-similar-artists',
                        title: 'Artistas semelhantes',
                        badge: 'Destaques',
                        subtitle: 'Artistas mais populares do momento no mundo',
                        artists: chartArtists.slice(0, 10)
                    },
                    newDiscoveries: {
                        id: 'cat-new-discoveries',
                        title: 'Novas descobertas',
                        badge: 'Novidades',
                        subtitle: 'Faixas em ascensão para você explorar',
                        tracks: chartTracks.slice(12, 24)
                    },
                    moreOfWhatYouLike: {
                        id: 'cat-more-liked',
                        title: 'Mais do que você curte',
                        badge: 'Top Hits',
                        subtitle: 'Grandes sucessos mundiais',
                        tracks: chartTracks.slice(0, 10)
                    },
                    continueExploring: {
                        id: 'cat-continue-exploring',
                        title: 'Continue explorando',
                        badge: 'Explorar',
                        subtitle: 'Comece a ouvir para gerar recomendações a partir do seu histórico',
                        tracks: chartTracks.slice(5, 17)
                    }
                }
            };
            smartRecsCacheTime = now;
            return smartRecsCache;
        }

        // 2. Personalized Experience (User has recorded preferences)
        const topArtists = (userPrefs.topArtists || []).slice(0, 5);
        const topGenres = (userPrefs.topGenres || []).slice(0, 4);
        const recentPlays = (userPrefs.recentPlays || []).slice(0, 5);
        const weights = userPrefs.weights || { likeTrack: 5, likeArtist: 5, repeatTrack: 4, completedPlay: 3, fastSkip: -2, dislikeTrack: -5 };

        // A. Discover authentic Related Artists from Deezer for the top preferred artists
        const relatedPromises = topArtists.slice(0, 3).map(a => artistService.getRelatedArtists(a.name, 6).catch(() => []));
        const relatedArrays = await Promise.all(relatedPromises);
        const discoveredArtistsMap = new Map();

        relatedArrays.flat().forEach(art => {
            if (art && art.id && !discoveredArtistsMap.has(String(art.id))) {
                // Exclude the user's top artists themselves from "similar artists" so discovery is real
                const isAlreadyTop = topArtists.some(t => t.name.toLowerCase() === (art.name || '').toLowerCase());
                if (!isAlreadyTop) {
                    discoveredArtistsMap.set(String(art.id), art);
                }
            }
        });

        let discoveredArtists = Array.from(discoveredArtistsMap.values());
        if (discoveredArtists.length === 0) {
            // Fallback to top artists from charts if related returns empty
            const fallbackCharts = await artistService.getOnlineCharts().catch(() => ({ artists: [] }));
            discoveredArtists = (fallbackCharts.artists || []).slice(0, 8);
        }

        // B. Fetch real candidate tracks from top preferred artists and discovered related artists
        const candidateTracksPromises = [];
        // Top tracks for user's favorite artists
        for (const ta of topArtists.slice(0, 3)) {
            candidateTracksPromises.push(
                artistService.getArtistInfo(ta.name)
                    .then(info => info ? artistService.getArtistTopTracks(info.id, 8) : [])
                    .catch(() => [])
            );
        }
        // Top tracks for discovered related artists
        for (const ra of discoveredArtists.slice(0, 4)) {
            candidateTracksPromises.push(
                artistService.getArtistTopTracks(ra.id, 6).catch(() => [])
            );
        }

        const candidateTracksArrays = await Promise.all(candidateTracksPromises);
        const onlineCandidates = candidateTracksArrays.flat().filter(Boolean);

        // C. Combine with user's library and favorites
        const trackPoolMap = new Map();
        const makeTrackKey = (t) => {
            const art = (t.artist || '').trim().toLowerCase();
            const tit = (t.title || '').trim().toLowerCase();
            return `${art}___${tit}`;
        };

        // Add favorites first
        favorites.forEach(t => trackPoolMap.set(makeTrackKey(t), { ...t, is_favorite: true }));
        // Add library tracks with plays
        allTracks.filter(t => (t.play_count || 0) > 0).forEach(t => {
            const k = makeTrackKey(t);
            if (!trackPoolMap.has(k)) trackPoolMap.set(k, t);
        });
        // Add online candidates
        onlineCandidates.forEach(t => {
            const k = makeTrackKey(t);
            if (!trackPoolMap.has(k)) trackPoolMap.set(k, t);
        });

        const allCandidates = Array.from(trackPoolMap.values());

        // D. SpotCry Scoring Function
        const calculateScore = (track) => {
            let score = 0;
            const trackId = String(track.id);
            const artistName = (track.artist || '').trim().toLowerCase();

            // Track direct score from preferences
            const prefTrack = userPrefs.topTracks ? userPrefs.topTracks.find(t => String(t.id) === trackId) : null;
            if (prefTrack) {
                score += prefTrack.score * 1.5;
            }

            // Artist match from preferences
            const prefArtist = topArtists.find(a => a.name.toLowerCase() === artistName);
            if (prefArtist) {
                score += Math.min(prefArtist.score, 30) * 1.8;
            }

            // Related artist affinity
            const isRelated = discoveredArtists.some(ra => ra.name.toLowerCase() === artistName);
            if (isRelated) {
                score += 10.0;
            }

            // Genre match
            if (track.genre) {
                const prefGenre = topGenres.find(g => g.name.toLowerCase() === track.genre.toLowerCase());
                if (prefGenre) {
                    score += Math.min(prefGenre.score, 20) * 1.3;
                }
            }

            // Favorite boost
            if (track.is_favorite) {
                score += (weights.likeTrack || 5) * 1.4;
            }

            // Repetition boost
            if (track.play_count && track.play_count > 1) {
                score += (weights.repeatTrack || 4);
            }

            // Recency boost
            if (track.last_played) {
                const daysAgo = (now - new Date(track.last_played).getTime()) / (1000 * 60 * 60 * 24);
                if (daysAgo < 2) score += 4.0;
                else if (daysAgo < 7) score += 2.0;
            }

            // Discovery boost for unplayed related tracks
            if (!track.play_count && isRelated) {
                score += 7.0;
            }

            // Small organic noise (+- 0.5) to keep it lively
            score += (Math.random() - 0.5) * 1.0;
            return score;
        };

        const scoredCandidates = allCandidates.map(t => ({
            track: t,
            score: calculateScore(t)
        })).sort((a, b) => b.score - a.score);

        // Helper for diverse selection (max 2 tracks per artist)
        const pickDiverse = (list, count, filterFn = null) => {
            const artistCount = {};
            const result = [];
            for (const item of list) {
                const t = item.track || item;
                if (filterFn && !filterFn(t)) continue;
                const art = (t.artist || 'Desconhecido').toLowerCase();
                artistCount[art] = (artistCount[art] || 0) + 1;
                if (artistCount[art] <= 2) {
                    result.push(t);
                }
                if (result.length >= count) break;
            }
            return result;
        };

        // 1. Feito para você (Personalized selection of top scored candidates)
        const madeForYouTracks = pickDiverse(scoredCandidates, 12);

        // 2. Artistas semelhantes (Related artists discovered from favorite artists)
        const similarArtistsList = discoveredArtists.slice(0, 10);

        // 3. Novas descobertas (Unplayed tracks from related artists)
        const recentIds = new Set(recentPlays.map(r => String(r.id)));
        const discoveryCandidates = scoredCandidates.filter(item => {
            const t = item.track;
            const isPlayed = (t.play_count && t.play_count > 0) || recentIds.has(String(t.id));
            const isRelated = discoveredArtists.some(ra => ra.name.toLowerCase() === (t.artist || '').toLowerCase());
            return !isPlayed || isRelated;
        });
        const newDiscoveriesTracks = pickDiverse(discoveryCandidates, 12);

        // 4. Mais do que você curte (Tracks matching recurring preferences: top genres and favorite artists)
        const topArtistNames = new Set(topArtists.map(a => a.name.toLowerCase()));
        const topGenreNames = new Set(topGenres.map(g => g.name.toLowerCase()));
        const moreOfWhatYouLikeTracks = pickDiverse(scoredCandidates, 12, (t) => {
            const art = (t.artist || '').toLowerCase();
            const gen = (t.genre || '').toLowerCase();
            return topArtistNames.has(art) || topGenreNames.has(gen) || t.is_favorite;
        });

        // 5. Continue explorando (Seeded by the last 3 played tracks)
        let continueExploringTracks = [];
        if (recentPlays.length > 0) {
            const recentArtists = new Set(recentPlays.slice(0, 3).map(r => (r.artist || '').toLowerCase()));
            const continueCandidates = scoredCandidates.filter(item => {
                const t = item.track;
                const art = (t.artist || '').toLowerCase();
                const wasRecent = recentPlays.some(rp => String(rp.id) === String(t.id));
                return !wasRecent && (recentArtists.has(art) || discoveredArtists.some(ra => ra.name.toLowerCase() === art));
            });
            continueExploringTracks = pickDiverse(continueCandidates, 12);
        }
        if (continueExploringTracks.length < 6) {
            continueExploringTracks = pickDiverse(scoredCandidates.slice(6), 12);
        }

        const favArtistNames = topArtists.slice(0, 2).map(a => a.name).join(' e ');

        smartRecsCache = {
            hasPreferences: true,
            isColdStart: false,
            message: `Recomendações personalizadas com base em ${topArtists.length} artistas e ${favorites.length} músicas curtidas.`,
            summary: {
                topArtists: topArtists.map(a => a.name),
                topGenres: topGenres.map(g => g.name)
            },
            categories: {
                madeForYou: {
                    id: 'cat-made-for-you',
                    title: 'Feito para você',
                    badge: 'Personalizado',
                    subtitle: favArtistNames ? `Com ${favArtistNames} e artistas semelhantes` : 'Músicas selecionadas especialmente para seu gosto',
                    tracks: madeForYouTracks
                },
                similarArtists: {
                    id: 'cat-similar-artists',
                    title: 'Artistas semelhantes',
                    badge: 'Recomendados',
                    subtitle: favArtistNames ? `Baseado em ${favArtistNames}` : 'Artistas que combinam com seu estilo musical',
                    artists: similarArtistsList
                },
                newDiscoveries: {
                    id: 'cat-new-discoveries',
                    title: 'Novas descobertas',
                    badge: 'Descobertas',
                    subtitle: 'Músicas de artistas relacionados que você ainda não explorou',
                    tracks: newDiscoveriesTracks
                },
                moreOfWhatYouLike: {
                    id: 'cat-more-liked',
                    title: 'Mais do que você curte',
                    badge: 'Mais Ouvidos',
                    subtitle: 'Baseado nos seus estilos, gêneros e artistas favoritos',
                    tracks: moreOfWhatYouLikeTracks
                },
                continueExploring: {
                    id: 'cat-continue-exploring',
                    title: 'Continue explorando',
                    badge: 'Recentes',
                    subtitle: 'Recomendações geradas a partir das suas últimas audições',
                    tracks: continueExploringTracks
                }
            }
        };
        smartRecsCacheTime = now;
        return smartRecsCache;
    }
}

module.exports = new RecommendationEngine();
