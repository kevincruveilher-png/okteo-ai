// Notice dans le logiciel (06/11/2026) — petit lecteur de Markdown pour src/aide/notice.md, sans bibliothèque.
// Pur : titres #, ##, ###, paragraphes, listes « - » et « 1. », tableaux « | », **gras**, [lien](https://…).
// Tout le texte est échappé ; seuls les liens https sont gardés.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function slug(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "s"; }
export function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s"]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
const cells = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

// → { html, toc: [{id, t, lvl}] } ; chaque partie (##) est une <section data-s="id">
export function renderNotice(md) {
  const L = String(md || "").replace(/\r/g, "").split("\n"), out = [], toc = [], used = new Set();
  let i = 0, open = false;
  const idOf = (t) => { let b = slug(t), k = b, n = 2; while (used.has(k)) k = b + "-" + n++; used.add(k); return k; };
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) {
      const lvl = h[1].length, t = h[2].trim(), id = idOf(t);
      if (lvl === 2) { if (open) out.push("</section>"); out.push(`<section data-s="${id}">`); open = true; }
      if (lvl > 1) toc.push({ id, t, lvl });
      out.push(`<h${lvl} id="aide-${id}">${inline(t)}</h${lvl}>`); i++; continue;
    }
    if (/^\s*\|/.test(l)) {
      const rows = [];
      while (i < L.length && /^\s*\|/.test(L[i])) rows.push(L[i++]);
      const head = cells(rows[0]), body = rows.slice(/^\s*\|[\s|:-]+\|\s*$/.test(rows[1] || "") ? 2 : 1).map(cells);
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    const li = /^\s*(-|\d+\.)\s+/;
    if (li.test(l)) {
      const ord = /^\s*\d+\./.test(l), items = [];
      while (i < L.length && li.test(L[i])) items.push(L[i++].replace(li, ""));
      out.push(`<${ord ? "ol" : "ul"}>${items.map((x) => `<li>${inline(x)}</li>`).join("")}</${ord ? "ol" : "ul"}>`);
      continue;
    }
    const p = [];
    while (i < L.length && L[i].trim() && !/^(#{1,3}\s|\s*\||\s*(-|\d+\.)\s)/.test(L[i])) p.push(L[i++].trim());
    out.push(`<p>${inline(p.join(" "))}</p>`);
  }
  if (open) out.push("</section>");
  return { html: out.join(""), toc };
}

// recherche : parties qui contiennent tous les mots (sans accents ni majuscules)
const plain = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function matches(text, q) { const t = plain(text); return plain(q).split(/\s+/).filter(Boolean).every((w) => t.includes(w)); }
