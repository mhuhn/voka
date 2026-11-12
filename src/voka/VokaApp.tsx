import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, BarChart3, Bell, BookOpen, ChevronDown, ChevronRight, CircleUserRound, Eye, EyeOff, FlaskConical, Home, ListPlus, Pencil, Plus, Search, Settings, SlidersHorizontal, Star, Trash2 } from "lucide-react";
import type { Language } from "../lib/i18n";
import { emptyData, loadVoka, saveList, deleteList, saveCard, deleteCard, markCard, insertGroup, updateGroup, deleteGroup, insertSubject, updateSubject, deleteSubject, usageDate, subjectUsage, groupUsage, type VokaData, type VokaCard, type VokaList, type Subject, type SubjectGroup, type ListInput } from "./data";
import "./voka.css";

type Screen = "home" | "subject" | "list" | "listForm" | "cardForm" | "manage";
type Words = Record<string, string>;
const translations: Record<Language, Words> = {
 de: { mySubjects:"Meine Fächer", createList:"Liste erstellen", addCard:"Karte hinzufügen", saveCard:"Karte speichern", saveList:"Liste speichern", empty:"Noch keine Listen", emptyInfo:"Erstelle deine erste Vokabelliste und lerne effektiv mit digitalen Karteikarten.", groups:"Fachgruppen & Fächer", addGroup:"Fachgruppe hinzufügen", addSubject:"Fach hinzufügen", edit:"Bearbeiten", delete:"Löschen", cancel:"Abbrechen", save:"Speichern", title:"Titel", subject:"Fach", tags:"Tags", addTag:"Tag hinzufügen", questionLabel:"Frage-Label", answerLabel:"Antwort-Label", both:"In beide Richtungen lernen", bothInfo:"Die Karteikarten werden sowohl vorwärts als auch rückwärts abgefragt.", question:"Frage", answer:"Antwort", marked:"Markiert", markedOnly:"Nur Markierte", unseen:"Ungelernte anzeigen", showAnswers:"Antworten anzeigen", sorting:"Sortieren", alpha:"Alphabetisch", points:"Nach Punkten", learn:"Lernen", progress:"Fortschritt", cards:"Karten", noCards:"Noch keine Karten", noMatching:"Keine Karten für diese Filter", listInfo:"Listeneigenschaften", lists:"Listen", learning:"Lernen", search:"Suchen", statistics:"Statistik", settings:"Einstellungen", manage:"Fächer verwalten", groupName:"Name der Fachgruppe", emoji:"Emoji", confirmDelete:"Wirklich löschen? Zugehörige Inhalte werden ebenfalls gelöscht.", noSubject:"Lege zuerst ein Fach an.", editCard:"Karte bearbeiten", editList:"Liste bearbeiten", updated:"Zuletzt", total:"Listen", automatic:"Lernpunkte werden automatisch verwaltet. Die Punktzahl (0–3) passt sich beim Lernen an.", profile:"Profil", loading:"Lade deine Listen…", chooseSubject:"Fach auswählen", newList:"Neue Liste", newCard:"Neue Karte", create:"Erstellen", starred:"Markierte", none:"Keine Listen in diesem Fach" },
 en: {mySubjects:"My subjects",createList:"Create list",addCard:"Add card",saveCard:"Save card",saveList:"Save list",empty:"No lists yet",emptyInfo:"Create your first vocabulary list and learn with digital flashcards.",groups:"Subject groups & subjects",addGroup:"Add group",addSubject:"Add subject",edit:"Edit",delete:"Delete",cancel:"Cancel",save:"Save",title:"Title",subject:"Subject",tags:"Tags",addTag:"Add tag",questionLabel:"Question label",answerLabel:"Answer label",both:"Learn in both directions",bothInfo:"Cards are tested both forwards and backwards.",question:"Question",answer:"Answer",marked:"Starred",markedOnly:"Only starred",unseen:"Show unlearned",showAnswers:"Show answers",sorting:"Sort by",alpha:"Alphabetical",points:"By points",learn:"Learn",progress:"Progress",cards:"Cards",noCards:"No cards yet",noMatching:"No cards match these filters",listInfo:"List properties",lists:"Lists",learning:"Learn",search:"Search",statistics:"Statistics",settings:"Settings",manage:"Manage subjects",groupName:"Group name",emoji:"Emoji",confirmDelete:"Delete this and its contents?",noSubject:"Add a subject first.",editCard:"Edit card",editList:"Edit list",updated:"Last used",total:"Lists",automatic:"Learning points are managed automatically. Scores (0–3) will change during learning.",profile:"Profile",loading:"Loading your lists…",chooseSubject:"Choose a subject",newList:"New list",newCard:"New card",create:"Create",starred:"Starred",none:"No lists in this subject"},
 fr:{},nl:{},da:{},it:{}
};
const supplemental: Partial<Record<Language,Words>> = {
 fr:{mySubjects:"Mes matières",createList:"Créer une liste",addCard:"Ajouter une carte",saveCard:"Enregistrer la carte",saveList:"Enregistrer la liste",empty:"Aucune liste",lists:"Listes",learn:"Apprendre",question:"Question",answer:"Réponse",marked:"Favori",markedOnly:"Favoris uniquement",unseen:"Afficher les non apprises",showAnswers:"Afficher les réponses",alpha:"Alphabétique",points:"Par points",settings:"Réglages",search:"Rechercher",statistics:"Statistiques",manage:"Gérer les matières",cancel:"Annuler",save:"Enregistrer",delete:"Supprimer",edit:"Modifier",title:"Titre",subject:"Matière",tags:"Étiquettes",groupName:"Nom du groupe",addGroup:"Ajouter un groupe",addSubject:"Ajouter une matière"},
 nl:{mySubjects:"Mijn vakken",createList:"Lijst maken",addCard:"Kaart toevoegen",saveCard:"Kaart opslaan",saveList:"Lijst opslaan",empty:"Nog geen lijsten",lists:"Lijsten",learn:"Leren",question:"Vraag",answer:"Antwoord",marked:"Gemarkeerd",markedOnly:"Alleen gemarkeerde",unseen:"Niet-geleerde tonen",showAnswers:"Antwoorden tonen",alpha:"Alfabetisch",points:"Op punten",settings:"Instellingen",search:"Zoeken",statistics:"Statistieken",manage:"Vakken beheren",cancel:"Annuleren",save:"Opslaan",delete:"Verwijderen",edit:"Bewerken",title:"Titel",subject:"Vak",tags:"Tags",groupName:"Groepsnaam",addGroup:"Groep toevoegen",addSubject:"Vak toevoegen"},
 da:{mySubjects:"Mine fag",createList:"Opret liste",addCard:"Tilføj kort",saveCard:"Gem kort",saveList:"Gem liste",empty:"Ingen lister endnu",lists:"Lister",learn:"Lær",question:"Spørgsmål",answer:"Svar",marked:"Markeret",markedOnly:"Kun markerede",unseen:"Vis ikke-lærte",showAnswers:"Vis svar",alpha:"Alfabetisk",points:"Efter point",settings:"Indstillinger",search:"Søg",statistics:"Statistik",manage:"Administrer fag",cancel:"Annuller",save:"Gem",delete:"Slet",edit:"Rediger",title:"Titel",subject:"Fag",tags:"Tags",groupName:"Gruppenavn",addGroup:"Tilføj gruppe",addSubject:"Tilføj fag"},
 it:{mySubjects:"Le mie materie",createList:"Crea lista",addCard:"Aggiungi scheda",saveCard:"Salva scheda",saveList:"Salva lista",empty:"Nessuna lista",lists:"Liste",learn:"Impara",question:"Domanda",answer:"Risposta",marked:"Preferita",markedOnly:"Solo preferite",unseen:"Mostra non apprese",showAnswers:"Mostra risposte",alpha:"Alfabetico",points:"Per punti",settings:"Impostazioni",search:"Cerca",statistics:"Statistiche",manage:"Gestisci materie",cancel:"Annulla",save:"Salva",delete:"Elimina",edit:"Modifica",title:"Titolo",subject:"Materia",tags:"Tag",groupName:"Nome gruppo",addGroup:"Aggiungi gruppo",addSubject:"Aggiungi materia"}
};

