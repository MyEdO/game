// Le CLIQUET du contexte permanent : `PLAFOND_OCTETS` (scripts/guards/budget-contexte.mjs) est en
// ÉGALITÉ avec la mesure de l'arbre — une accrétion est rouge, un allègement non reporté aussi.
// Même forme que les cliquets voisins (`scripts/guards/lib/domResiduStock.test.mjs`).
import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CARACTERES_PAR_TOKEN, PLAFOND_OCTETS, PORTEUR_DU_PLAFOND,
  estCheminDuBudget, importsDe, ligneDeDescription, mesurerBudget, postesQuiGrossissent, refusDeBudget,
  verdictDuPlafond,
} from './budget-contexte.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Les fixtures et les cas vivent DANS le corps du `describe(…)` : ce sont des données LOCALES au sens
// de `scripts/guards/lib/stocksNominatifs.mjs` (§ PORTÉE DE MODULE), pas un stock nominatif de module.
describe('budget-contexte', () => {
  const FAUX = {
    'CLAUDE.md': '@.claude/credo.md\n\n# titre\n',
    '.claude/credo.md': 'credo\n',
    '.claude/memory/MEMORY.md': 'index\n',
    '.claude/skills/a/SKILL.md': '---\nname: a\ndescription: dix\n---\n\ncorps très long ignoré\n',
    '.claude/agents/b.md': '---\nname: b\ndescription: douze\n---\n\ncorps\n',
  }
  /** Une lecture par LOT (`lireTout`) depuis un dictionnaire de textes. */
  const parLot = (textes) => (chemins) => new Map(chemins.map((c) => [c, textes[c] ?? null]))
  const io = {
    lireTout: parLot(FAUX),
    lister: (dossier) => (dossier === '.claude/skills' ? ['a'] : dossier === '.claude/agents' ? ['b.md'] : []),
  }

  test('la mesure nomme un poste par fichier : CLAUDE.md, ses imports @, MEMORY.md, les descriptions', () => {
    const { postes, total } = mesurerBudget('/nulle-part', io)
    assert.deepEqual(postes.map((p) => p.nom), [
      'CLAUDE.md',
      '.claude/credo.md',
      '.claude/memory/MEMORY.md',
      '.claude/skills/a/SKILL.md#description',
      '.claude/agents/b.md#description',
    ])
    // Seule la LIGNE `description:` entre, jamais le corps : `description: dix` = 16 octets.
    assert.equal(postes.at(-2).octets, 16)
    assert.equal(total, postes.reduce((n, p) => n + p.octets, 0))
  })

  test('un fichier en CRLF pèse le même nombre d’octets qu’en LF (worktree du harnais)', () => {
    const crlf = { lireTout: parLot(Object.fromEntries(Object.entries(FAUX).map(([c, t]) => [c, t.replace(/\n/g, '\r\n')]))), lister: io.lister }
    assert.equal(mesurerBudget('/nulle-part', crlf).total, mesurerBudget('/nulle-part', io).total)
  })

  test('un import @ ne se suit qu’UNE passe : l’import d’un import n’entre pas', () => {
    const chaine = {
      lireTout: parLot({ 'CLAUDE.md': '@a.md\n', 'a.md': '@b.md\n', 'b.md': 'xxxxxxxxxx\n' }),
      lister: () => [],
    }
    assert.deepEqual(mesurerBudget('/nulle-part', chaine).postes.map((p) => p.nom), ['CLAUDE.md', 'a.md'])
  })

  test('importsDe ne lit qu’une ligne @ seule, jamais une adresse ou un @ en prose', () => {
    assert.deepEqual(importsDe('@.claude/credo.md\ntexte @ailleurs.md ici\n@x y\n'), ['.claude/credo.md'])
  })

  test('ligneDeDescription ne lit que le frontmatter, et rend null sans frontmatter', () => {
    assert.equal(ligneDeDescription('---\nname: a\ndescription: d\n---\ndescription: leurre\n'), 'description: d')
    assert.equal(ligneDeDescription('# titre\ndescription: d\n'), null)
    assert.equal(ligneDeDescription('---\nname: a\n---\ndescription: d\n'), null)
  })

  test('PLAFOND_OCTETS est EN ÉGALITÉ avec la mesure de cet arbre', () => {
    const mesure = mesurerBudget(RACINE)
    const verdict = verdictDuPlafond(mesure, PLAFOND_OCTETS)
    assert.equal(verdict, null, verdict ?? '')
  })

  test('le verdict nomme un dépassement, et nomme aussi un plafond MOU', () => {
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 100 }], total: 100 }
    assert.equal(verdictDuPlafond(mesure, 100), null)
    assert.match(verdictDuPlafond(mesure, 50), /BUDGET DU CONTEXTE DÉPASSÉ.*\+50.*CLAUDE\.md/s)
    assert.match(verdictDuPlafond(mesure, 200), /plafond mou : abaisser à 100/)
  })

  test('postesQuiGrossissent nomme le poste NEUF comme une croissance depuis 0', () => {
    const avant = { postes: [{ nom: 'CLAUDE.md', octets: 10 }], total: 10 }
    const apres = { postes: [{ nom: 'CLAUDE.md', octets: 12 }, { nom: 'x#description', octets: 5 }], total: 17 }
    assert.deepEqual(postesQuiGrossissent(avant, apres), [
      { nom: 'CLAUDE.md', avant: 10, apres: 12, delta: 2 },
      { nom: 'x#description', avant: 0, apres: 5, delta: 5 },
    ].sort((a, b) => b.delta - a.delta))
  })

  test('une croissance SANS CLIQUET est refusée, et le refus NOMME le poste qui a grossi et de combien', () => {
    const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const refus = refusDeBudget({ mesure, reference, plafond: 9127, message: 'docs: une ligne de plus' })
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /CLAUDE\.md \+1024 octets \(9127 → 10151\)/)
    assert.match(refus.reason, /\+1024/)
  })

  test('la MÊME croissance passe quand le message porte le CLIQUET du porteur du plafond', () => {
    const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const message = `feat: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +1024 — une règle de routage neuve, validée`
    assert.equal(refusDeBudget({ mesure, reference, plafond: 9127, message }), null)
  })

  test('un CLIQUET qui annonce le MAUVAIS compte ne couvre pas : le refus dit le compte annoncé', () => {
    const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const message = `feat: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +1 — une règle de routage neuve, validée`
    const refus = refusDeBudget({ mesure, reference, plafond: 9127, message })
    assert.ok(refus, 'un `+1` de tampon couvrirait toutes les accrétions suivantes')
    assert.match(refus.reason, /annonce `\+1`, pas \+1024/)
  })

  test('le périmètre de la porte suit les IMPORTS @ de CLAUDE.md, jamais une liste figée', () => {
    assert.ok(estCheminDuBudget('CLAUDE.md'))
    assert.ok(estCheminDuBudget('.claude/memory/MEMORY.md'))
    assert.ok(estCheminDuBudget('.claude/skills/a/SKILL.md'))
    assert.ok(estCheminDuBudget('.claude/agents/b.md'))
    // L'import du jour n'est PAS câblé en dur : hors liste, il est hors périmètre.
    assert.equal(estCheminDuBudget('.claude/credo.md'), false)
    assert.ok(estCheminDuBudget('.claude/credo.md', importsDe(FAUX['CLAUDE.md'])))
    // Un import NEUF entre dans le périmètre sans toucher à ce module.
    assert.ok(estCheminDuBudget('.claude/routage.md', importsDe('@.claude/routage.md\n')))
  })

  test('un CLIQUET qui nomme un AUTRE fichier ne couvre pas le budget', () => {
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const message = 'feat\n\nCLIQUET: scripts/guards/lib/structuresStock.mjs +1 — un motif assez long pour compter'
    assert.ok(refusDeBudget({ mesure, reference: null, plafond: 9127, message }))
  })

  test('sans plafond lisible (pré-image absente), la porte ne juge RIEN plutôt que de refuser', () => {
    const mesure = { postes: [], total: 99999 }
    assert.equal(refusDeBudget({ mesure, reference: null, plafond: null, message: '' }), null)
  })

  test('le ratio caractères/token est DIT, pour que le plafond se lise en tokens', () => {
    assert.equal(CARACTERES_PAR_TOKEN, 2.2)
  })
})
