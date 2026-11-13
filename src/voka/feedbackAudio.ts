/** Quiet, synthesized confirmation cues; no audio file or network dependency.
 * Web Audio is unlocked during the user's click/key press, then played only
 * once the server confirms the corresponding grade.
 */
export type LearningSound = "known"|"unknown"|"unsure"|"complete";
export type Note = {frequency:number;duration:number;offset:number;gain:number};
export const feedbackNotes:Record<LearningSound,readonly Note[]>={
  known:[
    {frequency:523.25,duration:0.13,offset:0,gain:0.023},
    {frequency:659.25,duration:0.17,offset:0.09,gain:0.018}
  ],
  unknown:[
    {frequency:329.63,duration:0.15,offset:0,gain:0.016},
    {frequency:261.63,duration:0.18,offset:0.12,gain:0.014}
  ],
  unsure:[
    {frequency:392,duration:0.15,offset:0,gain:0.013}
  ],
  complete:[
    {frequency:523.25,duration:0.15,offset:0,gain:0.018},
    {frequency:659.25,duration:0.15,offset:0.12,gain:0.019},
    {frequency:783.99,duration:0.25,offset:0.24,gain:0.021}
  ]
};

let audioContext:AudioContext|null=null;
export function unlockLearningAudio():void{
  if(typeof window==="undefined")return;
  try{
    const Audio=window.AudioContext;
    if(!Audio)return;
    if(!audioContext||audioContext.state==="closed")audioContext=new Audio();
    if(audioContext.state==="suspended")void audioContext.resume().catch(()=>{});
  }catch{
    // Audio may be disabled by the OS, browser, or accessibility settings.
  }
}

export function playLearningSound(kind:LearningSound):void{
  try{
    if(!audioContext||audioContext.state!=="running")return;
    const ctx=audioContext;
    const begin=ctx.currentTime+0.008;
    for(const note of feedbackNotes[kind]){
      const oscillator=ctx.createOscillator();
      const volume=ctx.createGain();
      const start=begin+note.offset;
      const end=start+note.duration;
      oscillator.type="sine";
      oscillator.frequency.setValueAtTime(note.frequency,start);
      volume.gain.setValueAtTime(0.0001,start);
      volume.gain.exponentialRampToValueAtTime(note.gain,start+0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001,end);
      oscillator.connect(volume);
      volume.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(end+0.01);
      oscillator.onended=()=>{oscillator.disconnect();volume.disconnect();};
    }
  }catch{
    // Feedback is optional; grading must never fail because of audio.
  }
}
