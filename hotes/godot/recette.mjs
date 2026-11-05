// LES RECETTES DE L'HÔTE GODOT (#2928, #3086) :
// l'export Web (`node hotes/godot/construire.mjs --export --sortie <web>`) servi par `servir.mjs`, Chromium piloté au clic et
// au clavier sur le canevas comme un joueur. Godot publie à la page ce que l'écran porte (`globalThis.wfrpEcran`,
// `pont/CONTRAT.md`, section « Écran publié ») : le texte et le centre de chaque bouton, le point de chaque case, l'état
// de l'atelier. Aucun geste ne passe par le pont : chaque intention part d'un clic, d'un cran de molette ou d'une frappe.
// Chaque parcours s'ouvre depuis le menu d'entrée :
// - `combat` (défaut) : la fenêtre du round à l'Entrée, une charge sur la plus proche des cibles que la charge offre,
//   la localisation, le jet et sa confirmation dans la fenêtre d'attaque, la fin du tour ; le héros suivant marche
//   d'une case (aperçu puis déplacement) et finit son tour ; les jetons de l'adversaire repris par les minuteurs de
//   Godot jusqu'à la Défense du héros visé, jetée et confirmée, puis le round 2. `wfrpPont.appeler('vue')` observe la
//   partie, et chaque bouton se trouve par l'élément de la vue qu'il dessine (`vue.zones`). Le jet tombé, la fenêtre
//   ne redessine ni son geste ni ses réglages d'avant le jet (#2936, `ouvert`).
// - `critique` : la fenêtre du round à l'Entrée, puis le combat joué en joueur pressé (chaque fenêtre à l'Entrée, ou par
//   la première valeur ouverte de ses choix quand aucun geste n'a le focus, chaque tour une charge ou une attaque cliquée
//   sur la première cible, sinon la fin du tour) jusqu'au premier Coup Critique, dont la fenêtre dit la localisation et
//   les effets.
// - `fin` : le combat joué de même jusqu'à sa fin, la dernière séquence poursuivie, puis la fenêtre de la fin qui tient
//   la main, sa sortie en focus ; sa sortie à l'Entrée rend la main à la scène.
// - `exploration` (`--scenario porte-close`) : l'entrée de la scène poursuivie à l'Entrée, le groupe à sa case, la porte
//   ouverte par le bouton de son geste d'exploration, puis un clic sur une case du réduit qui y mène le groupe.
// - `dialogue` (`--scenario dialogue-multi`) : l'entrée de la scène poursuivie à l'Entrée, un clic sur une case à côté de
//   Gustav, son offre « Parler » cliquée parmi les gestes d'exploration, la conversation dessinée, puis la première
//   réponse cliquée : l'interlocuteur suivant prend la parole.
// - `fiche` : la fenêtre du round à l'Entrée, puis la fiche du premier héros ouverte par son bouton, chacun de ses
//   onglets cliqué, un Talent survolé (sa description en bulle), et la fiche fermée par son bouton « Fermer ».
// - `inventaire` (`--scenario porte-close`) : l'entrée de la scène poursuivie à l'Entrée, la fiche de Rosa Brandt à
//   ses possessions, son armure choisie puis ôtée par « Porter », sa potion choisie.
// - `creation` (`--scenario marche-equipement`) : l'entrée de la scène poursuivie à l'Entrée, « Nouveau héros » ouvre
//   la création sur la race, sans résultat ni suivante avant le d100 ; le d100 tiré, la suivante à l'Entrée ; la
//   carrière tirée, puis les Caractéristiques ; « Nouveau héros » pressé ferme la création sans héros nouveau.
// - `atelier` : `--base` importé seul (`importer.mjs --sans-publier`) dans `--modeles`, dossier neuf servi sous
//   `modeles/` ; la base choisie à l'onglet Outils, aucun emplacement à l'onglet Équipement ; `--element` importé puis
//   « Recharger les modèles » : l'élément offert par la liste des seuls points dont l'os porte sa lame (`osDesRigides`
//   du listage) ; les aides, l'élément monté puis démonté (« Aucun ») ; si une surface de `--element` porte
//   `blason: true` (#3111), deux emblèmes posés tour à tour à la prise `main`, chacun sans erreur publiée, puis
//   « Aucun » et le premier reposé, ces quatre choix sans requête du GLB de l'élément (`performance`, page) ni appel
//   `composer` de Godot (`wfrpPont.appeler` enveloppé, témoins : le GLB requis au montage, `modeles` appelé au premier
//   rechargement) ; puis « Aucun » : l'emblème effacé au démontage, l'élément remonté sans emblème (le défaut de la
//   composition), le premier reposé avant le rechargement (sans surface `blason`, une ligne du journal dit la preuve non
//   jouée) ; à l'onglet Animation, un clip joué, mis en pause, avancé et reculé d'une image (au clic puis à l'Entrée),
//   sa vitesse réglée ; puis `--reexport` importé à la place de la base (`importer.mjs --remplacer`), l'élément qui la
//   référence revalidé contre elle et laissé en place, « Recharger les modèles » sans relancer la page : l'empreinte
//   publiée devient celle du manifeste réimporté, l'état (clip, instant, pause, vitesse, montés, emblèmes, aides) est
//   gardé.
// - `composition` : Soldat, manquants et copie validée côté Node ; une couleur changée à l'onglet Couleurs, posée dans
//   la composition et sur les matériaux de la pièce ; pièce skinnée montée et démontée, courtaud, corpulence aux
//   bornes, marche au clavier au corps neutre et couplage de la racine au temps du clip, puis repos.
// Chaque étape est assertée ; une assertion fausse, une erreur relevée par le pont (`erreursGlobales`) ou une erreur de
// console rendent un code non nul.
//
//   node hotes/godot/recette.mjs --web <dossier de l'export> --captures <dossier> [--scenario dome] [--graine 7]
//   node hotes/godot/recette.mjs --parcours exploration --scenario porte-close --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours creation --scenario marche-equipement --web <export> --captures <dossier>
//   node hotes/godot/recette.mjs --parcours dialogue --scenario dialogue-multi --web <export> --captures <dossier>
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
import { ATTENTE_ECHUE, clic, consoleGuard, evaluate, geste, launchSession, molette, realKey, realKeyDown, realKeyUp, shot, sleep, survoler, waitFor } from '../../scripts/recette/lib.mjs'

import { chargerAssets } from './asset/charger.mjs'

