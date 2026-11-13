import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Pencil, RotateCcw, Star, X } from "lucide-react";
import type { Language } from "../lib/i18n";
import {
  finishLearning, gradeLearning, gradeMixedLearning, markCard, saveCard,
  type LearningEntry, type LearningResult, type Subject, type VokaCard, type VokaList
} from "./data";
import { reverseMaxPoints } from "./learning";
import { playLearningSound, unlockLearningAudio } from "./feedbackAudio";

type LearningSession = { queryId: string; cards: LearningEntry[] };

const texts:Record<Language,Record<string,string>>={
  de:{
    exit:"Lernen beenden",reveal:"Aufdecken",known:"Gewusst",unknown:"Nicht gewusst",
    unsure:"Unsicher",edit:"Karte bearbeiten",save:"Korrektur speichern",
    cancel:"Abbrechen",marked:"Markieren",unmark:"Markierung entfernen",
    stage:"Karte",of:"von",points:"Punkte",failed:"Die Änderung konnte nicht gespeichert werden.",
    noCard:"Diese Karte ist nicht mehr verfügbar.",question:"Frage",answer:"Antwort"
  },
  en:{
    exit:"Finish learning",reveal:"Reveal",known:"Knew it",unknown:"Didn't know",
    unsure:"Unsure",edit:"Edit card",save:"Save correction",
    cancel:"Cancel",marked:"Star card",unmark:"Remove star",
    stage:"Card",of:"of",points:"points",failed:"The change could not be saved.",
    noCard:"This card is no longer available.",question:"Question",answer:"Answer"
  },
  fr:{
    exit:"Terminer",reveal:"Retourner",known:"Su",unknown:"Non su",
    unsure:"Incertain",edit:"Modifier la carte",save:"Enregistrer la correction",
    cancel:"Annuler",marked:"Marquer",unmark:"Retirer la marque",
    stage:"Carte",of:"sur",points:"points",failed:"Impossible d'enregistrer.",
    noCard:"Cette carte n'est plus disponible.",question:"Question",answer:"Réponse"
  },
  nl:{
    exit:"Stoppen met leren",reveal:"Omdraaien",known:"Geweten",unknown:"Niet geweten",
    unsure:"Onzeker",edit:"Kaart bewerken",save:"Correctie opslaan",
    cancel:"Annuleren",marked:"Markeren",unmark:"Markering verwijderen",
    stage:"Kaart",of:"van",points:"punten",failed:"Opslaan mislukt.",
    noCard:"Deze kaart is niet meer beschikbaar.",question:"Vraag",answer:"Antwoord"
  },
  da:{
    exit:"Afslut læring",reveal:"Vend kort",known:"Vidste det",unknown:"Vidste ikke",
    unsure:"Usikker",edit:"Rediger kort",save:"Gem rettelse",
    cancel:"Annuller",marked:"Markér",unmark:"Fjern markering",
    stage:"Kort",of:"af",points:"point",failed:"Ændringen kunne ikke gemmes.",
    noCard:"Kortet er ikke længere tilgængeligt.",question:"Spørgsmål",answer:"Svar"
  },
  it:{
    exit:"Termina studio",reveal:"Scopri",known:"Sapevo",unknown:"Non sapevo",
    unsure:"Incerto",edit:"Modifica scheda",save:"Salva correzione",
    cancel:"Annulla",marked:"Segna",unmark:"Rimuovi segno",
    stage:"Scheda",of:"di",points:"punti",failed:"Impossibile salvare la modifica.",
    noCard:"Questa scheda non è più disponibile.",question:"Domanda",answer:"Risposta"
  }
};

