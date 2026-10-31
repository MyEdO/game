// LES RECETTES DE L'HÔTE GODOT (#2928, #3086) :
// l'export Web (`node hotes/godot/construire.mjs --export --sortie <web>`) servi par `servir.mjs`, Chromium piloté au clic et
// au clavier sur le canevas comme un joueur. Godot publie à la page ce que l'écran porte (`globalThis.wfrpEcran`,
// `pont/CONTRAT.md`, section « Écran publié ») : le texte et le centre de chaque bouton, le point de chaque case, l'état
// de l'atelier. Aucun geste ne passe par le pont : chaque intention part d'un clic, d'un cran de molette ou d'une frappe.
// Chaque parcours s'ouvre depuis le menu d'entrée :
// - `combat` (défaut) : la fenêtre du round à l'Entrée, une charge sur l'ennemi le plus proche, la localisation, le
//   jet et sa confirmation dans la fenêtre d'attaque, la fin du tour ; le héros suivant marche d'une case (aperçu puis
//   déplacement) et finit son tour ; les jetons de l'adversaire repris par les minuteurs de Godot jusqu'à la Défense du
//   héros visé, jetée et confirmée, puis le round 2. `wfrpPont.appeler('vue')` observe la partie, et chaque bouton se
//   trouve par le texte que la vue lui donne.
// - `atelier` : `--base` importé seul (`importer.mjs --sans-publier`) dans `--modeles`, dossier neuf servi sous
//   `modeles/` ; la base choisie, ses points sans élément ; `--element` importé puis « Recharger » : l'élément listé aux
//   seuls points dont l'os porte sa lame (`osDesRigides` du listage), les autres disant « aucun élément » ; les aides,
//   l'élément monté puis démonté (« vide ») ; si une surface de `--element` porte `blason: true` (#3111), deux emblèmes
//   posés tour à tour à la prise `main`, chacun sans erreur publiée, puis « vide », l'emblème effacé au démontage et
//   reposé avant « Recharger » (sans surface `blason`, une ligne du journal dit la preuve non jouée) ; un
//   clip joué, mis en pause, avancé et reculé d'une image (au clic puis à l'Entrée), sa vitesse réglée ; puis
//   `--reexport` importé à la place de la base (`importer.mjs --remplacer`), l'élément qui la référence revalidé contre
//   elle et laissé en place, « Recharger » sans relancer la page : l'empreinte publiée devient celle du manifeste
//   réimporté, l'état (clip, instant, pause, vitesse, montés, emblèmes, aides) est gardé.
// - `composition` : Soldat, manquants et copie validée côté Node ; pièce skinnée montée et démontée, courtaud,
//   corpulence aux bornes, marche au clavier au corps neutre et contact des pieds dans le monde, puis repos.
// Chaque étape est assertée ; une assertion fausse, une erreur relevée par le pont (`erreursGlobales`) ou une erreur de
// console rendent un code non nul.
//
//   node hotes/godot/recette.mjs --web <dossier de l'export> --captures <dossier> [--scenario dome] [--graine 7]
//   node hotes/godot/recette.mjs --parcours atelier --web <export> --captures <dossier> --modeles <dossier neuf>
//     --base <production> --element <production> --reexport <production> [--clip Sword_Attack]
//   node hotes/godot/recette.mjs --parcours composition --web <export> --captures <dossier> --modeles <dossier neuf>
//     --base <production> --piece <production skinnée>
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { servir } from './servir.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { ATTENTE_ECHUE, clic, consoleGuard, evaluate, geste, launchSession, molette, realKey, realKeyDown, realKeyUp, shot, sleep, waitFor } from '../../scripts/recette/lib.mjs'

import { chargerAssets } from './asset/charger.mjs'

const seuilsDAppui = JSON.parse(readFileSync(new URL('./asset/evaluateur/gardes/seuils.json', import.meta.url), 'utf8'))

const chaine = { type: 'string' }
const { values: o } = parseArgs({
  options: { parcours: { type: 'string', default: 'combat' }, web: chaine, captures: chaine, scenario: { type: 'string', default: 'dome' }, graine: { type: 'string', default: '7' }, modeles: chaine, base: chaine, element: chaine, reexport: chaine, piece: chaine, clip: { type: 'string', default: 'Sword_Attack' } },
})
if (!o.web || !o.captures) throw new Error('usage : node hotes/godot/recette.mjs --web <dossier de l’export> --captures <dossier> [--parcours combat|atelier|composition]')
if (o.parcours === 'atelier' && !(o.modeles && o.base && o.element && o.reexport)) throw new Error('--parcours atelier attend --modeles <dossier neuf> --base, --element et --reexport <dossier de production>')
if (o.parcours === 'composition' && !(o.modeles && o.base && o.piece)) throw new Error('--parcours composition attend --modeles <dossier neuf>, --base et --piece <production skinnée>')
if (['atelier', 'composition'].includes(o.parcours) && existsSync(o.modeles)) throw new Error(`--modeles ${o.modeles} existe : le parcours importe dans un dossier neuf`)

/** Le WebGL 2 de l'export, en logiciel dans un Chrome sans GPU, sans l'avertissement de repli. */
const WEBGL_LOGICIEL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const srv = await servir({ web: o.web, ...(o.modeles && { modeles: o.modeles }) })
const session = await launchSession({ width: 1280, height: 720, timeoutMs: 30000, args: WEBGL_LOGICIEL })
const garde = consoleGuard(session)
const noter = (t) => console.log('·', t)
const vue = async () => JSON.parse(await evaluate(session, `wfrpPont.appeler('vue')`)).vue
const ecran = async () => JSON.parse(await evaluate(session, 'JSON.stringify(globalThis.wfrpEcran ?? null)'))
/** Attend que la vue, lue par le pont, vérifie `condition` (une expression sur `v`). */
const attendreLaVue = (condition, timeoutMs = 30000) =>
  waitFor(session, `(() => { try { const v = JSON.parse(wfrpPont.appeler('vue')).vue; return !!(${condition}) } catch { return false } })()`, { timeoutMs })
