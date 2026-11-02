// Lecture des plans FTZ vectoriels (fondation de la charte du plan, v74) — sans dépendance.
// Entrée : un PDF décompressé par qpdf (`qpdf --qdf --object-streams=disable plan.pdf plan-qdf.pdf`).
// Sortie : pour chaque page, les tracés {pts, ops, stroke, fill, w, dash} et les textes {str, font, size, sx, sy, angle,
// x, y, color}, en points PDF (origine en bas à gauche), état graphique complet (cm, q/Q). Les plans de référence du BE
// ne vont pas dans le dépôt (vrais clients) : seule la charte qu'on en déduit y est enregistrée.
import fs from "node:fs";

const num = (t) => typeof t === "number";

export function readQdf(file) {
  const d = fs.readFileSync(file).toString("latin1");
  const obj = (id) => { const m = new RegExp(`\\n${id} 0 obj\\n([\\s\\S]*?)\\nendobj`).exec(d); return m ? m[1] : ""; };
  const streamOf = (id) => { const m = new RegExp(`\\n${id} 0 obj\\n[\\s\\S]*?\\nstream\\n([\\s\\S]*?)\\nendstream`).exec(d); return m ? m[1] : ""; };
  const pages = [...d.matchAll(/%% Page (\d+)\n%% Original object ID: [^\n]*\n(\d+) 0 obj\n([\s\S]*?)\nendobj/g)].map((m) => {
    const body = m[3];
    const box = /\/MediaBox \[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(body).slice(1).map(Number);
    const rot = +((/\/Rotate (\d+)/.exec(body) || [0, 0])[1]);
    const cont = /\/Contents (\d+) 0 R/.exec(body);
    const ids = cont ? [cont[1]] : (/\/Contents \[([^\]]*)\]/.exec(body)[1].match(/(\d+) 0 R/g) || []).map((x) => x.split(" ")[0]);
    const fonts = {};
    const fb = /\/Font <<([\s\S]*?)>>/.exec(body);
    if (fb) for (const f of fb[1].matchAll(/\/(\S+) (\d+) 0 R/g)) fonts[f[1]] = (/\/BaseFont \/(\S+)/.exec(obj(f[2])) || [0, "?"])[1];
    return { n: +m[1], box, rot, fonts, content: ids.map(streamOf).join("\n") };
  });
  return pages;
}

// ---------- jetons du flux de contenu ----------
function tokens(s) {
  const out = []; let i = 0; const n = s.length;
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < n && s[i] !== "\n") i++; continue; }
    if (c === "(") {
      let depth = 1, j = i + 1, str = "";
      while (j < n && depth) {
        const ch = s[j];
        if (ch === "\\") { const e = s[j + 1]; const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
          if (/[0-7]/.test(e)) { const o = /^[0-7]{1,3}/.exec(s.slice(j + 1))[0]; str += String.fromCharCode(parseInt(o, 8)); j += 1 + o.length; continue; }
          str += map[e] ?? e; j += 2; continue; }
        if (ch === "(") depth++;
        if (ch === ")") { depth--; if (!depth) break; }
        str += ch; j++;
      }
      out.push({ s: str }); i = j + 1; continue;
    }
    if (c === "<" && s[i + 1] !== "<") { const j = s.indexOf(">", i); const hex = s.slice(i + 1, j).replace(/\s/g, ""); let str = ""; for (let k = 0; k < hex.length; k += 2) str += String.fromCharCode(parseInt(hex.substr(k, 2).padEnd(2, "0"), 16)); out.push({ s: str }); i = j + 1; continue; }
    if (c === "[" || c === "]") { out.push(c); i++; continue; }
    if (c === "<" || c === ">") { out.push(s.substr(i, 2)); i += 2; continue; }
    if (c === "/") { let j = i + 1; while (j < n && !/[\s\/\[\]()<>%]/.test(s[j])) j++; out.push({ name: s.slice(i + 1, j) }); i = j; continue; }
    let j = i; while (j < n && !/[\s\/\[\]()<>%]/.test(s[j])) j++;
    const w = s.slice(i, j); i = j;
    out.push(/^[-+]?(\d+\.?\d*|\.\d+)$/.test(w) ? +w : { op: w });
  }
  return out;
}

const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();

