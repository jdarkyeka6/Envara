import './style.css'
import { createClient } from '@supabase/supabase-js'
import {
  escapeHtml as h, normalizeMail, mailboxCounts, visibleMessages, contactName,
  addressOnly, initials, avatarColor, displayDate, replySubject, forwardSubject,
  validateOutgoing, demoMessages
} from './mail.js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const demo = !(url && key)
const sendEnabled = !demo && import.meta.env.VITE_ENVARA_SEND_ENABLED === 'true'
const sb = demo ? null : createClient(url, key)
const demoKey = 'envara-mail-demo-v1'
const $ = id => document.getElementById(id)

const glyphs = {
  inbox: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 13h5l2 3h4l2-3h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
  star: '<path d="m12 2 3.1 6.4 7.1 1-5.1 5 .9 7.1-6-3.3-6 3.3.9-7.1-5.1-5 7.1-1z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  drafts: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L9 17l-4 1 1-4Z"/>',
  archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v12h14V8M10 12h4"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v6m4-6v6"/>',
  spam: '<path d="m12 2 10 18H2Z"/><path d="M12 9v4m0 3h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5L4 8M4 4v4h4M4 13a8 8 0 0 0 14 5l2-2m0 4v-4h-4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="M5 5l14 14M19 5 5 19"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  reply: '<path d="m9 10-5 5 5 5"/><path d="M4 15h10a6 6 0 0 0 0-12"/>',
  forward: '<path d="m15 10 5 5-5 5"/><path d="M20 15H10a6 6 0 0 1 0-12"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  doublecheck: '<path d="m2 12 5 5 10-10M12 17l4 4 6-7"/>',
  checkSquare: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 4 4 6-7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 15.5A9 9 0 0 1 8.5 4 9 9 0 1 0 20 15.5Z"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h.01M14 13h.01M18 13h.01M7 16h10"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3"/><path d="M12 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7"/>',
  sliders: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="17" r="2"/>',
  arrowup: '<path d="m7 14 5-5 5 5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 8h.01"/>',
  shield: '<path d="m12 2 9 4v6c0 5-3.6 8.5-9 10-5.4-1.5-9-5-9-10V6z"/><path d="m9 12 2 2 4-4"/>',
  sparkle: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>'
}
const icon = (name, size = 19) => '<svg aria-hidden="true" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' + (glyphs[name] || glyphs.mail) + '</svg>'
const sidebarFolders = [
  ['inbox', 'Inbox', 'inbox'], ['starred', 'Starred', 'star'],
  ['all', 'All mail', 'mail'], ['sent', 'Sent', 'send'],
  ['drafts', 'Drafts', 'drafts'], ['archive', 'Archive', 'archive'],
  ['spam', 'Spam', 'spam'], ['trash', 'Trash', 'trash']
]
const folderTitles = Object.fromEntries(sidebarFolders.map(([id,label]) => [id,label]))
let toastTimer
let state = {
  session: null, mailboxIdentity: '', folder: 'inbox', filter: 'all', query: '', selected: null,
  checked: new Set(), compose: null, showSettings: false, showHelp: false,
  sidebarOpen: false, mobilePane: 'list', error: '', loading: false,
  authMode: 'login', authError: '', busy: false,
  theme: localStorage.getItem('envara-theme') || 'system',
  density: localStorage.getItem('envara-density') || 'comfortable',
  messages: []
}
document.documentElement.dataset.theme = state.theme
document.documentElement.dataset.density = state.density

const loadDemo = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(demoKey) || 'null')
    if (Array.isArray(saved)) return saved.map(normalizeMail)
  } catch { /* malformed local storage: start a clean demo */ }
  return demoMessages()
}
const persistDemo = () => {
  if (demo) try { localStorage.setItem(demoKey, JSON.stringify(state.messages)) }
  catch { notify('Demo storage is full or unavailable.', 'error') }
}
const currentUser = () => state.session?.user
const mailboxAddress = () => state.mailboxIdentity || currentUser()?.email || 'you@envara.demo'
const composeAvailable = () => demo || sendEnabled

