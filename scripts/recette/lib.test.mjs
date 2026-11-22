// Tests du pilotage de Chromium par CDP, du cycle de processus et des gestes.
// La session utilise une socket factice. Sous Windows, `lireProcessus` vérifie aussi la commande CIM via PowerShell.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAbsolute, join as joinPath, resolve as resolvePath } from 'node:path'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import {
  ALT,
  DELAI_EVALUATE,
  champParLibelle,
  clickItemByText,
  clickButtonByText,
  MOD_ALT,
  frapperTouche,
  realKey,
  realKeyDown,
  realKeyUp,
  evaluate,
  isNavigationError,
  poserFichier,
  resoudreChrome,
  TARGET_NAVIGATED,
  cliquerSelecteur,
  consoleGuard,
  OPTIONS_SPAWN_CHROME,
  purgerProfilsOrphelins,
  nomDeProfil,
  pidDeProfil,
  selectOption,
  cliquerPremierOffert,
  brancherCdp,
  killChromeTree,
  lireProcessus,
  nettoyerALaSortie,
  lireDevToolsActivePort,
  purgerProfil,
  leverApresNettoyage,
  espionReseau,
  survoler,
  attendreSelecteur,
  molette,
  deplierVers,
  typeInField,
  clicDroit,
  appuiLong,
  toucher,
  infobulleDe,
  dernierTelechargement,
  DOSSIER_TELECHARGEMENTS,
  shot,
  verdictDebordement,
  ATTRIBUTS_VOLATILS,
  geste,
  clic,
  frappe,
} from './lib.mjs'
import { JSDOM } from 'jsdom'
import * as kitRecette from './lib.mjs'

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

const err = (message) => new Error(message)

test('destination de shot : dossier omis écrit au temporaire canonique, relatif refusé avant événement', async () => {
  assert.ok(resolvePath(kitRecette.DOSSIER_CAPTURES).toLowerCase().startsWith(resolvePath(os.tmpdir()).toLowerCase()), 'défaut hors arbre au temporaire')
  assert.ok(!resolvePath(kitRecette.DOSSIER_CAPTURES).toLowerCase().startsWith(resolvePath(process.cwd()).toLowerCase()), 'aucune capture par défaut dans l’arbre')
  const nom = 'capture-kit-shot-' + process.pid + '-' + Date.now()
  const appels = []
  const session = { rpc: async (m) => {
    appels.push(m)
    return m === 'Page.captureScreenshot' ? { data: Buffer.from('PNG-test').toString('base64') } : { result: { value: { x: 100, y: 100 } } }
  } }
  let chemin
  try {
    chemin = await shot(session, nom)
    assert.equal(resolvePath(chemin), resolvePath(joinPath(kitRecette.DOSSIER_CAPTURES, nom + '.png')))
    assert.ok(isAbsolute(chemin))
    assert.ok(existsSync(chemin))
    appels.length = 0
    await assert.rejects(() => shot(session, nom, '.', { neutraliser: true }), /dossier.*absolu/)
    assert.deepEqual(appels, [])
  } finally {
    if (chemin) rmSync(chemin, { force: true })
    assert.equal(existsSync(resolvePath(nom + '.png')), false)
  }
})


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


test('rangée marchande : texte hors table rend ambiguïté nommant les rangées retenues, scope départage', async () => {
  const { etat, session } = pagePilotee('<div id="marché"><p>Lance</p><table><tbody><tr id="lance"><td>Lance</td><td><button>Ajouter</button></td></tr><tr id="épée"><td>Épée</td><td><button>Ajouter</button></td></tr></tbody></table></div>')
  await assert.rejects(() => clickButtonByText(session, 'Ajouter', { rangee: 'Lance' }), /ambiguës.*rangées retenues.*Lance.*Épée/)
  assert.deepEqual(etat.emis, [])
  await clickButtonByText(session, 'Ajouter', { rangee: 'Lance', dans: 'table' })
  assert.deepEqual(etat.cliques, ['Ajouter'])
})

test('nom ARIA vide : contenu valide retrouvé avant title', async () => {
  const { etat, session } = pagePilotee('<button aria-label="" title="Autre nom">Nom valide</button>')
  await clickButtonByText(session, 'Nom valide')
  assert.deepEqual(etat.cliques, ['Nom valide'])
})



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

