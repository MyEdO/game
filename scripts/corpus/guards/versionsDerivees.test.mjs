import { test } from 'node:test'

import assert from 'node:assert/strict'

import { readCorpus } from '../../guards/lib/sourceCorpus.mjs'

import { versionsNonDerivees } from '../../guards/lib/versionsDerivees.mjs'

test('src/ : aucune version de forme persistée écrite à la main', () => {
  assert.deepEqual(versionsNonDerivees(readCorpus(['src'])), { P1: [], P2: [], P3: [] })
})