function notify(message, kind = 'info') {
  const node = $('toast')
  if (!node) return
  node.innerHTML = '<span>' + icon(kind === 'error' ? 'spam' : 'check', 17) + '</span><span>' + h(message) + '</span><button type="button" data-action="dismiss-toast" aria-label="Dismiss notification">' + icon('close', 16) + '</button>'
  node.className = 'toast show ' + (kind === 'error' ? 'danger' : '')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('show'), 5200)
}
function button(action, content, title = '', klass = 'icon-button', id = '') {
  return '<button type="button" class="' + klass + '" data-action="' + action + '"' +
    (id ? ' data-id="' + h(id) + '"' : '') +
    ' title="' + h(title) + '" aria-label="' + h(title || action) + '">' + content + '</button>'
}
function badge(label, className = '') {
  return '<span class="badge ' + className + '">' + h(label) + '</span>'
}
function avatar(address, size='') {
  return '<span class="avatar ' + size + '" style="background:' + avatarColor(address) + '">' + h(initials(address)) + '</span>'
}
function folderLink(id, label, symbol, counts) {
  const active = state.folder === id
  const count = id === 'inbox' ? counts.inbox : id === 'drafts' ? counts.drafts : 0
  return '<button class="nav-link ' + (active ? 'active' : '') + '" type="button" data-action="folder" data-id="' + id + '" aria-current="' + (active ? 'page' : 'false') + '">' +
    icon(symbol,19) + '<span>' + label + '</span>' + (count ? '<span class="nav-count">' + count + '</span>' : '') + '</button>'
}
function renderAuth() {
  const signup = state.authMode === 'signup'
  const reset = state.authMode === 'reset'
  const recovery = state.authMode === 'recovery'
  $('app').innerHTML = '<main class="auth-page"><div class="auth-glow glow-one"></div><div class="auth-glow glow-two"></div>' +
    '<div class="auth-brand"><span class="brand-mark">' + icon('mail',26) + '</span><span>envara<span class="brand-dot">.</span></span></div>' +
    '<section class="auth-card"><div class="eyebrow">YOUR MAIL, A LITTLE MORE HUMAN</div>' +
    '<h1>' + (recovery ? 'Choose a new password.' : reset ? 'Reset your password.' : signup ? 'Make yourself at home.' : 'Welcome back.') + '</h1>' +
    '<p>' + (recovery ? 'Enter a strong new password to protect your account.' : reset ? 'We will email you a recovery link.' : signup ? 'A calmer way to keep on top of things.' : 'Everything important, beautifully in one place.') + '</p>' +
    '<form id="auth-form" class="auth-form">' +
    (recovery ? '' : '<label for="auth-email">Email address</label><input required id="auth-email" type="email" autocomplete="username" placeholder="you@example.com">') +
    ((reset) ? '' : '<label for="auth-password">' + (recovery ? 'New password' : 'Password') + '</label><input required minlength="8" id="auth-password" type="password" autocomplete="' + (signup || recovery ? 'new-password' : 'current-password') + '" placeholder="Minimum eight characters">') +
    '<div class="auth-error" role="alert">' + h(state.authError) + '</div>' +
    '<button class="primary auth-submit" type="submit"' + (state.busy ? ' disabled' : '') + '>' +
    (state.busy ? 'Please wait…' : recovery ? 'Update password' : reset ? 'Send recovery link' : signup ? 'Create account' : 'Sign in') + ' ' + icon('right',17) + '</button></form>' +
    '<div class="auth-links">' +
    (recovery ? '' : signup || reset ? button('auth-login','Sign in instead','','text-button') : button('auth-signup','Create account','','text-button') + button('auth-reset','Forgot password?','','text-button')) +
    '</div></section><div class="auth-foot">Envara • Simple by design, private by default</div></main><div id="toast" class="toast" role="status"></div>'
}
function renderNav() {
  const counts = mailboxCounts(state.messages)
  const nav = sidebarFolders.map(([id,label,sym]) => folderLink(id,label,sym,counts)).join('')
  return '<aside class="sidebar ' + (state.sidebarOpen ? 'sidebar-open' : '') + '" aria-label="Mailbox navigation">' +
    '<div class="sidebar-head"><div class="brand"><span class="brand-mark">' + icon('mail',21) + '</span><span>envara<span class="brand-dot">.</span></span></div>' +
    button('close-menu',icon('close',20),'Close menu','icon-button mobile-only') + '</div>' +
    '<button type="button" class="compose-button" data-action="compose">' + icon('plus',20) + ' <span>Compose</span><span class="compose-hint">C</span></button>' +
    '<div class="sidebar-label">WORKSPACE</div><nav class="nav-items">' + nav + '</nav>' +
    '<div class="sidebar-bottom"><div class="storage-status"><span class="storage-icon">' + icon(demo ? 'sparkle' : 'shield',18) + '</span><div><strong>' + (demo ? 'Explore demo mode' : 'Your private workspace') + '</strong><small>' + (demo ? 'Your changes stay on this device' : 'Messages protected with account access') + '</small></div></div>' +
    button('settings',icon('settings',19) + '<span>Preferences</span>','Preferences','nav-link bottom-link') +
    (!demo ? button('logout',icon('logout',19) + '<span>Sign out</span>','Sign out','nav-link bottom-link') : '') +
    '</div></aside>'
}
function renderList() {
  const list = visibleMessages(state.messages, state.folder, state.query, state.filter)
  const selectedAll = list.length > 0 && list.every(m => state.checked.has(m.id))
  const c = mailboxCounts(state.messages)
  const rows = list.map(m => {
    const from = m.folder === 'sent' || m.folder === 'drafts' ? (m.to_addr || 'No recipient') : m.from_addr
    const label = contactName(from)
    return '<div class="mail-row ' + (!m.is_read ? 'unread ' : '') + (state.selected === m.id ? 'selected ' : '') +
      (state.checked.has(m.id) ? 'checked' : '') + '" data-action="open" data-id="' + h(m.id) + '" role="button" tabindex="0" aria-label="Open ' + h(m.subject || 'untitled message') + '">' +
      '<button type="button" class="check-button ' + (state.checked.has(m.id) ? 'is-checked' : '') + '" data-action="check" data-id="' + h(m.id) + '" aria-label="Select message">' + (state.checked.has(m.id) ? icon('check',16) : '') + '</button>' +
      avatar(from,'small') +
      '<div class="row-content"><div class="row-top"><span class="row-from">' + h(label) + '</span><span class="row-date">' + h(displayDate(m.created_at)) + '</span></div>' +
      '<div class="row-subject-line"><span class="row-subject">' + h(m.subject || '(no subject)') + '</span>' + (!m.is_read ? '<span class="unread-dot"></span>' : '') + '</div>' +
      '<div class="row-snippet">' + h(m.body.replace(/\s+/g,' ').slice(0,145)) + '</div></div>' +
      '<button type="button" class="row-star ' + (m.is_starred ? 'starred' : '') + '" data-action="star" data-id="' + h(m.id) + '" aria-label="' + (m.is_starred ? 'Remove star' : 'Star message') + '">' + icon('star',18) + '</button></div>'
  }).join('')
  const bulk = state.checked.size ? '<div class="bulk-actions">' +
    button('bulk-archive',icon('archive',17),'Archive selected') +
    button('bulk-read',icon('checkSquare',17),'Mark selected as read') +
    button('bulk-trash',icon('trash',17),'Move selected to trash') +
    button('clear-selection',icon('close',17),'Clear selection') + '</div>' : ''
  return '<section class="mail-list ' + (state.mobilePane === 'read' ? 'mobile-hide' : '') + '" aria-label="Message list">' +
    '<div class="list-heading"><div><span class="eyebrow">YOUR MAILBOX</span><h1>' + h(folderTitles[state.folder] || 'Inbox') +
    '</h1><p>' + (state.folder === 'inbox' ? c.inbox + ' unread message' + (c.inbox === 1 ? '' : 's') : list.length + ' message' + (list.length === 1 ? '' : 's')) +
    '</p></div><span class="list-decoration">' + icon(state.folder === 'starred' ? 'star' : 'mail',23) + '</span></div>' +
    '<div class="list-filters"><button data-action="select-all" type="button" class="select-all ' + (selectedAll ? 'is-checked' : '') + '" aria-label="Select all visible messages">' + (selectedAll ? icon('check',15) : '') + '</button>' +
    (bulk || '<div class="filter-pills">' + [['all','All'],['unread','Unread'],['starred','Starred']].map(([id,l]) =>
      '<button class="filter-pill ' + (state.filter === id ? 'active' : '') + '" data-action="filter" data-id="' + id + '">' + l + '</button>').join('') + '</div>') +
    '<span class="result-count">' + list.length + '</span></div>' +
    '<div class="mail-rows">' + (rows ||
      '<div class="empty-list"><div class="empty-art">' + icon(state.query ? 'search' : 'inbox',33) + '</div><h3>' +
      (state.query ? 'No matching messages' : 'All clear, all yours.') + '</h3><p>' +
      (state.query ? 'Try different search words or clear your filters.' : 'Nothing in this folder right now. Enjoy the quiet.') +
      '</p>' + (state.query ? '<button type="button" class="secondary" data-action="clear-search">Clear search</button>' : '') + '</div>') +
    '</div></section>'
}
function renderReader() {
  const m = state.messages.find(m => m.id === state.selected)
  if (!m) return '<section class="reader empty-reader"><div class="reader-welcome"><div class="welcome-graphic">' +
    '<span class="welcome-halo h1"></span><span class="welcome-halo h2"></span><span class="welcome-icon">' + icon('mail',48) + '</span></div>' +
    '<div class="eyebrow">A SPACE TO THINK</div><h2>A clearer inbox.<br>A calmer mind.</h2><p>Pick a conversation to read, or start something new.</p>' +
    '<button class="secondary" data-action="compose">' + icon('plus',17) + ' New message</button></div></section>'
  const other = m.folder === 'trash' ? 'restore' : 'trash'
  const from = m.folder === 'sent' || m.folder === 'drafts' ? m.to_addr : m.from_addr
  return '<section class="reader message-reader" aria-label="Message content">' +
    '<div class="reader-actions"><div class="reader-actions-start">' +
    button('back',icon('left',20),'Back to messages','icon-button back-mobile') +
    button('archive',icon('archive',19),'Archive message','icon-button',m.id) +
    button('toggle-unread',icon(m.is_read ? 'mail' : 'doublecheck',19),m.is_read ? 'Mark unread' : 'Mark read','icon-button',m.id) +
    button('star',icon('star',19),m.is_starred ? 'Unstar' : 'Star','icon-button '+(m.is_starred ? 'gold' : ''),m.id) +
    '</div><div class="reader-actions-end">' +
    button(other,icon(other === 'trash' ? 'trash' : 'refresh',19),other === 'trash' ? 'Move to trash' : 'Restore','icon-button',m.id) +
    (m.folder === 'trash' ? button('delete',icon('close',19),'Delete permanently','icon-button danger-hover',m.id) : '') +
    '</div></div><article class="email-article"><div class="article-header"><div class="article-context">' +
    badge(m.folder === 'inbox' ? 'Inbox' : folderTitles[m.folder] || m.folder) +
    (m.is_starred ? badge('★ Starred','tag-star') : '') + '</div><h2>' + h(m.subject || '(no subject)') + '</h2></div>' +
    '<div class="sender-line">' + avatar(from) + '<div class="sender-details"><strong>' + h(contactName(from)) + '</strong><span>' +
    h(addressOnly(from)) + '<span class="dot-separator">·</span> to ' + h(m.to_addr || mailboxAddress()) + '</span></div><time>' +
    h(new Date(m.created_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})) + '</time></div>' +
    '<div class="article-body">' + h(m.body) + '</div><div class="article-reply-actions">' +
    (m.folder === 'drafts' ? '<button class="primary" data-action="edit-draft" data-id="' + h(m.id) + '">' + icon('drafts',17) + ' Continue draft</button>' :
      '<button class="secondary" data-action="reply" data-id="' + h(m.id) + '">' + icon('reply',17) + ' Reply</button>' +
      '<button class="secondary" data-action="forward" data-id="' + h(m.id) + '">' + icon('forward',17) + ' Forward</button>') +
    '</div></article></section>'
}
function renderCompose() {
  if (!state.compose) return ''
  const m = state.compose
  return '<div class="modal-shade" data-action="close-compose"><section class="compose-window" role="dialog" aria-modal="true" aria-label="Compose message">' +
    '<div class="compose-header"><div><span class="eyebrow">MAKE A CONNECTION</span><h2>' + (m.editingId ? 'Edit draft' : 'New message') + '</h2></div>' +
    button('close-compose',icon('close',21),'Close compose window') + '</div>' +
    '<form id="compose-form"><div class="compose-field"><label for="compose-to">To</label><input id="compose-to" placeholder="someone@example.com" autocomplete="off" value="' + h(m.to || '') + '" required></div>' +
    '<div class="compose-field"><label for="compose-subject">Subject</label><input id="compose-subject" maxlength="200" placeholder="Add a subject" value="' + h(m.subject || '') + '"></div>' +
    '<textarea id="compose-body" aria-label="Message body" placeholder="Write something wonderful…"></textarea>' +
    '<div class="compose-foot"><span class="compose-note">' + icon('info',16) + ' ' +
      (demo ? 'Demo messages stay on this device' : sendEnabled ? 'Delivery via your configured email provider' : 'Sending not configured • Save a draft') +
    '</span><div class="compose-buttons"><button type="button" class="secondary" data-action="save-draft">Save draft</button>' +
    '<button type="submit" class="primary" ' + (state.busy ? 'disabled' : '') + '>' +
    icon('send',17) + ' ' + (state.busy ? 'Working…' : demo ? 'Simulate send' : sendEnabled ? 'Send email' : 'Save as draft') + '</button></div></div>' +
    '</form></section></div>'
}
function renderSettings() {
  if (!state.showSettings && !state.showHelp) return ''
  return '<div class="modal-shade settings-overlay" data-action="close-overlay"><section class="settings-window" role="dialog" aria-modal="true" aria-label="Settings">' +
    '<header class="settings-head"><div><span class="eyebrow">MAKE IT YOURS</span><h2>' + (state.showHelp ? 'Keyboard shortcuts' : 'Preferences') +
    '</h2></div>' + button('close-overlay',icon('close',21),'Close') + '</header>' +
    (state.showHelp ? '<div class="shortcut-grid">' +
      [['C','Compose'],['/','Search mail'],['J','Next message'],['K','Previous message'],['E','Archive open message'],['Esc','Close dialog'],['?','Show shortcuts']].map(([a,b]) =>
        '<div><kbd>' + a + '</kbd><span>' + b + '</span></div>').join('') + '</div>' :
      '<div class="settings-options"><h3>Appearance</h3><p>Choose the experience that feels right.</p>' +
      '<div class="setting-row"><div><strong>Color theme</strong><small>Switch between light, dark and your device setting</small></div><div class="setting-buttons">' +
      [['light','sun'],['dark','moon'],['system','settings']].map(([v,sym]) => '<button type="button" class="' + (state.theme === v ? 'chosen' : '') +
        '" data-action="theme" data-id="' + v + '" aria-label="' + v + ' theme">' + icon(sym,18) + '</button>').join('') + '</div></div>' +
      '<div class="setting-row"><div><strong>Message density</strong><small>More breathing room, or more messages on screen</small></div>' +
      '<div class="setting-buttons">' + [['comfortable','Comfort'],['compact','Compact']].map(([v,l]) => '<button type="button" class="setting-text ' +
        (state.density === v ? 'chosen' : '') + '" data-action="density" data-id="' + v + '">' + l + '</button>').join('') + '</div></div>' +
      '<div class="settings-divider"></div><div class="setting-row"><div><strong>Keyboard shortcuts</strong><small>Move faster without reaching for the mouse</small></div>' +
      button('help',icon('keyboard',19),'Show keyboard shortcuts') + '</div>' +
      (demo ? '<div class="settings-divider"></div><div class="setting-row"><div><strong>Reset sample inbox</strong><small>Restore the original demo messages</small></div>' +
        '<button class="secondary" type="button" data-action="reset-demo">Reset demo</button></div>' : '') +
      '</div>') + '</section></div>'
}
function renderApp() {
  const userLabel = mailboxAddress()
  $('app').innerHTML = '<div class="shell ' + (state.mobilePane === 'read' ? 'show-reader' : '') + '">' +
    (state.sidebarOpen ? '<button class="sidebar-dimmer" data-action="close-menu" aria-label="Close navigation"></button>' : '') +
    renderNav() + '<div class="main-column"><header class="topbar">' +
    button('menu',icon('menu',21),'Open navigation','icon-button mobile-only') +
    '<div class="top-search">' + icon('search',20) + '<input id="search" type="search" autocomplete="off" placeholder="Search across your mail…" aria-label="Search emails" value="' + h(state.query) + '">' +
    '<kbd>/</kbd></div><div class="top-right">' +
    button('refresh',icon('refresh',19),'Refresh messages') +
    button('help',icon('keyboard',19),'Keyboard shortcuts','icon-button desktop-only') +
    button('settings',icon('settings',20),'Preferences','icon-button desktop-only') +
    '<span class="header-profile" title="' + h(userLabel) + '">' + avatar(userLabel,'tiny') + '<span>' + h(userLabel) + '</span></span></div></header>' +
    (demo ? '<div class="mode-banner"><span>' + icon('sparkle',16) + '</span><strong>Demo workspace</strong><span>Explore everything. Emails here are simulated and never delivered.</span>' +
      button('demo-info',icon('info',17),'How to connect real email','banner-info') + '</div>' :
      (!sendEnabled ? '<div class="mode-banner live-warning">' + icon('info',16) + '<span>Mailbox connected. Real email delivery still needs the send-email function and a verified sender.</span></div>' : '')) +
    (state.error ? '<div class="data-error" role="alert">' + icon('spam',18) + ' ' + h(state.error) + '</div>' : '') +
    '<div class="workspace">' + renderList() + renderReader() + '</div></div>' +
    '<button type="button" class="floating-compose" data-action="compose" aria-label="Compose email">' + icon('plus',25) + '</button>' +
    '</div>' + renderCompose() + renderSettings() + '<div id="toast" class="toast" role="status"></div>'
  if (state.compose) {
    const body = $('compose-body')
    if (body) body.value = state.compose.body || ''
  }
}
function render({focusSearch = false} = {}) {
  if (state.authMode === 'recovery' || (!demo && !state.session)) renderAuth()
  else renderApp()
  if (focusSearch) { $('search')?.focus(); const node=$('search'); node?.setSelectionRange(node.value.length,node.value.length) }
}
async function load() {
  if (demo) { state.messages = loadDemo(); state.error = ''; render(); return }
  if (!currentUser()) return
  const mailboxLookup = await sb.from('mailboxes').select('address').eq('user_id', currentUser().id).order('created_at').limit(1).maybeSingle()
  state.mailboxIdentity = mailboxLookup.data?.address || ''
  const { data, error } = await sb.from('messages').select('*')
    .eq('user_id', currentUser().id).order('created_at', {ascending:false}).limit(1000)
  if (error) {
    state.error = 'Could not load messages. Check your Supabase schema and RLS policies: ' + error.message
    state.messages = []
  } else {
    state.error = ''
    state.messages = (data || []).map(normalizeMail)
  }
  render()
}
async function patchMessage(id, changes) {
  const m = state.messages.find(m => m.id === id)
  if (!m) return false
  const previous = {...m}
  Object.assign(m, changes)
  if (demo) {
    persistDemo()
    render()
    return true
  }
  render()
  const { error } = await sb.from('messages').update(changes).eq('id',id).eq('user_id',currentUser().id)
  if (error) {
    Object.assign(m,previous)
    render()
    notify('Change could not be saved: ' + error.message,'error')
    return false
  }
  return true
}
async function deleteMessage(id) {
  if (demo) {
    state.messages = state.messages.filter(m=>m.id !== id)
    persistDemo()
  } else {
    const { error } = await sb.from('messages').delete().eq('id',id).eq('user_id',currentUser().id)
    if (error) {notify('Could not delete: ' + error.message,'error');return}
    state.messages=state.messages.filter(m=>m.id !== id)
  }
  state.selected=null
  state.mobilePane='list'
  render()
  notify('Message permanently deleted.')
}
async function bulkChanges(changes) {
  const ids=[...state.checked]
  if (!ids.length) return
  const backups=state.messages.map(m=>({...m}))
  state.messages.forEach(m => { if(state.checked.has(m.id)) Object.assign(m,changes) })
  if (demo) persistDemo()
  else {
    const {error}=await sb.from('messages').update(changes).in('id',ids).eq('user_id',currentUser().id)
    if(error) {
      state.messages=backups
      render()
      notify('Bulk action failed: '+error.message,'error')
      return
    }
  }
  state.checked.clear()
  if(state.selected && ids.includes(state.selected) && changes.folder) {state.selected=null;state.mobilePane='list'}
  render()
  notify(ids.length+' message'+(ids.length===1?'':'s')+' updated.')
}
async function storeDraft(fields, editingId) {
  const row={
    folder:'drafts',to_addr:fields.to,subject:fields.subject,body:fields.body,
    from_addr:mailboxAddress(),is_read:true
  }
  if (editingId) {
    const result=await patchMessage(editingId,row)
    return result
  }
  if (demo) {
    state.messages.unshift(normalizeMail({...row,id:crypto.randomUUID(),created_at:new Date().toISOString()}))
    persistDemo();return true
  }
  const {data,error}=await sb.from('messages')
    .insert({...row,user_id:currentUser().id}).select('*').single()
  if(error){ notify('Could not save draft: '+error.message,'error');return false }
  state.messages.unshift(normalizeMail(data))
  return true
}
function composeFields() {
  return {
    to:$('compose-to')?.value.trim()||'',
    subject:$('compose-subject')?.value.trim()||'',
    body:$('compose-body')?.value||''
  }
}
async function saveDraft() {
  if (state.busy) return
  state.busy=true
  const fields=composeFields()
  const ok=await storeDraft(fields,state.compose?.editingId)
  state.busy=false
  if(ok) {
    state.compose=null;state.folder='drafts';state.selected=null;state.mobilePane='list'
    render();notify('Draft saved.')
  }
}
async function sendMessage() {
  if (state.busy || !state.compose) return
  const fields=composeFields()
  const invalid=validateOutgoing(fields)
  if(invalid){notify(invalid,'error');return}
  if (!composeAvailable()) {
    const ok=await storeDraft(fields,state.compose.editingId)
    if(ok) {
      state.compose=null;state.folder='drafts';state.selected=null;render()
      notify('Saved as draft. Configure a verified sender to deliver real email.')
    }
    return
  }
  state.busy=true
  const sendButton=$('compose-form')?.querySelector('button[type=submit]')
  if(sendButton) {sendButton.disabled=true;sendButton.textContent='Sending…'}
  try {
    if (demo) {
      if (state.compose.editingId) {
        const m=state.messages.find(x=>x.id===state.compose.editingId)
        if(m) Object.assign(m,{folder:'sent',to_addr:fields.to,subject:fields.subject,body:fields.body,is_read:true,created_at:new Date().toISOString()})
      } else {
        state.messages.unshift(normalizeMail({id:crypto.randomUUID(),folder:'sent',
          from_addr:mailboxAddress(),to_addr:fields.to,subject:fields.subject,
          body:fields.body,is_read:true,created_at:new Date().toISOString()}))
      }
      persistDemo()
    } else {
      const { data, error } = await sb.functions.invoke('send-email',{body:{...fields,requestId:state.compose.requestId}})
      if(error) throw error
      if(!data?.success) throw new Error(data?.error || 'Email service did not confirm delivery.')
      if(state.compose.editingId) {
        await sb.from('messages').delete().eq('id',state.compose.editingId).eq('user_id',currentUser().id)
      }
      await load()
    }
    state.compose=null;state.folder='sent';state.selected=null;state.mobilePane='list'
    render()
    notify(demo ? 'Demo send complete. No real email was delivered.' : 'Email accepted by your delivery provider.')
  } catch (err) {
    notify('Email was not confirmed as sent: '+(err.message||'Unknown error'),'error')
  } finally {
    state.busy=false
    if(state.compose && sendButton){sendButton.disabled=false;sendButton.innerHTML=icon('send',17)+' Send email'}
  }
}
function openCompose(from=null) {
  state.compose={...(from||{to:'',subject:'',body:'',editingId:null}),requestId:crypto.randomUUID()}
  state.sidebarOpen=false
  render()
  $('compose-to')?.focus()
}
async function selectMail(id) {
  const m=state.messages.find(x=>x.id===id)
  if(!m) return
  state.selected=id
  state.mobilePane='read'
  render()
  if(!m.is_read) await patchMessage(id,{is_read:true})
}
function closeCompose() {
  if(!state.compose) return
  const contents=composeFields()
  const initial=state.compose
  const changed=contents.to !== (initial.to||'') || contents.subject !== (initial.subject||'') ||
    contents.body !== (initial.body||'')
  if(changed && !confirm('Discard your unsaved changes? Use Save draft to keep them.')) return
  state.compose=null;render()
}
async function runAction(action,id) {
  const m=state.messages.find(x=>x.id===id)
  switch(action) {
    case 'folder':
      state.folder=id;state.selected=null;state.filter='all';state.checked.clear()
      state.mobilePane='list';state.sidebarOpen=false;render();break
    case 'filter':state.filter=id;state.checked.clear();render();break
    case 'compose':openCompose();break
    case 'open':await selectMail(id);break
    case 'check':
      state.checked.has(id)?state.checked.delete(id):state.checked.add(id);render();break
    case 'select-all':{
      const list=visibleMessages(state.messages,state.folder,state.query,state.filter)
      if(list.every(x=>state.checked.has(x.id))) list.forEach(x=>state.checked.delete(x.id))
      else list.forEach(x=>state.checked.add(x.id))
      render();break
    }
    case 'clear-selection':state.checked.clear();render();break
    case 'bulk-archive':await bulkChanges({folder:'archive'});break
    case 'bulk-trash':await bulkChanges({folder:'trash'});break
    case 'bulk-read':await bulkChanges({is_read:true});break
    case 'star':if(m) await patchMessage(id,{is_starred:!m.is_starred});break
    case 'archive':if(m) {
      await patchMessage(id,{folder:m.folder==='archive'?'inbox':'archive'})
      state.selected=null;state.mobilePane='list';render()
    } break
    case 'toggle-unread':if(m) await patchMessage(id,{is_read:!m.is_read});break
    case 'trash':if(m) {
      await patchMessage(id,{folder:'trash'});state.selected=null;state.mobilePane='list';render();notify('Moved to trash.')
    } break
    case 'restore':if(m) {
      await patchMessage(id,{folder:m.from_addr===mailboxAddress()?'sent':'inbox'})
      state.selected=null;state.mobilePane='list';render();notify('Message restored.')
    } break
    case 'delete':if(m && confirm('Permanently delete this message? This cannot be undone.')) await deleteMessage(id);break
    case 'reply':if(m) openCompose({to:addressOnly(m.folder==='sent'?m.to_addr:m.from_addr),
      subject:replySubject(m.subject),body:'\n\nOn '+new Date(m.created_at).toLocaleString()+', '+contactName(m.from_addr)+' wrote:\n> '+m.body.replace(/\n/g,'\n> '),editingId:null});break
    case 'forward':if(m) openCompose({to:'',subject:forwardSubject(m.subject),
      body:'\n\n---------- Forwarded message ----------\nFrom: '+m.from_addr+'\nDate: '+new Date(m.created_at).toLocaleString()+
        '\nSubject: '+m.subject+'\n\n'+m.body,editingId:null});break
    case 'edit-draft':if(m) openCompose({to:m.to_addr,subject:m.subject,body:m.body,editingId:m.id});break
    case 'close-compose':closeCompose();break
    case 'save-draft':await saveDraft();break
    case 'refresh':await load();notify(demo?'Demo inbox refreshed.':'Mailbox refreshed.');break
    case 'clear-search':state.query='';state.filter='all';render({focusSearch:true});break
    case 'menu':state.sidebarOpen=true;render();break
    case 'close-menu':state.sidebarOpen=false;render();break
    case 'back':state.mobilePane='list';render();break
    case 'settings':state.showSettings=true;state.showHelp=false;render();break
    case 'help':state.showSettings=false;state.showHelp=true;render();break
    case 'close-overlay':state.showHelp=false;state.showSettings=false;render();break
    case 'theme':state.theme=id;document.documentElement.dataset.theme=id
      localStorage.setItem('envara-theme',id);render();break
    case 'density':state.density=id;document.documentElement.dataset.density=id
      localStorage.setItem('envara-density',id);render();break
    case 'reset-demo':if(demo && confirm('Reset demo messages and lose your changes?')) {
      localStorage.removeItem(demoKey);state.messages=demoMessages();state.selected=null
      state.showSettings=false;render();notify('Sample inbox restored.')
    } break
    case 'demo-info':notify('Add your own Supabase project, apply schema.sql, then configure a sending provider. See README.');break
    case 'auth-signup':state.authMode='signup';state.authError='';render();break
    case 'auth-login':state.authMode='login';state.authError='';render();break
    case 'auth-reset':state.authMode='reset';state.authError='';render();break
    case 'logout':if(sb) {
      const {error}=await sb.auth.signOut()
      if(error) notify(error.message,'error')
    } break
    case 'dismiss-toast':$('toast')?.classList.remove('show');break
  }
}
async function submitAuth(e) {
  e.preventDefault()
  const email=$('auth-email')?.value.trim()
  const password=$('auth-password')?.value
  state.busy=true;state.authError=''
  const submit=$('auth-form')?.querySelector('button[type=submit]')
  if(submit){submit.disabled=true;submit.textContent='Please wait…'}
  try {
    let response
    if(state.authMode==='recovery') response=await sb.auth.updateUser({password})
    else if(state.authMode==='signup') response=await sb.auth.signUp({email,password})
    else if(state.authMode==='reset') response=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin})
    else response=await sb.auth.signInWithPassword({email,password})
    if(response.error) throw response.error
    if(state.authMode==='recovery'){
      state.authMode='login';render();notify('Password updated successfully.')
    } else if(state.authMode==='reset'){
      state.authMode='login';state.authError='Recovery link requested. Check your email.'
      render()
    } else if(state.authMode==='signup' && !response.data?.session){
      state.authMode='login';state.authError='Account created. Check your email to confirm your address, then sign in.'
      render()
    }
  }catch(err){state.authError=err.message||'Unable to sign in.';render()}
  finally{state.busy=false}
}
function attachEvents() {
  document.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-action]')
    if(!trigger) return
    if(trigger.classList.contains('modal-shade') && e.target!==trigger) return
    if(trigger.classList.contains('sidebar-dimmer') || trigger.dataset.action) {
      e.preventDefault()
      runAction(trigger.dataset.action,trigger.dataset.id)
    }
  })
  document.addEventListener('input',e=>{
    if(e.target.id==='search') {
      const pos=e.target.selectionStart
      state.query=e.target.value
      render({focusSearch:true})
      const input=$('search')
      if(input) input.setSelectionRange(pos,pos)
    }
  })
  document.addEventListener('submit',e=>{
    if(e.target.id==='auth-form') return void submitAuth(e)
    if(e.target.id==='compose-form') {e.preventDefault();void sendMessage()}
  })
  document.addEventListener('keydown',e=>{
    if(e.target.matches('.mail-row') && (e.key==='Enter'||e.key===' ')) {
      e.preventDefault();void selectMail(e.target.dataset.id);return
    }
    const editing=e.target.matches('input,textarea,[contenteditable]')
    if(e.key==='Escape'){
      if(state.compose) closeCompose()
      else if(state.showHelp || state.showSettings) {state.showHelp=false;state.showSettings=false;render()}
      else if(state.sidebarOpen) {state.sidebarOpen=false;render()}
      else if(state.mobilePane==='read') {state.mobilePane='list';render()}
      return
    }
    if((e.ctrlKey||e.metaKey) && e.key==='Enter' && state.compose){e.preventDefault();void sendMessage();return}
    if(editing || e.ctrlKey || e.metaKey || e.altKey || (!demo && !state.session) || state.compose || state.showSettings || state.showHelp) return
    const k=e.key.toLowerCase()
    if(k==='c') {e.preventDefault();openCompose()}
    else if(k==='/') {e.preventDefault();$('search')?.focus()}
    else if(k==='?') {e.preventDefault();state.showHelp=true;render()}
    else if(k==='e' && state.selected) {e.preventDefault();void runAction('archive',state.selected)}
    else if(k==='j'||k==='k'){
      const list=visibleMessages(state.messages,state.folder,state.query,state.filter)
      if(!list.length) return
      const index=list.findIndex(m=>m.id===state.selected)
      const next=k==='j' ? (index+1)%list.length : (index<0?list.length-1:(index-1+list.length)%list.length)
      e.preventDefault();void selectMail(list[next].id)
    }
  })
}
async function boot(){
  attachEvents()
  if(demo){state.messages=loadDemo();render();return}
  render()
  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'){
      setTimeout(()=>{state.session=session;state.authMode='recovery';render()},0)
      return
    }
    setTimeout(async()=>{
      if(session?.user?.id === state.session?.user?.id && session?.access_token===state.session?.access_token) return
      state.session=session;state.selected=null;state.checked.clear();state.mobilePane='list'
      if(!session) state.mailboxIdentity=''
      if(session) await load()
      else {state.messages=[];render()}
    },0)
  })
  const {data,error}=await sb.auth.getSession()
  if(error){state.authError=error.message;render();return}
  if(data.session){state.session=data.session;await load()}
  else render()
}
void boot()