const chaine = { type: 'string' }
const { values: o } = parseArgs({
  options: { parcours: { type: 'string', default: 'combat' }, web: chaine, captures: chaine, scenario: { type: 'string', default: 'dome' }, graine: { type: 'string', default: '7' }, modeles: chaine, base: chaine, element: chaine, reexport: chaine, piece: chaine, clip: { type: 'string', default: 'Sword_Attack' } },
})
if (!o.web || !o.captures) throw new Error('usage : node hotes/godot/recette.mjs --web <dossier de l’export> --captures <dossier> [--parcours combat|critique|fin|dialogue|exploration|fiche|inventaire|creation|atelier|composition]')
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
const nouvelEcran = (timeoutMs = 30000) => waitFor(session, '!!globalThis.wfrpEcran && !wfrpEcran.vu', { timeoutMs })
const actif = (v) => v.projection.combat?.actif
/** Les éléments que la vue montre dans la zone `zone` (`vue.zones`, `CONTRAT.md`). */
const zone = (v, z) => v.zones[z]
/** L'élément d'id `id` de la zone `z`. */
const element = (v, z, id) => zone(v, z).find((e) => e.id === id)
/** L'offre d'id `id` de la barre, rangée sous la part de l'économie du tour qu'elle prend. */
const offre = (v, id) => zone(v, 'combat.offres').flatMap((e) => e.valeurs).find((e) => e.id === id)
/** Les gestes que la fenêtre dessine : ses réglages, puis ses gestes. */
const dessines = (v) => [...zone(v, 'fenetre.reglages'), ...zone(v, 'fenetre.gestes')]
/** Les gestes que la fenêtre dessine, par leur identité. */
const ouverts = (v) => dessines(v).map((g) => g.id)
/** Le geste en focus : celui que la fenêtre joue à l'Entrée. */
const enFocus = (v) => {
  const gestes = dessines(v).filter((g) => g.focus)
  assert.equal(gestes.length, 1, `un geste en focus dans ${JSON.stringify(ouverts(v))}`)
  return gestes[0]
}
/** Le texte de chaque élément du corps de la fenêtre. */
const corps = (v) => zone(v, 'fenetre.corps').map((e) => e.texte ?? [e.qui, e.libelle, e.resultat, e.verdict].filter(Boolean).join(' ')).join(' / ')
/** L'étape de cascade que la fenêtre tient. */
const etape = (v) => v.projection.fenetre?.etape?.genre

async function cliquerPoint(x, y) {
  await marquer()
  await geste(session, { surface: 'canvas', x, y }, { qui: `clic (${Math.round(x)}, ${Math.round(y)})` }, clic())
  await nouvelEcran()
}
/** Le bouton publié dont le texte vaut `quoi`, ou, pour `{ cle }` ou `{ element }`, dont la clé ou l'élément dessiné
 *  vaut celui-ci ; `undefined` hors de l'écran. */
const trouver = (boutons, quoi) => boutons.find((x) => (typeof quoi === 'string' ? x.texte === quoi : 'element' in quoi ? x.element === quoi.element : x.cle === quoi.cle))
/** Le bouton publié qui dessine le bouton `b` de la vue. */
const bouton = (b) => ({ element: `bouton/${b.id}` })
async function cliquerBouton(quoi) {
  const { boutons } = await ecran()
  const b = trouver(boutons, quoi)
  if (!b) throw new Error(`bouton ${JSON.stringify(quoi)} absent ; boutons : ${boutons.map((x) => x.element ?? x.cle ?? x.texte).join(' | ')}`)
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
  await cliquerBouton({ element: 'bouton/end-turn' })
  const v = await vue()
  if (v.projection.combat.finDeTourArmee) await cliquerBouton({ element: 'bouton/end-turn' })
}

async function parcoursCombat() {
  await cliquerBouton('Combat')
  noter('menu : bouton « Combat » cliqué')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  assert.ok(v.projection.fenetre, 'la fenêtre du round tient la main')
  assert.equal(v.projection.combat.round, 1)
  await capturer('2928-6c-1-round')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  const heros = actif(v)
  assert.equal(v.projection.fenetre, null, 'l’Entrée joue le geste au focus et ferme la fenêtre du round')
  assert.deepEqual(zone(v, 'fenetre.titre'), [], 'sans fenêtre, la zone du titre est vide')
  assert.equal(heros?.camp, 'hero', 'un héros est actif')
  assert.equal(v.projection.combat.barre.forme, 'ouverte')
  assert.equal(zone(v, 'combat.actif')[0]?.nom, heros.nom, 'le panneau nomme l’actif')
  noter(`Entrée : fenêtre fermée ; actif ${heros.nom}, barre ouverte`)
  const charge = offre(v, 'charge')
  await cliquerBouton(bouton(charge))
  v = await vue()
  assert.equal(v.projection.combat.intention, 'charge', 'l’offre arme son intention')
  assert.equal(offre(v, 'charge').presse, true, 'l’offre armée est pressée')
  const proche = v.projection.combat.voisins.liste.filter((c) => v.projection.combat.cibles.liste.includes(c.id)).sort((a, b) => a.distance - b.distance)[0]
  assert.ok(proche, `la charge offre une cible ; cibles : ${JSON.stringify(v.projection.combat.cibles.liste)}`)
  noter(`offre ${charge.libelle} : intention charge, ${v.cases.length} cases peintes`)
  await cliquerCase({ x: proche.pos[0], y: proche.pos[1] })
  await attendreLaVue("v.projection.fenetre?.etape?.genre === 'attackJet'")
  v = await vue()
  assert.equal(element(v, 'fenetre.corps', 'jet')?.qui, heros.nom, 'la charge ouvre l’attaque du héros')
  assert.ok(element(v, 'fenetre.corps', 'cible')?.texte.includes(proche.nom), 'sur sa cible')
  assert.equal(element(v, 'fenetre.corps', 'jet').verdict, null, 'le jet est à lancer')
  noter(`clic sur ${proche.nom} : jetons repris par les minuteurs, fenêtre « ${zone(v, 'fenetre.titre')[0].texte} » ouverte ; ${corps(v)}`)
  const localiser = element(v, 'fenetre.reglages', 'attackSetLocation')
  const lieu = localiser.valeurs.find((x) => x.jeu.args.at(-1) !== null)
  await cliquerBouton(bouton(lieu))
  v = await vue()
  assert.equal(element(v, 'fenetre.reglages', localiser.id).valeurs.find((x) => x.presse)?.id, lieu.id, 'la Localisation cliquée est retenue')
  noter(`Localisation « ${lieu.libelle} » ; ${element(v, 'fenetre.corps', 'jet').cible}`)
  await capturer('2928-6c-2-attaque-apercu')
  const jetDAttaque = enFocus(v).id
  noter(`gestes dessinés avant le jet : ${ouverts(v).join(', ')}`)
  await cliquerBouton(bouton(enFocus(v)))
  v = await vue()
  assert.ok(element(v, 'fenetre.corps', 'jet').verdict, 'le jet tombe')
  assert.ok(!ouverts(v).includes(jetDAttaque) && !ouverts(v).includes(localiser.id), 'le jet tombé, ni le jet ni la Localisation ne se redessinent (#2936)')
  assert.ok(ouverts(v).includes(enFocus(v).id), 'le jet tombé, sa clôture se dessine')
  noter(`gestes dessinés après le jet : ${ouverts(v).join(', ')}`)
  const issue = element(v, 'fenetre.corps', 'issue')
  assert.ok(issue, 'le jet tombé dit son issue')
  noter(`jet : ${issue.texte}`)
  await capturer('2928-6c-3-attaque-jet')
  const pbAvant = v.projection.combat.voisins.liste.find((c) => c.id === proche.id).pb[0]
  await cliquerBouton(bouton(enFocus(v)))
  v = await vue()
  assert.notEqual(etape(v), 'attackJet', 'confirmée, la fenêtre d’attaque se ferme')
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
  const apercu = element(v, 'combat.apercu', 'apercu')
  assert.ok(apercu, 'l’aperçu dit ce qu’il coûte, près de sa case')
  noter(`premier clic sur (${vers.x}, ${vers.y}) : ${apercu.texte}`)
  await capturer('2928-6c-4-deplacement-apercu')
  await cliquerCase(vers)
  v = await vue()
  assert.deepEqual(actif(v).pos, [vers.x, vers.y], 'le second clic déplace le héros')
  noter(`second clic : ${second.nom} en ${actif(v).pos}`)
  await finirLeTour()
  await attendreLaVue("v.projection.fenetre?.etape?.genre === 'defenseJet'", 60000)
  v = await vue()
  const adversaire = actif(v)
  assert.equal(adversaire.camp, 'enemy', 'les jetons repris, le noyau joue l’adversaire')
  assert.ok(element(v, 'fenetre.corps', 'defense/qui')?.texte.includes(adversaire.nom), 'la Défense répond à l’adversaire actif')
  const defenseur = v.projection.fenetre.proprietaire
  assert.equal(defenseur.genre, 'porteur', 'la Défense est à un héros')
  assert.ok(zone(v, 'fenetre.etape')[0]?.texte.includes(defenseur.nom), 'l’étape nomme le héros qui se défend')
  noter(`Défense ouverte par les minuteurs : ${corps(v)} ; à ${defenseur.nom}`)
  await capturer('2928-6c-5-defense')
  const [jetDeDefense, reagir] = [enFocus(v).id, 'defenseSetMode']
  assert.ok(ouverts(v).includes(reagir), 'avant le jet, la réaction se dessine')
  noter(`gestes dessinés avant la Défense : ${ouverts(v).join(', ')}`)
  await cliquerBouton(bouton(enFocus(v)))
  v = await vue()
  assert.ok(zone(v, 'fenetre.corps').some((e) => e.type === 'jet' && e.verdict), 'le jet de Défense tombe')
  assert.ok([jetDeDefense, reagir].every((id) => !ouverts(v).includes(id)), 'le jet de Défense tombé, ni le jet ni la réaction ne se redessinent (#2936)')
  noter(`gestes dessinés après la Défense : ${ouverts(v).join(', ')}`)
  await capturer('2928-6c-5b-defense-jet')
  await cliquerBouton(bouton(enFocus(v)))
  await attendreLaVue("v.projection.fenetre?.etape?.genre !== 'defenseJet' && v.projection.combat.round === 2", 60000)
  v = await vue()
  noter(`Défense confirmée : fenêtre « ${zone(v, 'fenetre.titre')[0]?.texte ?? 'aucune'} », round ${v.projection.combat.round}`)
  await capturer('2928-6c-6-apres-defense')
}