Object.assign(supplemental.fr!,{
 emptyInfo:"Créez votre première liste de vocabulaire et apprenez avec des fiches numériques.",groups:"Groupes et matières",addTag:"Ajouter un tag",questionLabel:"Intitulé de la question",answerLabel:"Intitulé de la réponse",both:"Apprendre dans les deux sens",bothInfo:"Les cartes seront interrogées dans les deux sens.",sorting:"Trier",progress:"Progression",cards:"Cartes",noCards:"Aucune carte",noMatching:"Aucune carte ne correspond aux filtres",listInfo:"Propriétés de la liste",learning:"Apprendre",groupName:"Nom du groupe",emoji:"Émoji",confirmDelete:"Supprimer également le contenu associé ?",noSubject:"Ajoutez d'abord une matière.",editCard:"Modifier la carte",editList:"Modifier la liste",updated:"Dernière utilisation",total:"Listes",automatic:"Les points (0–3) sont gérés automatiquement pendant l'apprentissage.",profile:"Profil",loading:"Chargement des listes…",chooseSubject:"Choisir une matière",newList:"Nouvelle liste",newCard:"Nouvelle carte",create:"Créer",starred:"Favoris",none:"Aucune liste dans cette matière",markedOnly:"Seulement les favorites",unseen:"Afficher les non apprises",showAnswers:"Afficher les réponses",addGroup:"Ajouter un groupe",addSubject:"Ajouter une matière",marked:"Favorite",saveList:"Enregistrer la liste",saveCard:"Enregistrer la carte"
});
Object.assign(supplemental.nl!,{
 emptyInfo:"Maak je eerste woordenlijst en leer met digitale flashcards.",groups:"Vakgroepen en vakken",addTag:"Tag toevoegen",questionLabel:"Vraaglabel",answerLabel:"Antwoordlabel",both:"In beide richtingen leren",bothInfo:"Kaarten worden in beide richtingen gevraagd.",sorting:"Sorteren",progress:"Voortgang",cards:"Kaarten",noCards:"Nog geen kaarten",noMatching:"Geen kaarten voldoen aan de filters",listInfo:"Lijsteigenschappen",learning:"Leren",emoji:"Emoji",confirmDelete:"Ook alle bijbehorende inhoud verwijderen?",noSubject:"Voeg eerst een vak toe.",editCard:"Kaart bewerken",editList:"Lijst bewerken",updated:"Laatst gebruikt",total:"Lijsten",automatic:"Leerpunten (0–3) worden automatisch bijgewerkt tijdens het leren.",profile:"Profiel",loading:"Lijsten laden…",chooseSubject:"Kies een vak",newList:"Nieuwe lijst",newCard:"Nieuwe kaart",create:"Aanmaken",starred:"Gemarkeerd",none:"Geen lijsten in dit vak"
});
Object.assign(supplemental.da!,{
 emptyInfo:"Opret din første ordliste, og lær med digitale kort.",groups:"Faggrupper og fag",addTag:"Tilføj tag",questionLabel:"Spørgsmålslabel",answerLabel:"Svarlabel",both:"Lær i begge retninger",bothInfo:"Kortene spørges i begge retninger.",sorting:"Sortér",progress:"Fremskridt",cards:"Kort",noCards:"Ingen kort endnu",noMatching:"Ingen kort matcher filtrene",listInfo:"Listeegenskaber",learning:"Lær",emoji:"Emoji",confirmDelete:"Slet også alt tilhørende indhold?",noSubject:"Tilføj et fag først.",editCard:"Rediger kort",editList:"Rediger liste",updated:"Sidst brugt",total:"Lister",automatic:"Læringspoint (0–3) opdateres automatisk under læring.",profile:"Profil",loading:"Indlæser lister…",chooseSubject:"Vælg fag",newList:"Ny liste",newCard:"Nyt kort",create:"Opret",starred:"Markerede",none:"Ingen lister i dette fag"
});
Object.assign(supplemental.it!,{
 emptyInfo:"Crea il tuo primo elenco di vocaboli e studia con le schede digitali.",groups:"Gruppi e materie",addTag:"Aggiungi tag",questionLabel:"Etichetta domanda",answerLabel:"Etichetta risposta",both:"Studia in entrambe le direzioni",bothInfo:"Le schede vengono proposte in entrambe le direzioni.",sorting:"Ordina",progress:"Progresso",cards:"Schede",noCards:"Nessuna scheda",noMatching:"Nessuna scheda corrisponde ai filtri",listInfo:"Proprietà della lista",learning:"Impara",emoji:"Emoji",confirmDelete:"Eliminare anche tutti i contenuti associati?",noSubject:"Aggiungi prima una materia.",editCard:"Modifica scheda",editList:"Modifica lista",updated:"Ultimo utilizzo",total:"Liste",automatic:"I punti (0–3) vengono aggiornati automaticamente durante lo studio.",profile:"Profilo",loading:"Caricamento liste…",chooseSubject:"Scegli materia",newList:"Nuova lista",newCard:"Nuova scheda",create:"Crea",starred:"Preferite",none:"Nessuna lista in questa materia"
});