/** Le prochain écran publié : l'actuel est marqué vu, le suivant ne l'est pas (chaque publication remplace l'objet). */
const marquer = () => evaluate(session, '(globalThis.wfrpEcran && (wfrpEcran.vu = true), true)')
const nouvelEcran = () => waitFor(session, '!!globalThis.wfrpEcran && !wfrpEcran.vu', { timeoutMs: 30000 })
const actif = (v) => v.projection.combat?.actif
const nomDe = (v, id) => v.projection.combat.voisins.liste.find((c) => c.id === id)?.nom
/** Le libellé du geste que la fenêtre attend. */
const attendu = (v) => {
  const gestes = v.fenetre?.gestes.filter((g) => g.attendu) ?? []
  assert.equal(gestes.length, 1, `un geste attendu dans ${JSON.stringify(v.fenetre?.gestes.map((g) => g.libelle))}`)
  return gestes[0].libelle
}

async function cliquerPoint(x, y) {
  await marquer()
  await geste(session, { surface: 'canvas', x, y }, { qui: `clic (${Math.round(x)}, ${Math.round(y)})` }, clic())
  await nouvelEcran()
}
/** Le bouton publié dont le texte vaut `quoi`, ou, pour `{ cle }`, dont la clé vaut `cle` ; `undefined` hors de l'écran. */
const trouver = (boutons, quoi) => boutons.find((x) => (typeof quoi === 'string' ? x.texte === quoi : x.cle === quoi.cle))
async function cliquerBouton(quoi) {
  const { boutons } = await ecran()
  const b = trouver(boutons, quoi)
  if (!b) throw new Error(`bouton ${JSON.stringify(quoi)} absent ; boutons : ${boutons.map((x) => x.cle ?? x.texte).join(' | ')}`)
  await cliquerPoint(b.x, b.y)
}
async function cliquerCase({ x, y }) {
  const [px, py] = (await ecran()).cases[`${x},${y}`]
  await cliquerPoint(px, py)
}
async function capturer(nom) {
  await sleep(400)
  noter(`capture ${await shot(session, nom, o.captures)}`)
}
async function finirLeTour() {
  await cliquerBouton((await vue()).panneau.offres['end-turn'])
  const v = await vue()
  if (v.projection.combat.finDeTourArmee) await cliquerBouton(v.panneau.offres['end-turn'])
}

async function parcoursCombat() {
  await cliquerBouton('Combat')
  noter('menu : bouton « Combat » cliqué')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  assert.ok(v.fenetre, 'la fenêtre du round tient la main')
  assert.equal(v.projection.combat.round, 1)
  await capturer('2928-6c-1-round')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  const heros = actif(v)
  assert.equal(v.fenetre, null, 'l’Entrée joue le geste au focus et ferme la fenêtre du round')
  assert.equal(heros?.camp, 'hero', 'un héros est actif')
  assert.equal(v.projection.combat.barre.forme, 'ouverte')
  noter(`Entrée : fenêtre fermée ; actif ${heros.nom}, barre ouverte`)
  const proche = v.projection.combat.voisins.liste.filter((c) => v.projection.combat.cibles.liste.includes(c.id)).sort((a, b) => a.distance - b.distance)[0]
  await cliquerBouton(v.panneau.offres.charge)
  v = await vue()
  assert.equal(v.projection.combat.intention, 'charge', 'l’offre arme son intention')
  noter(`offre ${v.panneau.offres.charge} : intention charge, ${v.cases.length} cases peintes`)
  await cliquerCase({ x: proche.pos[0], y: proche.pos[1] })
  await attendreLaVue('v.attaque && v.fenetre')
  v = await vue()
  assert.deepEqual([v.attaque.attaquantId, v.attaque.cibleId, v.attaque.jete], [heros.id, proche.id, false], 'la charge ouvre l’attaque du héros sur sa cible')
  noter(`clic sur ${proche.nom} : jetons repris par les minuteurs, fenêtre « ${v.fenetre.titre} » ouverte ; ${v.fenetre.corps.join(' / ')}`)
  const localiser = v.fenetre.gestes.find((g) => g.verbe === v.attaque.localisation.verbe)
  const lieu = localiser.arguments.find((a) => a.saisie === 'choix').valeurs.find((x) => x.valeur !== null)
  await cliquerBouton(lieu.libelle)
  v = await vue()
  assert.equal(v.attaque.localisation.choisie, lieu.valeur, 'la Localisation cliquée est retenue')
  noter(`Localisation « ${lieu.libelle} » ; ${v.fenetre.corps.find((l) => l.includes('à atteindre'))}`)
  await capturer('2928-6c-2-attaque-apercu')
  await cliquerBouton(attendu(v))
  v = await vue()
  assert.equal(v.attaque.jete, true, 'le jet tombe')
  assert.ok(v.attaque.issue, 'le jet tombé dit son issue')
  noter(`jet : ${v.attaque.issue.ligne}`)
  await capturer('2928-6c-3-attaque-jet')
  const pbAvant = v.projection.combat.voisins.liste.find((c) => c.id === proche.id).pb[0]
  await cliquerBouton(attendu(v))
  v = await vue()
  assert.equal(v.attaque, null, 'confirmée, la fenêtre d’attaque se ferme')
  const pbApres = v.projection.combat.voisins.liste.find((c) => c.id === proche.id).pb[0]
  noter(`confirmée : fenêtre fermée ; ${proche.nom} ${pbAvant} → ${pbApres} Blessures`)
  await finirLeTour()
  v = await vue()
  const second = actif(v)
  assert.notEqual(second.id, heros.id, 'la fin du tour passe la main')
  assert.equal(second.camp, 'hero')
  const vers = v.cases.find((c) => c.zone === 'marche' && c.cout === 1).case
  noter(`fin du tour de ${heros.nom} ; actif ${second.nom}`)
  await cliquerCase(vers)
  v = await vue()
  assert.deepEqual([v.projection.combat.apercu?.genre, v.projection.combat.apercu?.case], ['move', [vers.x, vers.y]], 'le premier clic montre l’aperçu')
  assert.ok(v.panneau.apercu, 'le panneau dit ce que l’aperçu coûte')
  noter(`premier clic sur (${vers.x}, ${vers.y}) : ${v.panneau.apercu}`)
  await capturer('2928-6c-4-deplacement-apercu')
  await cliquerCase(vers)
  v = await vue()
  assert.deepEqual(actif(v).pos, [vers.x, vers.y], 'le second clic déplace le héros')
  noter(`second clic : ${second.nom} en ${actif(v).pos}`)
  await finirLeTour()
  await attendreLaVue('v.defense && v.fenetre', 60000)
  v = await vue()
  const adversaire = actif(v)
  assert.equal(adversaire.camp, 'enemy', 'les jetons repris, le noyau joue l’adversaire')
  assert.equal(v.defense.attaquantId, adversaire.id, 'la Défense répond à l’adversaire actif')
  assert.deepEqual(v.fenetre.proprietaire, { genre: 'porteur', nom: nomDe(v, v.defense.defenseurId) }, 'la Défense est au héros visé')
  noter(`Défense ouverte par les minuteurs : ${v.fenetre.corps.join(' / ')} ; à ${v.fenetre.proprietaire.nom}`)
  await capturer('2928-6c-5-defense')
  await cliquerBouton(attendu(v))
  v = await vue()
  assert.equal(v.defense.jete, true, 'le jet de Défense tombe')
  await cliquerBouton(attendu(v))
  await attendreLaVue('!v.defense && v.projection.combat.round === 2', 60000)
  v = await vue()
  noter(`Défense confirmée : fenêtre « ${v.fenetre?.titre ?? 'aucune'} », round ${v.projection.combat.round}`)
  await capturer('2928-6c-6-apres-defense')
}

