// Envara inbound email webhook. Public endpoint by design; rejects any
// payload that fails Svix/Resend signature verification.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const answer = (status: number, data: unknown) =>
  new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function validSignature(body: string, req: Request, secret: string): Promise<boolean> {
  const id=req.headers.get('svix-id')
  const timestamp=req.headers.get('svix-timestamp')
  const signatures=req.headers.get('svix-signature')
  if(!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false
  if(Math.abs(Date.now()/1000-Number(timestamp))>300) return false
  try {
    const keyBytes=Uint8Array.from(atob(secret.replace(/^whsec_/,'')),c=>c.charCodeAt(0))
    const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign'])
    const signed=new TextEncoder().encode(id+'.'+timestamp+'.'+body)
    const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,signed))
    const actual=Uint8Array.from(atob(btoa(String.fromCharCode(...signature))),c=>c.charCodeAt(0))
    // Compare bytes rather than relying on string equality.
    for(const candidate of signatures.split(' ')){
      const [version,encoded]=candidate.split(',')
      if(version!=='v1'||!encoded) continue
      const expected=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0))
      let mismatch=expected.length ^ actual.length
      for(let i=0;i<Math.max(actual.length,expected.length);i++)
        mismatch|=(actual[i]||0)^(expected[i]||0)
      if(mismatch===0) return true
    }
  }catch{ return false }
  return false
}
Deno.serve(async(req: Request)=>{
  if(req.method!=='POST') return answer(405,{error:'Method not allowed'})
  const secret=Deno.env.get('RESEND_WEBHOOK_SECRET')
  const resendKey=Deno.env.get('RESEND_API_KEY')
  const url=Deno.env.get('SUPABASE_URL')
  const adminKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if(!secret || !resendKey || !url || !adminKey)
    return answer(503,{error:'Receiver not configured'})
  const raw=await req.text()
  if(raw.length>100000) return answer(413,{error:'Payload too large'})
  if(!await validSignature(raw,req,secret))
    return answer(401,{error:'Invalid signature'})

  let event: any
  try{event=JSON.parse(raw)}catch{return answer(400,{error:'Invalid JSON'})}
  if(event.type!=='email.received') return answer(200,{ok:true,ignored:true})
  const emailId=event.data?.email_id
  if(typeof emailId!=='string'||!uuid.test(emailId))
    return answer(400,{error:'Missing received email ID'})
  const response=await fetch('https://api.resend.com/emails/receiving/'+emailId,{
    headers:{Authorization:'Bearer '+resendKey}
  }).catch(()=>null)
  if(!response?.ok) return answer(502,{error:'Could not retrieve incoming email'})
  const mail=await response.json()
  const recipients=Array.isArray(mail.to)?mail.to:[mail.to].filter(Boolean)
  const admin=createClient(url,adminKey,{auth:{persistSession:false,autoRefreshToken:false}})
  let stored=0
  for(const recipient of new Set(recipients.map((a:unknown)=>String(a).trim().toLowerCase()))){
    const {data:mailbox,error:lookupError}=await admin.from('mailboxes')
      .select('user_id').eq('address',recipient).maybeSingle()
    if(lookupError) return answer(500,{error:'Mailbox lookup failed'})
    if(!mailbox) continue
    const {error}=await admin.from('messages').insert({
      user_id:mailbox.user_id,folder:'inbox',is_read:false,is_starred:false,
      from_addr:String(mail.from||event.data.from||'Unknown sender').slice(0,350),
      to_addr:recipient,subject:String(mail.subject||'(no subject)').slice(0,200),
      // HTML is never rendered. Text only, preventing email HTML script injection.
      body:typeof mail.text==='string' ? mail.text.slice(0,30000) : '[HTML-only email: no plain text available.]',
      created_at:mail.created_at||event.data.created_at||new Date().toISOString(),
      provider_message_id:emailId
    })
    if(error && error.code!=='23505') return answer(500,{error:'Inbox storage failed'})
    if(!error) stored++
  }
  return answer(200,{ok:true,stored})
})