export default function LearningScreen({
  language, list, subject, cards, session, mixed, onRefresh, onExit
}:{
  language: Language;
  list: VokaList;
  subject?: Subject;
  cards: VokaCard[];
  session: LearningSession;
  mixed?: {lists:VokaList[];subjects:Subject[]};
  onRefresh: () => Promise<void>;
  onExit: (completed?:boolean) => void;
}){
  const t=texts[language];
  const [index,setIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);

  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [editing,setEditing]=useState(false);
  const [transition,setTransition]=useState(false);
  const [editQuestion,setEditQuestion]=useState("");
  const [editAnswer,setEditAnswer]=useState("");
  const currentEntry=session.cards[index];
  const reverse=Boolean(currentEntry?.reverse);
  const currentId=currentEntry?.id;
  const currentCard=cards.find(card=>card.id===currentId);
  const total=session.cards.length;
  const activeList=(mixed?.lists.find(entry=>entry.id===currentCard?.list_id)||list);
  const activeSubject=mixed?.subjects.find(subject=>subject.id===activeList.subject_id)||subject;
  const maxPoints=reverse?reverseMaxPoints(activeList.reverse_share):4;
  const earnedPoints=Math.max(0,Math.min(maxPoints,reverse?(currentCard?.reverse_success_count??0):(currentCard?.success_count??0)));
  const faceQuestion=reverse?currentCard?.answer:currentCard?.question;
  const faceAnswer=reverse?currentCard?.question:currentCard?.answer;
  const questionLabel=reverse?activeList.answer_label:activeList.question_label;
  const answerLabel=reverse?activeList.question_label:activeList.answer_label;
  useEffect(()=>{
    if(!mixed||index===0){setTransition(false);return;}
    const prior=cards.find(card=>card.id===session.cards[index-1]?.id);
    const next=cards.find(card=>card.id===session.cards[index]?.id);
    const previousSubject=mixed.lists.find(l=>l.id===prior?.list_id)?.subject_id;
    const nextSubject=mixed.lists.find(l=>l.id===next?.list_id)?.subject_id;
    if(!previousSubject||previousSubject===nextSubject){setTransition(false);return;}
    setTransition(true);
    const timer=window.setTimeout(()=>setTransition(false),1400);
    return ()=>window.clearTimeout(timer);
  // Subject changes are driven by the session card index, not server refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[index]);

  async function leave(){
    if(busy)return;
    setBusy(true);setError("");
    try {
      await finishLearning(session.queryId);
      onExit();
    } catch(e){
      setError(e instanceof Error?e.message:t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function grade(result:LearningResult){
    if(!currentCard||busy||!revealed||editing)return;
    unlockLearningAudio();
    setBusy(true);setError("");
    try {
      const gradeResult=mixed?await gradeMixedLearning(session.queryId,currentCard.id,reverse,result):await gradeLearning(session.queryId,currentCard.id,reverse,result);
      await onRefresh();
      const isLast=gradeResult.finished||index+1>=total;
      if(isLast){
        if(!gradeResult.finished)await finishLearning(session.queryId);
        playLearningSound("complete");
        onExit(true);
      }else{
        playLearningSound(result);
        setIndex(value=>value+1);
        setRevealed(false);
      }
    }catch(e){
      setError(e instanceof Error?e.message:t.failed);
    }finally {
      setBusy(false);
    }
  }

  async function toggleStar(){
    if(!currentCard||busy)return;
    setBusy(true);setError("");
    try {
      await markCard(currentCard.id,!currentCard.marked);
      await onRefresh();
    }catch(e){
      setError(e instanceof Error?e.message:t.failed);
    }finally{setBusy(false)}
  }

  function startEditing(){
    if(!currentCard||busy)return;
    setEditQuestion(currentCard.question);setEditAnswer(currentCard.answer);
    setEditing(true);setError("");
  }

  async function saveCorrection(event:FormEvent){
    event.preventDefault();
    if(!currentCard||busy)return;
    setBusy(true);setError("");
    try {
      await saveCard({
        list_id:activeList.id,question:editQuestion.trim(),
        answer:editAnswer.trim(),marked:currentCard.marked
      },currentCard.id);
      await onRefresh();
      setEditing(false);
    }catch(e){
      setError(e instanceof Error?e.message:t.failed);
    }finally{setBusy(false)}
  }

  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key!=="Enter" && event.key!==" " && event.code!=="Space")return;
      if(event.repeat||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
      if(busy||editing||transition||!currentCard)return;
      const target=event.target;
      // Never intercept editing controls, dialogs, or explicitly focused
      // actions: Tab+Enter should still operate the focused button normally.
      if(target instanceof Element &&
         target.closest('input,textarea,select,button,a,[role="button"],[contenteditable="true"],[role="dialog"]'))return;
      event.preventDefault();
      if(!revealed)setRevealed(true);
      else void grade("known");
    };
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  // grade captures the current session/card and is deliberately refreshed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[busy,editing,transition,revealed,currentCard,index,reverse,session.queryId]);

  return <section className="v-learning" aria-label={mixed?(activeSubject?.title||activeList.title):list.title}>
    <header className="v-learning-header">
      <button type="button" className="v-icon-button v-learning-exit" aria-label={t.exit} title={t.exit} onClick={()=>void leave()} disabled={busy}>
        <ArrowLeft size={22}/>
      </button>
      <div className="v-learning-session-name">
        <h1 className="v-heading-list-title">
          {activeSubject?.emoji&&<span className="v-emoji" aria-hidden="true">{activeSubject.emoji}</span>}
          <span className="v-heading-title-text">{activeList.title}</span>
        </h1>
      </div>
      <div className={"v-learning-points"+(reverse?" is-reverse":"")} role="img" aria-label={t.points+": "+earnedPoints+" / "+maxPoints}>
        {Array.from({length:maxPoints},(_,point)=><span key={point} className={"v-learning-point"+(point<earnedPoints?" is-filled":"")} aria-hidden="true"/>)}
      </div>
    </header>
    <div className="v-learning-progress-block">
      <div className="v-learning-progress-label">
        <span>{t.stage}</span>
        <span>{index} / {total} · {total?Math.round(index/total*100):0}%</span>
      </div>
      <div className="v-learning-progress" role="progressbar" aria-label={t.stage}
        aria-valuemin={0} aria-valuemax={total} aria-valuenow={index}>
        <span style={{width:(total?(index/total*100):0)+"%"}}/>
      </div>
    </div>
    {error&&<p className="v-error" role="alert">{error}</p>}
    {currentCard?<div className="v-learning-workspace">
      <div className="v-learning-card" aria-live="polite">
        <div className={"v-learning-card-inner"+(revealed?" is-revealed":"")}>
          <div className="v-learning-face v-learning-front" aria-hidden={revealed}>
            <span className="v-learning-face-label">{questionLabel}</span>
            <div className="v-learning-face-text">{faceQuestion}</div>
          </div>
          <div className="v-learning-face v-learning-back" aria-hidden={!revealed}>
            <span className="v-learning-face-label">{answerLabel}</span>
            <div className="v-learning-face-text">{faceAnswer}</div>
          </div>
        </div>
      </div>

      {!revealed?<button type="button" className="v-primary v-learning-reveal" disabled={busy||transition}
        onClick={()=>setRevealed(true)}>
        <RotateCcw size={21}/>{t.reveal}
      </button>:<>
        <div className="v-learning-result-actions" role="group" aria-label={t.stage}>
          <button className="v-learning-result is-unknown" type="button" disabled={busy}
            onClick={()=>void grade("unknown")}><X size={19}/>{t.unknown}</button>
          <button className="v-learning-result is-unsure" type="button" disabled={busy}
            onClick={()=>void grade("unsure")}>?<span>{t.unsure}</span></button>
          <button className="v-learning-result is-known" type="button" disabled={busy}
            onClick={()=>void grade("known")}><Check size={19}/>{t.known}</button>
        </div>
        <div className="v-learning-card-tools">
          <button type="button" className={"v-learning-tool"+(currentCard.marked?" is-marked":"")}
            aria-label={currentCard.marked?t.unmark:t.marked} aria-pressed={currentCard.marked}
            onClick={()=>void toggleStar()} disabled={busy}>
            <Star size={21} fill={currentCard.marked?"#ff9b00":"none"} />
            <span>{currentCard.marked?t.unmark:t.marked}</span>
          </button>
          <button className="v-learning-tool" type="button" onClick={startEditing} disabled={busy}>
            <Pencil size={20}/><span>{t.edit}</span>
          </button>
        </div>
      </>}
    </div>:<div className="v-empty">{t.noCard}</div>}
    {transition&&activeSubject&&<div className="v-learning-transition" role="status" aria-live="polite">
       <div><span className="v-learning-transition-emoji">{activeSubject.emoji}</span>
       <strong>{activeSubject.title}</strong></div>
     </div>}

    {editing&&currentCard&&<div className="v-modal-backdrop">
      <div role="dialog" aria-modal="true" aria-labelledby="v-learn-edit-title"
        className="v-manage-modal v-learning-edit-dialog">
        <div className="v-modal-header">
          <h2 id="v-learn-edit-title">{t.edit}</h2>
          <button type="button" className="v-icon-button" disabled={busy}
            aria-label={t.cancel} onClick={()=>setEditing(false)}><X/></button>
        </div>
        <form className="v-form" onSubmit={event=>void saveCorrection(event)}>
          <label>{activeList.question_label} *
            <textarea autoFocus required rows={3} value={editQuestion}
              onChange={e=>setEditQuestion(e.target.value)}/>
          </label>
          <label>{activeList.answer_label} *
            <textarea required rows={3} value={editAnswer}
              onChange={e=>setEditAnswer(e.target.value)}/>
          </label>
          <div className="v-modal-actions">
            <button type="button" className="v-outline" disabled={busy}
              onClick={()=>setEditing(false)}>{t.cancel}</button>
            <button type="submit" className="v-primary" disabled={busy}>{t.save}</button>
          </div>
        </form>
      </div>
    </div>}
  </section>;
}