const IMPORTER = fileURLToPath(new URL('./importer.mjs', import.meta.url))
/** Le point du panneau de l'atelier où tourne la molette : sur les lignes des points. */
const PANNEAU = { x: 60, y: 400 }
const CRANS = 150
const production = (dossier) => JSON.parse(readFileSync(join(dossier, 'manifest.json'), 'utf8'))
const atelier = async () => (await ecran()).atelier
/** Attend que l'atelier publié vérifie `condition` (une expression sur `a`, et `b`, les boutons publiés). */
const attendreLAtelier = (condition, timeoutMs = 60000) =>
  waitFor(session, `(() => { const a = globalThis.wfrpEcran?.atelier, b = globalThis.wfrpEcran?.boutons; return !!a && !!(${condition}) })()`, { timeoutMs })

/** La production `dossier` importée sous l'id `id` dans `--modeles`, sans rien publier, avec les `options` d'`importer.mjs` ;
 *  le refus de l'import lève, collé. */
function importer(dossier, id, options = []) {
  const r = spawnSync(process.execPath, [IMPORTER, dossier, id, '--destination', o.modeles, '--sans-publier', ...options], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`import de ${dossier} sous ${id} refusé (code ${r.status}) :\n${r.stderr}${r.stdout}`)
  noter(`import de ${id} : ${r.stdout.split('\n')[1].replaceAll(o.modeles, '')}`)
}

/** Le `deltaY` d'un cran de molette de Chrome sous Windows. Le panneau en défile moins que la hauteur de sa fenêtre :
 *  aucun bouton ne passe entre deux écrans publiés (#3111). */
const CRAN_DE_MOLETTE = 100
/** Un cran de molette au point `ou`, vers le bas (`sens` 1) ou le haut (-1), puis l'écran que son défilement publie
 *  attendu ; `false` si rien ne se publie en `FIN_DE_COURSE_MS`, le panneau au bout de sa course. */
const FIN_DE_COURSE_MS = 3000
async function cran(sens, ou) {
  const geometrie = 'JSON.stringify(globalThis.wfrpEcran?.boutons.map(({ cle, texte, x, y }) => ({ cle, texte, x, y })))'
  const avant = await evaluate(session, geometrie)
  await molette(session, { surface: 'canvas', x: ou.x, y: ou.y }, sens * CRAN_DE_MOLETTE)
  return waitFor(session, `${geometrie} !== ${JSON.stringify(avant)}`, { timeoutMs: FIN_DE_COURSE_MS }).then(
    () => true,
    (e) => {
      if (e.code === ATTENTE_ECHUE) return false
      throw e
    },
  )
}
/** Le bouton `quoi` amené à l'écran par la molette tournée au point `ou`, vers le bas (`sens` 1) ou le haut (-1). */
async function amener(quoi, sens, ou = PANNEAU) {
  for (let n = 0; n < CRANS; n++) {
    const b = trouver((await ecran()).boutons, quoi)
    if (b) return b
    if (!(await cran(sens, ou))) break
  }
  const { boutons } = await ecran()
  throw new Error(`bouton ${JSON.stringify(quoi)} hors de l'écran, panneau tourné ${sens > 0 ? 'vers le bas' : 'vers le haut'} ; boutons : ${boutons.map((x) => x.cle ?? x.texte).join(' | ')}`)
}
/** Le panneau tourné à la molette au point `PANNEAU` dans le sens `sens` jusqu'au bout de sa course ; `relever` reçoit
 *  chaque écran publié. */
async function tournerJusquAuBout(sens, relever = () => {}) {
  for (let n = 0; n < CRANS; n++) {
    relever((await ecran()).boutons)
    if (!(await cran(sens, PANNEAU))) return
  }
  throw new Error(`panneau encore en mouvement après ${CRANS} crans de molette`)
}
/** Les clés des boutons d'emplacement par point, relevées du haut au bas du panneau, triées ; le panneau revient en haut.
 *  Un point sans clé dit « aucun élément ». */
async function clesDuPanneau() {
  await tournerJusquAuBout(-1)
  const cles = new Set()
  await tournerJusquAuBout(1, (boutons) => boutons.forEach((b) => b.cle && cles.add(b.cle)))
  await tournerJusquAuBout(-1)
  const parPoint = {}
  for (const cle of [...cles].sort()) (parPoint[cle.split('/')[0]] ??= []).push(cle)
  return parPoint
}
async function cliquerAmene(quoi, sens, ou) {
  await amener(quoi, sens, ou)
  await cliquerBouton(quoi)
}