const IMPORTER = fileURLToPath(new URL('./importer.mjs', import.meta.url))
/** Le point du panneau de l'atelier où tourne la molette : sur les lignes des points. */
const PANNEAU = { x: 60, y: 400 }
const CRANS = 150
/** Les textes du panneau de l'atelier (`projet/scripts/atelier.gd`, `projet/scenes/Atelier.tscn`) : le choix vide d'une
 *  liste d'emplacement, d'axe ou d'emblème, celui d'une liste de couleur, et deux boutons. */
const AUCUN = 'Aucun'
const PAR_DEFAUT = 'Par défaut'
const RECHARGER = 'Recharger les modèles'
const COPIER = 'Copier la composition'
const production = (dossier) => JSON.parse(readFileSync(join(dossier, 'manifest.json'), 'utf8'))
/** Le combat joué en joueur pressé jusqu'à ce que `fini(v)` tienne : chaque fenêtre à l'Entrée, ou par la première
 *  valeur ouverte de ses choix quand aucun geste n'a le focus, chaque tour une charge ou une attaque cliquée sur la
 *  première cible, sinon la fin du tour ; `quoi` nomme ce qu'on attend. */
async function jouerEnJoueurPresse(fini, quoi) {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  for (let pas = 0; !fini(v); pas++) {
    const c = v.projection.combat
    assert.ok(pas < 600 && c, `${quoi} : rien après ${pas} gestes, combat ${c?.fin ?? 'en cours'}`)
    const offres = zone(v, 'combat.offres').flatMap((e) => e.valeurs).filter((b) => !b.refus)
    const valeur = zone(v, 'fenetre.gestes').some((g) => g.focus) ? null : zone(v, 'fenetre.gestes').flatMap((g) => (g.type === 'choix' ? g.valeurs : [])).find((b) => !b.refus)
    if (v.projection.fenetre && valeur) await cliquerBouton(bouton(valeur))
    else if (v.projection.fenetre) {
      await marquer()
      await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await nouvelEcran()
    } else if (c.intention && c.cibles.liste.length) {
      const cible = c.voisins.liste.find((x) => x.id === c.cibles.liste[0])
      await cliquerCase({ x: cible.pos[0], y: cible.pos[1] })
    } else if (c.barre.forme === 'ouverte') await cliquerBouton(bouton(offres.find((o) => !c.intention && (o.id === 'charge' || o.id === 'attaque')) ?? offres.find((o) => o.id === 'end-turn')))
    else {
      await marquer()
      await nouvelEcran()
    }
    v = await vue()
  }
  return v
}

async function parcoursCritique() {
  const v = await jouerEnJoueurPresse((x) => etape(x) === 'critical', 'aucun Coup Critique')
  assert.ok(element(v, 'fenetre.corps', 'critique/localisation'), 'la fenêtre dit la localisation du Coup Critique')
  noter(`Coup Critique : ${zone(v, 'fenetre.titre')[0].texte} ; ${zone(v, 'fenetre.corps').map((e) => e.valeur ?? e.texte).join(' / ')}`)
  await capturer('3328-f1-coup-critique')
}

async function parcoursFin() {
  let v = await jouerEnJoueurPresse((x) => !!x.projection.combat?.fin && !!x.projection.fenetre && !x.projection.fenetre.etape, 'aucune fin du combat')
  const [titre] = zone(v, 'fenetre.titre')
  const sortie = zone(v, 'fenetre.gestes').find((g) => g.focus)
  assert.ok(titre && sortie, `la fin du combat tient la main, sa sortie en focus : ${JSON.stringify(v.projection.fenetre)}`)
  noter(`Fin du combat : ${titre.texte} ; « ${sortie.libelle} » en focus`)
  await capturer('3328-g1-fin-du-combat')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  assert.ok(!v.projection.combat, 'la sortie rend la main à la scène')
  noter(`« ${sortie.libelle} » à l’Entrée : la scène reprend${v.projection.fenetre ? `, ${zone(v, 'fenetre.titre')[0]?.texte} tient la main` : ''}`)
  await capturer('3328-g1-apres-la-fin')
}

async function parcoursExploration() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  assert.equal(etape(v), 'sceneEntry', 'l’entrée de la scène tient la main')
  assert.deepEqual(zone(v, 'exploration.gestes'), [], 'une fenêtre tient la main : aucun geste d’exploration')
  await capturer('3328-e1-1-entree')
  while (v.projection.fenetre) {
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
    v = await vue()
  }
  const x = v.projection.exploration
  assert.ok(x, 'hors combat, la vue est celle de l’exploration')
  assert.deepEqual(x.heros.map((h) => h.pos), x.heros.map(() => x.groupe), 'chaque héros se tient à la case du groupe')
  noter(`Entrée : l’entrée de la scène poursuivie ; groupe en ${x.groupe}, gestes ${zone(v, 'exploration.gestes').map((b) => b.libelle).join(' | ')}`)
  await capturer('3328-e1-2-exploration')
  const porte = zone(v, 'exploration.gestes').find((b) => b.jeu.suite?.some((a) => a.type === 'actionnerLaPorte'))
  assert.ok(porte, 'la porte fermée s’ouvre par un bouton')
  await cliquerBouton(bouton(porte))
  noter(`bouton « ${porte.libelle} » cliqué`)
  const reduit = { x: 4, y: 1 }
  await cliquerCase(reduit)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${reduit.x},${reduit.y}'`)
  noter(`clic sur la case ${reduit.x},${reduit.y} : le groupe y marche`)
  await capturer('3328-e1-3-reduit')
}

