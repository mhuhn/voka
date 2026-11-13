export type MedalKind="wood"|"bronze"|"silver"|"gold";
export function medalsFor(n:number):{kind:MedalKind;count:number}{
 if(n>=15)return {kind:"gold",count:Math.floor(n/14)};
 return {kind:n>=8?"silver":n>=3?"bronze":"wood",count:1};
}
export function daysMissed(previous:string,today:string):number {
 const day=(date:string)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return NaN;
  const [year,month,dateOfMonth]=date.split("-").map(Number);
  return Date.UTC(year,month-1,dateOfMonth)/86400000;
 };
 if(!previous)return 0;
 const gap=day(today)-day(previous);
 return Number.isFinite(gap)?Math.max(0,gap-1):0;
}
export function decayPoints(n:number,missed:number){
 const lost=Math.min(Math.max(0,n),Math.max(0,missed)*2);
 return {n:Math.max(0,n-lost),lost};
}
