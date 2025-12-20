export async function loadCSV(filename) {
    return await d3.csv(`./datasets/${filename}`, d3.autoType);
}