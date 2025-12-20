export async function loadHtml(id, path) {
    const response = await fetch(path);
    const text = await response.text();
    document.getElementById(id).innerHTML = text;
}