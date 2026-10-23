// LA RECETTE DU TOUR COMPLET DE L'HÔTE GODOT (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md`, critère 4) :
// l'export Web (`node hotes/godot/construire.mjs --export --sortie <web>`) servi en statique, Chromium piloté au clic et
// au clavier sur le canevas comme un joueur. Godot publie à la page ce que l'écran porte (`globalThis.wfrpEcran` : le
// texte et le centre de chaque bouton, le point de chaque case) ; `wfrpPont.appeler('vue')` observe la partie, et chaque
// bouton se trouve par le texte que la vue lui donne. Aucun geste ne passe par le pont : chaque intention part d'un clic
// ou d'une frappe. Le tour : la fenêtre du round à l'Entrée, une charge sur l'ennemi le plus proche, la localisation, le
// jet et sa confirmation dans la fenêtre d'attaque, la fin du tour ; le héros suivant marche d'une case (aperçu puis
// déplacement) et finit son tour ; les jetons de l'adversaire repris par les minuteurs de Godot jusqu'à la Défense du
// héros visé, jetée et confirmée, puis le round 2. Le jet tombé, la fenêtre ne redessine ni son geste ni ses réglages
// d'avant le jet (#2936, `ouvert`). Chaque étape est assertée sur la vue ; une assertion fausse, une
// erreur relevée par le pont (`erreursGlobales`) ou une erreur de console rendent un code non nul.
//
//   node hotes/godot/recette.mjs --web <dossier de l'export> --captures <dossier> [--scenario dome] [--graine 7]
import assert from 'node:assert/strict'
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
/** Attend que la vue, lue par le pont, vérifie `condition` (une expression sur `v`). */
const attendreLaVue = (condition, timeoutMs = 30000) =>
  waitFor(session, `(() => { try { const v = JSON.parse(wfrpPont.appeler('vue')).vue; return !!(${condition}) } catch { return false } })()`, { timeoutMs })
/** Le prochain écran publié : l'actuel est marqué vu, le suivant ne l'est pas (chaque publication remplace l'objet). */
const marquer = () => evaluate(session, '(globalThis.wfrpEcran && (wfrpEcran.vu = true), true)')
const nouvelEcran = () => waitFor(session, '!!globalThis.wfrpEcran && !wfrpEcran.vu', { timeoutMs: 30000 })
const actif = (v) => v.projection.combat?.actif
const nomDe = (v, id) => v.projection.combat.voisins.liste.find((c) => c.id === id)?.nom
/** Les verbes des gestes que la fenêtre dessine (`ouvert`), et ceux qu'elle tait. */
const ouverts = (v) => v.fenetre.gestes.filter((g) => g.ouvert).map((g) => g.verbe)
const fermes = (v) => v.fenetre.gestes.filter((g) => !g.ouvert).map((g) => g.verbe)
/** Le verbe du geste que la fenêtre attend. */
const verbeAttendu = (v) => v.fenetre.gestes.find((g) => g.attendu).verbe
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
async function cliquerBouton(texte) {
  const { boutons } = await ecran()
  const b = boutons.find((x) => x.texte === texte)
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
  await cliquerBouton((await vue()).panneau.offres['end-turn'])
  const v = await vue()
  if (v.projection.combat.finDeTourArmee) await cliquerBouton(v.panneau.offres['end-turn'])
}

let echec = null
try {
  await session.rpc('Page.navigate', { url: `${srv.url}index.html?scenario=${o.scenario}&graine=${o.graine}` })
  await waitFor(session, '!!globalThis.wfrpEcran && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
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
  const [jetDAttaque, viser] = [verbeAttendu(v), v.attaque.localisation.verbe]
  noter(`gestes dessinés avant le jet : ${ouverts(v).join(', ')}`)
  await cliquerBouton(attendu(v))
  v = await vue()
  assert.equal(v.attaque.jete, true, 'le jet tombe')
  assert.ok(fermes(v).includes(jetDAttaque) && fermes(v).includes(viser), 'le jet tombé, ni le jet ni la Localisation ne se redessinent (#2936)')
  assert.ok(ouverts(v).includes(verbeAttendu(v)), 'le jet tombé, sa clôture se dessine')
  noter(`gestes dessinés après le jet : ${ouverts(v).join(', ')}`)
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
  const [jetDeDefense, reagir] = [verbeAttendu(v), v.defense.reaction.verbe]
  noter(`gestes dessinés avant la Défense : ${ouverts(v).join(', ')}`)
  await cliquerBouton(attendu(v))
  v = await vue()
  assert.equal(v.defense.jete, true, 'le jet de Défense tombe')
  assert.ok(fermes(v).includes(jetDeDefense) && fermes(v).includes(reagir), 'le jet de Défense tombé, ni le jet ni la réaction ne se redessinent (#2936)')
  noter(`gestes dessinés après la Défense : ${ouverts(v).join(', ')}`)
  await capturer('2928-6c-5b-defense-jet')
  await cliquerBouton(attendu(v))
  await attendreLaVue('!v.defense && v.projection.combat.round === 2', 60000)
  v = await vue()
  noter(`Défense confirmée : fenêtre « ${v.fenetre?.titre ?? 'aucune'} », round ${v.projection.combat.round}`)
  await capturer('2928-6c-6-apres-defense')
  const releve = JSON.parse(await evaluate(session, `wfrpPont.appeler('erreursGlobales')`))
  assert.deepEqual(releve, { ok: true, erreurs: [] }, 'aucune erreur de la page relevée par le pont')
  noter('erreursGlobales : aucune')
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