/** L'emblème `id` choisi au clic à la prise `main` (« vide » pour aucun), l'état publié qui le porte, ou une erreur,
 *  attendu ; aucune erreur publiée. */
async function choisirLEmbleme(id) {
  await cliquerAmene({ cle: `main/embleme/${id}` }, 1)
  await attendreLAtelier(`a.erreurs.length > 0 || ${id === 'vide' ? '!("main" in a.emblemes)' : `a.emblemes.main === ${JSON.stringify(id)}`}`)
  assert.deepEqual((await atelier()).erreurs, [], `l’emblème « ${id} » posé sans erreur`)
}
/** À la prise `main`, dont l'élément monté porte une surface `blason` : la rangée des emblèmes relevée, le premier puis le
 *  second posés et capturés, puis « vide » ; le premier reposé. Les ids des emblèmes offerts, triés. */
async function poserLesEmblemes() {
  const prefixe = 'main/embleme/'
  await attendreLAtelier(`b.some((x) => x.cle === ${JSON.stringify(`${prefixe}vide`)})`)
  assert.deepEqual((await atelier()).emblemes, {}, 'monté sans emblème')
  const offerts = (await clesDuPanneau()).main.filter((c) => c.startsWith(prefixe) && c !== `${prefixe}vide`).map((c) => c.slice(prefixe.length))
  assert.ok(offerts.length >= 2, `deux emblèmes offerts au moins : ${offerts.join(', ')}`)
  const [a, b] = offerts
  await choisirLEmbleme(a)
  noter(`emblème « ${a} » posé à la prise « main »`)
  await capturer('3111-1-embleme-a')
  await choisirLEmbleme(b)
  assert.deepEqual((await atelier()).emblemes, { main: b }, 'le second emblème remplace le premier')
  noter(`emblème « ${b} » posé à sa place`)
  await capturer('3111-2-embleme-b')
  await choisirLEmbleme('vide')
  noter('emblème « vide » : la surface rendue à son matériau')
  await choisirLEmbleme(a)
  return offerts
}

async function parcoursAtelier() {
  const [p0, element, p1] = [production(o.base), production(o.element), production(o.reexport)]
  const base = p0.manifeste.base
  const elementId = element.manifeste.cle.apparence
  assert.notEqual(p0.model_sha256, p1.model_sha256, 'la réexportation change les octets de la base')
  importer(o.base, base)
  await cliquerBouton('Atelier')
  noter('menu : bouton « Atelier » cliqué')
  await attendreLAtelier(`a.base === ${JSON.stringify(base)}`, 120000)
  await cliquerBouton(base)
  let a = await atelier()
  assert.deepEqual([a.base, a.empreinte, a.erreurs], [base, p0.model_sha256, []], 'la base choisie, à l’empreinte de son import, sans erreur')
  assert.deepEqual((await ecran()).boutons.filter((b) => b.cle), [], 'sans élément indexé, aucun point n’offre de choix')
  noter(`base « ${base} » choisie, empreinte ${a.empreinte.slice(0, 12)} ; ses points disent « aucun élément »`)
  await capturer('3086-a1-1-base-sans-element')

  importer(o.element, elementId)
  await cliquerBouton('Recharger')
  await attendreLAtelier(`b.some((x) => x.cle?.endsWith(${JSON.stringify(`/${elementId}`)}))`)
  const { osDesRigides } = await (await fetch(`${srv.url}modeles/`)).json()
  const porteurs = Object.entries({ ...p0.manifeste.emplacements, ...p0.manifeste.prises }).filter(([, attache]) => osDesRigides[elementId].includes(attache.os)).map(([point]) => point)
  assert.ok(porteurs.includes('main'), `l’os de la prise « main » porte la lame (${osDesRigides[elementId].join(', ')})`)
  const choix = await clesDuPanneau()
  assert.deepEqual(choix, tableTotale(porteurs, (p) => [`${p}/${elementId}`, `${p}/vide`].sort()), `« ${elementId} » listé aux seuls points de l’os qui porte la lame`)
  noter(`« Recharger » : « ${elementId} » listé aux points ${porteurs.join(', ')} (os ${osDesRigides[elementId].join(', ')}) ; les autres disent « aucun élément »`)
  for (const aide of ['Os', 'Prises']) await cliquerBouton(aide)
  a = await atelier()
  assert.deepEqual(a.aides, { os: true, emplacements: false, prises: true }, 'les aides cochées sont montrées')

  const monter = { cle: `main/${elementId}` }
  await cliquerAmene(monter, 1)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  noter(`« ${elementId} » monté à la prise « main »`)
  await capturer('3086-a1-2-element-monte')
  const blason = element.manifeste.surfaces.some((s) => s.blason === true)
  if (!blason) noter(`« ${elementId} » sans surface \`blason\` : preuve des emblèmes non jouée`)
  const emblemes = blason ? await poserLesEmblemes() : []
  await cliquerAmene({ cle: 'main/vide' }, -1)
  await attendreLAtelier('!("main" in a.montes)')
  assert.deepEqual((await atelier()).emblemes, {}, 'démonter efface l’emblème')
  noter('« vide » : la prise « main » démontée, sans emblème')
  await cliquerBouton(monter)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  if (emblemes.length) {
    await choisirLEmbleme(emblemes[0])
    noter(`« ${emblemes[0]} » reposé avant « Recharger »`)
  }

  const premier = await amener('A_TPose', 1)
  await cliquerAmene(o.clip, 1, { x: premier.x, y: premier.y })
  await attendreLAtelier(`a.clip === ${JSON.stringify(o.clip)} && a.lecture`)
  await cliquerAmene('Pause', 1)
  await attendreLAtelier('a.lecture === false')
  a = await atelier()
  assert.deepEqual([a.clip, a.lecture], [o.clip, false], 'la pause arrête le clip')
  const { instant: enPause, duree } = a
  const ecart = (depart, arrivee) => (((arrivee - depart) % duree) + duree) % duree
  await cliquerBouton('Image suivante')
  const suivante = (await atelier()).instant
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  const encore = (await atelier()).instant
  const image = ecart(suivante, encore)
  assert.ok(ecart(enPause, suivante) > 0 && ecart(enPause, suivante) < duree / 2 && image > 0 && image < duree / 2, `chaque image suivante avance l’instant sur le clip bouclé de ${duree} s : ${enPause} → ${suivante} → ${encore}`)
  await cliquerBouton('Image précédente')
  a = await atelier()
  const precedente = a.instant
  assert.ok(Math.min(ecart(suivante, precedente), ecart(precedente, suivante)) < 1e-6, `l’image précédente revient d’une image : ${encore} → ${precedente}`)
  noter(`pause à ${enPause} s sur ${duree} s ; image suivante (clic) ${suivante}, (Entrée) ${encore}, précédente ${precedente} : une image ${image.toFixed(4)} s`)
  await cliquerBouton('×0.5')
  a = await atelier()
  assert.deepEqual([a.vitesse, a.lecture, a.instant], [0.5, false, precedente], 'la vitesse se règle, la pause tient l’instant')
  await cliquerBouton('Lecture')
  await attendreLAtelier('a.lecture === true')
  assert.equal((await atelier()).lecture, true, 'la lecture reprend')
  await sleep(500)
  await cliquerBouton('Pause')
  await attendreLAtelier('a.lecture === false')
  const avant = await atelier()
  assert.ok(avant.instant !== precedente && avant.lecture === false, `la lecture a avancé le clip : ${precedente} → ${avant.instant}`)
  noter(`×0.5, lecture puis pause : ${avant.instant} s`)
  await capturer('3086-a1-3-clip-en-pause')

  importer(o.reexport, base, ['--remplacer'])
  noter(`« ${base} » remplacée par sa réexportation (--remplacer) : « ${elementId} », qui la référence, revalidé contre elle et laissé en place`)
  await evaluate(session, '(globalThis.recetteSansRelance = true)')
  await cliquerAmene('Recharger', -1)
  await attendreLAtelier(`a.empreinte === ${JSON.stringify(p1.model_sha256)} && a.montes.main === ${JSON.stringify(elementId)} && a.clip !== null`, 120000)
  const apres = await atelier()
  assert.equal(await evaluate(session, 'globalThis.recetteSansRelance === true'), true, 'la page n’a pas été relancée')
  assert.ok(Math.abs(apres.instant - avant.instant) < 1e-6, `l’instant gardé : ${avant.instant} → ${apres.instant}`)
  const etat = ({ base: b, clip, lecture, vitesse, montes, emblemes: e, aides, erreurs }) => ({ b, clip, lecture, vitesse, montes, e, aides, erreurs })
  assert.deepEqual(etat(apres), etat(avant), 'clip, pause, vitesse, montés, emblèmes, aides gardés')
  noter(`« Recharger » sans relance : empreinte ${avant.empreinte.slice(0, 12)} → ${apres.empreinte.slice(0, 12)} ; ${apres.clip} à ${apres.instant} s en pause, ×${apres.vitesse}, montés ${JSON.stringify(apres.montes)}, emblèmes ${JSON.stringify(apres.emblemes)}, aides ${JSON.stringify(apres.aides)}`)
  await capturer('3086-a1-4-reexport-recharge')
}