async function parcoursDialogue() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  let v = await vue()
  while (v.projection.fenetre) {
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
    v = await vue()
  }
  const pres = { x: 5, y: 4 }
  await cliquerCase(pres)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${pres.x},${pres.y}'`)
  v = await vue()
  const parler = zone(v, 'exploration.gestes').find((b) => b.jeu.suite?.some((a) => a.args?.[1] === 'parler'))
  assert.ok(parler, `à portée de Gustav, son offre « Parler » est un bouton : ${zone(v, 'exploration.gestes').map((b) => b.libelle).join(' | ')}`)
  noter(`clic sur la case ${pres.x},${pres.y} ; bouton « ${parler.libelle} »`)
  await capturer('3328-h1-1-a-portee')
  await cliquerBouton(bouton(parler))
  await attendreLaVue("v.zones['dialogue.reponses'].length > 0")
  v = await vue()
  noter(`${zone(v, 'dialogue.orateur')[0]?.texte} : ${zone(v, 'dialogue.replique')[0]?.texte} ; réponses ${zone(v, 'dialogue.reponses').map((b) => b.libelle).join(' | ')}`)
  await capturer('3328-h1-2-conversation')
  const orateur = zone(v, 'dialogue.orateur')[0]?.texte
  await cliquerBouton(bouton(zone(v, 'dialogue.reponses')[0]))
  await attendreLaVue(`v.zones['dialogue.orateur'][0]?.texte !== ${JSON.stringify(orateur)}`)
  v = await vue()
  noter(`réponse cliquée : ${zone(v, 'dialogue.orateur')[0]?.texte} prend la parole`)
  await capturer('3328-h1-3-interlocuteur-suivant')
}

async function parcoursDocument() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases', { timeoutMs: 120000 })
  let v = await vue()
  while (v.projection.fenetre) {
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
    v = await vue()
  }
  const pres = { x: 2, y: 2 }
  await cliquerCase(pres)
  await attendreLaVue(`v.projection.exploration?.groupe.join() === '${pres.x},${pres.y}'`)
  v = await vue()
  const parcourir = zone(v, 'exploration.gestes').find((b) => b.jeu.suite?.some((a) => a.args?.[1] === 'lire'))
  assert.ok(parcourir, `à portée de la liasse, son offre est un bouton : ${zone(v, 'exploration.gestes').map((b) => b.libelle).join(' | ')}`)
  await cliquerBouton(bouton(parcourir))
  await attendreLaVue("v.zones['dialogue.reponses'].length > 0")
  for (const debut of ['Chapitre 1', 'Lire']) {
    v = await vue()
    const reponse = zone(v, 'dialogue.reponses').find((b) => b.libelle.startsWith(debut))
    assert.ok(reponse, `la réponse « ${debut} » est un bouton : ${zone(v, 'dialogue.reponses').map((b) => b.libelle).join(' | ')}`)
    await cliquerBouton(bouton(reponse))
  }
  await attendreLaVue("v.zones['fenetre.corps'][0]?.id === 'lecture'")
  v = await vue()
  noter(`document « ${zone(v, 'fenetre.titre')[0]?.texte} » : ${zone(v, 'fenetre.corps')[0]?.texte.length} caractères`)
  await capturer('3328-i1-1-document')
  const refermer = zone(v, 'fenetre.gestes').find((b) => b.type === 'bouton')
  await cliquerBouton(bouton(refermer))
  await attendreLaVue("v.zones['dialogue.reponses'].length > 0 && !v.projection.fenetre")
  noter(`« ${refermer.libelle} » : la conversation revient à la liasse`)
  await capturer('3328-i1-2-referme')
}

async function parcoursFiche() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  let v = await vue()
  assert.equal(v.projection.fenetre, null, 'l’Entrée ferme la fenêtre du round')
  const [heros] = zone(v, 'groupe.heros')
  assert.ok(heros, 'chaque héros du groupe a son bouton')
  await cliquerBouton(bouton(heros))
  v = await vue()
  assert.equal(zone(v, 'fiche.heros')[0]?.nom, heros.libelle, 'son bouton ouvre la fiche du héros')
  noter(`bouton « ${heros.libelle} » : fiche ouverte ; ${zone(v, 'fiche.corps').map((p) => `${p.libelle} ${p.valeur}`).join(' · ')}`)
  await capturer('3328-fiche-1-caracteristiques')
  for (const [i, onglet] of ['competences', 'talents', 'possessions'].entries()) {
    await cliquerBouton({ element: `bouton/onglet/${onglet}` })
    v = await vue()
    assert.equal(zone(v, 'fiche.gestes').find((b) => b.presse)?.id, `onglet/${onglet}`, `l’onglet ${onglet} cliqué est ouvert`)
    noter(`onglet ${onglet} : ${zone(v, 'fiche.corps').length} entrées`)
    await capturer(`3328-fiche-${i + 2}-${onglet}`)
    if (onglet === 'talents') {
      const premier = trouver((await ecran()).boutons, { element: 'bouton/onglet/caracteristiques' })
      await survoler(session, { surface: 'canvas', x: premier.x, y: premier.y + 100 }, { attenteMs: 1500 })
      await capturer('3328-fiche-3b-talent-survole')
    }
  }
  await cliquerBouton({ element: 'bouton/fermer' })
  v = await vue()
  assert.deepEqual(zone(v, 'fiche.heros'), [], 'le bouton « Fermer » ferme la fiche')
  await capturer('3328-fiche-5-fermee')
}

async function parcoursInventaire() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  while (v.projection.fenetre) {
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
    v = await vue()
  }
  const heros = zone(v, 'groupe.heros').find((b) => b.libelle === 'Rosa Brandt')
  assert.ok(heros, 'Rosa Brandt a son bouton')
  await cliquerBouton(bouton(heros))
  await cliquerBouton({ element: 'bouton/onglet/possessions' })
  v = await vue()
  const possession = (libelle) => zone(v, 'fiche.corps').find((b) => b.libelle === libelle)
  await cliquerBouton(bouton(possession('Justaucorps de cuir')))
  await attendreLaVue(`v.zones['fiche.objet'][0]?.nom === 'Justaucorps de cuir'`)
  v = await vue()
  noter(`possession choisie : ${zone(v, 'fiche.objet')[0].elements.map((e) => e.libelle).join(' | ')}`)
  await capturer('3328-inventaire-1-armure-portee')
  await cliquerBouton({ element: 'bouton/porter' })
  await attendreLaVue(`v.zones['fiche.objet'][0]?.ton === 'neutre'`)
  noter('« Porter » pressé : l’armure ôtée')
  await capturer('3328-inventaire-2-armure-otee')
  v = await vue()
  await cliquerBouton(bouton(possession('Potion de guérison')))
  await attendreLaVue(`v.zones['fiche.objet'][0]?.nom === 'Potion de guérison'`)
  v = await vue()
  noter(`possession choisie : ${zone(v, 'fiche.objet')[0].elements.map((e) => e.libelle).join(' | ')}`)
  await capturer('3328-inventaire-3-consommable')
}

/** Le bouton de la vue d'id `id` dans la zone `z` pressé à l'écran, puis la vue que le pont rend. */
async function presser(z, id) {
  const v = await vue()
  const b = element(v, z, id)
  assert.ok(b, `bouton ${id} dans ${z} : ${zone(v, z).map((e) => e.id).join(', ')}`)
  await cliquerBouton(bouton(b))
  return vue()
}
/** La page ouverte de la création : son titre. */
const pageOuverte = (v) => zone(v, 'creation.titre')[0]?.texte

