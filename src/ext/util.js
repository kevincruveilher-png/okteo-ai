// Petits outils partagés par les extensions.
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// minuscules, sans accents : « Fenêtre » et « fenetre » se retrouvent
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function store(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function storeSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// Markdown minimal pour les réponses de l'assistant : **gras**, `code`, listes, titres, retours à la ligne.
// Les repères d'objets [a12], [r3]… deviennent des liens cliquables (data-obj).
export function md(text) {
  const lines = esc(text).split("\n");
  let html = "", list = null;
  const inline = (t) => t
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([anrsod]\d+(?:\s*,\s*[anrsod]\d+)*)\]/g, (m, ids) =>
      ids.split(/\s*,\s*/).map((id) => `<a href="#" class="obj" data-obj="${id}">${id}</a>`).join(", "));
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== "ul") { close(); html += "<ul>"; list = "ul"; } html += `<li>${inline(m[1])}</li>`; continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== "ol") { close(); html += "<ol>"; list = "ol"; } html += `<li>${inline(m[1])}</li>`; continue; }
    close();
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { html += `<h4>${inline(m[1])}</h4>`; continue; }
    if (l.trim() === "") { html += "<div class=\"gap\"></div>"; continue; }
    html += `<p>${inline(l)}</p>`;
  }
  close();
  return html;
}
