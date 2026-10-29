import { proposeEquipements } from '../cablage/equipements.js';
export function equipmentProposal(api) {
  const rooms = api.levels.flatMap(l => (api.exportGeometry(l.id).rooms || []).map(r => ({ ...r, lv:l.id })));
  return proposeEquipements({ items:api.allApps(), rooms, level:api.level.id, frame:api.extent() });
}
export function completerEquipements(api) {
  const proposal = equipmentProposal(api);
  const r = api.applyEquipmentProposal(proposal);
  return { ...r, text: r.added || r.updated ? `${r.added} équipement(s) ajouté(s), ${r.updated} précisé(s). Halo violet : emplacement à définir ; déplacez puis confirmez dans Propriétés.` : 'Les équipements systématiques et l’antenne TV sont déjà prévus.' };
}
