// Sonde de la LOGIQUE de survie au rechargement du pipeline de capture (#1196, promue en test
// committé sous #1211) : classification des erreurs CDP (`isNavigationError`) et politique de
// rejeu (`withReloadRetry`). Tests PURS — aucun Chrome, aucun serveur : la session est un faux objet
// local ; seul process, PowerShell sous Windows, pour la commande CIM de `lireProcessus`. Lancé par `npm run test:recette`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAbsolute, join as joinPath, resolve as resolvePath } from 'node:path'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import {
  ALT,
  DELAI_EVALUATE,
  champParLibelle,
  clickItemByText,
  setAtelier,
  choisirCouleur,
  freezeTimeout,
  unfreezeTimeout,
  clickButtonByText,
  MOD_ALT,
  checkServer,
  frapperTouche,
  realKey,
  realKeyDown,
  realKeyUp,
  empreinteArbre,
  evaluate,
  expressionRestaurerStockage,
  instantanerStockage,
  isNavigationError,
  poserFichier,
  resoudreChrome,
  restaurerStockage,
  TARGET_NAVIGATED,
  verdictArbreGele,
  verdictArbreServi,
  withReloadRetry,
  attacherSession,
  capturerPion,
  cliquerSelecteur,
  consoleDuJournal,
  consoleGuard,
  descripteurSession,
  fermerSession,
  fichierDeSession,
  finDuTour,
  OPTIONS_SPAWN_CHROME,
  piloterCombat,
  prochainGeste,
  purgerProfilsOrphelins,
  nomDeProfil,
  pidDeProfil,
  selectOption,
  tenirSession,
  resoudreModales,
  cliquerAction,
  cliquerPremierOffert,
  brancherCdp,
  fichiersSurveilles,
  killChromeTree,
  lireProcessus,
  nettoyerALaSortie,
  waitForWsUrl,
  purgerProfil,
  leverApresNettoyage,
  waitForAppSilently,
  espionReseau,
  survoler,
  processusVivant,
  attendreSelecteur,
  avancerDeRounds,
  appelerWfrp,
  molette,
  deplierVers,
  typeInField,
  clicDroit,
  appuiLong,
  toucher,
  infobulleDe,
  dernierTelechargement,
  DOSSIER_TELECHARGEMENTS,
  lireIndexedDB,
  rechargerEtAttendreMenu,
  shot,
  verdictDebordement,
  attendreServeur,
  causeDeServeur,
  mesurerProvenance,
  ouvrirFiche,
  ATTRIBUTS_VOLATILS,
  geste,
  clic,
  frappe,
} from './lib.mjs'
import { ENTETE_RACINE } from '../port-dev.mjs'
import { JSDOM } from 'jsdom'
import * as kitRecette from './lib.mjs'
import { demarrer } from './setup.mjs'
import { recette, squelette } from './gabarit.mjs'

/** La socket factice d'une session de test : la session ne l'expose pas (`brancherCdp`), le test la
 *  garde. */
const sockets = new WeakMap()
const socketDe = (session) => sockets.get(session)

/** Session BRANCHÉE (`brancherCdp`) sur une socket factice : chaque appel CDP, `Input` compris (émis
 *  par `geste` et `frappe`), est servi par `socketDe(session).gerer(methode, params)`, qu'un test peut
 *  envelopper. `envoyes` garde chaque message parti sur la socket. */
function brancherFactice(gerer) {
  const ecoutes = { message: [], close: [] }
  const ws = {
    gerer,
    envoyes: [],
    readyState: WebSocket.OPEN,
    addEventListener: (t, fn) => ecoutes[t].push(fn),
    send(brut) {
      const m = JSON.parse(brut)
      ws.envoyes.push(m)
      Promise.resolve()
        .then(() => ws.gerer(m.method, m.params ?? {}))
        .then((result) => ({ id: m.id, result: result ?? {} }), (e) => ({ id: m.id, error: { message: e.message } }))
        .then((r) => ecoutes.message.forEach((fn) => fn({ data: JSON.stringify(r) })))
    },
  }
  const session = brancherCdp(ws)
  sockets.set(session, ws)
  return session
}

/** Session factice : `evaluate` (via `rpc`) répond « app prête » immédiatement, aucun réseau. */
function fakeSession() {
  return {
    contextCleared: false,
    rpc: async () => ({ result: { value: true } }),
  }
}

const err = (message) => new Error(message)

for (const outil of ['shot', 'capturerPion']) {
  test('destination capture : ' + outil + ' omis écrit au temporaire canonique, relatif refusé avant événement', async () => {
    assert.ok(resolvePath(kitRecette.DOSSIER_CAPTURES).toLowerCase().startsWith(resolvePath(os.tmpdir()).toLowerCase()), 'défaut hors arbre au temporaire')
    assert.ok(!resolvePath(kitRecette.DOSSIER_CAPTURES).toLowerCase().startsWith(resolvePath(process.cwd()).toLowerCase()), 'aucune capture par défaut dans l’arbre')
    const nom = 'capture-kit-' + outil + '-' + process.pid + '-' + Date.now()
    const appels = []
    const session = { rpc: async (m) => {
      appels.push(m)
      return m === 'Page.captureScreenshot' ? { data: Buffer.from('PNG-test').toString('base64') } : { result: { value: { x: 100, y: 100 } } }
    } }
    let chemin
    try {
      chemin = outil === 'shot' ? await shot(session, nom) : await capturerPion(session, 'h1', { nom })
      assert.equal(resolvePath(chemin), resolvePath(joinPath(kitRecette.DOSSIER_CAPTURES, nom + '.png')))
      assert.ok(isAbsolute(chemin))
      assert.ok(existsSync(chemin))
      appels.length = 0
      await assert.rejects(() => outil === 'shot'
        ? shot(session, nom, '.', { neutraliser: true })
        : capturerPion(session, 'h1', { nom, dir: '.' }), /dossier.*absolu/)
      assert.deepEqual(appels, [])
    } finally {
      if (chemin) rmSync(chemin, { force: true })
      assert.equal(existsSync(resolvePath(nom + '.png')), false)
    }
  })
}

test('inventaire visible : menus, ancêtres CSS, inert, viewport, clip et état fermé sans geste', async () => {
  const { dom, doc, etat, session } = pagePilotee('<div id="zone"><details><summary>Menu replié</summary><button>Secret</button></details><button id="actif" aria-label="Nom ARIA">42</button><button disabled>Fermé</button><button aria-disabled="true">Refusé</button><div hidden><button>Masqué HTML</button></div><div style="display:none"><button>Masqué CSS</button></div><div style="visibility:hidden"><button>Invisible</button></div><div style="opacity:0"><button>Transparent</button></div><div inert><button>Inerte</button></div><button id="loin">Hors viewport</button><div id="clip" style="overflow-x:hidden;overflow-y:hidden"><button id="rogné">Hors clip</button></div></div>')
  dom.window.Element.prototype.getBoundingClientRect = function () {
    const x = this.id === 'loin' ? 2000 : this.id === 'rogné' ? 100 : 10
    return { x, y: 10, left: x, top: 10, right: x + 50, bottom: 30, width: 50, height: 20 }
  }
  const scrolls = []
  dom.window.Element.prototype.scrollIntoView = function () { scrolls.push(this) }
  const controles = await kitRecette.controlesVisibles(session, { dans: '#zone' })
  assert.deepEqual([...controles].map((c) => c.nom), ['Menu replié', 'Nom ARIA', 'Fermé', 'Refusé'])
  assert.deepEqual([...controles].map((c) => c.ouvert), [true, true, false, false])
  assert.equal(controles[1].aria.label, 'Nom ARIA')
  assert.equal(controles[1].rect.width, 50)
  assert.deepEqual(etat.emis, [])
  assert.deepEqual(scrolls, [])
  assert.equal(doc.querySelector('details').open, false)
})

test('navigation prête : API et chunk retardés, écran réel exigé, échéance diagnostiquée', async () => {
  const { dom, session } = sessionSurDom('<div class="app app-menu"><div class="menu-tools"></div></div>')
  const doc = dom.window.document
  const jeu = { screen: 'menu' }
  dom.window.__game = { getState: () => jeu }
  setTimeout(() => {
    dom.window.__wfrp = { screen: (screen) => {
      jeu.screen = screen
      doc.querySelector('.app').className = 'app app-' + screen
      doc.querySelector('.app').innerHTML = '<div class="lazy-fallback"></div>'
      setTimeout(() => doc.querySelector('.lazy-fallback').remove(), 30)
    } }
  }, 15)
  await kitRecette.gotoScreen(session, 'compendium', { settleMs: 0, timeoutMs: 500, intervalMs: 5 })
  assert.equal(jeu.screen, 'compendium')
  assert.equal(doc.querySelector('.lazy-fallback'), null)
  dom.window.__wfrp.screen = (screen) => { jeu.screen = screen }
  await assert.rejects(() => kitRecette.gotoScreen(session, 'creator', { settleMs: 0, timeoutMs: 25, intervalMs: 5 }), /gotoScreen.*creator.*écran.*compendium/)
})

test('rangée marchande : texte hors table rend ambiguïté nommant les rangées retenues, scope départage', async () => {
  const { etat, session } = pagePilotee('<div id="marché"><p>Lance</p><table><tbody><tr id="lance"><td>Lance</td><td><button>Ajouter</button></td></tr><tr id="épée"><td>Épée</td><td><button>Ajouter</button></td></tr></tbody></table></div>')
  await assert.rejects(() => clickButtonByText(session, 'Ajouter', { rangee: 'Lance' }), /ambiguës.*rangées retenues.*Lance.*Épée/)
  assert.deepEqual(etat.emis, [])
  await clickButtonByText(session, 'Ajouter', { rangee: 'Lance', dans: 'table' })
  assert.deepEqual(etat.cliques, ['Ajouter'])
})

test('CLI capture : trois parseurs partagent le temporaire et refusent un chemin relatif avant ouverture', async () => {
  for (const fichier of ['./shot-screen.mjs', './shot-editor-lower-layer-gabarit.mjs', './intentions-portee.mjs']) {
    const { parseArgs } = await import(fichier)
    const args = fichier === './shot-screen.mjs' ? ['--screen', 'menu'] : []
    assert.equal(parseArgs(args).out, kitRecette.DOSSIER_CAPTURES)
    assert.throws(() => parseArgs([...args, '--out', '.']), /dossier.*absolu/)
    const absolu = kitRecette.DOSSIER_CAPTURES.replaceAll('\\', '/')
    assert.equal(parseArgs([...args, '--out', absolu]).out, absolu)
  }
})

test('nom ARIA vide : contenu valide retrouvé avant title', async () => {
  const { etat, session } = pagePilotee('<button aria-label="" title="Autre nom">Nom valide</button>')
  await clickButtonByText(session, 'Nom valide')
  assert.deepEqual(etat.cliques, ['Nom valide'])
})

for (const interaction of ['choix', 'quantite']) {
  test('interaction canonique : ' + interaction + ' ready refuse avant Continuer, arret observe sans geste', async () => {
    const { dom, doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Décision"><button>Continuer</button></div></div>', { cascade: true })
    dom.window.__wfrp = { auto: () => ({ activeModal: 'pendingCascade', cascade: { id: 'fixture-step', kind: 'defenseJet', interaction, ready: true, chosen: 'defaut', amount: 1 } }) }
    doc.querySelector('button').onclick = () => doc.querySelector('.modal-overlay').remove()
    await assert.rejects(() => resoudreModales(session, 'decision', { pauseMs: 1 }), new RegExp('interaction joueur « ' + interaction + ' ».*Décision.*Continuer'))
    assert.deepEqual(etat.emis, [])
    let identite
    await resoudreModales(session, 'observer', { arret: (i) => { identite = i; return true } })
    assert.equal(identite.interaction, interaction)
    assert.equal(identite.ready, true)
    assert.deepEqual(etat.emis, [])
    assert.ok(doc.querySelector('.modal-overlay'))
  })
}

for (const [cas, metadata] of [
  ['absente', null],
  ['interaction vide', { id: 'fixture-step', kind: 'defenseJet', interaction: '', ready: true, chosen: null, amount: null }],
  ['autre id', { id: 'autre-etape', kind: 'defenseJet', interaction: 'affichage', ready: true, chosen: null, amount: null }],
]) {
  test('observation canonique : ' + cas + ' refuse avant Continuer malgré portée explicite', async () => {
    const { dom, doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Décision"><button>Continuer</button></div></div>', { cascade: true })
    dom.window.__wfrp = { auto: () => ({ activeModal: 'pendingCascade', cascade: metadata }) }
    doc.querySelector('button').onclick = () => doc.querySelector('.modal-overlay').remove()
    await resoudreModales(session, 'observer', { dans: '.modal-overlay', arret: () => true })
    assert.deepEqual(etat.emis, [])
    await assert.rejects(() => resoudreModales(session, 'refuser', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 30 }), /observation canonique (absente|incohérente).*Décision/)
    assert.deepEqual(etat.emis, [])
    assert.ok(doc.querySelector('.modal-overlay'))
  })
}

// ---------------------------------------------------------------- classification

test('classification : le code TARGET_NAVIGATED marque l\'erreur rejouable', () => {
  const e = err('message quelconque sans motif reconnu')
  e.code = TARGET_NAVIGATED
  assert.equal(isNavigationError(e), true)
})

for (const message of [
  'Inspected target navigated or closed',
  'Execution context was destroyed.',
  'Cannot find context with specified id',
  'Target closed',
  'Session with given id not found',
  'No target with given id',
]) {
  test(`classification : « ${message} » est rejouable`, () => {
    assert.equal(isNavigationError(err(message)), true)
  })
}

test('classification : casse indifférente (les motifs CDP sont insensibles à la casse)', () => {
  assert.equal(isNavigationError(err('INSPECTED TARGET NAVIGATED OR CLOSED')), true)
})

test('classification : une lecture sur undefined/null ne prouve pas un rechargement', () => {
  assert.equal(isNavigationError(err("Cannot read properties of undefined (reading 'screen')")), false)
  assert.equal(isNavigationError(err("Cannot read properties of null (reading 'screen')")), false)
  assert.equal(isNavigationError(err("Cannot read properties of null (reading 'querySelectorAll')")), false)
})

test('classification : helper de DEV évaporé — window.__wfrp is not a function / undefined', () => {
  assert.equal(isNavigationError(err('window.__wfrp is not a function')), true)
  assert.equal(isNavigationError(err('window.__wfrp is undefined')), true)
})

test('classification : une CHAÎNE nue est classée sur son texte', () => {
  assert.equal(isNavigationError('Execution context was destroyed'), true)
  assert.equal(isNavigationError('bouton introuvable'), false)
})

test('classification : une erreur quelconque n\'est PAS rejouable', () => {
  assert.equal(isNavigationError(err('Condition jamais vraie après 8000ms : document.querySelector(".btn")')), false)
})

test('classification : absence d\'erreur ou message vide — pas rejouable', () => {
  assert.equal(isNavigationError(null), false)
  assert.equal(isNavigationError(undefined), false)
  assert.equal(isNavigationError(err('')), false)
})

// ---------------------------------------------------------------- politique de rejeu

test('withReloadRetry : une erreur rejouable est rejouée `tries` fois puis abandonnée, l\'erreur d\'origine en cause', async () => {
  const session = fakeSession()
  let calls = 0
  const origine = err('Inspected target navigated or closed')
  const retries = []
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, {
      tries: 3, timeoutMs: 100, onRetry: (e, i, n) => { retries.push([i, n]) },
    }),
    (e) => {
      assert.match(e.message, /3 tentatives épuisées/)
      assert.equal(e.cause, origine)
      assert.ok(e.message.includes(origine.stack))
      return true
    },
  )
  assert.equal(calls, 3)
  assert.deepEqual(retries, [[1, 3], [2, 3]])
})

test('withReloadRetry : une erreur NON rejouable remonte telle quelle, AUCUN rejeu', async () => {
  const session = fakeSession()
  let calls = 0
  const origine = err('bouton « Lancer » introuvable')
  let retried = false
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, {
      tries: 3, timeoutMs: 100, onRetry: () => { retried = true },
    }),
    (e) => e === origine,
  )
  assert.equal(calls, 1)
  assert.equal(retried, false)
})

test('withReloadRetry : le succès au 2e essai rend le résultat', async () => {
  const session = fakeSession()
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Execution context was destroyed')
    return 'capture ok'
  }, { tries: 3, timeoutMs: 100 })
  assert.equal(valeur, 'capture ok')
  assert.equal(calls, 2)
})

test('withReloadRetry : `resettle` remet l\'écran entre deux tentatives', async () => {
  const session = fakeSession()
  let calls = 0
  let resettles = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Target closed')
    return 42
  }, { tries: 3, timeoutMs: 100, resettle: () => { resettles++ } })
  assert.equal(valeur, 42)
  assert.equal(resettles, 1)
})

test('withReloadRetry : `contextCleared` déclenche le rejeu même sur une erreur non classée', async () => {
  const session = fakeSession()
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) { session.contextCleared = true; throw err('valeur inattendue : undefined') }
    return 'ok'
  }, { tries: 3, timeoutMs: 100 })
  assert.equal(valeur, 'ok')
  assert.equal(calls, 2)
})

test('withReloadRetry : le succès au 1er essai n\'appelle ni onRetry ni resettle', async () => {
  const session = fakeSession()
  let touched = 0
  const valeur = await withReloadRetry(session, async () => 'direct', {
    tries: 3, timeoutMs: 100, onRetry: () => { touched++ }, resettle: () => { touched++ },
  })
  assert.equal(valeur, 'direct')
  assert.equal(touched, 0)
})

// ------------------------------------------------- arbre servi / arbre gelé (#1679 L1c)

// Racines de sonde ASSEMBLÉES à l'exécution : ce fichier ne porte aucun chemin absolu littéral, il
// reste donc soumis à `src/portable-paths-guard.test.ts` comme le reste de `scripts/**`.
const RACINE_PARENTE = 'C' + ':/Users' + '/x/Foundry/Game'
const RACINE_SONDE = RACINE_PARENTE + '/.wt-1679'
const entete = (racine) => encodeURIComponent(racine.toLowerCase())
/** Motif d'un chemin cité par le refus : les `/` y sont échappés comme dans le message rendu. */
const motifChemin = (chemin) => chemin.toLowerCase().split('/').join('\\/')

