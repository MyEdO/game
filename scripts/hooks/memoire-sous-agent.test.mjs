// node --test scripts/hooks/memoire-sous-agent.test.mjs
// Le hook SubagentStart de la mémoire (#2712) : en conteneur distant, aux types qui peuvent lire, rien ailleurs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { sortieSousAgent } from './memoire-sous-agent.mjs'
import { outilAccorde } from '../guards/lib/typesDAgent.mjs'
import { INDEX_MEMOIRE } from './memoire-du-depot.mjs'

const fiche = (tools, disallowedTools = []) => ({ name: 't', tools, disallowedTools, model: null, effort: null })

test('outilAccorde : sans `tools` → oui ; `tools` sans Read, Read interdit ou couvert par un `*` → non', () => {
  assert.equal(outilAccorde(fiche(null), 'Read'), true)
  assert.equal(outilAccorde(fiche(['Read', 'Bash']), 'Read'), true)
  assert.equal(outilAccorde(fiche(['CronList']), 'Read'), false)
  assert.equal(outilAccorde(fiche(null, ['Read']), 'Read'), false)
  assert.equal(outilAccorde(fiche(null, ['Re*']), 'Read'), false)
})

test('sortieSousAgent : l’index en conteneur distant au type qui lit ; rien hors conteneur ni au type cloisonné', () => {
  const racine = mkdtempSync(join(tmpdir(), 'memoire-sous-agent-'))
  const fiches = () => new Map([['joueur', { ...fiche(['CronList']), name: 'joueur' }], ['juge', { ...fiche(['Read']), name: 'juge' }]])
  try {
    mkdirSync(dirname(join(racine, INDEX_MEMOIRE)), { recursive: true })
    writeFileSync(join(racine, INDEX_MEMOIRE), '# Index\n')
    const distant = { CLAUDE_CODE_REMOTE: 'true' }
    const sortie = sortieSousAgent({ agent_type: 'juge' }, { env: distant, racine, fiches })
    assert.equal(sortie.hookSpecificOutput.hookEventName, 'SubagentStart')
    assert.match(sortie.hookSpecificOutput.additionalContext, /# Index/)
    assert.ok(sortieSousAgent({ agent_type: 'Explore' }, { env: distant, racine, fiches }))
    assert.equal(sortieSousAgent({ agent_type: 'joueur' }, { env: distant, racine, fiches }), null)
    assert.equal(sortieSousAgent({ agent_type: 'juge' }, { env: {}, racine, fiches }), null)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
