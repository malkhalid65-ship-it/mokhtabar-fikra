function env(){
  return {
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  };
}
async function redis(cmd){
  const {url,token}=env();
  if(!url||!token) throw new Error("storage_not_configured");
  const r=await fetch(url,{method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(cmd)});
  if(!r.ok) throw new Error("storage_failed");
  return (await r.json()).result;
}
const bookingPrefix="mokhtabar:booking:";
const countKey=(date,time)=>`mokhtabar:groupcount:${date}:${time}`;
const individualKey=(date,time)=>`${bookingPrefix}individual:${date}:${time}`;
const groupKey=(date,time,id)=>`${bookingPrefix}group:${date}:${time}:${id}`;

async function listBookingKeys(){return await redis(["KEYS",`${bookingPrefix}*`])||[]}
async function readBookings(){
  const keys=await listBookingKeys(),rows=[];
  for(const k of keys){const v=await redis(["GET",k]); if(v){try{rows.push(JSON.parse(v))}catch{}}}
  rows.sort((a,b)=>(a.date+a.time+a.created_at).localeCompare(b.date+b.time+b.created_at));
  return rows;
}
module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  try{
    if(req.method==="GET"){
      const admin=req.headers["x-admin-key"];
      const rows=await readBookings();
      if(process.env.ADMIN_SCHEDULE_KEY && admin===process.env.ADMIN_SCHEDULE_KEY)
        return res.status(200).json({ok:true,bookings:rows});
      const occ=[];
      for(const b of rows){
        if(b.status!=="confirmed") continue;
        if(b.type==="individual") occ.push({type:b.type,date:b.date,time:b.time});
      }
      const groupSlots=[...new Set(rows.filter(b=>b.type==="group"&&b.status==="confirmed").map(b=>`${b.date}|${b.time}`))];
      for(const s of groupSlots){
        const [date,time]=s.split('|');
        const n=Number(await redis(["GET",countKey(date,time)])||0);
        if(n>=5) occ.push({type:"group",date,time});
      }
      return res.status(200).json({ok:true,occupied:occ});
    }
    if(req.method==="POST"){
      const {type,date,time,name,phone,email,total,result,notes}=req.body||{};
      if(!["individual","group"].includes(type)||!date||!time||!name||!phone) return res.status(400).json({ok:false,error:"missing_fields"});
      const created_at=new Date().toISOString();
      if(type==="individual"){
        const id=individualKey(date,time);
        const booking={id,type,date,time,name,phone,email:email||"",total:total||"",result:result||"",notes:notes||"",status:"confirmed",created_at};
        const set=await redis(["SET",id,JSON.stringify(booking),"NX"]);
        if(set!=="OK") return res.status(409).json({ok:false,error:"slot_taken"});
        return res.status(200).json({ok:true,booking,remaining:0});
      }
      const n=Number(await redis(["INCR",countKey(date,time)]));
      if(n>5){await redis(["DECR",countKey(date,time)]);return res.status(409).json({ok:false,error:"group_full"})}
      const uid=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`);
      const id=groupKey(date,time,uid);
      const booking={id,type,date,time,name,phone,email:email||"",total:total||"",result:result||"",notes:notes||"",status:"confirmed",created_at};
      try{await redis(["SET",id,JSON.stringify(booking)]);}catch(e){await redis(["DECR",countKey(date,time)]);throw e}
      return res.status(200).json({ok:true,booking,remaining:5-n});
    }
    if(req.method==="DELETE"){
      const admin=req.headers["x-admin-key"];
      if(!process.env.ADMIN_SCHEDULE_KEY||admin!==process.env.ADMIN_SCHEDULE_KEY) return res.status(401).json({ok:false,error:"unauthorized"});
      const {id}=req.body||{};
      if(!id||!String(id).startsWith(bookingPrefix)) return res.status(400).json({ok:false,error:"missing_id"});
      const raw=await redis(["GET",id]);
      if(raw){try{const b=JSON.parse(raw);if(b.type==="group"){const ck=countKey(b.date,b.time);const cur=Number(await redis(["GET",ck])||0);if(cur>0)await redis(["DECR",ck]);}}catch{}}
      await redis(["DEL",id]);
      return res.status(200).json({ok:true});
    }
    return res.status(405).json({ok:false});
  }catch(e){
    if(String(e.message).includes("storage_not_configured")) return res.status(503).json({ok:false,error:"storage_not_configured"});
    return res.status(500).json({ok:false,error:"server_error"});
  }
};