async function parcoursCreation() {
  await cliquerBouton('Combat')
  await waitFor(session, '!!globalThis.wfrpEcran?.cases && wfrpEcran.boutons.length > 0', { timeoutMs: 120000 })
  let v = await vue()
  while (v.projection.fenetre) {
    await marquer()
    await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await nouvelEcran()
    v = await vue()
  }
  const avant = zone(v, 'groupe.heros').length
  v = await presser('groupe.gestes', 'creation')
  assert.equal(pageOuverte(v), 'Race · 1/10', '« Nouveau héros » ouvre la création sur sa première page')
  assert.equal(zone(v, 'creation.corps').some((e) => e.type === 'jet'), false, 'avant le d100, aucun résultat')
  assert.equal(trouver((await ecran()).boutons, { element: 'bouton/suivante' }), undefined, 'la suivante refusée ne se joue pas')
  noter(`création ouverte : ${zone(v, 'creation.corps').map((e) => e.libelle).join(' · ')}`)
  await capturer('3328-creation-1-race')
  v = await presser('creation.corps', 'tirage')
  const d100 = element(v, 'creation.corps', 'tirage')
  assert.equal(d100.type, 'jet', 'le d100 tombé se dit')
  const espece = element(v, 'creation.corps', 'espece').libelle
  noter(`d100 ${d100.resultat} : ${espece}`)
  await capturer('3328-creation-2-race-tiree')
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
  v = await vue()
  assert.equal(pageOuverte(v), 'Carrière · 2/10', 'la race choisie, l’Entrée joue la suivante')
  v = await presser('creation.corps', 'tirage')
  const carriere = element(v, 'creation.corps', 'tirees').valeurs.find((b) => b.presse).libelle
  noter(`carrière tirée : ${carriere}`)
  await capturer('3328-creation-3-carriere-tiree')
  v = await presser('creation.gestes', 'suivante')
  assert.equal(pageOuverte(v), 'Caractéristiques · 3/10')
  v = await presser('creation.corps', 'tirage')
  const caracs = zone(v, 'creation.corps').filter((e) => e.type === 'puce' && e.id.startsWith('carac/'))
  assert.ok(caracs.length === 10 && caracs.every((p) => /^\d+$/.test(p.valeur)), 'les dix Caractéristiques tirées se disent')
  noter(`Caractéristiques : ${caracs.map((p) => `${p.libelle} ${p.valeur}`).join(' · ')}`)
  await capturer('3328-creation-4-caracteristiques')
  v = await presser('groupe.gestes', 'creation')
  assert.deepEqual(zone(v, 'creation.titre'), [], '« Nouveau héros » pressé ferme la création')
  assert.equal(zone(v, 'groupe.heros').length, avant, 'fermée, aucun héros ne rejoint le groupe')
}

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
/** Un cran de molette au point `ou`, vers le bas (`sens` 1) ou le haut (-1) : `true` si le défilement publié de l'atelier
 *  (`atelier.defilement`) change en `FIN_DE_COURSE_MS`, `false` sinon, au bout de course. Une publication sans défilement
 *  (chaque image d'un clip lu) ne compte pas. */