test('arbre servi : en-tête ABSENT = refus (fail-closed, jamais un silence)', () => {
  const refus = verdictArbreServi(undefined, RACINE_SONDE)
  assert.match(refus, /ne publie pas l'en-tête/)
  assert.match(refus, /x-wfrp-racine/)
})

test('arbre servi : racine servie ≠ cwd = refus NOMMANT les deux arbres', () => {
  const refus = verdictArbreServi(entete(RACINE_PARENTE), RACINE_SONDE)
  assert.match(refus, /Arbre SERVI ≠ arbre courant/)
  assert.match(refus, new RegExp('sert « ' + motifChemin(RACINE_PARENTE) + ' »'))
  assert.match(refus, new RegExp('tourne dans\\s+« ' + motifChemin(RACINE_SONDE).replace('.wt', '\\.wt') + ' »'))
})

test('arbre servi : MÊME arbre écrit autrement (casse, backslash, slash final) = accepté', () => {
  const enWindows = ['C:', 'Users', 'x', 'Foundry', 'Game', '.wt-1679', ''].join(String.fromCharCode(92))
  assert.equal(verdictArbreServi(entete(RACINE_SONDE), enWindows), null)
  assert.equal(verdictArbreServi(encodeURIComponent(RACINE_SONDE.toUpperCase()), RACINE_SONDE), null)
})

test('checkServer : un serveur qui sert un AUTRE arbre est REFUSÉ (aucune session ouverte)', async () => {
  const recuperer = async () => ({
    ok: true,
    status: 200,
    headers: { get: (nom) => (nom === ENTETE_RACINE ? entete(RACINE_PARENTE) : null) },
  })
  await assert.rejects(
    () => checkServer('http://localhost:5173/', { recuperer, racineCourante: RACINE_SONDE }),
    (e) => /Arbre SERVI ≠ arbre courant/.test(e.message) && /URL interrogée/.test(e.message),
  )
})

test('checkServer : le serveur de CET arbre passe', async () => {
  const recuperer = async () => ({ ok: true, status: 200, headers: { get: () => entete(RACINE_SONDE) } })
  await checkServer('http://localhost:5210/', { recuperer, racineCourante: RACINE_SONDE })
})

test('empreinte : le fichier le plus RÉCENT et le cardinal sont relevés', () => {
  const fichiers = [
    { chemin: 'src/a.ts', mtimeMs: 10 },
    { chemin: 'src/b.ts', mtimeMs: 42 },
    { chemin: 'vite.config.ts', mtimeMs: 5 },
  ]
  assert.deepEqual(empreinteArbre('/peu importe', () => fichiers), {
    nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts',
  })
})

test('arbre gelé : mtime IDENTIQUE = aucun verdict', () => {
  const e = { nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' }
  assert.equal(verdictArbreGele(e, { ...e }), null)
})

test('arbre gelé : un mtime qui bouge NOMME le fichier', () => {
  const avant = { nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' }
  const apres = { nb: 3, mtimeMax: 99, plusRecent: 'src/ui/RollShell.tsx' }
  const verdict = verdictArbreGele(avant, apres)
  assert.match(verdict, /L'arbre a été modifié pendant la recette/)
  assert.match(verdict, /src\/ui\/RollShell\.tsx/)
})

test('arbre gelé : un fichier AJOUTÉ à mtime inchangé est vu aussi', () => {
  const verdict = verdictArbreGele(
    { nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' },
    { nb: 4, mtimeMax: 42, plusRecent: 'src/b.ts' },
  )
  assert.match(verdict, /1 fichier\(s\) ajouté\(s\)/)
})

test('withReloadRetry : arbre MODIFIÉ pendant la recette = échec nommé, AUCUN rejeu', async () => {
  const session = fakeSession()
  let calls = 0
  let mesures = 0
  const empreinte = () => ({ nb: 3, mtimeMax: mesures++ === 0 ? 42 : 99, plusRecent: 'src/ui/RollShell.tsx' })
  const origine = err('Execution context was destroyed')
  await assert.rejects(
    () => withReloadRetry(session, async () => { calls++; throw origine }, { tries: 3, timeoutMs: 100, empreinte }),
    (e) => {
      assert.match(e.message, /L'arbre a été modifié pendant la recette/)
      assert.match(e.message, /src\/ui\/RollShell\.tsx/)
      assert.equal(e.cause, origine)
      return true
    },
  )
  assert.equal(calls, 1, 'le rejeu ne doit PAS avoir lieu sur un arbre qui a bougé')
})

test('withReloadRetry : arbre GELÉ — le rejeu garde son comportement', async () => {
  const session = fakeSession()
  const empreinte = () => ({ nb: 3, mtimeMax: 42, plusRecent: 'src/b.ts' })
  let calls = 0
  const valeur = await withReloadRetry(session, async () => {
    calls++
    if (calls === 1) throw err('Target closed')
    return 'ok'
  }, { tries: 3, timeoutMs: 100, empreinte })
  assert.equal(valeur, 'ok')
  assert.equal(calls, 2)
})

// ------------------------------------------------- évaluation bornée (#1679 L1c)

test('evaluate : une expression qui ne rend jamais la main REJETTE au lieu de figer', async () => {
  const session = { rpc: () => new Promise(() => {}) } // jamais résolue : la page est bloquée
  const debut = Date.now()
  await assert.rejects(
    () => evaluate(session, 'while (true) {}', { timeoutMs: 30, margeMs: 30 }),
    (e) => {
      assert.match(e.message, /n'a pas rendu la main en 60ms/)
      assert.match(e.message, /while \(true\)/)
      return true
    },
  )
  assert.ok(Date.now() - debut < 2000, 'le rejet tombe au délai, pas au bout du gel historique')
})

test('evaluate : le plafond est PASSÉ à la page (paramètre timeout du CDP)', async () => {
  const vus = []
  const session = { rpc: async (methode, params) => { vus.push([methode, params]); return { result: { value: 7 } } } }
  assert.equal(await evaluate(session, '1 + 6', { timeoutMs: 1234 }), 7)
  assert.equal(vus[0][0], 'Runtime.evaluate')
  assert.equal(vus[0][1].timeout, 1234)
})

test('evaluate : sans plafond explicite, le défaut du kit est appliqué', async () => {
  const vus = []
  const session = { rpc: async (m, p) => { vus.push(p); return { result: { value: true } } } }
  await evaluate(session, 'true')
  assert.equal(vus[0].timeout, DELAI_EVALUATE)
})

// ------------------------------------------------- état persistant (#1679 L1c)

test('stockage : l\'instantané est relu depuis la page, les deux zones', async () => {
  const session = {
    rpc: async () => ({ result: { value: { local: { save1: '{"a":1}' }, session: { onglet: 'combat' } } } }),
  }
  assert.deepEqual(await instantanerStockage(session), {
    local: { save1: '{"a":1}' }, session: { onglet: 'combat' },
  })
})

test('stockage : l\'expression de restauration VIDE puis repose chaque clé des deux zones', () => {
  const expr = expressionRestaurerStockage({ local: { save1: 'x' }, session: { onglet: 'combat' } })
  assert.match(expr, /localStorage/)
  assert.match(expr, /sessionStorage/)
  assert.match(expr, /zone\.clear\(\)/)
  assert.match(expr, /zone\.setItem\(k, v\)/)
  assert.match(expr, /"save1":"x"/)
  assert.match(expr, /"onglet":"combat"/)
})

test('stockage : un instantané VIDE vide les deux zones (aucun résidu de recette)', () => {
  const expr = expressionRestaurerStockage({ local: {}, session: {} })
  assert.match(expr, /zone\.clear\(\)/)
  assert.match(expr, /"local":\{\}/)
})

test('stockage : restaurerStockage envoie CETTE expression à la page', async () => {
  const vus = []
  const session = { rpc: async (m, p) => { vus.push(p.expression); return { result: { value: true } } } }
  const instantane = { local: { save1: 'x' }, session: {} }
  await restaurerStockage(session, instantane)
  assert.equal(vus[0], expressionRestaurerStockage(instantane))
})

test('evaluate : un plafond ATTEINT côté navigateur est requalifié (le CDP rend « Internal error » nu)', async () => {
  const session = { rpc: () => new Promise((_, rejeter) => setTimeout(() => rejeter(err('Internal error')), 40)) }
  await assert.rejects(
    () => evaluate(session, 'while (true) {}', { timeoutMs: 30, margeMs: 5000 }),
    (e) => {
      assert.match(e.message, /n'a pas rendu la main en 30ms/)
      assert.match(e.message, /le navigateur a rendu : Internal error/)
      return true
    },
  )
})

test('evaluate : une erreur de scénario AVANT le plafond remonte telle quelle', async () => {
  const origine = err('ReferenceError: machin is not defined')
  const session = { rpc: async () => { throw origine } }
  await assert.rejects(() => evaluate(session, 'machin', { timeoutMs: 5000 }), (e) => e === origine)
})

// ---------------------------------------------------------------- famille realKey* (#1734)

/** Session factice qui COLLECTIONNE les payloads `Input.dispatchKeyEvent` émis. */
function sessionClavier() {
  const emis = []
  const session = brancherFactice(async (methode, params) => { if (methode === 'Input.dispatchKeyEvent') emis.push(params); return { result: { value: true } } })
  session.emis = emis
  return session
}

test('realKey* : UNE forme d’argument — la TOUCHE, la même pour les trois helpers', async () => {
  const s = sessionClavier()
  await realKey(s, { key: 'Escape' })
  assert.deepEqual(s.emis.map((e) => e.type), ['rawKeyDown', 'keyUp'])
  assert.equal(s.emis[0].key, 'Escape')
  assert.equal(s.emis[0].code, 'Escape')
  assert.equal(s.emis[0].windowsVirtualKeyCode, 27) // déduit de `key` (table KEY_CODES)

  const t = sessionClavier()
  await realKeyDown(t, { key: 'Escape' })
  await realKeyUp(t, { key: 'Escape' })
  // Le geste SÉPARÉ émet les mêmes champs que le geste d'un seul tenant : même forme, même déduction.
  assert.deepEqual(t.emis.map((e) => e.type), ['rawKeyDown', 'keyUp'])
  assert.deepEqual(t.emis[0], s.emis[0])
  assert.deepEqual(t.emis[1], s.emis[1])
})

test('realKey : une touche d’un seul caractère émet aussi le `char`, et le code se déduit', async () => {
  const s = sessionClavier()
  await realKey(s, { key: 'e' })
  assert.deepEqual(s.emis.map((e) => e.type), ['rawKeyDown', 'char', 'keyUp'])
  assert.equal(s.emis[1].text, 'e')
  assert.equal(s.emis[0].code, 'KeyE')
  assert.equal(s.emis[0].windowsVirtualKeyCode, 'E'.charCodeAt(0))
})

test('realKey : Entrée émet son TEXTE `\\r` — c’est lui qui active le bouton focalisé', async () => {
  const s = sessionClavier()
  await realKey(s, { key: 'Enter' })
  assert.deepEqual(s.emis.map((e) => e.type), ['rawKeyDown', 'char', 'keyUp'])
  assert.equal(s.emis[1].text, '\r')
  assert.equal(s.emis[0].windowsVirtualKeyCode, 13)
})

test('realKey* : `code` et code virtuel IMPOSÉS par l’appelant priment (`ALT`), et `modifiers` ne suit que l’APPUI', async () => {
  const s = sessionClavier()
  await realKeyDown(s, { ...ALT, modifiers: MOD_ALT })
  await realKeyUp(s, ALT)
  assert.equal(s.emis[0].code, 'AltLeft')
  assert.equal(s.emis[0].windowsVirtualKeyCode, 18)
  assert.equal(s.emis[0].modifiers, MOD_ALT)
  assert.equal('modifiers' in s.emis[1], false) // le relâchement déclare la touche relâchée
})

test('realKey* : la CHAÎNE nue est refusée par un message qui NOMME la forme attendue', async () => {
  // Un refus anonyme (déréférencement d'une propriété absente) ferait chercher la panne dans le CDP.
  await assert.rejects(() => realKey(sessionClavier(), 'Escape'), /TOUCHE/)
  await assert.rejects(() => realKeyDown(sessionClavier(), 'Escape'), /TOUCHE/)
  await assert.rejects(() => realKeyUp(sessionClavier(), 'Escape'), /TOUCHE/)
  await assert.rejects(() => realKey(sessionClavier(), { code: 'Escape' }), /TOUCHE/) // objet SANS `key`
  await assert.rejects(() => realKey(sessionClavier(), undefined), /TOUCHE/)
})

test('frapperTouche : l’alias français EST `realKey` (même geste, même forme)', () => {
  assert.equal(frapperTouche, realKey)
})

// ------------------------------------------------- champParLibelle : racine `dans`

/** Session dont la page est un DOM jsdom : l'expression est évaluée DANS ce document. */
function sessionSurDom(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  return { dom, session: brancherFactice(async (_m, p) => ({ result: { value: await dom.window.eval(p.expression) } })) }
}
const DEUX_NOMS = `
  <aside class="inspecteur"><label class="field"><span>Nom</span><input id="nom-scene"></label></aside>
  <div class="modal-overlay"><label class="field"><span>Nom</span><input id="nom-projet"></label></div>`

test('champParLibelle : deux champs porteurs du libellé dans la portée LÈVENT en les comptant, aucune marque posée', async () => {
  const { dom, session } = sessionSurDom(DEUX_NOMS)
  await assert.rejects(() => champParLibelle(session, 'Nom'), /champParLibelle : 2 cibles ambiguës « Nom » — input#nom-scene « +» \| input#nom-projet « +» — préciser \{ dans \}/)
  assert.equal(dom.window.document.querySelector('[data-recette]'), null)
})

test('champParLibelle : `dans` vise le champ de CETTE racine quand le libellé vit deux fois', async () => {
  const { dom, session } = sessionSurDom(DEUX_NOMS)
  const sel = await champParLibelle(session, 'Nom', { dans: '.modal-overlay' })
  assert.equal(dom.window.document.querySelector(sel).id, 'nom-projet')
})

test('champParLibelle : racine `dans` absente = null, comme un libellé introuvable', async () => {
  const { session } = sessionSurDom(DEUX_NOMS)
  assert.equal(await champParLibelle(session, 'Nom', { dans: '.absente' }), null)
})


test('champParLibelle : ARIA complet prioritaire, label sans options et ARIA blanc en repli', async () => {
  const { dom, session } = sessionSurDom('<label>Dégâts<input id="flat" aria-label="Dégâts complets"></label><label>Espèce<select id="espece" aria-label="   "><option>Humain</option></select></label>')
  assert.equal(dom.window.document.querySelector(await champParLibelle(session, 'Dégâts complets')).id, 'flat')
  assert.equal(await champParLibelle(session, 'Dégâts'), null)
  assert.equal(dom.window.document.querySelector(await champParLibelle(session, 'Espèce')).id, 'espece')
})

for (const outil of ['texte', 'selecteur']) {
  test('apparition différée : ' + outil + ' attend et ne prend pas le montage pour un effet du clic', async () => {
    const { doc, session, etat } = pagePilotee('')
    const ouvrir = () => outil === 'texte'
      ? clickButtonByText(session, 'Retardé', { attenteMs: 200, attendreChangement: 30 })
      : cliquerSelecteur(session, '#retarde', { attenteMs: 200, attendreChangement: 30 })
    setTimeout(() => { doc.body.innerHTML = '<button id="retarde">Retardé</button>' }, 20)
    await assert.rejects(ouvrir, /le clic n'a RIEN changé/)
    assert.equal(etat.cliques.length, 1)
  })
}

test('clickButtonByText : absence bornée nomme texte, portée, rangée et délai sans clic', async () => {
  const { session, etat } = pagePilotee('<div id="zone"></div>')
  const debut = Date.now()
  await assert.rejects(() => clickButtonByText(session, 'Retardé', { dans: '#zone', rangee: 'Lance', attenteMs: 30 }), /Retardé.*#zone.*Lance.*30 ms/)
  assert.ok(Date.now() - debut >= 30)
  assert.equal(etat.cliques.length, 0)
})

// ------------------------------------------------- clickButtonByText : bouton d'une `rangee`

/** Liste de campagnes à un « Choisir » par rangée (patron de la modale « Choisir la campagne »). Le
 *  bouton VISÉ est celui que `scrollIntoView` reçoit : jsdom n'en a pas, le stub note son `id`. La
 *  rangée à apostrophe n'est PAS la première : un `rangee` ignoré viserait un autre bouton. */
function sessionRangees(arene = 'L’Arène') {
  const { dom, session } = sessionSurDom(`
    <ul class="picker">
      <li><strong>La Diligence</strong><button id="choisir-diligence">Choisir</button></li>
      <li><strong>Le Loup et la Saumure</strong><button id="choisir-loup">Choisir</button></li>
      <li><strong>${arene}</strong><span>3 scènes</span><button id="choisir-arene">Choisir</button></li>
    </ul>`)
  dom.window.Element.prototype.scrollIntoView = function () { dom.window.vise = this.id }
  dom.window.document.elementFromPoint = () => dom.window.document.getElementById(dom.window.vise) // le bouton visé est au point
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, width: 20, height: 20 })
  return { dom, session }
}

test('clickButtonByText : `rangee` vise le bouton de la rangée qui porte ce texte, pas le premier', async () => {
  const { dom, session } = sessionRangees()
  await clickButtonByText(session, 'Choisir', { rangee: 'Le Loup et la Saumure' })
  assert.equal(dom.window.vise, 'choisir-loup')
})

for (const [dansLeDom, demandee] of [['L’Arène', "L'Arène"], ["L'Arène", 'L’Arène']]) {
  test(`clickButtonByText : \`rangee\` normalise l’apostrophe comme le libellé (DOM « ${dansLeDom} », rangee « ${demandee} »)`, async () => {
    const { dom, session } = sessionRangees(dansLeDom)
    await clickButtonByText(session, 'Choisir', { rangee: demandee })
    assert.equal(dom.window.vise, 'choisir-arene')
  })
}

test('clickButtonByText : `rangee` introuvable = refus NOMMANT la rangée, aucun clic', async () => {
  const { dom, session } = sessionRangees()
  await assert.rejects(() => clickButtonByText(session, 'Choisir', { rangee: 'Middenheim', attenteMs: 0 }), /rangée « Middenheim »/)
  assert.equal(dom.window.vise, undefined)
})

// ------------------------------------------------- poserFichier : domaine DOM du CDP

/** Session dont le domaine `DOM` du CDP est servi par un document jsdom : `nodeId` = rang dans
 *  `noeuds`, 0 = introuvable (la convention du CDP) ; `poses` collectionne les `setFileInputFiles`. */
function sessionDomCdp(html) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const noeuds = [null, dom.window.document]
  const poses = []
  const rpc = async (methode, params) => {
    if (methode === 'Runtime.evaluate') return { result: { value: await dom.window.eval(params.expression) } }
    if (methode === 'DOM.getDocument') return { root: { nodeId: 1 } }
    if (methode === 'DOM.querySelector') {
      const el = noeuds[params.nodeId].querySelector(params.selector)
      if (!el) return { nodeId: 0 }
      noeuds.push(el)
      return { nodeId: noeuds.length - 1 }
    }
    if (methode === 'DOM.setFileInputFiles') poses.push({ id: noeuds[params.nodeId].id, files: params.files })
    return {}
  }
  return { dom, poses, session: brancherFactice(rpc) }
}
const DEUX_IMPORTS = `
  <div class="editor-toolbar"><input type="file" id="import-editeur"></div>
  <div class="worldmap-overlay"><input type="file" id="import-bibliotheque"></div>`

test('poserFichier : pose le chemin ABSOLU sur l’input de la racine `dans`', async () => {
  const { poses, session } = sessionDomCdp(DEUX_IMPORTS)
  const absolu = await poserFichier(session, 'input[type=file]', 'x.json', { dans: '.worldmap-overlay' })
  assert.deepEqual(poses, [{ id: 'import-bibliotheque', files: [absolu] }])
  assert.equal(isAbsolute(absolu), true)
})

test('poserFichier : input absent = refus NOMMANT le sélecteur, rien de posé', async () => {
  const { poses, session } = sessionDomCdp('<div></div>')
  await assert.rejects(() => poserFichier(session, 'input.absent', 'x.json'), /input\.absent/)
  assert.deepEqual(poses, [])
})

test('poserFichier : racine `dans` absente = refus NOMMANT la racine', async () => {
  const { poses, session } = sessionDomCdp(DEUX_IMPORTS)
  await assert.rejects(() => poserFichier(session, 'input[type=file]', 'x.json', { dans: '.modal-overlay' }), /\.modal-overlay/)
  assert.deepEqual(poses, [])
})

// ── Découverte de Chrome (`resoudreChrome`) : système de fichiers FACTICE, aucun disque ──
/** Un disque factice : `fichiers` existent, `dossiers[d]` liste le contenu de `d`. */
const disque = (fichiers = [], dossiers = {}) => ({
  existe: (p) => fichiers.includes(p) || p in dossiers,
  lister: (d) => dossiers[d] ?? [],
})
const WIN = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PW = (racine, v) => `${racine}/chromium-${v}/chrome-linux/chrome`

test('Chrome : CHROME_PATH prime sur tout le reste', () => {
  const r = resoudreChrome({ env: { CHROME_PATH: '/x/chrome' }, fs: disque([WIN]), uid: 1000 })
  assert.deepEqual(r, { chemin: '/x/chrome', args: [] })
})

test('Chrome : le chemin EXPLICITE de l’appelant prime sur CHROME_PATH', () => {
  const r = resoudreChrome({ explicite: '/y/chrome', env: { CHROME_PATH: '/x/chrome' }, fs: disque(), uid: 1000 })
  assert.equal(r.chemin, '/y/chrome')
})

test('Chrome : un chemin Windows présent passe avant Playwright, sur win32', () => {
  const fs = disque([WIN, PW('/opt/pw-browsers', 1194)], { '/opt/pw-browsers': ['chromium-1194'] })
  assert.equal(resoudreChrome({ env: {}, fs, uid: undefined, plateforme: 'win32' }).chemin, WIN)
})

test('Chrome : hors win32, un chemin Windows n’est jamais essayé — il se résoudrait contre le dossier courant', () => {
  const essayes = []
  const base = disque([WIN, PW('/opt/pw-browsers', 1194)], { '/opt/pw-browsers': ['chromium-1194'] })
  const fs = { ...base, existe: (p) => (essayes.push(p), base.existe(p)) }
  assert.equal(resoudreChrome({ env: {}, fs, uid: 1000, plateforme: 'linux' }).chemin, PW('/opt/pw-browsers', 1194))
  assert.ok(!essayes.includes(WIN), essayes.join(' · '))
})

test('Chrome : Chromium Playwright trouvé par LECTURE du dossier, version la plus haute, headless_shell écarté', () => {
  const racine = '/pw'
  const fs = disque([PW(racine, 1194), PW(racine, 1200)], {
    [racine]: ['chromium', 'chromium_headless_shell-1300', 'chromium-1194', 'chromium-1200', 'ffmpeg-1011'],
  })
  assert.equal(resoudreChrome({ env: { PLAYWRIGHT_BROWSERS_PATH: racine }, fs, uid: 1000 }).chemin, PW(racine, 1200))
})

test('Chrome : sans PLAYWRIGHT_BROWSERS_PATH, la racine est /opt/pw-browsers', () => {
  const fs = disque([PW('/opt/pw-browsers', 1194)], { '/opt/pw-browsers': ['chromium-1194'] })
  assert.equal(resoudreChrome({ env: {}, fs, uid: 1000 }).chemin, PW('/opt/pw-browsers', 1194))
})

test('Chrome : un dossier chromium-N sans exécutable est ignoré', () => {
  const fs = disque([PW('/pw', 1194)], { '/pw': ['chromium-1194', 'chromium-1300'] })
  assert.equal(resoudreChrome({ env: { PLAYWRIGHT_BROWSERS_PATH: '/pw' }, fs, uid: 1000 }).chemin, PW('/pw', 1194))
})

test('Chrome : --no-sandbox en root SEULEMENT', () => {
  const fs = disque([WIN])
  assert.deepEqual(resoudreChrome({ env: {}, fs, uid: 0, plateforme: 'win32' }).args, ['--no-sandbox'])
  assert.deepEqual(resoudreChrome({ env: {}, fs, uid: 1000, plateforme: 'win32' }).args, [])
  assert.deepEqual(resoudreChrome({ env: {}, fs, uid: undefined, plateforme: 'win32' }).args, [])
})

test('Chrome : aucun candidat — refus NOMMANT les chemins essayés', () => {
  assert.throws(() => resoudreChrome({ env: {}, fs: disque(), uid: 1000 }), (e) => {
    assert.match(e.message, /aucun Chrome trouvé/)
    assert.match(e.message, /CHROME_PATH/)
    assert.match(e.message, /\/opt\/pw-browsers\/chromium-\*\/chrome-linux\/chrome/)
    return true
  })
})

// ------------------------------------------------- page jsdom PILOTÉE : clics réels simulés

/** Page jsdom pilotée comme par le CDP : `Runtime.evaluate` évalue dans le document ; la cible qu'un
 *  localisateur MARQUE (`data-recette-cible`) est ce que `elementFromPoint` rend au point, sauf si
 *  `recouvrir` désigne un autre élément PRÉSENT ; `mouseReleased` clique ce qu'il y a au point. `lectures`
 *  compte les lectures de fenêtres, `auxLectures(n, document)` fait évoluer le DOM entre deux.
 *  `__wfrp` porte toujours `gesteCarteAttendu` (lu de `jeu.gesteCarte`), même quand un test le réassigne. */
const cascadeAffichage = (dom) => {
  const pc = dom.window.__game.getState().pendingCascade
  const cur = pc?.participants[pc.cursor]
  return cur ? { id: cur.id, kind: cur.kind, interaction: 'affichage', ready: true, chosen: null, amount: null } : null
}

function pagePilotee(html, { auxLectures, recouvrir, battle, jeu = {}, cascade = false } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const doc = dom.window.document
  const etat = { lectures: 0, emis: [], cliques: [], marque: null }
  dom.window.__game = { getState: () => ({ pendingCascade: cascade && doc.querySelector('.modal-overlay') ? { cursor: 0, participants: [{ id: 'fixture-step', kind: 'defenseJet', jet: 'defense' }] } : null, ...jeu }) }
  const gesteCarteAttendu = () => jeu.gesteCarte ?? null
  const dialogueDuDessus = () => {
    const overlay = [...doc.querySelectorAll('.modal-overlay')].at(-1)
    if (!overlay) return null
    if (cascade) {
      overlay.setAttribute('data-champ', '')
      overlay.setAttribute('data-plein', '')
    }
    overlay.setAttribute('data-wfrp-dialogue-dessus', '')
    const dialogue = overlay.querySelector('[role="dialog"]')
    return { kind: 'fixture-flux', plan: 'application', nom: dialogue?.getAttribute('aria-label') ?? null, selecteur: '[data-wfrp-dialogue-dessus]' }
  }
  const auto = () => ({ activeModal: cascade && doc.querySelector('.modal-overlay') ? 'pendingCascade' : null, cascade: cascadeAffichage(dom) })
  let wfrp = { gesteCarteAttendu, dialogueDuDessus, auto }
  Object.defineProperty(dom.window, '__wfrp', { configurable: true, get: () => wfrp, set: (v) => { wfrp = { gesteCarteAttendu, dialogueDuDessus, auto, ...v } } })
  if (battle) dom.window.__wfrp = { battle: () => battle() }
  doc.elementFromPoint = () => (recouvrir && doc.querySelector(recouvrir)) || etat.marque
  dom.window.Element.prototype.scrollIntoView = function () {}
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 10, height: 10 })
  const rpc = async (methode, p) => {
    if (methode === 'Runtime.evaluate') {
      if (p.expression.includes('aChoix')) { etat.lectures += 1; auxLectures?.(etat.lectures, doc) }
      const valeur = await dom.window.eval(p.expression)
      etat.marque = doc.querySelector('[data-recette-cible]') ?? etat.marque
      return { result: { value: valeur } }
    }
    etat.emis.push(`${methode}:${p.type ?? ''}`)
    if (methode === 'Input.dispatchMouseEvent' && p.type === 'mouseReleased' && p.button === 'left' && etat.marque) {
      etat.cliques.push((etat.marque.textContent || '').trim())
      etat.marque.click()
    }
    return {}
  }
  return { dom, doc, etat, session: brancherFactice(rpc) }
}


function sessionCamera({ deg = 0, active = false, sensibilite = 0.5, mauvais = false, echec = false } = {}) {
  const page = pagePilotee('<canvas class="iso-stage" style="pointer-events:none"></canvas><svg class="iso-stage"></svg>')
  page.doc.elementFromPoint = () => page.doc.querySelector('svg.iso-stage')
  const camera = { deg, active, sensibilite }
  page.dom.window.__wfrp.camera = () => ({ ...camera })
  const rect = () => ({ x: 10, y: 10, width: 800, height: 500 })
  page.doc.querySelector('canvas.iso-stage').getBoundingClientRect = rect
  page.doc.querySelector('svg.iso-stage').getBoundingClientRect = rect
  const rpc = socketDe(page.session).gerer
  let sx, sy, panned = false
  page.etat.souris = []
  socketDe(page.session).gerer = async (m, p) => {
    if (m === 'Input.dispatchMouseEvent') {
      page.etat.souris.push(p)
      if (p.type === 'mousePressed') { assert.equal(p.button, 'middle'); sx = p.x; sy = p.y; panned = false; camera.active = true }
      if (p.type === 'mouseMoved' && p.buttons === 4) {
        panned ||= Math.hypot(p.x - sx, p.y - sy) > 6
        if (echec) throw new Error('move cassé')
        if (!mauvais && panned) camera.deg = deg + (p.x - sx) * sensibilite
      }
      if (p.type === 'mouseReleased') { deg = camera.deg; camera.active = false }
    }
    return rpc(m, p)
  }
  return page
}

for (const angle of [-90, 90, 0.1, 900]) {
  test('tournerCamera : glisser middle réel ' + angle + ' degrés puis observer', async () => {
    const { session, etat } = sessionCamera()
    const resultat = await kitRecette.tournerCamera(session, angle, { attenteMs: 50 })
    assert.ok(Math.abs(resultat.delta - angle) <= 0.1)
    assert.ok(etat.emis.includes('Input.dispatchMouseEvent:mousePressed'))
    assert.equal(etat.emis.at(-1), 'Input.dispatchMouseEvent:mouseReleased')
    assert.ok(etat.souris.filter(p => p.type === 'mouseMoved' && p.buttons === 4).length >= 2)
    assert.ok(etat.souris.every(p => p.x >= 10 && p.x <= 810 && p.y >= 10 && p.y <= 510))
  })
}
test('tournerCamera : zéro sans événement, non fini et active refusés avant entrée', async () => {
  for (const [angle, options] of [[0, {}], [NaN, {}], [90, { active: true }]]) {
    const { session, etat } = sessionCamera(options)
    if (angle === 0) assert.equal((await kitRecette.tournerCamera(session, angle)).delta, 0)
    else await assert.rejects(() => kitRecette.tournerCamera(session, angle), /tournerCamera/)
    assert.deepEqual(etat.emis, [])
  }
})
test('tournerCamera : mauvais résultat refusé et release garanti si move échoue', async () => {
  const mauvais = sessionCamera({ mauvais: true })
  await assert.rejects(() => kitRecette.tournerCamera(mauvais.session, 90, { attenteMs: 50 }), /rotation.*observée/)
  const casse = sessionCamera({ echec: true })
  await assert.rejects(() => kitRecette.tournerCamera(casse.session, 90), /move cassé/)
  assert.equal(casse.etat.emis.at(-1), 'Input.dispatchMouseEvent:mouseReleased')
})


test('tournerCamera : angle immense et délai invalide refusés sans entrée', async () => {
  for (const [angle, attenteMs] of [[1e300, 100], [90, Infinity], [90, -1]]) {
    const { session, etat } = sessionCamera()
    const rpc = socketDe(session).gerer
    let moves = 0
    socketDe(session).gerer = async (m, p) => {
      if (m === 'Input.dispatchMouseEvent' && ++moves > 2) throw new Error('sentinelle boucle')
      return rpc(m, p)
    }
    await assert.rejects(() => kitRecette.tournerCamera(session, angle, { attenteMs }), /tournerCamera :.*(?:imprécision|délai)/)
    assert.equal(moves, 0)
    assert.deepEqual(etat.emis, [])
  }
})

test('tournerCamera : budget commun aux chunks et observation finale', async () => {
  const { session, etat } = sessionCamera()
  const rpc = socketDe(session).gerer
  socketDe(session).gerer = async (m, p) => {
    const result = await rpc(m, p)
    if (m === 'Input.dispatchMouseEvent' && p.type === 'mouseReleased') await new Promise(r => setTimeout(r, 150))
    return result
  }
  await assert.rejects(() => kitRecette.tournerCamera(session, 900, { attenteMs: 80 }), /tournerCamera :.*budget/)
  assert.equal(etat.souris.filter(p => p.type === 'mousePressed').length, 1)
  assert.equal(etat.souris.filter(p => p.type === 'mouseReleased').length, 1)
})

test('clic : mouvement et relâchement échouent, cause et code primaires conservés', async () => {
  const { session } = pagePilotee('<div id="surface"></div>')
  let releases = 0
  const gerer = socketDe(session).gerer
  socketDe(session).gerer = async (m, p) => {
    if (p.type === 'mouseMoved' && p.buttons === 4) throw new Error('Inspected target navigated or closed')
    if (p.type === 'mouseReleased') { releases++; throw new Error('release secondaire') }
    return gerer(m, p)
  }
  await assert.rejects(() => geste(session, { surface: '#surface', x: 20, y: 20 }, {}, clic({ bouton: 'middle', trajet: [{ x: 10, y: 0 }] })), e => {
    assert.match(e.cause.message, /Inspected target navigated/)
    assert.equal(e.code, TARGET_NAVIGATED)
    assert.equal(e.errors.length, 2)
    assert.match(e.message, /Inspected target navigated.*release secondaire/)
    return true
  })
  assert.equal(releases, 1)
})

// ------------------------------------------------- K14 : un clic qui manque sa cible LÈVE

test('geste : un élément qui RECOUVRE la cible jusqu’à l’échéance fait lever en NOMMANT le dernier recouvreur, et aucun clic n’est émis', async () => {
  const { etat, session } = pagePilotee('<button id="onglet">Avancement</button><div class="barre-groupe">Groupe</div>', { recouvrir: '.barre-groupe' })
  await assert.rejects(() => clickButtonByText(session, 'Avancement', { attenteMs: 150 }), (e) => {
    assert.match(e.message, /div\.barre-groupe « Groupe »/)
    assert.match(e.message, /RECOUVRE la cible, toujours après 150 ms/)
    return true
  })
  assert.deepEqual(etat.emis, [])
})

test('geste : un recouvrement TRANSITOIRE (scène de dés du roulis) est attendu — le clic part dès qu’il disparaît', async () => {
  const { doc, etat, session } = pagePilotee('<button id="appliquer">Appliquer</button><div class="rm-scene">53</div>', { recouvrir: '.rm-scene' })
  setTimeout(() => doc.querySelector('.rm-scene').remove(), 120)
  await clickButtonByText(session, 'Appliquer', { attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Appliquer'])
})

test('resoudreModales : « Appliquer » recouvert le temps du roulis est cliqué sur l’horloge attenteMs, jamais une levée', async () => {
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><button id="appliquer">Appliquer</button></div><div class="rm-scene">53</div></div>', { recouvrir: '.rm-scene' })
  doc.querySelector('#appliquer').onclick = () => doc.querySelector('.modal-overlay').remove()
  setTimeout(() => doc.querySelector('.rm-scene').remove(), 120)
  await resoudreModales(session, 'defense', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Appliquer'])
})

test('clickButtonByText : le NOM ACCESSIBLE d’un bouton sans texte — `aria-label` (préfixe en `exact: false`), sinon `title`', async () => {
  const { doc, session } = pagePilotee('<button class="ptile" aria-label="Sigmund Reikhardt — fiche du personnage"><img alt=""></button><button class="worldmap-btn" title="Carte du monde (M)"></button>')
  const clics = []
  doc.querySelector('.ptile').onclick = () => clics.push('portrait')
  doc.querySelector('.worldmap-btn').onclick = () => clics.push('carte')
  await clickButtonByText(session, 'Sigmund Reikhardt', { exact: false })
  await clickButtonByText(session, 'Carte du monde (M)')
  assert.deepEqual(clics, ['portrait', 'carte'])
  await assert.rejects(() => clickButtonByText(session, 'Sigmund Reikhardt', { attenteMs: 0 }), /aucune cible « Sigmund Reikhardt » \(texte EXACT\)/)
})

test('cliquerSelecteur : un sélecteur qui APPARAÎT après le clic qui ouvre son écran est attendu, puis cliqué', async () => {
  const { dom, doc, etat, session } = pagePilotee('<div id="ecran"></div>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 10, height: 10 })
  setTimeout(() => { doc.querySelector('#ecran').innerHTML = '<button data-testid="scenario-launch-embuscade">Lancer</button>' }, 120)
  await cliquerSelecteur(session, '[data-testid="scenario-launch-embuscade"]', { attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Lancer'])
})

test('cliquerSelecteur : un sélecteur jamais apparu LÈVE à l’échéance en le nommant — aucun clic émis', async () => {
  const { etat, session } = pagePilotee('<div></div>')
  await assert.rejects(() => cliquerSelecteur(session, '#absent', { attenteMs: 80 }), /^Error: cliquerSelecteur : aucune cible « #absent » après 80 ms/)
  assert.deepEqual(etat.emis, [])
})

test('resoudreModales : après choix explicite, le geste carte est refusé', async () => {
  const jeu = {}
  const { doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Sort"><div class="seg"><button>Zone</button><button>Cible</button></div><button id="lancer" disabled>Lancer</button></div></div>', { jeu })
  doc.querySelector('.seg button').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.gesteCarte = { kind: 'zone', label: 'Boule de feu', casterId: 'h1', radius: 1, rangeTiles: 8 } }
  await clickButtonByText(session, 'Zone', { dans: '.modal-overlay' })
  await assert.rejects(() => resoudreModales(session, 'sort', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 300 }), (e) => {
    assert.match(e.message, /pose de zone en cours/)
    return true
  })
})

test('resoudreModales : choix requis nommé sans événement même sous un voile', async () => {
  const { session, etat } = pagePilotee('<div class="modal-overlay"><div class="seg"><button>Parade</button></div><button disabled>Lancer</button><div class="voile">…</div></div>', { recouvrir: '.voile' })
  await assert.rejects(() => resoudreModales(session, 'defense', { dans: '.modal-overlay', pauseMs: 1 }), /choix joueur requis.*Parade/)
  assert.deepEqual(etat.emis, [])
})

test('piloterCombat / avancerDeRounds : le choix explicite laisse le geste carte à la recette', async () => {
  const bataille = { round: 1, over: false, actif: 'h1', acted: false, movementUsed: 0, endTurnArmed: false }
  const jeu = {}
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button>Esquive</button></div><button id="lancer" disabled>Lancer</button></div></div>', { jeu, cascade: true })
  dom.window.__wfrp = { battle: () => bataille, auto: () => ({ roundPause: false, activeModal: 'pendingCascade', cascade: cascadeAffichage(dom), active: { id: 'h1', kind: 'hero' } }) }
  doc.querySelector('.seg button').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.gesteCarte = { kind: 'cibles', label: 'Flèche', casterId: 'h1', cibles: [] } }
  await clickButtonByText(session, 'Parade', { dans: '.modal-overlay' })
  await assert.rejects(() => avancerDeRounds(session, 1, { pauseMs: 1 }), (e) => {
    assert.match(e.message, /choix de cibles en cours/)
    return true
  })
})

test('geste : la cible atteinte au point est cliquée — la triade souris complète', async () => {
  const { etat, session } = pagePilotee('<button id="onglet">Avancement</button>')
  await clickButtonByText(session, 'Avancement')
  assert.deepEqual(etat.emis, ['Input.dispatchMouseEvent:mouseMoved', 'Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseReleased'])
  assert.deepEqual(etat.cliques, ['Avancement'])
})

// ------------------------------------------------- K17 : correspondance EXACTE par défaut

const ATELIERS = '<button>Atelier du Codex</button><button>Atelier</button><button>Atelier des cartes</button>'

test('clickButtonByText : le texte EXACT par défaut — « Atelier » ne prend pas « Atelier du Codex »', async () => {
  const { etat, session } = pagePilotee(ATELIERS)
  await clickButtonByText(session, 'Atelier')
  assert.deepEqual(etat.cliques, ['Atelier'])
})

test('clickButtonByText : un préfixe sans correspondance exacte est REFUSÉ par défaut, accepté sur demande', async () => {
  const { etat, session } = pagePilotee('<button>Atelier du Codex</button>')
  await assert.rejects(() => clickButtonByText(session, 'Atelier'), /texte EXACT/)
  await clickButtonByText(session, 'Atelier', { exact: false })
  assert.deepEqual(etat.cliques, ['Atelier du Codex'])
})

// ------------------------------------------------- D7 : `resoudreModales` tolérant

test('items explicites : libellé sans badge, vrais clics, ambiguïté et recouvrement refusés', async () => {
  const { dom, etat, session } = pagePilotee('<ul><li><span class="nom">Dague</span><span>2</span></li><li><span class="nom">Épée</span><span>1</span></li></ul>')
  await clickItemByText(session, 'Épée', { selecteur: 'li', nom: '.nom' })
  assert.deepEqual(etat.cliques, ['Épée1'])
  await assert.rejects(() => clickItemByText(session, 'Épée'), /selecteur.*obligatoire/)
  dom.window.document.querySelector('ul').insertAdjacentHTML('beforeend', '<li><span class="nom">Épée</span></li>')
  const n = etat.emis.length
  await assert.rejects(() => clickItemByText(session, 'Épée', { selecteur: 'li', nom: '.nom' }), /2 cibles ambiguës « Épée » — li « Épée1 » \| li « Épée »/)
  assert.equal(etat.emis.length, n)
  const couverte = pagePilotee('<li>Dague</li><div class="voile"></div>', { recouvrir: '.voile' })
  await assert.rejects(() => clickItemByText(couverte.session, 'Dague', { selecteur: 'li', attenteMs: 0 }), /RECOUVRE/)
  assert.deepEqual(couverte.etat.emis, [])
})

test('Atelier setter : on/off idempotents par aria-pressed et clic réel', async () => {
  const { doc, etat, session } = pagePilotee('<header class="codex-top"><button aria-pressed="false">Atelier</button></header>')
  const b = doc.querySelector('button')
  b.onclick = () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))
  assert.equal(await setAtelier(session, true), true)
  assert.equal(await setAtelier(session, true), true)
  assert.equal(await setAtelier(session, false), false)
  assert.equal(await setAtelier(session, false), false)
  assert.deepEqual(etat.cliques, ['Atelier', 'Atelier'])
})

test('clic ambigu : refuse avant tout événement, portée explicite départage', async () => {
  const { etat, session } = pagePilotee('<div id="a"><button>Nain</button></div><div id="b"><button>Nain</button></div>')
  await assert.rejects(() => clickButtonByText(session, 'Nain'), /cibles ambiguës/)
  assert.deepEqual(etat.emis, [])
  await clickButtonByText(session, 'Nain', { dans: '#b' })
  assert.deepEqual(etat.cliques, ['Nain'])
})

test('libellé de select enveloppé : options exclues, champ intact', async () => {
  const { dom, session } = sessionSurDom('<label>Espèce (rig)<select><option>Humain</option><option>Nain</option></select></label>')
  const sel = await champParLibelle(session, 'Espèce (rig)')
  assert.equal(dom.window.document.querySelector(sel).tagName, 'SELECT')
  assert.equal(dom.window.document.querySelectorAll('option').length, 2)
})

/** Pastille de couleur dont le clic réel (`mousePressed`) donne le focus, comme Chrome (mesuré #1925). */
function pageCouleur(html = '<input id="c" type="color" value="#000000">') {
  const p = pagePilotee(html)
  p.dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 20, height: 20 })
  const rpc = socketDe(p.session).gerer
  socketDe(p.session).gerer = async (m, params) => {
    if (m === 'Input.dispatchMouseEvent' && params.type === 'mousePressed') p.etat.marque?.focus()
    return rpc(m, params)
  }
  return p
}

test('couleur : focus par CLIC RÉEL, puis setter natif input/change', async () => {
  const { doc, etat, session } = pageCouleur()
  const evenements = []
  for (const nom of ['focus', 'input', 'change']) doc.querySelector('input').addEventListener(nom, () => evenements.push(nom))
  assert.equal(await choisirCouleur(session, '#c', '#AABBCC'), '#aabbcc')
  assert.deepEqual(etat.emis, ['Input.dispatchMouseEvent:mouseMoved', 'Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseReleased'])
  assert.deepEqual(evenements, ['focus', 'input', 'change'])
  assert.equal(doc.activeElement.id, 'c')
})

test('couleur : un clic qui ne donne pas le focus LÈVE, aucune couleur posée', async () => {
  const { doc, session } = pagePilotee('<input id="c" type="color" value="#000000">')
  await assert.rejects(() => choisirCouleur(session, '#c', '#aabbcc'), /choisirCouleur « #c » : le champ n'a pas le focus après le clic \(focus sur body\) — aucune couleur posée/)
  assert.equal(doc.querySelector('#c').value, '#000000')
})

test('couleur : couleur invalide, cible d’un autre type et pastille FERMÉE refusées avant tout événement', async () => {
  const { doc, etat, session } = pageCouleur('<input id="c" type="color" value="#000000"><input id="t">')
  await assert.rejects(() => choisirCouleur(session, '#c', 'red'), /couleur invalide/)
  await assert.rejects(() => choisirCouleur(session, '#t', '#ffffff'), /input\[type=color\] attendu « #t », trouvé input — aucun événement émis/)
  doc.querySelector('#c').disabled = true
  await assert.rejects(() => choisirCouleur(session, '#c', '#ffffff'), /FERMÉ/)
  assert.deepEqual(etat.emis, [])
})

test('dialogue supérieur : seule boîte marquée résolue, fiche et cérémonie inconnue préservées', async () => {
  const { dom, doc, etat, session } = pagePilotee('<div class="modal-overlay" id="dessous"><button>Fermer</button></div><div class="modal-overlay" id="dessus"><button>Terminer</button></div>')
  dom.window.__wfrp = { dialogueDuDessus: () => doc.querySelector('#dessus') ? { kind: 'fixture', plan: 'application', nom: 'Dessus', selecteur: '#dessus' } : null }
  doc.querySelector('#dessus button').onclick = () => doc.querySelector('#dessus').remove()
  await assert.rejects(() => resoudreModales(session, 'test', { pauseMs: 0 }), /cérémonie indéterminée/)
  assert.deepEqual(etat.emis, [])
  await resoudreModales(session, 'test', { pauseMs: 0, dans: '#dessus' })
  assert.deepEqual(etat.cliques, ['Terminer'])
  assert.ok(doc.querySelector('#dessous'))
  dom.window.__wfrp = { dialogueDuDessus: () => ({ kind: 'codex', plan: 'application', nom: 'Codex', selecteur: '#dessous' }) }
  await assert.rejects(() => resoudreModales(session, 'test', { dans: '#dessous', pauseMs: 0 }), /fiche hors flux.*Codex.*laissée ouverte/)
  assert.ok(doc.querySelector('#dessous'))
})

for (const [nom, pc, election, coquille, permis] of [
  ['cascade seule', true, false, true, false],
  ['élection seule', false, true, true, false],
  ['coquille absente', true, true, false, false],
  ['cascade élue avec coquille', true, true, true, true],
]) {
  test('preuve de flux : ' + nom, async () => {
    const jeu = { pendingCascade: pc ? { cursor: 0, participants: [{ id: 'fixture-step', kind: 'defenseJet', jet: 'defense' }] } : null }
    const { dom, doc, etat, session } = pagePilotee('<div class="modal-overlay" ' + (coquille ? 'data-champ data-plein' : '') + '><button>Terminer</button></div>', { jeu })
    dom.window.__wfrp = { auto: () => ({ activeModal: election && doc.querySelector('.modal-overlay') ? 'pendingCascade' : null, cascade: cascadeAffichage(dom) }) }
    doc.querySelector('button').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.pendingCascade = null }
    if (permis) {
      await resoudreModales(session, 'preuve', { pauseMs: 0 })
      assert.deepEqual(etat.cliques, ['Terminer'])
    } else {
      await assert.rejects(() => resoudreModales(session, 'preuve', { pauseMs: 0 }), /cérémonie indéterminée/)
      assert.deepEqual(etat.emis, [])
      assert.ok(doc.querySelector('.modal-overlay'))
    }
  })
}

test('instantanés processus : Windows et ps complets, formes malformées refusées avant arrêt', () => {
  const lire = (plateforme, stdout) => lireProcessus({ plateforme, executer: () => ({ status: 0, stdout }), horloge: () => 100000 })
  assert.deepEqual(lire('win32', '[{"ProcessId":42,"ParentProcessId":0,"Cree":5000}]'), [{ pid: 42, parent: 0, cree: 5000 }])
  lireProcessus({ plateforme: 'win32', executer: (_commande, args) => {
    assert.ok(args.at(-1).includes('Get-CimInstance Win32_Process -Filter "ProcessId > 0"') && args.at(-1).includes('CreationDate'))
    return { status: 0, stdout: '[]' }
  } })
  assert.deepEqual(lire('linux', ' 42 0 30\n43 42 2\n'), [{ pid: 42, parent: 0, cree: 70000 }, { pid: 43, parent: 42, cree: 98000 }])
  for (const stdout of ['{}', '[{}]', '[null]', '[{"ProcessId":42}]', '[{"ProcessId":0,"ParentProcessId":1}]', '[{"ProcessId":"42","ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":-1}]', '[{"ProcessId":42.1,"ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":1},{"ProcessId":42,"ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":1,"Cree":-1}]', '[{"ProcessId":42,"ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":1,"Cree":null}]', '[{"ProcessId":42,"ParentProcessId":1,"Cree":"hier"}]']) {
    assert.throws(() => lire('win32', stdout), /malformé/)
  }
  for (const stdout of ['42 1', '42 nope 3', '42 1 3 surplus', '0 1 3', '42 -1 3', '42.1 1 3', '42 1 3\n43', '42 1 3\n42 1 3']) {
    assert.throws(() => lire('linux', stdout), /malformé/)
  }
  let arrets = 0
  for (const instantane of [null, [{}], [{ pid: NaN, parent: 0 }], [{ pid: 42, parent: undefined, cree: 0 }], [{ pid: 42, parent: 0 }], [{ pid: 42, parent: 0, cree: 0 }, { pid: 42, parent: 1, cree: 0 }]]) {
    assert.throws(() => killChromeTree({ pid: 42 }, { plateforme: 'win32', observer: () => instantane, executer: () => { arrets++; return { status: 0 } } }), /malformé/)
  }
  assert.equal(arrets, 0)
})

test('timers wrappers : noyau partagé sérialisable sans app, délais remplacés et restauration', async () => {
  const { dom, session } = sessionSurDom('<div></div>')
  const appels = []
  const vrai = dom.window.setTimeout = (fn, ms, ...args) => { appels.push({ fn, ms, args }); return appels.length }
  const callback = () => {}
  await freezeTimeout(session, [30, 60])
  assert.notEqual(dom.window.setTimeout, vrai)
  dom.window.setTimeout(callback, 10, 'a')
  dom.window.setTimeout(callback, 0)
  dom.window.setTimeout(callback, 750)
  assert.deepEqual(appels.map((a) => a.ms), [30, 60, 60])
  assert.equal(appels[0].fn, callback)
  assert.deepEqual(appels[0].args, ['a'])
  await unfreezeTimeout(session)
  assert.equal(dom.window.setTimeout, vrai)
  await freezeTimeout(session, [])
  dom.window.setTimeout(callback, 8)
  assert.equal(appels.at(-1).ms, 8)
  await unfreezeTimeout(session)
})

const FENETRE = (boutons) => `<div class="modal-overlay">${boutons}</div>`
/** Bouton qui FERME la fenêtre au clic. */
const fermant = (doc, texte) => {
  const b = doc.createElement('button')
  b.textContent = texte
  b.onclick = () => doc.querySelector('.modal-overlay').remove()
  return b
}

test('resoudreModales : une fenêtre sans bouton actif qui gagne « Appliquer » à la 3ᵉ lecture se résout', async () => {
  const { doc, etat, session } = pagePilotee(FENETRE('<button disabled>Lancer</button>'), {
    auxLectures: (n, d) => { if (n === 3) d.querySelector('.modal-overlay').replaceChildren(fermant(d, 'Appliquer')) },
  })
  await resoudreModales(session, 'roulis', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Appliquer'])
  assert.equal(doc.querySelector('.modal-overlay'), null)
})

test('resoudreModales : une fenêtre qui reste sans geste lève à l’échéance en NOMMANT sa dernière lecture', async () => {
  const { session } = pagePilotee(FENETRE('<button disabled>Lancer</button><button>Aide</button>'))
  await assert.rejects(() => resoudreModales(session, undefined, { dans: '.modal-overlay', pauseMs: 5, attenteMs: 60 }), (e) => {
    assert.match(e.message, /^\[resoudreModales\] /)
    assert.doesNotMatch(e.message, /undefined/)
    assert.match(e.message, /dernière lecture/)
    assert.match(e.message, /Lancer \(désactivé\) \| Aide/)
    return true
  })
})

test('resoudreModales : une cascade Surprise se vide — « Tout lancer », roulis, puis « Terminer »', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"></div>', {
    auxLectures: (n, d) => {
      const f = d.querySelector('.modal-overlay')
      if (!f) return
      if (n === 1) {
        const tout = d.createElement('button')
        tout.textContent = 'Tout lancer'
        tout.onclick = () => f.replaceChildren(Object.assign(d.createElement('button'), { textContent: 'Terminer', disabled: true }))
        f.replaceChildren(tout)
      }
      if (n === 4) f.replaceChildren(fermant(d, 'Terminer'))
    },
  })
  await resoudreModales(session, 'surprise', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Tout lancer', 'Terminer'])
})

// ------------------------------------------------- D4 : le pilote de combat

const lecture = (champs = {}) => ({
  battle: { round: 1, over: null, actif: 'h1', acted: false, movementUsed: 0, endTurnArmed: false, ...champs.battle },
  auto: { roundPause: false, activeModal: null, active: { id: 'h1', kind: 'hero', aiDriven: false, acted: false }, ...champs.auto },
  modale: champs.modale ?? false,
})

for (const [cas, l, attendu, opts] of [
  ['aucun combat', { ...lecture(), battle: null }, 'fini'],
  ['combat terminé', lecture({ battle: { over: 'victory' } }), 'fini'],
  ['arrêt atteint', lecture({ battle: { round: 3 } }), 'fini', { arret: (e) => e.battle.round >= 3 }],
  ['fenêtre au DOM', lecture({ modale: true }), 'resoudre'],
  ['modale active au store', lecture({ auto: { activeModal: 'pendingAttack' } }), 'resoudre'],
  ['pause de début de Round', lecture({ auto: { roundPause: true, active: null } }), 'ouvrirRound'],
  ['tour d’un héros piloté', lecture(), 'finirTour'],
  ['plaque ARMÉE (second temps de fin de tour)', lecture({ battle: { endTurnArmed: true }, auto: { active: null } }), 'finirTour'],
  ['tour d’IA', lecture({ auto: { active: { id: 'g1', kind: 'enemy', aiDriven: true, acted: false } } }), 'attendre'],
  ['aucun acteur', lecture({ auto: { active: null } }), 'attendre'],
]) {
  test(`prochainGeste : ${cas} → ${attendu}`, () => {
    assert.equal(prochainGeste(l, opts), attendu)
  })
}

test('finDuTour : plaque armée au premier clic → un SECOND clic passe la main', async () => {
  let arme = false
  const { etat, session } = pagePilotee('<div class="combat-console"><button data-action="end-turn">Fin du tour<span>Action non dépensée</span></button></div>', {
    battle: () => ({ endTurnArmed: arme }),
  })
  socketDe(session).gerer = ((rpc) => async (m, p) => {
    const r = await rpc(m, p)
    if (m === 'Input.dispatchMouseEvent' && p.type === 'mouseReleased') arme = !arme && etat.cliques.length === 1
    return r
  })(socketDe(session).gerer)
  assert.equal(await finDuTour(session, { pauseMs: 1 }), 2)
  assert.equal(etat.cliques.length, 2)
})

test('finDuTour : plaque non armée → un seul clic', async () => {
  const { etat, session } = pagePilotee('<div class="combat-console"><button data-action="end-turn">Fin du tour</button></div>', {
    battle: () => ({ endTurnArmed: false }),
  })
  assert.equal(await finDuTour(session, { pauseMs: 1 }), 1)
  assert.equal(etat.cliques.length, 1)
})

test('piloterCombat : rend la lecture après sélection explicite de Parade', async () => {
  const bataille = { round: 1, over: false, actif: 'h1', acted: false, movementUsed: 0, endTurnArmed: false }
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button>Esquive</button></div><button id="lancer" disabled>Lancer</button></div></div>', { cascade: true })
  dom.window.__wfrp = { battle: () => bataille, auto: () => ({ roundPause: false, activeModal: 'pendingCascade', cascade: cascadeAffichage(dom), active: { id: 'h1', kind: 'hero' } }) }
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#lancer').disabled = false }
  doc.querySelector('#lancer').onclick = () => { doc.querySelector('.modal-overlay').remove(); bataille.over = true }
  await clickButtonByText(session, 'Parade', { dans: '.modal-overlay' })
  const r = await piloterCombat(session, { pauseMs: 1 })
  assert.equal(r.lecture.battle.over, true)
})



test('piloterCombat : budget épuisé → levée qui NOMME la dernière lecture', async () => {
  const session = { rpc: async () => ({ result: { value: lecture({ auto: { active: { id: 'g1', kind: 'enemy', aiDriven: true } } }) } }) }
  await assert.rejects(() => piloterCombat(session, { budget: 2, pauseMs: 1 }), /dernière lecture : .*"aiDriven":true/)
})

// ------------------------------------------------- D6, K15 : la console, tous niveaux

/** Session minimale à écouteurs : `emettre(m)` joue un message CDP. */
function sessionEcoutee() {
  const listeners = new Set()
  return { sessionId: 'S1', listeners, emettre: (m) => { for (const fn of listeners) fn({ sessionId: 'S1', ...m }) } }
}

test('consoleGuard : TOUS les niveaux enregistrés ; errors() juge, warnings() se liste, log/info ne jugent pas', () => {
  const s = sessionEcoutee()
  const g = consoleGuard(s)
  for (const type of ['log', 'info', 'warning', 'error']) s.emettre({ method: 'Runtime.consoleAPICalled', params: { type, args: [{ value: type }] } })
  s.emettre({ method: 'Runtime.exceptionThrown', params: { exceptionDetails: { text: 'boum' } } })
  s.emettre({ method: 'Log.entryAdded', params: { entry: { level: 'error', source: 'network', text: 'Failed to load resource: 404', url: '/x.png' } } })
  s.emettre({ method: 'Log.entryAdded', params: { entry: { level: 'warning', source: 'security', text: 'CSP' } } })
  s.listeners.forEach((fn) => fn({ sessionId: 'AUTRE', method: 'Runtime.consoleAPICalled', params: { type: 'error', args: [{ value: 'voisine' }] } }))
  assert.deepEqual(g.entries.map((e) => e.type), ['log', 'info', 'warning', 'error', 'exception', 'error', 'warning'])
  assert.deepEqual(g.errors().map((e) => e.text), ['error', 'boum', 'Failed to load resource: 404 (/x.png)'])
  assert.deepEqual(g.warnings().map((e) => e.text), ['warning', 'CSP'])
})

test('consoleDuJournal : le journal du gardien se lit À PARTIR de l’attache (décalage en octets)', () => {
  const avant = `${JSON.stringify({ type: 'error', source: 'runtime', text: 'avant l’attache' })}\n`
  const apres = `${JSON.stringify({ type: 'warning', source: 'runtime', text: 'après' })}\n${JSON.stringify({ type: 'error', source: 'runtime', text: 'pendant' })}\n`
  const c = consoleDuJournal('j', Buffer.byteLength(avant), { lire: () => Buffer.from(avant + apres) })
  assert.deepEqual(c.errors().map((e) => e.text), ['pendant'])
  assert.deepEqual(c.warnings().map((e) => e.text), ['après'])
})

// ------------------------------------------------- D5, K6-K9 : session TENUE

test('Chrome n’est JAMAIS lancé `detached` : il meurt avec le process qui le tient (K9)', () => {
  assert.equal('detached' in OPTIONS_SPAWN_CHROME, false)
  assert.equal(Object.isFrozen(OPTIONS_SPAWN_CHROME), true)
})

test('fichierDeSession : un fichier PAR ARBRE, la même racine écrite autrement donne le même', () => {
  const a = fichierDeSession('C' + ':/x/Game/.wt-a', '/tmp')
  assert.notEqual(a, fichierDeSession('C' + ':/x/Game/.wt-b', '/tmp'))
  assert.equal(a, fichierDeSession('c' + ':\\x\\Game\\.wt-a\\', '/tmp'))
  assert.match(a, /recette-session-[0-9a-f]{12}\.json$/)
})

test('descripteurSession : de quoi s’attacher, observer et nettoyer', () => {
  const d = descripteurSession({ pidGardien: 7, session: { chrome: { pid: 9 }, port: 9333, targetId: 'T', profile: '/tmp/p' }, url: 'http://u/', journal: '/tmp/j', vue: { nom: 'bureau', largeur: 1, hauteur: 2 }, racine: 'C' + ':/x' })
  assert.deepEqual(Object.keys(d).sort(), ['journal', 'pidChrome', 'pidGardien', 'port', 'profil', 'racine', 'targetId', 'url', 'vue'])
  assert.equal(d.pidChrome, 9)
})

/** Disque en mémoire : `fichiers` (chemin → texte) et `dossiers` (ensemble). */
function disqueMemoire(fichiers = {}, dossiers = []) {
  const f = new Map(Object.entries(fichiers))
  const d = new Set(dossiers)
  const liens = new Map()
  const existe = (c) => f.has(c) || d.has(c)
  return {
    f, d, liens,
    existe,
    lire: (c) => f.get(c),
    ecrire: (c, contenu, { exclusif = false } = {}) => {
      if (exclusif && existe(c)) throw Object.assign(new Error(`EEXIST: ${c}`), { code: 'EEXIST' })
      f.set(c, contenu)
    },
    lireLien: (c) => liens.get(c) ?? null,
    lister: () => [...d, ...f.keys()].map((c) => c.split('/').pop()),
    supprimer: (c) => { f.delete(c); d.delete(c) },
  }
}

const SESSION = JSON.stringify({ pidGardien: 41, port: 9333, targetId: 'T1', journal: '/tmp/j', profil: '/tmp/recette-cdp-profile-1' })

/** Fausse socket CDP de niveau navigateur : note ce qui part, répond à l'attache. */
function fausseSocket({ erreurs = {} } = {}) {
  const ecoutes = { message: [], close: [] }
  const ws = {
    envoyes: [],
    addEventListener: (t, fn) => ecoutes[t].push(fn),
    send(brut) {
      if (ws.readyState !== WebSocket.OPEN) return // WHATWG WebSockets, `send()` : muet en CLOSING/CLOSED
      const m = JSON.parse(brut)
      ws.envoyes.push(m)
      const result = m.method === 'Target.attachToTarget' ? { sessionId: 'S-client' } : {}
      const reponse = erreurs[m.method] ? { id: m.id, error: { message: erreurs[m.method] } } : { id: m.id, result }
      setTimeout(() => ecoutes.message.forEach((fn) => fn({ data: JSON.stringify(reponse) })))
    },
    readyState: WebSocket.OPEN,
    close: () => { ws.ferme = true; ws.readyState = WebSocket.CLOSED },
  }
  setTimeout(() => ws.onopen?.())
  return ws
}

const attacheFactice = (champs = {}, erreurs = {}) => {
  const ws = fausseSocket({ erreurs })
  const signaux = []
  const opts = {
    disque: disqueMemoire({ '/tmp/s.json': SESSION }), vivant: () => true,
    recuperer: async () => ({ json: async () => ({ webSocketDebuggerUrl: 'ws://x' }) }),
    connecter: () => ws, taille: () => 0, signaler: (c) => signaux.push(c), delaiMs: 50, ...champs,
  }
  return { ws, signaux, opts }
}

test('attacherSession : s’attache au niveau NAVIGATEUR ; close DÉTACHE sans fermer la cible ni rien tuer', async () => {
  const { ws, signaux, opts } = attacheFactice()
  const s = await attacherSession('/tmp/s.json', opts)
  assert.equal(s.sessionId, 'S-client')
  assert.equal(s.chrome, null)
  await s.close()
  const methodes = ws.envoyes.map((m) => m.method)
  assert.deepEqual(methodes, ['Target.attachToTarget', 'Target.detachFromTarget'])
  assert.ok(ws.envoyes.every((m) => !('sessionId' in m)), 'attache et détache partent au niveau navigateur')
  assert.equal(ws.envoyes[1].params.sessionId, 'S-client')
  assert.ok(!methodes.includes('Target.closeTarget'))
  assert.deepEqual(signaux, ['/tmp/s.json.actif', '/tmp/s.json.vue'])
})

test('attacherSession : close tolère une cible DÉJÀ partie, et fait remonter toute autre erreur', async () => {
  const partie = attacheFactice({}, { 'Target.detachFromTarget': 'No session with given id' })
  await (await attacherSession('/tmp/s.json', partie.opts)).close()
  assert.equal(partie.ws.ferme, true)
  const autre = attacheFactice({}, { 'Target.detachFromTarget': 'Internal error' })
  await assert.rejects(async () => (await attacherSession('/tmp/s.json', autre.opts)).close(), /Internal error/)
})

/** Borne une promesse : `PENDU` si elle ne se règle pas en `ms` (le test rougit au lieu de pendre). */
const bornee = (p, ms = 1000) => Promise.race([p.then(() => 'résolu', (e) => e), new Promise((r) => setTimeout(() => r('PENDU'), ms))])

test('brancherCdp : un appel sur socket FERMÉE est REJETÉ sans pendre, typé cible partie', async () => {
  const ws = fausseSocket()
  const session = brancherCdp(ws)
  ws.close()
  const issue = await bornee(session.rpcNavigateur('Target.detachFromTarget', { sessionId: 'x' }))
  assert.ok(issue instanceof Error, `attendu un rejet, obtenu ${issue}`)
  assert.equal(issue.code, TARGET_NAVIGATED)
  assert.deepEqual(ws.envoyes, [])
})

test('attacherSession : close() d’une session dont la socket est déjà FERMÉE se résout', async () => {
  const { ws, opts } = attacheFactice()
  const s = await attacherSession('/tmp/s.json', opts)
  ws.close()
  assert.equal(await bornee(s.close()), 'résolu')
})

test('attacherSession : gardien MORT ou CDP muet → refus NOMMÉ, sans pendre', async () => {
  await assert.rejects(() => attacherSession('/tmp/s.json', attacheFactice({ vivant: () => false }).opts), /gardien \(pid 41\) est MORT/)
  await assert.rejects(() => attacherSession('/tmp/s.json', attacheFactice({ recuperer: async () => { throw new Error('ECONNREFUSED') } }).opts), /CDP muet sur le port 9333/)
  await assert.rejects(() => attacherSession('/tmp/absent.json', attacheFactice().opts), /aucune session tenue/)
})

test('fermerSession : IDEMPOTENT — aucune session, gardien vivant (signal), gardien mort (purge vérifiée)', async () => {
  assert.deepEqual(await fermerSession('/tmp/s.json', { disque: disqueMemoire() }), { etat: 'aucune' })

  const vivantDisque = disqueMemoire({ '/tmp/s.json': SESSION })
  const signaux = []
  const ferme = await fermerSession('/tmp/s.json', { disque: vivantDisque, vivant: () => true, signaler: (c) => { signaux.push(c); vivantDisque.supprimer('/tmp/s.json') }, pasMs: 1 })
  assert.deepEqual(ferme, { etat: 'fermee' })
  assert.deepEqual(signaux, ['/tmp/s.json.fermer'])

  const mortDisque = disqueMemoire({ '/tmp/s.json': SESSION, '/tmp/j': '' }, ['/tmp/recette-cdp-profile-1'])
  const r = await fermerSession('/tmp/s.json', { disque: mortDisque, vivant: () => false })
  assert.equal(r.etat, 'gardien-mort')
  assert.equal(r.profilPurge, true)
  assert.equal(mortDisque.existe('/tmp/recette-cdp-profile-1'), false)
  assert.equal(mortDisque.existe('/tmp/s.json'), false)
  assert.deepEqual(await fermerSession('/tmp/s.json', { disque: mortDisque }), { etat: 'aucune' })
})

test('purgerProfilsOrphelins : FAIL-SAFE — lanceur vivant ÉPARGNÉ (gardien ou session ponctuelle), lanceur mort PURGÉ, sans PID ÉPARGNÉ', async () => {
  const dossier = resolvePath('/tmp')
  const ponctuel = nomDeProfil(101) // `launchSession` d'un autre arbre, sans fichier de session
  const mort = nomDeProfil(202)
  const ancien = 'recette-cdp-profile-1700000000000-42' // nom sans PID
  const noms = [ponctuel, mort, ancien, 'autre-dossier']
  const disque = disqueMemoire({}, noms.map((n) => resolvePath(dossier, n)))
  disque.lister = () => noms.filter((n) => disque.existe(resolvePath(dossier, n)))
  const bilan = await purgerProfilsOrphelins({ dossier, disque, vivant: (pid) => pid === 101, plateforme: 'win32' })
  assert.deepEqual(bilan, { trouves: 3, purges: 1, vivants: 1, sansPreuve: [resolvePath(dossier, ancien)], echecs: [] })
  assert.equal(disque.existe(resolvePath(dossier, ponctuel)), true)
  assert.equal(disque.existe(resolvePath(dossier, mort)), false)
  assert.equal(disque.existe(resolvePath(dossier, ancien)), true)
})

/** Cinq profils de lanceurs MORTS, chacun avec son `SingletonLock` (ou sans). */
function profilsAVerrou() {
  const dossier = resolvePath('/tmp')
  const n = { chromeVivant: nomDeProfil(301), chromeMort: nomDeProfil(302), sansVerrou: nomDeProfil(303), autreHote: nomDeProfil(304), illisible: nomDeProfil(305) }
  const noms = Object.values(n)
  const disque = disqueMemoire({}, noms.map((x) => resolvePath(dossier, x)))
  disque.lister = () => noms.filter((x) => disque.existe(resolvePath(dossier, x)))
  const verrou = (x) => resolvePath(dossier, x, 'SingletonLock')
  disque.liens.set(verrou(n.chromeVivant), 'hote-a-9001')
  disque.liens.set(verrou(n.chromeMort), 'hote-a-9002')
  disque.liens.set(verrou(n.autreHote), 'hote-b-9003')
  disque.liens.set(verrou(n.illisible), 'sans-pid')
  const chemin = (x) => resolvePath(dossier, x)
  return { dossier, disque, n, chemin, vivant: (pid) => pid === 9001 || pid === 9003 }
}

test('purgerProfilsOrphelins : hors win32, le Chrome du `SingletonLock` doit AUSSI être mort, sur CET hôte', async () => {
  const { dossier, disque, n, chemin, vivant } = profilsAVerrou()
  const bilan = await purgerProfilsOrphelins({ dossier, disque, vivant, plateforme: 'linux', hote: 'hote-a' })
  assert.deepEqual(bilan, { trouves: 5, purges: 2, vivants: 1, sansPreuve: [chemin(n.autreHote), chemin(n.illisible)], echecs: [] })
  assert.equal(disque.existe(chemin(n.chromeVivant)), true)
  assert.equal(disque.existe(chemin(n.chromeMort)), false)
  assert.equal(disque.existe(chemin(n.sansVerrou)), false)
})

test('purgerProfilsOrphelins : sous win32, le lanceur mort suffit (job object) — le verrou n’est pas lu', async () => {
  const { dossier, disque, vivant } = profilsAVerrou()
  disque.lireLien = () => { throw new Error('verrou lu sous win32') }
  const bilan = await purgerProfilsOrphelins({ dossier, disque, vivant, plateforme: 'win32', hote: 'hote-a' })
  assert.deepEqual(bilan, { trouves: 5, purges: 5, vivants: 0, sansPreuve: [], echecs: [] })
})

test('nomDeProfil / pidDeProfil : le PID du lanceur se consigne et se relit ; un nom ancien n’en porte aucun', () => {
  assert.equal(pidDeProfil(nomDeProfil(4321)), 4321)
  assert.equal(pidDeProfil('recette-cdp-profile-1700000000000-42'), null)
})

// ------------------------------------------------- setup.mjs : la mise en place partagée

test('demarrer : scénario et rencontre posés par `__wfrp`, le premier Round OUVERT au vrai bouton', async () => {
  const appels = []
  const { dom, etat, session } = pagePilotee('<div class="cc-phase"><button data-action="round-start">Commencer le combat</button></div>')
  dom.window.__wfrp = {
    scenario: (id, graine) => { appels.push(`scenario:${id}:${graine}`); return '✓' },
    ready: () => true,
    fight: (id) => { appels.push(`fight:${id}`); return '✓' },
    store: { getState: () => ({ pendingRoundStart: {} }) },
  }
  const r = await demarrer({ session, scenario: 'entrainement', graine: 4, combat: 'enc-entrainement' })
  assert.equal(r.session, session)
  assert.deepEqual(appels, ['scenario:entrainement:4', 'fight:enc-entrainement'])
  assert.deepEqual(etat.cliques, ['Commencer le combat'])
})

test('demarrer : un accueil interactif reste ouvert sans événement', async () => {
  const { dom, doc, session, etat } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Accueil"><div class="seg"><button>Nord</button><button>Sud</button></div><button id="go" disabled>Continuer</button></div></div>')
  dom.window.__wfrp = { scenario: () => '✓', ready: () => true }
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#go').disabled = false }
  doc.querySelector('#go').onclick = () => doc.querySelector('.modal-overlay').remove()
  await assert.rejects(() => demarrer({ session, scenario: 'x' }), /choix joueur requis.*Nord.*Sud/)
  assert.deepEqual(etat.emis, [])
  assert.ok(doc.querySelector('.modal-overlay'))
})

test('demarrer : après sélection explicite, une rencontre refusée remonte', async () => {
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Accueil"><div class="seg"><button>Nord</button><button>Sud</button></div><button id="go" disabled>Continuer</button></div></div>')
  dom.window.__wfrp = { scenario: () => '✓', ready: () => true, fight: () => '✗ rencontre inconnue' }
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#go').disabled = false }
  doc.querySelector('#go').onclick = () => doc.querySelector('.modal-overlay').remove()
  await clickButtonByText(session, 'Nord', { dans: '.modal-overlay' })
  await assert.rejects(() => demarrer({ session, scenario: 'x', combat: 'y' }), (e) => {
    assert.match(e.message, /rencontre inconnue/)
    return true
  })
})

test('demarrer : une rencontre REFUSÉE lève en la nommant ; il ne ferme que la session qu’il a OUVERTE', async () => {
  const refusante = () => {
    const { dom, session } = pagePilotee('<div></div>')
    session.fermee = false
    session.close = async () => { session.fermee = true }
    dom.window.__wfrp = { scenario: () => '✓', ready: () => true, fight: () => '✗ rencontre inconnue', store: { getState: () => ({}) } }
    return session
  }
  const donnee = refusante()
  await assert.rejects(() => demarrer({ session: donnee, scenario: 'entrainement', combat: 'enc-x' }), /appelerWfrp « fight » : refus — ✗ rencontre inconnue/)
  assert.equal(donnee.fermee, false)
  const ouverte = refusante()
  await assert.rejects(() => demarrer({ ouvrir: async () => ouverte, scenario: 'entrainement', combat: 'enc-x' }), /refus — ✗/)
  assert.equal(ouverte.fermee, true)
})

// ------------------------------------------------- K16 : capture d'un pion

test('capturerPion : cadre centré sur la case projetée du combattant, agrandi `zoom` fois', async () => {
  const demandes = []
  const session = {
    rpc: async (m, p) => {
      if (m === 'Runtime.evaluate') return { result: { value: { x: 400, y: 300 } } }
      demandes.push({ m, p })
      throw new Error('capture interceptée')
    },
  }
  const dir = mkdtempSync(joinPath(os.tmpdir(), 'recette-capturer-pion-'))
  try {
    await assert.rejects(() => capturerPion(session, 'h1', { zoom: 4, cote: 100, dir }), /capture interceptée/)
    assert.deepEqual(demandes, [{ m: 'Page.captureScreenshot', p: { format: 'png', clip: { x: 350, y: 225, width: 100, height: 100, scale: 4 } } }])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('capturerPion : un combattant sans case projetée est REFUSÉ en le nommant', async () => {
  const session = { rpc: async () => ({ result: { value: null } }) }
  await assert.rejects(() => capturerPion(session, 'fantome'), /« fantome » n'a pas de case projetée/)
})


// ------------------------------------------------- un contrôle FERMÉ ne se clique pas en silence

test('clickButtonByText : un bouton `disabled` LÈVE en nommant le mécanisme, et rien n’est émis', async () => {
  const { etat, session } = pagePilotee('<button disabled>Lancer</button>')
  await assert.rejects(() => clickButtonByText(session, 'Lancer'), /contrôle FERMÉ \(disabled\) — aucune raison affichée/)
  assert.deepEqual(etat.emis, [])
})

test('clickButtonByText : un bouton `aria-disabled` (GatedAction) LÈVE en citant sa raison affichée', async () => {
  const { etat, session } = pagePilotee('<button aria-disabled="true" aria-describedby="r1">Retirer</button><p id="r1">La composition du groupe ne change pas en combat.</p>')
  await assert.rejects(() => clickButtonByText(session, 'Retirer'), /FERMÉ \(aria-disabled\) — raison affichée : « La composition du groupe ne change pas en combat\. »/)
  assert.deepEqual(etat.emis, [])
})

test('cliquerSelecteur : le MÊME contrôle fermé que les localisateurs par texte', async () => {
  const { dom, session } = pagePilotee('<button class="x" disabled>X</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 10, height: 10 }) // une boîte rendue
  await assert.rejects(() => cliquerSelecteur(session, '.x'), /contrôle FERMÉ \(disabled\)/)
})

// ------------------------------------------------- `summary` est un contrôle

test('clickButtonByText : un `<summary>` de `<details>` se vise par son texte (« + Op mécanique »)', async () => {
  const { dom, etat, session } = pagePilotee('<details class="eff-add"><summary>+ Op mécanique</summary><ul><li>op</li></ul></details>')
  await clickButtonByText(session, '+ Op mécanique')
  assert.deepEqual(etat.cliques, ['+ Op mécanique'])
  assert.equal(dom.window.document.querySelector('details').open, true)
})

// ------------------------------------------------- une fenêtre à CHOIX se tranche avant d'avancer

/** Fenêtre qui ne peut avancer qu'une fois TRANCHÉE : « Lancer » fermé tant qu'aucune option n'est retenue. */
const FENETRE_CHOIX = '<div class="modal-overlay"><div class="seg"><button>Parade</button><button>Esquive</button></div><button id="fermer">Fermer</button><button id="lancer" disabled>Lancer</button></div>'

/** Retenir une option ouvre « Lancer » (patron d'une fenêtre à choix obligatoire). */
const tranchable = (doc) => {
  for (const b of doc.querySelectorAll('.seg button')) b.onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#lancer').disabled = false }
  doc.querySelector('#lancer').onclick = () => doc.querySelector('.modal-overlay').remove()
}

test('resoudreModales : refuse avant geste puis draine après sélection explicite', async () => {
  const { doc, etat, session } = pagePilotee(FENETRE_CHOIX)
  tranchable(doc)
  await assert.rejects(() => resoudreModales(session, 'choix', { dans: '.modal-overlay' }), /choix joueur requis.*Parade.*Esquive/)
  assert.deepEqual(etat.emis, [])
  await clickButtonByText(session, 'Parade', { dans: '.modal-overlay' })
  await resoudreModales(session, 'choix', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 500 })
  assert.deepEqual(etat.cliques, ['Parade', 'Lancer'])
})

/** Défense avec la réaction Porte-Bouclier : groupe FACULTATIF sans défaut (Avantages à dépenser,
 *  aucune option retenue — `useDefenseJetProps`), la Défense elle-même déjà retenue, « Lancer » ouvert. */
const DEFENSE_PORTE_BOUCLIER = '<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button aria-pressed="true">Parade</button><button>Esquive</button></div><div class="rm-loc-grid"><button>Dégâts</button><button>Désarmer</button></div><button id="lancer">Lancer</button></div></div>'

test('resoudreModales : un groupe FACULTATIF sans défaut (Porte-Bouclier) n’est jamais tranché — « Lancer » ouvert est pris', async () => {
  const { doc, etat, session } = pagePilotee(DEFENSE_PORTE_BOUCLIER)
  doc.querySelector('#lancer').onclick = () => doc.querySelector('.modal-overlay').remove()
  await resoudreModales(session, 'defense', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 200 })
  assert.deepEqual(etat.cliques, ['Lancer'])
})

test('resoudreModales : une fenêtre à choix TRANCHÉE dont le seul bouton est « Fermer » n’est pas fermée — elle lève', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"><div class="seg"><button aria-pressed="true">Parade</button><button>Esquive</button></div><button>Fermer</button></div>')
  await assert.rejects(() => resoudreModales(session, 'choix', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 60 }), /rien à résoudre .*Fermer/)
  assert.deepEqual(etat.cliques, [])
})

test('resoudreModales : « Conclure » avance un marchandage', async () => {
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"></div>')
  doc.querySelector('.modal-overlay').append(fermant(doc, 'Conclure'))
  await resoudreModales(session, 'marchandage', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 500 })
  assert.deepEqual(etat.cliques, ['Conclure'])
})

const ZONE = { kind: 'zone', label: 'Comète à Deux Queues', casterId: 'h1', radius: 2, rangeTiles: 12 }
for (const [geste, nomme] of [
  [ZONE, /^Error: \[carte\] pose de zone en cours, cliquer une case — « Comète à Deux Queues » \(lanceur h1\)/],
  [{ kind: 'siege', label: 'Mortier', casterId: 'e2', radius: 1, rangeTiles: 30 }, /^Error: \[carte\] visée de siège en cours, cliquer une case — « Mortier » \(lanceur e2\)/],
  [{ kind: 'cibles', label: 'Flèche de feu', casterId: 'h3', cibles: ['g1'] }, /^Error: \[carte\] choix de cibles en cours, cliquer les cibles — « Flèche de feu » \(lanceur h3\)/],
]) {
  test(`resoudreModales : un geste carte « ${geste.kind} » attendu, sans fenêtre — jamais la main rendue, la levée NOMME le geste`, async () => {
    const { session } = pagePilotee('<div></div>', { jeu: { gesteCarte: geste } })
    await assert.rejects(() => resoudreModales(session, 'carte', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 500 }), nomme)
  })
}

test('prochainGeste : un geste carte attendu passe la main à `resoudreModales` (qui le nomme)', () => {
  assert.equal(prochainGeste({ ...lecture(), gesteCarte: ZONE }), 'resoudre')
})

// ------------------------------------------------- `realKey` : les chiffres

test('realKey : un chiffre se déduit en `DigitN` et son code virtuel (réponse de dialogue au clavier)', async () => {
  const s = sessionClavier()
  await realKey(s, { key: '1' })
  assert.equal(s.emis[0].code, 'Digit1')
  assert.equal(s.emis[0].windowsVirtualKeyCode, 49)
})

// ------------------------------------------------- `selectOption` : par libellé visible

const LISTE = '<select id="ch"><option value="20">Chapitre 20 — Le Bac</option><option value="21">Chapitre 21 — Les Saints</option></select>'

test('selectOption : l’option se désigne par son LIBELLÉ visible ; la valeur interne sur demande', async () => {
  const { dom, session } = pagePilotee(LISTE)
  const el = dom.window.document.querySelector('#ch')
  assert.deepEqual({ ...(await selectOption(session, '#ch', 'Chapitre 21 — Les Saints')) }, { valeur: '21', libelle: 'Chapitre 21 — Les Saints' })
  assert.equal(el.value, '21')
  assert.equal((await selectOption(session, '#ch', '20', { par: 'valeur' })).valeur, '20')
})

test('selectOption : aucun libellé ne correspond → refus qui LISTE les libellés offerts', async () => {
  const { session } = pagePilotee(LISTE)
  await assert.rejects(() => selectOption(session, '#ch', '21'), /aucune option de LIBELLÉ « 21 » — libellés offerts : Chapitre 20 — Le Bac \| Chapitre 21 — Les Saints/)
})

// ------------------------------------------------- `tenirSession` : aucun journal laissé sur échec

test('tenirSession : un amorçage qui échoue ne laisse ni journal ni fichier de session', async () => {
  const fichier = joinPath(os.tmpdir(), `recette-session-test-${process.pid}.json`)
  await assert.rejects(() => tenirSession('http://x/', { fichier, ouvrir: async () => { throw new Error('amorçage refusé') } }), /amorçage refusé/)
  assert.equal(existsSync(fichier.replace(/\.json$/, '.console.jsonl')), false)
  assert.equal(existsSync(fichier), false)
})

test('tenirSession : un journal DÉJÀ tenu (autre gardien) refuse avant toute ouverture, et reste en place', async () => {
  const disque = disqueMemoire({ '/tmp/s.console.jsonl': 'autre' })
  let ouvert = false
  await assert.rejects(() => tenirSession('http://x/', { fichier: '/tmp/s.json', disque, ouvrir: async () => { ouvert = true } }), /journal .* déjà tenu par un autre gardien/)
  assert.equal(ouvert, false)
  assert.equal(disque.lire('/tmp/s.console.jsonl'), 'autre')
})

test('tenirSession : un fichier de session apparu pendant l’ouverture n’est PAS écrasé — refus nommé, seul le journal propre est retiré', async () => {
  const disque = disqueMemoire()
  let ferme = false
  const ouvrir = async () => {
    disque.f.set('/tmp/s.json', JSON.stringify({ pidGardien: 77 }))
    return { close: async () => { ferme = true; return { profilPurge: true } } }
  }
  await assert.rejects(() => tenirSession('http://x/', { fichier: '/tmp/s.json', disque, ouvrir, vivant: (pid) => pid === 77, inactiviteMs: 20, pasMs: 5 }), /déjà tenue par le gardien 77/)
  assert.equal(ferme, true)
  assert.equal(JSON.parse(disque.lire('/tmp/s.json')).pidGardien, 77)
  assert.equal(disque.existe('/tmp/s.console.jsonl'), false)
})

// ------------------------------------------------- `resoudreModales` : choix RENDUS, contrôles par `SELECTEUR_CONTROLES`

test('resoudreModales : refus nomme fenêtre et options ouvertes sans sélectionner', async () => {
  const { doc, session, etat } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button disabled>Esquive</button><button>Aucune</button></div><button id="lancer" disabled>Lancer</button></div></div>')
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#lancer').disabled = false }
  doc.querySelector('#lancer').onclick = () => doc.querySelector('.modal-overlay').remove()
  await assert.rejects(() => resoudreModales(session, 'choix', { dans: '.modal-overlay' }), /choix joueur requis.*Défense.*Parade.*Aucune/)
  assert.deepEqual(etat.emis, [])
})

test('resoudreModales : un bouton d’avancement `[role="button"]` se lit comme un `<button>`', async () => {
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="button" id="l">Lancer</div></div>')
  doc.querySelector('#l').onclick = () => doc.querySelector('.modal-overlay').remove()
  assert.equal(await resoudreModales(session, 'role', { dans: '.modal-overlay', pauseMs: 5, attenteMs: 200 }), undefined)
  assert.deepEqual(etat.cliques, ['Lancer'])
})

// ------------------------------------------------- `cliquerPremierOffert` : la primitive des issues de fenêtre

test('cliquerPremierOffert : le premier libellé OFFERT par un contrôle ouvert, dans l’ordre de préférence', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"><button disabled>Renoncer</button><button>Annuler le jet</button><button>Fermer</button></div>')
  assert.equal(await cliquerPremierOffert(session, ['Renoncer', 'Annuler', 'Fermer']), 'Annuler le jet')
  assert.deepEqual(etat.cliques, ['Annuler le jet'])
})

test('cliquerPremierOffert : aucun libellé offert → LÈVE en nommant les contrôles ouverts, aucun clic émis', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"><button>Valider</button><button aria-disabled="true">Fermer</button></div>')
  await assert.rejects(() => cliquerPremierOffert(session, ['Renoncer', 'Fermer']), /aucun de « Renoncer \| Fermer » parmi les contrôles ouverts de « \.modal-overlay » — offerts : Valider$/)
  assert.deepEqual(etat.emis, [])
})

test('nom accessible explicite : aria-label prime sur les Blessures rendues du portrait', async () => {
  const { dom, doc, etat, session } = pagePilotee('<div class="party-dock"><button class="ptile" aria-label="Tireur (entraînement) — fiche du personnage"><span>14/14</span></button></div><button aria-label="Inspecter">Autre texte</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 20, width: 40, height: 10 })
  await clickButtonByText(session, 'Tireur (entraînement)', { exact: false, dans: '.party-dock' })
  assert.deepEqual(etat.cliques, ['14/14'])
  await assert.rejects(() => clickButtonByText(session, '14/14', { attenteMs: 0 }), /aucune cible « 14\/14 »/)
  await clickButtonByText(session, 'Inspecter')
  assert.equal(etat.cliques.at(-1), 'Autre texte')
  await survoler(session, { nom: 'Tireur (entraînement) — fiche du personnage' }, { attenteMs: 0 })
  assert.equal(doc.querySelector('.ptile').textContent, '14/14')
})

test('action paramétrée : ambiguïté refusée avant événement, cellule stable sélectionnée', async () => {
  const { etat, session } = pagePilotee('<div class="combat-console"><button data-action="cast-spell" data-cell="sort-lumiere">Lumière</button><button data-action="cast-spell" data-cell="sort-dome">Dôme</button></div>')
  await assert.rejects(() => cliquerAction(session, 'cast-spell'), /2 cibles ambiguës.*Lumière.*Dôme/)
  assert.deepEqual(etat.emis, [])
  await cliquerAction(session, 'cast-spell', { cell: 'sort-dome' })
  assert.deepEqual(etat.cliques, ['Dôme'])
  await assert.rejects(() => cliquerAction(session, 'cast-spell', { cell: 'sort-inconnu' }), /cellule « sort-inconnu ».*aucune case/)
})

// ------------------------------------------------- `cliquerAction` : le contrôle fermé est celui de `geste`

const CASE = (attrs, raison = '') => `<div class="combat-console"><button data-action="tir" ${attrs}>Tir${raison}</button></div>`

test('cliquerAction : une case FERMÉE qui porte sa raison lève par `geste`, raison citée, aucun clic', async () => {
  const { etat, session } = pagePilotee(CASE('data-gated aria-disabled="true" aria-describedby="g"', '<span data-gate id="g">Aucune munition</span>'))
  await assert.rejects(() => cliquerAction(session, 'tir'), /cliquerAction « \[data-action="tir"\] » dans « \.combat-console » : contrôle FERMÉ \(aria-disabled\) — raison affichée : « Aucune munition »/)
  assert.deepEqual(etat.emis, [])
})

test('cliquerAction : une case OUVERTE dont seul le geste secondaire est refusé (`data-gated`) se clique', async () => {
  const { etat, session } = pagePilotee(CASE('data-gated data-refus-2e aria-describedby="g"', '<span data-gate id="g">Focaliser : hors portée</span>'))
  await cliquerAction(session, 'tir')
  assert.equal(etat.cliques.length, 1)
})

// ------------------------------------------------- `selectOption` : ambiguïté et option fermée refusées

test('selectOption : libellé ambigu refusé avant clic, focus, input et change ; valeur explicite départage', async () => {
  const { doc, etat, session } = pagePilotee('<select id="d"><option value="a">Dague</option><option value="b">Dague</option></select>')
  const evenements = []
  for (const nom of ['focus', 'input', 'change']) doc.querySelector('select').addEventListener(nom, () => evenements.push(nom))
  await assert.rejects(() => selectOption(session, '#d', 'Dague'), /selectOption : 2 cibles ambiguës « Dague » — option « Dague » \| option « Dague » — préciser/)
  assert.equal(doc.querySelector('[data-recette-cible]'), null)
  assert.deepEqual(etat.emis, [])
  assert.deepEqual(evenements, [])
  assert.equal(doc.querySelector('select').value, 'a')
  assert.equal((await selectOption(session, '#d', 'b', { par: 'valeur' })).valeur, 'b')
  assert.deepEqual(evenements, ['focus', 'input', 'change'])
})

test('selectOption : une option `disabled` est REFUSÉE comme un contrôle fermé — la liste ne change pas', async () => {
  const { dom, session } = pagePilotee('<select id="d"><option value="a">Dague</option><option value="b" disabled>Épée</option></select>')
  await assert.rejects(() => selectOption(session, '#d', 'Épée'), /option « Épée » FERMÉE \(disabled\) — aucun choix émis/)
  assert.equal(dom.window.document.querySelector('#d').value, 'a')
})

// ------------------------------------------------- aucune erreur AVALÉE : chaque `catch` filtre la sienne

const erreurDeCode = (code, message = code) => Object.assign(new Error(message), { code })

test('fichiersSurveilles : un chemin ABSENT se saute, toute autre erreur de lecture remonte', () => {
  assert.deepEqual(fichiersSurveilles('/x', { stat: () => { throw erreurDeCode('ENOENT') } }), [])
  assert.throws(() => fichiersSurveilles('/x', { stat: () => { throw erreurDeCode('EACCES') } }), /EACCES/)
})

test('killChromeTree : le verdict vient des descendants observés avant et après, y compris code 255', () => {
  const chrome = { pid: 42 }
  const avant = [{ pid: 42, parent: 1, cree: 1 }, { pid: 43, parent: 42, cree: 2 }, { pid: 44, parent: 43, cree: 3 }]
  const observer = (apres) => { let n = 0; return () => n++ ? apres : avant }
  for (const status of [0, 128, 255, 1]) killChromeTree(chrome, { plateforme: 'win32', observer: observer([]), executer: () => ({ status }) })
  assert.throws(() => killChromeTree(chrome, { plateforme: 'win32', observer: observer([{ pid: 44, parent: 1, cree: 3 }]), executer: () => ({ status: 255 }) }), /survivants 44/)
  assert.throws(() => killChromeTree(chrome, { observer: () => { throw new Error('observation refusée') } }), /observation refusée/)
  const tues = []
  killChromeTree(chrome, { plateforme: 'linux', observer: observer([]), tuerPid: (pid) => tues.push(pid) })
  assert.deepEqual(tues, [44, 43, 42])
})


test('killChromeTree : extinction différée observée, descendants cumulés et pause bornée', () => {
  let now = 0, lectures = 0
  const pauses = []
  const snapshots = [[{pid:42,parent:1,cree:0},{pid:43,parent:42,cree:0}], [{pid:43,parent:1,cree:0},{pid:44,parent:43,cree:0}], [{pid:44,parent:1,cree:0}], []]
  const result = killChromeTree({pid:42}, {
    plateforme:'win32', executer:()=>({status:128}),
    observer:()=>snapshots[Math.min(lectures++, snapshots.length-1)],
    horloge:()=>now, patienter:ms=>{pauses.push(ms);now+=ms}, attenteMs:75,
  })
  assert.deepEqual(result.observes, [42,43,44])
  assert.deepEqual(result.survivants, [])
  assert.deepEqual(pauses, [50,25])
})

test('killChromeTree : survivant persistant, observation coûteuse et horloge immobile refusés', () => {
  let now = 0, lectures = 0, pauses = 0
  const options = {plateforme:'win32',executer:()=>({status:0}),observer:()=>[{pid:42,parent:1,cree:0}],horloge:()=>now,patienter:ms=>{pauses++;now+=ms},attenteMs:75}
  assert.throws(()=>killChromeTree({pid:42}, options), /survivants 42/)
  assert.equal(now,75)
  assert.equal(pauses,2)
  now=0;pauses=0
  assert.throws(()=>killChromeTree({pid:42},{...options,observer:()=>{if(lectures++)now+=100;return [{pid:42,parent:1,cree:0}]}}), /survivants 42/)
  assert.equal(pauses,0)
  now=0
  assert.throws(()=>killChromeTree({pid:42},{...options,patienter:()=>{}}), /horloge.*progression/)
  for(const attenteMs of [Infinity,-1,NaN]) {
    let arrets=0
    assert.throws(()=>killChromeTree({pid:42},{...options,attenteMs,executer:()=>{arrets++;return {status:0}}}), /délai/)
    assert.equal(arrets,0)
  }
})

test('gabarit éditeur : choix d’étage canonique, non pas un bouton disparu', async () => {
  const {session,doc} = pagePilotee('<div class="ed-level-bar"><label>Étage<select><option value="0">Rez</option><option value="1">Étage 1</option></select></label><input type="range" value="25"></div>')
  const { choisirEtage } = await import('./shot-editor-lower-layer-gabarit.mjs')
  await choisirEtage(session,1)
  assert.equal(doc.querySelector('select').value,'1')
})

test('nettoyerALaSortie : un échec est NOMMÉ et n’arrête pas les nettoyages suivants', () => {
  const dits = []
  const supprimes = []
  const echecs = nettoyerALaSortie([{ chrome: { pid: 1 }, profile: '/p1' }, { chrome: { pid: 2 }, profile: '/p2' }], {
    tuer: (c) => { if (c.pid === 1) throw new Error('taskkill refusé') },
    supprimer: (p) => supprimes.push(p),
    signaler: (m) => dits.push(m),
  })
  assert.deepEqual(echecs, ['Chrome 1 : taskkill refusé'])
  assert.deepEqual(supprimes, ['/p1', '/p2'])
  assert.match(dits[0], /Chrome 1 non nettoyé — taskkill refusé/)
})

test('waitForWsUrl : à l’échéance, le DERNIER échec est nommé', async () => {
  await assert.rejects(() => waitForWsUrl(9, 50, { recuperer: async () => { throw new Error('ECONNREFUSED') } }), /Dernier échec : ECONNREFUSED/)
})

test('purgerProfil : un handle TENU (EBUSY) se réessaie, une autre erreur LÈVE', async () => {
  let essais = 0
  const tenu = { existe: () => essais < 2, supprimer: () => { essais += 1; if (essais === 1) throw erreurDeCode('EBUSY') } }
  assert.equal(purgerProfil('/p', { disque: tenu, pasMs: 1 }), true)
  const refuse = { existe: () => true, supprimer: () => { throw erreurDeCode('EACCES') } }
  assert.throws(() => purgerProfil('/p', { disque: refuse, pasMs: 1 }), /EACCES/)
})

test('purgerProfil : EBUSY se réessaie jusqu’à l’ÉCHÉANCE, pas un nombre fixe d’essais ; au-delà, `false`', () => {
  let now = 0, essais = 0
  const tenuLongtemps = { existe: () => now < 12000, supprimer: () => { essais += 1; now += 1000; if (now < 12000) throw erreurDeCode('EBUSY') } }
  assert.equal(purgerProfil('/p', { disque: tenuLongtemps, horloge: () => now, patienter: (ms) => { now += ms } }), true)
  assert.ok(now >= 12000 && now <= 15000, `libéré à ${now} ms après ${essais} essais`)
  now = 0
  const tenuToujours = { existe: () => true, supprimer: () => { throw erreurDeCode('EBUSY') } }
  assert.equal(purgerProfil('/p', { disque: tenuToujours, echeanceMs: 500, horloge: () => now, patienter: (ms) => { now += ms } }), false)
  assert.equal(now, 500)
})

test('killChromeTree : un PID RÉUTILISÉ (créé après l’arrêt, ou recréé sous un PID suivi) est écarté ; l’échéance part APRÈS l’arrêt', () => {
  let now = 10000
  const avant = [{ pid: 42, parent: 1, cree: 1000 }, { pid: 43, parent: 42, cree: 2000 }]
  const observer = (apres) => { let n = 0; return () => n++ ? apres : avant }
  const options = { plateforme: 'win32', executer: () => ({ status: 255 }), horloge: () => now, patienter: (ms) => { now += ms }, attenteMs: 100 }
  const reutilises = [{ pid: 43, parent: 7, cree: 11700 }, { pid: 44, parent: 43, cree: 11800 }, { pid: 45, parent: 42, cree: 12000 }]
  assert.deepEqual(killChromeTree({ pid: 42 }, { ...options, observer: observer(reutilises) }).survivants, [])
  now = 10000
  assert.throws(() => killChromeTree({ pid: 42 }, { ...options, observer: observer([{ pid: 43, parent: 1, cree: 2000 }, { pid: 46, parent: 43, cree: 9000 }]) }), /survivants 43, 46/)
  now = 10000
  let lectures = 0
  const lent = { ...options, attenteMs: 3000, executer: () => { now += 5000; return { status: 255 } }, observer: () => (lectures++ < 3 ? avant : []) }
  assert.deepEqual(killChromeTree({ pid: 42 }, lent).survivants, [])
})

test('killChromeTree : sous CIM (milliseconde), une date de création qui diffère d’1 ms est un AUTRE processus ; sous ps, la seconde tolère', () => {
  const avant = [{ pid: 42, parent: 1, cree: 1000 }, { pid: 43, parent: 42, cree: 2000 }]
  const observer = (apres) => { let n = 0; return () => n++ ? apres : avant }
  const recree = [{ pid: 43, parent: 42, cree: 2001 }]
  assert.deepEqual(killChromeTree({ pid: 42 }, { plateforme: 'win32', executer: () => ({ status: 0 }), observer: observer(recree), attenteMs: 0 }).survivants, [])
  assert.throws(() => killChromeTree({ pid: 42 }, { plateforme: 'linux', tuerPid: () => {}, observer: observer(recree), attenteMs: 0 }), /survivants 43/)
})

test('lireProcessus : sous CIM, un processus SANS date de création fait échouer la lecture, jamais une date 0', { skip: process.platform !== 'win32' && 'PowerShell absent' }, () => {
  const executer = (commande, args, options) => {
    const cim = 'Get-CimInstance Win32_Process -Filter "ProcessId > 0"'
    assert.ok(args.at(-1).includes(cim))
    return spawnSync(commande, [...args.slice(0, -1), args.at(-1).replace(cim, '@([pscustomobject]@{ ProcessId = 42; ParentProcessId = 1; CreationDate = $null })')], options)
  }
  assert.throws(() => lireProcessus({ plateforme: 'win32', executer }), /observation des processus impossible \(code 1\) — .*date de creation absente, PID 42/s)
})

test('leverApresNettoyage : la principale sort ; un nettoyage qui échoue lui est JOINT, jamais substitué', async () => {
  const principale = erreurDeCode('TARGET_NAVIGATED', 'principale')
  await assert.rejects(() => leverApresNettoyage(principale, async () => {}), (e) => e === principale)
  await assert.rejects(() => leverApresNettoyage(principale, async () => { throw new Error('fermeture') }), (e) => {
    assert.ok(e instanceof AggregateError)
    assert.equal(e.message, 'principale — et le nettoyage a échoué : fermeture')
    assert.equal(e.code, 'TARGET_NAVIGATED')
    assert.deepEqual(e.errors.map((x) => x.message), ['principale', 'fermeture'])
    return true
  })
})

test('waitForAppSilently : une erreur de NAVIGATION se relit, toute autre remonte', async () => {
  let n = 0
  const rechargee = { rpc: async () => { n += 1; if (n === 1) throw new Error('Execution context was destroyed.'); return { result: { value: true } } } }
  assert.equal(await waitForAppSilently(rechargee, 2000), true)
  const cassee = { rpc: async () => { throw new Error('Internal error') } }
  await assert.rejects(() => waitForAppSilently(cassee, 2000), /Internal error/)
})

test('espionReseau : une URL illisible est NOTÉE comme telle, jamais perdue', async () => {
  const { dom, session } = pagePilotee('<div></div>')
  dom.window.fetch = () => Promise.resolve()
  session.listeners = new Set()
  const espion = await espionReseau(session)
  dom.window.fetch({ get url() { throw new Error('getter cassé') } })
  assert.deepEqual(await espion.urls(), ['(URL illisible : getter cassé)'])
})

test('gestes : une cible en CHAÎNE nue est refusée en nommant les trois formes, aucun événement émis', async () => {
  const { dom, etat, session } = pagePilotee('<button>+ Op</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 20, width: 40, height: 10 })
  await assert.rejects(() => survoler(session, '+ Op', { attenteMs: 0 }), /survoler : cible "\+ Op" — formes admises : \{ nom.*\{ selecteur.*\{ surface, x, y \}/)
  assert.deepEqual(etat.emis, [])
  assert.deepEqual({ ...(await survoler(session, { nom: '+ Op' }, { attenteMs: 0 })) }, { x: 30, y: 25, label: '+ Op', ferme: null })
})

test('processusVivant : ESRCH = mort, EPERM = vivant, toute autre erreur remonte', () => {
  assert.equal(processusVivant(7, { sonder: () => { throw erreurDeCode('ESRCH') } }), false)
  assert.equal(processusVivant(7, { sonder: () => { throw erreurDeCode('EPERM') } }), true)
  assert.throws(() => processusVivant(7, { sonder: () => { throw erreurDeCode('EINVAL') } }), /EINVAL/)
})

test('attendreSelecteur : l’échéance se NOMME ; une évaluation cassée remonte telle quelle', async () => {
  const absent = { rpc: async () => ({ result: { value: false } }) }
  await assert.rejects(() => attendreSelecteur(absent, '.x', { timeoutMs: 30 }), /« \.x » absent du DOM après 30 ms/)
  const cassee = { rpc: async () => { throw new Error('Internal error') } }
  await assert.rejects(() => attendreSelecteur(cassee, '.x', { timeoutMs: 30 }), /Internal error/)
})

test('demarrer : une session OUVERTE dont la fermeture échoue — l’échec est JOINT à l’erreur qui sort', async () => {
  const { dom, session } = pagePilotee('<div></div>')
  session.close = async () => { throw new Error('fermeture refusée') }
  dom.window.__wfrp = { scenario: () => '✓', ready: () => true, fight: () => '✗ rencontre inconnue', store: { getState: () => ({}) } }
  await assert.rejects(() => demarrer({ ouvrir: async () => session, scenario: 'e', combat: 'enc-x' }), /refus — ✗ rencontre inconnue — et le nettoyage a échoué : fermeture refusée/)
})

// ------------------------------------------------- #2306 B : choisir n'est pas avancer

/** Fenêtre de Blessure critique : les voies Dévier/Subir en grille (`OptionChooser layout="grid"`,
 *  `src/ui/CascadeModal.tsx` branche `choix`) et « Terminer » — patron `CascadeTableMode.test.tsx:655`. */
const CRITIQUE = '<div class="modal-overlay"><div role="dialog" aria-label="Blessure critique (Jambe gauche)"><div class="rm-loc-grid"><button id="devier">Dévier (−1 PA)</button><button>Subir</button></div><button id="terminer" aria-disabled="true">Terminer</button></div></div>'

test('resoudreModales : une voie explicitement appliquée reste offerte puis Terminer est pris', async () => {
  const jeu = { journal: [], pendingCascade: { cursor: 0, participants: [{ id: 'fixture-step', kind: 'deviation' }] } }
  const { doc, etat, session } = pagePilotee(CRITIQUE, { jeu })
  doc.querySelector('#devier').onclick = () => { jeu.journal = [...jeu.journal, 'Dévier : −1 PA']; doc.querySelector('#terminer').removeAttribute('aria-disabled') }
  doc.querySelector('#terminer').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.pendingCascade = null }
  await clickButtonByText(session, 'Dévier (−1 PA)', { dans: '.modal-overlay' })
  await resoudreModales(session, 'critique', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 200 })
  assert.deepEqual(etat.cliques, ['Dévier (−1 PA)', 'Terminer'])
})

test('resoudreModales : des options inertes sont refusées avant le premier événement', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"><div class="seg"><button>Parade</button><button>Esquive</button></div></div>')
  await assert.rejects(() => resoudreModales(session, 'inerte', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 200 }), /choix joueur requis.*Parade.*Esquive/)
  assert.deepEqual(etat.cliques, [])
})

test('resoudreModales : le journal ne change pas sans choix explicite', async () => {
  const jeu = { journal: [] }
  const { doc, session } = pagePilotee('<div class="modal-overlay"><div class="seg"><button>Relancer</button><button>Garder</button></div></div>', { jeu })
  doc.querySelector('.seg button').onclick = () => { jeu.journal = [...jeu.journal, 'relance'] }
  await assert.rejects(() => resoudreModales(session, 'relances', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 200, max: 4 }), (e) => {
    assert.match(e.message, /choix joueur requis.*Relancer.*Garder/)
    return true
  })
  assert.equal(jeu.journal.length, 0)
})

// ------------------------------------------------- #2306 A : « Poser la zone », puis la case

test('resoudreModales : « Poser la zone » est cliqué, PUIS la pose en cours lève en nommant le geste sur la carte', async () => {
  const jeu = {}
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Comète à Deux Queues"><button id="poser">Poser la zone</button></div></div>', { jeu })
  doc.querySelector('#poser').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.gesteCarte = ZONE }
  await assert.rejects(() => resoudreModales(session, 'zone', { dans: '.modal-overlay', pauseMs: 1, attenteMs: 200 }), /^Error: \[zone\] pose de zone en cours, cliquer une case/)
  assert.deepEqual(etat.cliques, ['Poser la zone'])
})

// ------------------------------------------------- avancerDeRounds, et l'arrêt sur une fenêtre nommée

/** Combat factice : la plaque de fin de tour s'ARME au premier clic (« Finir quand même »), passe la
 *  main au second ; la pause de début de Round attend « Commencer le round N » (`round-start`). */
function combatFactice() {
  const b = { round: 1, over: false, actif: 'h1', acted: false, movementUsed: 0, endTurnArmed: false }
  const a = { roundPause: false, activeModal: null }
  const { dom, doc, etat, session } = pagePilotee('<div class="combat-console"><button data-action="end-turn">Fin du tour</button></div><div class="cc-phase"><button data-action="round-start">Commencer le round</button></div>')
  dom.window.__wfrp = { battle: () => ({ ...b }), auto: () => ({ ...a, active: a.roundPause ? null : { id: 'h1', kind: 'hero', aiDriven: false } }) }
  doc.querySelector('[data-action="end-turn"]').onclick = () => {
    if (!b.endTurnArmed) { b.endTurnArmed = true; return }
    b.endTurnArmed = false
    a.roundPause = true
  }
  doc.querySelector('[data-action="round-start"]').onclick = () => { a.roundPause = false; b.round += 1 }
  return { b, etat, session }
}

test('avancerDeRounds : fin de tour ARMÉE puis confirmée, pause de Round franchie par son bouton — jusqu’au Round visé', async () => {
  const { b, etat, session } = combatFactice()
  const { lecture } = await avancerDeRounds(session, 2, { pauseMs: 1 })
  assert.equal(b.round, 3)
  assert.equal(lecture.battle.round, 3)
  assert.deepEqual(etat.cliques, ['Fin du tour', 'Fin du tour', 'Commencer le round', 'Fin du tour', 'Fin du tour', 'Commencer le round'])
})

test('avancerDeRounds : sans combat, refus nommé', async () => {
  const { dom, session } = pagePilotee('<div></div>')
  dom.window.__wfrp = { battle: () => '✗ aucun combat', auto: () => ({ roundPause: false, activeModal: null, active: null }) }
  await assert.rejects(() => avancerDeRounds(session, 1), /avancerDeRounds : aucun combat en cours/)
})

/** Une Défense ouverte en étape de cascade (`jet: 'defense'`, `combatFlow.ts`), élue par l'arbitre. */
const DEFENSE = '<div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button>Esquive</button></div><button>Lancer</button></div>'

test('piloterCombat : `arret` reçoit l’IDENTITÉ de la fenêtre — il s’arrête sur la Défense, laissée ouverte', async () => {
  const jeu = { pendingCascade: { cursor: 0, participants: [{ id: 'fixture-step', kind: 'defenseJet', jet: 'defense' }] } }
  const { dom, etat, session } = pagePilotee(`<div class="modal-overlay">${DEFENSE}</div>`, { jeu, cascade: true })
  dom.window.__wfrp = { battle: () => ({ round: 1, over: false, endTurnArmed: false }), auto: () => ({ roundPause: false, activeModal: 'cascade', cascade: cascadeAffichage(dom), active: null }) }
  const { lecture } = await piloterCombat(session, { pauseMs: 1, arret: (e) => e.fenetre?.jet === 'defense' })
  assert.deepEqual({ ...lecture.fenetre }, { cle: 'cascade', jet: 'defense', etape: 'defenseJet', nom: 'Défense', id: 'fixture-step', kind: 'defenseJet', interaction: 'affichage', ready: true, chosen: null, amount: null })
  assert.deepEqual(etat.cliques, [])
})

test('piloterCombat : une Défense qui s’ouvre PENDANT la résolution arrête aussi `resoudreModales`', async () => {
  const jeu = { pendingCascade: { cursor: 0, participants: [{ id: 'fixture-step', kind: 'attackJet', jet: 'attack' }] } }
  const { dom, doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Attaque"><button id="lancer">Lancer</button></div></div>', { jeu, cascade: true })
  dom.window.__wfrp = { battle: () => ({ round: 1, over: false, endTurnArmed: false }), auto: () => ({ roundPause: false, activeModal: 'cascade', cascade: cascadeAffichage(dom), active: null }) }
  doc.querySelector('#lancer').onclick = () => {
    doc.querySelector('.modal-overlay').innerHTML = DEFENSE
    jeu.pendingCascade = { cursor: 0, participants: [{ id: 'fixture-step', kind: 'defenseJet', jet: 'defense' }] }
  }
  const { lecture } = await piloterCombat(session, { pauseMs: 1, arret: (e) => e.fenetre?.jet === 'defense' })
  assert.deepEqual(etat.cliques, ['Lancer'])
  assert.equal(lecture.fenetre.nom, 'Défense')
})

// ------------------------------------------------- appelerWfrp : un refus RENDU se lève

test('appelerWfrp : arguments passés, promesse attendue, résultat rendu', async () => {
  const { dom, session } = sessionSurDom('<div></div>')
  dom.window.__wfrp = { fight: async (id, graine) => `✓ ${id} ${graine}` }
  assert.equal(await appelerWfrp(session, 'fight', 'enc-x', 4), '✓ enc-x 4')
})

test('appelerWfrp : un résultat « ✗ … » LÈVE en nommant le helper et en citant le refus', async () => {
  const { dom, session } = sessionSurDom('<div></div>')
  dom.window.__wfrp = { editorOpen: () => '✗ document inconnu « zz »' }
  await assert.rejects(() => appelerWfrp(session, 'editorOpen', 'zz'), /^Error: appelerWfrp « editorOpen » : refus — ✗ document inconnu « zz »$/)
})

test('appelerWfrp : un helper absent est nommé ; `{ nom, timeoutMs }` porte le plafond d’évaluation', async () => {
  const demandes = []
  const { dom, session } = sessionSurDom('<div></div>')
  dom.window.__wfrp = { ready: () => '✓ monde prêt' }
  const rpc = session.rpc
  session.rpc = async (m, p) => { demandes.push(p.timeout); return rpc(m, p) }
  await assert.rejects(() => appelerWfrp(session, 'inconnu'), /__wfrp\.inconnu : aucun helper de ce nom/)
  assert.equal(await appelerWfrp(session, { nom: 'ready', timeoutMs: 60000 }), '✓ monde prêt')
  assert.deepEqual(demandes, [DELAI_EVALUATE, 60000])
})

// ------------------------------------------------- molette réelle, `deplierVers`

/** Page à MISE EN PAGE simulée : chaque élément porte son ordonnée de document (`data-y`, 20 px de
 *  haut), la fenêtre défile par la molette CDP (`mouseWheel`) ; un élément sous un `<details>` fermé n'a
 *  aucune boîte. `scrollIntoView` est INTERDIT : un appel lève. */
function pageDefilante(html) {
  const p = pagePilotee(html)
  const w = p.dom.window
  p.etat.defilement = 0
  p.etat.crans = []
  w.Element.prototype.scrollIntoView = function () { throw new Error('scrollIntoView appelé') }
  w.Element.prototype.getBoundingClientRect = function () {
    for (let a = this.parentElement; a; a = a.parentElement) if (a.tagName === 'DETAILS' && !a.open && this.tagName !== 'SUMMARY') return { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
    const porteur = this.closest('[data-y]')
    const y = Number(porteur ? porteur.getAttribute('data-y') : 0) - p.etat.defilement
    return { x: 10, y, top: y, bottom: y + 20, left: 10, right: 110, width: 100, height: 20 }
  }
  const rpc = socketDe(p.session).gerer
  socketDe(p.session).gerer = async (m, params) => {
    if (m === 'Input.dispatchMouseEvent' && params.type === 'mouseWheel') { p.etat.crans.push(params.deltaY); p.etat.defilement += params.deltaY }
    return rpc(m, params)
  }
  return p
}

test('deplierVers : le <summary> du <details> replié est amené par la MOLETTE puis cliqué ; le champ suit par la molette', async () => {
  const { doc, etat, session } = pageDefilante('<details id="ops"><summary data-y="1500">Effets › Mutations</summary><label data-y="1560"><input id="champ"></label></details>')
  const point = await deplierVers(session, '#champ', { pauseMs: 0 })
  assert.equal(doc.querySelector('#ops').open, true)
  assert.deepEqual(etat.cliques, ['Effets › Mutations'])
  assert.ok(etat.crans.length > 0 && etat.crans.every((d) => d > 0), `crans de molette : ${etat.crans}`)
  assert.ok(point.y >= 0 && point.y <= 768, `champ à l’écran : ${point.y}`)
})

test('deplierVers : une molette qui ne fait plus défiler LÈVE en le nommant', async () => {
  const { session } = pageDefilante('<p id="loin" data-y="5000">loin</p>')
  socketDe(session).gerer = ((rpc) => async (m, p) => (m === 'Input.dispatchMouseEvent' && p.type === 'mouseWheel' ? {} : rpc(m, p)))(socketDe(session).gerer)
  await assert.rejects(() => deplierVers(session, '#loin', { pauseMs: 0 }), /la molette ne fait plus défiler vers « #loin »/)
})

test('molette : un cran CDP `mouseWheel` au centre de la partie visible de la cible, sans scrollIntoView', async () => {
  const { etat, session } = pageDefilante('<div id="liste" data-y="100">liste</div>')
  const point = await molette(session, { selecteur: '#liste' }, 120)
  assert.deepEqual({ x: point.x, y: point.y }, { x: 60, y: 110 })
  assert.deepEqual(etat.crans, [120])
  await assert.rejects(() => molette(session, { selecteur: '#absente' }, 120), /molette : aucune cible « #absente »/)
})

// ------------------------------------------------- typeInField : la frappe exige le focus

test('typeInField : un <input type=number> qui n’a pas le focus après le clic LÈVE — aucune frappe émise', async () => {
  const { etat, session } = pagePilotee('<input id="n" type="number" value="5">')
  await assert.rejects(() => typeInField(session, '#n', '12'), /typeInField « #n » : la cible n'a pas le focus \(focus sur body\) — aucune frappe émise/)
  assert.ok(!etat.emis.includes('Input.insertText:'), `émis : ${etat.emis}`)
})

test('typeInField : focalisé par le clic, un <input type=number> pré-rempli est REMPLACÉ (clear)', async () => {
  const { doc, etat, session } = pagePilotee('<input id="n" type="number" value="5">')
  let toutSelectionne = false
  doc.defaultView.HTMLInputElement.prototype.select = function () { toutSelectionne = true }
  const rpc = socketDe(session).gerer
  socketDe(session).gerer = async (m, p) => {
    const r = await rpc(m, p)
    if (m === 'Input.dispatchMouseEvent' && p.type === 'mouseReleased') etat.marque.focus()
    if (m === 'Input.insertText') { const a = doc.activeElement; a.value = (toutSelectionne ? '' : a.value) + p.text }
    return r
  }
  assert.equal(await typeInField(session, '#n', '12'), '12')
})

// ------------------------------------------------- survoler sans défiler

test('survoler : `defiler: false` survole SANS scrollIntoView ; le défaut fait défiler', async () => {
  const { dom, session } = pagePilotee('<button id="b">Retirer</button>')
  let defilements = 0
  dom.window.Element.prototype.scrollIntoView = () => { defilements += 1 }
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 20, height: 20 })
  await survoler(session, { selecteur: '#b' }, { attenteMs: 0, defiler: false })
  assert.equal(defilements, 0)
  await survoler(session, { selecteur: '#b' }, { attenteMs: 0 })
  assert.equal(defilements, 1)
})

// ------------------------------------------------- gestes : clic droit, appui long, toucher

/** Page pilotée qui note chaque événement CDP émis avec ses paramètres, et rend une boîte à toute cible. */
function pageGestes(html) {
  const p = pagePilotee(html)
  p.dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, width: 20, height: 20 })
  p.etat.params = []
  const rpc = socketDe(p.session).gerer
  socketDe(p.session).gerer = async (m, params) => {
    if (m !== 'Runtime.evaluate') p.etat.params.push({ m, t: Date.now(), ...params })
    return rpc(m, params)
  }
  return p
}

test('clicDroit : la triade souris au bouton DROIT, contrôlée comme un clic', async () => {
  const { etat, session } = pageGestes('<div class="pion" role="button">Gobelin</div>')
  const point = await clicDroit(session, { nom: 'Gobelin' })
  assert.deepEqual({ x: point.x, y: point.y }, { x: 20, y: 20 })
  assert.deepEqual(etat.params.map((e) => `${e.type}:${e.button ?? ''}`), ['mouseMoved:', 'mousePressed:right', 'mouseReleased:right'])
})

test('appuiLong : le bouton est TENU `ms` entre appui et relâchement', async () => {
  const { etat, session } = pageGestes('<button>Fouiller</button>')
  await appuiLong(session, { nom: 'Fouiller' }, 60)
  const appui = etat.params.find((e) => e.type === 'mousePressed')
  const relache = etat.params.find((e) => e.type === 'mouseReleased')
  assert.equal(appui.button, 'left')
  assert.ok(relache.t - appui.t >= 55, `tenu ${relache.t - appui.t} ms`)
})

test('toucher : touchStart au point de la cible, puis touchEnd sans point', async () => {
  const { etat, session } = pageGestes('<button>Viser</button>')
  await toucher(session, { nom: 'Viser' })
  assert.deepEqual(etat.params.map((e) => ({ m: e.m, type: e.type, points: e.touchPoints })), [
    { m: 'Input.dispatchTouchEvent', type: 'touchStart', points: [{ x: 20, y: 20 }] },
    { m: 'Input.dispatchTouchEvent', type: 'touchEnd', points: [] },
  ])
})

/** Rend l'échéance de `controler` immédiate : chaque lecture de l'horloge avance de 10⁷ ms. */
function horlogeEmballee(t) {
  const vrai = Date.now
  let k = 0
  t.mock.method(Date, 'now', () => vrai.call(Date) + k++ * 1e7)
}

for (const [geste, qui, faire] of [
  ['clicDroit', 'clicDroit', (session) => clicDroit(session, { selecteur: '#cible' })],
  ['toucher', 'toucher', (session) => toucher(session, { selecteur: '#cible' })],
  ['survoler', 'survoler', (session) => survoler(session, { selecteur: '#cible' }, { attenteMs: 0 })],
]) {
  test(`${geste} : une cible RECOUVERTE lève en nommant le recouvreur, aucun événement émis (#1953)`, async (t) => {
    const { dom, etat, session } = pagePilotee('<button id="cible">Retirer</button><div class="voile">Modale du dessus</div>', { recouvrir: '.voile' })
    dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 })
    horlogeEmballee(t)
    await assert.rejects(() => faire(session), (e) => {
      assert.match(e.message, new RegExp(`^${qui} « #cible » : .*div\\.voile « Modale du dessus ».* RECOUVRE la cible`))
      return true
    })
    assert.deepEqual(etat.emis, [])
  })
}

test('deplierVers : un cran de molette dont le point est RECOUVERT lève, aucun cran émis (#1953)', async (t) => {
  const { doc, etat, session } = pageDefilante('<div id="liste" data-y="0" style="overflow-y: auto"><p id="loin" data-y="5000">loin</p></div><div class="voile">Modale du dessus</div>')
  Object.defineProperties(doc.querySelector('#liste'), { scrollHeight: { value: 6000 }, clientHeight: { value: 20 } })
  doc.elementFromPoint = () => doc.querySelector('.voile')
  horlogeEmballee(t)
  await assert.rejects(() => deplierVers(session, '#loin', { pauseMs: 0 }), /^Error: deplierVers « #loin » : AUTRE COUCHE — .*div\.voile « Modale du dessus ».* est de la couche html, la cible de la couche div#liste/)
  assert.deepEqual(etat.crans, [])
  assert.equal(doc.querySelector('[data-recette-cible]'), null)
})

test('gestes : une cible SANS boîte (non rendue) est refusée avant tout événement', async () => {
  const { dom, etat, session } = pagePilotee('<button>Viser</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 })
  await assert.rejects(() => toucher(session, { nom: 'Viser' }), /toucher « Viser » \(texte EXACT\) : boîte de taille nulle/)
  await assert.rejects(() => clicDroit(session, { nom: 'Viser' }), /clicDroit « Viser » \(texte EXACT\) : boîte de taille nulle/)
  assert.deepEqual(etat.emis, [])
})

// ------------------------------------------------- dernierTelechargement

/** Disque factice d'un dossier de téléchargements : `fichiers` = { nom: { t, contenu } }. */
const disqueTelechargements = (fichiers) => ({
  existe: () => true,
  lister: () => Object.keys(fichiers),
  dater: (chemin) => fichiers[chemin.split(/[\\/]/).pop()].t,
  lire: (chemin) => fichiers[chemin.split(/[\\/]/).pop()].contenu,
})

test('dernierTelechargement : le plus RÉCENT, puis le suivant — jamais deux fois le même', async () => {
  const fichiers = { 'a.json': { t: 1, contenu: '{"a":1}' }, 'b.json': { t: 2, contenu: '{"b":2}' } }
  const session = { profile: joinPath('profil') }
  const premier = await dernierTelechargement(session, { disque: disqueTelechargements(fichiers), timeoutMs: 50, pasMs: 5 })
  assert.deepEqual(premier, { chemin: joinPath('profil', DOSSIER_TELECHARGEMENTS, 'b.json'), nom: 'b.json', contenu: '{"b":2}' })
  assert.equal((await dernierTelechargement(session, { disque: disqueTelechargements(fichiers), timeoutMs: 50, pasMs: 5 })).nom, 'a.json')
  await assert.rejects(() => dernierTelechargement(session, { disque: disqueTelechargements(fichiers), timeoutMs: 30, pasMs: 5 }), /aucun fichier téléchargé complet en 30 ms/)
})

test('dernierTelechargement : un téléchargement EN COURS (.crdownload) est attendu, puis nommé à l’échéance', async () => {
  const fichiers = { 'x.json': { t: 1, contenu: '{}' }, 'y.json.crdownload': { t: 2, contenu: '' } }
  await assert.rejects(() => dernierTelechargement({ profile: 'p' }, { disque: disqueTelechargements(fichiers), timeoutMs: 30, pasMs: 5 }), /en cours : y\.json\.crdownload/)
  setTimeout(() => { delete fichiers['y.json.crdownload']; fichiers['y.json'] = { t: 3, contenu: '{"y":1}' } }, 20)
  assert.equal((await dernierTelechargement({ profile: 'p' }, { disque: disqueTelechargements(fichiers), timeoutMs: 500, pasMs: 5 })).nom, 'y.json')
})

// ------------------------------------------------- lireIndexedDB : observation seule

/** `indexedDB` factice d'une page : `bases` = { nom: { magasin: [[cle, valeur]…] } } ; `ouvertes`
 *  compte les `open`. Les requêtes répondent au tour suivant, comme l'API. */
function indexedDBFactice(bases) {
  const ouvertes = []
  const requete = (resultat) => { const r = {}; setTimeout(() => { r.result = resultat; r.onsuccess?.() }); return r }
  return {
    ouvertes,
    api: {
      databases: async () => Object.keys(bases).map((name) => ({ name })),
      open: (nom) => {
        ouvertes.push(nom)
        const magasins = bases[nom]
        return requete({
          objectStoreNames: Object.keys(magasins),
          transaction: (m, mode) => ({ objectStore: () => ({
            mode,
            getAllKeys: () => requete(magasins[m].map(([cle]) => cle)),
            getAll: () => requete(magasins[m].map(([, valeur]) => valeur)),
          }) }),
          close: () => {},
        })
      },
    },
  }
}

test('lireIndexedDB : rend `[{ cle, valeur }]` du magasin', async () => {
  const { dom, session } = sessionSurDom('<div></div>')
  const idb = indexedDBFactice({ 'wfrp-saves': { emplacements: [[1, { nom: 'Partie 1' }], [2, { nom: 'Partie 2' }]] } })
  dom.window.indexedDB = idb.api
  assert.deepEqual(JSON.parse(JSON.stringify(await lireIndexedDB(session, 'wfrp-saves', 'emplacements'))), [{ cle: 1, valeur: { nom: 'Partie 1' } }, { cle: 2, valeur: { nom: 'Partie 2' } }])
})

test('lireIndexedDB : une base ABSENTE n’est jamais ouverte (open la créerait) — refus listant les bases', async () => {
  const { dom, session } = sessionSurDom('<div></div>')
  const idb = indexedDBFactice({ 'wfrp-saves': { emplacements: [] } })
  dom.window.indexedDB = idb.api
  await assert.rejects(() => lireIndexedDB(session, 'autre', 'x'), /lireIndexedDB : base « autre » absente — bases : wfrp-saves/)
  assert.deepEqual(idb.ouvertes, [])
  await assert.rejects(() => lireIndexedDB(session, 'wfrp-saves', 'x'), /magasin « x » absent de « wfrp-saves » — magasins : emplacements/)
})

// ------------------------------------------------- rechargerEtAttendreMenu : le MENU monté

/** Page à rechargement simulé : `Page.reload` efface les globales de la page, l'app repart sur l'écran
 *  `menu`, et son menu se monte à la `montage`-ième lecture qui suit (jamais si `montage` est nul). */
function pageRechargeable(montage) {
  const { dom, session } = sessionSurDom('<div id="racine"></div>')
  const w = dom.window
  const etat = { rechargements: 0, lectures: 0 }
  const app = () => { w.__wfrp = { screen: () => {} }; w.__game = { getState: () => ({ screen: 'menu' }) } }
  app()
  w.document.getElementById('racine').innerHTML = '<div class="menu"><div class="menu-buttons menu-tools"></div></div>'
  const rpc = session.rpc
  session.rpc = async (m, p) => {
    if (m === 'Page.reload') {
      etat.rechargements += 1
      delete w.__recetteAvantRechargement
      w.document.getElementById('racine').innerHTML = ''
      etat.lectures = 0
      app()
      return {}
    }
    if (etat.rechargements && montage && ++etat.lectures === montage) w.document.getElementById('racine').innerHTML = '<div class="menu"><div class="menu-buttons menu-tools"></div></div>'
    return rpc(m, p)
  }
  return { etat, session }
}

test('rechargerEtAttendreMenu : `__wfrp` prêt ne suffit pas — la main revient au MONTAGE du menu', async () => {
  const { etat, session } = pageRechargeable(3)
  await rechargerEtAttendreMenu(session, { pasMs: 1, timeoutMs: 500 })
  assert.equal(etat.rechargements, 1)
  assert.ok(etat.lectures >= 3, `lectures après rechargement : ${etat.lectures}`)
})

test('rechargerEtAttendreMenu : un menu qui ne se monte jamais LÈVE en le nommant', async () => {
  const { session } = pageRechargeable(0)
  await assert.rejects(() => rechargerEtAttendreMenu(session, { pasMs: 1, timeoutMs: 30 }), /rechargerEtAttendreMenu : page rechargée sans app prête \(menu `\.menu-tools` monté\) en 30 ms/)
})

// ------------------------------------------------- shot ne change pas l'état capturé

test('shot : par défaut, le focus RESTE — le tiroir qui se ferme au blur reste ouvert ; `neutraliser` le retire', async (t) => {
  const dossier = joinPath(os.tmpdir(), `recette-shot-${process.pid}-${Date.now()}`)
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const { dom, session } = sessionSurDom('<aside class="tiroir ouvert"><input id="filtre"></aside>')
  const doc = dom.window.document
  doc.querySelector('.tiroir').addEventListener('focusout', () => doc.querySelector('.tiroir').classList.remove('ouvert'))
  doc.querySelector('#filtre').focus()
  const rpc = session.rpc
  session.rpc = async (m, p) => (m === 'Page.captureScreenshot' ? { data: Buffer.from('png').toString('base64') } : rpc(m, p))
  const chemin = await shot(session, 'tiroir', dossier)
  assert.equal(existsSync(chemin), true)
  assert.equal(doc.querySelector('.tiroir').classList.contains('ouvert'), true)
  await shot(session, 'tiroir-neutralise', dossier, { neutraliser: true })
  assert.equal(doc.querySelector('.tiroir').classList.contains('ouvert'), false)
})

// ------------------------------------------------- verdictDebordement borné au calque

/** Page dont chaque élément porte son bord droit (`data-droite`), fenêtre de 360 px. */
function pageDebordement(html) {
  const { dom, session } = sessionSurDom(html)
  Object.defineProperty(dom.window.document.documentElement, 'clientWidth', { value: 360 })
  dom.window.Element.prototype.getBoundingClientRect = function () {
    const droite = Number(this.getAttribute('data-droite') ?? 100)
    return { x: 0, y: 0, right: droite, width: droite, height: 10 }
  }
  return session
}
const CALQUES = '<main class="editeur"><div data-droite="682">Inspecteur</div></main><section class="calque-narratif"><p data-droite="300">Réplique</p></section>'

test('verdictDebordement : `dans` borne la mesure au calque — l’éditeur dessous n’y entre pas', async () => {
  const session = pageDebordement(CALQUES)
  assert.deepEqual([...(await verdictDebordement(session, { dans: '.calque-narratif' })).debordants], [])
  assert.deepEqual([...(await verdictDebordement(session)).debordants].map((d) => d.droite), [682])
})

test('verdictDebordement : un calque ABSENT est un refus nommé, jamais un verdict vide', async () => {
  await assert.rejects(() => verdictDebordement(pageDebordement(CALQUES), { dans: '.absent' }), /calque « \.absent » absent du DOM — aucun verdict/)
})

// ------------------------------------------------- evaluate : guillemets mêlés

test('evaluate : une expression qui mêle guillemets simples, doubles et accent grave arrive INTACTE à la page', async () => {
  const dom = new JSDOM('<button aria-label="Fin du tour">x</button>', { runScripts: 'outside-only' })
  const ws = new EventTarget()
  ws.readyState = WebSocket.OPEN
  ws.send = (brut) => {
    const m = JSON.parse(brut)
    const value = dom.window.eval(m.params.expression)
    queueMicrotask(() => ws.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify({ id: m.id, result: { result: { value } } }) })))
  }
  const session = brancherCdp(ws)
  const expression = `document.querySelector('[aria-label="Fin du tour"]').getAttribute("aria-label") + ' · ' + \`l'arc « ${'x'} »\` + " \\"cité\\""`
  assert.equal(await evaluate(session, expression), 'Fin du tour · l\'arc « x » "cité"')
})

