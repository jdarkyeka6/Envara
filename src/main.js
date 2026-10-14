import './style.css'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
const $ = (id) => document.getElementById(id)
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e }

let YOU = '', mails = [], cur = 'inbox', sel = null, editing = null
const folders = [['inbox', 'Inbox'], ['starred', 'Starred'], ['sent', 'Sent'], ['drafts', 'Drafts'], ['trash', 'Trash']]

const fromRow = (r) => ({ id: r.id, folder: r.folder, from: r.from_addr, to: r.to_addr, subject: r.subject, body: r.body, read: r.is_read, star: r.is_starred, at: new Date(r.created_at).getTime() })
const upd = async (m, patch) => { const { error } = await sb.from('messages').update(patch).eq('id', m.id); if (error) console.error(error) }
const nameOf = (a) => { const m = /^(.*?)\s*<.*>$/.exec(a); return m && m[1] ? m[1] : a }
const nameToAddr = (a) => { const m = /<(.*)>/.exec(a); return m ? m[1] : a }
const fmt = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) }
const closeReader = () => { sel = null; $('app').classList.remove('reading') }

function visible() {
  const q = $('q').value.trim().toLowerCase()
  return mails
    .filter((m) => (cur === 'starred' ? m.star && m.folder !== 'trash' : m.folder === cur))
    .filter((m) => !q || (m.subject + ' ' + m.from + ' ' + m.to + ' ' + m.body).toLowerCase().includes(q))
    .sort((a, b) => b.at - a.at)
}

function drawSide() {
  const side = $('side')
  side.querySelectorAll('.folder,.logout').forEach((n) => n.remove())
  $('addr').textContent = YOU
  folders.forEach(([key, label]) => {
    const b = el('button', 'folder' + (cur === key ? ' on' : ''))
    b.appendChild(el('span', '', label))
    const n = key === 'inbox' ? mails.filter((m) => m.folder === 'inbox' && !m.read).length : 0
    if (n) b.appendChild(el('span', 'count', String(n)))
    b.onclick = () => { cur = key; closeReader(); draw() }
    side.appendChild(b)
  })
  const out = el('button', 'folder logout', 'Log out')
  out.onclick = () => sb.auth.signOut()
  side.appendChild(out)
}

function drawList() {
  const rows = $('rows'); rows.textContent = ''
  const list = visible()
  if (!list.length) { rows.appendChild(el('div', 'empty', 'Nothing here yet')); return }
  list.forEach((m) => {
    const r = el('div', 'row' + (m.read ? '' : ' unread') + (sel === m.id ? ' on' : ''))
    r.setAttribute('role', 'button'); r.tabIndex = 0
    const s = el('button', 'star' + (m.star ? ' on' : ''), m.star ? '\u2605' : '\u2606')
    s.setAttribute('aria-label', m.star ? 'Unstar' : 'Star')
    s.onclick = (e) => { e.stopPropagation(); m.star = !m.star; upd(m, { is_starred: m.star }); draw() }
    r.appendChild(s)
    r.appendChild(el('div', 'from', m.folder === 'sent' || m.folder === 'drafts' ? 'To: ' + (m.to || '(no recipient)') : nameOf(m.from)))
    r.appendChild(el('div', 'date', fmt(m.at)))
    r.appendChild(el('div', 'subj', m.subject || '(no subject)'))
    r.appendChild(el('div', 'snip', m.body.replace(/\s+/g, ' ')))
    const open = () => { sel = m.id; if (!m.read) { m.read = true; upd(m, { is_read: true }) } $('app').classList.add('reading'); draw() }
    r.onclick = open
    r.onkeydown = (e) => { if (e.key === 'Enter') open() }
    rows.appendChild(r)
  })
}

function drawRead() {
  const p = $('read'); p.textContent = ''
  const m = mails.find((x) => x.id === sel)
  if (!m) { p.appendChild(el('div', 'empty', 'Select a message to read it')); return }
  const back = el('button', 'back', '\u2190 Back'); back.onclick = () => { closeReader(); draw() }
  p.appendChild(back)
  p.appendChild(el('h2', '', m.subject || '(no subject)'))
  p.appendChild(el('div', 'meta', 'From ' + m.from + '  \u00b7  To ' + (m.to || '(no recipient)') + '  \u00b7  ' + new Date(m.at).toLocaleString()))
  const t = el('div', 'tools')
  const add = (label, fn) => { const b = el('button', '', label); b.onclick = fn; t.appendChild(b) }
  if (m.folder === 'drafts') add('Edit draft', () => openCompose(m))
  else add('Reply', () => openCompose({ to: nameToAddr(m.from), subject: 'Re: ' + m.subject.replace(/^Re:\s*/, ''), body: '' }))
  add('Mark unread', () => { m.read = false; upd(m, { is_read: false }); closeReader(); draw() })
  if (m.folder === 'trash') {
    add('Restore', () => { m.folder = m.from === YOU ? 'sent' : 'inbox'; upd(m, { folder: m.folder }); closeReader(); draw() })
    add('Delete forever', async () => { await sb.from('messages').delete().eq('id', m.id); mails = mails.filter((x) => x !== m); closeReader(); draw() })
  } else add('Move to trash', () => { m.folder = 'trash'; upd(m, { folder: 'trash' }); closeReader(); draw() })
  p.appendChild(t)
  p.appendChild(el('div', 'body', m.body))
}

function draw() { drawSide(); drawList(); drawRead() }

function openCompose(m) {
  editing = m && m.folder === 'drafts' ? m : null
  $('to').value = m ? m.to || '' : ''; $('subject').value = m ? m.subject || '' : ''; $('text').value = m ? m.body || '' : ''
  $('modal').classList.add('open'); $('to').focus()
}
function closeCompose() { $('modal').classList.remove('open'); editing = null }

async function save(folder) {
  const fields = { folder, to_addr: $('to').value.trim(), subject: $('subject').value.trim(), body: $('text').value }
  if (editing) {
    const { data, error } = await sb.from('messages').update(fields).eq('id', editing.id).select().single()
    if (error) return console.error(error)
    Object.assign(editing, fromRow(data))
  } else {
    const { data, error } = await sb.from('messages').insert({ ...fields, from_addr: YOU, is_read: true }).select().single()
    if (error) return console.error(error)
    mails.push(fromRow(data))
  }
  cur = folder; closeReader(); closeCompose(); draw()
}

async function load() {
  const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: false })
  if (error) console.error(error)
  mails = (data || []).map(fromRow)
}

async function show(session) {
  $('login').hidden = !!session
  $('app').hidden = !session
  if (!session) { mails = []; return }
  YOU = session.user.email
  await load()
  draw()
}

$('compose').onclick = () => openCompose(null)
$('discard').onclick = closeCompose
$('draft').onclick = () => save('drafts')
$('send').onclick = () => { if (!$('to').value.trim()) { $('to').focus(); return } save('sent') }
$('q').oninput = draw
$('modal').onclick = (e) => { if (e.target === $('modal')) closeCompose() }
$('lf').onsubmit = async (e) => {
  e.preventDefault(); $('err').textContent = ''
  const { error } = await sb.auth.signInWithPassword({ email: $('em').value.trim(), password: $('pw').value })
  if (error) $('err').textContent = 'That email or password did not work.'
  else $('pw').value = ''
}
sb.auth.onAuthStateChange((_e, session) => { setTimeout(() => show(session), 0) })