const proche = (a, b, tolerance, quoi) => assert.ok(Math.abs(a - b) <= tolerance, `${quoi} : ${a} contre ${b} (tolérance ${tolerance})`)
const horizontal = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])

async function choisirAxe(catalogues, champ, id) {
  const axe = catalogues.axes.find((x) => x.champ === champ)
  assert.ok(axe && axe.forme !== 'plage', `sélecteur ${champ} publié`)
  const rang = id === null ? 0 : catalogues[axe.liste].findIndex((x) => x.id === id) + 1
  assert.ok(id === null || rang > 0, `${id} offert sur ${champ}`)
  const b = await amener({ cle: `axe/${champ}` }, -1)
  await geste(session, { surface: 'canvas', x: b.x, y: b.y }, { qui: `liste ${champ}` }, clic())
  await sleep(400)
  for (let n = 0; n <= rang; n++) await realKey(session, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 })
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  const courante = (await atelier()).composition.courante[champ]
  assert.equal(courante?.id ?? courante ?? null, id, `axe ${champ} choisi au clavier`)
}

const OS_DU_TORSE = ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r']
// Un déplacement de 20 cm distingue la marche d'une oscillation sur place.
const DEPLACEMENT_MINIMAL_M = 0.2
// Quatre intervalles évitent une mesure d'appui limitée à une transition.
const INTERVALLES_D_APPUI_MINIMAUX = 4
// Deux dixièmes de seconde couvrent une phase d'appui mesurable.
const DUREE_D_APPUI_MINIMALE_S = 0.2
// Quatre poses distinctes vérifient le gabarit pendant le clip courtaud.
const POSES_COURTAUDES_DISTINCTES_MINIMALES = 4
// Dix poses distinctes couvrent plusieurs phases de marche.
const POSES_DE_MARCHE_DISTINCTES_MINIMALES = 10
// Huit images donnent plusieurs observations du gabarit courtaud.
const IMAGES_COURTAUDES = 8
// Trois secondes laissent publier les huit images du clip courtaud.
const DELAI_COURTAUD_MS = 3000
// Soixante images échantillonnent les contacts des deux pieds.
const IMAGES_DE_MARCHE = 60
// Six secondes couvrent la marche ralentie et ses appuis.
const DELAI_MARCHE_MS = 6000