const FIN_DE_COURSE_MS = 3000
async function cran(sens, ou) {
  const avant = (await atelier()).defilement
  assert.equal(typeof avant, 'number', `l'atelier publie son défilement ; reçu ${JSON.stringify(avant)}`)
  await molette(session, { surface: 'canvas', x: ou.x, y: ou.y }, sens * CRAN_DE_MOLETTE)
  return waitFor(session, `(() => { const d = globalThis.wfrpEcran?.atelier?.defilement; return typeof d === 'number' && d !== ${avant} })()`, { timeoutMs: FIN_DE_COURSE_MS }).then(
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
/** Les articles de chaque liste déroulante de l'onglet courant, par clé, relevés du haut au bas du panneau ; le
 *  panneau revient en haut. */
async function listesDuPanneau() {
  await tournerJusquAuBout(-1)
  const listes = {}
  await tournerJusquAuBout(1, (boutons) => boutons.forEach((b) => b.cle && b.choix && (listes[b.cle] = b.choix)))
  await tournerJusquAuBout(-1)
  return listes
}
async function cliquerAmene(quoi, sens, ou) {
  await amener(quoi, sens, ou)
  await cliquerBouton(quoi)
}
/** L'article `texte` choisi dans la liste déroulante de clé `cle`, amenée à l'écran dans le sens `sens` : la liste
 *  ouverte au clic, puis l'article atteint au clavier, chaque flèche descendant d'un article depuis le haut, et retenu
 *  à l'Entrée. */
async function choisirDansLaListe(cle, texte, sens = 1) {
  const liste = await amener({ cle }, sens)
  const rang = liste.choix.indexOf(texte)
  assert.ok(rang >= 0, `« ${texte} » offert par la liste ${cle} : ${liste.choix.join(', ')}`)
  await geste(session, { surface: 'canvas', x: liste.x, y: liste.y }, { qui: `liste ${cle}` }, clic())
  await sleep(400)
  for (let n = 0; n <= rang; n++) await realKey(session, { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 })
  await marquer()
  await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await nouvelEcran()
}

/** Les appels de Godot au pont, comptés par méthode dans `recetteAppels` de la page : `wfrpPont.appeler` enveloppé, que
 *  `PontDuNoyau.appeler` (`projet/scripts/pont.gd`) relit sur `globalThis.wfrpPont` à chaque appel ; le tampon des
 *  mesures de ressources élargi pour que chaque requête y entre. */
const SONDER_LA_PAGE = `(() => {
  performance.setResourceTimingBufferSize(1e6)
  const pont = globalThis.wfrpPont, appeler = pont.appeler, n = (globalThis.recetteAppels = {})
  pont.appeler = function (methode, ...reste) { n[methode] = (n[methode] ?? 0) + 1; return appeler.call(this, methode, ...reste) }
  return true
})()`
/** Le nombre d'appels `methode` de Godot au pont depuis `SONDER_LA_PAGE`. */
const appels = (methode) => evaluate(session, `globalThis.recetteAppels[${JSON.stringify(methode)}] ?? 0`)
/** Le nombre de requêtes du GLB de l'élément `id` (`modeles/<id>.glb`) relevées par la page. */
const requetesDuGlb = (id) =>
  evaluate(session, `performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname.endsWith(${JSON.stringify(`/modeles/${id}.glb`)})).length`)
/** Les requêtes du GLB de `elementId` et les appels `composer` relevés. */
const releve = async (elementId) => ({ glb: await requetesDuGlb(elementId), composer: await appels('composer') })

/** L'emblème de libellé `texte` choisi dans la liste de la prise `main` (« Aucun » pour aucun), l'état publié qui le
 *  porte, ou une erreur, attendu ; aucune erreur publiée. L'id de l'emblème posé, `undefined` sous « Aucun ». */
async function choisirLEmbleme(texte) {
  await choisirDansLaListe('main/embleme', texte)
  await attendreLAtelier(`a.erreurs.length > 0 || ${texte === AUCUN ? '!("main" in a.emblemes)' : '"main" in a.emblemes'}`)
  const { erreurs, emblemes } = await atelier()
  assert.deepEqual(erreurs, [], `l’emblème « ${texte} » posé sans erreur`)
  return emblemes.main
}
/** À la prise `main`, où l'élément `elementId` monté porte une surface `blason` : la liste des emblèmes relevée, le
 *  premier puis le second posés et capturés, puis « Aucun » ; le premier reposé, ces quatre choix sans requête du GLB
 *  ni appel `composer`. Les libellés des emblèmes offerts. */
async function poserLesEmblemes(elementId) {
  await attendreLAtelier('b.some((x) => x.cle === "main/embleme")')
  assert.deepEqual((await atelier()).emblemes, {}, 'monté sans emblème')
  const offerts = (await listesDuPanneau())['main/embleme'].filter((texte) => texte !== AUCUN)
  assert.ok(offerts.length >= 2, `deux emblèmes offerts au moins : ${offerts.join(', ')}`)
  const [a, b] = offerts
  const avant = await releve(elementId)
  await choisirLEmbleme(a)
  noter(`emblème « ${a} » posé à la prise « main »`)
  await capturer('3111-1-embleme-a')
  const idB = await choisirLEmbleme(b)
  assert.deepEqual((await atelier()).emblemes, { main: idB }, 'le second emblème remplace le premier')
  noter(`emblème « ${b} » posé à sa place`)
  await capturer('3111-2-embleme-b')
  await choisirLEmbleme(AUCUN)
  noter('emblème « Aucun » : la surface rendue à son matériau')
  await choisirLEmbleme(a)
  const apres = await releve(elementId)
  const delta = { glb: apres.glb - avant.glb, composer: apres.composer - avant.composer }
  noter(`emblèmes « ${a} », « ${b} », « Aucun », « ${a} » : GLB de « ${elementId} » requis ${avant.glb} → ${apres.glb}, \`composer\` appelé ${avant.composer} → ${apres.composer}`)
  assert.deepEqual(delta, { glb: 0, composer: 0 }, 'un changement d’emblème seul ne recharge pas le GLB et ne compose pas')
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
  await cliquerBouton('Outils')
  await cliquerAmene(base, 1)
  let a = await atelier()
  assert.deepEqual([a.base, a.empreinte, a.erreurs], [base, p0.model_sha256, []], 'la base choisie, à l’empreinte de son import, sans erreur')
  await cliquerBouton('Équipement')
  assert.deepEqual((await ecran()).boutons.filter((b) => b.cle), [], 'sans élément indexé, aucun emplacement n’a de liste')
  noter(`base « ${base} » choisie, empreinte ${a.empreinte.slice(0, 12)} ; aucun emplacement à l’onglet Équipement`)
  await capturer('3086-a1-1-base-sans-element')

  importer(o.element, elementId)
  await evaluate(session, SONDER_LA_PAGE)
  await cliquerBouton('Outils')
  await cliquerAmene(RECHARGER, 1)
  await cliquerBouton('Équipement')
  await attendreLAtelier('b.some((x) => x.cle === "main")')
  const { osDesRigides } = await (await fetch(`${srv.url}modeles/`)).json()
  const porteurs = Object.entries({ ...p0.manifeste.emplacements, ...p0.manifeste.prises }).filter(([, attache]) => osDesRigides[elementId].includes(attache.os)).map(([point]) => point)
  const listages = await appels('modeles')
  assert.ok(listages > 0, 'témoin : l’appel `modeles` de Godot au pont relevé par l’enveloppe')
  assert.ok(porteurs.includes('main'), `l’os de la prise « main » porte la lame (${osDesRigides[elementId].join(', ')})`)
  const listes = await listesDuPanneau()
  const libelle = listes.main[1]
  const desPoints = Object.fromEntries(Object.entries(listes).filter(([cle]) => !cle.includes('/')))
  assert.deepEqual(desPoints, tableTotale(porteurs, () => [AUCUN, libelle]), `« ${elementId} » offert aux seuls points de l’os qui porte la lame`)
  noter(`« ${RECHARGER} » : « ${elementId} » (« ${libelle} ») offert aux points ${porteurs.join(', ')} (os ${osDesRigides[elementId].join(', ')}) ; les autres n’ont pas de rangée`)
  await cliquerBouton('Outils')
  for (const aide of ['Os', 'Prises']) await cliquerAmene(aide, 1)
  a = await atelier()
  assert.deepEqual(a.aides, { os: true, emplacements: false, prises: true }, 'les aides cochées sont montrées')

  await cliquerBouton('Équipement')
  const avantLeMontage = await requetesDuGlb(elementId)
  await choisirDansLaListe('main', libelle)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  const auMontage = await requetesDuGlb(elementId)
  assert.ok(auMontage > avantLeMontage, `témoin : le GLB de « ${elementId} » requis au montage relevé par la page (${avantLeMontage} → ${auMontage})`)
  noter(`« ${elementId} » monté à la prise « main » ; témoins : GLB requis ${avantLeMontage} → ${auMontage}, \`modeles\` appelé ${listages} fois`)
  await capturer('3086-a1-2-element-monte')
  const blason = element.manifeste.surfaces.some((s) => s.blason === true)
  if (!blason) noter(`« ${elementId} » sans surface \`blason\` : preuve des emblèmes non jouée`)
  const emblemes = blason ? await poserLesEmblemes(elementId) : []
  await choisirDansLaListe('main', AUCUN, -1)
  await attendreLAtelier('!("main" in a.montes)')
  assert.deepEqual((await atelier()).emblemes, {}, 'démonter efface l’emblème')
  noter('« Aucun » : la prise « main » démontée, sans emblème')
  await choisirDansLaListe('main', libelle, -1)
  await attendreLAtelier(`a.montes.main === ${JSON.stringify(elementId)}`)
  if (emblemes.length) {
    await attendreLAtelier('b.some((x) => x.cle === "main/embleme")')
    assert.deepEqual((await atelier()).emblemes, {}, 'remonté sans emblème')
    noter(`« ${elementId} » remonté sans emblème`)
    await choisirLEmbleme(emblemes[0])
    noter(`« ${emblemes[0]} » reposé avant « ${RECHARGER} »`)
  }

  await cliquerBouton('Animation')
  await choisirDansLaListe('clip', o.clip)
  await attendreLAtelier(`a.clip === ${JSON.stringify(o.clip)} && a.lecture`)
  await cliquerAmene('Pause', 1)
  await attendreLAtelier('a.lecture === false')
  a = await atelier()
  assert.deepEqual([a.clip, a.lecture], [o.clip, false], 'la pause arrête le clip')
  const { instant: enPause, duree } = a
  const ecart = (depart, arrivee) => (((arrivee - depart) % duree) + duree) % duree
  await cliquerAmene('Image suivante', 1)
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
  await cliquerAmene('×0.5', 1)
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
  await cliquerBouton('Outils')
  await cliquerAmene(RECHARGER, -1)
  await attendreLAtelier(`a.empreinte === ${JSON.stringify(p1.model_sha256)} && a.montes.main === ${JSON.stringify(elementId)} && a.clip !== null`, 120000)
  const apres = await atelier()
  assert.equal(await evaluate(session, 'globalThis.recetteSansRelance === true'), true, 'la page n’a pas été relancée')
  assert.ok(Math.abs(apres.instant - avant.instant) < 1e-6, `l’instant gardé : ${avant.instant} → ${apres.instant}`)
  const etat = ({ base: b, clip, lecture, vitesse, montes, emblemes: e, aides, erreurs }) => ({ b, clip, lecture, vitesse, montes, e, aides, erreurs })
  assert.deepEqual(etat(apres), etat(avant), 'clip, pause, vitesse, montés, emblèmes, aides gardés')
  noter(`« ${RECHARGER} » sans relance : empreinte ${avant.empreinte.slice(0, 12)} → ${apres.empreinte.slice(0, 12)} ; ${apres.clip} à ${apres.instant} s en pause, ×${apres.vitesse}, montés ${JSON.stringify(apres.montes)}, emblèmes ${JSON.stringify(apres.emblemes)}, aides ${JSON.stringify(apres.aides)}`)
  await capturer('3086-a1-4-reexport-recharge')
}

const proche = (a, b, tolerance, quoi) => assert.ok(Math.abs(a - b) <= tolerance, `${quoi} : ${a} contre ${b} (tolérance ${tolerance})`)
const horizontal = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2])