const globalLabels: Partial<Record<Language,Words>> = {de:{moreSubjects:"weitere Fächer",notifications:"Benachrichtigungen",navigation:"Navigation"},en:{moreSubjects:"more subjects",notifications:"Notifications",navigation:"Navigation"},fr:{moreSubjects:"autres matières",notifications:"Notifications",navigation:"Navigation"},nl:{moreSubjects:"andere vakken",notifications:"Meldingen",navigation:"Navigatie"},da:{moreSubjects:"flere fag",notifications:"Notifikationer",navigation:"Navigation"},it:{moreSubjects:"altre materie",notifications:"Notifiche",navigation:"Navigazione"}};
function IconButton({onClick,children,label}:{onClick:()=>void;children:React.ReactNode;label:string}) {
 return <button className="v-icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
function Toggle({label,value,onChange}:{label:string;value:boolean;onChange:(next:boolean)=>void}) {
 return <label className="v-toggle"><span>{label}</span><input aria-label={label} type="checkbox" checked={value} onChange={e=>onChange(e.target.checked)}/><span className="v-slider"/></label>;
}
const newListValue=(subject_id:string):ListInput=>({subject_id,title:"",tags:[],question_label:"Frage",answer_label:"Antwort",learn_both_directions:false});
const defaultGroupOrder=["Sprachen","MINT","Sonstige"];
function defaultGroupRank(title:string):number { const i=defaultGroupOrder.indexOf(title); return i<0?defaultGroupOrder.length:i; }
function languageSubject(data:VokaData,subjectId:string):Subject|undefined {
 const subject=data.subjects.find(s=>s.id===subjectId);
 return subject&&data.groups.some(g=>g.id===subject.group_id&&g.title==="Sprachen")?subject:undefined;
}
const stamp=(time:number,language:Language)=>time?new Date(time).toLocaleDateString(language==="de"?"de-DE":language,{day:"numeric",month:"short"}):"–";
export default function VokaApp({language,onProfile}:{language:Language;onProfile:()=>void}) {
 const t=(key:string)=>globalLabels[language]?.[key]||supplemental[language]?.[key]||translations[language]?.[key]||translations.en[key]||key;
 const [data,setData]=useState<VokaData>(emptyData);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [screen,setScreen]=useState<Screen>("home");
 const [selectedSubject,setSelectedSubject]=useState<string|null>(null);
 const [selectedList,setSelectedList]=useState<string|null>(null);
 const [selectedCard,setSelectedCard]=useState<string|null>(null);
 const [draftList,setDraftList]=useState<ListInput>(newListValue(""));
 const [listEditing,setListEditing]=useState<string|null>(null);
 const [draftCard,setDraftCard]=useState({question:"",answer:"",marked:false});
 const [tagText,setTagText]=useState("");
 const [showAnswers,setShowAnswers]=useState(false),[markedOnly,setMarkedOnly]=useState(false),[unlearnedOnly,setUnlearnedOnly]=useState(false);
 const [sort,setSort]=useState<"alpha"|"points">("alpha");
 const [manageType,setManageType]=useState<"group"|"subject">("subject");
 const [manageId,setManageId]=useState<string|null>(null);
 const [manageGroup,setManageGroup]=useState("");
 const [manageTitle,setManageTitle]=useState("");
 const [manageEmoji,setManageEmoji]=useState("📘");
 const [working,setWorking]=useState(false);
 const refresh=useCallback(async()=>{try {setData(await loadVoka());setError("");}catch(e){setError(e instanceof Error?e.message:String(e));}},[]);
 useEffect(()=>{let alive=true;loadVoka().then(result=>{if(alive)setData(result)}).catch(e=>{if(alive)setError(String(e instanceof Error?e.message:e))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false};},[]);
 const groups=useMemo(()=>[...data.groups].sort((a,b)=>groupUsage(data,b.id)-groupUsage(data,a.id)||defaultGroupRank(a.title)-defaultGroupRank(b.title)||a.title.localeCompare(b.title)),[data]);
 const currentSubject=data.subjects.find(s=>s.id===selectedSubject);
 const currentList=data.lists.find(l=>l.id===selectedList);
 const listCards=useMemo(()=>data.cards.filter(c=>c.list_id===selectedList).filter(c=>(!markedOnly||c.marked)&&(!unlearnedOnly||c.success_count<3)).sort((a,b)=>sort==="alpha"?a.question.localeCompare(b.question):a.success_count-b.success_count||a.question.localeCompare(b.question)),[data.cards,selectedList,markedOnly,unlearnedOnly,sort]);
 const run=async(fn:()=>Promise<void>)=>{setWorking(true);setError("");try{await fn();await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setWorking(false)}};
 const back=()=>{if(screen==="cardForm"){setSelectedCard(null);setScreen("list");}else if(screen==="listForm")setScreen(listEditing?"list":selectedSubject?"subject":"home");else if(screen==="list")setScreen("subject");else if(screen==="subject"||screen==="manage")setScreen("home");else setScreen("home")};
 const openList=(id:string)=>{setSelectedList(id);setShowAnswers(false);setMarkedOnly(false);setUnlearnedOnly(false);setSort("alpha");setSelectedCard(null);setScreen("list")};
 const listLabels=(subjectId:string)=>{const subject=languageSubject(data,subjectId);return subject?{question_label:"Deutsch",answer_label:subject.title}:{question_label:t("question"),answer_label:t("answer")};};
 const newList=(subjectId=selectedSubject||data.subjects.find(s=>s.title==="Englisch"&&languageSubject(data,s.id))?.id||data.subjects[0]?.id||"")=>{setListEditing(null);setDraftList({...newListValue(subjectId),...listLabels(subjectId)});setTagText("");setScreen("listForm")};
 const changeListSubject=(subjectId:string)=>{const wasLanguage=Boolean(languageSubject(data,draftList.subject_id));const nextLanguage=languageSubject(data,subjectId);setDraftList({...draftList,subject_id:subjectId,question_label:nextLanguage?"Deutsch":wasLanguage?t("question"):draftList.question_label,answer_label:nextLanguage?nextLanguage.title:wasLanguage?t("answer"):draftList.answer_label});};
 const editList=(l:VokaList)=>{setSelectedList(l.id);setListEditing(l.id);setDraftList({subject_id:l.subject_id,title:l.title,tags:[...l.tags],question_label:l.question_label,answer_label:languageSubject(data,l.subject_id)?.title||l.answer_label,learn_both_directions:l.learn_both_directions});setTagText("");setScreen("listForm")};
 const openCard=(card?:VokaCard)=>{setSelectedCard(card?.id||null);setDraftCard({question:card?.question||"",answer:card?.answer||"",marked:card?.marked||false});setScreen("cardForm")};
 const saveListForm=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const id=await saveList({...draftList,answer_label:languageSubject(data,draftList.subject_id)?.title||draftList.answer_label,tags:[...new Set([...draftList.tags,...tagText.split(",").map(x=>x.trim()).filter(Boolean)])]},listEditing||undefined);setSelectedSubject(draftList.subject_id);setSelectedList(id);setScreen("list");setListEditing(null);})};
 const saveCardForm=(e:FormEvent)=>{e.preventDefault();if(!selectedList)return;void run(async()=>{await saveCard({...draftCard,list_id:selectedList},selectedCard||undefined);setSelectedCard(null);setScreen("list")})};
 const confirmRemove=(fn:()=>Promise<void>,destination:Screen)=>{if(!window.confirm(t("confirmDelete")))return;void run(async()=>{await fn();setScreen(destination)})};
 const startManage=(type:"group"|"subject", item?:SubjectGroup|Subject)=>{setManageType(type);setManageId(item?.id||null);setManageTitle(item?.title||"");setManageEmoji(item&&"emoji" in item?item.emoji:"📘");setManageGroup(item&&"group_id" in item?item.group_id:data.groups[0]?.id||"");setScreen("manage")};
 const saveManagement=(e:FormEvent)=>{e.preventDefault();void run(async()=>{if(manageType==="group"){if(manageId)await updateGroup(manageId,manageTitle.trim());else await insertGroup(manageTitle.trim())}else{if(manageId)await updateSubject(manageId,manageTitle.trim(),manageEmoji,manageGroup);else await insertSubject(manageGroup,manageTitle.trim(),manageEmoji)}setScreen("home")})};
 const listCount=(subjectId:string)=>data.lists.filter(l=>l.subject_id===subjectId).length;
 const selectedGroupCount=(groupId:string)=>data.subjects.filter(s=>s.group_id===groupId).length;
 const listTitle=currentList?<span className="v-heading-list-title"><span className="v-emoji" aria-hidden="true">{data.subjects.find(s=>s.id===currentList.subject_id)?.emoji||"📘"}</span>{currentList.title}</span>:null;
 const actions=<div className="v-floats">{screen==="cardForm"&&<button className="v-icon-button v-floating-star" type="button" title={t("marked")} aria-label={t("marked")} aria-pressed={draftCard.marked} onClick={()=>setDraftCard({...draftCard,marked:!draftCard.marked})}><Star size={19} fill={draftCard.marked?"#ff9b00":"none"} stroke={draftCard.marked?"#ff9b00":"currentColor"}/></button>}<IconButton label={t("notifications")} onClick={()=>{}}><Bell size={19}/></IconButton><IconButton label={t("profile")} onClick={onProfile}><CircleUserRound size={20}/></IconButton></div>;
 return <div className="v-app">
  {actions}
  <div className="v-content">
   {error&&<div role="alert" className="v-error">{error}<button onClick={()=>void refresh()}>↻</button></div>}
   {loading?<div className="v-empty">{t("loading")}</div>:<>
   <header className="v-heading">
    {screen!=="home"&&<IconButton onClick={back} label={t("cancel")}><ArrowLeft/></IconButton>}
    <h1>{screen==="home"?<span className="v-logo">Voka</span>:screen==="subject"?currentSubject?.title:screen==="list"?listTitle:screen==="listForm"?(listEditing?t("editList"):t("createList")):screen==="cardForm"?<><span className="v-card-editor-mobile-title">{selectedCard?t("editCard"):t("addCard")}</span><span className="v-card-editor-tablet-title">{listTitle}</span></>:t("manage")}</h1>
    {screen==="list"&&currentList&&<IconButton label={t("editList")} onClick={()=>editList(currentList)}><Pencil size={19}/></IconButton>}
   </header>
   {screen==="home"&&<div className="v-home">
    {data.lists.length===0&&<section className="v-intro"><div className="v-illustration"><BookOpen size={74}/><span>?</span></div><h2>{t("empty")}</h2><p>{t("emptyInfo")}</p><button className="v-primary" onClick={()=>newList()}><Plus size={18}/>{t("createList")}</button></section>}
    <div className="v-section-tools"><h2 className="v-section-title">{t("mySubjects")}</h2><button className="v-manage-link" onClick={()=>startManage("subject")}>{t("manage")} <Settings size={16}/></button></div>
    <div className="v-group-grid">{groups.map(g=>{
     const subjects=[...data.subjects.filter(s=>s.group_id===g.id)].sort((a,b)=>subjectUsage(data,b.id)-subjectUsage(data,a.id)||a.title.localeCompare(b.title));
     return <section className="v-group" key={g.id}><div className="v-group-head"><strong>{g.title}</strong><small>{t("updated")}: {stamp(groupUsage(data,g.id),language)}</small><button aria-label={t("edit")+" "+g.title} onClick={()=>startManage("group",g)}><Pencil size={14}/></button></div>
      <div className="v-subject-scroll">{subjects.map(s=><button className="v-subject-row" key={s.id} onClick={()=>{setSelectedSubject(s.id);setScreen("subject")}}><span className="v-emoji">{s.emoji}</span><span className="v-subject-label"><b>{s.title}</b><small>{listCount(s.id)} {t("lists")}</small></span><ChevronRight size={18}/></button>)}</div>
      {subjects.length>3&&<p className="v-scrollhint">{selectedGroupCount(g.id)-3} {t("moreSubjects")} · ↕</p>}
     </section>
    })}</div>
    {data.lists.length>0&&<button className="v-primary v-create-home" onClick={()=>newList()}><Plus size={19}/>{t("createList")}</button>}
   </div>}
   {screen==="subject"&&<div className="v-page"><div className="v-section-header"><h2>{currentSubject?.emoji} {currentSubject?.title} · {t("lists")}</h2><IconButton label={t("edit")} onClick={()=>currentSubject&&startManage("subject",currentSubject)}><Pencil size={19}/></IconButton></div>
    <div className="v-list-grid">{data.lists.filter(l=>l.subject_id===selectedSubject).sort((a,b)=>usageDate(data,b.id)-usageDate(data,a.id)||a.title.localeCompare(b.title)).map(l=><button className="v-list-row" key={l.id} onClick={()=>openList(l.id)}><div><strong>{l.title}</strong><small>{data.cards.filter(c=>c.list_id===l.id).length} {t("cards")} · {stamp(usageDate(data,l.id),language)}</small><div className="v-tag-row">{l.tags.map(tag=><span className="v-tag" key={tag}>{tag}</span>)}</div></div><ChevronRight size={21}/></button>)}</div>
    {!data.lists.some(l=>l.subject_id===selectedSubject)&&<div className="v-empty">{t("none")}</div>}
    <button className="v-primary" onClick={()=>newList(selectedSubject||"")}><Plus size={18}/>{t("createList")}</button>
   </div>}
   {(screen==="list"||screen==="cardForm")&&currentList&&<div className={"v-list-page"+(screen==="cardForm"?" v-list-page-editing":"")}>
    <div className="v-list-main">
     {currentList.tags.length>0&&<div className="v-list-summary"><div className="v-tag-row">{currentList.tags.map(tag=><span className="v-tag" key={tag}>{tag}</span>)}</div></div>}
      <div className="v-list-actions"><button className="v-primary" type="button" title={t("learn")} onClick={()=>{}}><span>▶</span> {t("learn")}</button><div className="v-progress"><BarChart3 size={21}/><span>{t("progress")}<b>{data.cards.filter(c=>c.list_id===selectedList).length?Math.round(data.cards.filter(c=>c.list_id===selectedList).reduce((sum,c)=>sum+c.success_count,0)/(data.cards.filter(c=>c.list_id===selectedList).length*3)*100):0} %</b></span></div></div>
     <div className="v-filter-area">
       <Toggle label={t("showAnswers")} value={showAnswers} onChange={setShowAnswers}/>
       <Toggle label={t("markedOnly")} value={markedOnly} onChange={setMarkedOnly}/>
       <Toggle label={t("unseen")} value={unlearnedOnly} onChange={setUnlearnedOnly}/>
       <div className="v-sort"><label>{t("sorting")}:</label><div className="v-segments"><button className={sort==="alpha"?"active":""} onClick={()=>setSort("alpha")}>{t("alpha")}</button><button className={sort==="points"?"active":""} onClick={()=>setSort("points")}>{t("points")}</button></div></div>
     </div>
     <div className="v-list-count">{listCards.length} {t("cards")}</div>
     <div className="v-card-list">{listCards.map(c=><div key={c.id} className={"v-card-row "+(selectedCard===c.id?"selected":"")}><button className="v-card-star" aria-label={t("marked")} onClick={()=>void run(()=>markCard(c.id,!c.marked))}><Star size={19} fill={c.marked?"#ff9b00":"none"} stroke={c.marked?"#ff9b00":"currentColor"}/></button><button className="v-card-open" onClick={()=>openCard(c)}><span className="v-card-question">{c.question}{showAnswers&&<span className="v-card-answer">{c.answer}</span>}</span><span className="v-dots">{[0,1,2].map(n=><i key={n} className={n<c.success_count?"filled":""}/>)}</span><b>{c.success_count} P</b></button></div>)}</div>
     {listCards.length===0&&<p className="v-empty">{data.cards.some(c=>c.list_id===selectedList)?t("noMatching"):t("noCards")}</p>}
     <button className="v-primary v-add-card" onClick={()=>openCard()}><Plus size={18}/>{t("addCard")}</button>
    </div>
    {screen==="cardForm"&&<aside className="v-card-editor">
      <h2>{selectedCard?t("editCard"):t("addCard")}</h2>
      <form className="v-form" onSubmit={saveCardForm}>
       <label>{t("question")} *<textarea required rows={3} value={draftCard.question} onChange={e=>setDraftCard({...draftCard,question:e.target.value})}/></label>
       <label>{t("answer")} *<textarea required rows={3} value={draftCard.answer} onChange={e=>setDraftCard({...draftCard,answer:e.target.value})}/></label>
       <button className="v-primary" type="submit" disabled={working}>{t("saveCard")}</button>
       {selectedCard&&<button type="button" className="v-danger" onClick={()=>confirmRemove(()=>deleteCard(selectedCard),"list")}><Trash2 size={16}/>{t("delete")}</button>}
      </form>
     </aside>}
   </div>}
   {screen==="listForm"&&<form className="v-form" onSubmit={saveListForm}>
     <label>{t("title")} *<input required maxLength={200} value={draftList.title} onChange={e=>setDraftList({...draftList,title:e.target.value})}/></label>
     <label>{t("subject")} *<select required value={draftList.subject_id} onChange={e=>changeListSubject(e.target.value)}><option value="" disabled>{t("chooseSubject")}</option>{groups.flatMap(g=>data.subjects.filter(s=>s.group_id===g.id).map(s=><option key={s.id} value={s.id}>{s.emoji} {s.title}</option>))}</select></label>
     <label>{t("tags")}<div className="v-tag-editor"><div className="v-tag-row">{draftList.tags.map(tag=><button className="v-tag" key={tag} type="button" onClick={()=>setDraftList({...draftList,tags:draftList.tags.filter(a=>a!==tag)})}>{tag} ×</button>)}</div><input placeholder={t("addTag")+" (,)"} value={tagText} onChange={e=>setTagText(e.target.value)} /></div></label>
     <div className="v-form-columns"><label>{t("questionLabel")} *<input required value={draftList.question_label} onChange={e=>setDraftList({...draftList,question_label:e.target.value})}/></label><label>{t("answerLabel")} *<input required readOnly={Boolean(languageSubject(data,draftList.subject_id))} value={languageSubject(data,draftList.subject_id)?.title||draftList.answer_label} onChange={e=>setDraftList({...draftList,answer_label:e.target.value})}/></label></div>
     <Toggle label={t("both")} value={draftList.learn_both_directions} onChange={value=>setDraftList({...draftList,learn_both_directions:value})}/>
     <p className="v-help">{t("bothInfo")}</p><button disabled={working||!draftList.subject_id} className="v-primary" type="submit">{listEditing?t("saveList"):t("createList")}</button>
     {listEditing&&<button type="button" className="v-danger" onClick={()=>confirmRemove(()=>deleteList(listEditing),"subject")}><Trash2 size={16}/>{t("delete")}</button>}
     {!draftList.subject_id&&<p className="v-help">{t("noSubject")} <button type="button" className="v-text-button" onClick={()=>startManage("subject")}>{t("addSubject")}</button></p>}
   </form>}
   {screen==="manage"&&<div className="v-page v-manage"><h2>{t("groups")}</h2><div className="v-group-grid">{groups.map(g=><div className="v-group" key={g.id}><div className="v-group-head"><b>{g.title}</b><IconButton label={t("edit")} onClick={()=>startManage("group",g)}><Pencil size={17}/></IconButton></div>{data.subjects.filter(s=>s.group_id===g.id).map(s=><button className="v-subject-row" key={s.id} onClick={()=>startManage("subject",s)}><span>{s.emoji}</span><strong>{s.title}</strong><Pencil size={15}/></button>)}</div>)}</div>
     <form className="v-form v-manage-form" onSubmit={saveManagement}><div className="v-segments"><button type="button" className={manageType==="group"?"active":""} onClick={()=>startManage("group")}>{t("addGroup")}</button><button type="button" className={manageType==="subject"?"active":""} onClick={()=>startManage("subject")}>{t("addSubject")}</button></div>
       <label>{manageType==="group"?t("groupName"):t("title")} *<input required value={manageTitle} onChange={e=>setManageTitle(e.target.value)}/></label>
       {manageType==="subject"&&<><label>{t("emoji")}<input maxLength={20} value={manageEmoji} onChange={e=>setManageEmoji(e.target.value)}/></label><label>{t("groups")}<select required value={manageGroup} onChange={e=>setManageGroup(e.target.value)}>{groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}</select></label></>}
       <button className="v-primary" type="submit" disabled={working||(manageType==="subject"&&!manageGroup)}>{t("save")}</button>
       {manageId&&<button className="v-danger" type="button" onClick={()=>confirmRemove(()=>manageType==="group"?deleteGroup(manageId):deleteSubject(manageId),"home")}><Trash2 size={16}/>{t("delete")}</button>}
     </form>
   </div>}
   </>}
  </div>
  <nav className="v-bottom-nav" aria-label={t("navigation")}>
   <button className="active" type="button" onClick={()=>setScreen("home")}><Home size={21} fill="currentColor"/><span>Voka</span></button>
   <button type="button" onClick={()=>{}}><Search size={21}/><span>{t("search")}</span></button>
   <button type="button" onClick={()=>{}}><BarChart3 size={21}/><span>{t("statistics")}</span></button>
   <button type="button" onClick={()=>{}}><Settings size={21}/><span>{t("settings")}</span></button>
  </nav>
 </div>;
}
