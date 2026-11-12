import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, Play } from "lucide-react";
import type { Language } from "../lib/i18n";
import { previewMixedLearning, type VokaData } from "./data";
import { dueMixedLists } from "./mixedLearning";

type Words={title:string;description:string;subjects:string;tags:string;allTags:string;
  cards:string;start:string;cancel:string;none:string;noSelection:string;loading:string;error:string};
const words:Record<Language,Words>={
 de:{title:"Fächer lernen",description:"Wähle Fächer und optional Tags aus. Eine Liste wird nur einbezogen, wenn sie alle ausgewählten Tags enthält.",
  subjects:"Fächer auswählen",tags:"Tags (optional)",allTags:"Ohne Tag-Filter",
  cards:"Heute fällige Karten",start:"Lernen starten",cancel:"Abbrechen",none:"Heute keine passenden Karten",
  noSelection:"Wähle mindestens ein Fach aus.",loading:"Karten werden geprüft…",error:"Kartenzahl konnte nicht aktualisiert werden."},
 en:{title:"Study subjects",description:"Choose subjects and optional tags. A list qualifies only if it contains every selected tag.",
  subjects:"Choose subjects",tags:"Tags (optional)",allTags:"No tag filter",
  cards:"Cards due today",start:"Start learning",cancel:"Cancel",none:"No matching cards due today",
  noSelection:"Select at least one subject.",loading:"Checking cards…",error:"Unable to refresh the card count."},
 fr:{title:"Apprendre des matières",description:"Choisissez des matières et des étiquettes facultatives. Toutes les étiquettes sélectionnées doivent correspondre.",
  subjects:"Choisir les matières",tags:"Étiquettes (facultatif)",allTags:"Sans filtre",
  cards:"Cartes à réviser aujourd'hui",start:"Commencer",cancel:"Annuler",none:"Aucune carte disponible",
  noSelection:"Choisissez au moins une matière.",loading:"Vérification des cartes…",error:"Impossible de vérifier les cartes."},
 nl:{title:"Vakken leren",description:"Kies vakken en eventueel tags. Een lijst moet alle geselecteerde tags bevatten.",
  subjects:"Kies vakken",tags:"Tags (optioneel)",allTags:"Geen tagfilter",
  cards:"Kaarten voor vandaag",start:"Beginnen",cancel:"Annuleren",none:"Geen passende kaarten",
  noSelection:"Kies minstens één vak.",loading:"Kaarten controleren…",error:"Kaarten tellen is mislukt."},
 da:{title:"Lær fag",description:"Vælg fag og eventuelt tags. En liste skal have alle valgte tags.",
  subjects:"Vælg fag",tags:"Tags (valgfrit)",allTags:"Intet tagfilter",
  cards:"Kort til i dag",start:"Start læring",cancel:"Annuller",none:"Ingen kort at lære i dag",
  noSelection:"Vælg mindst ét fag.",loading:"Tjekker kort…",error:"Kunne ikke opdatere antal kort."},
 it:{title:"Studia le materie",description:"Scegli materie e tag facoltativi. Ogni lista deve avere tutti i tag selezionati.",
  subjects:"Scegli le materie",tags:"Tag (facoltativi)",allTags:"Nessun filtro tag",
  cards:"Schede da studiare oggi",start:"Inizia",cancel:"Annulla",none:"Nessuna scheda disponibile",
  noSelection:"Scegli almeno una materia.",loading:"Controllo delle schede…",error:"Impossibile aggiornare il conteggio."}
};
export default function MixedLearningPicker({
  data,language,busy,onStart,onCancel
}:{
  data:VokaData;language:Language;busy:boolean;
  onStart:(subjects:string[],tags:string[])=>void;
  onCancel:()=>void;
}){
  const t=words[language];
  const [subjects,setSubjects]=useState<string[]>([]);
  const [tags,setTags]=useState<string[]>([]);
  const [confirmed,setConfirmed]=useState<{key:string;count:number}|null>(null);
  const [previewError,setPreviewError]=useState("");
  const [checking,setChecking]=useState(false);
  const candidateSubjects=useMemo(()=>data.subjects.filter(subject=>
    data.lists.some(list=>list.subject_id===subject.id)
  ),[data.subjects,data.lists]);
  const selected=new Set(subjects);
  const availableTags=useMemo(()=>[...new Set(data.lists.filter(list=>
    selected.has(list.subject_id)
  ).flatMap(list=>list.tags))].sort((a,b)=>a.localeCompare(b,language)),[data.lists,subjects,language]);
  const validTags=tags.filter(tag=>availableTags.includes(tag));
  const choiceKey=JSON.stringify([subjects.slice().sort(),validTags.slice().sort()]);
  const localCount=dueMixedLists(data,subjects,validTags).reduce((sum,list)=>sum+list.count,0);
  const displayedCount=confirmed?.key===choiceKey?confirmed.count:localCount;

  useEffect(()=>{
    if(!subjects.length){setChecking(false);return;}
    let active=true;
    const id=window.setTimeout(()=>{
      setChecking(true);setPreviewError("");
      void previewMixedLearning(subjects,validTags)
       .then(result=>{if(active)setConfirmed({key:choiceKey,count:result.total})})
       .catch(()=>{if(active)setPreviewError(t.error)})
       .finally(()=>{if(active)setChecking(false)});
    },130);
    return ()=>{active=false;window.clearTimeout(id)};
  // The key captures the complete current selection; memoized strings are not required.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[choiceKey]);
  const toggleSubject=(id:string)=>setSubjects(previous=>
    previous.includes(id)?previous.filter(value=>value!==id):[...previous,id]);
  const toggleTag=(tag:string)=>setTags(previous=>
    previous.includes(tag)?previous.filter(value=>value!==tag):[...previous,tag]);

  return <section className="v-mixed-picker" aria-label={t.title}>
    <header className="v-mixed-picker-head">
      <button type="button" className="v-learning-exit" onClick={onCancel} disabled={busy}>
        <ArrowLeft size={19}/>{t.cancel}
      </button>
      <h2><BookOpen size={25}/>{t.title}</h2>
    </header>
    <p className="v-mixed-intro">{t.description}</p>
    <h3>{t.subjects}</h3>
    <div className="v-mixed-subjects">
      {data.groups.map(group=>{
        const relevant=candidateSubjects.filter(subject=>subject.group_id===group.id);
        return relevant.length?<fieldset key={group.id}>
          <legend>{group.title}</legend>
          <div className="v-mixed-options">{relevant.map(subject=><label className="v-mixed-choice" key={subject.id}>
            <input type="checkbox" checked={selected.has(subject.id)} onChange={()=>toggleSubject(subject.id)}/>
            <span className="v-mixed-choice-emoji">{subject.emoji}</span><span>{subject.title}</span>
            {selected.has(subject.id)&&<Check size={17}/>}
          </label>)}</div>
        </fieldset>:null;
      })}
    </div>
    <h3>{t.tags}</h3>
    {availableTags.length?<div className="v-mixed-tags">{availableTags.map(tag=>
      <label className="v-mixed-tag" key={tag}>
        <input type="checkbox" checked={validTags.includes(tag)} onChange={()=>toggleTag(tag)}/>
        <span>{tag}</span>
      </label>)}</div>:<p className="v-mixed-empty">{subjects.length?t.allTags:t.noSelection}</p>}
    <div className="v-mixed-footer">
      <div className="v-mixed-card-count" aria-live="polite">
        <span>{t.cards}</span><strong>{displayedCount}</strong>
      </div>
      {checking&&<span className="v-mixed-checking">{t.loading}</span>}
      {previewError&&<p className="v-error" role="alert">{previewError}</p>}
      {subjects.length>0&&displayedCount===0&&<p className="v-mixed-empty">{t.none}</p>}
      <button type="button" className="v-primary v-mixed-start"
        disabled={busy||subjects.length===0||displayedCount<=0}
        onClick={()=>onStart(subjects,validTags)}><Play size={19}/>{t.start}</button>
    </div>
  </section>;
}
