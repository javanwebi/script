/** Private FORZA synthesis gate. Pure metadata: never stores speech or WAVs.
 * Two bounds are mandatory: a per-network safety ceiling and a smaller
 * per-call-turn ceiling. A client-provided turn ID never bypasses the IP cap.
 */
export class ForzaTtsBudget {
  private readonly address=new Map<string,{count:number;until:number}>();
  private readonly turn=new Map<string,{count:number;until:number}>();
  constructor(
    private readonly maxPerAddress=60,
    private readonly maxPerTurn=12,
    private readonly windowMs=60_000,
  ) {}
  consume(address:string,turnId:string,now=Date.now()):
    {ok:true}|{ok:false;reason:'address'|'turn';retryAfterSeconds:number}{
    const key=address.slice(0,100)||'unknown';
    const turnKey=key+':'+turnId.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,48);
    const get=(map:Map<string,{count:number;until:number}>,k:string)=>{
      const current=map.get(k);
      if(current&&now<current.until)return current;
      const reset={count:0,until:now+this.windowMs};
      map.set(k,reset);return reset;
    };
    const ip=get(this.address,key);
    const turn=get(this.turn,turnKey);
    const response=(which:'address'|'turn',until:number)=>({
      ok:false as const,reason:which,
      retryAfterSeconds:Math.max(1,Math.ceil((until-now)/1000))
    });
    // Do not count a rejected turn against the address pool or vice versa.
    if(ip.count>=this.maxPerAddress)return response('address',ip.until);
    if(turn.count>=this.maxPerTurn)return response('turn',turn.until);
    ip.count++;turn.count++;
    // Periodic bounded maps: no transcript, token or audio is retained.
    if(this.address.size>5000||this.turn.size>15000){
      for(const [k,v] of this.address)if(v.until<=now)this.address.delete(k);
      for(const [k,v] of this.turn)if(v.until<=now)this.turn.delete(k);
    }
    return {ok:true};
  }
}
