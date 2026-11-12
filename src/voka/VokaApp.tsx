import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, ArrowLeftRight, BarChart3, Bell, BookOpen, Check, ChevronRight, CircleUserRound, Home, Pencil, Plus, Search, Settings, Share2, Star, Trash2, X, Play } from "lucide-react";
import type { Language } from "../lib/i18n";
import { emptyData, loadVoka, beginLearning, beginMixedLearning, saveList, deleteList, saveCard, deleteCard, markCard, insertGroup, updateGroup, deleteGroup, insertSubject, updateSubject, deleteSubject, usageDate, subjectUsage, groupUsage, type VokaData, type VokaCard, type VokaList, type Subject, type SubjectGroup, type ListInput } from "./data";
import "./voka.css";
import LearningScreen from "./LearningScreen";
import MixedLearningPicker from "./MixedLearningPicker";
import { learningProgress, effectiveLearningPause, calendarPauseDay, formatLearningPause } from "./learning";
import { getUserAvatarColor } from "../auth/userColors";
import { authManager } from "../auth/manager";
import { suggestSubjectEmoji } from "./subjectEmoji";
import { clearPendingSharedList, fetchSharedList, importSharedList, pendingSharedListId, shareUrlForList, type SharedList } from "./sharing";

type Screen = "home" | "subject" | "list" | "listForm" | "cardForm" | "manage" | "learn" | "mixedSelect";
type Words = Record<string, string>;
const translations: Record<Language, Words> = {
 de: { mySubjects:"Meine Fächer", createList:"Liste erstellen", addCard:"Karte hinzufügen", saveCard:"Karte speichern", saveList:"Liste speichern", empty:"Noch keine Listen", emptyInfo:"Erstelle deine erste Vokabelliste und lerne effektiv mit digitalen Karteikarten.", groups:"Fachgruppen & Fächer", addGroup:"Fachgruppe hinzufügen", addSubject:"Fach hinzufügen", edit:"Bearbeiten", delete:"Löschen", cancel:"Abbrechen", save:"Speichern", title:"Titel", subject:"Fach", tags:"Tags", addTag:"Tag hinzufügen", questionLabel:"Frage-Label", answerLabel:"Antwort-Label", both:"In beide Richtungen lernen", bothInfo:"Die Karteikarten werden sowohl vorwärts als auch rückwärts abgefragt.", question:"Frage", answer:"Antwort", marked:"Markiert", markedOnly:"Nur Markierte", unseen:"Ungelernte anzeigen", showAnswers:"Antworten anzeigen", sorting:"Sortieren", alpha:"Alphabetisch", points:"Nach Punkten", position:"Nach Position", learn:"Lernen", progress:"Fortschritt", cards:"Karten", noCards:"Noch keine Karten", noMatching:"Keine Karten für diese Filter", listInfo:"Listeneigenschaften", lists:"Listen", learning:"Lernen", search:"Suchen", statistics:"Statistik", settings:"Einstellungen", manage:"Fächer verwalten", groupName:"Name der Fachgruppe", emoji:"Emoji", confirmDelete:"Wirklich löschen? Zugehörige Inhalte werden ebenfalls gelöscht.", noSubject:"Lege zuerst ein Fach an.", editCard:"Karte bearbeiten", editList:"Liste bearbeiten", updated:"Zuletzt", total:"Listen", automatic:"Lernpunkte werden automatisch verwaltet. Die Punktzahl (0–4) passt sich beim Lernen an.", profile:"Profil", loading:"Lade deine Listen…", chooseSubject:"Fach auswählen", newList:"Neue Liste", newCard:"Neue Karte", create:"Erstellen", starred:"Markierte", none:"Keine Listen in diesem Fach" },
 en: {mySubjects:"My subjects",createList:"Create list",addCard:"Add card",saveCard:"Save card",saveList:"Save list",empty:"No lists yet",emptyInfo:"Create your first vocabulary list and learn with digital flashcards.",groups:"Subject groups & subjects",addGroup:"Add group",addSubject:"Add subject",edit:"Edit",delete:"Delete",cancel:"Cancel",save:"Save",title:"Title",subject:"Subject",tags:"Tags",addTag:"Add tag",questionLabel:"Question label",answerLabel:"Answer label",both:"Learn in both directions",bothInfo:"Cards are tested both forwards and backwards.",question:"Question",answer:"Answer",marked:"Starred",markedOnly:"Only starred",unseen:"Show unlearned",showAnswers:"Show answers",sorting:"Sort by",alpha:"Alphabetical",points:"By points",position:"By position",learn:"Learn",progress:"Progress",cards:"Cards",noCards:"No cards yet",noMatching:"No cards match these filters",listInfo:"List properties",lists:"Lists",learning:"Learn",search:"Search",statistics:"Statistics",settings:"Settings",manage:"Manage subjects",groupName:"Group name",emoji:"Emoji",confirmDelete:"Delete this and its contents?",noSubject:"Add a subject first.",editCard:"Edit card",editList:"Edit list",updated:"Last used",total:"Lists",automatic:"Learning points are managed automatically. Scores (0–4) will change during learning.",profile:"Profile",loading:"Loading your lists…",chooseSubject:"Choose a subject",newList:"New list",newCard:"New card",create:"Create",starred:"Starred",none:"No lists in this subject"},
 fr:{},nl:{},da:{},it:{}
};
const learningButtonWords: Record<Language,Record<string,string>>={
 de:{paused:"Noch",minutesPause:"min Pause",hoursPause:"Pause",pausedTomorrow:"bis morgen pausiert",pausedDayPrefix:"bis ",pausedDaySuffix:" pausiert",allLearned:"Alle Karten gelernt",starting:"Wird gestartet…"},
 en:{paused:"Pause:",minutesPause:"min left",hoursPause:"left",pausedTomorrow:"Paused until tomorrow",pausedDayPrefix:"Paused until ",pausedDaySuffix:"",allLearned:"All cards learned",starting:"Starting…"},
 fr:{paused:"Pause :",minutesPause:"min restantes",hoursPause:"restantes",pausedTomorrow:"En pause jusqu’à demain",pausedDayPrefix:"En pause jusqu’à ",pausedDaySuffix:"",allLearned:"Toutes les cartes apprises",starting:"Démarrage…"},
 nl:{paused:"Pauze:",minutesPause:"min over",hoursPause:"over",pausedTomorrow:"Gepauzeerd tot morgen",pausedDayPrefix:"Gepauzeerd tot ",pausedDaySuffix:"",allLearned:"Alle kaarten geleerd",starting:"Starten…"},
 da:{paused:"Pause:",minutesPause:"min tilbage",hoursPause:"tilbage",pausedTomorrow:"Pause til i morgen",pausedDayPrefix:"Pause til ",pausedDaySuffix:"",allLearned:"Alle kort lært",starting:"Starter…"},
 it:{paused:"Pausa:",minutesPause:"min rimasti",hoursPause:"rimasti",pausedTomorrow:"In pausa fino a domani",pausedDayPrefix:"In pausa fino a ",pausedDaySuffix:"",allLearned:"Tutte le schede apprese",starting:"Avvio…"}
};

