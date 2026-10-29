// Raccordement permanent uniquement pour un détecteur intégré explicitement qualifié.
export function permanentDetector(a) {
  const c = a?.commande;
  return ['LUM','APP','SPOT'].includes(a?.t) && c?.mode === 'detecteur' && c.detecteur === 'integre' && c.alimentation === 'permanente' && typeof c.preuve === 'string' && !!c.preuve.trim();
}
