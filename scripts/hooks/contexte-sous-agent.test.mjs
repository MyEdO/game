// node --test scripts/hooks/contexte-sous-agent.test.mjs
// Le hook SubagentStart (#2712, #2725) : règles communes au type qui a un canal shell ; mémoire en conteneur
// distant au type qui lit ; rien au type cloisonné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGLES_COMMUNES, sortieSousAgent } from './contexte-sous-agent.mjs'
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

test('sortieSousAgent : règles communes au type à shell, mémoire en conteneur distant au type qui lit, rien au type cloisonné', () => {
  const racine = mkdtempSync(join(tmpdir(), 'contexte-sous-agent-'))
  const fiches = () => new Map([
    ['joueur', { ...fiche(['CronList']), name: 'joueur' }],
    ['juge', { ...fiche(['Read', 'Bash']), name: 'juge' }],
    ['liseur', { ...fiche(['Read']), name: 'liseur' }],
    ['shell-lean-ctx', { ...fiche(['mcp__lean-ctx__ctx_shell']), name: 'shell-lean-ctx' }],
  ])
  const contexte = (agent_type, env) => sortieSousAgent({ agent_type }, { env, racine, fiches })?.hookSpecificOutput.additionalContext ?? null
  try {
    mkdirSync(dirname(join(racine, INDEX_MEMOIRE)), { recursive: true })
    writeFileSync(join(racine, INDEX_MEMOIRE), '# Index\n')
    mkdirSync(dirname(join(racine, REGLES_COMMUNES)), { recursive: true })
    writeFileSync(join(racine, REGLES_COMMUNES), '# Communes\n')
    const distant = { CLAUDE_CODE_REMOTE: 'true' }
    assert.equal(sortieSousAgent({ agent_type: 'juge' }, { env: {}, racine, fiches }).hookSpecificOutput.hookEventName, 'SubagentStart')
    assert.equal(contexte('juge', {}), '# Communes')
    assert.match(contexte('juge', distant), /^# Communes\n\n[\s\S]*# Index/)
    assert.equal(contexte('shell-lean-ctx', {}), '# Communes', 'ctx_shell est un canal shell')
    assert.match(contexte('Explore', distant), /# Communes[\s\S]*# Index/, 'type intégré : tous les outils')
    assert.doesNotMatch(contexte('liseur', distant), /# Communes/)
    assert.equal(contexte('liseur', {}), null)
    assert.equal(contexte('joueur', distant), null)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('les règles communes du dépôt existent et ne sont recopiées dans aucune fiche d’agent', () => {
  const racine = fileURLToPath(new URL('../../', import.meta.url))
  const tetes = [...readFileSync(join(racine, REGLES_COMMUNES), 'utf8').matchAll(/^- \*\*([^*]+)\*\*/gm)].map(([, tete]) => tete.replace(/[.:]$/, '').toLowerCase())
  assert.ok(tetes.length > 0, 'chaque règle commune ouvre sur sa tête en gras')
  const dossier = join(racine, '.claude', 'agents')
  for (const f of readdirSync(dossier).filter((n) => n.endsWith('.md'))) {
    const texte = readFileSync(join(dossier, f), 'utf8').toLowerCase()
    for (const tete of tetes) assert.ok(!texte.includes(tete), `${f} recopie « ${tete} »`)
  }
})