// interprète le flux : tracés et textes en coordonnées de page
export function parsePage(page) {
  const T = tokens(page.content);
  let gs = { ctm: [1, 0, 0, 1, 0, 0], stroke: "#000000", fill: "#000000", w: 1, dash: [] }; const stack = [];
  let path = [], cur = null, args = [], arr = null;
  let tf = { font: null, size: 0, tm: [1, 0, 0, 1, 0, 0], tlm: [1, 0, 0, 1, 0, 0], tz: 100, lead: 0 };
  const paths = [], texts = [];
  const flush = (op) => {
    if (path.length) {
      const sc = Math.hypot(gs.ctm[0], gs.ctm[1]);
      paths.push({ sub: path, stroke: /[SsBb]/.test(op) ? gs.stroke : null, fill: /[fFBb]/.test(op) ? gs.fill : null, w: +(gs.w * sc).toFixed(3), dash: gs.dash, op });
    }
    path = []; cur = null;
  };
  const show = (str) => {
    const m = mul([tf.size * tf.tz / 100, 0, 0, tf.size, 0, 0], mul(tf.tm, gs.ctm));
    const sx = Math.hypot(m[0], m[1]), sy = Math.hypot(m[2], m[3]);
    texts.push({ str, font: page.fonts[tf.font] || tf.font, size: tf.size, sx: +sx.toFixed(3), sy: +sy.toFixed(3), angle: Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI), x: +m[4].toFixed(2), y: +m[5].toFixed(2), color: gs.fill });
  };
  for (const t of T) {
    if (t === "[") { arr = []; continue; }
    if (t === "]") { args.push(arr); arr = null; continue; }
    if (arr) { arr.push(t); continue; }
    if (!t || !t.op) { args.push(t); continue; }
    const a = args; args = [];
    switch (t.op) {
      case "q": stack.push(JSON.parse(JSON.stringify(gs))); break;
      case "Q": gs = stack.pop() || gs; break;
      case "cm": gs.ctm = mul(a.slice(0, 6), gs.ctm); break;
      case "w": gs.w = a[0]; break;
      case "d": gs.dash = a[0] || []; break;
      case "RG": gs.stroke = hex(a[0], a[1], a[2]); break;
      case "rg": gs.fill = hex(a[0], a[1], a[2]); break;
      case "G": gs.stroke = hex(a[0], a[0], a[0]); break;
      case "g": gs.fill = hex(a[0], a[0], a[0]); break;
      case "K": gs.stroke = hex((1 - a[0]) * (1 - a[3]), (1 - a[1]) * (1 - a[3]), (1 - a[2]) * (1 - a[3])); break;
      case "k": gs.fill = hex((1 - a[0]) * (1 - a[3]), (1 - a[1]) * (1 - a[3]), (1 - a[2]) * (1 - a[3])); break;
      case "m": cur = [ap(gs.ctm, a[0], a[1])]; cur.k = "m"; path.push(cur); break;
      case "l": if (cur) { cur.push(ap(gs.ctm, a[0], a[1])); cur.k += "l"; } break;
      case "c": if (cur) { cur.push(ap(gs.ctm, a[0], a[1]), ap(gs.ctm, a[2], a[3]), ap(gs.ctm, a[4], a[5])); cur.k += "c"; cur.curve = (cur.curve || 0) + 1; } break;
      case "v": if (cur) { const p0 = cur[cur.length - 1]; cur.push(p0, ap(gs.ctm, a[0], a[1]), ap(gs.ctm, a[2], a[3])); cur.k += "c"; cur.curve = (cur.curve || 0) + 1; } break;
      case "y": if (cur) { const p3 = ap(gs.ctm, a[2], a[3]); cur.push(ap(gs.ctm, a[0], a[1]), p3, p3); cur.k += "c"; cur.curve = (cur.curve || 0) + 1; } break;
      case "h": if (cur) cur.closed = true; break;
      case "re": { const [x, y, w, h] = a; cur = [ap(gs.ctm, x, y), ap(gs.ctm, x + w, y), ap(gs.ctm, x + w, y + h), ap(gs.ctm, x, y + h)]; cur.k = "mlll"; cur.closed = true; cur.rect = true; path.push(cur); break; }
      case "S": case "s": case "f": case "F": case "f*": case "B": case "B*": case "b": case "b*": case "n": flush(t.op); break;
      case "BT": tf.tm = [1, 0, 0, 1, 0, 0]; tf.tlm = [1, 0, 0, 1, 0, 0]; break;
      case "Tf": tf.font = a[0] && a[0].name; tf.size = a[1]; break;
      case "Tz": tf.tz = a[0]; break;
      case "TL": tf.lead = a[0]; break;
      case "Tm": tf.tm = a.slice(0, 6); tf.tlm = tf.tm.slice(); break;
      case "Td": tf.tlm = mul([1, 0, 0, 1, a[0], a[1]], tf.tlm); tf.tm = tf.tlm.slice(); break;
      case "TD": tf.lead = -a[1]; tf.tlm = mul([1, 0, 0, 1, a[0], a[1]], tf.tlm); tf.tm = tf.tlm.slice(); break;
      case "T*": tf.tlm = mul([1, 0, 0, 1, 0, -tf.lead], tf.tlm); tf.tm = tf.tlm.slice(); break;
      case "Tj": case "'": case '"': if (a[a.length - 1] && a[a.length - 1].s != null) show(a[a.length - 1].s); break;
      case "TJ": if (Array.isArray(a[0])) show(a[0].filter((x) => x && x.s != null).map((x) => x.s).join("")); break;
      default: break;
    }
  }
  return { paths, texts, box: page.box, rot: page.rot };
}

export const pathBox = (p) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const s of p.sub) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
export { num };

// tracé SVG d'un sous-chemin (k = suite des opérateurs m/l/c), points transformés par P
export function subD(s, P) {
  let d = "", i = 0;
  for (const op of s.k || "m" + "l".repeat(s.length - 1)) {
    if (op === "c") { const [a, b, c] = [P(s[i]), P(s[i + 1]), P(s[i + 2])]; d += `C${a[0]} ${a[1]} ${b[0]} ${b[1]} ${c[0]} ${c[1]}`; i += 3; }
    else { const p = P(s[i]); d += `${op === "m" ? "M" : "L"}${p[0]} ${p[1]}`; i += 1; }
  }
  return d + (s.closed ? "Z" : "");
}
