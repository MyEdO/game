// LA RECETTE DU TOUR COMPLET DE L'HÔTE GODOT (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md`, critère 4) :
// l'export Web (`node hotes/godot/construire.mjs --export --sortie <web>`) servi en statique, Chromium piloté au clic et
// au clavier sur le canevas comme un joueur. Godot publie à la page ce que l'écran porte (`globalThis.wfrpEcran` : le
// texte et le centre de chaque bouton, le point de chaque case) ; `wfrpPont.appeler('vue')` observe la partie. Aucun
// geste ne passe par le pont : chaque intention part d'un clic ou d'une frappe. Le tour : la fenêtre du round à
// l'Entrée, une charge sur l'ennemi le plus proche, la localisation, le jet et sa confirmation dans la fenêtre
// d'attaque, la fin du tour ; le héros suivant marche d'une case (aperçu puis déplacement) et finit son tour ; les
// jetons de l'adversaire repris par les minuteurs de Godot jusqu'à la Défense, jetée et confirmée. Console à 0 erreur.
//
//   node hotes/godot/recette.mjs --web <dossier de l'export> --captures <dossier> [--scenario dome] [--graine 7]
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { clic, consoleGuard, evaluate, geste, launchSession, realKey, shot, sleep, waitFor } from '../../scripts/recette/lib.mjs'

const { values: o } = parseArgs({ options: { web: { type: 'string' }, captures: { type: 'string' }, scenario: { type: 'string', default: 'dome' }, graine: { type: 'string', default: '7' } } })
if (!o.web || !o.captures) throw new Error('usage : node hotes/godot/recette.mjs --web <dossier de l’export> --captures <dossier>')

/** Le WebGL 2 de l'export, en logiciel dans un Chrome sans GPU, sans l'avertissement de repli. */
const WEBGL_LOGICIEL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.png': 'image/png' }

