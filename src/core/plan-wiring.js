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
  const data={items,links:allLinks(),circuits:K.CAB.circuits || [],boxes:K.CAB.boxes || [],levels:CH.levels.map(l=>l.id),S:{...getCab(),commandeVolet:cv,voletsConnectes:cv==='connecte'}};
  const key=JSON.stringify(data);
  if(K.planWiringCache?.key!==key) K.planWiringCache={key,value:computeWiring(data)};
  return K.planWiringCache.value;
}