function verifierLaPeau(a, ligne) {
  const peau = a.peaux[`ligne/${ligne}`]
  assert.ok(peau, `boîte skinnée publiée à ligne/${ligne}`)
  const torse = OS_DU_TORSE.map((nom) => {
    assert.ok(a.os[nom], `os du torse publié : ${nom}`)
    return a.os[nom]
  })
  const hauteur = Math.max(...Object.values(a.os).map((p) => p[1])) - Math.min(...Object.values(a.os).map((p) => p[1]))
  // Calibration d’ingénierie : écart sain 1,26 % de la hauteur, skin sans noms de liaison 68,7 % ; marge retenue 10 %.
  const tolerance = hauteur * 0.1
  const ecarts = peau.centre.map((v, k) => Math.max(Math.min(...torse.map((p) => p[k])) - v, v - Math.max(...torse.map((p) => p[k])), 0))
  noter(`écart torse ${ligne} : ${JSON.stringify(ecarts)} m ; maximum ${Math.max(...ecarts)} m ; hauteur ${hauteur} m ; marge ${tolerance} m (${Math.max(...ecarts) / hauteur * 100} %)`)
  for (let k = 0; k < 3; k++) {
    const min = Math.min(...torse.map((p) => p[k])) - tolerance
    const max = Math.max(...torse.map((p) => p[k])) + tolerance
    assert.ok(peau.centre[k] >= min && peau.centre[k] <= max, `skin suit le torse, axe ${k} : centre ${peau.centre[k]}, enveloppe [${min}, ${max}]`)
  }
  assert.ok(peau.taille.every((v) => Number.isFinite(v) && v > 0 && v <= hauteur), `boîte du plastron : ${JSON.stringify(peau)}`)
  const g = a.gabarit
  assert.ok(g.neutre && g.repos && g.image, 'mesures du gabarit publiées')
  proche(a.cadre, g.repos.sommet / g.neutre.sommet, 1e-4, 'cadre au gabarit')
  proche(g.image.pied, g.image.piedSansGabarit, 1e-4, 'pied à sa hauteur sans gabarit')
  assert.deepEqual(a.erreurs, [], 'pose sans erreur')
}

/** CONTRAT.md, « Écran publié ». */
function sommetsDuPied(a, pied, sommetDuPied) {
  assert.ok(a.pieds?.liaisons[pied], `liaisons du pied publiées : ${pied}`)
  const points = {}
  for (const [surfaceId, surface] of Object.entries(a.pieds.surfaces)) {
    const liaisons = a.pieds.liaisons[pied][surface.mesh]
    for (const { rang, position, os, poids } of surface.sommets) {
      if (sommetDuPied(os, poids, (indice) => !!liaisons[indice])) points[`${surfaceId}/${rang}`] = position
    }
  }
  assert.ok(Object.keys(points).length, `surface du pied mesurée : ${pied}`)
  return points
}

function verifierLesAppuis(images, pieds, racine, vitessesDeclarees, { sommetDuPied, mesurerAppuisAvecTranslation, translationDuMonde }) {
  assert.ok(horizontal(images[0].os[racine], images.at(-1).os[racine]) > DEPLACEMENT_MINIMAL_M, 'le corps avance dans le monde')
  let t = 0
  const poses = images.flatMap((image, n) => {
    if (n) t += (image.instant - images[n - 1].instant + image.duree) % image.duree
    return pieds.map((pied) => ({ clip: image.clip, t, pied, racine: image.os[racine], os: image.os[pied],
      sommets: Object.values(sommetsDuPied(image, pied, sommetDuPied)),
    }))
  })
  const resultat = mesurerAppuisAvecTranslation(poses, vitessesDeclarees, translationDuMonde)
  assert.equal(resultat.mesures.length, 1, 'clip de marche mesuré')
  for (const mesure of resultat.mesures[0].pieds) {
    noter(`appui ${mesure.pied} : ${JSON.stringify(mesure)} ; tolérance ${seuilsDAppui.SOL_TOLERANCE_M} m`)
    assert.ok(mesure.intervalles >= INTERVALLES_D_APPUI_MINIMAUX && mesure.duree >= DUREE_D_APPUI_MINIMALE_S, `appuis effectivement échantillonnés pour ${mesure.pied}`)
  }
  assert.deepEqual(resultat.ecarts, [], 'contact, vitesse et glissement des appuis dans le monde')
}

function verifierLeMorphe(a, nom, attendu, emplacement = null) {
  const meshes = emplacement === null ? a.morphes.corps : a.morphes.montes[emplacement]
  const porteurs = Object.entries(meshes ?? {}).filter(([, morphes]) => nom in morphes)
  assert.ok(porteurs.length, `morphe ${nom} publié sur ${emplacement ?? 'le corps'}`)
  for (const [mesh, morphes] of porteurs) proche(morphes[nom], attendu, 1e-6, `${nom} sur ${emplacement ?? 'corps'}/${mesh}`)
  noter(`morphe ${nom} ${emplacement ?? 'corps'} : ${JSON.stringify(porteurs)} ; composer ${attendu}`)
}

async function observerLesImages(nombre, dureeMs) {
  return JSON.parse(await evaluate(session, `(async () => {
    const images = [], debut = performance.now(); let precedent;
    while (images.length < ${nombre} && performance.now() - debut < ${dureeMs}) {
      await new Promise(requestAnimationFrame);
      const e = globalThis.wfrpEcran;
      if (e === precedent || !e?.atelier?.lecture) continue;
      precedent = e;
      images.push({ ...e.atelier, observeeA: performance.now() });
    }
    return JSON.stringify(images);
  })()`))
}