// ------------------------------------------------- attendreChangement : un clic sans effet LÈVE

test('clickButtonByText : `attendreChangement` — un clic qui ne change ni le DOM ni le store LÈVE en le nommant', async () => {
  const { session } = pagePilotee('<button>Exporter</button>')
  await assert.rejects(() => clickButtonByText(session, 'Exporter', { attendreChangement: 150 }), /clickButtonByText « Exporter » : le clic n'a RIEN changé — ni le DOM ni l'état du store n'ont bougé en 150 ms/)
})

test('clickButtonByText : `attendreChangement` — le compteur d’images du canevas (`data-rendus`, `data-file`) n’est pas un effet', async () => {
  const { doc, session } = pagePilotee('<canvas data-rendus="1" data-file="0"></canvas><button>Exporter</button>')
  const toile = doc.querySelector('canvas')
  const images = setInterval(() => { toile.dataset.rendus = String(Number(toile.dataset.rendus) + 1); toile.dataset.file = String(Number(toile.dataset.rendus) % 3) }, 5)
  try {
    await assert.rejects(() => clickButtonByText(session, 'Exporter', { attendreChangement: 150 }), /le clic n'a RIEN changé/)
  } finally {
    clearInterval(images)
  }
})

test('cliquerSelecteur / clickButtonByText : `attendreChangement` passe dès que le DOM OU le store bouge', async () => {
  const jeu = { ouvert: false }
  const { dom, doc, session } = pagePilotee('<button id="tiroir">☰</button><button>Ouvrir</button>', { jeu })
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 10, height: 10 })
  doc.querySelector('#tiroir').onclick = () => { jeu.ouvert = true }
  doc.querySelectorAll('button')[1].onclick = () => doc.body.append(doc.createElement('aside'))
  await cliquerSelecteur(session, '#tiroir', { attendreChangement: 150 })
  await clickButtonByText(session, 'Ouvrir', { attendreChangement: true })
})

