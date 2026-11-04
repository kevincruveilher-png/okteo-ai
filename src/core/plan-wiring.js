import { K } from './k.js';
import { CH } from './model.js';
import { appIndex, allLinks } from './levels.js';
import { repMap } from './view.js';
import { getCab } from '../cablage/settings.js';
import { computeWiring } from '../cablage/gaines.js';

// Les flèches reprennent les étiquettes calculées par le câblage, jamais une renumérotation visuelle.
export function planWiring() {
  const reps=repMap();
  const items=[...appIndex()].map(([id,v])=>({...v.a,id,lv:v.lv,rep:v.lv===K.LV.cur ? reps[id] : (v.a.rf || '')+(v.a.n || '')}));
  const cv=K.CAB.choix?.commandeVolet || '';
  const data={items,links:allLinks(),circuits:K.CAB.circuits || [],boxes:K.CAB.boxes || [],levels:CH.levels.map(l=>l.id),S:{...getCab(),commandeVolet:cv,voletsConnectes:cv==='connecte',pontage:!!K.CAB.choix?.pontage}};
  const key=JSON.stringify(data);
  // v72.1 : le plan ne doit jamais planter à cause d'un calcul de câblage incomplet (appareil sans circuit pendant
  // l'édition…) : sans résultat, pas de flèches ; les erreurs restent signalées par le contrôle et l'étude.
  if(K.planWiringCache?.key!==key){let value;try{value=computeWiring(data);}catch(e){console.warn('Oktéo : flèches du plan non calculées',e);value={boxes:[],direct:[]};}K.planWiringCache={key,value};}
  return K.planWiringCache.value;
}