async function parcoursComposition() {
  const assets = await chargerAssets([
    "export { schema as schemaDesPresets } from '/src/data/schemas/defs/presets-de-personnage.ts';",
    "export { validateDocument } from '/src/data/schemas/validate.ts';",
    "export { sommetDuPied, mesurerAppuisAvecTranslation, translationDuMonde } from '/hotes/godot/asset/evaluateur/gardes/appuis.ts';",
  ])
  const { schemaDesPresets, validateDocument } = assets
  const p = production(o.base)
  const piece = production(o.piece)
  const base = p.manifeste.base
  const pieceId = basename(resolve(o.piece))
  assert.ok(piece.manifeste.cle.piece, 'la pièce porte sa clé de garde-robe')
  const ligne = `piece/${piece.manifeste.cle.piece}`
  assert.equal(piece.manifeste.liaison.mode, 'squelette', 'la pièce de recette est skinnée')
  importer(o.base, base)
  await cliquerBouton('Atelier')
  await attendreLAtelier(`a.base === ${JSON.stringify(base)}`, 120000)
  await cliquerBouton(base)
  const reposDeLaBase = await atelier()
  assert.deepEqual([reposDeLaBase.empreinte, reposDeLaBase.erreurs], [p.model_sha256, []])
  assert.deepEqual([reposDeLaBase.clip, reposDeLaBase.lecture], [null, false], 'référence native de la base sans clip engagé')
  assert.deepEqual(Object.keys(reposDeLaBase.os).sort(), [...p.manifeste.os].sort(), 'tous les os natifs de la base sont présents dans la référence')
  await cliquerBouton('Composition')
  const catalogues = JSON.parse(await evaluate(session, "wfrpPont.appeler('catalogues')"))
  assert.equal((await atelier()).composition.copie, '', 'avant Copier : aucune entrée copiée')
  const plageInitiale = catalogues.axes.find((x) => x.forme === 'plage')
  await cliquerAmene({ cle: `axe/${plageInitiale.champ}/neutre` }, 1)
  await attendreLAtelier('a.composition.refus !== null')
  await cliquerAmene('Copier', 1)
  await attendreLAtelier('a.erreurs.some((x) => x.includes("presetDeComposition"))')
  assert.equal((await atelier()).composition.copie, '', 'Copier refusé : aucune entrée copiée')
  noter('Copier avant toute copie et après refus : entrée vide')
  await cliquerAmene('Soldat', -1)
  await attendreLAtelier('a.composition.preset === "soldat" && a.composition.manquants.length > 0')
  let a = await atelier()
  assert.equal(a.composition.refus, null)
  assert.equal(a.composition.courante.sex, 'F', 'Soldat féminin')
  verifierLeMorphe(a, 'feminin', 1)
  assert.deepEqual(a.erreurs, [])
  assert.ok(a.composition.montes.length > 0, 'emplacements de composition publiés')
  assert.ok(a.composition.manquants.every((m) => m.ligne && m.id && m.label), 'manquants identifiés et libellés')
  for (const axe of catalogues.axes.filter((x) => x.forme === 'plage')) {
    await amener({ cle: `axe/${axe.champ}/neutre` }, 1)
    assert.ok((await atelier()).plages[axe.champ], `plage ${axe.champ} publiée`)
  }
  noter(`Soldat : ${JSON.stringify(a.composition)}`)
  await amener('Copier', 1)
  await capturer('3086-r1-1-soldat-manquants')
  await cliquerAmene('Copier', 1)
  await attendreLAtelier('a.composition.copie !== ""')
  const copie = (await atelier()).composition.copie
  noter(`Copier publié : ${copie}`)
  await capturer('3086-r1-1b-copier')
  let entree
  try { entree = JSON.parse(copie) } catch {
    assert.fail(`Copier ne publie pas une entrée JSON de presetsDePersonnage : ${JSON.stringify(copie)}`)
  }
  assert.deepEqual(validateDocument(schemaDesPresets, [entree]) ?? [], [], 'copie valide au schéma de la collection presetsDePersonnage côté Node')
  const soldat = JSON.parse(readFileSync(new URL('../../src/data/presets-de-personnage.json', import.meta.url), 'utf8')).find((x) => x.id === 'soldat')
  assert.ok(soldat, 'entrée Soldat présente dans les presets app-owned')
  assert.deepEqual(entree, soldat, 'Copier restitue exactement l’entrée Soldat app-owned')

  importer(o.piece, pieceId)
  await cliquerBouton('Montage')
  await cliquerAmene('Recharger', -1)
  const cle = { cle: `ligne/${ligne}` }
  await cliquerAmene(cle, 1)
  await attendreLAtelier(`a.lignes[${JSON.stringify(ligne)}] === ${JSON.stringify(pieceId)}`, 120000)
  await cliquerAmene(cle, 1)
  await attendreLAtelier(`!(${JSON.stringify(ligne)} in a.lignes)`)
  assert.ok(!(`ligne/${ligne}` in (await atelier()).peaux), 'vide : peau démontée')
  await cliquerBouton(cle)
  await attendreLAtelier(`a.lignes[${JSON.stringify(ligne)}] === ${JSON.stringify(pieceId)}`)
  await cliquerBouton('Composition')
  await choisirAxe(catalogues, 'gabarit', 'courtaud')
  await attendreLAtelier('!!a.gabarit.image')
  a = await atelier()
  assert.equal(a.composition.copie, '', 'recomposition : entrée copiée effacée')
  verifierLaPeau(a, ligne)
  await capturer('3086-r1-2-courtaud')
  const touche = { key: 'w', code: 'KeyW', windowsVirtualKeyCode: 87 }
  let imagesCourtaudes
  try {
    await realKeyDown(session, touche)
    await attendreLAtelier('a.lecture === true')
    imagesCourtaudes = await observerLesImages(IMAGES_COURTAUDES, DELAI_COURTAUD_MS)
    assert.ok(new Set(imagesCourtaudes.map((x) => x.instant)).size >= POSES_COURTAUDES_DISTINCTES_MINIMALES, 'courtaud : plusieurs images distinctes du clip')
    for (const image of imagesCourtaudes) {
      assert.ok(Math.abs(image.gabarit.image.echelle - 1) > 1e-4, 'courtaud : échelle effectivement différente de 1')
      proche(image.gabarit.image.pied, image.gabarit.image.piedSansGabarit, 1e-4, 'courtaud animé : hauteur du pied conservée')
    }
    writeFileSync(join(o.captures, 'courtaud.json'), JSON.stringify(imagesCourtaudes))
    noter(`courtaud animé : ${JSON.stringify(imagesCourtaudes.map(({ instant, gabarit }) => ({ instant, image: gabarit.image })))}`)
    await capturer('3086-r1-2b-courtaud-anime')
  } finally {
    await realKeyUp(session, touche)
  }
  await attendreLAtelier('!a.lecture && a.instant === 0')
  await cliquerBouton('Montage')
  await cliquerAmene('A_TPose', 1)
  await attendreLAtelier('a.clip === "A_TPose" && a.lecture')
  await cliquerAmene('Pause', 1)
  await attendreLAtelier('a.lecture === false')
  await cliquerBouton('Composition')
  const corpulence = catalogues.axes.find((x) => x.champ === 'build' && x.forme === 'plage')
  assert.ok(corpulence, 'axe de corpulence borné')
  for (const [bord, valeur] of [['gauche', corpulence.min], ['droite', corpulence.max]]) {
    await amener({ cle: 'axe/build/neutre' }, 1)
    const plage = (await atelier()).plages.build
    assert.ok(plage, 'bords de corpulence publiés')
    await cliquerPoint(bord === 'droite' ? plage.droite - 1 : plage.gauche, plage.y)
    await attendreLAtelier(`a.plages.build?.valeur === ${valeur}`)
    a = await atelier()
    assert.equal(a.composition.courante.build, valeur)
    verifierLaPeau(a, ligne)
    const attendu = a.composition.morphes.corpulence
    assert.ok(Number.isFinite(attendu), 'poids corpulence retourné par composer')
    if (bord === 'droite') assert.ok(attendu > 0, 'corpulence non nulle à droite')
    verifierLeMorphe(a, 'corpulence', attendu)
    verifierLeMorphe(a, 'corpulence', attendu, `ligne/${ligne}`)
    verifierLeMorphe(a, 'feminin', 1)
    await capturer(`3086-r1-3-corpulence-${valeur}`)
  }

  await choisirAxe(catalogues, 'gabarit', null)
  await cliquerAmene({ cle: 'axe/build/neutre' }, 1)
  // Témoin d’appuis : base sans shape keys, comme l’évaluateur par défaut (asset/gabarit.ts, poidsDeSilhouettes).
  await choisirAxe(catalogues, 'sex', 'M')
  await cliquerBouton('Montage')
  await cliquerAmene('×0.25', 1)
  proche((await atelier()).vitesse, 0.25, 1e-4, 'lecture ralentie pour échantillonner chaque phase de marche')
  const repos = await atelier()
  proche(repos.cadre, 1, 1e-4, 'marche au corps neutre')
  const poidsNeutres = Object.values(repos.composition.morphes)
  assert.ok(poidsNeutres.length > 0 && poidsNeutres.every((poids) => poids === 0), 'témoin d’appuis : tous les poids de silhouette sont nuls')
  verifierLeMorphe(repos, 'feminin', 0)
  const pieds = p.manifeste.appuis.pieds
  const racine = p.manifeste.gabarit.racine
  const images = []
  try {
    await realKeyDown(session, touche)
    await attendreLAtelier('a.lecture === true')
    images.push(...await observerLesImages(IMAGES_DE_MARCHE, DELAI_MARCHE_MS))
    writeFileSync(join(o.captures, 'marche.json'), JSON.stringify(images))
    await capturer('3086-r1-4-marche')
  } finally {
    await realKeyUp(session, touche)
  }
  await attendreLAtelier('!a.lecture && a.instant === 0')
  const arret = await atelier()
  assert.equal(arret.clip, images[0].clip, 'arrêt : clip de marche engagé en pause à son début')
  const poseRelative = (os) => {
    const gauche = os.clavicle_l, droite = os.clavicle_r
    const largeur = horizontal(gauche, droite)
    assert.ok(largeur > 0, 'repère latéral du torse')
    const x = (droite[0] - gauche[0]) / largeur, z = (droite[2] - gauche[2]) / largeur
    return Object.fromEntries(Object.entries(os).map(([nom, p]) => {
      const dx = p[0] - os[racine][0], dz = p[2] - os[racine][2]
      return [nom, [dx * x + dz * z, p[1] - os[racine][1], -dx * z + dz * x]]
    }))
  }
  const poseAvant = poseRelative(reposDeLaBase.os), poseApres = poseRelative(arret.os)
  for (const [nom, position] of Object.entries(poseAvant)) for (let k = 0; k < 3; k++) {
    proche(poseApres[nom][k], position[k], 1e-4, `retour au repos : ${nom}, axe ${k}, relativement à la racine et au lacet du torse`)
  }
  assert.ok(new Set(images.map((x) => x.instant)).size >= POSES_DE_MARCHE_DISTINCTES_MINIMALES, 'plusieurs images de marche distinctes')
  noter(`marche : ${images.length} poses, instants ${JSON.stringify(images.map((x) => x.instant))}`)
  verifierLesAppuis(images, pieds, racine, p.manifeste.appuis.vitessesAuSol, assets)
  assert.deepEqual(arret.erreurs, [], 'marche et arrêt sans erreur')
}

