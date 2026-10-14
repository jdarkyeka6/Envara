// Envara outgoing email: verified Supabase identity, explicit allowlist,
// rate-limiting, user-owned sent-mail records, Resend idempotency.
// Deploy only after setting the required server-side secrets.
import { createClient } from 'npm:@supabase/supabase-js@2.95.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}
const reply = (status: number, value: unknown) =>
  new Response(JSON.stringify(value), {status,headers:cors})
const emailPattern = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors})
  if (req.method !== 'POST') return reply(405,{error:'Method not allowed'})
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('ENVARA_FROM_ADDRESS')
  const allowed = (Deno.env.get('ENVARA_ALLOWED_EMAILS') || '')
    .split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
  const sbUrl = Deno.env.get('SUPABASE_URL')
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!apiKey || !from || !allowed.length || !sbUrl || !publicKey || !serviceKey)
    return reply(503,{error:'Sender has not been configured by the app owner.'})

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return reply(401,{error:'Sign in first.'})
  const token = authHeader.slice(7)
  const userClient = createClient(sbUrl, publicKey, {
    global:{headers:{Authorization:authHeader}},auth:{persistSession:false}
  })
  const {data:{user},error:authError} = await userClient.auth.getUser(token)
  if(authError || !user?.email || !user.email_confirmed_at)
    return reply(401,{error:'An email-confirmed account is required.'})
  if(!allowed.includes(user.email.toLowerCase()))
    return reply(403,{error:'This account is not approved for outgoing email.'})

  let payload: Record<string, unknown>
  try { payload=await req.json() } catch { return reply(400,{error:'Invalid JSON'}) }
  const to=String(payload.to || '')
  const subject=String(payload.subject || '')
  const body=String(payload.body || '')
  const recipients=to.split(',').map(x=>x.trim()).filter(Boolean)
  if(recipients.length<1 || recipients.length>5 ||
     recipients.some(x=>x.length>254 || !emailPattern.test(x)) ||
     subject.length>200 || !body.trim() || body.length>30000)
    return reply(400,{error:'Invalid email recipients, subject, or body.'})

  const requestId=String(payload.requestId || '')
  if(!uuidPattern.test(requestId)) return reply(400,{error:'A valid request ID is required.'})

  const admin=createClient(sbUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:existing}=await admin.from('mail_send_log')
    .select('provider_message_id').eq('user_id',user.id).eq('request_id',requestId).maybeSingle()
  if(existing?.provider_message_id)
    return reply(200,{success:true,id:existing.provider_message_id,duplicate:true})

  // This is a basic quota, not a distributed atomic rate limiter. Keep the
  // allowlist enabled, and use provider-side limits in a larger deployment.
  const sinceHour=new Date(Date.now()-3600000).toISOString()
  const sinceDay=new Date(Date.now()-86400000).toISOString()
  const [{count:hourCount,error:hourError},{count:dayCount,error:dayError}]=await Promise.all([
    admin.from('mail_send_log').select('id',{count:'exact',head:true})
      .eq('user_id',user.id).gte('created_at',sinceHour),
    admin.from('mail_send_log').select('id',{count:'exact',head:true})
      .eq('user_id',user.id).gte('created_at',sinceDay)
  ])
  if(hourError || dayError) return reply(503,{error:'Sending quota could not be checked.'})
  if((hourCount||0)>=10 || (dayCount||0)>=40)
    return reply(429,{error:'Sending quota reached. Try again later.'})

  // Each account may send as a mailbox explicitly assigned by the owner.
  // Otherwise, use one owner-verified shared sender. Never trust a browser
  // supplied From or Reply-To header.
  const {data:mailbox}=await admin.from('mailboxes').select('address')
    .eq('user_id',user.id).order('created_at').limit(1).maybeSingle()
  const sender=mailbox?.address || from
  const provider=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      Authorization:'Bearer '+apiKey,
      'Content-Type':'application/json',
      'Idempotency-Key':'envara-'+user.id+'-'+requestId
    },
    body:JSON.stringify({
      from:sender,to:recipients,subject:subject||'(no subject)',
      text:body,reply_to:mailbox?.address || user.email
    })
  }).catch(()=>null)
  if(!provider) return reply(502,{error:'Could not reach the email provider.'})
  const result=await provider.json().catch(()=>({}))
  if(!provider.ok || !result.id)
    return reply(502,{error:'Email provider rejected this message. Check your sender domain and account limits.'})

  // Delivery was accepted. Never return an error that invites a second send.
  // Resend also deduplicates repeated provider calls using the request ID.
  const sent={
    user_id:user.id,folder:'sent',from_addr:sender,to_addr:recipients.join(', '),
    subject,body,is_read:true,is_starred:false,
    provider_message_id:result.id,request_id:requestId
  }
  const [logResult,messageResult]=await Promise.all([
    admin.from('mail_send_log').upsert({user_id:user.id,request_id:requestId,
      provider_message_id:result.id},{onConflict:'user_id,request_id'}),
    admin.from('messages').upsert(sent,{onConflict:'user_id,request_id'})
  ])
  return reply(200,{
    success:true,id:result.id,
    warning:logResult.error || messageResult.error
      ? 'Accepted by provider, but storing the send record needs attention.' : undefined
  })
})
