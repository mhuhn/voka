import type { VokaCard } from "./data";

export const CARD_CSV_COLUMNS = [
  "id","question","answer","marked","position","success_count","reverse_position","reverse_success_count"
] as const;
export type CsvCard = Pick<VokaCard,typeof CARD_CSV_COLUMNS[number]>;
const ID_PATTERN=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const textFields=["id","question","answer","marked","position","success_count","reverse_position","reverse_success_count"] as const;
const escapeCell=(value:unknown):string=>{
  const text=String(value??"");
  return '"'+text.replace(/"/g,'""')+'"';
};
/** RFC 4180-style comma-separated export, including all cards (not filtered by UI). */
export function exportCardsCsv(cards:VokaCard[]):string{
  return "\ufeff"+[
    CARD_CSV_COLUMNS.join(","),
    ...cards.map(c=>CARD_CSV_COLUMNS.map(k=>escapeCell(c[k])).join(","))
  ].join("\r\n")+"\r\n";
}
/** Parse quoted fields, embedded commas/line breaks, and escaped double quotes. */
function parseRows(csv:string):string[][]{
  const rows:string[][]=[];
  let row:string[]=[],value="",quoted=false,closed=false;
  for(let i=0;i<csv.length;i++){
    const char=csv[i];
    if(quoted){
      if(char==='"'&&csv[i+1]==='"'){value+='"';i++;}
      else if(char==='"'){quoted=false;closed=true;}
      else value+=char;
    }else if(char==='"'){
      if(value!==""||closed)throw new Error("Unexpected quote in CSV");
      quoted=true;
    }else if(char===','){
      row.push(value);value="";closed=false;
    }else if(char==='\n'||char==='\r'){
      if(char==='\r'&&csv[i+1]==='\n')i++;
      row.push(value);rows.push(row);row=[];value="";closed=false;
    }else{
      if(closed)throw new Error("Unexpected data after closing quote");
      value+=char;
    }
  }
  if(quoted)throw new Error("Unclosed quoted CSV field");
  if(row.length||value!==""||closed)rows.push([...row,value]);
  return rows;
}
function parseNumber(value:string,field:string,min:number,max:number,line:number):number{
  if(!/^(0|[1-9][0-9]*)$/.test(value))throw new Error(`Line ${line}: invalid ${field}`);
  const n=Number(value);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`Line ${line}: ${field} must be between ${min} and ${max}`);
  return n;
}
export function parseCardsCsv(csv:string):CsvCard[]{
  const rows=parseRows(csv.replace(/^\ufeff/,""));
  if(!rows.length)throw new Error("CSV is empty");
  const header=rows.shift()!.map(h=>h.trim());
  if(header.length!==textFields.length||new Set(header).size!==textFields.length||
      textFields.some(c=>!header.includes(c)))throw new Error("CSV columns do not match the Voka card format");
  if(rows.length>5000)throw new Error("CSV exceeds the 5000-card import limit");
  const ids=new Set<string>();
  return rows.map((row,i)=>{
    const line=i+2;
    if(row.length!==header.length)throw new Error(`Line ${line}: wrong number of columns`);
    const values=Object.fromEntries(header.map((h,j)=>[h,row[j]]));
    const id=values.id.trim().toLowerCase();
    if(id&&!ID_PATTERN.test(id))throw new Error(`Line ${line}: invalid ID`);
    if(id&&ids.has(id))throw new Error(`Line ${line}: repeated card ID`);
    if(id)ids.add(id);
    if(!values.question.trim()||!values.answer.trim()||values.question.trim().length>20000||values.answer.trim().length>20000)throw new Error(`Line ${line}: question and answer required (max 20000 characters)`);
    if(values.marked!=="true"&&values.marked!=="false")throw new Error(`Line ${line}: marked must be true or false`);
    return {
      id,question:values.question,answer:values.answer,marked:values.marked==="true",
      position:parseNumber(values.position,"position",0,20,line),
      success_count:parseNumber(values.success_count,"success_count",0,4,line),
      reverse_position:parseNumber(values.reverse_position,"reverse_position",0,24,line),
      reverse_success_count:parseNumber(values.reverse_success_count,"reverse_success_count",0,4,line)
    };
  });
}