const PARCOURS = { combat: parcoursCombat, atelier: parcoursAtelier, composition: parcoursComposition }
if (!(o.parcours in PARCOURS)) throw new Error(`--parcours ${o.parcours} : ${Object.keys(PARCOURS).join(' ou ')} attendu`)

let echec = null
try {
  await session.rpc('Page.navigate', { url: `${srv.url}index.html?scenario=${o.scenario}&graine=${o.graine}` })
  await waitFor(session, '!!globalThis.wfrpEcran && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  await PARCOURS[o.parcours]()
  const releve = JSON.parse(await evaluate(session, `wfrpPont.appeler('erreursGlobales')`))
  assert.deepEqual(releve, { ok: true, erreurs: [] }, 'aucune erreur de la page relevée par le pont')
  noter('erreursGlobales : aucune')
} catch (e) {
  echec = e
  console.error('ÉCHEC', e.message)
  try { noter(`état à l’échec : ${JSON.stringify((await ecran())?.atelier?.composition)}`); await capturer('echec') } catch (diagnostic) { console.error('ÉCHEC DU DIAGNOSTIC', diagnostic.message) }
} finally {
  const erreurs = garde.errors()
  console.log(`console : ${garde.entries.length} entrée(s), ${erreurs.length} erreur(s), ${garde.warnings().length} avertissement(s)`)
  for (const e of [...erreurs, ...garde.warnings()]) console.log(' ', e.level, e.text)
  await session.close()
  srv.fermer()
}
process.exitCode = echec || garde.errors().length ? 1 : 0