const sharingWords: Record<Language,Record<string,string>> = {
 de:{
  share:"Teilen",shareCopied:"Link kopiert",shareCopy:"Link kopieren",shareFallback:"Diesen Link kopieren und weitergeben",
  shareFailed:"Der Link konnte nicht geteilt werden.",importHeading:"Geteilte Liste importieren",
  importDetails:"Wähle das Fach und passe bei Bedarf den Namen und die Tags an.",
  importSubject:"Ziel-Fach",importTitle:"Name der Liste",importTags:"Tags (durch Komma getrennt)",
  importCards:"Karten",importReset:"Beim Import werden Lernpunkte und Position aller Karten auf 0 gesetzt.",
  importNow:"Liste importieren",importLoading:"Geteilte Liste wird geladen…",
  importUnavailable:"Diese geteilte Liste wurde nicht gefunden oder ist nicht mehr verfügbar.",
  importError:"Der Import ist fehlgeschlagen. Bitte erneut versuchen."
 },
 en:{
  share:"Share",shareCopied:"Link copied",shareCopy:"Copy link",shareFallback:"Copy and send this link",
  shareFailed:"Could not share the link.",importHeading:"Import shared list",
  importDetails:"Choose a subject and optionally edit the title and tags.",
  importSubject:"Destination subject",importTitle:"List title",importTags:"Tags (comma separated)",
  importCards:"Cards",importReset:"All imported cards start with 0 points and position 0.",
  importNow:"Import list",importLoading:"Loading shared list…",
  importUnavailable:"This shared list was not found or is no longer available.",
  importError:"Import failed. Please try again."
 },
 fr:{
  share:"Partager",shareCopied:"Lien copié",shareCopy:"Copier le lien",shareFallback:"Copiez et envoyez ce lien",
  shareFailed:"Impossible de partager le lien.",importHeading:"Importer une liste partagée",
  importDetails:"Choisissez une matière et modifiez le titre ou les étiquettes si nécessaire.",
  importSubject:"Matière de destination",importTitle:"Titre de la liste",importTags:"Étiquettes (séparées par des virgules)",
  importCards:"Cartes",importReset:"Les points et positions des cartes importées sont remis à zéro.",
  importNow:"Importer",importLoading:"Chargement de la liste…",
  importUnavailable:"Cette liste partagée est introuvable ou indisponible.",
  importError:"L'importation a échoué. Réessayez."
 },
 nl:{
  share:"Delen",shareCopied:"Link gekopieerd",shareCopy:"Link kopiëren",shareFallback:"Kopieer en verstuur deze link",
  shareFailed:"Link delen is mislukt.",importHeading:"Gedeelde lijst importeren",
  importDetails:"Kies een vak en pas eventueel de titel en tags aan.",
  importSubject:"Doelvak",importTitle:"Lijsttitel",importTags:"Tags (gescheiden door komma's)",
  importCards:"Kaarten",importReset:"Leerpunten en posities beginnen bij 0.",
  importNow:"Lijst importeren",importLoading:"Gedeelde lijst laden…",
  importUnavailable:"Deze gedeelde lijst bestaat niet of is niet meer beschikbaar.",
  importError:"Importeren mislukt. Probeer opnieuw."
 },
 da:{
  share:"Del",shareCopied:"Link kopieret",shareCopy:"Kopiér link",shareFallback:"Kopiér og send dette link",
  shareFailed:"Linket kunne ikke deles.",importHeading:"Importér delt liste",
  importDetails:"Vælg et fag og redigér eventuelt titel og tags.",
  importSubject:"Fag",importTitle:"Listens titel",importTags:"Tags (adskilt med komma)",
  importCards:"Kort",importReset:"Point og position nulstilles for alle importerede kort.",
  importNow:"Importér liste",importLoading:"Henter delt liste…",
  importUnavailable:"Den delte liste kunne ikke findes eller er ikke længere tilgængelig.",
  importError:"Importen mislykkedes. Prøv igen."
 },
 it:{
  share:"Condividi",shareCopied:"Link copiato",shareCopy:"Copia link",shareFallback:"Copia e invia questo link",
  shareFailed:"Impossibile condividere il link.",importHeading:"Importa lista condivisa",
  importDetails:"Scegli una materia e modifica, se vuoi, il titolo e i tag.",
  importSubject:"Materia di destinazione",importTitle:"Titolo della lista",importTags:"Tag (separati da virgole)",
  importCards:"Schede",importReset:"Punti e posizioni delle schede importate ripartono da 0.",
  importNow:"Importa lista",importLoading:"Caricamento lista condivisa…",
  importUnavailable:"La lista condivisa non è stata trovata o non è più disponibile.",
  importError:"Importazione non riuscita. Riprova."
 }
};

const supplemental: Partial<Record<Language,Words>> = {
 fr:{mySubjects:"Mes matières",createList:"Créer une liste",addCard:"Ajouter une carte",saveCard:"Enregistrer la carte",saveList:"Enregistrer la liste",empty:"Aucune liste",lists:"Listes",learn:"Apprendre",question:"Question",answer:"Réponse",marked:"Favori",markedOnly:"Favoris uniquement",unseen:"Afficher les non apprises",showAnswers:"Afficher les réponses",alpha:"Alphabétique",points:"Par points",position:"Par position",settings:"Réglages",search:"Rechercher",statistics:"Statistiques",manage:"Gérer les matières",cancel:"Annuler",save:"Enregistrer",delete:"Supprimer",edit:"Modifier",title:"Titre",subject:"Matière",tags:"Étiquettes",groupName:"Nom du groupe",addGroup:"Ajouter un groupe",addSubject:"Ajouter une matière"},
 nl:{mySubjects:"Mijn vakken",createList:"Lijst maken",addCard:"Kaart toevoegen",saveCard:"Kaart opslaan",saveList:"Lijst opslaan",empty:"Nog geen lijsten",lists:"Lijsten",learn:"Leren",question:"Vraag",answer:"Antwoord",marked:"Gemarkeerd",markedOnly:"Alleen gemarkeerde",unseen:"Niet-geleerde tonen",showAnswers:"Antwoorden tonen",alpha:"Alfabetisch",points:"Op punten",position:"Op positie",settings:"Instellingen",search:"Zoeken",statistics:"Statistieken",manage:"Vakken beheren",cancel:"Annuleren",save:"Opslaan",delete:"Verwijderen",edit:"Bewerken",title:"Titel",subject:"Vak",tags:"Tags",groupName:"Groepsnaam",addGroup:"Groep toevoegen",addSubject:"Vak toevoegen"},
 da:{mySubjects:"Mine fag",createList:"Opret liste",addCard:"Tilføj kort",saveCard:"Gem kort",saveList:"Gem liste",empty:"Ingen lister endnu",lists:"Lister",learn:"Lær",question:"Spørgsmål",answer:"Svar",marked:"Markeret",markedOnly:"Kun markerede",unseen:"Vis ikke-lærte",showAnswers:"Vis svar",alpha:"Alfabetisk",points:"Efter point",position:"Efter position",settings:"Indstillinger",search:"Søg",statistics:"Statistik",manage:"Administrer fag",cancel:"Annuller",save:"Gem",delete:"Slet",edit:"Rediger",title:"Titel",subject:"Fag",tags:"Tags",groupName:"Gruppenavn",addGroup:"Tilføj gruppe",addSubject:"Tilføj fag"},
 it:{mySubjects:"Le mie materie",createList:"Crea lista",addCard:"Aggiungi scheda",saveCard:"Salva scheda",saveList:"Salva lista",empty:"Nessuna lista",lists:"Liste",learn:"Impara",question:"Domanda",answer:"Risposta",marked:"Preferita",markedOnly:"Solo preferite",unseen:"Mostra non apprese",showAnswers:"Mostra risposte",alpha:"Alfabetico",points:"Per punti",position:"Per posizione",settings:"Impostazioni",search:"Cerca",statistics:"Statistiche",manage:"Gestisci materie",cancel:"Annulla",save:"Salva",delete:"Elimina",edit:"Modifica",title:"Titolo",subject:"Materia",tags:"Tag",groupName:"Nome gruppo",addGroup:"Aggiungi gruppo",addSubject:"Aggiungi materia"}
};

