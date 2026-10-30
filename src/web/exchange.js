import {ask,notify} from "./dialogs.js";
import * as CHS from '../chantiers.js';
import {buildOkteo,dataURLToBlob} from '../ext/okteo-file.js';
import {readHistory,saveHistory,event,revisionLabel,differences} from './history.js';
export function compareVersions(a,b){const x=String(a).split('.').map(Number),y=String(b).split('.').map(Number);for(let i=0;i<3;i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1;}return 0;}
export function validateProject(j){
 if(!j||j.format!=='okteo-chantier'||![1,2].includes(j.version))throw Error('Format de chantier inconnu ou version plus récente. Mettez Oktéo à jour.');
 if(j.application?.version && compareVersions(j.application.version,'0.72.0')>0)throw Error('Ce dossier provient d’une application plus récente. Mettez Oktéo à jour avant import.');
 if(!j.chantier||typeof j.chantier.nom!=='string'||j.chantier.nom.length>300)throw Error('Identité chantier invalide.');
 if(j.dessin){const state=JSON.parse(j.dessin.s);if(!state||!Array.isArray(state.nodes)||!Array.isArray(state.app))throw Error('Dessin invalide.');}
 const funds=[j.fond,...Object.values(j.fonds||{})].filter(Boolean);
 for(const f of funds)for(const k of ['pdf','image'])if(f[k]&&!/^data:(application\/pdf|image\/(jpeg|png|webp));base64,[a-zA-Z0-9+/=\s]+$/.test(f[k]))throw Error('Ressource embarquée invalide.');
 if(j.history&&(!Array.isArray(j.history.events)||typeof j.history.projectId!=='string'))throw Error('Journal invalide.');
 return j;
}
const safe=s=>String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,90)||'Chantier';
async function write(dir,name,data){const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();try{await w.write(data);await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}}
export function anomalies(c,data){let s={};try{s=JSON.parse(data?.s||'{}');}catch{}const out=[];
 if(!c.numero)out.push('Numéro d’affaire manquant');if(!c.client)out.push('Client/pavillonneur manquant');
 if(!c.fond)out.push('Plan source absent');if(c.fond&&!c.fond.calibre)out.push('Échelle du plan non validée');
 if(!(s.app||[]).length)out.push('Aucun appareil sur le niveau actif');
 for(const [level,d] of [[s.level||'rdc',s],...Object.entries(s.other||{})])for(const a of d.app||[])if(a.t==='INCONNU')out.push(`Symbole inconnu ${a.id} au niveau ${level}`);
 return out;
}
let exporting=false;
export async function exportDirectory(api,final=false){
 if(exporting)throw Error('Un export est déjà en cours.');
 exporting=true;try{return await doExportDirectory(api,final);}finally{exporting=false;}
}
async function doExportDirectory(api,final=false){
 if(!window.showDirectoryPicker)throw Error('Utilisez Edge sur PC pour exporter en dossiers.');
 const c=CHS.get(api.ch.id)||api.ch,data=api.packData(),issues=anomalies(c,data);
 let trace=null;
 issues.push(...(window.okteoExt?.doubts?.list||[]).map(x=>x.text||String(x)));
 const checks=api.control||[];issues.push(...checks.map(x=>`${api.controlKinds?.[x.kind]||x.kind} : ${(x.ids||[]).join(", ")} (${x.lv||"niveau courant"})`));
 if(final&&!await ask(`Finaliser ce chantier ?\n${issues.length?issues.map(x=>'• '+x).join('\n'):'Contrôles de dossier satisfaits.'}\nLes anomalies restantes seront consignées dans le rapport.`,{confirm:true}))return;
 const comment=final?await ask('Commentaire BE pour Thibaut (facultatif) :',{text:true}):'';if(comment===null)return;
 // Picker must run before asynchronous work so Edge retains the user gesture.
 const root=await showDirectoryPicker({mode:'readwrite',id:'okteo-exports'});
 try{const {etudeNow}=await import('../ext/etude-ui.js');trace=etudeNow(api,{alternatives:false});}catch(e){issues.push('Trace des règles non calculable : '+e.message);}
 api.saveNow();
 const h=readHistory(c.id),revision=h.revision+1,label=revisionLabel(revision),head=crypto.randomUUID();
 const exportHistory={...h,revision,parentRevision:h.head,head,events:[...h.events,{id:crypto.randomUUID(),author:window.okteoSession?.user.login||'Prototype local',at:new Date().toISOString(),type:final?'finalisation':'export-intermediaire',change:{revision,head,parent:h.head,anomalies:issues},reason:comment}]};
 const project=JSON.parse(await (await buildOkteo(c,data)).text());project.version=2;project.history=exportHistory;project.ruleSnapshot=c.ruleSnapshot||window.okteoPinned;project.application={version:'0.72.0',rulesEngine:'0.72.0'};project.finalized=final;project.anomalies=issues;
 const container=await root.getDirectoryHandle(safe(c.nom)+'_'+label+'_'+head.slice(0,8),{create:true});
 await write(container,'EXPORT_INCOMPLET.txt','Export en cours. Ne pas importer tant que ce fichier est présent.');
 const chantier=await container.getDirectoryHandle('Chantier',{create:true});
 // One self-contained project manifest remains easy to copy/import; PDFs are also exposed for consultation.
 const serialized=JSON.stringify(project);
 await write(chantier,'chantier.okteo',serialized);
 const checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized))),x=>x.toString(16).padStart(2,'0')).join('');
 await write(chantier,'integrite.json',JSON.stringify({format:2,file:'chantier.okteo',sha256:checksum,revision:head}));
 for(const [level,f] of [[c.level||'rdc',project.fond],...Object.entries(project.fonds||{})])if(f?.pdf)await write(chantier,'Source_'+safe(level)+'.pdf',await dataURLToBlob(f.pdf));
 if(final){
  const report=await container.getDirectoryHandle('Rapport_Thibaut',{create:true});
  const finalDrawing=JSON.parse(data.s),baseline=h.initialDrawing||null;
  const r={format:'okteo-rapport',version:1,chantier:{nom:c.nom,numero:c.numero,client:c.client},projectId:h.projectId,revision,head,parent:h.head,exporte:project.exporte,application:project.application,regles:project.ruleSnapshot,traceRegles:trace,anomalies:issues,commentaire:comment,analyseInitiale:h.initialAI||null,analyses:h.analyses||[],differences:baseline?differences(baseline,finalDrawing):null,dessinFinal:finalDrawing,historique:exportHistory.events,limites:['Les différences sont des modifications structurelles du dessin, pas une interprétation automatique de chaque règle appliquée.','Absence d’analyse initiale : comparaison IA/BE indisponible.']};
  await write(report,'rapport.json',JSON.stringify(r,null,2));
  await write(report,'Resume_Thibaut.txt',`OKTÉO — RAPPORT BE\n${c.nom} · ${c.numero||'sans numéro'}\n${label} (Europe/Paris)\nAuteur : ${window.okteoSession?.user.login||'Prototype local'}\nVersion application : 0.72.0\nBibliothèque : ${r.regles?.version??'prototype'}\n\nANOMALIES\n${issues.join('\n')||'Aucune anomalie détectée par les contrôles de dossier.'}\n\nCOMMENTAIRE BE\n${comment||'Non renseigné'}\n\nANALYSE IA\n${h.initialAI?'Analyse initiale et reprises incluses dans rapport.json':'Aucune analyse initiale enregistrée'}\n${r.differences?.length??'Non disponible'} différences structurelles IA / dessin final.\n${r.historique.length} événements dans le journal.\n\nLes règles de référence complètes, les analyses et le journal sont dans rapport.json. Les règles ne sont jamais modifiées automatiquement.\nCe rapport ne constitue pas une attestation de conformité électrique.\n`);
 }
 await container.removeEntry('EXPORT_INCOMPLET.txt');
 const current=readHistory(c.id);saveHistory(c.id,{...current,revision,parentRevision:h.head,head,events:[...current.events,exportHistory.events.at(-1)]});await window.okteoFlush?.();
 notify(`Export terminé : ${container.name}\n${final?'Dossiers Chantier et Rapport_Thibaut créés.':'Dossier Chantier créé.'}\nAttendez la fin de synchronisation OneDrive avant ouverture sur un autre poste.`);
}
export async function pickProject(){
 const dir=await showDirectoryPicker({mode:'read',id:'okteo-import'});
 if(await dir.getFileHandle('EXPORT_INCOMPLET.txt').then(()=>true,()=>false))throw Error('Cet export est incomplet. Recommencez l’export sur le poste source.');
 let folder=dir;try{folder=await dir.getDirectoryHandle('Chantier');}catch{}
 const file=await (await folder.getFileHandle('chantier.okteo')).getFile();
 let manifest;try{manifest=JSON.parse(await (await (await folder.getFileHandle('integrite.json')).getFile()).text());}catch{throw Error('Manifeste d’intégrité manquant ou invalide. Pour un ancien fichier, utilisez Ouvrir un fichier .okteo.');}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');
 if(digest!==manifest.sha256)throw Error('Le dossier est incomplet ou modifié pendant la copie. Attendez la synchronisation ou recommencez l’export.');
 return file;
}
export function acceptHistory(j,id){
 if(j.history){const h=structuredClone(j.history);saveHistory(id,h);event(id,'import',{revision:h.revision,head:h.head,origin:'dossier'});}
 else event(id,'import-ancien',{format:1,note:'Historique antérieur non disponible'});
}
export async function checkOlder(j){
 if(globalThis.okteoSession && (!j.ruleSnapshot || (j.application?.version && j.application.version!=='0.72.0'))){if(!await ask('Ce dossier provient d’une ancienne version. '+(!j.ruleSnapshot?'Sa version de règles n’était pas enregistrée : la bibliothèque actuelle sera proposée.':'La bibliothèque embarquée sera conservée, mais le moteur de cette application a évolué.')+' Vérifiez les prochains calculs. Importer une copie ?', {confirm:true}))return false;}
 if(!j.history)return true;
 const known=CHS.list().map(c=>readHistory(c.id)).filter(h=>h.projectId===j.history.projectId);
 if(known.some(h=>h.revision>j.history.revision||h.revision===j.history.revision&&h.head!==j.history.head))return ask('Une révision plus récente ou divergente existe sur ce compte et ce navigateur. Importer une copie séparée ? Aucun registre des autres postes n’est disponible.',{confirm:true});
 return true;
}
