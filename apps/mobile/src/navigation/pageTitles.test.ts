import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPageTitle } from './pageTitles'

test('uses readable labels and a safe fallback', () => {
  assert.equal(formatPageTitle(undefined, { name: 'ForgotPassword' }), 'Forgot Password | datememe')
  assert.equal(formatPageTitle(undefined, { name: 'ProfileTab' }), 'My Profile | datememe')
  assert.equal(formatPageTitle(undefined, { name: 'UnknownInternalScreen' }), 'datememe')
  assert.equal(formatPageTitle(undefined, undefined), 'datememe')
})

test('uses route context and distinguishes editing from results', () => {
  const params = { shortLabel: 'Best Movies' }
  assert.equal(formatPageTitle(undefined, { name: 'ListBuilder', params }), 'Best Movies — Build Your List | datememe')
  assert.equal(formatPageTitle(undefined, { name: 'PollResults', params }), 'Best Movies — Results | datememe')
  assert.equal(formatPageTitle(undefined, { name: 'Conversation', params: { displayName: 'Sam' } }), 'Chat with Sam | datememe')
})

test('deep links without display data have useful titles', () => {
  assert.equal(formatPageTitle(undefined, { name: 'PollResults', params: { categorySlug: 'movies' } }), 'Poll Results | datememe')
  assert.equal(formatPageTitle(undefined, { name: 'Conversation', params: { conversationId: 'private-id' } }), 'Conversation | datememe')
})

test('loaded screen titles override stale route labels', () => {
  assert.equal(formatPageTitle({ title: '  Renamed Movies — Results\n' }, { name: 'PollResults', params: { shortLabel: 'Old Movies' } }), 'Renamed Movies — Results | datememe')
  assert.equal(formatPageTitle({ title: '' }, { name: 'ProfileDetail', params: { displayName: 'Sam' } }), 'Sam — Profile | datememe')
})

test('malformed labels are ignored instead of exposing raw objects', () => {
  assert.equal(formatPageTitle(undefined, { name: 'ListBuilder', params: { shortLabel: {} } }), 'Build Your List | datememe')
  assert.equal(formatPageTitle(undefined, { name: 'Conversation', params: { displayName: '  ' } }), 'Conversation | datememe')
})
