// Garde BLOQUANTE des nouveaux composants d'UI et de rendu (#1318 V5, périmètre #1679 L1a) : le hook
// est lancé POUR DE VRAI (spawnSync + stdin JSON), aucun fichier n'est écrit sous src/ — les chemins
// testés sont des fantômes qui n'existent pas (c'est précisément l'état qui déclenche la garde).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  estComposantUI, estDeclare, relPath, cheminEntree, maquetteEntree, REGISTRE_DEFAUT, cheminRegistre,
  MANIFESTE_PRIMITIVES,
} from './new-src-file-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, 'scripts', 'hooks', 'new-src-file-guard.mjs')
// Lecteurs Windows ASSEMBLÉS à l'exécution : ce fichier ne porte aucun chemin absolu littéral, il
// reste donc soumis à `src/portable-paths-guard.test.ts` comme le reste de `scripts/**`.
const BS = String.fromCharCode(92)
const LECTEUR_C = 'C' + ':'
const LECTEUR_D = 'D' + ':'
const FANTOME = 'src/ui/FantomeGardeV5.tsx'
const FANTOME_ISO = 'src/gameIso/stage/FantomeStageV5.tsx'

function lanceAvec(tool_input, env = {}) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input }),
    encoding: 'utf8',
    cwd: REPO,
    env: { ...process.env, ...env },
  })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '' }
}
const lance = (file_path, env = {}) => lanceAvec({ file_path }, env)

/** Joue `fn` sur une COPIE du registre, posée sous `os.tmpdir()` et portant une entrée de plus.
 *  Le fichier committé `scripts/hooks/ecrans-ui.json` n'est jamais touché : le muter puis le remettre
 *  dans un `finally` a échoué le 2026-09-04 (`UNKNOWN: unknown error`), laissant une entrée fantôme
 *  dans l'arbre, deux tests rouges en cascade et un arbre sale pour toutes les gates. */
