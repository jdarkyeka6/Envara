import test from 'node:test'
import assert from 'node:assert/strict'
import {
  escapeHtml, normalizeMail, visibleMessages, mailboxCounts, validateOutgoing,
  replySubject, addressOnly, contactName, demoMessages
} from '../src/mail.js'
test('HTML-encodes dangerous email content', () => {
  assert.equal(escapeHtml('<img src="x" onerror=\'x\'>&'), '&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt;&amp;')
})
test('normalizes nullable values and booleans', () => {
  const m = normalizeMail({id:'1',subject:null,is_read:0})
  assert.equal(m.subject,'')
  assert.equal(m.is_read,false)
  assert.equal(m.folder,'inbox')
})
test('folder, search and filters handle email reliably', () => {
  const data=demoMessages()
  assert.equal(visibleMessages(data,'inbox').length,5)
  assert.equal(visibleMessages(data,'inbox','','unread').length,2)
  assert.equal(visibleMessages(data,'starred').length,2)
  assert.equal(visibleMessages(data,'inbox','FRIDAY').length,1)
  assert.equal(visibleMessages(data,'all').length,7)
  assert.equal(mailboxCounts(data).inbox,2)
  assert.equal(mailboxCounts(data).drafts,1)
})
test('outgoing validation rejects unsafe or malformed emails', () => {
  assert.match(validateOutgoing({to:'bad address',body:'Hey'}),/invalid/i)
  assert.match(validateOutgoing({to:'a@example.com',body:'  '}),/write a message/i)
  assert.equal(validateOutgoing({to:'a@example.com,b@example.org',subject:'Hello',body:'World'}),null)
  assert.match(validateOutgoing({to:'a@example.com',subject:'x'.repeat(201),body:'Hello'}),/200/)
})
test('reply subjects do not stack prefixes', () => {
  assert.equal(replySubject('Hello'),'Re: Hello')
  assert.equal(replySubject('Re: Hello'),'Re: Hello')
})
test('contacts support friendly names',()=>{
  assert.equal(contactName('Alex Smith <alex@example.com>'),'Alex Smith')
  assert.equal(addressOnly('Alex Smith <alex@example.com>'),'alex@example.com')
})