async function choisirAxe(catalogues, champ, id) {
  const axe = catalogues.axes.find((x) => x.champ === champ)
  assert.ok(axe && axe.forme !== 'plage', `sélecteur ${champ} publié`)
  const offert = id === null ? undefined : catalogues[axe.liste].find((x) => x.id === id)
  assert.ok(id === null || offert, `${id} offert sur ${champ}`)
  await choisirDansLaListe(`axe/${champ}`, offert?.label ?? AUCUN, -1)
  const courante = (await atelier()).composition.courante[champ]
  assert.equal(courante?.id ?? courante ?? null, id, `axe ${champ} choisi au clavier`)
}

/** À l'onglet Couleurs, l'emplacement de palette de la première surface de la pièce `piece` montée à la ligne `ligne`
 *  coloré de la dernière couleur du nuancier : la composition courante le porte et le matériau de cette surface la prend
 *  (`couleurs` de l'atelier publié) ; puis « Par défaut » l'en retire et rend à la surface le matériau du GLB. */
async function colorerLaPiece(catalogues, ligne, piece) {
  const { nom, palette } = piece.manifeste.surfaces[0]
  const couleur = catalogues.nuancier.at(-1)
  const emplacement = `ligne/${ligne}`
  await cliquerBouton('Couleurs')
  await choisirDansLaListe(`couleur/${palette}`, couleur.label)
  await attendreLAtelier(`a.couleurs[${JSON.stringify(emplacement)}]?.[${JSON.stringify(nom)}] === ${JSON.stringify(couleur.couleur)}`)
  let a = await atelier()
  assert.deepEqual([a.composition.courante.couleurs[palette], a.composition.palette[palette], a.erreurs], [{ id: couleur.id }, couleur.couleur, []], `couleur « ${couleur.label} » posée à « ${palette} »`)
  noter(`« ${couleur.label} » à « ${palette} » : la surface « ${nom} » de « ${ligne} » en ${couleur.couleur}`)
  await capturer('3086-r1-1c-couleur')
  await choisirDansLaListe(`couleur/${palette}`, PAR_DEFAUT, -1)
  await attendreLAtelier(`a.couleurs[${JSON.stringify(emplacement)}]?.[${JSON.stringify(nom)}] === undefined`)
  a = await atelier()
  assert.ok(!(palette in (a.composition.courante.couleurs ?? {})), `« ${PAR_DEFAUT} » retire « ${palette} » de la composition`)
  noter(`« ${PAR_DEFAUT} » à « ${palette} » : la surface « ${nom} » rendue au matériau du GLB`)
}

const OS_DU_TORSE = ['spine_01', 'spine_02', 'spine_03', 'clavicle_l', 'clavicle_r']
// Quatre poses distinctes vérifient le gabarit pendant le clip courtaud.
const POSES_COURTAUDES_DISTINCTES_MINIMALES = 4
// Huit images donnent plusieurs observations du gabarit courtaud.
const IMAGES_COURTAUDES = 8
// Trois secondes laissent publier les huit images du clip courtaud.
const DELAI_COURTAUD_MS = 3000

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

