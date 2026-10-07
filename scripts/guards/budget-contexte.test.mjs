import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CARACTERES_PAR_TOKEN, PORTEUR_DU_PLAFOND, controlerBudgetDeLaPlage,
  estCheminDuBudget, importsDe, ligneDeDescription, mesurerBudget, postesQuiGrossissent, refusDeBudget,
} from './budget-contexte.mjs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { instanceDeDepot, sousGitFeint } from './lib/depotGabarit.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'
import { spawnSync } from 'node:child_process'

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

  test('le budget vivant contrôle la plage effective de branche ou de file', () => {
    const resultat = controlerBudgetDeLaPlage({ cwd: RACINE })
    assert.deepEqual(resultat.refus, [], resultat.refus.map((r) => r.reason).join('\n'))
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
    const refus = refusDeBudget({ mesure, reference, message: 'docs: une ligne de plus' })
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /CLAUDE\.md \+1024 octets \(9127 → 10151\)/)
    assert.match(refus.reason, /\+1024/)
  })

  test('la MÊME croissance passe quand le message porte le CLIQUET du porteur du plafond', () => {
    const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const message = `feat: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +1024 — une règle de routage neuve, validée`
    assert.equal(refusDeBudget({ mesure, reference, message }), null)
  })

  test('un CLIQUET qui annonce le MAUVAIS compte ne couvre pas : le refus dit le compte annoncé', () => {
    const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const message = `feat: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +1 — une règle de routage neuve, validée`
    const refus = refusDeBudget({ mesure, reference, message })
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
    assert.ok(refusDeBudget({ mesure, reference: { postes: [], total: 9127 }, message }))
  })

  test('une référence absente est une erreur explicite', () => {
    const mesure = { postes: [], total: 99999 }
    assert.throws(() => refusDeBudget({ mesure, reference: null, message: '' }), /référence.*absente/)
  })

  test('le ratio caractères/token est DIT, pour que le plafond se lise en tokens', () => {
    assert.equal(CARACTERES_PAR_TOKEN, 2.2)
  })
})

