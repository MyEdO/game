import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CARACTERES_PAR_TOKEN, PORTEUR_DU_PLAFOND, PORTE_DE_BUDGET, controlerBudgetDeLaPlage,
  estCheminDuBudget, importsDe, ligneDeDescription, mesurerBudget, postesQuiGrossissent, refusDeBudget,
} from './budget-contexte.mjs'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { instanceDeDepot, sousGitFeint } from './lib/depotGabarit.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'
import { spawnSync } from 'node:child_process'
import { fermetureSurDisque } from './lib/porteDEre.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** La porte de budget du disque, que le socle d'un dépôt forgé porte : son tronc est son ère (#2503). */
const PORTE_SUR_DISQUE = Object.fromEntries(fermetureSurDisque(PORTE_DE_BUDGET.module))

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

  test('le budget vivant contrôle la plage effective de branche ou de file', async () => {
    const resultat = await controlerBudgetDeLaPlage({ cwd: RACINE })
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

  test('#2503 deux lignes `CLIQUET:` pour le porteur du plafond, dont une JUSTE, sont refusées (`mesuresNonCouvertes`)', () => {
    const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
    const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
    const message = `feat: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +1024 — une règle de routage neuve, validée\nCLIQUET: ${PORTEUR_DU_PLAFOND} +7 — une seconde ligne qui laisserait choisir`
    const refus = refusDeBudget({ mesure, reference, message })
    assert.ok(refus, 'deux lignes laisseraient choisir la bonne')
    assert.match(refus.reason, /le message porte 2 lignes \(\+1024, \+7\) — une seule par fichier/)
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
  const fixture = async (fichiers, fn) => {
    const { racine, sha } = instanceDeDepot({ fichiers: { ...PORTE_SUR_DISQUE, ...fichiers } })
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
    try { await fn({ racine, sha, git, ecrire, commit, controle }) }
    finally { rmSync(racine, { recursive: true, force: true }) }
  }
  const declare = (n) => `docs: contexte\n\nCLIQUET: ${PORTEUR_DU_PLAFOND} +${n} — nouvelle instruction nécessaire au démarrage`

  test('hausse couverte, non couverte et déclaration erronée : chaque commit est jugé', async () => {
    await fixture({ 'CLAUDE.md': 'abc\n' }, async ({ commit, controle }) => {
      commit('CLAUDE.md', 'abcd\n', declare(1))
      assert.equal((await controle()).refus.length, 0)
      const manque = commit('CLAUDE.md', 'abcde\n')
      const mauvais = commit('CLAUDE.md', 'abcdef\n', declare(2))
      const resultat = await controle()
      assert.equal(resultat.commitsControles, 3)
      assert.deepEqual(resultat.refus.map((r) => r.sha), [manque, mauvais])
      assert.match(resultat.refus[1].reason, /annonce `\+2`, pas \+1/)
    })
  })

  test('une baisse resserre la référence : la remontée sous le total initial est refusée', async () => {
    await fixture({ 'CLAUDE.md': 'abcdef\n' }, async ({ commit, controle }) => {
      commit('CLAUDE.md', 'a\n')
      assert.equal((await controle()).refus.length, 0)
      commit('CLAUDE.md', 'abc\n')
      const resultat = await controle()
      assert.equal(resultat.refus.length, 1)
      assert.match(resultat.refus[0].reason, /soit \+2/)
    })
  })

  test('imports ajoutés et retirés : le périmètre suit les deux images', async () => {
    await fixture({ 'CLAUDE.md': 'titre\n', 'a.md': 'abcd\n' }, async ({ commit, controle }) => {
      commit('CLAUDE.md', '@a.md\n')
      const resultat = await controle()
      assert.equal(resultat.refus.length, 1)
      assert.match(resultat.refus[0].reason, /a\.md \+5 octets/)
    })
    await fixture({ 'CLAUDE.md': '@a.md\n', 'a.md': 'abcd\n' }, async ({ commit, controle }) => {
      commit('CLAUDE.md', 'titre\n')
      commit('a.md', 'abcdefgh\n')
      assert.deepEqual(await controle(), { commitsControles: 1, refus: [], notes: [] })
    })
  })

  test('supprimer une description allège ; augmenter le corps seul ne grossit pas', async () => {
    await fixture({ 'CLAUDE.md': 'titre\n', '.claude/agents/a.md': '---\ndescription: abc\n---\ncorps\n' }, async ({ commit, controle }) => {
      commit('.claude/agents/a.md', '---\ndescription: abc\n---\ncorps beaucoup plus long\n')
      commit('.claude/agents/a.md', '---\nname: a\n---\ncorps\n')
      assert.deepEqual(await controle(), { commitsControles: 2, refus: [], notes: [] })
    })
  })

  test('fusion propre : le contexte des parents ne se paie pas une seconde fois ; résolution : référence automatique', async () => {
    await fixture({ 'CLAUDE.md': 'titre\n' }, async ({ sha, git, commit, controle }) => {
      git('checkout', '-b', 'autre', sha)
      commit('CLAUDE.md', 'titre agrandi\n', declare(8))
      git('checkout', '-b', 'branche', sha)
      commit('notes.md', 'note\n')
      git('merge', '--no-ff', 'autre', '-m', 'fusion propre')
      assert.deepEqual(await controle(), { commitsControles: 1, refus: [], notes: [] })
      const propre = git('rev-parse', 'HEAD')
      git('checkout', '-b', 'resolue', sha)
      commit('notes2.md', 'note\n')
      git('merge', '--no-commit', '--no-ff', 'autre')
      commit('CLAUDE.md', 'titre agrandi encore\n', 'fusion résolue')
      const resultat = await controle()
      assert.equal(resultat.refus.length, 1)
      assert.match(resultat.refus[0].reason, /soit \+7/)
      assert.deepEqual(await controle(propre, propre), { commitsControles: 0, refus: [], notes: [] })
    })
  })

  test('borne absente et panne de lecture ne rendent jamais un succès vide', async () => {
    await fixture({ 'CLAUDE.md': 'abc\n' }, async ({ commit, controle }) => {
      commit('CLAUDE.md', 'abcd\n')
      await assert.rejects(controle('inconnue'), /borne|plage.*illisible/)
      await assert.rejects(controle(null), /base.*absente/)
      await sousGitFeint([{ si: ['cat-file', '--batch'], status: 1, stderr: 'panne budget' }], () =>
        assert.rejects(controle(), /panne budget/))
    })
  })

  test('le driver lit les bornes explicites et la base du groupe de fusion ; une plage vide est dite', async () => {
    await fixture({ 'CLAUDE.md': 'abc\n' }, async ({ racine, sha, git, commit }) => {
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

// ── #2503 : chaque commit de la plage jugé par la porte de budget de son ÈRE (`groupesParEre`) ───────
// Les portes forgées tiennent le contrat d'entrée (`importsDe`, `estCheminDuBudget`, `mesurerBudget`,
// `refusDeBudget`) en quelques lignes : CLAUDE.md compté en `lignes` ou en `octets`, la ligne `CLIQUET:`
// lue `une` seule, `plusieurs`, ou jamais exigée (`muette`).
describe('budget de plage — ÈRE (#2503)', () => {
  const MODULE = PORTE_DE_BUDGET.module
  const porteForgee = ({ poids, cliquet }) => [
    `const PORTEUR = ${JSON.stringify(PORTEUR_DU_PLAFOND)}`,
    'export const importsDe = () => []',
    "export const estCheminDuBudget = (chemin) => chemin === 'CLAUDE.md'",
    'export function mesurerBudget(_racine, { lireTout }) {',
    "  const texte = lireTout(['CLAUDE.md']).get('CLAUDE.md') ?? ''",
    `  const total = ${poids === 'lignes' ? "texte.split('\\n').length - 1" : 'texte.length'}`,
    "  return { postes: [{ nom: 'CLAUDE.md', octets: total }], total }",
    '}',
    'export function refusDeBudget({ reference, mesure, message }) {',
    '  const montee = mesure.total - reference.total',
    '  if (montee <= 0) return null',
    "  const lus = [...String(message).matchAll(/^CLIQUET: (\\S+) \\+(\\d+) — .{20,}$/gm)].filter((m) => m[1] === PORTEUR).map((m) => Number(m[2]))",
    `  if (${{ une: 'lus.length === 1 && lus[0] === montee', plusieurs: 'lus.includes(montee)', muette: 'true' }[cliquet]}) return null`,
    "  return { decision: 'deny', reason: `+${montee}` }",
    '}',
    '',
  ].join('\n')
  const EN_LIGNES = porteForgee({ poids: 'lignes', cliquet: 'une' })
  const EN_OCTETS = porteForgee({ poids: 'octets', cliquet: 'une' })
  const declare = (...n) => `docs: contexte\n\n${n.map((k) => `CLIQUET: ${PORTEUR_DU_PLAFOND} +${k} — nouvelle instruction nécessaire au démarrage`).join('\n')}`

  /** Un dépôt jetable dont le socle porte `fichiers` ; `poser(fichiers, message)` commet sur la branche courante. */
  const depotDEres = async (fichiers, fn) => {
    const { racine, sha: socle } = instanceDeDepot({ fichiers: { 'CLAUDE.md': 'a\n', ...fichiers } })
    const git = gitDe(racine, { net: true })
    const poser = (aPoser, message) => {
      for (const [rel, texte] of Object.entries(aPoser)) {
        mkdirSync(dirname(resolve(racine, rel)), { recursive: true })
        writeFileSync(resolve(racine, rel), texte)
        git('add', '--', rel)
      }
      git('commit', '-m', message)
      return git('rev-parse', 'HEAD')
    }
    const controle = (debut, fin) => controlerBudgetDeLaPlage({ cwd: racine, debut, fin })
    const verdict = (vu) => vu.refus.map((r) => [r.sha, r.ere])
    try { await fn({ socle, git, poser, controle, verdict }) }
    finally { rmSync(racine, { recursive: true, force: true }) }
  }

  test('compte qui MONTE : né sous T0 (lignes), le commit garde sa porte quand T1 compte les octets ; après la fusion de T1, il est refusé', async () => {
    await depotDEres({ [MODULE]: EN_LIGNES }, async ({ socle, git, poser, controle, verdict }) => {
      git('checkout', '-q', '-b', 'chantier')
      const avant = poser({ 'CLAUDE.md': 'a\nabcdefgh\n' }, declare(1))
      git('checkout', '-q', 'main')
      const t1 = poser({ [MODULE]: EN_OCTETS }, 'T1 : la porte compte les octets')
      git('checkout', '-q', 'chantier')
      assert.deepEqual(verdict(await controle(socle, avant)), [], 'jugé par la porte de son ère T0')
      git('merge', '-q', '--no-ff', '-m', 'fusion de T1', 'main')
      const apres = poser({ 'CLAUDE.md': 'a\nabcdefgh\nxy\n' }, declare(1))
      assert.deepEqual(verdict(await controle(t1, apres)), [[apres, t1]])
    })
  })

  test('compte qui BAISSE : la déclaration en octets passe dans l’ère T0, la même est refusée dans l’ère T1 (lignes)', async () => {
    await depotDEres({ [MODULE]: EN_OCTETS }, async ({ socle, git, poser, controle, verdict }) => {
      git('checkout', '-q', '-b', 'chantier')
      const sousT0 = poser({ 'CLAUDE.md': 'a\nab\n' }, declare(3))
      assert.deepEqual(verdict(await controle(socle, sousT0)), [])
      git('checkout', '-q', 'main')
      const t1 = poser({ [MODULE]: EN_LIGNES }, 'T1 : la porte compte les lignes')
      git('checkout', '-q', '-b', 'chantier-t1')
      const sousT1 = poser({ 'CLAUDE.md': 'a\nab\n' }, declare(3))
      assert.deepEqual(verdict(await controle(t1, sousT1)), [[sousT1, t1]])
    })
  })

  test('une branche qui AFFAIBLIT la porte (c1), grossit en silence (c2) puis la RESTAURE (c3) voit c2 refusé', async () => {
    await depotDEres({ [MODULE]: EN_LIGNES }, async ({ socle, git, poser, controle, verdict }) => {
      git('checkout', '-q', '-b', 'chantier')
      poser({ [MODULE]: porteForgee({ poids: 'lignes', cliquet: 'muette' }) }, 'c1 : la porte ne refuse plus rien')
      const c2 = poser({ 'CLAUDE.md': 'a\nb\n' }, 'c2 : CLAUDE.md grandit, muet')
      const c3 = poser({ [MODULE]: EN_LIGNES }, 'c3 : la porte restaurée')
      assert.deepEqual(verdict(await controle(socle, c3)), [[c2, socle]])
    })
  })

  test('une ère ANTÉRIEURE à la porte : nommée, ses commits non jugés', async () => {
    await depotDEres({}, async ({ socle, poser, controle }) => {
      const c1 = poser({ 'CLAUDE.md': 'a\nb\n' }, 'CLAUDE.md grandit avant la porte')
      assert.deepEqual(await controle(socle, c1), {
        commitsControles: 0,
        refus: [],
        notes: [`${socle.slice(0, 9)} antérieure à la porte \`${MODULE}\` : ses commits ne sont pas jugés`],
      })
    })
  })

  test('deux lignes `CLIQUET:` dont une juste : acceptées dans l’ère qui les lisait ainsi, refusées dans l’ère de `mesuresNonCouvertes`', async () => {
    await depotDEres({ [MODULE]: porteForgee({ poids: 'octets', cliquet: 'plusieurs' }) }, async ({ socle, git, poser, controle, verdict }) => {
      const message = declare(9, 7)
      git('checkout', '-q', '-b', 'chantier')
      const enVol = poser({ 'CLAUDE.md': 'a\nabcdefgh\n' }, message)
      assert.deepEqual(verdict(await controle(socle, enVol)), [], 'la branche en vol garde la porte de son ère')
      git('checkout', '-q', 'main')
      const t1 = poser(PORTE_SUR_DISQUE, 'T1 : la porte juge par `mesuresNonCouvertes`')
      git('checkout', '-q', '-b', 'chantier-t1')
      const sousT1 = poser({ 'CLAUDE.md': 'a\nabcdefgh\n' }, message)
      const vu = await controle(t1, sousT1)
      assert.deepEqual(verdict(vu), [[sousT1, t1]])
      assert.match(vu.refus[0].reason, /le message porte 2 lignes \(\+9, \+7\) — une seule par fichier/)
    })
  })
})