Object.assign(supplemental.fr!,{
 emptyInfo:"Créez votre première liste de vocabulaire et apprenez avec des fiches numériques.",groups:"Groupes et matières",addTag:"Ajouter un tag",questionLabel:"Intitulé de la question",answerLabel:"Intitulé de la réponse",both:"Apprendre dans les deux sens",bothInfo:"Les cartes seront interrogées dans les deux sens.",sorting:"Trier",progress:"Progression",cards:"Cartes",noCards:"Aucune carte",noMatching:"Aucune carte ne correspond aux filtres",listInfo:"Propriétés de la liste",learning:"Apprendre",groupName:"Nom du groupe",emoji:"Émoji",confirmDelete:"Supprimer également le contenu associé ?",noSubject:"Ajoutez d'abord une matière.",editCard:"Modifier la carte",editList:"Modifier la liste",updated:"Dernière utilisation",total:"Listes",automatic:"Les points (0–4) sont gérés automatiquement pendant l'apprentissage.",profile:"Profil",loading:"Chargement des listes…",chooseSubject:"Choisir une matière",newList:"Nouvelle liste",newCard:"Nouvelle carte",create:"Créer",starred:"Favoris",none:"Aucune liste dans cette matière",markedOnly:"Seulement les favorites",unseen:"Afficher les non apprises",showAnswers:"Afficher les réponses",addGroup:"Ajouter un groupe",addSubject:"Ajouter une matière",marked:"Favorite",saveList:"Enregistrer la liste",saveCard:"Enregistrer la carte"
});
Object.assign(supplemental.nl!,{
 emptyInfo:"Maak je eerste woordenlijst en leer met digitale flashcards.",groups:"Vakgroepen en vakken",addTag:"Tag toevoegen",questionLabel:"Vraaglabel",answerLabel:"Antwoordlabel",both:"In beide richtingen leren",bothInfo:"Kaarten worden in beide richtingen gevraagd.",sorting:"Sorteren",progress:"Voortgang",cards:"Kaarten",noCards:"Nog geen kaarten",noMatching:"Geen kaarten voldoen aan de filters",listInfo:"Lijsteigenschappen",learning:"Leren",emoji:"Emoji",confirmDelete:"Ook alle bijbehorende inhoud verwijderen?",noSubject:"Voeg eerst een vak toe.",editCard:"Kaart bewerken",editList:"Lijst bewerken",updated:"Laatst gebruikt",total:"Lijsten",automatic:"Leerpunten (0–4) worden automatisch bijgewerkt tijdens het leren.",profile:"Profiel",loading:"Lijsten laden…",chooseSubject:"Kies een vak",newList:"Nieuwe lijst",newCard:"Nieuwe kaart",create:"Aanmaken",starred:"Gemarkeerd",none:"Geen lijsten in dit vak"
});
Object.assign(supplemental.da!,{
 emptyInfo:"Opret din første ordliste, og lær med digitale kort.",groups:"Faggrupper og fag",addTag:"Tilføj tag",questionLabel:"Spørgsmålslabel",answerLabel:"Svarlabel",both:"Lær i begge retninger",bothInfo:"Kortene spørges i begge retninger.",sorting:"Sortér",progress:"Fremskridt",cards:"Kort",noCards:"Ingen kort endnu",noMatching:"Ingen kort matcher filtrene",listInfo:"Listeegenskaber",learning:"Lær",emoji:"Emoji",confirmDelete:"Slet også alt tilhørende indhold?",noSubject:"Tilføj et fag først.",editCard:"Rediger kort",editList:"Rediger liste",updated:"Sidst brugt",total:"Lister",automatic:"Læringspoint (0–4) opdateres automatisk under læring.",profile:"Profil",loading:"Indlæser lister…",chooseSubject:"Vælg fag",newList:"Ny liste",newCard:"Nyt kort",create:"Opret",starred:"Markerede",none:"Ingen lister i dette fag"
});
Object.assign(supplemental.it!,{
 emptyInfo:"Crea il tuo primo elenco di vocaboli e studia con le schede digitali.",groups:"Gruppi e materie",addTag:"Aggiungi tag",questionLabel:"Etichetta domanda",answerLabel:"Etichetta risposta",both:"Studia in entrambe le direzioni",bothInfo:"Le schede vengono proposte in entrambe le direzioni.",sorting:"Ordina",progress:"Progresso",cards:"Schede",noCards:"Nessuna scheda",noMatching:"Nessuna scheda corrisponde ai filtri",listInfo:"Proprietà della lista",learning:"Impara",emoji:"Emoji",confirmDelete:"Eliminare anche tutti i contenuti associati?",noSubject:"Aggiungi prima una materia.",editCard:"Modifica scheda",editList:"Modifica lista",updated:"Ultimo utilizzo",total:"Liste",automatic:"I punti (0–4) vengono aggiornati automaticamente durante lo studio.",profile:"Profilo",loading:"Caricamento liste…",chooseSubject:"Scegli materia",newList:"Nuova lista",newCard:"Nuova scheda",create:"Crea",starred:"Preferite",none:"Nessuna lista in questa materia"
});

