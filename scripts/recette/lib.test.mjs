// Sonde de la LOGIQUE de survie au rechargement du pipeline de capture (#1196, promue en test
// committé sous #1211) : classification des erreurs CDP (`isNavigationError`) et politique de
// rejeu (`withReloadRetry`). Tests PURS — aucun Chrome, aucun serveur, aucun process : la session
// est un faux objet local. Lancé par `npm run test:recette`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAbsolute } from 'node:path'
import {
  ALT,
  DELAI_EVALUATE,
  appelCdp,
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
} from './lib.mjs'
import { ENTETE_RACINE } from '../port-dev.mjs'
import { JSDOM } from 'jsdom'

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

// ── Appel CDP sur une socket fermée (juge G3 #1919, pt.4) : WHATWG jette le message sans lever, la
//    promesse pendait pour toujours et Node sortait en 0 sans conclure. ─────────────────────────────
test('appel CDP sur une socket FERMÉE : rejeté tout de suite, typé cible perdue, rien d’envoyé', async () => {
  const envoyes = []
  const pending = new Map()
  const ws = { readyState: WebSocket.CLOSED, send: (m) => envoyes.push(m) }
  await assert.rejects(appelCdp(ws, pending, () => null, () => 1)('Runtime.evaluate'), (e) => {
    assert.equal(e.code, TARGET_NAVIGATED)
    assert.equal(isNavigationError(e), true)
    return true
  })
  assert.deepEqual(envoyes, [])
  assert.equal(pending.size, 0)
})

test('appel CDP sur une socket OUVERTE : message envoyé, session portée, réglé par sa réponse', async () => {
  const envoyes = []
  const pending = new Map()
  const ws = { readyState: WebSocket.OPEN, send: (m) => envoyes.push(JSON.parse(m)) }
  const appel = appelCdp(ws, pending, () => 'S1', () => 7)('Page.enable', { a: 1 })
  assert.deepEqual(envoyes, [{ id: 7, method: 'Page.enable', params: { a: 1 }, sessionId: 'S1' }])
  pending.get(7).resolve({ ok: true })
  assert.deepEqual(await appel, { ok: true })
})
