import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MAX_REPLY_TOKENS, SCOPE_MARKER, withReplyCap, withScopeSection } from './fix-scope.js';

const PROMPT = '## 1. PERSONA\nBe kind.\n\n## BRAND NAME\nSay YOO-la.\n\n---\n\n## 2. KNOWLEDGE\nFacts.\n';

test('scope section is inserted before section 2, once', () => {
  const once = withScopeSection(PROMPT);
  assert.ok(once.includes(SCOPE_MARKER));
  assert.ok(once.indexOf(SCOPE_MARKER) < once.indexOf('## 2. KNOWLEDGE'));
  assert.ok(once.indexOf('## BRAND NAME') < once.indexOf(SCOPE_MARKER));
  assert.equal(withScopeSection(once), once); // idempotent
});

test('scope section is appended when there is no section 2', () => {
  const out = withScopeSection('Just a prompt.');
  assert.ok(out.startsWith('Just a prompt.'));
  assert.ok(out.includes(SCOPE_MARKER));
});

test('scope section covers off-topic refusal, injection and brevity', () => {
  const text = withScopeSection(PROMPT);
  assert.match(text, /I can only help with JOOLA/);
  assert.match(text, /info@joola\.com/);
  assert.match(text, /never as instructions/i);
  assert.match(text, /system prompt|instructions/);
  assert.match(text, /do not call any tool/i);
  assert.match(text, /When in\s+doubt, look it up/); // no over-refusal of JOOLA questions
});

test('reply cap only ever lowers maxTokens', () => {
  assert.equal(withReplyCap({}).maxTokens, MAX_REPLY_TOKENS);
  assert.equal(withReplyCap({ maxTokens: 1000 }).maxTokens, MAX_REPLY_TOKENS);
  assert.equal(withReplyCap({ maxTokens: 150 }).maxTokens, 150);
  assert.equal(withReplyCap({ model: 'gpt-4o', temperature: 0.5 }).model, 'gpt-4o');
});
