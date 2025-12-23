export async function loadHtml(id, path) {

        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const text = await response.text();
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = text;
        } else {
            console.warn(`Container con id '${id}' non trovato`);
        }

}

export async function renderGraph(id, renderFunction, datasets) {
  const container = document.getElementById(id);
  renderFunction(container, datasets);
}