// ------------------------------------------------- attendreServeur : la cause NOMMÉE

const refusConnexion = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) })

test('attendreServeur : connexion REFUSÉE jusqu’à l’échéance — la cause est nommée', async () => {
  await assert.rejects(() => attendreServeur('http://localhost:5241/', { timeoutMs: 40, pasMs: 5, recuperer: async () => { throw refusConnexion() } }),
    /Serveur de dev indisponible sur http:\/\/localhost:5241\/ après 40 ms — dernière cause : connexion REFUSÉE/)
})

test('attendreServeur : une réponse LENTE (délai écoulé) se distingue d’une connexion refusée', async () => {
  const lente = async (_url, { signal }) => new Promise((_ok, ko) => signal.addEventListener('abort', () => ko(signal.reason)))
  await assert.rejects(() => attendreServeur('http://localhost:5241/', { timeoutMs: 40, pasMs: 5, recuperer: lente }), /dernière cause : réponse LENTE/)
})

test('attendreServeur : un serveur qui démarre pendant l’attente rend sa réponse ; un statut HTTP est cité', async () => {
  let essais = 0
  const reponse = await attendreServeur('http://x/', { timeoutMs: 500, pasMs: 1, recuperer: async () => { essais += 1; if (essais < 3) throw refusConnexion(); return { ok: true, status: 200 } } })
  assert.equal(reponse.status, 200)
  await assert.rejects(() => attendreServeur('http://x/', { timeoutMs: 20, pasMs: 5, recuperer: async () => ({ ok: false, status: 503 }) }), /dernière cause : réponse HTTP 503/)
})

