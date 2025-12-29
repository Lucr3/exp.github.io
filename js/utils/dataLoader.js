import { CACHE_VERSION } from '../config.js';

export async function loadCSV(filename) {
    return await d3.csv(`./datasets/${filename}?v=${CACHE_VERSION}`, d3.autoType);
}