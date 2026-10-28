// LES RECETTES DE L'HÔTE GODOT (#2928, #3086) :
// l'export Web (`node hotes/godot/construire.mjs --export --sortie <web>`) servi par `servir.mjs`, Chromium piloté au clic et
// au clavier sur le canevas comme un joueur. Godot publie à la page ce que l'écran porte (`globalThis.wfrpEcran`,
// `pont/CONTRAT.md`, section « Écran publié ») : le texte et le centre de chaque bouton, le point de chaque case, l'état
// de l'atelier. Aucun geste ne passe par le pont : chaque intention part d'un clic, d'un cran de molette ou d'une frappe.
// Deux parcours, chacun ouvert depuis le menu d'entrée :
// - `combat` (défaut) : la fenêtre du round à l'Entrée, une charge sur l'ennemi le plus proche, la localisation, le
//   jet et sa confirmation dans la fenêtre d'attaque, la fin du tour ; le héros suivant marche d'une case (aperçu puis
//   déplacement) et finit son tour ; les jetons de l'adversaire repris par les minuteurs de Godot jusqu'à la Défense du
//   héros visé, jetée et confirmée, puis le round 2. `wfrpPont.appeler('vue')` observe la partie, et chaque bouton se
//   trouve par le texte que la vue lui donne.
// - `atelier` : `--base` importé seul (`importer.mjs --sans-publier`) dans `--modeles`, dossier neuf servi sous
//   `modeles/` ; la base choisie, ses points sans élément ; `--element` importé puis « Recharger » ; les aides, l'élément
//   monté puis démonté (« vide ») ; un clip joué, mis en pause, avancé et reculé d'une image (au clic puis à l'Entrée),
//   sa vitesse réglée ; puis les fichiers de la base et de l'élément qui la référence supprimés (l'import refuse un id
//   présent, et un élément dont la base manque), `--reexport` importé à la place de la base puis l'élément réimporté,
//   « Recharger » sans relancer la page : l'empreinte publiée devient celle du manifeste réimporté, l'état
//   (clip, instant, pause, vitesse, montés, aides) est gardé.
// Chaque étape est assertée ; une assertion fausse, une erreur relevée par le pont (`erreursGlobales`) ou une erreur de
// console rendent un code non nul.
//
//   node hotes/godot/recette.mjs --web <dossier de l'export> --captures <dossier> [--scenario dome] [--graine 7]
//   node hotes/godot/recette.mjs --parcours atelier --web <export> --captures <dossier> --modeles <dossier neuf>
//     --base <production> --element <production> --reexport <production> [--clip Sword_Attack]
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { servir } from './servir.mjs'
import { clic, consoleGuard, evaluate, geste, launchSession, molette, realKey, shot, sleep, waitFor } from '../../scripts/recette/lib.mjs'

const chaine = { type: 'string' }
const { values: o } = parseArgs({
  options: { parcours: { type: 'string', default: 'combat' }, web: chaine, captures: chaine, scenario: { type: 'string', default: 'dome' }, graine: { type: 'string', default: '7' }, modeles: chaine, base: chaine, element: chaine, reexport: chaine, clip: { type: 'string', default: 'Sword_Attack' } },
})
if (!o.web || !o.captures) throw new Error('usage : node hotes/godot/recette.mjs --web <dossier de l’export> --captures <dossier> [--parcours combat|atelier]')
if (o.parcours === 'atelier' && !(o.modeles && o.base && o.element && o.reexport)) throw new Error('--parcours atelier attend --modeles <dossier neuf> --base, --element et --reexport <dossier de production>')
if (o.parcours === 'atelier' && existsSync(o.modeles)) throw new Error(`--modeles ${o.modeles} existe : le parcours importe dans un dossier neuf`)

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
/** Le point du panneau de l'atelier où tourne la molette : sur les lignes des points, hors de la liste des clips. */
const PANNEAU = { x: 60, y: 400 }
const CRANS = 150
const production = (dossier) => JSON.parse(readFileSync(join(dossier, 'manifest.json'), 'utf8'))
const atelier = async () => (await ecran()).atelier
/** Attend que l'atelier publié vérifie `condition` (une expression sur `a`, et `b`, les boutons publiés). */
const attendreLAtelier = (condition, timeoutMs = 60000) =>
  waitFor(session, `(() => { const a = globalThis.wfrpEcran?.atelier, b = globalThis.wfrpEcran?.boutons; return !!a && !!(${condition}) })()`, { timeoutMs })

/** La production `dossier` importée sous l'id `id` dans `--modeles`, sans rien publier ; le refus de l'import lève, collé. */
function importer(dossier, id) {
  const r = spawnSync(process.execPath, [IMPORTER, dossier, id, '--destination', o.modeles, '--sans-publier'], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`import de ${dossier} sous ${id} refusé (code ${r.status}) :\n${r.stderr}${r.stdout}`)
  noter(`import de ${id} : ${r.stdout.split('\n')[1].replaceAll(o.modeles, '')}`)
}

