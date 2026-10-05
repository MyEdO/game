import test from 'node:test'
import assert from 'node:assert/strict'

test('banc réel de reprise de file : premier essai de la branche de preuve', () => {
  const premierEssaiDuBanc = process.env.GITHUB_REF === 'refs/heads/chantier/2330-banc'
    && process.env.GITHUB_RUN_ATTEMPT === '1'
  assert.equal(premierEssaiDuBanc, false, 'Premier essai rouge du banc de reprise de file')
})
