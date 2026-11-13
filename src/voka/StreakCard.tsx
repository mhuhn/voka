import { useState } from "react";
import type { Language } from "../lib/i18n";
import type { ProfileStreak } from "./data";
import { medalsFor,type MedalKind } from "./streak";

const palette:Record<MedalKind,[string,string,string]>={
 wood:["#b9824b","#7a4d22","Holz"],bronze:["#dd9246","#8f5a1d","Bronze"],
 silver:["#dfe4ea","#8b95a3","Silber"],gold:["#ffd24f","#c48a05","Gold"]
};
export function MedalSvg({kind}:{kind:MedalKind}){
 const [f,d,name]=palette[kind];
 return <svg className="v-streak-medal" viewBox="0 0 40 52" role="img" aria-label={name+"medaille"}>
  <path d="M9 1h9l6 17h-9z" fill="#2f6fe0"/>
  <path d="M31 1h-9l-6 17h9z" fill="#f9a11b"/>
  <circle cx="20" cy="34" r="16" fill={f} stroke={d} strokeWidth="2"/>
  <circle cx="20" cy="34" r="11.5" fill="none" stroke={d} strokeWidth="1.2" opacity=".7"/>
  <g transform="translate(11.5 25.5) scale(.72)" fill={d} stroke="none">
    <path d="M12 3.5l2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6-4.5-4.2 6.1-.8z"/>
  </g>
 </svg>;
}
const texts:Record<Language,{day:string;days:string;help:string;title:string;body:string[];medals:string;close:string;notice:(lost:number,days:number)=>string}>={
 de:{day:"Tag in Folge",days:"Tage in Folge",help:"Wie wird der Streak berechnet?",title:"So zählt der Streak",
 body:["Der Streak zählt die Tage in Folge, an denen du alle bereiten Karten dieses Profils abgefragt hast.","Sobald du an einem Tag die letzte bereite Karte abgefragt hast, steigt er um 1, aber höchstens einmal pro Tag.","Heute und gestern gelten noch nicht als ausgelassen. Liegt dein letzter Streak-Tag weiter zurück, sinkt der Streak für jeden ausgelassenen Tag um 2. Darauf weist dich die App hin."],
 medals:"Medaillen: unter 3 Holz, 3 bis 7 Bronze, 8 bis 14 Silber. Ab 15 gibt es Gold, und zwar eine Medaille für jede volle 14: bei 28 bis 41 zwei, bei 42 drei.",close:"Schließen",notice:(lost,days)=>`Dein Streak wurde um ${lost} gesenkt, weil du ${days} ${days===1?"Tag":"Tage"} ausgelassen hast (je ausgelassenem Tag minus 2).`},
 en:{day:"day in a row",days:"days in a row",help:"How is the streak calculated?",title:"How the streak works",body:["Your streak counts days when you finish all ready cards in this profile.","Once the last ready card is answered, your streak increases by one, at most once per day.","Today and yesterday are not missed days. Every earlier missed day subtracts two points."],medals:"Medals: wood below 3, bronze from 3 to 7, silver from 8 to 14. Gold starts at 15; one medal per complete 14 days.",close:"Close",notice:(lost,days)=>`Your streak decreased by ${lost} after ${days} missed ${days===1?"day":"days"} (2 points per day).`},
 fr:{day:"jour de suite",days:"jours de suite",help:"Comment calculer la série ?",title:"Comment fonctionne la série",body:["La série compte les jours où toutes les cartes disponibles du profil ont été révisées.","Elle augmente au maximum d'un point par jour.","Chaque journée manquée antérieure à hier enlève 2 points."],medals:"Médailles : bois (0–2), bronze (3–7), argent (8–14) et or (15+), une par tranche complète de 14 jours.",close:"Fermer",notice:(lost,days)=>`Votre série a diminué de ${lost} points après ${days} jour(s) manqué(s).`},
 nl:{day:"dag op rij",days:"dagen op rij",help:"Hoe werkt de reeks?",title:"Zo werkt je reeks",body:["De reeks telt de dagen waarop alle beschikbare kaarten van dit profiel zijn geoefend.","Je verdient maximaal één punt per dag.","Elke gemiste dag vóór gisteren kost 2 punten."],medals:"Medailles: hout (0–2), brons (3–7), zilver (8–14) en goud (15+), één per volle 14 dagen.",close:"Sluiten",notice:(lost,days)=>`Je reeks daalde met ${lost} na ${days} gemiste dag(en).`},
 da:{day:"dag i træk",days:"dage i træk",help:"Hvordan beregnes streaken?",title:"Sådan tælles streaken",body:["Streaken tæller dage med alle profilens tilgængelige kort gennemgået.","Du får højst ét point om dagen.","Hver oversprunget dag før i går koster 2 point."],medals:"Medaljer: træ (0–2), bronze (3–7), sølv (8–14) og guld (15+), én per 14 hele dage.",close:"Luk",notice:(lost,days)=>`Din streak faldt med ${lost} efter ${days} oversprungne dag(e).`},
 it:{day:"giorno di fila",days:"giorni di fila",help:"Come funziona la serie?",title:"Come funziona la serie",body:["La serie conta i giorni in cui completi tutte le carte disponibili del profilo.","Puoi ottenere al massimo un punto al giorno.","Ogni giorno saltato prima di ieri sottrae 2 punti."],medals:"Medaglie: legno (0–2), bronzo (3–7), argento (8–14), oro (15+), una ogni 14 giorni completi.",close:"Chiudi",notice:(lost,days)=>`La serie è diminuita di ${lost} per ${days} giorno/i saltato/i.`}
};
export default function StreakCard({streak,language,onDismiss}:{streak:ProfileStreak;language:Language;onDismiss:()=>Promise<void>}){
 const t=texts[language],m=medalsFor(streak.n);
 const [info,setInfo]=useState(false),[busy,setBusy]=useState(false);
 return <div className="v-streak-wrap">
  <div className="v-streak-card"><div className="v-streak-medals">
    {Array.from({length:m.count<=5?m.count:1},(_,i)=><MedalSvg kind={m.kind} key={i}/>)}
    {m.count>5&&<b className="v-streak-multiplier">×{m.count}</b>}
  </div><div className="v-streak-count"><b>{streak.n}</b><span>{streak.n===1?t.day:t.days}</span></div>
  <button className="v-streak-help" aria-label={t.help} type="button" onClick={()=>setInfo(true)}>?</button></div>
  {streak.note&&<div className="v-streak-notice" role="status"><span>{t.notice(streak.note.lost,streak.note.days)}</span>
    <button disabled={busy} type="button" onClick={()=>{setBusy(true);void onDismiss().finally(()=>setBusy(false));}}>OK</button>
  </div>}
  {info&&<div className="v-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setInfo(false);}}>
    <div className="v-streak-dialog" role="dialog" aria-modal="true" aria-label={t.title}>
      <h2>{t.title}</h2>{t.body.map((paragraph,i)=><p key={i}>{paragraph}</p>)}<p><strong>{t.medals}</strong></p>
      <button className="v-primary" type="button" onClick={()=>setInfo(false)}>{t.close}</button>
    </div>
  </div>}
 </div>;
}