describe('budget de plage', () => {
  const fixture = (fichiers, fn) => {
    const { racine, sha } = instanceDeDepot({ fichiers })
    const git = gitDe(racine, { net: true })
    const ecrire = (rel, texte) => {
      mkdirSync(dirname(resolve(racine, rel)), { recursive: true })
      writeFileSync(resolve(racine, rel), texte)
    }
    const commit = (rel, texte, message = 'docs: contexte') => {
      ecrire(rel, texte)
      git('add', '--', rel)
      git('commit', '-m', message)
      return git('rev-parse', 'HEAD')
    }
    const controle = (debut = sha, fin = 'HEAD') => controlerBudgetDeLaPlage({ cwd: racine, debut, fin })
    try { fn({ racine, sha, git, ecrire, commit, controle }) }
    finally { rmSync(racine, { recursive: true, force: true }) }
  }
  const declare = (n) => `docs: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +${n} — nouvelle instruction nécessaire au démarrage`

  test('hausse couverte, non couverte et déclaration erronée : chaque commit est jugé', () => {
    fixture({ 'CLAUDE.md': 'abc\n' }, ({ commit, controle }) => {
      commit('CLAUDE.md', 'abcd\n', declare(1))
      assert.equal(controle().refus.length, 0)
      const manque = commit('CLAUDE.md', 'abcde\n')
      const mauvais = commit('CLAUDE.md', 'abcdef\n', declare(2))
      const resultat = controle()
      assert.equal(resultat.commitsControles, 3)
      assert.deepEqual(resultat.refus.map((r) => r.sha), [manque, mauvais])
      assert.match(resultat.refus[1].reason, /annonce `\+2`, pas \+1/)
    })
  })

  test('une baisse resserre la référence : la remontée sous le total initial est refusée', () => {
    fixture({ 'CLAUDE.md': 'abcdef\n' }, ({ commit, controle }) => {
      commit('CLAUDE.md', 'a\n')
      assert.equal(controle().refus.length, 0)
      commit('CLAUDE.md', 'abc\n')
      const resultat = controle()
      assert.equal(resultat.refus.length, 1)
      assert.match(resultat.refus[0].reason, /soit \+2/)
    })
  })

  test('imports ajoutés et retirés : le périmètre suit les deux images', () => {
    fixture({ 'CLAUDE.md': 'titre\n', 'a.md': 'abcd\n' }, ({ commit, controle }) => {
      commit('CLAUDE.md', '@a.md\n')
      const resultat = controle()
      assert.equal(resultat.refus.length, 1)
      assert.match(resultat.refus[0].reason, /a\.md \+5 octets/)
    })
    fixture({ 'CLAUDE.md': '@a.md\n', 'a.md': 'abcd\n' }, ({ commit, controle }) => {
      commit('CLAUDE.md', 'titre\n')
      commit('a.md', 'abcdefgh\n')
      assert.deepEqual(controle(), { commitsControles: 1, refus: [] })
    })
  })

  test('supprimer une description allège ; augmenter le corps seul ne grossit pas', () => {
    fixture({ 'CLAUDE.md': 'titre\n', '.claude/agents/a.md': '---\ndescription: abc\n---\ncorps\n' }, ({ commit, controle }) => {
      commit('.claude/agents/a.md', '---\ndescription: abc\n---\ncorps beaucoup plus long\n')
      commit('.claude/agents/a.md', '---\nname: a\n---\ncorps\n')
      assert.deepEqual(controle(), { commitsControles: 2, refus: [] })
    })
  })

  test('fusion propre : le contexte des parents ne se paie pas une seconde fois ; résolution : référence automatique', () => {
    fixture({ 'CLAUDE.md': 'titre\n' }, ({ sha, git, commit, controle }) => {
      git('checkout', '-b', 'autre', sha)
      commit('CLAUDE.md', 'titre agrandi\n', declare(8))
      git('checkout', '-b', 'branche', sha)
      commit('notes.md', 'note\n')
      git('merge', '--no-ff', 'autre', '-m', 'fusion propre')
      assert.deepEqual(controle(), { commitsControles: 1, refus: [] })
      const propre = git('rev-parse', 'HEAD')
      git('checkout', '-b', 'resolue', sha)
      commit('notes2.md', 'note\n')
      git('merge', '--no-commit', '--no-ff', 'autre')
      commit('CLAUDE.md', 'titre agrandi encore\n', 'fusion résolue')
      const resultat = controle()
      assert.equal(resultat.refus.length, 1)
      assert.match(resultat.refus[0].reason, /soit \+7/)
      assert.deepEqual(controle(propre, propre), { commitsControles: 0, refus: [] })
    })
  })

  test('borne absente et panne de lecture ne rendent jamais un succès vide', () => {
    fixture({ 'CLAUDE.md': 'abc\n' }, ({ commit, controle }) => {
      commit('CLAUDE.md', 'abcd\n')
      assert.throws(() => controle('inconnue'), /borne|plage.*illisible/)
      assert.throws(() => controle(null), /base.*absente/)
      sousGitFeint([{ si: ['cat-file', '--batch'], status: 1, stderr: 'panne budget' }], () => {
        assert.throws(() => controle(), /panne budget/)
      })
    })
  })

  test('le driver lit les bornes explicites et la base du groupe de fusion ; une plage vide est dite', () => {
    fixture({ 'CLAUDE.md': 'abc\n' }, ({ racine, sha, git, commit }) => {
      git('update-ref', 'refs/remotes/origin/main', sha)
      const tete = commit('CLAUDE.md', 'abcd\n')
      const script = resolve(RACINE, 'scripts/guards/budget-contexte.mjs')
      const lancer = (args, env = {}) => spawnSync(process.execPath, [script, ...args], {
        cwd: racine, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_PATH: '', ...env },
      })
      const explicite = lancer(['--base', sha, '--tete', tete])
      assert.equal(explicite.status, 1, explicite.stderr)
      assert.match(explicite.stderr, /CLIQUET/)
      const branche = lancer([])
      assert.equal(branche.status, 1, branche.stderr)
      assert.match(branche.stderr, /CLIQUET/)
      const evenement = resolve(racine, 'evenement.json')
      writeFileSync(evenement, JSON.stringify({ merge_group: { base_sha: tete } }))
      const groupe = lancer([], { GITHUB_EVENT_PATH: evenement })
      assert.equal(groupe.status, 0, groupe.stderr)
      assert.match(groupe.stdout, /0 commit contrôlé/)
      const absent = lancer(['--base'])
      assert.equal(absent.status, 1)
      assert.match(absent.stderr, /valeur absente/)
    })
  })
})
