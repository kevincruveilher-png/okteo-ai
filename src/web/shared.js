import {ask,notify} from "./dialogs.js";
import * as CHS from '../chantiers.js';
import {getJournal} from '../cablage/regles.js';
import {getCab} from '../cablage/settings.js';
import {getPacks} from '../ext/packs-ui.js';
import {loadSymbols} from '../ext/symbols-data.js';
import {request} from './client.js';
export function defaults(){return {rules:getJournal(),settings:getCab(),symbols:loadSymbols(),packs:getPacks(),appVersion:'0.72.0'};}
export async function prepareShared(){
 const c=CHS.current();
 window.okteoCommon=await request('/api/shared');
 let pin=c.ruleSnapshot;
 if(!pin){pin={version:window.okteoCommon.id,data:window.okteoCommon.data?JSON.parse(window.okteoCommon.data):defaults()};CHS.update(c.id,{ruleSnapshot:pin});}
 window.okteoPinned=pin;
}
export const rejectLocalEdit=()=>{notify('Les règles communes se modifient dans « Compte / administration → Bibliothèque commune ». Le chantier conserve sa version.');return false;};