/** Le bouton `quoi` amené à l'écran par la molette tournée au point `ou`, vers le bas (`sens` 1) ou le haut (-1). */
async function amener(quoi, sens, ou = PANNEAU) {
  for (let cran = 0; cran < CRANS; cran++) {
    const b = trouver((await ecran()).boutons, quoi)
    if (b) return b
    await molette(session, { surface: 'canvas', x: ou.x, y: ou.y }, sens * 360)
    await sleep(300)
  }
  throw new Error(`bouton ${JSON.stringify(quoi)} hors de l'écran après ${CRANS} crans de molette`)
}
async function cliquerAmene(quoi, sens, ou) {
  await amener(quoi, sens, ou)
  await cliquerBouton(quoi)
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
  const choix = (await ecran()).boutons.filter((b) => b.cle)
  assert.ok(choix.every((b) => [`${b.cle.split('/')[0]}/vide`, `${b.cle.split('/')[0]}/${elementId}`].includes(b.cle)), 'chaque point liste « vide » et l’élément indexé')
  noter(`« Recharger » : chaque point liste « vide » et « ${elementId} » (${choix.length / 2} points à l’écran)`)
  for (const aide of ['Os', 'Prises']) await cliquerBouton(aide)
  a = await atelier()
  assert.deepEqual(a.aides, { os: true, emplacements: false, prises: true }, 'les aides cochées sont montrées')

  const monter = { cle: `main/${elementId}` }
  await cliquerAmene(monter, 1)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  noter(`« ${elementId} » monté à la prise « main »`)
  await capturer('3086-a1-2-element-monte')
  await cliquerBouton({ cle: 'main/vide' })
  await attendreLAtelier('!("main" in a.montes)')
  noter('« vide » : la prise « main » démontée')
  await cliquerBouton(monter)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)

  const premier = await amener('A_TPose', 1)
  await cliquerAmene(o.clip, 1, { x: premier.x, y: premier.y })
  await attendreLAtelier(`a.clip === ${JSON.stringify(o.clip)} && a.lecture`)
  await cliquerAmene('Pause', 1)
  a = await atelier()
  assert.deepEqual([a.clip, a.lecture], [o.clip, false], 'la pause arrête le clip')
  const enPause = a.instant
  await cliquerBouton('Image suivante')
  const suivante = (await atelier()).instant
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  const encore = (await atelier()).instant
  assert.ok(suivante > enPause && encore > suivante, `chaque image suivante avance l’instant : ${enPause} → ${suivante} → ${encore}`)
  await cliquerBouton('Image précédente')
  a = await atelier()
  assert.ok(Math.abs(a.instant - suivante) < 1e-6, `l’image précédente revient d’une image : ${encore} → ${a.instant}`)
  noter(`pause à ${enPause} s ; image suivante (clic) ${suivante}, (Entrée) ${encore}, précédente ${a.instant} : une image ${(encore - suivante).toFixed(4)} s`)
  await cliquerBouton('×0.5')
  a = await atelier()
  assert.deepEqual([a.vitesse, a.lecture, a.instant], [0.5, false, suivante], 'la vitesse se règle, la pause tient l’instant')
  await cliquerBouton('Lecture')
  assert.equal((await atelier()).lecture, true, 'la lecture reprend')
  await sleep(500)
  await cliquerBouton('Pause')
  const avant = await atelier()
  assert.ok(avant.instant !== suivante && avant.lecture === false, `la lecture a avancé le clip : ${suivante} → ${avant.instant}`)
  noter(`×0.5, lecture puis pause : ${avant.instant} s`)
  await capturer('3086-a1-3-clip-en-pause')

  for (const id of [base, elementId]) for (const fichier of [`${id}.glb`, `${id}.manifeste.json`, `${id}.provenance.json`]) rmSync(join(o.modeles, fichier))
  noter(`fichiers de « ${base} » et de « ${elementId} », qui la référence, supprimés : l’import refuse un id déjà présent ([id-deja-present]) et un élément dont la base manque ([base-absente])`)
  importer(o.reexport, base)
  importer(o.element, elementId)
  await evaluate(session, '(globalThis.recetteSansRelance = true)')
  await cliquerAmene('Recharger', -1)
  await attendreLAtelier(`a.empreinte === ${JSON.stringify(p1.model_sha256)} && a.montes.main === ${JSON.stringify(elementId)} && a.clip !== null`, 120000)
  const apres = await atelier()
  assert.equal(await evaluate(session, 'globalThis.recetteSansRelance === true'), true, 'la page n’a pas été relancée')
  assert.ok(Math.abs(apres.instant - avant.instant) < 1e-6, `l’instant gardé : ${avant.instant} → ${apres.instant}`)
  const etat = ({ base: b, clip, lecture, vitesse, montes, aides, erreurs }) => ({ b, clip, lecture, vitesse, montes, aides, erreurs })
  assert.deepEqual(etat(apres), etat(avant), 'clip, pause, vitesse, montés, aides gardés')
  noter(`« Recharger » sans relance : empreinte ${avant.empreinte.slice(0, 12)} → ${apres.empreinte.slice(0, 12)} ; ${apres.clip} à ${apres.instant} s en pause, ×${apres.vitesse}, montés ${JSON.stringify(apres.montes)}, aides ${JSON.stringify(apres.aides)}`)
  await capturer('3086-a1-4-reexport-recharge')
}

const PARCOURS = { combat: parcoursCombat, atelier: parcoursAtelier }
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
} finally {
  const erreurs = garde.errors()
  console.log(`console : ${garde.entries.length} entrée(s), ${erreurs.length} erreur(s), ${garde.warnings().length} avertissement(s)`)
  for (const e of [...erreurs, ...garde.warnings()]) console.log(' ', e.level, e.text)
  await session.close()
  srv.fermer()
}
process.exitCode = echec || garde.errors().length ? 1 : 0