const globalLabels: Partial<Record<Language,Words>> = {de:{moreSubjects:"weitere Fächer",notifications:"Benachrichtigungen",navigation:"Navigation"},en:{moreSubjects:"more subjects",notifications:"Notifications",navigation:"Navigation"},fr:{moreSubjects:"autres matières",notifications:"Notifications",navigation:"Navigation"},nl:{moreSubjects:"andere vakken",notifications:"Meldingen",navigation:"Navigatie"},da:{moreSubjects:"flere fag",notifications:"Notifikationer",navigation:"Navigation"},it:{moreSubjects:"altre materie",notifications:"Notifiche",navigation:"Navigazione"}};
function IconButton({onClick,children,label,style,className}:{onClick:()=>void;children:React.ReactNode;label:string;style?:React.CSSProperties;className?:string}) {
 return <button className={"v-icon-button"+(className?" "+className:"")} type="button" aria-label={label} title={label} style={style} onClick={onClick}>{children}</button>;
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
 const t=(key:string)=>learningButtonWords[language]?.[key]||sharingWords[language]?.[key]||globalLabels[language]?.[key]||supplemental[language]?.[key]||translations[language]?.[key]||translations.en[key]||key;
 const [data,setData]=useState<VokaData>(emptyData);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [screen,setScreen]=useState<Screen>("home");
 const [learningSession,setLearningSession]=useState<{queryId:string;cardIds:string[];mixed?:boolean}|null>(null);
 const [startingLearn,setStartingLearn]=useState(false);
 const [clock,setClock]=useState(()=>Date.now());
 useEffect(()=>{
  const interval=window.setInterval(()=>setClock(Date.now()),30_000);
  return ()=>window.clearInterval(interval);
 },[]);

 const [wide,setWide]=useState(()=>window.matchMedia("(min-width: 900px)").matches);
 useEffect(()=>{
  const query=window.matchMedia("(min-width: 900px)");
  const sync=()=>setWide(query.matches);
  sync();
  query.addEventListener("change",sync);
  return ()=>query.removeEventListener("change",sync);
 },[]);

 const [selectedSubject,setSelectedSubject]=useState<string|null>(null);
 const [selectedList,setSelectedList]=useState<string|null>(null);
 const [selectedCard,setSelectedCard]=useState<string|null>(null);
 const [draftList,setDraftList]=useState<ListInput>(newListValue(""));
 const [listEditing,setListEditing]=useState<string|null>(null);
 const [draftCard,setDraftCard]=useState({question:"",answer:"",marked:false});
 const cardQuestionRef=useRef<HTMLTextAreaElement>(null);
 const cardAnswerRef=useRef<HTMLTextAreaElement>(null);
 const [tagText,setTagText]=useState("");
 const [showAnswers,setShowAnswers]=useState(false),[markedOnly,setMarkedOnly]=useState(false),[unlearnedOnly,setUnlearnedOnly]=useState(false);
 const [sort,setSort]=useState<"alpha"|"points"|"position">("alpha");
 const [manageType,setManageType]=useState<"group"|"subject">("subject");
 const [manageId,setManageId]=useState<string|null>(null);
 const [manageGroup,setManageGroup]=useState("");
 const [manageTitle,setManageTitle]=useState("");
 const [manageEmoji,setManageEmoji]=useState("📘");
 const [manageEmojiManual,setManageEmojiManual]=useState(false);
 const [manageModalOpen,setManageModalOpen]=useState(false);
 const manageDialogRef=useRef<HTMLDivElement>(null);
 const manageInputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{
  if(!manageModalOpen)return;
  const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  manageInputRef.current?.focus();
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  const onKeyDown=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();setManageModalOpen(false);return;}
   if(event.key!=="Tab")return;
   const available=Array.from(manageDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')||[]);
   if(!available.length)return;
   const first=available[0],last=available[available.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  window.addEventListener("keydown",onKeyDown);
  return ()=>{window.removeEventListener("keydown",onKeyDown);document.body.style.overflow=previousOverflow;previouslyFocused?.focus();};
 },[manageModalOpen]);
 const [working,setWorking]=useState(false);
 const [shareStatus,setShareStatus]=useState("");
 const [shareFallbackUrl,setShareFallbackUrl]=useState<string|null>(null);
 const [incomingSharedId,setIncomingSharedId]=useState<string|null>(pendingSharedListId);
 const [sharedPreview,setSharedPreview]=useState<SharedList|null>(null);
 const [sharedLoading,setSharedLoading]=useState(false);
 const [sharedError,setSharedError]=useState("");
 const [importSubject,setImportSubject]=useState("");
 const [importTitle,setImportTitle]=useState("");
 const [importTagsText,setImportTagsText]=useState("");
 const [importBusy,setImportBusy]=useState(false);
 useEffect(()=>{
  if(!incomingSharedId||loading)return;
  let cancelled=false;
  setSharedPreview(null);setSharedError("");setSharedLoading(true);
  fetchSharedList(incomingSharedId)
   .then(shared=>{
    if(cancelled)return;
    if(!shared){setSharedError(t("importUnavailable"));return;}
    setSharedPreview(shared);
    setImportTitle(shared.title);setImportTagsText(shared.tags.join(", "));
    setImportSubject("");
   })
   .catch(err=>{if(!cancelled)setSharedError(err instanceof Error?err.message:t("importUnavailable"));})
   .finally(()=>{if(!cancelled)setSharedLoading(false);});
  return ()=>{cancelled=true;};
 // The intent and active account are fixed for this mounted VokaApp.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[incomingSharedId,loading]);
 const dismissSharedImport=()=>{
  clearPendingSharedList();setIncomingSharedId(null);setSharedPreview(null);
  setSharedError("");setImportTitle("");setImportTagsText("");
 };
 const submitSharedImport=(event:FormEvent)=>{
  event.preventDefault();
  if(!incomingSharedId||!sharedPreview||!importSubject||importBusy)return;
  setImportBusy(true);setSharedError("");
  void (async()=>{
   try{
    const id=await importSharedList(incomingSharedId,importSubject,importTitle.trim(),
      [...new Set(importTagsText.split(",").map(tag=>tag.trim()).filter(Boolean))]);
    const updated=await loadVoka();
    setData(updated);
    setSelectedSubject(importSubject);setSelectedList(id);setSelectedCard(null);
    setSort("alpha");setShowAnswers(false);setMarkedOnly(false);setUnlearnedOnly(false);
    setScreen("list");dismissSharedImport();
   }catch(err){
    setSharedError(err instanceof Error?err.message:t("importError"));
   }finally{setImportBusy(false);}
  })();
 };
 const shareSelectedList=async()=>{
  if(!currentList)return;
  const url=shareUrlForList(currentList.id);
  setShareStatus("");
  if(typeof navigator.share==="function"){
   try{
    await navigator.share({title:currentList.title,url});
    return;
   }catch(err){
    if(err instanceof Error&&err.name==="AbortError")return;
   }
  }
  try{
   if(!navigator.clipboard?.writeText)throw new Error("Clipboard not supported");
   await navigator.clipboard.writeText(url);setShareStatus(t("shareCopied"));
  }catch{setShareFallbackUrl(url);}
 };

 const refresh=useCallback(async()=>{try {setData(await loadVoka());setError("");}catch(e){setError(e instanceof Error?e.message:String(e));}},[]);
 useEffect(()=>{let alive=true;loadVoka().then(result=>{if(alive)setData(result)}).catch(e=>{if(alive)setError(String(e instanceof Error?e.message:e))}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false};},[]);
 const groups=useMemo(()=>[...data.groups].sort((a,b)=>groupUsage(data,b.id)-groupUsage(data,a.id)||defaultGroupRank(a.title)-defaultGroupRank(b.title)||a.title.localeCompare(b.title)),[data]);
 const subjectsWithLists=useMemo(()=>new Set(data.lists.map(l=>l.subject_id)),[data.lists]);
 const visibleGroups=useMemo(()=>groups.filter(g=>data.subjects.some(s=>s.group_id===g.id&&subjectsWithLists.has(s.id))),[groups,data.subjects,subjectsWithLists]);
 const currentSubject=data.subjects.find(s=>s.id===selectedSubject);
 const currentList=data.lists.find(l=>l.id===selectedList);
 const learningList=learningSession?.mixed
   ?data.lists.find(l=>l.id===data.cards.find(c=>c.id===learningSession.cardIds[0])?.list_id)
   :currentList;
 const listCards=useMemo(()=>data.cards.filter(c=>c.list_id===selectedList).filter(c=>(!markedOnly||c.marked)&&(!unlearnedOnly||c.success_count<4)).sort((a,b)=>sort==="alpha"?a.question.localeCompare(b.question):sort==="position"?a.position-b.position||a.question.localeCompare(b.question):a.success_count-b.success_count||a.question.localeCompare(b.question)),[data.cards,selectedList,markedOnly,unlearnedOnly,sort]);
 const run=async(fn:()=>Promise<void>)=>{setWorking(true);setError("");try{await fn();await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setWorking(false)}};
 const startLearning=async()=>{
  if(!currentList||startingLearn)return;
  setStartingLearn(true);setError("");
  try{
   const session=await beginLearning(currentList.id);
   await refresh();
   if(session.query_id&&session.card_ids.length){
    setLearningSession({queryId:session.query_id,cardIds:session.card_ids,mixed:false});
    setScreen("learn");
   }
   // When there are no due cards, the backend advances the list's positions
   // and returns its two-hour pause instead of opening an empty session.
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setStartingLearn(false);}
 };
 const startMixedLearning=async(subjectIds:string[],tags:string[])=>{
   if(startingLearn||!subjectIds.length)return;
   setStartingLearn(true);setError("");
   try{
     const session=await beginMixedLearning(subjectIds,tags);
     await refresh();
     if(session.query_id&&session.card_ids.length){
       setLearningSession({queryId:session.query_id,cardIds:session.card_ids,mixed:true});
       setScreen("learn");
     }else{
       setError(language==="de"?"Heute sind für diese Auswahl keine Karten fällig.":"No matching cards are due today.");
     }
   }catch(e){setError(e instanceof Error?e.message:String(e))}
   finally{setStartingLearn(false);}
 };
 const finishLearningView=()=>{
   const destination=learningSession?.mixed?"home":"list";
   setLearningSession(null);setScreen(destination);
 };
 const back=()=>{if(screen==="cardForm"){setSelectedCard(null);setScreen(wide?"home":"list");}else if(screen==="listForm")setScreen(listEditing?"list":selectedSubject?"subject":"home");else if(screen==="list")setScreen("subject");else if(screen==="subject"||screen==="manage")setScreen("home");else setScreen("home")};
 const openList=(id:string)=>{setSelectedList(id);setShowAnswers(false);setMarkedOnly(false);setUnlearnedOnly(false);setSort("alpha");setSelectedCard(null);setScreen("list")};
 const listLabels=(subjectId:string)=>{const subject=languageSubject(data,subjectId);return subject?{question_label:"Deutsch",answer_label:subject.title}:{question_label:t("question"),answer_label:t("answer")};};
 const newList=(subjectId=selectedSubject||data.subjects.find(s=>s.title==="Englisch"&&languageSubject(data,s.id))?.id||data.subjects[0]?.id||"")=>{setListEditing(null);setDraftList({...newListValue(subjectId),...listLabels(subjectId)});setTagText("");setScreen("listForm")};
 const changeListSubject=(subjectId:string)=>{
  const wasLanguage=Boolean(languageSubject(data,draftList.subject_id));
  const nextLanguage=languageSubject(data,subjectId);
  const defaultQuestion= draftList.question_label==="Deutsch"||draftList.question_label===t("question");
  setDraftList({...draftList,subject_id:subjectId,
    question_label:nextLanguage?(defaultQuestion?"Deutsch":draftList.question_label):wasLanguage&&draftList.question_label==="Deutsch"?t("question"):draftList.question_label,
    answer_label:nextLanguage?nextLanguage.title:wasLanguage?t("answer"):draftList.answer_label
  });
 };
 const editList=(l:VokaList)=>{setSelectedList(l.id);setListEditing(l.id);setDraftList({subject_id:l.subject_id,title:l.title,tags:[...l.tags],question_label:l.question_label,answer_label:languageSubject(data,l.subject_id)?.title||l.answer_label,learn_both_directions:l.learn_both_directions});setTagText("");setScreen("listForm")};
 const openCard=(card?:VokaCard)=>{setSelectedCard(card?.id||null);setDraftCard({question:card?.question||"",answer:card?.answer||"",marked:card?.marked||false});setScreen("cardForm")};
 const saveListForm=(e:FormEvent)=>{e.preventDefault();void run(async()=>{const id=await saveList({...draftList,answer_label:languageSubject(data,draftList.subject_id)?.title||draftList.answer_label,tags:[...new Set([...draftList.tags,...tagText.split(",").map(x=>x.trim()).filter(Boolean)])]},listEditing||undefined);setSelectedSubject(draftList.subject_id);setSelectedList(id);setScreen("list");setListEditing(null);})};
 const saveCardForm=(e:FormEvent)=>{
  e.preventDefault();
  if(!selectedList||working||!draftCard.question.trim()||!draftCard.answer.trim())return;
  const editing=Boolean(selectedCard);
  void run(async()=>{
    await saveCard({...draftCard,question:draftCard.question.trim(),answer:draftCard.answer.trim(),list_id:selectedList},selectedCard||undefined);
    if(editing){setSelectedCard(null);setScreen("list");}
    else{
      setDraftCard({question:"",answer:"",marked:false});
      window.requestAnimationFrame(()=>cardQuestionRef.current?.focus());
    }
  });
 };
 const cardEnter=(event:ReactKeyboardEvent<HTMLTextAreaElement>,field:"question"|"answer")=>{
   if(event.key!=="Enter"||event.shiftKey||event.nativeEvent.isComposing)return;
   event.preventDefault();
   if(field==="question")cardAnswerRef.current?.focus();
   else event.currentTarget.form?.requestSubmit();
 };
 const confirmRemove=(fn:()=>Promise<void>,destination:Screen)=>{if(!window.confirm(t("confirmDelete")))return;void run(async()=>{await fn();setScreen(destination)})};
 const startManage=(type:"group"|"subject", item?:SubjectGroup|Subject, groupId?:string)=>{
  setManageType(type);setManageId(item?.id||null);setManageTitle(item?.title||"");
  setManageEmoji(item&&"emoji" in item?item.emoji:"📘");
  setManageEmojiManual(Boolean(item&&"emoji" in item));
  setManageGroup(item&&"group_id" in item?item.group_id:groupId||data.groups[0]?.id||"");
  setError("");setManageModalOpen(true);
 };
 const suggestedEmoji=(title:string,groupId:string)=>
   suggestSubjectEmoji(title,data.groups.find(g=>g.id===groupId)?.title||"");
 const onManageTitleChange=(title:string)=>{
   setManageTitle(title);
   if(manageType==="subject"&&!manageEmojiManual)setManageEmoji(suggestedEmoji(title,manageGroup)||"📘");
 };
 const onManageGroupChange=(groupId:string)=>{
   setManageGroup(groupId);
   if(manageType==="subject"&&!manageEmojiManual)setManageEmoji(suggestedEmoji(manageTitle,groupId)||"📘");
 };
 const closeManageModal=()=>{if(!working)setManageModalOpen(false);};
 const runManage=async(task:()=>Promise<void>)=>{
  setWorking(true);setError("");
  try{await task();await refresh();setManageModalOpen(false);}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setWorking(false);}
 };
 const saveManagement=(e:FormEvent)=>{
  e.preventDefault();
  void runManage(async()=>{
   if(manageType==="group"){
    if(manageId)await updateGroup(manageId,manageTitle.trim());
    else await insertGroup(manageTitle.trim());
   }else{
    if(manageId)await updateSubject(manageId,manageTitle.trim(),manageEmoji,manageGroup);
    else await insertSubject(manageGroup,manageTitle.trim(),manageEmoji);
   }
  });
 };
 const removeManagement=()=>{
  if(!manageId||!window.confirm(t("confirmDelete")))return;
  const id=manageId;
  void runManage(()=>manageType==="group"?deleteGroup(id):deleteSubject(id));
 };
 const listCount=(subjectId:string)=>data.lists.filter(l=>l.subject_id===subjectId).length;
 const avatarColor=getUserAvatarColor(authManager.activeUser?.id||"");
 const answerVisibilityLabel=currentList?(
   language==="de"?currentList.answer_label+" anzeigen":
   language==="en"?"Show "+currentList.answer_label:
   language==="fr"?"Afficher "+currentList.answer_label:
   language==="nl"?currentList.answer_label+" tonen":
   language==="da"?"Vis "+currentList.answer_label:
   "Mostra "+currentList.answer_label
  ):t("showAnswers");
 const listCardsForProgress=data.cards.filter(c=>c.list_id===selectedList);
 const calendarUntil=data.learningStates.find(s=>s.list_id===selectedList)?.calendar_pause_until;
 const effectivePause=effectiveLearningPause(currentList?.learning_paused_until,calendarUntil,clock);
 const everyCardLearned=listCardsForProgress.length>0&&listCardsForProgress.every(c=>c.success_count>=4);
 const learningUnavailable=startingLearn||Boolean(effectivePause)||everyCardLearned||listCardsForProgress.length===0;
 const dayPause=effectivePause?.kind==="calendar"?
   calendarPauseDay(effectivePause.until,currentList?.learning_timezone||"UTC",language,clock):null;
 // Re-enable learning promptly at local midnight or when the two-hour pause ends.
 // The regular 30-second clock is still used to update displayed minute counts.
 useEffect(()=>{
   const deadlines=[currentList?.learning_paused_until,calendarUntil]
     .map(value=>value?Date.parse(value):NaN)
     .filter(value=>Number.isFinite(value)&&value>clock);
   if(!deadlines.length)return;
   const until=Math.max(...deadlines);
   const wait=Math.min(Math.max(until-Date.now()+80,1),2_147_483_647);
   const timer=window.setTimeout(()=>setClock(Date.now()),wait);
   return ()=>window.clearTimeout(timer);
 },[currentList?.learning_paused_until,calendarUntil,clock]);
 const pauseLabel=effectivePause?.kind==="calendar"?
   dayPause?.tomorrow?t("pausedTomorrow"):t("pausedDayPrefix")+dayPause?.weekday+t("pausedDaySuffix"):
   effectivePause?.kind==="hours"?t("paused")+" "+(effectivePause.minutes>60?formatLearningPause(effectivePause.minutes,"min","h")+" "+t("hoursPause"):effectivePause.minutes+" "+t("minutesPause")):"";
 const learningButtonLabel=startingLearn?t("starting"):effectivePause?pauseLabel:
   everyCardLearned?t("allLearned"):listCardsForProgress.length===0?t("noCards"):t("learn");
 const listTitle=currentList?<span className="v-heading-list-title"><span className="v-emoji" aria-hidden="true">{data.subjects.find(s=>s.id===currentList.subject_id)?.emoji||"📘"}</span><span className="v-heading-title-text">{currentList.title}</span></span>:null;
 const actions=<div className="v-floats">{screen==="cardForm"&&<button className="v-icon-button v-floating-star" type="button" title={t("marked")} aria-label={t("marked")} aria-pressed={draftCard.marked} onClick={()=>setDraftCard({...draftCard,marked:!draftCard.marked})}><Star size={19} fill={draftCard.marked?"#ff9b00":"none"} stroke={draftCard.marked?"#ff9b00":"currentColor"}/></button>}<IconButton label={t("notifications")} onClick={()=>{}}><Bell size={19}/></IconButton><IconButton label={t("profile")} className="v-user-float" style={{color:avatarColor,backgroundColor:avatarColor+"24",borderColor:avatarColor+"66"}} onClick={onProfile}><CircleUserRound size={23}/></IconButton></div>;
 const listOverview = <section className="v-page v-lists-pane"><div className="v-section-header"><h2>{wide?t("lists"):`${currentSubject?.emoji||""} ${currentSubject?.title||""} · ${t("lists")}`}</h2></div>
    <div className="v-list-grid">{data.lists.filter(l=>l.subject_id===selectedSubject).sort((a,b)=>usageDate(data,b.id)-usageDate(data,a.id)||a.title.localeCompare(b.title)).map(l=>{const listPercent=learningProgress(data.cards.filter(c=>c.list_id===l.id));return <button className={"v-list-row"+(l.id===selectedList&&screen!=="subject"?" selected":"")} aria-current={l.id===selectedList&&screen!=="subject"?"true":undefined} key={l.id} onClick={()=>openList(l.id)}><div><strong>{l.title}</strong><small>{data.cards.filter(c=>c.list_id===l.id).length} {t("cards")} · {stamp(usageDate(data,l.id),language)}</small><div className="v-list-progress-label"><span>{t("progress")}</span><b>{listPercent} %</b></div><div className="v-list-progress-track" role="progressbar" aria-label={t("progress")} aria-valuenow={listPercent} aria-valuemin={0} aria-valuemax={100}><span style={{width:listPercent+"%"}}/></div><div className="v-tag-row">{l.tags.map(tag=><span className="v-tag" key={tag}>{tag}</span>)}</div></div><ChevronRight size={21}/></button>})}</div>
    {!data.lists.some(l=>l.subject_id===selectedSubject)&&<div className="v-empty">{t("none")}</div>}
    <button className="v-primary" onClick={()=>newList(selectedSubject||"")}><Plus size={18}/>{t("createList")}</button>
    </section>;
 return <div className={"v-app"+(screen==="cardForm"?" v-card-form-active":"")+(screen==="learn"?" v-learning-active":"")}>
  {screen!=="learn"&&actions}
  <div className="v-content">
   {error&&<div role="alert" className="v-error">{error}<button onClick={()=>void refresh()}>↻</button></div>}
   {loading?<div className="v-empty">{t("loading")}</div>:<>
   {screen!=="learn"&&screen!=="mixedSelect"&&<header className="v-heading">
    {screen!=="home"&&<IconButton onClick={back} label={t("cancel")}><ArrowLeft/></IconButton>}
    <h1>{screen==="home"?<span className="v-logo">Voka</span>:wide&&(screen==="subject"||screen==="list"||screen==="cardForm"||(screen==="listForm"&&Boolean(listEditing)))?<span>{currentSubject?.emoji} {currentSubject?.title}</span>:screen==="subject"?currentSubject?.title:screen==="list"?listTitle:screen==="listForm"?(listEditing?t("editList"):t("createList")):screen==="cardForm"?(selectedCard?t("editCard"):t("addCard")):t("manage")}</h1>
    {!wide&&(screen==="list"||screen==="cardForm")&&currentList&&<div className="v-detail-header-actions">
       <IconButton label={t("share")} onClick={()=>void shareSelectedList()}><Share2 size={19}/></IconButton>
       {screen==="list"&&<IconButton label={t("editList")} onClick={()=>editList(currentList)}><Pencil size={19}/></IconButton>}
     </div>}
   </header>}
   {screen==="learn"&&learningSession&&learningList&&<LearningScreen language={language} list={learningList}
     cards={data.cards} session={learningSession}
     mixed={learningSession.mixed?{lists:data.lists,subjects:data.subjects}:undefined}
     onRefresh={refresh} onExit={finishLearningView}/>}
   {screen==="mixedSelect"&&<MixedLearningPicker data={data} language={language}
     busy={startingLearn} onCancel={()=>setScreen("home")}
     onStart={(subjects,tags)=>void startMixedLearning(subjects,tags)}/>} 
   {screen==="home"&&<div className="v-home">
    {data.lists.length===0&&<section className="v-intro"><div className="v-illustration"><BookOpen size={74}/><span>?</span></div><h2>{t("empty")}</h2><p>{t("emptyInfo")}</p><button className="v-primary" onClick={()=>newList()}><Plus size={18}/>{t("createList")}</button></section>}
    <div className="v-section-tools"><h2 className="v-section-title">{t("mySubjects")}</h2>
      <div className="v-home-actions">
       {data.lists.length>0&&<button type="button" className="v-primary v-home-learn" onClick={()=>setScreen("mixedSelect")}><Play size={17}/>{t("learn")}</button>}
       <button className="v-manage-link" onClick={()=>{setManageModalOpen(false);setScreen("manage")}}>{t("manage")} <Settings size={16}/></button>
      </div></div>
    <div className="v-group-grid">{visibleGroups.map(g=>{
     const subjects=[...data.subjects.filter(s=>s.group_id===g.id&&subjectsWithLists.has(s.id))].sort((a,b)=>subjectUsage(data,b.id)-subjectUsage(data,a.id)||a.title.localeCompare(b.title));
     return <section className="v-group" key={g.id}><div className="v-group-head"><strong>{g.title}</strong><small>{t("updated")}: {stamp(groupUsage(data,g.id),language)}</small><button aria-label={t("edit")+" "+g.title} onClick={()=>startManage("group",g)}><Pencil size={14}/></button></div>
      <div className="v-subject-scroll">{subjects.map(s=><button className="v-subject-row" key={s.id} onClick={()=>{setSelectedSubject(s.id);setScreen("subject")}}><span className="v-emoji">{s.emoji}</span><span className="v-subject-label"><b>{s.title}</b><small>{listCount(s.id)} {t("lists")}</small></span><ChevronRight size={18}/></button>)}</div>
      {subjects.length>3&&<p className="v-scrollhint">{subjects.length-3} {t("moreSubjects")} · ↕</p>}
     </section>
    })}</div>
    {data.lists.length>0&&<button className="v-primary v-create-home" onClick={()=>newList()}><Plus size={19}/>{t("createList")}</button>}
   </div>}
   {(screen==="subject"||screen==="list"||screen==="cardForm")&&<div className={"v-subject-workspace "+(screen==="subject"?"is-subject":screen==="cardForm"?"is-card":"is-list")}>
    {listOverview}
    {(screen==="list"||screen==="cardForm")&&currentList&&<div className={"v-list-page"+(screen==="cardForm"?" v-list-page-editing":"")}>
     <section className="v-list-detail-pane">
     {wide&&<div className="v-pane-list-heading"><h2>{listTitle}</h2><div className="v-detail-header-actions">
      <IconButton label={t("share")} onClick={()=>void shareSelectedList()}><Share2 size={18}/></IconButton>
      <IconButton label={t("editList")} onClick={()=>editList(currentList)}><Pencil size={18}/></IconButton></div></div>}
    <div className="v-list-main">
     {currentList.tags.length>0&&<div className="v-list-summary"><div className="v-tag-row">{currentList.tags.map(tag=><span className="v-tag" key={tag}>{tag}</span>)}</div></div>}
      <div className="v-list-actions"><button className="v-primary" type="button" title={learningButtonLabel} aria-label={learningButtonLabel} disabled={learningUnavailable} onClick={()=>void startLearning()}><span>▶</span> {learningButtonLabel}</button><div className="v-progress"><BarChart3 size={21}/><span>{t("progress")}<b>{learningProgress(listCardsForProgress)} %</b></span></div>
     </div>
     {shareStatus&&<p className="v-share-status" role="status">{shareStatus}</p>}
     <div className="v-filter-area">
       <Toggle label={answerVisibilityLabel} value={showAnswers} onChange={setShowAnswers}/>
       <Toggle label={t("markedOnly")} value={markedOnly} onChange={setMarkedOnly}/>
       <Toggle label={t("unseen")} value={unlearnedOnly} onChange={setUnlearnedOnly}/>
       <div className="v-sort"><label>{t("sorting")}:</label><div className="v-segments"><button className={sort==="alpha"?"active":""} onClick={()=>setSort("alpha")}>{t("alpha")}</button><button className={sort==="points"?"active":""} onClick={()=>setSort("points")}>{t("points")}</button><button className={sort==="position"?"active":""} onClick={()=>setSort("position")}>{t("position")}</button></div></div>
     </div>
     <div className="v-list-count">{listCards.length} {t("cards")}</div>
     <div className="v-card-list">{listCards.map(c=><div key={c.id} className={"v-card-row "+(selectedCard===c.id?"selected":"")}><button className="v-card-star" aria-label={t("marked")} onClick={()=>void run(()=>markCard(c.id,!c.marked))}><Star size={19} fill={c.marked?"#ff9b00":"none"} stroke={c.marked?"#ff9b00":"currentColor"}/></button><button className="v-card-open" onClick={()=>openCard(c)}><span className="v-card-question">{c.question}{showAnswers&&<span className="v-card-answer">{c.answer}</span>}</span><span className="v-dots">{[0,1,2,3].map(n=><i key={n} className={n<c.success_count?"filled":""}/>)}</span><b>{c.success_count} P</b></button></div>)}</div>
     {listCards.length===0&&<p className="v-empty">{data.cards.some(c=>c.list_id===selectedList)?t("noMatching"):t("noCards")}</p>}
     <button className="v-primary v-add-card" onClick={()=>openCard()}><Plus size={18}/>{t("addCard")}</button>
    </div>
     </section>
    {screen==="cardForm"&&<aside className="v-card-editor">
      <h2>{selectedCard?t("editCard"):t("addCard")}</h2>
      <form className="v-form" onSubmit={saveCardForm}>
       <label>{currentList.question_label} *<textarea ref={cardQuestionRef} autoFocus enterKeyHint="next" required rows={3} value={draftCard.question} onChange={e=>setDraftCard({...draftCard,question:e.target.value})} onKeyDown={e=>cardEnter(e,"question")}/></label>
       <label>{currentList.answer_label} *<textarea ref={cardAnswerRef} enterKeyHint="done" required rows={3} value={draftCard.answer} onChange={e=>setDraftCard({...draftCard,answer:e.target.value})} onKeyDown={e=>cardEnter(e,"answer")}/></label>
       <button className="v-primary" type="submit" disabled={working}>{t("saveCard")}</button>
       <button className="v-outline v-cancel-card" type="button" disabled={working} onClick={()=>{setSelectedCard(null);setScreen("list")}}>{t("cancel")}</button>
       {selectedCard&&<button type="button" className="v-danger" onClick={()=>confirmRemove(()=>deleteCard(selectedCard),"list")}><Trash2 size={16}/>{t("delete")}</button>}
      </form>
     </aside>}
   </div>}
   </div>}
   {screen==="listForm"&&<div className={"v-list-form-workspace"+(wide&&listEditing?" is-wide":"")}>
     {wide&&Boolean(listEditing)&&listOverview}
     <section className="v-list-edit-pane">
      {wide&&listEditing&&<h2 className="v-edit-pane-heading">{t("editList")}</h2>}
      <form className="v-form" onSubmit={saveListForm}>
     <label>{t("title")} *<input required maxLength={200} value={draftList.title} onChange={e=>setDraftList({...draftList,title:e.target.value})}/></label>
     <label>{t("subject")} *<select required value={draftList.subject_id} onChange={e=>changeListSubject(e.target.value)}><option value="" disabled>{t("chooseSubject")}</option>{groups.flatMap(g=>data.subjects.filter(s=>s.group_id===g.id).map(s=><option key={s.id} value={s.id}>{s.emoji} {s.title}</option>))}</select></label>
     <label>{t("tags")}<div className="v-tag-editor"><div className="v-tag-row">{draftList.tags.map(tag=><button className="v-tag" key={tag} type="button" onClick={()=>setDraftList({...draftList,tags:draftList.tags.filter(a=>a!==tag)})}>{tag} ×</button>)}</div><input placeholder={t("addTag")+" (,)"} value={tagText} onChange={e=>setTagText(e.target.value)} /></div></label>
     <div className="v-form-columns"><label>{t("questionLabel")} *<input required value={draftList.question_label} onChange={e=>setDraftList({...draftList,question_label:e.target.value})}/></label><label>{t("answerLabel")} *<input required readOnly={Boolean(languageSubject(data,draftList.subject_id))} value={languageSubject(data,draftList.subject_id)?.title||draftList.answer_label} onChange={e=>setDraftList({...draftList,answer_label:e.target.value})}/></label></div>
     <button className={"v-direction-button"+(draftList.learn_both_directions?" is-active":"")} type="button" aria-pressed={draftList.learn_both_directions} onClick={()=>setDraftList({...draftList,learn_both_directions:!draftList.learn_both_directions})}><ArrowLeftRight size={21}/><span>{t("both")}</span><span className="v-direction-check" aria-hidden="true">{draftList.learn_both_directions&&<Check size={16}/>}</span></button>
     <p className="v-help">{t("bothInfo")}</p><button disabled={working||!draftList.subject_id} className="v-primary" type="submit">{listEditing?t("saveList"):t("createList")}</button>
      <button type="button" className="v-outline v-cancel-list" disabled={working} onClick={()=>{back();setListEditing(null);setTagText("");}}>{t("cancel")}</button>
     {listEditing&&<button type="button" className="v-danger" onClick={()=>confirmRemove(()=>deleteList(listEditing),"subject")}><Trash2 size={16}/>{t("delete")}</button>}
     {!draftList.subject_id&&<p className="v-help">{t("noSubject")} <button type="button" className="v-text-button" onClick={()=>startManage("subject")}>{t("addSubject")}</button></p>}
   </form></section></div>}
   {screen==="manage"&&<div className="v-page v-manage">
      <h2>{t("groups")}</h2>
      <div className="v-group-grid">{groups.map(g=><section className="v-group v-manage-group" key={g.id}>
        <div className="v-group-head"><b>{g.title}</b><IconButton label={t("edit")+" "+g.title} onClick={()=>startManage("group",g)}><Pencil size={17}/></IconButton></div>
        {data.subjects.filter(s=>s.group_id===g.id).sort((a,b)=>subjectUsage(data,b.id)-subjectUsage(data,a.id)||a.title.localeCompare(b.title)).map(s=>
          <button type="button" className="v-subject-row" aria-label={t("edit")+" "+s.title} key={s.id} onClick={()=>startManage("subject",s)}>
            <span className="v-emoji">{s.emoji}</span><strong>{s.title}</strong><Pencil size={15}/>
          </button>)}
        <button type="button" className="v-manage-add-subject" onClick={()=>startManage("subject",undefined,g.id)}><Plus size={17}/>{t("addSubject")}</button>
      </section>)}</div>
      <button type="button" className="v-outline v-manage-add-group" onClick={()=>startManage("group")}><Plus size={18}/>{t("addGroup")}</button>
    </div>}
    {manageModalOpen&&<div className="v-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)closeManageModal()}}>
      <div className="v-manage-modal" ref={manageDialogRef} role="dialog" aria-modal="true" aria-labelledby="v-manage-dialog-title">
        <div className="v-modal-header">
          <h2 id="v-manage-dialog-title">{manageId?t("edit")+" "+(manageType==="group"?t("groupName"):t("subject")):manageType==="group"?t("addGroup"):t("addSubject")}</h2>
          <IconButton label={t("cancel")} onClick={closeManageModal}><X size={21}/></IconButton>
        </div>
        <form className="v-form v-manage-modal-form" onSubmit={saveManagement}>
          <label>{manageType==="group"?t("groupName"):t("title")} *<input ref={manageInputRef} required maxLength={120} value={manageTitle} onChange={e=>onManageTitleChange(e.target.value)}/></label>
          {manageType==="subject"&&<>
            <label>{t("emoji")} *<input required maxLength={20} value={manageEmoji} onChange={e=>{setManageEmojiManual(true);setManageEmoji(e.target.value)}}/></label>
            <label>{t("groups")} *<select required value={manageGroup} onChange={e=>onManageGroupChange(e.target.value)}>
              {groups.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}
            </select></label>
          </>}
          {error&&<p className="v-error" role="alert">{error}</p>}
          <div className="v-modal-actions">
            <button type="button" className="v-outline" disabled={working} onClick={closeManageModal}>{t("cancel")}</button>
            <button type="submit" className="v-primary" disabled={working||(manageType==="subject"&&!manageGroup)}>{t("save")}</button>
          </div>
          {manageId&&<button type="button" className="v-danger" disabled={working} onClick={removeManagement}><Trash2 size={16}/>{t("delete")}</button>}
        </form>
      </div>
    </div>}
   </>}
   {incomingSharedId&&<div className="v-import-backdrop">
      <section className="v-import-modal" role="dialog" aria-modal="true" aria-labelledby="v-import-heading">
       <div className="v-modal-header">
        <h2 id="v-import-heading">{t("importHeading")}</h2>
        <button type="button" className="v-icon-button" aria-label={t("cancel")} onClick={dismissSharedImport} disabled={importBusy}><X size={22}/></button>
       </div>
       {sharedLoading&&<p role="status">{t("importLoading")}</p>}
       {sharedError&&<p role="alert" className="v-error">{sharedError}</p>}
       {!sharedLoading&&sharedPreview&&<form className="v-form" onSubmit={submitSharedImport}>
        <p className="v-share-intro">{t("importDetails")}</p>
        <div className="v-import-source"><strong>{sharedPreview.title}</strong><span>{sharedPreview.cards.length} {t("importCards")}</span></div>
        <label>{t("importSubject")} *
         <select required value={importSubject} onChange={e=>setImportSubject(e.target.value)}>
          <option value="" disabled>{t("chooseSubject")}</option>
          {groups.map(g=><optgroup key={g.id} label={g.title}>
           {data.subjects.filter(sub=>sub.group_id===g.id).map(sub=><option key={sub.id} value={sub.id}>{sub.emoji} {sub.title}</option>)}
          </optgroup>)}
         </select>
        </label>
        <label>{t("importTitle")} *<input required maxLength={200} value={importTitle} onChange={e=>setImportTitle(e.target.value)}/></label>
        <label>{t("importTags")}<input value={importTagsText} onChange={e=>setImportTagsText(e.target.value)}/></label>
        <p className="v-import-reset">{t("importReset")}</p>
        <button type="submit" className="v-primary" disabled={importBusy||!importSubject||!importTitle.trim()}>{importBusy?t("importLoading"):t("importNow")}</button>
       </form>}
       <button type="button" className="v-outline v-import-cancel" disabled={importBusy} onClick={dismissSharedImport}>{t("cancel")}</button>
      </section>
     </div>}
     {shareFallbackUrl&&<div className="v-import-backdrop">
      <section className="v-import-modal v-share-fallback" role="dialog" aria-modal="true" aria-label={t("share")}>
       <h2>{t("shareFallback")}</h2>
       <input aria-label={t("shareFallback")} readOnly value={shareFallbackUrl} onFocus={e=>e.currentTarget.select()}/>
       <button className="v-primary" type="button" onClick={()=>{void navigator.clipboard?.writeText(shareFallbackUrl).then(()=>{setShareStatus(t("shareCopied"));setShareFallbackUrl(null)}).catch(()=>{})}}>{t("shareCopy")}</button>
       <button className="v-outline" type="button" onClick={()=>setShareFallbackUrl(null)}>{t("cancel")}</button>
      </section>
     </div>}
  </div>
  {screen!=="learn"&&<nav className="v-bottom-nav" aria-label={t("navigation")}>
   <button className="active" type="button" onClick={()=>setScreen("home")}><Home size={21} fill="currentColor"/><span>Voka</span></button>
   <button type="button" onClick={()=>{}}><Search size={21}/><span>{t("search")}</span></button>
   <button type="button" onClick={()=>{}}><BarChart3 size={21}/><span>{t("statistics")}</span></button>
   <button type="button" onClick={()=>{}}><Settings size={21}/><span>{t("settings")}</span></button>
  </nav>}
 </div>;
}