test('classification : globale effacée — window.__exemple is not a function / undefined', () => {
  assert.equal(isNavigationError(err('window.__exemple is not a function')), true)
  assert.equal(isNavigationError(err('window.__exemple is undefined')), true)
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

test('waitFor : chaque évaluation est bornée par `evaluerMs`, le défaut du kit sans lui', async () => {
  const vus = []
  const session = { rpc: async (m, p) => { vus.push(p.timeout); return { result: { value: vus.length > 1 } } } }
  assert.equal(await kitRecette.waitFor(session, 'pret', { timeoutMs: 1000, intervalMs: 1, evaluerMs: 120000 }), true)
  assert.deepEqual(vus, [120000, 120000])
  vus.length = 1
  await kitRecette.waitFor(session, 'pret')
  assert.deepEqual(vus.slice(1), [DELAI_EVALUATE])
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
  await assert.rejects(() => champParLibelle(session, 'Nom'), /champParLibelle : 2 cibles ambiguës « Nom » — input#nom-scene \| input#nom-projet — préciser \{ dans \}/)
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

test('Chrome : les deux dispositions de Playwright sont trouvées — chrome-linux64 (récente) comme chrome-linux', () => {
  const recent = `/pw/chromium-1243/chrome-linux64/chrome`
  const fsRecent = disque([recent], { '/pw': ['chromium-1243', 'chromium_headless_shell-1243'] })
  assert.equal(resoudreChrome({ env: { PLAYWRIGHT_BROWSERS_PATH: '/pw' }, fs: fsRecent, uid: 1000 }).chemin, recent)
  const fsAncien = disque([PW('/pw', 1194)], { '/pw': ['chromium-1194'] })
  assert.equal(resoudreChrome({ env: { PLAYWRIGHT_BROWSERS_PATH: '/pw' }, fs: fsAncien, uid: 1000 }).chemin, PW('/pw', 1194))
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
    assert.match(e.message, /\/opt\/pw-browsers\/chromium-\*\/chrome-linux64\/chrome/)
    return true
  })
})

// ------------------------------------------------- page jsdom PILOTÉE : clics réels simulés

/** Page jsdom pilotée comme par le CDP : `Runtime.evaluate` évalue dans le document ; la cible qu'un
 *  localisateur MARQUE (`data-recette-cible`) est ce que `elementFromPoint` rend au point, sauf si
 *  `recouvrir` désigne un autre élément PRÉSENT ; `mouseReleased` clique ce qu'il y a au point. */
function pagePilotee(html, { recouvrir } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' })
  const doc = dom.window.document
  const etat = { emis: [], cliques: [], marque: null }
  doc.elementFromPoint = () => (recouvrir && doc.querySelector(recouvrir)) || etat.marque
  dom.window.Element.prototype.scrollIntoView = function () {}
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 10, height: 10 })
  const rpc = async (methode, p) => {
    if (methode === 'Runtime.evaluate') {
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

test('clic ambigu : refuse avant tout événement, portée explicite départage', async () => {
  const { etat, session } = pagePilotee('<div id="a"><button>Nain</button></div><div id="b"><button>Nain</button></div>')
  await assert.rejects(() => clickButtonByText(session, 'Nain'), /cibles ambiguës/)
  assert.deepEqual(etat.emis, [])
  await clickButtonByText(session, 'Nain', { dans: '#b' })
  assert.deepEqual(etat.cliques, ['Nain'])
})

test('libellé de select enveloppé : options exclues, champ intact', async () => {
  const { dom, session } = sessionSurDom('<label>Espèce (créateur)<select><option>Humain</option><option>Nain</option></select></label>')
  const sel = await champParLibelle(session, 'Espèce (créateur)')
  assert.equal(dom.window.document.querySelector(sel).tagName, 'SELECT')
  assert.equal(dom.window.document.querySelectorAll('option').length, 2)
})



test('instantanés processus : Windows et ps complets, formes malformées refusées avant arrêt', () => {
  const lire = (plateforme, stdout) => lireProcessus({ plateforme, executer: () => ({ status: 0, stdout }), horloge: () => 100000 })
  assert.deepEqual(lire('win32', '[{"ProcessId":42,"ParentProcessId":0,"Cree":5000}]'), [{ pid: 42, parent: 0, cree: 5000 }])
  lireProcessus({ plateforme: 'win32', executer: (_commande, args) => {
    assert.ok(args.at(-1).includes('Get-CimInstance Win32_Process -Filter "ProcessId > 0"') && args.at(-1).includes('CreationDate'))
    return { status: 0, stdout: '[]' }
  } })
  assert.deepEqual(lire('linux', ' 42 0 30 Ss\n43 42 2 Sl\n44 42 1 Z\n'), [{ pid: 42, parent: 0, cree: 70000 }, { pid: 43, parent: 42, cree: 98000 }])
  for (const stdout of ['{}', '[{}]', '[null]', '[{"ProcessId":42}]', '[{"ProcessId":0,"ParentProcessId":1}]', '[{"ProcessId":"42","ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":-1}]', '[{"ProcessId":42.1,"ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":1},{"ProcessId":42,"ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":1,"Cree":-1}]', '[{"ProcessId":42,"ParentProcessId":1}]', '[{"ProcessId":42,"ParentProcessId":1,"Cree":null}]', '[{"ProcessId":42,"ParentProcessId":1,"Cree":"hier"}]']) {
    assert.throws(() => lire('win32', stdout), /malformé/)
  }
  for (const stdout of ['42 1 3', '42 nope 3 S', '42 1 3 S surplus', '0 1 3 S', '42 -1 3 S', '42.1 1 3 S', '42 1 3 S\n43', '42 1 3 S\n42 1 3 Z']) {
    assert.throws(() => lire('linux', stdout), /malformé/)
  }
  let arrets = 0
  for (const instantane of [null, [{}], [{ pid: NaN, parent: 0 }], [{ pid: 42, parent: undefined, cree: 0 }], [{ pid: 42, parent: 0 }], [{ pid: 42, parent: 0, cree: 0 }, { pid: 42, parent: 1, cree: 0 }]]) {
    assert.throws(() => killChromeTree({ pid: 42 }, { plateforme: 'win32', observer: () => instantane, executer: () => { arrets++; return { status: 0 } } }), /malformé/)
  }
  assert.equal(arrets, 0)
})

/** Bouton qui FERME la fenêtre au clic. */




// ------------------------------------------------- D4 : le pilote de combat









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

test('Chrome n’est JAMAIS lancé `detached` : il meurt avec le process qui le tient (K9)', () => {
  assert.equal('detached' in OPTIONS_SPAWN_CHROME, false)
  assert.equal(Object.isFrozen(OPTIONS_SPAWN_CHROME), true)
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
    lireLien: (c) => liens.get(c) ?? null,
    lister: () => [...d, ...f.keys()].map((c) => c.split('/').pop()),
    supprimer: (c) => { f.delete(c); d.delete(c) },
  }
}

/** L'identité feinte d'un pid : création mesurée `creation`, tolérance 1 s ; ses lectures. */
const identiteFeinte = (creation) => {
  const lectures = []
  return { lectures, identite: { toleranceMs: 1_000, lireCreation: (pid) => { lectures.push(pid); return creation } } }
}

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

test('brancherCdp : la page PLANTE, tout appel sur SA session, en vol ou à venir, est rejeté typé, sans passer pour une navigation', async () => {
  const ecoutes = { message: [], close: [] }
  const envoyes = []
  const ws = { addEventListener: (t, fn) => ecoutes[t].push(fn), send: (brut) => envoyes.push(JSON.parse(brut).method), readyState: WebSocket.OPEN }
  const dire = (m) => ecoutes.message.forEach((fn) => fn({ data: JSON.stringify(m) }))
  const session = brancherCdp(ws, { sessionId: 'S' })
  let regle = false
  const enVol = bornee(session.rpc('Runtime.evaluate', { expression: '1' }).finally(() => { regle = true }))
  const duNavigateur = bornee(session.rpcNavigateur('Target.closeTarget', { targetId: 'T' }), 50)
  dire({ method: 'Inspector.targetCrashed', sessionId: 'autre' })
  await new Promise((r) => setTimeout(r))
  assert.equal(regle, false)
  dire({ method: 'Inspector.targetCrashed', sessionId: 'S' })
  const issue = await enVol
  assert.equal(issue.code, kitRecette.PAGE_PLANTEE)
  assert.equal(isNavigationError(issue), false)
  assert.equal((await bornee(session.rpc('Runtime.evaluate', { expression: '2' }))).code, kitRecette.PAGE_PLANTEE)
  assert.deepEqual(envoyes, ['Runtime.evaluate', 'Target.closeTarget'])
  assert.equal(await duNavigateur, 'PENDU')
})


test('purgerProfilsOrphelins : FAIL-SAFE — lanceur vivant ÉPARGNÉ (gardien ou session ponctuelle), lanceur mort PURGÉ, sans PID ÉPARGNÉ', async () => {
  const dossier = resolvePath('/tmp')
  const ponctuel = nomDeProfil(101) // `launchSession` d'un autre arbre, sans fichier de session
  const mort = nomDeProfil(202)
  const ancien = 'recette-cdp-profile-1700000000000-42' // nom sans PID
  const noms = [ponctuel, mort, ancien, 'autre-dossier']
  const disque = disqueMemoire({}, noms.map((n) => resolvePath(dossier, n)))
  disque.lister = () => noms.filter((n) => disque.existe(resolvePath(dossier, n)))
  const bilan = await purgerProfilsOrphelins({ dossier, disque, vivant: (pid) => pid === 101, identite: identiteFeinte(null).identite, plateforme: 'win32' })
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
  const { identite, lectures } = identiteFeinte(Number.MAX_SAFE_INTEGER)
  const bilan = await purgerProfilsOrphelins({ dossier, disque, vivant, identite, plateforme: 'linux', hote: 'hote-a' })
  assert.deepEqual(bilan, { trouves: 5, purges: 2, vivants: 1, sansPreuve: [chemin(n.autreHote), chemin(n.illisible)], echecs: [] })
  assert.deepEqual(lectures, [], 'le `SingletonLock` ne porte aucune naissance : l’existence seule (`NAISSANCE_ABSENTE`), jamais mesurée')
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

// #2603
test('purgerProfilsOrphelins : un lanceur RÉUTILISÉ depuis la naissance de son nom est mort, son profil PURGÉ ; sous la tolérance, ÉPARGNÉ', async () => {
  for (const [ecart, purges, vivants] of [[1_001, 1, 0], [1_000, 0, 1]]) {
    const dossier = resolvePath('/tmp')
    const nom = nomDeProfil(101)
    const disque = disqueMemoire({}, [resolvePath(dossier, nom)])
    disque.lister = () => [nom].filter((n) => disque.existe(resolvePath(dossier, n)))
    const { identite, lectures } = identiteFeinte(pidDeProfil(nom).naissance + ecart)
    const bilan = await purgerProfilsOrphelins({ dossier, disque, vivant: () => true, identite, plateforme: 'win32' })
    assert.deepEqual([bilan.purges, bilan.vivants, lectures], [purges, vivants, [101]], `création à naissance + ${ecart} ms`)
  }
})

test('nomDeProfil / pidDeProfil : le lanceur (PID et naissance) se consigne et se relit ; un nom ancien n’en porte aucun', () => {
  const avant = Date.now()
  const lu = pidDeProfil(nomDeProfil(4321))
  assert.equal(lu?.pid, 4321)
  assert.ok(lu.naissance >= avant && lu.naissance <= Date.now(), `naissance ${lu.naissance}`)
  assert.equal(pidDeProfil('recette-cdp-profile-1700000000000-42'), null)
})

// ------------------------------------------------- setup.mjs : la mise en place partagée

// ------------------------------------------------- K16 : capture d'un pion




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

/** Retenir une option ouvre « Lancer » (patron d'une fenêtre à choix obligatoire). */


/** Défense avec la réaction Porte-Bouclier : groupe FACULTATIF sans défaut (Avantages à dépenser,
 *  aucune option retenue — `useDefenseJetProps`), la Défense elle-même déjà retenue, « Lancer » ouvert. */






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


// ------------------------------------------------- `resoudreModales` : choix RENDUS, contrôles par `SELECTEUR_CONTROLES`



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

test('geste : aria-disabled ferme le contrôle et cite la raison sans émettre', async () => {
  const { etat, session } = pagePilotee('<button id="a" aria-disabled="true" aria-describedby="raison">Ouvrir</button><span id="raison">Fichier verrouillé</span>')
  await assert.rejects(() => geste(session, { selecteur: '#a' }, {}, clic()), /contrôle FERMÉ \(aria-disabled\) — raison affichée : « Fichier verrouillé »/)
  assert.deepEqual(etat.emis, [])
})

test('geste : la raison d’un geste secondaire ne ferme pas le contrôle', async () => {
  const { etat, session } = pagePilotee('<button id="a" data-gated aria-describedby="raison">Ouvrir</button><span id="raison">Édition indisponible</span>')
  await geste(session, { selecteur: '#a' }, {}, clic())
  assert.deepEqual(etat.cliques, ['Ouvrir'])
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


/** Lecteur de `DevToolsActivePort` qui rend `etats` dans l'ordre (le dernier se répète) ; `null` = fichier absent. */
const lecteurDe = (...etats) => {
  const lus = []
  return { lus, lire: (chemin) => { lus.push(chemin); const e = etats[Math.min(lus.length, etats.length) - 1]; if (e === null) throw erreurDeCode('ENOENT'); return e } }
}

test('lireDevToolsActivePort : le port de la première ligne, le WebSocket du chemin de la seconde, lus dans le profil', async () => {
  const l = lecteurDe('41237\n/devtools/browser/0b5e-77\n')
  assert.deepEqual(await lireDevToolsActivePort('/p', 1000, l), { port: 41237, wsUrl: 'ws://127.0.0.1:41237/devtools/browser/0b5e-77' })
  assert.deepEqual(l.lus, [joinPath('/p', 'DevToolsActivePort')])
})

for (const [cas, etat] of [['absent', null], ['vide', ''], ['d’une seule ligne', '41237\n']]) {
  test(`lireDevToolsActivePort : un fichier ${cas} s’attend, puis se lit`, async () => {
    const l = lecteurDe(etat, '41237\n/devtools/browser/0b5e-77')
    assert.equal((await lireDevToolsActivePort('/p', 2000, l)).port, 41237)
    assert.equal(l.lus.length, 2)
  })
}

test('lireDevToolsActivePort : à l’échéance, l’erreur NOMME le fichier attendu', async () => {
  await assert.rejects(() => lireDevToolsActivePort('/p', 50, lecteurDe('41237\n')), (e) => e.message.includes(joinPath('/p', 'DevToolsActivePort')) && /"41237"/.test(e.message))
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

function arretChromeObserve(instantanes, { plateforme = 'win32', attenteMs = 0 } = {}) {
  let lecture = 0
  let maintenant = 20_000
  const tues = []
  return {
    tues,
    arreter: () => killChromeTree({ pid: 42 }, {
      plateforme,
      attenteMs,
      observer: () => instantanes[Math.min(lecture++, instantanes.length - 1)],
      executer: () => ({ status: 255, stderr: 'arrêt simulé' }),
      tuerPid: (pid) => tues.push(pid),
      horloge: () => maintenant,
      patienter: (ms) => { maintenant += ms },
    }),
  }
}

for (const phase of ['avant', 'après']) {
  test(`killChromeTree : l’orphelin ancien et sa branche ne survivent pas dans le verdict (première vue ${phase} l’arrêt)`, () => {
    const racine = { pid: 42, parent: 1, cree: 10_000 }
    const orphelin = { pid: 43, parent: 42, cree: 9_999 }
    const branche = [orphelin, { pid: 44, parent: 43, cree: 10_001 }]
    const avant = phase === 'avant' ? [...branche, racine] : [racine]
    const { arreter } = arretChromeObserve([avant, branche])
    assert.deepEqual(arreter(), { racine: 42, observes: [42], survivants: [] })
  })
}

test('killChromeTree : la filiation par ps tolère 1 500 ms et garde l’arrêt du descendant avant le parent', () => {
  const avant = [
    { pid: 44, parent: 43, cree: 9_000 },
    { pid: 43, parent: 42, cree: 8_500 },
    { pid: 45, parent: 42, cree: 8_499 },
    { pid: 46, parent: 45, cree: 10_000 },
    { pid: 42, parent: 1, cree: 10_000 },
  ]
  const { arreter, tues } = arretChromeObserve([avant, []], { plateforme: 'linux' })
  assert.deepEqual(arreter().observes, [42, 43, 44])
  assert.deepEqual(tues, [44, 43, 42])
})

test('killChromeTree : parent absent, une date connue autorise la filiation à la milliseconde près', () => {
  const racine = { pid: 42, parent: 1, cree: 10_000 }
  const parent = { pid: 43, parent: 42, cree: 11_000 }
  const orphelinAncien = { pid: 44, parent: 43, cree: 10_999 }
  const orphelinConnu = { pid: 45, parent: 43, cree: 11_000 }
  const sansDate = { pid: 46, parent: 42, cree: 12_000 }
  const { arreter } = arretChromeObserve([[racine, parent], [orphelinAncien, orphelinConnu], []], { attenteMs: 50 })
  assert.deepEqual(arreter().observes, [42, 43, 45])
  assert.deepEqual(arretChromeObserve([[sansDate], [sansDate]]).arreter().observes, [42])
})

test('killChromeTree : le remplacement d’un parent borne les admissions aux relevés suivants', () => {
  const racine = { pid: 42, parent: 1, cree: 10_000 }
  const parent = { pid: 43, parent: 42, cree: 11_000 }
  const remplace = { ...parent, cree: 12_000 }
  const descendant = { pid: 44, parent: 43, cree: 11_250 }
  const orphelin = { pid: 45, parent: 43, cree: 11_500 }
  const enfantRemplace = { pid: 46, parent: 43, cree: 12_500 }
  const tardif = { pid: 47, parent: 44, cree: 20_001 }
  const avant = [racine, descendant, parent]
  const orphelinAvecRemplacant = arretChromeObserve([avant, [remplace, orphelin, enfantRemplace]])
  assert.throws(orphelinAvecRemplacant.arreter, /survivants 45 après arrêt de 42/)
  const apres = [
    [remplace, { ...descendant, parent: 1 }, enfantRemplace],
    [tardif, { ...descendant, parent: 1 }, orphelin, enfantRemplace],
  ]
  const { arreter } = arretChromeObserve([avant, ...apres], { attenteMs: 50 })
  assert.throws(arreter, /survivants 44, 45 après arrêt de 42 \(code 255\) et 50 ms d’attente — arrêt simulé$/)
})

test('killChromeTree : un descendant découvert après l’arrêt conserve aussi sa première naissance', () => {
  const racine = { pid: 42, parent: 1, cree: 10_000 }
  const parent = { pid: 43, parent: 42, cree: 11_000 }
  const enfantRemplace = { pid: 44, parent: 43, cree: 12_500 }
  const { arreter } = arretChromeObserve([[racine], [parent], [{ ...parent, cree: 12_000 }, enfantRemplace]], { attenteMs: 50 })
  assert.deepEqual(arreter(), { racine: 42, observes: [42, 43], survivants: [] })
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

test('attendreSelecteur : l’échéance se NOMME ; une évaluation cassée remonte telle quelle', async () => {
  const absent = { rpc: async () => ({ result: { value: false } }) }
  await assert.rejects(() => attendreSelecteur(absent, '.x', { timeoutMs: 30 }), /« \.x » absent du DOM après 30 ms/)
  const cassee = { rpc: async () => { throw new Error('Internal error') } }
  await assert.rejects(() => attendreSelecteur(cassee, '.x', { timeoutMs: 30 }), /Internal error/)
})

// ------------------------------------------------- #2306 B : choisir n'est pas avancer

/** Fenêtre de Blessure critique : les voies Dévier/Subir en grille (`OptionChooser layout="grid"`,
 *  `src/ui/CascadeModal.tsx` branche `choix`) et « Terminer » — patron `CascadeTableMode.test.tsx:655`. */




// ------------------------------------------------- #2306 A : « Poser la zone », puis la case


// ------------------------------------------------- avancerDeRounds, et l'arrêt sur une fenêtre nommée

/** Combat factice : la plaque de fin de tour s'ARME au premier clic (« Finir quand même »), passe la
 *  main au second ; la pause de début de Round attend « Commencer le round N » (`debut-de-round`). */



/** Une Défense ouverte en étape de cascade (`jet: 'defense'`, `combatFlow.ts`), élue par l'arbitre. */




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

test('deplierVers : le clic du <summary> attend son recouvrement pendant `attenteMs`, pas le défaut', async () => {
  const { doc, etat, session } = pageDefilante('<details><summary data-y="100">Près</summary><input id="champ"></details><div id="voile" data-y="100">voile</div>')
  doc.elementFromPoint = () => doc.querySelector('#voile')
  await assert.rejects(() => deplierVers(session, '#champ', { pauseMs: 0, attenteMs: 30 }), /^Error: deplierVers .* RECOUVRE la cible, toujours après 30 ms — aucun événement émis$/)
  assert.deepEqual(etat.cliques, [])
})

test('deplierVers : une molette qui ne fait plus défiler LÈVE en le nommant', async () => {
  const { session } = pageDefilante('<p id="loin" data-y="5000">loin</p>')
  socketDe(session).gerer = ((rpc) => async (m, p) => (m === 'Input.dispatchMouseEvent' && p.type === 'mouseWheel' ? {} : rpc(m, p)))(socketDe(session).gerer)
  await assert.rejects(() => deplierVers(session, '#loin', { pauseMs: 0 }), /la molette ne fait plus défiler vers « #loin »/)
})

test('molette : le pointeur posé puis un cran CDP `mouseWheel` au centre de la partie visible de la cible, sans scrollIntoView', async () => {
  const { etat, session } = pageDefilante('<div id="liste" data-y="100">liste</div>')
  const souris = []
  const rpc = socketDe(session).gerer
  socketDe(session).gerer = async (m, params) => { if (m === 'Input.dispatchMouseEvent') souris.push([params.type, params.x, params.y]); return rpc(m, params) }
  const point = await molette(session, { selecteur: '#liste' }, 120)
  assert.deepEqual({ x: point.x, y: point.y }, { x: 60, y: 110 })
  assert.deepEqual(etat.crans, [120])
  assert.deepEqual(souris, [['mouseMoved', 60, 110], ['mouseWheel', 60, 110]], 'le pointeur est posé au point du cran avant la molette')
  await assert.rejects(() => molette(session, { selecteur: '#absente' }, 120), /molette : aucune cible « #absente »/)
})

test('molette : `crans` crans tournés d’un même geste, au point contrôlé, le pointeur posé une fois', async () => {
  const { etat, session } = pageDefilante('<div id="liste" data-y="100">liste</div>')
  const souris = []
  const rpc = socketDe(session).gerer
  socketDe(session).gerer = async (m, params) => { if (m === 'Input.dispatchMouseEvent') souris.push([params.type, params.x, params.y]); return rpc(m, params) }
  await molette(session, { selecteur: '#liste' }, -120, { crans: 3 })
  assert.deepEqual(etat.crans, [-120, -120, -120])
  assert.deepEqual(souris, [['mouseMoved', 60, 110], ['mouseWheel', 60, 110], ['mouseWheel', 60, 110], ['mouseWheel', 60, 110]])
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

test('clickButtonByText : `attendreChangement` — un clic qui ne change pas le DOM LÈVE en le nommant', async () => {
  const { session } = pagePilotee('<button>Exporter</button>')
  await assert.rejects(() => clickButtonByText(session, 'Exporter', { attendreChangement: 150 }), /clickButtonByText « Exporter » : le clic n'a RIEN changé, le DOM n'a pas bougé en 150 ms/)
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

test('cliquerSelecteur / clickButtonByText : `attendreChangement` passe dès que le DOM change', async () => {
  const { dom, doc, session } = pagePilotee('<button id="tiroir" aria-expanded="false">☰</button><button>Ouvrir</button>')
  dom.window.Element.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, width: 10, height: 10 })
  doc.querySelector('#tiroir').onclick = (event) => event.currentTarget.setAttribute('aria-expanded', 'true')
  doc.querySelectorAll('button')[1].onclick = () => doc.body.append(doc.createElement('aside'))
  await cliquerSelecteur(session, '#tiroir', { attendreChangement: 150 })
  await clickButtonByText(session, 'Ouvrir', { attendreChangement: true })
})

test('localiseur unique : racine ou cible en double refusée, marque retirée après le clic', async () => {
  const { doc, etat, session } = pagePilotee('<section class="zone" id="a"><button>Lire</button></section><section class="zone"><button>Lire</button></section>')
  await assert.rejects(() => geste(session, { nom: 'Lire', dans: '.zone' }, {}, clic()), /2 racines ambiguës « \.zone »/)
  await assert.rejects(() => geste(session, { selecteur: 'button' }, {}, clic()), /2 cibles ambiguës « button »/)
  assert.deepEqual(etat.emis, [])
  await geste(session, { nom: 'Lire', dans: '#a' }, {}, clic())
  assert.deepEqual(etat.cliques, ['Lire'])
  assert.equal(doc.querySelector('[data-recette-cible]'), null)
})

test('ATTRIBUTS_VOLATILS : le compteur d’images et la file de rendu', () => {
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
    [{ nom: 'Nain' }, /2 cibles ambiguës « Nain » — button#nain1\.pion « Nain » \| button#nain2\.pion « Nain »/],
    [{ selecteur: '.pion' }, /2 cibles ambiguës « \.pion » — button#nain1\.pion « Nain » \| button#nain2\.pion « Nain »/],
    [{ surface: 'svg.iso-stage', x: 5, y: 5 }, /2 cibles ambiguës « svg\.iso-stage » — svg\.iso-stage \| svg\.iso-stage —/],
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
  await assert.rejects(() => gardeClavier('touche', { type: 'keyDown', key: 'a' }), /frappe : « emettre » RÉVOQUÉ — la frappe est rendue — aucune frappe émise/)
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

test('frappe : une frappe NON ATTENDUE refusée fait LEVER la frappe, et rien ne part après son retour', async () => {
  const { etat, session } = pagePilotee('')
  const servir = socketDe(session).gerer
  socketDe(session).gerer = async (methode, params) => {
    if (methode !== 'Input.insertText') return servir(methode, params)
    await new Promise((r) => setTimeout(r, 20))
    await servir(methode, params)
    throw new Error('insertion refusée')
  }
  await assert.rejects(() => frappe(session, { qui: 'taper' }, (emettre) => { emettre('texte', { text: 'x' }) }), /insertion refusée/)
  const auRetour = [...etat.emis]
  await new Promise((r) => setTimeout(r, 50))
  assert.deepEqual(auRetour, ['Input.insertText:'])
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

test('geste : un relâchement-dépôt NON ATTENDU refusé sous un voile fait LEVER le geste, le recouvrant nommé', async () => {
  const { doc, etat, session } = pagePilotee('<button id="a">A</button><div class="voile" style="position:fixed">Modale</div>')
  await assert.rejects(() => geste(session, { selecteur: '#a' }, { attenteMs: 30 }, async (loc, emettre) => {
    await emettre('souris', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 })
    doc.elementFromPoint = () => doc.querySelector('.voile')
    emettre('souris', { type: 'mouseReleased', x: 8, y: 8, button: 'left', clickCount: 1 })
  }), /AUTRE COUCHE — au point \(8, 8\), div\.voile « Modale ».* ; bouton relâché au point contrôlé \(5, 5\)$/)
  assert.deepEqual(etat.emis, ['Input.dispatchMouseEvent:mousePressed', 'Input.dispatchMouseEvent:mouseReleased'])
})

test('geste : `evenements` qui échoue avec un refus EN VOL lève les DEUX, jointes', async () => {
  const { doc, session } = pagePilotee('<button id="a">A</button><div class="voile" style="position:fixed">Modale</div>')
  await assert.rejects(() => geste(session, { selecteur: '#a' }, { attenteMs: 30 }, async (loc, emettre) => {
    await emettre('souris', { type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 })
    doc.elementFromPoint = () => doc.querySelector('.voile')
    emettre('souris', { type: 'mouseReleased', x: 8, y: 8, button: 'left', clickCount: 1 })
    throw new Error('scénario cassé')
  }), (e) => {
    assert.ok(e instanceof AggregateError)
    assert.equal(e.errors[0].message, 'scénario cassé')
    assert.match(e.errors[1].message, /AUTRE COUCHE.* ; bouton relâché au point contrôlé \(5, 5\)$/)
    return true
  })
})

/** Rend MUETTES les émissions `Input` de `page` que `muet(methode, params)` désigne (toutes par défaut) :
 *  elles ne reçoivent JAMAIS d'accusé de réception (la socket reste ouverte). */
function rendreMuet(page, muet = (methode) => methode.startsWith('Input.')) {
  const servir = socketDe(page.session).gerer
  socketDe(page.session).gerer = (methode, params) => muet(methode, params) ? new Promise(() => {}) : servir(methode, params)
  return page
}

/** Page pilotée dont les émissions `Input` que `muet` désigne sont muettes (`rendreMuet`). */
function pageInputMuet(html, muet) {
  return rendreMuet(pagePilotee(html), muet)
}

test('clic : un `mousePressed` sans accusé de réception est suivi de son `mouseReleased`', async () => {
  const { session } = pageInputMuet('<button id="a">A</button>', (methode, params) => methode === 'Input.dispatchMouseEvent' && params.type === 'mousePressed')
  await assert.rejects(() => geste(session, { selecteur: '#a' }, { attenteMs: 0, delaiEntreeMs: 40 }, clic()),
    /^Error: geste : Input\.dispatchMouseEvent : accusé de réception absent après 40 ms/)
  assert.deepEqual(socketDe(session).envoyes.filter((m) => m.method === 'Input.dispatchMouseEvent').map((m) => m.params.type), ['mouseMoved', 'mousePressed', 'mouseReleased'])
})

/** Les helpers EXPORTÉS de `lib.mjs` dont le corps appelle `geste` ou `frappe`, lus dans la source. */
function helpersDEntree() {
  const source = readFileSync(new URL('./lib.mjs', import.meta.url), 'utf8')
  return [...source.matchAll(/^export (?:async )?function (\w+)\(([\s\S]*?)^\}$/gm)]
    .filter(([, nom, corps]) => nom !== 'geste' && nom !== 'frappe' && /\b(?:geste|frappe)\(session\b/.test(corps))
    .map(([, nom]) => nom)
    .sort()
}

test('helpers de geste et de frappe : chacun transmet `delaiEntreeMs` à son émetteur', async () => {
  const court = { delaiEntreeMs: 40, attenteMs: 0 }
  const bouton = () => pageInputMuet('<button id="a">A</button>')
  const touche = () => pageInputMuet('')
  const saisie = () => {
    const p = pageInputMuet('<input id="a">', (methode) => methode === 'Input.insertText')
    p.doc.querySelector('#a').focus()
    return p
  }
  const souris = 'dispatch(Mouse|Touch)Event'
  /** [helper, page, jeu, émetteur nommé par l'erreur, méthode `Input`] : un helper COMPOSÉ a un cas par
   *  geste propre et un par helper qu'il appelle. */
  const cas = [
    ['clickButtonByText', bouton, (s) => clickButtonByText(s, 'A', court)],
    ['cliquerSelecteur', bouton, (s) => cliquerSelecteur(s, '#a', court)],
    ['clickItemByText', bouton, (s) => clickItemByText(s, 'A', { selecteur: '#a', ...court })],
    ['clicDroit', bouton, (s) => clicDroit(s, { selecteur: '#a' }, court)],
    ['appuiLong', bouton, (s) => appuiLong(s, { selecteur: '#a' }, 0, court)],
    ['toucher', bouton, (s) => toucher(s, { selecteur: '#a' }, court)],
    ['molette', bouton, (s) => molette(s, { selecteur: '#a' }, 120, court)],
    ['survoler', bouton, (s) => survoler(s, { selecteur: '#a' }, court)],
    ['typeInField', bouton, (s) => typeInField(s, '#a', 'x', court)],
    ['typeInField', saisie, (s) => typeInField(s, '#a', 'x', court), 'typeInField', 'insertText'],
    ['deplierVers', () => rendreMuet(pageDefilante('<details><summary data-y="1500">Loin</summary><input id="champ"></details>')), (s) => deplierVers(s, '#champ', { pauseMs: 0, ...court })],
    ['deplierVers', () => rendreMuet(pageDefilante('<details><summary data-y="100">Près</summary><input id="champ"></details>')), (s) => deplierVers(s, '#champ', { pauseMs: 0, ...court })],
    ['selectOption', () => pageInputMuet(LISTE), (s) => selectOption(s, '#ch', 'Chapitre 20 — Le Bac', court)],
    ['realKey', touche, (s) => realKey(s, { key: 'a' }, court), 'realKey', 'dispatchKeyEvent'],
    ['realKeyDown', touche, (s) => realKeyDown(s, ALT, court), 'realKeyDown', 'dispatchKeyEvent'],
    ['realKeyUp', touche, (s) => realKeyUp(s, ALT, court), 'realKeyUp', 'dispatchKeyEvent'],
  ]
  assert.deepEqual([...new Set(cas.map(([helper]) => helper))].sort(), helpersDEntree())
  for (const [helper, page, jouer, qui = helper, methode = souris] of cas) {
    await assert.rejects(() => jouer(page().session), new RegExp(`^Error: ${qui} : Input\\.${methode} : accusé de réception absent après 40 ms`), helper)
  }
})

test('geste et frappe : une émission `Input` sans accusé de réception LÈVE après `delaiEntreeMs`, attendue ou non', async () => {
  const presse = (loc) => ({ type: 'mousePressed', x: loc.x, y: loc.y, button: 'left', clickCount: 1 })
  await assert.rejects(() => geste(pageInputMuet('<button id="a">A</button>').session, { selecteur: '#a' }, { attenteMs: 0, delaiEntreeMs: 40 }, async (loc, emettre) => { emettre('souris', presse(loc)) }),
    /^Error: geste : Input\.dispatchMouseEvent : accusé de réception absent après 40 ms \(la page peut avoir reçu l'événement\)$/)
  await assert.rejects(() => geste(pageInputMuet('<button id="a">A</button>').session, { selecteur: '#a' }, { qui: 'cliquer', attenteMs: 0, delaiEntreeMs: 40 }, clic()),
    /^Error: cliquer : Input\.dispatchMouseEvent : accusé de réception absent après 40 ms \(la page peut avoir reçu l'événement\)$/)
  await assert.rejects(() => frappe(pageInputMuet('').session, { qui: 'taper', delaiEntreeMs: 40 }, (emettre) => emettre('texte', { text: 'x' })),
    /^Error: taper : Input\.insertText : accusé de réception absent après 40 ms \(la page peut avoir reçu l'événement\)$/)
})

test('nom d’élément (`FN_NOMMER_ELEMENT`) : ambiguïté et focus manquant nomment classe et SVG', async () => {
  const icones = pagePilotee('<button class="icone fermer"></button><button class="icone ouvrir">Ouvrir</button><svg class="ico a"></svg><svg class="ico b"></svg>')
  await assert.rejects(() => geste(icones.session, { selecteur: '.icone' }, {}, clic()), /2 cibles ambiguës « \.icone » — button\.icone\.fermer \| button\.icone\.ouvrir « Ouvrir » —/)
  await assert.rejects(() => geste(icones.session, { selecteur: '.ico' }, {}, clic()), /2 cibles ambiguës « \.ico » — svg\.ico\.a \| svg\.ico\.b —/)
  const focus = pagePilotee('<input id="champ"><button class="icone fermer"></button>')
  focus.doc.querySelector('button').focus()
  await assert.rejects(() => frappe(focus.session, { focus: '#champ' }, (emettre) => emettre('texte', { text: 'x' })), /frappe « #champ » : la cible n'a pas le focus \(focus sur button\.icone\.fermer\)/)
})

test('localiseur : l’étiquette départage deux noms et filtre par correspondance exacte', async () => {
  const { etat, session } = pagePilotee('<button><span>Ouvrir</span><i>A</i></button><button><span>Ouvrir</span><i>AB</i></button><aside>A</aside>')
  const cible = { nom: 'Ouvrir', selecteur: 'button', libelle: 'span', etiquette: { selecteur: 'i', option: 'groupe' } }
  await assert.rejects(() => geste(session, cible, {}, clic()), /2 cibles ambiguës « Ouvrir ».*offerts : A \| AB/)
  assert.deepEqual(etat.emis, [])
  await geste(session, { ...cible, etiquette: { ...cible.etiquette, texte: 'A' } }, {}, clic())
  await geste(session, { ...cible, etiquette: { ...cible.etiquette, texte: 'AB' } }, {}, clic())
  assert.deepEqual(etat.cliques, ['OuvrirA', 'OuvrirAB'])
  await assert.rejects(() => geste(session, { ...cible, etiquette: { ...cible.etiquette, texte: 'B' } }, { attenteMs: 0 }, clic()), /aucune cible .*groupe « B »/)
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
  await assert.rejects(() => champParLibelle(session, 'Nom', { dans: '.modal' }), /champParLibelle : 2 racines ambiguës « \.modal » — div#m1\.modal « Nom » \| div#m2\.modal « Nom » — préciser \{ dans \}/)
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
  await assert.rejects(() => selectOption(session, '.l', 'a'), /selectOption : 2 cibles ambiguës « \.l » — select#l1\.l « a » \| select#l2\.l « a » — préciser \{ selecteur \} ou \{ dans \}/)
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
