const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { identifyGenre } = require('./genreClassifier');

function getCoverHash(buffer) {
    return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Look for folder cover art image in the same directory
 */
function findFolderCover(dirPath) {
    try {
        const coverNames = [
            'cover.jpg', 'cover.png', 'cover.jpeg',
            'folder.jpg', 'folder.png', 'folder.jpeg',
            'front.jpg', 'front.png', 'front.jpeg',
            'album.jpg', 'album.png', 'album.jpeg',
            'art.jpg', 'artwork.jpg'
        ];

        for (const name of coverNames) {
            const candidate = path.join(dirPath, name);
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        // Check any first jpg/png image in the directory
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
                return path.join(dirPath, file);
            }
        }
    } catch (e) {}
    return null;
}

/**
 * Smart Folder & Filename Parser
 * Extracts artist, album, track number and clean title from directory hierarchy and filename
 */
function parsePathHints(filePath) {
    let fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const parentDir = path.basename(path.dirname(filePath));
    const grandParentDir = path.basename(path.dirname(path.dirname(filePath)));

    let trackNo = 0;

    // 1. Detect Track Number from filename prefix (e.g. "01 - Title", "01. Title", "01 Title", "01_Title", "1- Title")
    const trackMatch = fileNameWithoutExt.match(/^(\d{1,3})[\s\.\-_]+(.*)$/);
    if (trackMatch) {
        trackNo = parseInt(trackMatch[1], 10);
        fileNameWithoutExt = trackMatch[2].trim();
    }

    // Clean underscores and multiple spaces into clean readable title
    let cleanTitle = fileNameWithoutExt.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    let artistHint = '';
    let albumHint = '';

    // 2. Detect "Artist - Title" or "Artist - Track - Title" in filename
    if (cleanTitle.includes(' - ')) {
        const parts = cleanTitle.split(' - ').map(p => p.trim());
        if (parts.length === 2) {
            artistHint = parts[0];
            cleanTitle = parts[1];
        } else if (parts.length >= 3) {
            artistHint = parts[0];
            if (/^\d{1,3}$/.test(parts[1])) {
                trackNo = parseInt(parts[1], 10);
                cleanTitle = parts.slice(2).join(' - ');
            } else {
                albumHint = parts[1];
                cleanTitle = parts.slice(2).join(' - ');
            }
        }
    }

    // 3. Album & Artist from Parent Directory
    if (parentDir && parentDir !== '.' && parentDir !== '/' && parentDir !== '\\') {
        albumHint = parentDir.replace(/_/g, ' ').trim();
        if (albumHint.includes(' - ')) {
            const dirParts = albumHint.split(' - ').map(p => p.trim());
            if (dirParts.length >= 2) {
                if (!artistHint) artistHint = dirParts[0];
                albumHint = dirParts.slice(1).join(' - ');
            }
        }
    }

    // 4. Artist from Grandparent Directory if parent is album
    if (grandParentDir && grandParentDir.length > 1 && !grandParentDir.includes(':')) {
        if (!artistHint) {
            artistHint = grandParentDir.replace(/_/g, ' ').trim();
        }
    }

    return {
        trackNo,
        cleanTitle,
        artistHint,
        albumHint
    };
}

async function extractMetadata(filePath, appDataPath) {
    const pathHints = parsePathHints(filePath);
    const fileDir = path.dirname(filePath);

    try {
        const mm = await import('music-metadata');
        const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
        
        const common = metadata.common || {};
        const format = metadata.format || {};
        
        let coverPath = null;
        if (common.picture && common.picture.length > 0) {
            const picture = common.picture[0];
            const hash = getCoverHash(picture.data);
            const coversDir = path.join(appDataPath, 'cache', 'covers');
            
            if (!fs.existsSync(coversDir)) {
                fs.mkdirSync(coversDir, { recursive: true });
            }
            
            let ext = '.jpg';
            if (picture.format === 'image/png') ext = '.png';
            
            coverPath = path.join(coversDir, `${hash}${ext}`);
            if (!fs.existsSync(coverPath)) {
                fs.writeFileSync(coverPath, picture.data);
            }
        } else {
            // Fallback to folder image if no embedded ID3 cover
            coverPath = findFolderCover(fileDir);
        }

        // Resolve Title (clean underscores if needed)
        let title = (common.title && common.title.trim()) ? common.title.trim() : pathHints.cleanTitle;
        if (title.includes('_')) title = title.replace(/_/g, ' ').trim();

        // Resolve Artist
        let artist = common.artist || common.albumartist;
        if (!artist || artist === 'Unknown Artist' || artist === 'Desconhecido') {
            artist = pathHints.artistHint || 'Artista Desconhecido';
        }

        // Resolve Album
        let album = common.album;
        if (!album || album === 'Unknown Album' || album === 'Desconhecido') {
            album = pathHints.albumHint || 'Álbum Desconhecido';
        }

        // Resolve Track Number
        let trackNumber = 0;
        if (common.track && common.track.no) {
            trackNumber = common.track.no;
        } else {
            trackNumber = pathHints.trackNo;
        }

        const rawGenre = common.genre ? common.genre.join(', ') : '';
        const identifiedGenre = identifyGenre({
            title,
            artist,
            album,
            file_path: filePath,
            genre: rawGenre
        });

        return {
            file_path: filePath,
            title,
            artist,
            album,
            genre: identifiedGenre,
            year: common.year || 0,
            track_number: trackNumber,
            duration: format.duration || 0,
            cover_path: coverPath
        };
    } catch (error) {
        const fallbackCover = findFolderCover(fileDir);
        const fallbackGenre = identifyGenre({
            title: pathHints.cleanTitle,
            artist: pathHints.artistHint,
            album: pathHints.albumHint,
            file_path: filePath,
            genre: ''
        });

        return {
            file_path: filePath,
            title: pathHints.cleanTitle,
            artist: pathHints.artistHint || 'Artista Desconhecido',
            album: pathHints.albumHint || 'Álbum Desconhecido',
            genre: fallbackGenre,
            year: 0,
            track_number: pathHints.trackNo,
            duration: 0,
            cover_path: fallbackCover
        };
    }
}

module.exports = { extractMetadata, parsePathHints };