async function verifierLeCouplage(images, racine, manifeste, assets, reposLocal, reposMonde) {
  assert.ok(images.length > 1, 'plusieurs publications de marche')
  const premier = images[0], dernier = images.at(-1), clip = premier.clip
  proche(premier.vitesse, 2, 1e-6, 'fenêtre de couplage au cran ×2')
  const vitesse = manifeste.appuis.vitessesAuSol[clip]
  assert.ok(Number.isFinite(vitesse) && vitesse > 0, 'vitesse au sol déclarée pour le clip joué')
  const fiche = await assets.evaluer({ base: readFileSync(join(o.base, production(o.base).model)), manifeste, clips: [clip] })
  const appuis = fiche.mesures.clips[0].appuis
  assert.ok(appuis?.pieds.length && appuis.pieds.every((p) => p.duree > 0), 'durées d’appui mesurées sur la base')
  const dureeDAppui = Math.max(...appuis.pieds.map((p) => p.duree))
  const glissementMax = Math.max(...appuis.pieds.map((p) => p.glissementMax))
  // glissement total ≤ glissementMax + écart de vitesse × durée ; tolérance = (SOL_TOLERANCE_M − glissementMax) / durée maximale.
  const tolerance = (assets.SOL_TOLERANCE_M - glissementMax) / dureeDAppui
  assert.ok(tolerance > 0, 'budget de glissement disponible pour le couplage')
  const lateral = (os) => {
    const a = os.clavicle_l, b = os.clavicle_r, norme = horizontal(a, b)
    assert.ok(norme > 0, 'repère latéral au repos pour le lacet de la racine')
    return [(b[0] - a[0]) / norme, (b[2] - a[2]) / norme]
  }
  const local = lateral(reposLocal), monde = lateral(reposMonde)
  const cos = local[0] * monde[0] + local[1] * monde[1]
  const sin = local[0] * monde[1] - local[1] * monde[0]
  const direction = [cos * appuis.direction[0] - sin * appuis.direction[1], sin * appuis.direction[0] + cos * appuis.direction[1]]
  const attendue = vitesse
  const intervalles = []
  let tempsDeClip = 0
  for (let i = 1; i < images.length; i++) {
    const a = images[i - 1], b = images[i]
    assert.equal(b.clip, clip, 'même clip pendant la fenêtre de couplage')
    assert.equal(b.duree, premier.duree, 'longueur de clip constante')
    proche(b.vitesse, premier.vitesse, 1e-6, 'cran de vitesse constant')
    proche(b.gabarit.image.echelle, premier.gabarit.image.echelle, 1e-6, 'échelle constante')
    const dt = (b.instant - a.instant + b.duree) % b.duree
    assert.ok(dt > 0, 'intervalle de temps de clip positif')
    const dx = b.os[racine][0] - a.os[racine][0], dz = b.os[racine][2] - a.os[racine][2]
    const distance = Math.hypot(dx, dz)
    const mesuree = distance / dt
    intervalles.push({ mesuree, rapport: mesuree / attendue, cosinusSigne: (dx * direction[0] + dz * direction[1]) / distance })
    tempsDeClip += dt
  }
  assert.ok(tempsDeClip >= premier.duree * 8, 'fenêtre de couplage de huit cycles de marche')
  const mesuree = horizontal(premier.os[racine], dernier.os[racine]) / tempsDeClip
  const rapportMaximal = Math.max(...intervalles.map((p) => p.rapport))
  const rapportBudgetMaximal = Math.max(...intervalles.map((p) => Math.abs(p.mesuree - attendue) / tolerance))
  const cosinusSigne = Math.min(...intervalles.map((p) => p.cosinusSigne))
  const imagesParSeconde = (images.length - 1) * 1000 / (dernier.observeeA - premier.observeeA)
  const mesure = { clip, cran: premier.vitesse, mesuree, rapportMaximal, rapportBudgetMaximal, attendue, tolerance, cosinusSigne, direction, glissementMax, dureeDAppui, tempsDeClip, cycles: tempsDeClip / premier.duree, images: images.length, imagesParSeconde }
  noter('couplage racine/clip : ' + JSON.stringify(mesure))
  writeFileSync(join(o.captures, 'couplage.json'), JSON.stringify(mesure, null, 2))
  proche(mesuree, attendue, tolerance, 'couplage racine/clip en m/s de temps de clip')
  assert.ok(rapportBudgetMaximal <= 1, `couplage par intervalle : rapport maximal au budget de glissement ${rapportBudgetMaximal}`)
  assert.ok(cosinusSigne >= 1 - 1e-4, `sens de marche porté par le lacet de la racine : cosinus signé ${cosinusSigne}`)
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
    "export { FEMININ, CORPULENCE } from '/hotes/godot/asset/silhouettes.ts';",
    "export { evaluer } from '/hotes/godot/asset/evaluateur/evaluer.ts';",
    "export { SOL_TOLERANCE_M } from '/hotes/godot/asset/evaluateur/gardes/piedsAuSol.ts';",
  ])
  const { schemaDesPresets, validateDocument, FEMININ, CORPULENCE } = assets
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
  await cliquerBouton('Outils')
  await cliquerBouton(base)
  const reposDeLaBase = await atelier()
  assert.deepEqual([reposDeLaBase.empreinte, reposDeLaBase.erreurs], [p.model_sha256, []])
  assert.deepEqual([reposDeLaBase.clip, reposDeLaBase.lecture], [null, false], 'référence native de la base sans clip engagé')
  assert.deepEqual(Object.keys(reposDeLaBase.os).sort(), [...p.manifeste.os].sort(), 'tous les os natifs de la base sont présents dans la référence')
  await cliquerBouton('Personnage')
  const catalogues = JSON.parse(await evaluate(session, "wfrpPont.appeler('catalogues')"))
  assert.equal((await atelier()).composition.copie, '', 'avant Copier : aucune entrée copiée')
  const plageInitiale = catalogues.axes.find((x) => x.forme === 'plage')
  await cliquerAmene({ cle: `axe/${plageInitiale.champ}/neutre` }, 1)
  await attendreLAtelier('a.composition.refus !== null')
  await cliquerAmene(COPIER, 1)
  await attendreLAtelier('a.erreurs.some((x) => x.includes("presetDeComposition"))')
  assert.equal((await atelier()).composition.copie, '', 'Copier refusé : aucune entrée copiée')
  noter('Copier avant toute copie et après refus : entrée vide')
  await cliquerAmene('Soldat', -1)
  await attendreLAtelier('a.composition.preset === "soldat" && a.composition.manquants.length > 0')
  let a = await atelier()
  assert.equal(a.composition.refus, null)
  assert.equal(a.composition.courante.sex, 'F', 'Soldat féminin')
  verifierLeMorphe(a, FEMININ, 1)
  assert.deepEqual(a.erreurs, [])
  assert.ok(a.composition.montes.length > 0, 'emplacements de composition publiés')
  assert.ok(a.composition.manquants.every((m) => m.ligne && m.id && m.label), 'manquants identifiés et libellés')
  for (const axe of catalogues.axes.filter((x) => x.forme === 'plage')) {
    await amener({ cle: `axe/${axe.champ}/neutre` }, 1)
    assert.ok((await atelier()).plages[axe.champ], `plage ${axe.champ} publiée`)
  }
  noter(`Soldat : ${JSON.stringify(a.composition)}`)
  await amener(COPIER, 1)
  await capturer('3086-r1-1-soldat-manquants')
  await cliquerAmene(COPIER, 1)
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
  await cliquerBouton('Outils')
  await cliquerAmene(RECHARGER, -1)
  await cliquerBouton('Équipement')
  const cle = { cle: `ligne/${ligne}` }
  await cliquerAmene(cle, 1)
  await attendreLAtelier(`a.lignes[${JSON.stringify(ligne)}] === ${JSON.stringify(pieceId)}`, 120000)
  await cliquerAmene(cle, 1)
  await attendreLAtelier(`!(${JSON.stringify(ligne)} in a.lignes)`)
  assert.ok(!(`ligne/${ligne}` in (await atelier()).peaux), 'démontée : sa peau retirée')
  await cliquerBouton(cle)
  await attendreLAtelier(`a.lignes[${JSON.stringify(ligne)}] === ${JSON.stringify(pieceId)}`)
  await colorerLaPiece(catalogues, ligne, piece)
  await cliquerBouton('Personnage')
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
  await cliquerBouton('Animation')
  await choisirDansLaListe('clip', 'A_TPose')
  await attendreLAtelier('a.clip === "A_TPose" && a.lecture')
  await cliquerAmene('Pause', 1)
  await attendreLAtelier('a.lecture === false')
  await cliquerBouton('Personnage')
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
    const attendu = a.composition.morphes[CORPULENCE]
    assert.ok(Number.isFinite(attendu), 'poids corpulence retourné par composer')
    if (bord === 'droite') assert.ok(attendu > 0, 'corpulence non nulle à droite')
    verifierLeMorphe(a, CORPULENCE, attendu)
    verifierLeMorphe(a, CORPULENCE, attendu, `ligne/${ligne}`)
    verifierLeMorphe(a, FEMININ, 1)
    await capturer(`3086-r1-3-corpulence-${valeur}`)
  }

  await choisirAxe(catalogues, 'gabarit', null)
  await cliquerAmene({ cle: 'axe/build/neutre' }, 1)
  await choisirAxe(catalogues, 'sex', 'M')
  await cliquerBouton('Animation')
  await cliquerAmene('×2', 1)
  proche((await atelier()).vitesse, 2, 1e-4, 'marche au cran ×2')
  // #3104 — vérification du couplage limitée au corps neutre.
  const repos = await atelier()
  proche(repos.cadre, 1, 1e-4, 'marche au corps neutre')
  const poidsNeutres = Object.values(repos.composition.morphes)
  assert.ok(poidsNeutres.length > 0 && poidsNeutres.every((poids) => poids === 0), 'couplage : tous les poids de silhouette sont nuls')
  verifierLeMorphe(repos, FEMININ, 0)
  const racine = p.manifeste.gabarit.racine
  const images = []
  try {
    await realKeyDown(session, touche)
    await attendreLAtelier('a.lecture === true')
    images.push(...JSON.parse(await evaluate(session, `(async () => {
      const images = [], debut = performance.now(); let precedent, temps = 0;
      while (performance.now() - debut < 14000) {
        await new Promise(requestAnimationFrame);
        const e = globalThis.wfrpEcran;
        if (e === precedent || !e?.atelier?.lecture) continue;
        precedent = e;
        const a = e.atelier;
        if (images.length) temps += (a.instant - images.at(-1).instant + a.duree) % a.duree;
        images.push({ ...a, observeeA: performance.now() });
        if (temps >= a.duree * 8) break;
      }
      return JSON.stringify(images);
    })()`)))
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
  noter(`marche : ${images.length} poses, instants ${JSON.stringify(images.map((x) => x.instant))}`)
  await verifierLeCouplage(images, racine, p.manifeste, assets, reposDeLaBase.os, arret.os)
  assert.deepEqual(arret.erreurs, [], 'marche et arrêt sans erreur')
}

const PARCOURS = { combat: parcoursCombat, critique: parcoursCritique, fin: parcoursFin, dialogue: parcoursDialogue, document: parcoursDocument, exploration: parcoursExploration, fiche: parcoursFiche, inventaire: parcoursInventaire, creation: parcoursCreation, atelier: parcoursAtelier, composition: parcoursComposition }
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
