// Hook SessionStart du suivi de vague (#2132, lot 2) : le point d'entrée RÉEL, rejoué par `node` sur
// un dépôt forgé dont le `.git/suivi` porte la fixture et un journal forgé ; puis `texteDInjection` sur
// un dossier jetable, pour la borne du total.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { PLAFOND_INJECTION } from '../ops/suivi.mjs'
import { texteDInjection } from './inject-suivi.mjs'
import { JOURNAL, ligneDeJournal } from './suivi-lien-guard.mjs'

const REEL = FS.readFileSync(new URL('../ops/fixtures/suivi-1816.md', import.meta.url), 'utf8')
const HOOK = fileURLToPath(new URL('./inject-suivi.mjs', import.meta.url))

/** Le hook lancé dans `racine` sur l'entrée `entree` : son code et son stdout. */
function lancer(racine, entree) {
  const vu = spawnSync(process.execPath, [HOOK], { cwd: racine, input: JSON.stringify(entree), encoding: 'utf8', timeout: 30_000 })
  return { code: vu.status, stdout: vu.stdout, stderr: vu.stderr }
}

test('T4 — compaction d’une session LIÉE : le digest du suivi, Objectif et prochaine étape `[ ]` ; sans lien, l’index', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    FS.writeFileSync(join(dossier, '1816.md'), REEL)
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique: 1816 }))

    const lie = lancer(racine, { hook_event_name: 'SessionStart', source: 'compact', session_id: 's' })
    assert.equal(lie.code, 0, lie.stderr)
    assert.match(lie.stdout, /^\[suivi #1816\] .*1816\.md — écrit le /)
    assert.ok(lie.stdout.includes('## Objectif\nÉpique #1816, « Tout le plan, dans l\'ordre »'), lie.stdout.slice(0, 600))
    assert.ok(lie.stdout.includes(REEL.split('\n').find((l) => l.includes('[ ]'))), 'la prochaine étape ouverte')
    assert.doesNotMatch(lie.stdout, /\[x\]|lie cette session/)

    const seul = lancer(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'autre' })
    assert.equal(seul.code, 0, seul.stderr)
    assert.match(seul.stdout, /^\[suivi\] session sans suivi lié ; suivis de vague modifiés depuis moins de 72 h/)
    assert.match(seul.stdout, /\n- #1816 — Suivi de vague — épique #1816 \(5e sélectionnable\), session 60c2b9c9 — \d{4}-\d{2}-\d{2} \d{2}:\d{2}\n/)
    assert.match(seul.stdout, /`npm run ops:suivi -- N` lie cette session au suivi #N\.\n$/)
    assert.doesNotMatch(seul.stdout, /## Objectif/)

    FS.utimesSync(join(dossier, '1816.md'), new Date(), new Date(Date.now() - 73 * 3_600_000))
    assert.equal(lancer(racine, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'autre' }).stdout, '', 'rien de récent : silence')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

test('deux épiques liées : le TOTAL injecté tient sous PLAFOND_INJECTION, chaque digest coupé à sa part', () => {
  const dossier = FS.mkdtempSync(join(tmpdir(), 'inject-suivi-'))
  try {
    const etapes = Array.from({ length: 300 }, (_, i) => `   - [ ] étape ouverte numéro ${i} du plan`)
    for (const epique of [1, 2]) {
      FS.writeFileSync(join(dossier, `${epique}.md`), ['# Suivi', '', '## Objectif', 'x', '', '## En cours', `1. #${epique} item`, ...etapes, ''].join('\n'))
    }
    FS.writeFileSync(join(dossier, JOURNAL), [1, 2].map((epique) => ligneDeJournal({ iso: new Date().toISOString(), session: 's', epique })).join(''))
    const texte = texteDInjection({ entree: { session_id: 's' }, dossier, maintenant: new Date() })
    assert.ok(texte.length <= PLAFOND_INJECTION, `${texte.length} > ${PLAFOND_INJECTION}`)
    for (const epique of [1, 2]) assert.match(texte, new RegExp(`^\\[suivi #${epique}\\] `, 'm'))
    assert.equal(texte.match(/… tronqué, lire /g)?.length, 2, 'chaque digest coupé à sa part')
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})
