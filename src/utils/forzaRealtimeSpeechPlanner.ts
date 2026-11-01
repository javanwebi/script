/**
 * Real-time voice planner for CPU Piper/VITS Nima.
 *
 * IMPORTANT: This streams complete WORD GROUPS, not individual model tokens.
 * Display remains token-synchronous. Nima needs several words to synthesize
 * natural Persian; a single all-answer WAV cannot start until the LLM finishes.
 *
 * A 56-character opening phrase gives the first audio a head start. Following
 * phrases are ~105 characters of *complete words*, held until at least
 * 128 characters are available so there is enough synthesized playback while
 * the next phrase is generated. There is no segmentation on punctuation.
 * All text is accounted for exactly once and no final two words are dropped.
 */
export class ForzaRealtimeSpeechPlanner {
  private seen='';
  private cursor=0;
  private finished=false;
  private opening=true;

  push(fullText:string):string[]{
    if(this.finished)throw new Error('forza_realtime_after_done');
    if(!fullText.startsWith(this.seen))
      throw new Error('forza_realtime_revised_text');
    this.seen=fullText;
    const ready:string[]=[];
    for(;;){
      const available=this.seen.slice(this.cursor);
      const need=this.opening?56:128;
      if(available.length<need)break;
      // First readable text must arrive quickly. Subsequent segments are
      // longer so playback gets ahead of the CPU synthesis queue.
      const desired=this.opening?52:105;
      const at=Math.max(
        available.lastIndexOf(' ',desired),
        available.lastIndexOf('\n',desired),
      );
      if(at<(this.opening?34:78))break; // wait for a real word boundary
      const phrase=available.slice(0,at+1).trim();
      this.cursor+=at+1;
      if(phrase)ready.push(phrase);
      this.opening=false;
    }
    return ready;
  }

  complete(finalText:string):string[]{
    const ready=this.push(finalText);
    const tail=this.seen.slice(this.cursor).trim();
    if(tail)ready.push(tail);
    this.cursor=this.seen.length;
    this.finished=true;
    return ready;
  }
}
