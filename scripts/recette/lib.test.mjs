// Sonde de la LOGIQUE de survie au rechargement du pipeline de capture (#1196, promue en test
// committé sous #1211) : classification des erreurs CDP (`isNavigationError`) et politique de
// rejeu (`withReloadRetry`). Tests PURS — aucun Chrome, aucun serveur, aucun process : la session
// est un faux objet local. Lancé par `npm run test:recette`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAbsolute, join as joinPath, resolve as resolvePath } from 'node:path'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import {
  ALT,
  DELAI_EVALUATE,
  champParLibelle,
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
  decrireChoix,
  brancherCdp,
  fichiersSurveilles,
  killChromeTree,
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
} from './lib.mjs'
import { ENTETE_RACINE } from '../port-dev.mjs'
import { JSDOM } from 'jsdom'
import { demarrer } from './setup.mjs'
import { recette, squelette } from './gabarit.mjs'

/** Session factice : `evaluate` (via `rpc`) répond « app prête » immédiatement, aucun réseau. */
function fakeSession() {
  return {
    contextCleared: false,
    rpc: async () => ({ result: { value: true } }),
  }
}

const err = (message) => new Error(message)

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

test('classification : helper de DEV évaporé — lecture sur undefined/null', () => {
  assert.equal(isNavigationError(err("Cannot read properties of undefined (reading 'screen')")), true)
  assert.equal(isNavigationError(err("Cannot read properties of null (reading 'screen')")), true)
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
  return { emis, rpc: async (methode, params) => { if (methode === 'Input.dispatchKeyEvent') emis.push(params); return { result: { value: true } } } }
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
  return { dom, session: { rpc: async (_m, p) => ({ result: { value: dom.window.eval(p.expression) } }) } }
}
const DEUX_NOMS = `
  <aside class="inspecteur"><label class="field"><span>Nom</span><input id="nom-scene"></label></aside>
  <div class="modal-overlay"><label class="field"><span>Nom</span><input id="nom-projet"></label></div>`

test('champParLibelle : sans racine, le PREMIER champ du document porteur du libellé', async () => {
  const { dom, session } = sessionSurDom(DEUX_NOMS)
  const sel = await champParLibelle(session, 'Nom')
  assert.equal(dom.window.document.querySelector(sel).id, 'nom-scene')
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
  await assert.rejects(() => clickButtonByText(session, 'Choisir', { rangee: 'Middenheim' }), /rangée « Middenheim »/)
  assert.equal(dom.window.vise, undefined)
})

// ------------------------------------------------- poserFichier : domaine DOM du CDP

/** Session dont le domaine `DOM` du CDP est servi par un document jsdom : `nodeId` = rang dans
 *  `noeuds`, 0 = introuvable (la convention du CDP) ; `poses` collectionne les `setFileInputFiles`. */
function sessionDomCdp(html) {
  const dom = new JSDOM(html)
  const noeuds = [null, dom.window.document]
  const poses = []
  const rpc = async (methode, params) => {
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
  return { poses, session: { rpc } }
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
function pagePilotee(html, { auxLectures, recouvrir, battle, jeu = {} } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const doc = dom.window.document
  const etat = { lectures: 0, emis: [], cliques: [], marque: null }
  dom.window.__game = { getState: () => ({ pendingCascade: null, ...jeu }) }
  const gesteCarteAttendu = () => jeu.gesteCarte ?? null
  let wfrp = { gesteCarteAttendu }
  Object.defineProperty(dom.window, '__wfrp', { configurable: true, get: () => wfrp, set: (v) => { wfrp = { gesteCarteAttendu, ...v } } })
  if (battle) dom.window.__wfrp = { battle: () => battle() }
  doc.elementFromPoint = () => (recouvrir && doc.querySelector(recouvrir)) || etat.marque
  dom.window.Element.prototype.scrollIntoView = function () {}
  const rpc = async (methode, p) => {
    if (methode === 'Runtime.evaluate') {
      if (p.expression.includes('aChoix')) { etat.lectures += 1; auxLectures?.(etat.lectures, doc) }
      const valeur = dom.window.eval(p.expression)
      etat.marque = doc.querySelector('[data-recette-cible]') ?? etat.marque
      return { result: { value: valeur } }
    }
    etat.emis.push(`${methode}:${p.type ?? ''}`)
    if (methode === 'Input.dispatchMouseEvent' && p.type === 'mouseReleased' && etat.marque) {
      etat.cliques.push((etat.marque.textContent || '').trim())
      etat.marque.click()
    }
    return {}
  }
  return { dom, doc, etat, session: { rpc } }
}

// ------------------------------------------------- K14 : un clic qui manque sa cible LÈVE

test('clicReel : un élément qui RECOUVRE la cible jusqu’à l’échéance fait lever en NOMMANT le dernier recouvreur, et aucun clic n’est émis', async () => {
  const { etat, session } = pagePilotee('<button id="onglet">Avancement</button><div class="barre-groupe">Groupe</div>', { recouvrir: '.barre-groupe' })
  await assert.rejects(() => clickButtonByText(session, 'Avancement', { attenteMs: 150 }), (e) => {
    assert.match(e.message, /div\.barre-groupe « Groupe »/)
    assert.match(e.message, /RECOUVRE la cible, toujours après 150 ms/)
    return true
  })
  assert.deepEqual(etat.emis, [])
})

test('clicReel : un recouvrement TRANSITOIRE (scène de dés du roulis) est attendu — le clic part dès qu’il disparaît', async () => {
  const { doc, etat, session } = pagePilotee('<button id="appliquer">Appliquer</button><div class="rm-scene">53</div>', { recouvrir: '.rm-scene' })
  setTimeout(() => doc.querySelector('.rm-scene').remove(), 120)
  await clickButtonByText(session, 'Appliquer', { attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Appliquer'])
})

test('resoudreModales : « Appliquer » recouvert le temps du roulis est cliqué sur l’horloge attenteMs, jamais une levée', async () => {
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><button id="appliquer">Appliquer</button></div><div class="rm-scene">53</div></div>', { recouvrir: '.rm-scene' })
  doc.querySelector('#appliquer').onclick = () => doc.querySelector('.modal-overlay').remove()
  setTimeout(() => doc.querySelector('.rm-scene').remove(), 120)
  await resoudreModales(session, 'defense', { pauseMs: 1, attenteMs: 2000 })
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
  await assert.rejects(() => clickButtonByText(session, 'Sigmund Reikhardt'), /aucun bouton ne matche « Sigmund Reikhardt » \(texte EXACT\)/)
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
  await assert.rejects(() => cliquerSelecteur(session, '#absent', { attenteMs: 80 }), /^Error: cliquerSelecteur : « #absent » absent du DOM après 80 ms/)
  assert.deepEqual(etat.emis, [])
})

test('resoudreModales : une LEVÉE porte les choix faits jusque-là (`erreur.choix`)', async () => {
  const jeu = {}
  const { doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Sort"><div class="seg"><button>Zone</button><button>Cible</button></div><button id="lancer" disabled>Lancer</button></div></div>', { jeu })
  doc.querySelector('.seg button').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.gesteCarte = { kind: 'zone', label: 'Boule de feu', casterId: 'h1', radius: 1, rangeTiles: 8 } }
  await assert.rejects(() => resoudreModales(session, 'sort', { pauseMs: 1, attenteMs: 300 }), (e) => {
    assert.match(e.message, /pose de zone en cours/)
    assert.deepEqual(e.choix.map((c) => ({ ...c, offertes: [...c.offertes] })), [{ fenetre: 'Sort', option: 'Zone', offertes: ['Zone', 'Cible'] }])
    return true
  })
})

test('resoudreModales : une option dont le clic est REFUSÉ n’est ni comptée ni imprimée comme choix', async () => {
  const { session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button></div><button id="lancer" disabled>Lancer</button></div><div class="voile">…</div></div>', { recouvrir: '.voile' })
  await assert.rejects(() => resoudreModales(session, 'defense', { pauseMs: 1, attenteMs: 100 }), (e) => {
    assert.match(e.message, /RECOUVRE la cible/)
    assert.deepEqual(e.choix, [])
    return true
  })
})

test('piloterCombat / avancerDeRounds : la levée d’un `resoudreModales` garde les choix CUMULÉS (`erreur.choix`)', async () => {
  const bataille = { round: 1, over: false, actif: 'h1', acted: false, movementUsed: 0, endTurnArmed: false }
  const jeu = {}
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button>Esquive</button></div><button id="lancer" disabled>Lancer</button></div></div>', { jeu })
  dom.window.__wfrp = { battle: () => bataille, auto: () => ({ roundPause: false, activeModal: null, active: { id: 'h1', kind: 'hero' } }) }
  doc.querySelector('.seg button').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.gesteCarte = { kind: 'cibles', label: 'Flèche', casterId: 'h1', cibles: [] } }
  await assert.rejects(() => avancerDeRounds(session, 1, { pauseMs: 1 }), (e) => {
    assert.match(e.message, /choix de cibles en cours/)
    assert.deepEqual(e.choix.map((c) => c.option), ['Parade'])
    return true
  })
})

test('clicReel : la cible atteinte au point est cliquée — la triade souris complète', async () => {
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
  await resoudreModales(session, 'roulis', { pauseMs: 5, attenteMs: 2000 })
  assert.deepEqual(etat.cliques, ['Appliquer'])
  assert.equal(doc.querySelector('.modal-overlay'), null)
})

test('resoudreModales : une fenêtre qui reste sans geste lève à l’échéance en NOMMANT sa dernière lecture', async () => {
  const { session } = pagePilotee(FENETRE('<button disabled>Lancer</button><button>Aide</button>'))
  await assert.rejects(() => resoudreModales(session, undefined, { pauseMs: 5, attenteMs: 60 }), (e) => {
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
  await resoudreModales(session, 'surprise', { pauseMs: 5, attenteMs: 2000 })
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
  session.rpc = ((rpc) => async (m, p) => {
    const r = await rpc(m, p)
    if (m === 'Input.dispatchMouseEvent' && p.type === 'mouseReleased') arme = !arme && etat.cliques.length === 1
    return r
  })(session.rpc)
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

test('piloterCombat : rend `{ lecture, choix }` — les choix de chaque `resoudreModales`, CUMULÉS', async () => {
  const bataille = { round: 1, over: false, actif: 'h1', acted: false, movementUsed: 0, endTurnArmed: false }
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button>Esquive</button></div><button id="lancer" disabled>Lancer</button></div></div>')
  dom.window.__wfrp = { battle: () => bataille, auto: () => ({ roundPause: false, activeModal: null, active: { id: 'h1', kind: 'hero' } }) }
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#lancer').disabled = false }
  doc.querySelector('#lancer').onclick = () => { doc.querySelector('.modal-overlay').remove(); bataille.over = true }
  const r = await piloterCombat(session, { pauseMs: 1 })
  assert.equal(r.lecture.battle.over, true)
  assert.deepEqual(r.choix.map((c) => ({ ...c, offertes: [...c.offertes] })), [{ fenetre: 'Défense', option: 'Parade', offertes: ['Parade', 'Esquive'] }])
})

test('decrireChoix : le rapport de sortie nomme fenêtre, option et options offertes — ou « aucun »', () => {
  assert.equal(decrireChoix([]), 'Choix faits à la place du joueur : aucun.')
  assert.equal(decrireChoix([{ fenetre: 'Défense', option: 'Parade', offertes: ['Parade', 'Esquive'] }]),
    'Choix faits à la place du joueur : 1\n  · « Défense » : « Parade » (offertes : Parade | Esquive)')
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
  assert.deepEqual(r.choix, [])
  assert.deepEqual(appels, ['scenario:entrainement:4', 'fight:enc-entrainement'])
  assert.deepEqual(etat.cliques, ['Commencer le combat'])
})

test('demarrer : les choix faits à l’ouverture du scénario sont RENDUS', async () => {
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Accueil"><div class="seg"><button>Nord</button><button>Sud</button></div><button id="go" disabled>Continuer</button></div></div>')
  dom.window.__wfrp = { scenario: () => '✓', ready: () => true }
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#go').disabled = false }
  doc.querySelector('#go').onclick = () => doc.querySelector('.modal-overlay').remove()
  const { choix } = await demarrer({ session, scenario: 'x' })
  assert.deepEqual(choix.map((c) => c.option), ['Nord'])
})

test('demarrer : une levée porte TOUS les choix faits jusque-là (`erreur.choix`) — ceux d’une étape RÉUSSIE compris', async () => {
  const { dom, doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Accueil"><div class="seg"><button>Nord</button><button>Sud</button></div><button id="go" disabled>Continuer</button></div></div>')
  dom.window.__wfrp = { scenario: () => '✓', ready: () => true, fight: () => '✗ rencontre inconnue' }
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#go').disabled = false }
  doc.querySelector('#go').onclick = () => doc.querySelector('.modal-overlay').remove()
  await assert.rejects(() => demarrer({ session, scenario: 'x', combat: 'y' }), (e) => {
    assert.match(e.message, /rencontre inconnue/)
    assert.deepEqual(e.choix.map((c) => c.option), ['Nord'])
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

test('resoudreModales : une fenêtre qui ne peut avancer qu’une fois tranchée → l’option est CHOISIE, jamais « Fermer »', async () => {
  const { doc, etat, session } = pagePilotee(FENETRE_CHOIX)
  tranchable(doc)
  await resoudreModales(session, 'choix', { pauseMs: 5, attenteMs: 500 })
  assert.deepEqual(etat.cliques, ['Parade', 'Lancer'])
})

/** Défense avec la réaction Porte-Bouclier : groupe FACULTATIF sans défaut (Avantages à dépenser,
 *  aucune option retenue — `useDefenseJetProps`), la Défense elle-même déjà retenue, « Lancer » ouvert. */
const DEFENSE_PORTE_BOUCLIER = '<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button aria-pressed="true">Parade</button><button>Esquive</button></div><div class="rm-loc-grid"><button>Dégâts</button><button>Désarmer</button></div><button id="lancer">Lancer</button></div></div>'

test('resoudreModales : un groupe FACULTATIF sans défaut (Porte-Bouclier) n’est jamais tranché — « Lancer » ouvert est pris', async () => {
  const { doc, etat, session } = pagePilotee(DEFENSE_PORTE_BOUCLIER)
  doc.querySelector('#lancer').onclick = () => doc.querySelector('.modal-overlay').remove()
  const choix = await resoudreModales(session, 'defense', { pauseMs: 1, attenteMs: 200 })
  assert.deepEqual(etat.cliques, ['Lancer'])
  assert.deepEqual(choix, [])
})

test('resoudreModales : une fenêtre à choix TRANCHÉE dont le seul bouton est « Fermer » n’est pas fermée — elle lève', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"><div class="seg"><button aria-pressed="true">Parade</button><button>Esquive</button></div><button>Fermer</button></div>')
  await assert.rejects(() => resoudreModales(session, 'choix', { pauseMs: 5, attenteMs: 60 }), /rien à résoudre .*Fermer/)
  assert.deepEqual(etat.cliques, [])
})

test('resoudreModales : « Conclure » avance un marchandage', async () => {
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"></div>')
  doc.querySelector('.modal-overlay').append(fermant(doc, 'Conclure'))
  await resoudreModales(session, 'marchandage', { pauseMs: 5, attenteMs: 500 })
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
    await assert.rejects(() => resoudreModales(session, 'carte', { pauseMs: 5, attenteMs: 500 }), nomme)
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

test('resoudreModales : RENVOIE les choix faits à la place du joueur — fenêtre, option, options offertes', async () => {
  const { doc, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Défense"><div class="seg"><button>Parade</button><button disabled>Esquive</button><button>Aucune</button></div><button id="lancer" disabled>Lancer</button></div></div>')
  doc.querySelector('.seg button').onclick = (e) => { e.target.setAttribute('aria-pressed', 'true'); doc.querySelector('#lancer').disabled = false }
  doc.querySelector('#lancer').onclick = () => doc.querySelector('.modal-overlay').remove()
  const choix = await resoudreModales(session, 'choix', { pauseMs: 5, attenteMs: 500 })
  assert.deepEqual(choix.map((c) => ({ ...c, offertes: [...c.offertes] })), [{ fenetre: 'Défense', option: 'Parade', offertes: ['Parade', 'Aucune'] }])
})

test('resoudreModales : un bouton d’avancement `[role="button"]` se lit comme un `<button>`', async () => {
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="button" id="l">Lancer</div></div>')
  doc.querySelector('#l').onclick = () => doc.querySelector('.modal-overlay').remove()
  assert.deepEqual(await resoudreModales(session, 'role', { pauseMs: 5, attenteMs: 200 }), [])
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

// ------------------------------------------------- `cliquerAction` : le contrôle fermé est celui de `clicReel`

const CASE = (attrs, raison = '') => `<div class="combat-console"><button data-action="tir" ${attrs}>Tir${raison}</button></div>`

test('cliquerAction : une case FERMÉE qui porte sa raison lève par `clicReel`, raison citée, aucun clic', async () => {
  const { etat, session } = pagePilotee(CASE('data-gated aria-disabled="true" aria-describedby="g"', '<span data-gate id="g">Aucune munition</span>'))
  await assert.rejects(() => cliquerAction(session, 'tir'), /clicReel « tir » : contrôle FERMÉ \(aria-disabled\) — raison affichée : « Aucune munition »/)
  assert.deepEqual(etat.emis, [])
})

test('cliquerAction : une case OUVERTE dont seul le geste secondaire est refusé (`data-gated`) se clique', async () => {
  const { etat, session } = pagePilotee(CASE('data-gated data-refus-2e aria-describedby="g"', '<span data-gate id="g">Focaliser : hors portée</span>'))
  await cliquerAction(session, 'tir')
  assert.equal(etat.cliques.length, 1)
})

// ------------------------------------------------- `selectOption` : doublon averti, option fermée refusée

test('selectOption : deux options de même libellé → la PREMIÈRE, et l’ambiguïté AVERTIE', async (t) => {
  const avert = t.mock.method(console, 'warn', () => {})
  const { session } = pagePilotee('<select id="d"><option value="a">Dague</option><option value="b">Dague</option></select>')
  assert.equal((await selectOption(session, '#d', 'Dague')).valeur, 'a')
  assert.equal(avert.mock.callCount(), 1)
  assert.match(avert.mock.calls[0].arguments[0], /selectOption « #d » « Dague » : 2 cibles matchent \(Dague \[a\] \| Dague \[b\]\)/)
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

test('killChromeTree : sous win32, taskkill « aucun process » (128) passe, tout autre code LÈVE', () => {
  const chrome = { pid: 42 }
  killChromeTree(chrome, { plateforme: 'win32', executer: () => ({ status: 128 }) })
  assert.throws(() => killChromeTree(chrome, { plateforme: 'win32', executer: () => ({ status: 1, stderr: 'Accès refusé.' }) }), /taskkill \/PID 42 a échoué \(code 1\) — Accès refusé\./)
  let tue = false
  killChromeTree({ pid: 42, kill: () => { tue = true } }, { plateforme: 'linux' })
  assert.equal(tue, true)
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
  assert.equal(await purgerProfil('/p', { disque: tenu, pasMs: 1 }), true)
  const refuse = { existe: () => true, supprimer: () => { throw erreurDeCode('EACCES') } }
  await assert.rejects(() => purgerProfil('/p', { disque: refuse, pasMs: 1 }), /EACCES/)
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

test('survoler : un texte qui n’est pas un sélecteur valide retombe sur le texte du contrôle', async () => {
  const { dom, session } = pagePilotee('<button>+ Op</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 20, width: 40, height: 10 })
  assert.deepEqual({ ...(await survoler(session, '+ Op', { attenteMs: 0 })) }, { x: 30, y: 25 })
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

test('resoudreModales : une voie appliquée qui RESTE offerte n’est pas reprise — « Terminer » ouvert est pris', async () => {
  const jeu = { journal: [], pendingCascade: { cursor: 0, participants: [{ kind: 'deviation' }] } }
  const { doc, etat, session } = pagePilotee(CRITIQUE, { jeu })
  doc.querySelector('#devier').onclick = () => { jeu.journal = [...jeu.journal, 'Dévier : −1 PA']; doc.querySelector('#terminer').removeAttribute('aria-disabled') }
  doc.querySelector('#terminer').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.pendingCascade = null }
  const choix = await resoudreModales(session, 'critique', { pauseMs: 1, attenteMs: 200 })
  assert.deepEqual(etat.cliques, ['Dévier (−1 PA)', 'Terminer'])
  assert.deepEqual(choix.map((c) => c.option), ['Dévier (−1 PA)'])
})

test('resoudreModales : une option qui ne change RIEN (options, journal, cascade) lève « ne fait pas avancer »', async () => {
  const { etat, session } = pagePilotee('<div class="modal-overlay"><div class="seg"><button>Parade</button><button>Esquive</button></div></div>')
  await assert.rejects(() => resoudreModales(session, 'inerte', { pauseMs: 1, attenteMs: 200 }), /^Error: \[inerte\] l'option « Parade » ne fait pas avancer la fenêtre \(2 clics sans rien changer/)
  assert.deepEqual(etat.cliques, ['Parade', 'Parade'])
})

test('resoudreModales : des boutons IDENTIQUES ne suffisent pas à lever — l’option qui écrit au journal avance', async () => {
  const jeu = { journal: [] }
  const { doc, session } = pagePilotee('<div class="modal-overlay"><div class="seg"><button>Relancer</button><button>Garder</button></div></div>', { jeu })
  doc.querySelector('.seg button').onclick = () => { jeu.journal = [...jeu.journal, 'relance'] }
  await assert.rejects(() => resoudreModales(session, 'relances', { pauseMs: 1, attenteMs: 200, max: 4 }), (e) => {
    assert.match(e.message, /ne se referment pas après 4 avancements/)
    assert.doesNotMatch(e.message, /ne fait pas avancer/)
    return true
  })
  assert.equal(jeu.journal.length, 4)
})

// ------------------------------------------------- #2306 A : « Poser la zone », puis la case

test('resoudreModales : « Poser la zone » est cliqué, PUIS la pose en cours lève en nommant le geste sur la carte', async () => {
  const jeu = {}
  const { doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Comète à Deux Queues"><button id="poser">Poser la zone</button></div></div>', { jeu })
  doc.querySelector('#poser').onclick = () => { doc.querySelector('.modal-overlay').remove(); jeu.gesteCarte = ZONE }
  await assert.rejects(() => resoudreModales(session, 'zone', { pauseMs: 1, attenteMs: 200 }), /^Error: \[zone\] pose de zone en cours, cliquer une case/)
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
  const jeu = { pendingCascade: { cursor: 0, participants: [{ kind: 'defenseJet', jet: 'defense' }] } }
  const { dom, etat, session } = pagePilotee(`<div class="modal-overlay">${DEFENSE}</div>`, { jeu })
  dom.window.__wfrp = { battle: () => ({ round: 1, over: false, endTurnArmed: false }), auto: () => ({ roundPause: false, activeModal: 'cascade', active: null }) }
  const { lecture } = await piloterCombat(session, { pauseMs: 1, arret: (e) => e.fenetre?.jet === 'defense' })
  assert.deepEqual({ ...lecture.fenetre }, { cle: 'cascade', jet: 'defense', etape: 'defenseJet', nom: 'Défense' })
  assert.deepEqual(etat.cliques, [])
})

test('piloterCombat : une Défense qui s’ouvre PENDANT la résolution arrête aussi `resoudreModales`', async () => {
  const jeu = { pendingCascade: { cursor: 0, participants: [{ kind: 'attackJet', jet: 'attack' }] } }
  const { dom, doc, etat, session } = pagePilotee('<div class="modal-overlay"><div role="dialog" aria-label="Attaque"><button id="lancer">Lancer</button></div></div>', { jeu })
  dom.window.__wfrp = { battle: () => ({ round: 1, over: false, endTurnArmed: false }), auto: () => ({ roundPause: false, activeModal: 'cascade', active: null }) }
  doc.querySelector('#lancer').onclick = () => {
    doc.querySelector('.modal-overlay').innerHTML = DEFENSE
    jeu.pendingCascade = { cursor: 0, participants: [{ kind: 'defenseJet', jet: 'defense' }] }
  }
  const { lecture, choix } = await piloterCombat(session, { pauseMs: 1, arret: (e) => e.fenetre?.jet === 'defense' })
  assert.deepEqual(etat.cliques, ['Lancer'])
  assert.deepEqual(choix, [])
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
  const rpc = p.session.rpc
  p.session.rpc = async (m, params) => {
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
  session.rpc = ((rpc) => async (m, p) => (m === 'Input.dispatchMouseEvent' && p.type === 'mouseWheel' ? {} : rpc(m, p)))(session.rpc)
  await assert.rejects(() => deplierVers(session, '#loin', { pauseMs: 0 }), /la molette ne fait plus défiler vers « #loin »/)
})

test('molette : un cran CDP `mouseWheel` au centre de la partie visible de la cible, sans scrollIntoView', async () => {
  const { etat, session } = pageDefilante('<div id="liste" data-y="100">liste</div>')
  assert.deepEqual({ ...(await molette(session, '#liste', 120)) }, { x: 60, y: 110 })
  assert.deepEqual(etat.crans, [120])
  await assert.rejects(() => molette(session, '#absente', 120), /molette : aucune cible « #absente »/)
})

// ------------------------------------------------- typeInField : la frappe exige le focus

test('typeInField : un <input type=number> qui n’a pas le focus après le clic LÈVE — aucune frappe émise', async () => {
  const { etat, session } = pagePilotee('<input id="n" type="number" value="5">')
  await assert.rejects(() => typeInField(session, '#n', '12'), /typeInField « #n » : le champ n'a pas le focus après le clic \(focus sur body\) — aucune frappe émise/)
  assert.ok(!etat.emis.includes('Input.insertText:'), `émis : ${etat.emis}`)
})

test('typeInField : focalisé par le clic, un <input type=number> pré-rempli est REMPLACÉ (clear)', async () => {
  const { doc, etat, session } = pagePilotee('<input id="n" type="number" value="5">')
  let toutSelectionne = false
  doc.defaultView.HTMLInputElement.prototype.select = function () { toutSelectionne = true }
  const rpc = session.rpc
  session.rpc = async (m, p) => {
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
  await survoler(session, '#b', { attenteMs: 0, defiler: false })
  assert.equal(defilements, 0)
  await survoler(session, '#b', { attenteMs: 0 })
  assert.equal(defilements, 1)
})

// ------------------------------------------------- gestes : clic droit, appui long, toucher

/** Page pilotée qui note chaque événement CDP émis avec ses paramètres, et rend une boîte à toute cible. */
function pageGestes(html) {
  const p = pagePilotee(html)
  p.dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 10, y: 10, width: 20, height: 20 })
  p.etat.params = []
  const rpc = p.session.rpc
  p.session.rpc = async (m, params) => {
    if (m !== 'Runtime.evaluate') p.etat.params.push({ m, t: Date.now(), ...params })
    return rpc(m, params)
  }
  return p
}

test('clicDroit : la triade souris au bouton DROIT, contrôlée comme un clic', async () => {
  const { etat, session } = pageGestes('<div class="pion" role="button">Gobelin</div>')
  assert.deepEqual({ ...(await clicDroit(session, 'Gobelin')) }, { x: 20, y: 20 })
  assert.deepEqual(etat.params.map((e) => `${e.type}:${e.button ?? ''}`), ['mouseMoved:', 'mousePressed:right', 'mouseReleased:right'])
})

test('appuiLong : le bouton est TENU `ms` entre appui et relâchement', async () => {
  const { etat, session } = pageGestes('<button>Fouiller</button>')
  await appuiLong(session, 'Fouiller', 60)
  const appui = etat.params.find((e) => e.type === 'mousePressed')
  const relache = etat.params.find((e) => e.type === 'mouseReleased')
  assert.equal(appui.button, 'left')
  assert.ok(relache.t - appui.t >= 55, `tenu ${relache.t - appui.t} ms`)
})

test('toucher : touchStart au point de la cible, puis touchEnd sans point', async () => {
  const { etat, session } = pageGestes('<button>Viser</button>')
  await toucher(session, 'Viser')
  assert.deepEqual(etat.params.map((e) => ({ m: e.m, type: e.type, points: e.touchPoints })), [
    { m: 'Input.dispatchTouchEvent', type: 'touchStart', points: [{ x: 20, y: 20 }] },
    { m: 'Input.dispatchTouchEvent', type: 'touchEnd', points: [] },
  ])
})

test('gestes : une cible SANS boîte (non rendue) est refusée avant tout événement', async () => {
  const { etat, session } = pagePilotee('<button>Viser</button>')
  await assert.rejects(() => toucher(session, 'Viser'), /toucher « Viser » : boîte de taille nulle/)
  await assert.rejects(() => clicDroit(session, 'Viser'), /clicDroit « Viser » : boîte de taille nulle/)
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
  assert.match(texte, /await recette\(async \(\{ session, choix \}\) => \{/)
})

/** Session factice du gabarit : console à `erreurs`, fermeture comptée. */
const sessionGabarit = (erreurs = []) => ({ fermee: 0, close: async function () { this.fermee += 1 }, console: { errors: () => erreurs, warnings: () => [] } })
const muet = { log: () => {} }

test('gabarit : `recette` démarre, déroule le corps, juge la console, puis ferme la session', async () => {
  const session = sessionGabarit()
  const lances = []
  const vus = []
  const r = await recette(async ({ session: s, choix }) => { vus.push(s, choix) }, { scenario: 'entrainement', sortie: muet, lancer: async (o) => { lances.push(o); return { session, choix: [] } } })
  assert.deepEqual(lances, [{ attacher: true, scenario: 'entrainement', graine: undefined, combat: undefined, url: undefined }])
  assert.equal(vus[0], session)
  assert.deepEqual(r, { choix: [], avertissements: [] })
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
  const rpc = p.session.rpc
  p.session.rpc = async (m, params) => {
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

test('ATTRIBUTS_VOLATILS : le compteur d’images et la file du cuiseur (`GameStage3D.tsx`)', () => {
  assert.deepEqual([...ATTRIBUTS_VOLATILS], ['data-rendus', 'data-file'])
})
