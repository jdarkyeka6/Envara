// Pure mail helpers: no DOM or backend dependencies.
export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]))

export function normalizeMail(row) {
  return {
    id: String(row.id), user_id: row.user_id || null,
    folder: row.folder || 'inbox',
    from_addr: row.from_addr || '',
    to_addr: row.to_addr || '',
    subject: row.subject || '',
    body: row.body || '',
    is_read: Boolean(row.is_read),
    is_starred: Boolean(row.is_starred),
    created_at: row.created_at || new Date().toISOString()
  }
}
export function mailboxCounts(messages) {
  const count = key => messages.filter(m => m.folder === key).length
  return {
    inbox: messages.filter(m => m.folder === 'inbox' && !m.is_read).length,
    drafts: count('drafts'), sent: count('sent'), archive: count('archive'),
    spam: count('spam'), trash: count('trash'),
    starred: messages.filter(m => m.is_starred && !['trash', 'spam'].includes(m.folder)).length,
    all: messages.filter(m => !['trash', 'spam', 'drafts'].includes(m.folder)).length
  }
}
export function visibleMessages(messages, folder = 'inbox', search = '', filter = 'all') {
  const needle = search.toLocaleLowerCase().trim()
  return messages.filter(m => {
    const inFolder = folder === 'starred'
      ? m.is_starred && m.folder !== 'trash' && m.folder !== 'spam'
      : folder === 'all'
        ? !['trash', 'spam', 'drafts'].includes(m.folder)
        : m.folder === folder
    if (!inFolder || (filter === 'unread' && m.is_read) || (filter === 'starred' && !m.is_starred)) return false
    return !needle || [m.subject, m.body, m.from_addr, m.to_addr]
      .some(s => String(s || '').toLocaleLowerCase().includes(needle))
  }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
}
export function contactName(address = '') {
  const match = String(address).match(/^\s*(.*?)\s*<([^<>]+)>\s*$/)
  return match ? (match[1].replace(/^["']|["']$/g, '') || match[2]) : String(address)
}
export function addressOnly(address = '') {
  const match = String(address).match(/<([^<>]+)>/)
  return (match ? match[1] : address).trim()
}
export function initials(value = '') {
  const chunks = contactName(value).split(/[\s@._-]+/).filter(Boolean)
  return ((chunks[0]?.[0] || '?') + (chunks.length > 1 ? chunks[1][0] : '')).toUpperCase()
}
export function avatarColor(value = '') {
  let hash = 0
  for (const char of String(value)) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return 'hsl(' + (Math.abs(hash) % 360) + ' 49% 47%)'
}
export function displayDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}
export function replySubject(subject = '') {
  return /^re:/i.test(subject) ? subject : 'Re: ' + subject
}
export function forwardSubject(subject = '') {
  return /^fwd:/i.test(subject) ? subject : 'Fwd: ' + subject
}
export function validateOutgoing({ to, subject, body }) {
  const recipients = String(to || '').split(',').map(x => x.trim()).filter(Boolean)
  if (!recipients.length) return 'Enter a recipient email address.'
  if (recipients.length > 5) return 'Send to at most five recipients at a time.'
  const email = /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/
  if (recipients.some(x => !email.test(x) || x.length > 254)) return 'One or more email addresses are invalid.'
  if (String(subject || '').length > 200) return 'Subject must be 200 characters or fewer.'
  if (String(body || '').length > 30000) return 'Message must be 30,000 characters or fewer.'
  if (!String(body || '').trim()) return 'Write a message first.'
  return null
}
export function demoMessages() {
  const ago = n => new Date(Date.now() - n * 60_000).toISOString()
  const data = [
    ['inbox','Avery Morgan <avery@northstar.example>','you@envara.demo','The next chapter starts here','Hey!\n\nI finished looking over the mockups, and the direction feels really strong. The typography, spacing and the little details make the whole experience feel considered.\n\nLet me know when you want to review the final screens together.\n\nAvery',8,false,true],
    ['inbox','The Studio <hello@studio.example>','you@envara.demo','Your weekly creative briefing','Good morning!\n\nThis week: a few ideas worth stealing (with permission), the joy of intentional whitespace and three tiny habits that make every project better.\n\nHave a lovely week,\nThe Studio',35,false,false],
    ['inbox','Noah Park <noah@paperplane.example>','you@envara.demo','Re: Friday catch-up','Friday works for me!\n\nHow does 3:30 sound? I can bring the notes and we can go through everything over coffee.\n\nSee you there,\nNoah',180,true,true],
    ['inbox','Product Notes <notes@product.example>','you@envara.demo','A small idea, a big difference','Great products are rarely one big feature. They are hundreds of small decisions that all point in the same direction.\n\nKeep building.\n\nThe Product Notes team',1440,true,false],
    ['inbox','Mia Chen <mia@atelier.example>','you@envara.demo','Photos from the weekend','Hey!\n\nSending you a reminder about the photos from the weekend. The evening light turned out beautifully.\n\nMia',2910,true,false],
    ['sent','You <you@envara.demo>','Noah Park <noah@paperplane.example>','Friday catch-up','Hey Noah,\n\nWould love to catch up this Friday. Let me know when works.\n\nCheers!',3100,true,false],
    ['drafts','You <you@envara.demo>','avery@northstar.example','Ideas for the launch','Hi Avery,\n\nA few things I wanted to run by you...',4400,true,false],
    ['archive','Newsletter <news@minimal.example>','you@envara.demo','An older favourite','Some great ideas deserve to be saved for later.\n\nThanks for reading!',16000,true,false],
    ['spam','Suspicious Offer <offer@junk.example>','you@envara.demo','You have won a mysterious prize','This is an example spam message in demo data. Never trust unexpected prize emails.',25000,false,false]
  ]
  return data.map(([folder,from_addr,to_addr,subject,body,minutes,is_read,is_starred],i) =>
    normalizeMail({id:'demo-' + (i + 1),folder,from_addr,to_addr,subject,body,
      created_at:ago(minutes),is_read,is_starred}))
}
