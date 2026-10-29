// Règles métier KITeOHM v69 : complète une étude, sans inventer une observation du plan.
import { labelPoint } from '../walls/rooms.js';
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const SYSTEMATIQUES = [
  { t: 'FOUR', piece: 'Cuisine', mots: /cuisine|kitchen/ },
  { t: 'LV', piece: 'Cuisine', mots: /cuisine|kitchen/ },
  { t: 'PLAQ', piece: 'Cuisine', mots: /cuisine|kitchen/ },
  { t: 'LL', piece: 'Cellier', mots: /cellier|buanderie|lingerie/ },
  { t: 'SL', piece: 'Cellier', mots: /cellier|buanderie|lingerie/ },
];
export function implantationData(d = {}) {
  const x = d.implantation;
  if (!x || !['a_preciser', 'confirmee'].includes(x.etat)) return {};
  const out = { etat: x.etat };
  for (const k of ['origine', 'motif', 'piece']) if (typeof x[k] === 'string') out[k] = x[k].trim();
  return { implantation: out };
}
export const implantationPending = a => a.implantation?.etat === 'a_preciser';
const principe = a => /voir.{0,25}plan.{0,20}cuisine|principe|implantation.{0,20}(indicati|provis)|emplacement.{0,20}(definir|preciser)/.test(norm([a.inscription, a.aiNote].join(' ')));
const pending = (piece, motif) => ({ etat: 'a_preciser', origine: 'regle', piece, motif });
const centre = (rooms, frame) => {
  const pts = rooms.flatMap(r => r.poly || []);
  if (pts.length) return { x: (Math.min(...pts.map(p=>p.x))+Math.max(...pts.map(p=>p.x)))/2, y: (Math.min(...pts.map(p=>p.y))+Math.max(...pts.map(p=>p.y)))/2 };
  return { x: ((frame?.x0 || 0)+(frame?.x1 || 0))/2, y: ((frame?.y0 || 0)+(frame?.y1 || 0))/2 };
};
// rooms : [{name, poly, lv}], frame en mètres. Le faîtage n'est pas déduit d'un simple plan de niveau.
export function proposeEquipements({ items, rooms = [], level, frame = null }) {
  const adds = [], updates = [], used = new Set(), mid = centre(rooms, frame);
  for (const spec of SYSTEMATIQUES) {
    const have = items.filter(a => a.t === spec.t);
    if (have.length) {
      have.filter(a => !a.implantation && (a.hp || a.aiOrigin === 'regle' || principe(a))).forEach(a => updates.push({ id: a.id, implantation: pending(spec.piece, 'Emplacement proposé ou indication de principe : à confirmer.') }));
      continue;
    }
    // Un calibre 32 A en cuisine permet l'usage cuisson par règle d'étude, sans changer le calibre lu.
    const pc32 = spec.t === 'PLAQ' && items.find(a => a.t === 'PC32' && !used.has(a.id) && /cuisine|kitchen/.test(norm(a.room)));
    if (pc32) {
      used.add(pc32.id);
      updates.push({ id: pc32.id, t: 'PLAQ', aiOrigin: 'regle', implantation: pc32.implantation || (principe(pc32) ? pending('Cuisine', 'Indication 32 A de principe ; implantation exacte à préciser.') : { etat: 'confirmee', origine: 'plan', piece: pc32.room, motif: 'Position 32 A lue sur le plan ; usage cuisson attribué par la règle métier.' }) });
      continue;
    }
    const room = rooms.find(r => spec.mots.test(norm(r.name))), n = adds.filter(a => a.implantation.piece === spec.piece).length;
    const point = room?.poly?.length > 2 ? labelPoint(room.poly) : mid;
    // Légère séparation visuelle autour du point proposé ; jamais présentée comme une implantation lue.
    adds.push({ t: spec.t, lv: room?.lv || level, x: point.x + n * .45, y: point.y + (!room ? (spec.piece === 'Cuisine' ? .55 : 1.1) : 0), aiOrigin: 'regle', implantation: pending(spec.piece, room ? 'Proposition dans cette pièce ; emplacement précis à définir.' : `Pièce ${spec.piece} non identifiée ; emplacement à définir.`) });
  }
  if (items.some(a => a.t === 'TV') && !items.some(a => a.t === 'ANT')) adds.push({ t: 'ANT', lv: rooms[0]?.lv || level, ...mid, aiOrigin: 'regle', implantation: pending('Combles / faîtage', 'Proposition au milieu de la maison, au niveau du faîtage ; toiture et position à confirmer.') });
  // Antenne déjà proposée dans un autre outil : conserver la position, mais afficher son état réel.
  items.filter(a => a.t === 'ANT' && !a.implantation && (a.hp || a.aiOrigin === 'regle' || principe(a))).forEach(a => updates.push({ id:a.id, implantation:pending('Combles / faîtage', 'Emplacement proposé à confirmer.') }));
  return { adds, updates };
}