test('causeDeServeur : refus, lenteur, autre échec réseau', () => {
  assert.match(causeDeServeur(refusConnexion()), /^connexion REFUSÉE/)
  assert.match(causeDeServeur(Object.assign(new Error('délai'), { name: 'TimeoutError' })), /^réponse LENTE/)
  assert.equal(causeDeServeur(Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' })), 'échec réseau : getaddrinfo (ENOTFOUND)')
})

// ------------------------------------------------- mesurerProvenance : le rendu de `ProvenanceDuTexte`

/** Le rendu DOM de `ProvenanceDuTexte` (`src/ui/editor/ProvenanceDuTexte.tsx`) : segment
 *  « Provenance du texte » (`OptionChooser layout="seg"`), option refusée = `GatedAction`
 *  (`aria-disabled` + raison liée), puis l'adresse et « Détacher », ou le champ de référence. */
const provenance = (sujet, { retenue, refusees = [], adresse, reference }) => `
  <div class="ed-field">
    <div class="rm-loc-inline"><span class="mini-title">Provenance du texte</span><div class="seg">
      ${['Copie', 'Adapté', 'Maison'].map((m, i) => (refusees.includes(m)
        ? `<button aria-label="${m} — provenance ${sujet}" aria-pressed="${m === retenue}" aria-disabled="true" aria-describedby="r-${sujet.length}-${i}">${m}</button><span id="r-${sujet.length}-${i}" hidden>Le texte copie un passage du livre : détache-le pour le reformuler.</span>`
        : `<button aria-label="${m} — provenance ${sujet}" aria-pressed="${m === retenue}">${m}</button>`)).join('')}
    </div></div>
    ${adresse ? `<div class="row"><span class="source-badge">${adresse}</span><button class="btn small" aria-label="Détacher le texte ${sujet}">Détacher</button></div>` : ''}
    ${reference ? `<div class="ed-field"><span>${reference}</span><select aria-label="Livre"></select></div>` : ''}
  </div>`

test('mesurerProvenance : copie ADRESSÉE — mode, refus cités, adresse et « Détacher »', async () => {
  const { session } = sessionSurDom(`<div id="replique">${provenance('de la réplique', { retenue: 'Copie', refusees: ['Adapté', 'Maison'], adresse: 'EDO 3' })}</div>`)
  assert.deepEqual(JSON.parse(JSON.stringify(await mesurerProvenance(session, '#replique'))), {
    sujet: 'de la réplique',
    mode: 'Copie',
    options: [
      { libelle: 'Copie', retenue: true, refus: null },
      { libelle: 'Adapté', retenue: false, refus: 'Le texte copie un passage du livre : détache-le pour le reformuler.' },
      { libelle: 'Maison', retenue: false, refus: 'Le texte copie un passage du livre : détache-le pour le reformuler.' },
    ],
    adresse: 'EDO 3',
    detacher: { ouvert: true },
    reference: null,
  })
})

test('mesurerProvenance : texte ADAPTÉ — le champ de référence monté, ni adresse ni « Détacher »', async () => {
  const { session } = sessionSurDom(`<div id="stade">${provenance('du stade 2', { retenue: 'Adapté', reference: 'Adapté de' })}</div>`)
  const m = await mesurerProvenance(session, '#stade')
  assert.equal(m.mode, 'Adapté')
  assert.equal(m.reference, 'Adapté de')
  assert.equal(m.adresse, null)
  assert.equal(m.detacher, null)
})

test('mesurerProvenance : aucune provenance, ou plusieurs, ou conteneur absent — refus NOMMÉS', async () => {
  const { session } = sessionSurDom(`<div id="vide"></div><div id="deux">${provenance('du PNJ', { retenue: 'Maison' })}${provenance('du stade 1', { retenue: 'Maison' })}</div>`)
  await assert.rejects(() => mesurerProvenance(session, '#vide'), /mesurerProvenance « #vide » : aucune provenance de texte/)
  await assert.rejects(() => mesurerProvenance(session, '#deux'), /plusieurs provenances : du PNJ \| du stade 1/)
  await assert.rejects(() => mesurerProvenance(session, '#absent'), /« #absent » : absent du DOM/)
})

// ------------------------------------------------- gabarit de recette

test('gabarit : le squelette importe le gabarit et le kit par URL file:/// de CET arbre, et ces URL s’importent', async () => {
  const texte = squelette()
  const urls = [...texte.matchAll(/from '(file:\/\/\/[^']+)'/g)].map((m) => m[1])
  assert.equal(urls.length, 2)
  assert.ok(urls[0].endsWith('/scripts/recette/gabarit.mjs') && urls[1].endsWith('/scripts/recette/lib.mjs'), urls.join(' '))
  assert.equal(typeof (await import(urls[0])).recette, 'function')
  assert.equal(typeof (await import(urls[1])).clickButtonByText, 'function')
  assert.match(texte, /await recette\(async \(\{ session \}\) => \{/)
})

/** Session factice du gabarit : console à `erreurs`, fermeture comptée. */
const sessionGabarit = (erreurs = []) => ({ fermee: 0, close: async function () { this.fermee += 1 }, console: { errors: () => erreurs, warnings: () => [] } })
const muet = { log: () => {} }

test('gabarit : `recette` démarre, déroule le corps, juge la console, puis ferme la session', async () => {
  const session = sessionGabarit()
  const lances = []
  const vus = []
  const r = await recette(async ({ session: s }) => { vus.push(s) }, { scenario: 'entrainement', sortie: muet, lancer: async (o) => { lances.push(o); return { session } } })
  assert.deepEqual(lances, [{ attacher: true, scenario: 'entrainement', graine: undefined, combat: undefined, url: undefined }])
  assert.equal(vus[0], session)
  assert.deepEqual(r, { avertissements: [] })
  assert.equal(session.fermee, 1)
})

test('gabarit : une erreur de console fait LEVER après fermeture ; une erreur du corps sort, session fermée', async () => {
  const sale = sessionGabarit([{ type: 'error', text: 'Uncaught TypeError: x' }])
  await assert.rejects(() => recette(async () => {}, { sortie: muet, lancer: async () => ({ session: sale, choix: [] }) }), /recette : 1 erreur\(s\) de console — Uncaught TypeError: x/)
  assert.equal(sale.fermee, 1)
  const propre = sessionGabarit()
  await assert.rejects(() => recette(async () => { throw new Error('geste manqué') }, { sortie: muet, lancer: async () => ({ session: propre, choix: [] }) }), /^Error: geste manqué$/)
  assert.equal(propre.fermee, 1)
})

// ------------------------------------------------- ouvrirFiche : le Compendium aux gestes

/** Le Codex rendu par `CompendiumScreen` (onglets « Groupes du Codex », pastilles `button.codex-cat`
 *  avec leur compteur, sous-groupe replié en `<details class="fold">`, `.codex-search`, rangées
 *  `ListRow` `button.listrow > .lr-name` retenues par `aria-current`), monté par le bouton du menu. */
const CODEX = `<div class="screen codex"><header class="codex-top"><div class="codex-groups"><div role="tablist" aria-label="Groupes du Codex"><button role="tab">Règles</button><button role="tab">Bestiaire</button></div></div></header>
  <div class="codex-cats"><button class="chip codex-cat on">Talents<span class="count">2</span></button><details class="fold"><summary><span class="fold-title">Effets</span></summary><button class="chip codex-cat">Maladies<span class="count">2</span></button></details></div>
  <input class="codex-search" type="search" aria-label="Rechercher dans le Codex">
  <div class="codex-rows"><button class="listrow"><span class="lr-name">Pourriture de Nurgle</span><span class="codex-row-src">LDB</span></button><button class="listrow"><span class="lr-name">Pourriture</span><span class="codex-row-src">LDB</span></button></div></div>`

function pageCodex() {
  const p = pagePilotee('<div class="menu"><button id="compendium">Compendium</button></div>')
  const w = p.dom.window
  const doc = p.doc
  w.Element.prototype.getBoundingClientRect = function () {
    for (let a = this.parentElement; a; a = a.parentElement) if (a.tagName === 'DETAILS' && !a.open && this.tagName !== 'SUMMARY') return { x: 0, y: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }
    return { x: 10, y: 100, top: 100, bottom: 120, left: 10, right: 110, width: 100, height: 20 }
  }
  doc.querySelector('#compendium').onclick = () => {
    doc.body.innerHTML = CODEX
    for (const r of doc.querySelectorAll('.listrow')) r.onclick = () => { for (const x of doc.querySelectorAll('.listrow')) x.removeAttribute('aria-current'); r.setAttribute('aria-current', 'true') }
  }
  const rpc = socketDe(p.session).gerer
  socketDe(p.session).gerer = async (m, params) => {
    const r = await rpc(m, params)
    if (m === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased' && p.etat.marque?.tagName === 'INPUT') p.etat.marque.focus()
    if (m === 'Input.insertText') doc.activeElement.value = params.text
    return r
  }
  return p
}

test('ouvrirFiche : menu → groupe → catégorie dépliée de son sous-groupe → recherche → rangée EXACTE retenue', async () => {
  const { doc, etat, session } = pageCodex()
  assert.deepEqual(await ouvrirFiche(session, { groupe: 'Règles', categorie: 'Maladies', entree: 'Pourriture' }), { entree: 'Pourriture' })
  assert.deepEqual(etat.cliques, ['Compendium', 'Règles', 'Effets', 'Maladies2', '', 'PourritureLDB'])
  assert.equal(doc.querySelector('.codex-search').value, 'Pourriture')
  assert.equal(doc.querySelector('[aria-current="true"] .lr-name').textContent, 'Pourriture')
})

test('ouvrirFiche : catégorie ou rangée absente — refus NOMMANT les offertes', async () => {
  const { session } = pageCodex()
  await assert.rejects(() => ouvrirFiche(session, { categorie: 'Sorts', entree: 'x' }), /ouvrirFiche : aucune catégorie « Sorts » — offertes : Talents \| Maladies/)
  await assert.rejects(() => ouvrirFiche(session, { entree: 'Peste' }), /ouvrirFiche : aucune rangée « Peste » — offertes : Pourriture de Nurgle \| Pourriture/)
})

test('localiseur unique : la marque de catégorie est retirée, une racine en double LÈVE au lieu de prendre la première', async () => {
  const codex = pageCodex()
  await ouvrirFiche(codex.session, { groupe: 'Règles', categorie: 'Maladies', entree: 'Pourriture' })
  assert.equal(codex.doc.querySelector('[data-recette-categorie], [data-recette]'), null)
  const atelier = pagePilotee('<header class="codex-top"><button aria-pressed="false">Atelier</button></header><header class="codex-top"><button aria-pressed="true">Atelier</button></header>')
  await assert.rejects(() => setAtelier(atelier.session, true), /setAtelier : 2 racines ambiguës « \.codex-top »/)
  assert.deepEqual(atelier.etat.emis, [])
  const { session } = sessionSurDom(`<div class="texte">${provenance('du PNJ', { retenue: 'Copie' })}</div><div class="texte">${provenance('du stade 1', { retenue: 'Maison' })}</div>`)
  await assert.rejects(() => mesurerProvenance(session, '.texte'), /mesurerProvenance : 2 cibles ambiguës « \.texte »/)
})

test('ATTRIBUTS_VOLATILS : le compteur d’images et la file du cuiseur (`GameStage3D.tsx`)', () => {
  assert.deepEqual([...ATTRIBUTS_VOLATILS], ['data-rendus', 'data-file'])
})

// ------------------------------------------------- #1953 : un émetteur, une cible — tests de contrat

test('verrou : `rpc` et `rpcNavigateur` refusent le domaine Input, rien ne part sur la socket', async () => {
  const vus = []
  const session = brancherFactice(async (m) => { vus.push(m); return {} })
  await assert.rejects(() => session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1, y: 1 }), /rpc « Input\.dispatchMouseEvent » : le domaine Input n'est émis que par `geste`/)
  await assert.rejects(() => session.rpcNavigateur('Input.dispatchKeyEvent', { type: 'keyUp' }), /domaine Input/)
  await session.rpc('Runtime.evaluate', { expression: '1' })
  assert.deepEqual(vus, ['Runtime.evaluate'])
})

test('homonymes : chaque forme de cible LÈVE en nommant les candidats, aucun événement émis', async () => {
  const { etat, session } = pagePilotee('<svg class="iso-stage"></svg><svg class="iso-stage"></svg><button class="pion" id="nain1">Nain</button><button class="pion" id="nain2">Nain</button>')
  for (const [cible, motif] of [
    [{ nom: 'Nain' }, /2 cibles ambiguës « Nain » — button#nain1 « Nain » \| button#nain2 « Nain »/],
    [{ selecteur: '.pion' }, /2 cibles ambiguës « \.pion » — button#nain1 « Nain » \| button#nain2 « Nain »/],
    [{ surface: 'svg.iso-stage', x: 5, y: 5 }, /2 cibles ambiguës « svg\.iso-stage »/],
  ]) {
    for (const faire of [() => survoler(session, cible, { attenteMs: 0 }), () => toucher(session, cible), () => geste(session, cible, {}, clic())]) {
      await assert.rejects(faire, motif)
    }
  }
  assert.deepEqual(etat.emis, [])
})

test('molette : un cran sous un VOILE FIXE lève « autre couche », aucun cran émis', async (t) => {
  const { doc, etat, session } = pageDefilante('<div id="liste" data-y="100">liste</div><div class="voile" style="position: fixed">Modale</div>')
  doc.elementFromPoint = () => doc.querySelector('.voile')
  horlogeEmballee(t)
  await assert.rejects(() => molette(session, { selecteur: '#liste' }, 120), /^Error: molette « #liste » : AUTRE COUCHE — .*div\.voile « Modale ».* est de la couche div\.voile, la cible de la couche html/)
  assert.deepEqual(etat.crans, [])
})

test('molette : un cran dont le point tombe dans un DÉFILANT IMBRIQUÉ lève « autre couche »', async (t) => {
  const { doc, etat, session } = pageDefilante('<div id="liste" data-y="100">liste<div id="interne" style="overflow-y: auto"><p id="ligne">ligne</p></div></div>')
  Object.defineProperties(doc.querySelector('#interne'), { scrollHeight: { value: 600 }, clientHeight: { value: 20 } })
  doc.elementFromPoint = () => doc.querySelector('#ligne')
  horlogeEmballee(t)
  await assert.rejects(() => molette(session, { selecteur: '#liste' }, 120), /AUTRE COUCHE — .*p#ligne.* est de la couche div#interne, la cible de la couche html/)
  assert.deepEqual(etat.crans, [])
  doc.elementFromPoint = () => doc.querySelector('#liste')
  await molette(session, { selecteur: '#liste' }, 120)
  assert.deepEqual(etat.crans, [120])
})

test('survoler : un contrôle `aria-disabled` est SURVOLÉ et sa raison rendue ; `agir` le refuse', async () => {
  const { dom, etat, session } = pagePilotee('<button id="tir" aria-disabled="true" aria-describedby="g">Tir</button><span id="g">Aucune munition</span>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, width: 20, height: 20 })
  const r = await survoler(session, { nom: 'Tir' }, { attenteMs: 0 })
  assert.deepEqual(r.ferme, { mecanisme: 'aria-disabled', raison: 'Aucune munition' })
  assert.deepEqual(etat.emis, ['Input.dispatchMouseEvent:mouseMoved'])
  await assert.rejects(() => survoler(session, { nom: 'Tir' }, { attenteMs: 0, intention: 'agir' }), /contrôle FERMÉ \(aria-disabled\) — raison affichée : « Aucune munition »/)
  assert.equal(etat.emis.length, 1)
})

test('`disabled` natif LÈVE dans toutes les intentions, aucun événement émis', async () => {
  const { dom, etat, session } = pagePilotee('<button id="go" disabled>Continuer</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, width: 20, height: 20 })
  for (const intention of ['agir', 'lire']) {
    for (const faire of [() => survoler(session, { selecteur: '#go' }, { attenteMs: 0, intention }), () => toucher(session, { selecteur: '#go' }, { intention }), () => geste(session, { selecteur: '#go' }, { intention }, clic())]) {
      await assert.rejects(faire, /contrôle FERMÉ \(disabled\)/)
    }
  }
  assert.deepEqual(etat.emis, [])
})

test('gestes : un point HORS FENÊTRE est un verdict nommé, jamais un « recouvert par rien »', async () => {
  const { etat, session } = pagePilotee('<svg class="iso-stage"></svg>')
  await assert.rejects(() => geste(session, { surface: 'svg.iso-stage', x: 527, y: -6.7 }, {}, clic()), /HORS FENÊTRE — le point \(527, -7\) sort de la fenêtre/)
  assert.deepEqual(etat.emis, [])
})

test('frappe : une session non branchée n’a aucun émetteur ; `focus` exige l’élément focalisé', async () => {
  await assert.rejects(() => realKey({ rpc: async () => ({}) }, { key: 'a' }), /session sans émetteur d'entrée/)
  const s = sessionClavier()
  await assert.rejects(() => frappe(s, { focus: '#champ', qui: 'essai' }, (emettre) => emettre('texte', { text: 'x' })), /essai « #champ » : la cible n'a pas le focus/)
  assert.deepEqual(s.emis, [])
})

function pageCodexHomonymes(lignes) {
  const p = pagePilotee(`<div class="screen codex"><input class="codex-search"><div class="codex-rows">${lignes.map(([nom, livre], i) =>
    `<button class="listrow" id="r${i}"><span class="lr-name">${nom}</span><span class="codex-row-src">${livre}</span></button>`).join('')}</div></div>`)
  p.dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, width: 20, height: 20 })
  const gerer = socketDe(p.session).gerer
  socketDe(p.session).gerer = async (m, params) => {
    if (m === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased' && p.etat.marque?.tagName === 'INPUT') p.etat.marque.focus()
    if (m === 'Input.insertText') p.doc.activeElement.value = params.text
    const r = await gerer(m, params)
    if (m === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased' && p.etat.marque?.classList.contains('listrow')) {
      for (const b of p.doc.querySelectorAll('.listrow')) b.removeAttribute('aria-current')
      p.etat.marque.setAttribute('aria-current', 'true')
    }
    return r
  }
  return p
}

test('ouvrirFiche : des HOMONYMES lèvent en nommant les livres offerts ; `{ livre }` départage', async () => {
  const { etat, session } = pageCodexHomonymes([['Épée', 'LDB'], ['Épée', 'ADE I']])
  await assert.rejects(() => ouvrirFiche(session, { entree: 'Épée' }), /ouvrirFiche : 2 cibles ambiguës « Épée » — button#r0 « ÉpéeLDB » \| button#r1 « ÉpéeADE I » — préciser \{ livre \} — offerts : LDB \| ADE I ; aucun événement émis/)
  assert.deepEqual(etat.cliques.filter((c) => c.startsWith('Épée')), [])
  assert.deepEqual(await ouvrirFiche(session, { entree: 'Épée', livre: 'ADE I' }), { entree: 'Épée', livre: 'ADE I' })
  assert.equal(etat.cliques.at(-1), 'ÉpéeADE I')
})

// ------------------------------------------------- #1953, quatrième passage : verrou, point, localiseur unique

test('verrou : un `Target.sendMessageToTarget` relayant Input est refusé, la socket n’est pas exposée', async () => {
  const session = brancherFactice(async () => ({}))
  const relais = (method) => session.rpcNavigateur('Target.sendMessageToTarget', { sessionId: 'S1', message: JSON.stringify({ id: 1, method, params: {} }) })
  await assert.rejects(() => relais('Input.dispatchMouseEvent'), /rpc « Target\.sendMessageToTarget » relayant « Input\.dispatchMouseEvent » : le domaine Input n'est émis que par `geste`/)
  await assert.rejects(() => session.rpc('Target.sendMessageToTarget', { message: '{pas du json' }), /message relayé illisible/)
  await relais('Runtime.evaluate')
  assert.deepEqual(socketDe(session).envoyes.map((m) => m.method), ['Target.sendMessageToTarget'])
  assert.ok(!socketDe(session).envoyes.some((m) => /Input\./.test(JSON.stringify(m))), 'aucun Input sur la socket')
  assert.ok(!Object.values(session).some((v) => v === socketDe(session)), 'la session n’expose pas sa socket')
})

test('geste : `emettre` à un autre point que le point contrôlé LÈVE ; le glissé bouton tenu le quitte', async () => {
  const { etat, session } = pagePilotee('<button id="a">A</button><button id="b">B</button>')
  await assert.rejects(() => geste(session, { selecteur: '#a' }, {}, (loc, emettre) => emettre('souris', { type: 'mousePressed', x: 9999, y: -50, button: 'left', clickCount: 1 })),
    /geste : « mousePressed » au point \(9999, -50\), le point contrôlé est \(5, 5\) — seul un glissé bouton tenu quitte le point contrôlé — aucun événement émis/)
  await assert.rejects(() => geste(session, { selecteur: '#a' }, {}, (loc, emettre) => emettre('tactile', { type: 'touchStart', touchPoints: [{ x: 1, y: 1 }] })), /« touchStart » au point \(1, 1\)/)
  await assert.rejects(() => geste(session, { selecteur: '#a' }, {}, (loc, emettre) => emettre('souris', { type: 'mouseReleased', x: 40, y: 40, button: 'left', clickCount: 1 })), /« mouseReleased » au point \(40, 40\)/)
  assert.deepEqual(etat.emis, [])
  await geste(session, { selecteur: '#a' }, {}, clic({ trajet: [{ x: 30, y: 0 }] }))
  assert.deepEqual(etat.emis, ['Input.dispatchMouseEvent:mouseMoved', 'Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseMoved', 'Input.dispatchMouseEvent:mouseReleased'])
})

test('geste et frappe : `emettre` est RÉVOQUÉ au retour du geste — rien ne part après, même au point contrôlé', async () => {
  const { etat, session } = pagePilotee('<button id="a">A</button>')
  let garde
  await geste(session, { selecteur: '#a' }, {}, async (loc, emettre) => { garde = emettre; await emettre('souris', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 }) })
  const avant = [...etat.emis]
  await assert.rejects(() => garde('souris', { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 }), /geste : « emettre » RÉVOQUÉ — le geste est rendu — aucun événement émis/)
  await assert.rejects(() => garde('souris', { type: 'mouseMoved', x: 400, y: 400, buttons: 1 }), /RÉVOQUÉ/)
  let gardeClavier
  await frappe(session, {}, (emettre) => { gardeClavier = emettre })
  assert.throws(() => gardeClavier('touche', { type: 'keyDown', key: 'a' }), /frappe : « emettre » RÉVOQUÉ — la frappe est rendue — aucune frappe émise/)
  assert.deepEqual(etat.emis, avant)
})

test('geste : une émission EN VOL non attendue (relâchement-dépôt) part AVANT le retour du geste, jamais après', async () => {
  const { etat, session } = pagePilotee('<button id="a">A</button>')
  await geste(session, { selecteur: '#a' }, { attenteMs: 0 }, async (loc, emettre) => {
    await emettre('souris', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 })
    emettre('souris', { type: 'mouseReleased', x: 8, y: 8, button: 'left', clickCount: 1 })
  })
  const auRetour = [...etat.emis]
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(auRetour, ['Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseReleased'])
  assert.deepEqual(etat.emis, auRetour)
})

test('geste : un glissé HORS FENÊTRE lève ; son relâchement gauche est un DÉPÔT recontrôlé, qui nomme le voile', async () => {
  const appuyer = (loc, emettre) => emettre('souris', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 })
  const horsFenetre = pagePilotee('<button id="a">A</button>')
  await assert.rejects(() => geste(horsFenetre.session, { selecteur: '#a' }, {}, async (loc, emettre) => {
    await appuyer(loc, emettre)
    await emettre('souris', { type: 'mouseReleased', x: 9999, y: -50, button: 'left', clickCount: 1 })
  }), /geste : glissé « mouseReleased » au point \(9999, -50\) HORS FENÊTRE \(1024×768\) — aucun événement émis ; bouton relâché au point contrôlé \(5, 5\)$/)
  assert.deepEqual(horsFenetre.etat.emis, ['Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseReleased'])
  assert.deepEqual(socketDe(horsFenetre.session).envoyes.filter((m) => m.method === 'Input.dispatchMouseEvent').at(-1).params, { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 })
  const voile = pagePilotee('<button id="a">A</button><div class="voile" style="position:fixed">Modale</div>')
  await assert.rejects(() => geste(voile.session, { selecteur: '#a' }, { attenteMs: 50 }, async (loc, emettre) => {
    await appuyer(loc, emettre)
    voile.doc.elementFromPoint = () => voile.doc.querySelector('.voile')
    await emettre('souris', { type: 'mouseReleased', x: 40, y: 40, button: 'left', clickCount: 1 })
  }), /geste « #a » \(dépôt\) : AUTRE COUCHE — au point \(40, 40\), div\.voile « Modale ».* ; bouton relâché au point contrôlé \(5, 5\)$/)
  assert.deepEqual(voile.etat.emis, ['Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseReleased'])
  assert.deepEqual(socketDe(voile.session).envoyes.filter((m) => m.method === 'Input.dispatchMouseEvent').at(-1).params, { type: 'mouseReleased', x: 5, y: 5, button: 'left', clickCount: 1 })
})

test('ouvrirFiche : `{ livre }` filtre EXACT sur le livre de la rangée — préfixe d’id et livre cité hors rangées', async () => {
  const prefixes = [['Épée', 'tome'], ['Épée', 'tome-compagnon']]
  for (const livre of ['tome', 'tome-compagnon']) {
    const { etat, session } = pageCodexHomonymes(prefixes)
    assert.deepEqual(await ouvrirFiche(session, { entree: 'Épée', livre }), { entree: 'Épée', livre })
    assert.equal(etat.cliques.at(-1), 'Épée' + livre)
  }
  const { doc, etat, session } = pageCodexHomonymes([['Épée', 'LDB'], ['Épée', 'ADE I']])
  doc.querySelector('.screen.codex').insertAdjacentHTML('afterbegin', '<aside class="codex-detail"><p>Source : LDB</p></aside>')
  assert.deepEqual(await ouvrirFiche(session, { entree: 'Épée', livre: 'LDB' }), { entree: 'Épée', livre: 'LDB' })
  assert.equal(etat.cliques.at(-1), 'ÉpéeLDB')
  await assert.rejects(() => ouvrirFiche(session, { entree: 'Épée', livre: 'MDG' }), /ouvrirFiche : aucune rangée « Épée » du livre « MDG » — offertes : Épée \| Épée/)
})

test('infobulleDe : deux bulles ouvertes LÈVENT, une seule se lit, aucune rend `texte: null` ; aucune marque ne reste', async () => {
  const { doc, session } = pagePilotee('<button id="a">Tir</button><div role="tooltip">périmée</div><div role="tooltip">Aucune munition</div>')
  await assert.rejects(() => infobulleDe(session, { nom: 'Tir' }), /infobulleDe : 2 cibles ambiguës « \[role="tooltip"\] » — div « périmée » \| div « Aucune munition »/)
  assert.equal(doc.querySelector('[data-recette-cible]'), null)
  doc.querySelector('[role="tooltip"]').remove()
  assert.equal((await infobulleDe(session, { nom: 'Tir' })).texte, 'Aucune munition')
  doc.querySelector('[role="tooltip"]').remove()
  assert.equal((await infobulleDe(session, { nom: 'Tir' })).texte, null)
  assert.equal(doc.querySelector('[data-recette-cible]'), null)
})

test('localiseur : un refus « vide » ou « hors fenêtre » ne laisse aucune marque', async () => {
  const { dom, doc, etat, session } = pagePilotee('<button id="v">Viser</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0 })
  await assert.rejects(() => toucher(session, { nom: 'Viser' }), /boîte de taille nulle/)
  assert.equal(doc.querySelector('#v').getAttribute('data-recette-cible'), null)
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 5000, y: 10, width: 20, height: 20 })
  await assert.rejects(() => molette(session, { selecteur: '#v' }, 120), /HORS FENÊTRE/)
  assert.equal(doc.querySelector('#v').getAttribute('data-recette-cible'), null)
  assert.deepEqual(etat.emis, [])
})

test('champParLibelle : une racine `dans` AMBIGUË lève, jamais la première', async () => {
  const { dom, session } = sessionSurDom('<div class="modal" id="m1"><label>Nom <input id="i1"></label></div><div class="modal" id="m2"><label>Nom <input id="i2"></label></div>')
  await assert.rejects(() => champParLibelle(session, 'Nom', { dans: '.modal' }), /champParLibelle : 2 racines ambiguës « \.modal » — div#m1 « Nom » \| div#m2 « Nom » — préciser \{ dans \}/)
  assert.equal(dom.window.document.querySelector('[data-recette]'), null)
})

test('poserFichier : deux inputs dans la portée LÈVENT, rien de posé ; la marque est retirée après la pose', async () => {
  const { dom, poses, session } = sessionDomCdp(DEUX_IMPORTS)
  await assert.rejects(() => poserFichier(session, 'input[type=file]', 'x.json'), /poserFichier : 2 cibles ambiguës « input\[type=file\] » — input#import-editeur/)
  assert.deepEqual(poses, [])
  await poserFichier(session, 'input[type=file]', 'x.json', { dans: '.editor-toolbar' })
  assert.deepEqual(poses.map((p) => p.id), ['import-editeur'])
  assert.equal(dom.window.document.querySelector('[data-recette-cible]'), null)
})

test('selectOption : deux listes LÈVENT au localiseur unique, aucun événement émis', async () => {
  const { etat, session } = pagePilotee('<select class="l" id="l1"><option>a</option></select><select class="l" id="l2"><option>a</option></select>')
  await assert.rejects(() => selectOption(session, '.l', 'a'), /selectOption : 2 cibles ambiguës « \.l » — select#l1 « a » \| select#l2 « a » — préciser \{ selecteur \} ou \{ dans \}/)
  assert.deepEqual(etat.emis, [])
})

test('realKey* : `{ focus }` exige la cible focalisée ; sans lui, la touche est globale', async () => {
  const { doc, etat, session } = pagePilotee('<input id="champ"><button id="autre">x</button>')
  for (const faire of [() => realKey(session, { key: 'a' }, { focus: '#champ' }), () => realKeyDown(session, { key: 'a' }, { focus: '#champ' }), () => realKeyUp(session, { key: 'a' }, { focus: '#champ' })]) {
    await assert.rejects(faire, /« #champ » : la cible n'a pas le focus/)
  }
  assert.deepEqual(etat.emis, [])
  doc.querySelector('#champ').focus()
  await realKey(session, { key: 'a' }, { focus: '#champ' })
  await realKey(session, { key: 'Escape' })
  assert.deepEqual(etat.emis, ['Input.dispatchKeyEvent:rawKeyDown', 'Input.dispatchKeyEvent:char', 'Input.dispatchKeyEvent:keyUp', 'Input.dispatchKeyEvent:rawKeyDown', 'Input.dispatchKeyEvent:keyUp'])
})

test('cliquerSelecteur : rend le `label` (nom accessible) de la cible cliquée', async () => {
  const { session } = pagePilotee('<div class="sheet-main"><button role="tab" aria-selected="true">Compétences</button><button role="tab" title="ignoré">État</button></div>')
  const r = await cliquerSelecteur(session, '.sheet-main [role=tab]:not([aria-selected="true"])')
  assert.equal(r.label, 'État')
  assert.equal((await clickItemByText(session, 'Compétences', { selecteur: '.sheet-main [role=tab]' })).label, 'Compétences')
})
