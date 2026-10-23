const fs = require('fs').promises;
const path = require('path');
const db = require('../database/db');
const { extractMetadata } = require('./metadata');

const SUPPORTED_EXTENSIONS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg']);

async function getAudioFiles(dir) {
    let results = [];
    try {
        const list = await fs.readdir(dir, { withFileTypes: true });
        for (const file of list) {
            const res = path.resolve(dir, file.name);
            if (file.isDirectory()) {
                const subFiles = await getAudioFiles(res);
                results = results.concat(subFiles);
            } else {
                if (SUPPORTED_EXTENSIONS.has(path.extname(res).toLowerCase())) {
                    results.push(res);
                }
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }
    return results;
}

// Yield execution to allow Electron UI thread to breathe
function yieldToEventLoop() {
    return new Promise(resolve => setImmediate(resolve));
}

async function scanLibrary(folders, appDataPath, progressCallback) {
    let allFiles = [];
    
    // Find all files
    for (const folder of folders) {
        const files = await getAudioFiles(folder);
        allFiles = allFiles.concat(files);
    }
    
    const total = allFiles.length;
    let current = 0;
    const CHUNK_SIZE = 8; // Process 8 tracks concurrently
    
    for (let i = 0; i < total; i += CHUNK_SIZE) {
        const chunk = allFiles.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (file) => {
            try {
                const metadata = await extractMetadata(file, appDataPath);
                db.insertOrUpdateTrack(metadata, false);
            } catch (e) {
                console.error(`Failed scanning ${file}:`, e);
            }
            current++;
            if (progressCallback && current % 10 === 0) {
                progressCallback(current, total);
            }
        }));

        // Yield CPU every chunk
        await yieldToEventLoop();
    }

    if (progressCallback) {
        progressCallback(total, total);
    }
    
    db.deleteMissingTracks(allFiles);
    db.saveBatch();
}

async function scanSingleFile(filePath, appDataPath) {
    if (SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
        const metadata = await extractMetadata(filePath, appDataPath);
        db.insertOrUpdateTrack(metadata, true);
        return true;
    }
    return false;
}

function removeSingleFile(filePath) {
    return db.removeTrackByPath(filePath);
}

module.exports = { scanLibrary, scanSingleFile, removeSingleFile };