/** Sert `dossier` en statique sur un port libre de la boucle locale. */
function servir(dossier) {
  const racine = resolve(dossier)
  const serveur = createServer((req, res) => {
    const chemin = resolve(racine, decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/+/, '') || 'index.html')
    const st = chemin.startsWith(racine + sep) ? statSync(chemin, { throwIfNoEntry: false }) : undefined
    if (!st?.isFile()) return void res.writeHead(404).end()
    res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] ?? 'application/octet-stream', 'Content-Length': st.size })
    createReadStream(chemin).pipe(res)
  })
  return new Promise((ok) => serveur.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${serveur.address().port}/`, fermer: () => serveur.close() })))
}

const srv = await servir(o.web)
const session = await launchSession({ width: 1280, height: 720, timeoutMs: 30000, args: WEBGL_LOGICIEL })
const garde = consoleGuard(session)
const noter = (t) => console.log('·', t)
const vue = async () => JSON.parse(await evaluate(session, `wfrpPont.appeler('vue')`)).vue
const ecran = async () => JSON.parse(await evaluate(session, 'JSON.stringify(globalThis.wfrpEcran ?? null)'))
/** Le prochain écran publié : l'actuel est marqué vu, le suivant ne l'est pas. */
const marquer = () => evaluate(session, '(globalThis.wfrpEcran && (wfrpEcran.vu = true), true)')
const nouvelEcran = () => waitFor(session, '!!globalThis.wfrpEcran && !wfrpEcran.vu', { timeoutMs: 30000 })
/** Un bouton par son texte, ou par son texte suivi d'un coût entre parenthèses (une offre). */
const porte = (texte) => `(b) => b.texte === ${JSON.stringify(texte)} || b.texte.startsWith(${JSON.stringify(`${texte} (`)})`
const attendreBouton = (texte, timeoutMs = 30000) => waitFor(session, `!!globalThis.wfrpEcran && wfrpEcran.boutons.some(${porte(texte)})`, { timeoutMs })
const actif = (v) => v.projection.combat?.actif

async function cliquerPoint(x, y) {
  await marquer()
  await geste(session, { surface: 'canvas', x, y }, { qui: `clic (${Math.round(x)}, ${Math.round(y)})` }, clic())
  await nouvelEcran()
}
async function cliquerBouton(texte) {
  const { boutons } = await ecran()
  const b = boutons.find((x) => x.texte === texte) ?? boutons.find((x) => x.texte.startsWith(`${texte} (`))
  if (!b) throw new Error(`bouton « ${texte} » absent ; boutons : ${boutons.map((x) => x.texte).join(' | ')}`)
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
  await cliquerBouton('end-turn')
  if ((await vue()).projection.combat.finDeTourArmee) await cliquerBouton('end-turn')
}

let echec = null
try {
  await session.rpc('Page.navigate', { url: `${srv.url}index.html?scenario=${o.scenario}&graine=${o.graine}` })
  await attendreBouton('confirmRoundStart', 120000)
  await capturer('godot-1-round')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  let v = await vue()
  const heros = actif(v)
  noter(`Entrée : fenêtre ${v.projection.fenetre?.cle ?? 'fermée'} ; actif ${heros.nom}, barre ${v.projection.combat.barre.forme}`)
  const proche = v.projection.combat.voisins.liste.filter((c) => v.projection.combat.cibles.liste.includes(c.id)).sort((a, b) => a.distance - b.distance)[0]
  await cliquerBouton('charge')
  v = await vue()
  noter(`offre charge : intention ${v.projection.combat.intention}, ${v.cases.length} cases peintes`)
  await cliquerCase({ x: proche.pos[0], y: proche.pos[1] })
  noter(`clic sur ${proche.nom} (${proche.pos}) : jetons programmés`)
  await attendreBouton('attackRoll')
  v = await vue()
  noter(`fenêtre d'attaque ouverte par la reprise du jeton : ${v.attaque.sousTitre}`)
  await cliquerBouton(v.attaque.localisation.options.find((l) => l.valeur !== '').libelle)
  v = await vue()
  noter(`localisation ${v.attaque.localisation.choisie} ; cible du jet ${v.attaque.jet.pending.target}`)
  await capturer('godot-2-attaque-apercu')
  await cliquerBouton('attackRoll')
  v = await vue()
  noter(`jet : ${v.attaque.issue?.ligne ?? 'issue en attente'}`)
  await capturer('godot-3-attaque-jet')
  await cliquerBouton('attackConfirm')
  v = await vue()
  noter(`confirmée : fenêtre d'attaque ${v.attaque === null ? 'fermée' : 'ouverte'} ; ${proche.nom} ${v.projection.combat.voisins.liste.find((c) => c.id === proche.id).pb.join('/')}`)
  await finirLeTour()
  v = await vue()
  const second = actif(v)
  const vers = v.cases.find((c) => c.cout === 1).case
  noter(`fin du tour de ${heros.nom} ; actif ${second.nom}`)
  await cliquerCase(vers)
  v = await vue()
  noter(`premier clic sur (${vers.x}, ${vers.y}) : aperçu ${JSON.stringify(v.projection.combat.apercu)}`)
  await capturer('godot-4-deplacement-apercu')
  await cliquerCase(vers)
  noter(`second clic : ${second.nom} en ${actif(await vue()).pos}`)
  await finirLeTour()
  await attendreBouton('defenseRoll', 60000)
  v = await vue()
  noter(`jetons de l'adversaire repris par les minuteurs ; fenêtre ${v.projection.fenetre.cle}, étape ${v.projection.fenetre.etape?.genre}, à ${v.projection.fenetre.proprietaire} ; actif ${actif(v).nom}`)
  await capturer('godot-5-defense')
  await cliquerBouton('defenseRoll')
  await cliquerBouton('defenseConfirm')
  await sleep(2500)
  v = await vue()
  noter(`Défense confirmée : fenêtre ${v.projection.fenetre?.cle ?? 'aucune'}, round ${v.projection.combat?.round}`)
  await capturer('godot-6-apres-defense')
  noter(`erreursGlobales : ${await evaluate(session, `wfrpPont.appeler('erreursGlobales')`)}`)
} catch (e) {
  echec = e
  console.error('ÉCHEC', e.message)
} finally {
  const erreurs = garde.errors()
  console.log(`console : ${garde.entries.length} entrée(s), ${erreurs.length} erreur(s), ${garde.warnings().length} avertissement(s)`)
  for (const e of [...erreurs, ...garde.warnings()]) console.log(' ', e.level, e.text)
  await session.close()
  srv.fermer()
}
process.exitCode = echec || garde.errors().length ? 1 : 0