function avecEntree(entree, fn) {
  const registre = JSON.parse(readFileSync(REGISTRE_DEFAUT, 'utf8'))
  registre.ecrans = [...registre.ecrans, entree]
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-ecrans-'))
  const copie = join(dossier, 'ecrans-ui.json')
  writeFileSync(copie, JSON.stringify(registre, null, 2) + '\n')
  try {
    return fn({ WFRP_REGISTRE_ECRANS: copie })
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

test('le fantôme de test n’existe pas (sinon la garde ne serait jamais sollicitée)', () => {
  assert.equal(existsSync(join(REPO, FANTOME)), false)
  assert.equal(existsSync(join(REPO, FANTOME_ISO)), false)
})

test('composant d’UI NEUF non déclaré → sortie non-zéro + geste attendu dans le message', () => {
  const r = lance(join(REPO, FANTOME))
  assert.notEqual(r.code, 0, 'la garde doit BLOQUER (statut non nul)')
  assert.match(r.err, /NON DÉCLARÉ/)
  assert.match(r.err, /src\/data\/primitives\.manifest\.json/)
  assert.match(r.err, /scripts\/hooks\/ecrans-ui\.json/)
  assert.match(r.err, /maquette validée EN PRÉSENCE/)
  assert.match(r.err, /SKIP_NEW_SRC_GUARD=1/)
  assert.equal(r.out.trim(), '', 'un refus n’injecte pas de contexte')
})

test('un .tsx NEUF de src/gameIso est BLOQUÉ au même titre (32 .tsx mesurés, aucune exception)', () => {
  const r = lance(join(REPO, FANTOME_ISO))
  assert.notEqual(r.code, 0, 'src/gameIso relève du régime bloquant')
  assert.match(r.err, /NON DÉCLARÉ/)
  assert.equal(estComposantUI('src/gameIso/stage/X.tsx'), true)
  assert.equal(estComposantUI('src/gameIso/rig/composeRig.tsx'), true)
  assert.equal(estComposantUI('src/gameIso/stage/X.test.tsx'), false)
  assert.equal(estComposantUI('src/gameIso/builders/mur.ts'), false)
})

test('un composant qui EXISTE déjà (édition, pas création) ne déclenche rien', () => {
  const inscrit = cheminEntree(JSON.parse(readFileSync(REGISTRE_DEFAUT, 'utf8')).ecrans[0])
  const r = lance(join(REPO, inscrit))
  assert.equal(r.code, 0)
  assert.equal(r.out.trim(), '')
  assert.equal(r.err.trim(), '')
})

test('primitive du MANIFESTE et écran du stock sont tous deux « déclarés »', () => {
  const manifeste = readFileSync(MANIFESTE_PRIMITIVES, 'utf8')
  const registre = JSON.parse(readFileSync(REGISTRE_DEFAUT, 'utf8'))
  assert.ok(estDeclare('src/ui/NumberField.tsx', manifeste, registre), 'primitive du manifeste')
  assert.ok(estDeclare(cheminEntree(registre.ecrans[0]), manifeste, registre, true), 'écran du stock, déjà dans l’arbre')
  assert.ok(!estDeclare(FANTOME, manifeste, registre))
})

test('une entrée en CHAÎNE ne déclare pas un fichier NEUF (le stock du 2026-08-16 ne croît pas)', () => {
  avecEntree(FANTOME, (env) => {
    const r = lance(join(REPO, FANTOME), env)
    assert.notEqual(r.code, 0, 'inscrire une chaîne ne remplace pas la maquette validée')
    assert.match(r.err, /NON DÉCLARÉ/)
  })
})

test('une entrée OBJET SANS maquette est refusée ; AVEC maquette, la création passe', () => {
  avecEntree({ fichier: FANTOME, maquette: '' }, (env) => {
    assert.notEqual(lance(join(REPO, FANTOME), env).code, 0, 'objet sans maquette = pas de déclaration')
  })
  avecEntree({ fichier: FANTOME, maquette: 'validée en présence 2026-09-02 (session L1a)' }, (env) => {
    const r = lance(join(REPO, FANTOME), env)
    assert.equal(r.code, 0)
    assert.match(r.out, /additionalContext/, 'le rappel anti-réinvention reste injecté')
  })
})

test('une maquette de RÉSERVATION (« TODO ») ne déclare rien', () => {
  for (const marque of ['TODO', 'todo : à dessiner', 'à faire', 'TBD', '—', '?']) {
    assert.equal(maquetteEntree({ fichier: FANTOME, maquette: marque }), '', marque)
    avecEntree({ fichier: FANTOME, maquette: marque }, (env) => {
      assert.notEqual(lance(join(REPO, FANTOME), env).code, 0, `réservation acceptée pour maquette : ${marque}`)
    })
  }
  // Une trace qui NOMME où la validation a eu lieu passe, même si elle parle d'un reste à faire.
  assert.notEqual(maquetteEntree({ fichier: FANTOME, maquette: 'validée en présence 2026-09-02, reste à faire : le pied' }), '')
})

test('échappement SKIP_NEW_SRC_GUARD=1 → passe, et LOGGUE la dérogation', () => {
  const r = lance(join(REPO, FANTOME), { SKIP_NEW_SRC_GUARD: '1' })
  assert.equal(r.code, 0)
  assert.match(r.err, /dérogation prise/)
  assert.match(r.err, new RegExp(FANTOME))
  assert.match(r.out, /additionalContext/)
})

test('un harnais .test.tsx et un fichier hors src/ui ne sont pas bloqués', () => {
  assert.equal(estComposantUI('src/ui/Machin.test.tsx'), false)
  assert.equal(estComposantUI('src/state/machin.ts'), false)
  assert.equal(estComposantUI('src/ui/sous/Machin.tsx'), true)
  const r = lance(join(REPO, 'src/state/fantome-garde-v5.ts'))
  assert.equal(r.code, 0)
  assert.match(r.out, /additionalContext/) // le régime non bloquant reste en place
})

test('relPath : chemin POSIX relatif à la RACINE du dépôt, null hors du dépôt', () => {
  assert.equal(relPath(join(REPO, 'src', 'ui', 'A.tsx')), 'src/ui/A.tsx')
  assert.equal(relPath('src/ui/A.tsx'), 'src/ui/A.tsx') // relatif → résolu depuis la racine
  assert.equal(relPath('/autre-projet/src/ui/A.tsx', '/le/depot'), null)
  assert.equal(
    relPath([LECTEUR_D, 'autre-projet', 'src', 'ui', 'A.tsx'].join(BS), [LECTEUR_C, 'le', 'depot'].join(BS)),
    null,
  )
})

test('un chemin HORS du dépôt (autre projet) n’est jamais bloqué', () => {
  const r = lance(LECTEUR_D + '/autre-projet/src/ui/FantomeExterne.tsx')
  assert.equal(r.code, 0)
  assert.equal(r.out.trim(), '')
  assert.equal(r.err.trim(), '')
})

test('ctx_patch op=create porte le chemin en `path` : même refus que Write', () => {
  const r = lanceAvec({ op: 'create', path: join(REPO, FANTOME), new_text: 'export {}' })
  assert.notEqual(r.code, 0)
  assert.match(r.err, /NON DÉCLARÉ/)
})

test('les DEUX surfaces matchent Write ET mcp__lean-ctx__ctx_patch (sinon la garde passe à vide)', () => {
  for (const surface of ['.claude/settings.json', '.codex/hooks.json']) {
    const config = JSON.parse(readFileSync(join(REPO, surface), 'utf8'))
    const matchers = (config.hooks?.PreToolUse ?? [])
      .filter((e) => (e.hooks ?? []).some((h) => String(h.command ?? '').includes('new-src-file-guard.mjs')))
      .map((e) => String(e.matcher ?? ''))
    assert.ok(matchers.length > 0, `${surface} : hook non câblé`)
    for (const canal of ['Write', 'mcp__lean-ctx__ctx_patch'])
      assert.ok(matchers.some((m) => m.split('|').includes(canal)), `${surface} : canal ${canal} non matché`)
  }
})

test('registre ILLISIBLE → refus fail-closed dont le corps dit de RÉPARER, pas d’inscrire', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-ecrans-'))
  const casse = join(dossier, 'ecrans-ui.json')
  writeFileSync(casse, '{ ceci n’est pas du JSON')
  try {
    const r = lance(join(REPO, FANTOME), { WFRP_REGISTRE_ECRANS: casse })
    assert.notEqual(r.code, 0)
    assert.match(r.err, /ILLISIBLE/)
    assert.match(r.err, /réparer d'abord/)
    assert.doesNotMatch(r.err, /ordre alphabétique/, 'le corps « ajouter une ligne » est inopérant sur un JSON cassé')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('le registre COMMITTÉ reste le défaut, et rien de ce test ne l’écrit', () => {
  assert.equal(cheminRegistre({}), REGISTRE_DEFAUT)
  assert.equal(cheminRegistre({ WFRP_REGISTRE_ECRANS: 'X' }), 'X')
})

test('le registre est trié, sans doublon SUR LA CLEF NORMALISÉE, et ne cite que des composants existants', () => {
  const { ecrans } = JSON.parse(readFileSync(REGISTRE_DEFAUT, 'utf8'))
  // Le tri/dédoublonnage se fait sur le CHEMIN : deux objets se comparent en « [object Object] »
  // (tri vacueux) et se distinguent par IDENTITÉ dans un Set (doublon invisible) — mesuré.
  const clefs = ecrans.map(cheminEntree)
  assert.deepEqual(clefs, [...clefs].sort(), 'registre non trié (diffs illisibles)')
  assert.equal(new Set(clefs).size, clefs.length, 'doublon dans le registre')
  for (const entree of ecrans) {
    const f = cheminEntree(entree)
    assert.ok(estComposantUI(f), `${f} : pas un composant d'UI`)
    assert.ok(existsSync(join(REPO, f)), `${f} : inscrit mais absent de l'arbre`)
    if (typeof entree !== 'string')
      assert.notEqual(maquetteEntree(entree), '', `${f} : entrée objet sans trace de maquette validée`)
  }
})

test('CLIQUET : le stock d’entrées en CHAÎNE (207 mesurées le 2026-08-16) décroît, jamais l’inverse', () => {
  const { ecrans } = JSON.parse(readFileSync(REGISTRE_DEFAUT, 'utf8'))
  const chaines = ecrans.filter((e) => typeof e === 'string').length
  assert.ok(chaines <= 207, `stock legacy en hausse : ${chaines} > 207 — un écran NEUF s'inscrit en objet {fichier, maquette}`)
})

test('le tri sur la clef normalisée MORD sur un registre mixte désordonné (cas planté)', () => {
  const mixte = ['src/ui/ActiveModal.tsx', { fichier: 'src/ui/AAA.tsx', maquette: 'x' }]
  const clefs = mixte.map(cheminEntree)
  assert.notDeepEqual(clefs, [...clefs].sort(), 'un objet mal placé doit être VU par le tri')
  const doublons = [{ fichier: 'src/ui/X.tsx', maquette: 'a' }, { fichier: 'src/ui/X.tsx', maquette: 'b' }].map(cheminEntree)
  assert.notEqual(new Set(doublons).size, doublons.length, 'deux entrées du MÊME fichier doivent être VUES')
})
