import { useGame, SCREENS } from './store';
import type { AreteUtilisable } from './aretes';

/** Ce que la SONDE DE PICKING du rendu rend (`gameIso/stage/pickProbe`) : le verdict que le picking
 *  résoudrait sous un pixel CLIENT — case d'ANCRAGE, nature de ce qui est frappé, combattant, et voie
 *  qui a tranché — PLUS `geste`, ce qu'un clic à ce pixel traiterait vraiment
 *  (`gameIso/stage/geste.ts`, la fonction que le hook de pointeur appelle) : sans lui, la sonde
 *  rapportait `nature:'case'` sur un PNJ dont le clic ouvre le dialogue. La forme est ÉCRITE ici et
 *  non importée de `gameIso/stage/pickResolve.ts` : la
 *  frontière `src/state ↛ src/gameIso` ne connaît aucune exception, pas même un `import type`
 *  (`state/frontiere-state-gameiso.test.ts`). Ce qui empêche les deux formes de dériver est un test de
 *  CONFORMITÉ qui vit du côté autorisé à voir les deux (`gameIso/stage/pick-parity.test.tsx`). */
export type PickProbe = (px: { x: number; y: number }) => ({
  tile: { x: number; y: number; z: number } | null;
  cid: string | null;
  via: 'arete' | 'sprite' | 'decor' | 'meuble' | 'pas-etage' | 'sol' | 'aucune';
  /** L'entité que le GESTE servirait sous ce verdict (dialogue, marchand, place à s'asseoir…) ;
   *  `entId` absent = le clic ne traite aucune entité. */
  geste: { entId?: string };
} & (
  | { nature: 'case' }
  | { nature: 'combattant' }
  | { nature: 'entite'; entId: string }
  | { nature: 'arete'; arete: AreteUtilisable }
)) | null;

let sondeDePicking: PickProbe | null = null;

/** Le RENDU déclare sa sonde à l'outillage de recette (jamais l'inverse : `src/state` ne va pas
 *  chercher `src/gameIso`, règle 3). Appelée à l'import de `gameIso/stage/pickProbe`. */
export function setPickProbe(p: PickProbe | null): void {
  sondeDePicking = p;
}
import { portRepairVessel, portCareenVessel, portInstallUpgrade, damageVesselHull, setVesselHull } from './seaVoyageFlow';
import { seaBoardEventById } from '../engine/seaVoyage';
import { beginShipwreck } from './shipwreck';
import { placeOfScene, placeById, routesEtat, visiblePlaces, documentDeProjet, MAISON_PROJET_AUTHORE, type MapRoute, type WorldMap } from './worldMap';
import { buildRiverDayCascade } from './riverVoyageFlow';
import { findVehicleById } from '../data';
import { estAbsent } from './terrain';
import { sceneToAscii } from './sceneToAscii';
import { FOND_ECRIT } from '../data/schemas/grammaire/carte-ascii';
import { startCascade } from './cascade';
import { routeDistanceLabel } from '../engine/travel';
import { actorIn, inBattleId } from './combatants';
import { checkBattleOver, resolveFreeAttacks, approachFearTrigger, aiTurnLog, clearAiTurnLog, maybeRunEnemyTurn, applyEffects, applyHullCriticalToTarget } from './combatFlow';
import { shipHitLocation } from '../engine/combat';
import { setAiTrace } from './ai';
import { viewYawDeg } from './stageYaw';
import { gearFromEffects, nePeutPasDifferer } from './combatEffects';
import { pushChoice } from './rollSeam';
import { trappings, findCreatureById, findTraitById } from '../data';
import { creatureToCombatant } from './spawn';
import type { PendingBladeTrap } from './pendings';
import { bus, EVT } from './bus';
import { ev } from './combatLog';
import { isOutOfAction, addCondition, syncDerivedConditions } from '../engine/conditions';
import { contractDisease, tickDisease } from '../engine/disease';
import { battleRng } from './battleRng';
import { applyOps } from '../engine/ops';
import { acquerirTalent } from '../engine/careerSlots';
import { grantTrait } from '../engine/grantedTraits';
import { parseQualityInstance } from '../engine/qualities/normalize';
import { formatImperial } from '../engine/clock';
import { testScenarios, type TestScenario } from '../scenes/test-scenarios';
import { builtinCampaigns, allBuiltinCampaigns, campagneDuJeu } from '../scenes/campaign';
import { projectsLoad, projectSave, type SavedProject } from './projectLibrary';
import { emptyNarratif } from './campaignNarratif';
import { makeShowcaseParty } from '../data/pregens';
import { hoverTargeting } from './targeting';
import { maneuverShip } from './shipManeuver';
import { etageActif, getViewZ, setViewZ } from './viewLevel';
import { setRevealAll, computeStateVisible } from './visionState';
import { doorIsOpen, emptyScene } from './scene';
import { rule, setRule, ruleDef, OPTIONAL_RULES, type RuleValue } from '../engine/policy';
import { houseRulesMutability, resetHouseRule } from './houseRules';
import { cadence } from '../engine/cadence';
import { PREFERENCES, preferenceDef, setPreference, resetPreference, type PrefValue } from './preferences';
import { pickActiveModalKey, autoPolicyOf } from './modalArbiter';
import { willAutoResolve } from './combatAuto';
import { aiDriven, combatAdvanceBlocked } from './combatGate';
import type { Combatant } from '../engine/types';
import { makeRNG } from '../engine/dice';
import { partyMoneyTotal, creditBourse, distributeCredit, condCtx } from './bourseFlow';
import { t } from '../i18n';
import { diamondCorners, type Dims } from '../geometry/iso';
import { chebyshev } from '../engine/grid';
import { actionsDe } from './usable';
import { attendreEntreeEnScene, EntreeEnSceneNonAtteinte } from './entreeEnScene';
import { scheduleFlowTimer } from './combatTimers';
import { editeur, type CommandesEditeur } from './editeurBridge';

/** Trace du DERNIER Test résolu (`resolveTest`, `EVT.TEST_RESOLVED`) — observation pure pour la
 *  recette navigateur (`__wfrp.lastRoll()`), JAMAIS dans l'état de jeu persisté (module DEV seul,
 *  chargé dynamiquement, #514). Abonnement au scope module = une SEULE souscription (`installDevtools`
 *  n'est appelé qu'une fois, `main.tsx`). */
let lastRollTrace: { actorId: string; success: boolean; sl: number; roll: number | null; target: number } | null = null;
bus.on(EVT.TEST_RESOLVED, (payload) => { lastRollTrace = payload as typeof lastRollTrace; });

/** Routes qui portent un tracé de HIT au DOM de la carte du monde, dans le MÊME ORDRE et sous les
 *  MÊMES prédicats que le rendu (`WorldMapView.tsx` — extrémités dans `visiblePlaces`, route offerte
 *  par `routesEtat` depuis le lieu courant, ouverte OU fermée-consultable). SOURCE UNIQUE du mapping
 *  DOM ↔ id, partagée par `routes()` et `clickRoute()` : sans elle, une route partant vers un lieu
 *  caché décale l'index et `clickRoute` clique une AUTRE route que celle nommée (#684). */
function routesRendues(map: WorldMap, sceneId: string | undefined): { route: MapRoute; ouverte: boolean }[] {
  const here = placeOfScene(map, sceneId);
  if (!here) return [];
  const ctx = condCtx(useGame.getState);
  const visibles = new Set(visiblePlaces(map, ctx).map((p) => p.id));
  const etats = routesEtat(map, here.id, ctx);
  return map.routes.flatMap((r) => {
    const e = etats.find((x) => x.route.id === r.id);
    return e && visibles.has(r.a) && visibles.has(r.b) ? [e] : [];
  });
}

/**
 * Outils de recette navigateur (DEV uniquement) — exposés sur `window.__wfrp`.
 *
 * But (demande utilisateur 2026-06-11) : piloter le jeu et CARTOGRAPHIER la scène depuis
 * Playwright SANS chasser les coordonnées pixel des tokens. Depuis une recette :
 *   __wfrp.state()        → instantané lisible (écran, dialogue, combat, position du groupe)
 *   __wfrp.entities()     → liste des entités de la scène + leur mode d'accès
 *   __wfrp.routes()       → liste les routes CLIQUABLES de la carte du monde courante (id/from/to/
 *                           distanceLabel) — cibler `clickRoute(id)` sans deviner parmi des chips ambigus
 *   __wfrp.screenPos('id') → bounding box ÉCRAN du token (combat ET exploration, `data-cid`) — LECTURE
 *                           seule (`getBoundingClientRect`), `null` si absent du DOM
 *   __wfrp.tileScreenPos({x,y,z?}) → même bounding box ÉCRAN pour une CASE (vide comprise), là où
 *                           `screenPos` exige un token `data-cid` — viser un déplacement au clic réel
 *   __wfrp.pickTileAt({x,y}) → l'INVERSE : ce que le PICKING RÉEL résoudrait sous ce pixel écran
 *                           ({tile, cid, via:'sprite'|'decor'|'meuble'|'pas-etage'|'sol'|'aucune',
 *                           nature, geste:{entId?}} — `geste.entId` = l'entité qu'un clic traiterait)
 *                           — lecture seule, aucun clic
 *   __wfrp.talk('id')     → téléporte le groupe à côté de l'entité et l'interpelle (dialogue/marchand)
 *   __wfrp.goto('id')     → place le groupe sur la case de l'entité (déclenche portes/triggers au pas)
 *   __wfrp.screen('menu') → navigue vers un écran
 *   __wfrp.scenario('id', seed?) → lance un scénario de test PRÊT À JOUER (sans menu, Round 1 acquitté,
 *                           initiative déterministe si seed) ; sans arg : liste les ids
 *   __wfrp.campaign('id', seed?, sceneId?) → charge une CAMPAGNE BUILT-IN (`builtinCampaigns`,
 *                           `scenes/campaign.ts`) SANS dérouler le character creator ×4 à la main :
 *                           groupe canonique (`makeShowcaseParty`, MÊME 4 piliers que l'Arène — les
 *                           campagnes built-in ne portent pas leurs propres pré-tirés, seul le picker
 *                           `PartyScreen` propose `pregens.json` en libre-service), `setPendingCampaign` +
 *                           `loadProject` (MÊME chemin que le picker `CampaignSelect`), écran 'campaign'.
 *                           `sceneId` (optionnel) démarre ailleurs qu'à l'entrée par défaut de la
 *                           campagne. `seed` (optionnel) ré-ensemence le RNG de bataille AVANT le
 *                           chargement (déterminisme des rencontres). Sans arg : liste les ids.
 *   __wfrp.hover('id')    → survol PROGRAMMATIQUE (tooltip + réticule de visée, sans souris) ; null efface
 *   __wfrp.aim('id')      → vérité state du ciblage (ok/invalid + raison, compétence, dégâts)
 *   __wfrp.pad('A'|'B'|…) → simule un BOUTON de manette (Playwright n'a pas l'API Gamepad) — MÊME chemin
 *                           que le pad réel ; __wfrp.padDir('up'|'down'|'left'|'right') → croix/stick
 *   __wfrp.battle()       → snapshot combat (round, actif, modales, combattants en une ligne chacun)
 *   __wfrp.lastRoll()     → DERNIER Test résolu {actorId,success,sl,roll,target} (observation pure,
 *                           lecture seule, `null` si aucun depuis le chargement) — jamais une regex sur `innerText`
 *   __wfrp.log(n)         → queue lisible des journaux (exploration + feed de combat)
 *   __wfrp.aiLog(n)       → DIAGNOSTIC IA : action choisie + classement des candidats (intention) par tour
 *   __wfrp.turn('id')     → TRICHE : donne le tour à un combattant ; __wfrp.place('id',{x,y}) → téléporte
 *   __wfrp.turnShip('id', 'tribord'|'babord'|crans) → vire le cap d'un NAVIRE (manœuvre) → re-mappe ses bordées
 *   __wfrp.modal()        → modale(s) ouvertes ; __wfrp.roll()/confirm()/cancel() → pilote LA modale
 *                           (convention <flux>Roll/Confirm/Cancel ; reveals/Round ont leur verbe propre)
 *   __wfrp.killEnemies()  → élimine tous les ennemis du combat et déclenche la victoire (flux normal) ;
 *                           killEnemies({withQualityLoot:true}) → ajoute au butin un objet catalogué à qualités
 *   __wfrp.interlude()    → arme un INTERLUDE de démo jouable (startInterlude — sans voyager jusqu'à Altdorf)
 *   __wfrp.dealDamage('id', n) → inflige n Dégâts (op wounds, VRAI pipeline : armure de coque, reddition/naufrage)
 *   __wfrp.combatEnd({…}) → arme les conséquences de fin de combat (critique infectant + exposition
 *                           Corruption) puis termine le combat en LAISSANT la cascade ouverte (influençable)
 *   __wfrp.healParty()    → groupe à neuf (PB max, états/critiques/maladies purgés)
 *   __wfrp.give(co)       → crédite la bourse (couronnes d'or) ; __wfrp.xp(n) → +PX au groupe
 *   __wfrp.giveTrapping(heroId, trappingId, qty?) → donne un objet de catalogue à un héros (VRAI
 *                           pipeline giveTrapping : item bien formé, qualités comprises)
 *   __wfrp.disease(heroId, maladieId, { phase? }) → contracte une maladie via le VRAI cycle
 *                           (contractDisease + tickDisease de l'incubation) ; `phase:'active'` la déclare
 *                           en avançant son horloge (jamais un état forgé)
 *   __wfrp.flags()        → drapeaux de scénario ; __wfrp.flag('id', true) → force un drapeau
 *   __wfrp.go('scene-id') → saute vers une scène du projet ; __wfrp.fight() → liste/lance une rencontre
 *   __wfrp.fear(h,e,i?)   → pose une Peur (Indice) de h envers e puis simule l'approche (Test de Calme ou Brisé)
 *   __wfrp.time(min)      → avance l'horloge ; __wfrp.rest(jours) → dort (cascade quotidienne #T3)
 *   __wfrp.quality(id,label,av?) → ajoute un Atout d'arme à l'arme active + Avantages (test renversement…)
 *   __wfrp.seed(n)        → ré-ensemence le RNG de bataille (déterminisme, EN COURS de combat)
 *   __wfrp.previewRoll(seed, count?) → lecture PURE (`makeRNG(seed)` À PART, ZÉRO mutation) des
 *                           `count` premiers d100 d'un seed — fidèle au prochain jet réel UNIQUEMENT
 *                           juste après un `seed(n)`/`scenario(id, seed)` frais (battleRng PARTAGÉ)
 *   __wfrp.fastForward(n?) → avance les tours IA (BORNÉ à `n` scrutations) jusqu'au prochain tour d'un
 *                           combattant piloté HUMAIN ou la fin du combat — MÊME machinerie (advanceTurn/
 *                           maybeRunEnemyTurn), juste sans les délais de lisibilité (chorégraphie)
 *   __wfrp.advanceSeaDay() → symétrique VOYAGE de `fastForward` : pilote la journée en mer EN COURS
 *                           (cascade du jour, halte de nuit, Activités hebdo…) jusqu'au jour SUIVANT,
 *                           l'arrivée ou un combat — MÊME machinerie que le joueur (cascadeResolveAll/
 *                           Finish, restSleep, seaActivitiesConfirm…), juste sans les clics ;
 *                           advanceSeaDay({stopOnEveryEvent:true}) → s'arrête AUSSI au recap d'un événement
 *                           RACONTÉ (carte-parchemin de `travelDay.events`) — et SEULEMENT là : jamais
 *                           sur une étape STRUCTURELLE du jour (Progression, Orientation, Exposition…),
 *                           que `cascadeResolveAll` traverse aux défauts. Pour observer une étape
 *                           précise : advanceSeaDay({stopAt:'<kind>'}) → s'arrête AVANT de la résoudre
 *                           (ex. stopAt:'sea-progression-choice'), cascade rendue intacte
 *   __wfrp.skipToArrival() → comme `advanceSeaDay` mais ROULE jusqu'à l'ACCOSTAGE (ou interruption)
 *   __wfrp.advanceRiverDay() → symétrique FLUVIAL d'`advanceSeaDay` : pilote la journée de descente EN
 *                           COURS (cascade du jour, Exposition hydrique, halte de nuit) jusqu'au jour
 *                           SUIVANT, l'arrivée ou un combat — MÊME machinerie que le voyage maritime
 *   __wfrp.forceEncounter(id) → force un événement de bord maritime NOMMÉ (`sea-events.json`, id ou kind
 *                           ex. 'navire-hostile') au prochain jour — à dérouler avec `advanceSeaDay()`
 *   __wfrp.dealShipDamage(n) → inflige n Dégâts de coque HORS COMBAT (VRAI pipeline `damageVesselHull`/
 *                           `setVesselHull` — SOURCE UNIQUE `state.vessel.wounds`, cf. `docs/recette-
 *                           navigateur.md` § piège des deux copies de coque) ; symétrique de `dealDamage`
 *   __wfrp.clickRoute(id) → calcule le point ON-PATH (milieu du tracé, `getPointAtLength`/`getScreenCTM`)
 *                           d'une route de la carte du monde CLIQUABLE depuis ici → `{x,y}` ÉCRAN à
 *                           cliquer avec un VRAI clic souris (`page.mouse.click`) — remplace le calcul
 *                           manuel via `browser_run_code_unsafe` documenté au piège de route SVG
 *   __wfrp.setMorale(n)  → pose le Moral d'équipage (`vessel.morale.score`, setup direct — patron
 *                           `flag()`) pour rendre la désertion à quai observable sans dérouler des
 *                           semaines de facteurs en espérant la bande basse (#332)
 *   __wfrp.riverDayCascade() → (re)pose la cascade du JOUR fluvial en cours et rend ses étapes — évite de
 *                           rejouer achat/carte/départ à chaque essai (symétrique d'`advanceSeaDay`)
 *   __wfrp.forceRiverCapsize() → arme le CHAVIRAGE fluvial et RECONSTRUIT la journée en cours : vent Très fort
 *                           DE CÔTÉ (`river-navigation.json` : la seule combinaison qui porte
 *                           `capsizeRisk`) → la journée pose l'étape « Retirer la voile », dont l'échec
 *                           ouvre le redressement Round par Round (#1104a). À dérouler avec
 *                           `advanceRiverDay()` ; symétrique fluvial de `forceEncounter`
 *   __wfrp.forceOverspeed(overM?) → arme la SURVITESSE du jour de mer (seuil RAW M+5 : un « +1 M » seul
 *                           ne le franchit jamais sur une Cogue) — pose `effMToday` = M de conception + overM
 *   __wfrp.forceSeaWeather({temperature}) → arme la météo du jour de mer EN COURS (bande de Température
 *                           = cadence des Tests d'Exposition : Glaciale/Caniculaire 4, Froide/Chaude 2,
 *                           Médiane 0) — symétrique de `forceRiverCapsize`, à dérouler avec `advanceSeaDay()`
 *   __wfrp.forceShipwreck() → déclenche `beginShipwreck` DIRECTEMENT (setup assumé, PAS le pipeline de
 *                           dégâts) — `dealShipDamage(999)` est EFFACÉ par la Réparation de fortune du
 *                           MÊME jour (la garde de naufrage n'est évaluée qu'à l'ENTRÉE de `runSeaDay`,
 *                           `seaVoyageFlow.ts` : piège d'ordonnancement, cf. `docs/recette-navigateur.md`)
 *   __wfrp.gmSeat(bool)  → flip du siège MJ solo (`setGmSeat`) — setup légitime ; le siège SURVIT à
 *                           `scenario()` (le retirer à la main entre deux) ; la VALIDATION du flux
 *                           reste la checkbox réelle, ce helper n'économise que la mise en place
 *   __wfrp.fillCreatorDefaults(uptoStep?) → remplit le brouillon du CRÉATEUR OUVERT (écran Roster →
 *                           Créer) avec des défauts VALIDES (`fillDraftDefaults`) jusqu'à `uptoStep`
 *                           incluse (défaut : dernière étape) puis avance l'étape affichée — SETUP
 *                           UNIQUEMENT (sauter jusqu'à une étape sans dérouler tirages/choix un par
 *                           un) ; le flux joueur réel (tirages, choix, allocations) reste testé aux
 *                           clics, jamais via ce raccourci
 */
/** Flux « jet différé » pilotable parmi des `pending*` ouverts — convention pending<Flux> ↔
 *  <flux>Roll/Confirm/Cancel. Les files à verbe propre (pause de Round, victoire) et les invites de
 *  CIBLAGE (Cleave/DualStrike/choix de monture) sont exclues. */
function devFluxOf(open: string[]): string | null {
  const special = new Set(['pendingRoundStart', 'pendingVictory', 'pendingCleave', 'pendingDualStrike', 'pendingMountTarget']);
  const k = open.find((x) => !special.has(x));
  if (!k) return null;
  const name = k.slice('pending'.length);
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/** Pilote LA modale ouverte par convention (cf. __wfrp.roll/confirm/cancel). */
function devDriveModal(verb: 'Roll' | 'Confirm' | 'Cancel'): string {
  const s = useGame.getState() as unknown as Record<string, unknown>;
  const open = Object.keys(s).filter((k) => /^pending/.test(k) && (Array.isArray(s[k]) ? (s[k] as unknown[]).length > 0 : s[k] != null));
  if (!open.length) return '✗ aucune modale ouverte';
  // File à verbe propre d'abord : pause d'ouverture de Round.
  if (verb === 'Confirm' && open.includes('pendingRoundStart')) { (s.confirmRoundStart as () => void)(); return '✓ Round lancé'; }
  const flux = devFluxOf(open);
  if (!flux) return `✗ pas de flux pilotable parmi : ${open.join(', ')}`;
  const fn = s[flux + verb];
  if (typeof fn !== 'function') return `✗ action ${flux}${verb} introuvable (modales ouvertes : ${open.join(', ')})`;
  (fn as () => void)();
  return `✓ ${flux}${verb}()`;
}

/** (Re)construit la cascade du JOUR fluvial EN COURS depuis l'état courant (vent compris) et la pose.
 *  Sert `__wfrp.riverDayCascade()` et le rebuild d'après-armement de `forceRiverCapsize`. */
function riverDayCascade(): string {
  const s = useGame.getState();
  const plan = s.travelPlan;
  if (!plan?.river) return '✗ aucune descente fluviale en cours (travelPlan.river)';
  const map = s.worldMap as import('./worldMap').WorldMap | undefined;
  const route = map?.routes.find((r) => r.id === plan.routeId);
  const to = map ? placeById(map, plan.toPlaceId) : undefined;
  if (!route || !to) return '✗ route ou destination introuvable sur la carte du monde';
  // Le slot est REMPLACÉ, jamais complété : `startCascade` APPEND quand le `purpose` est déjà ouvert
  // (doctrine du slot, `cascade.ts` — voulue, et dont le combat dépend). Le chemin JOUEUR ne peut pas
  // rouvrir un `travelDay` déjà ouvert (`runRiverDays` refuse si `pendingCascade`) ; ce helper, lui,
  // court-circuite ce garde — sans cette purge il concaténait 2 journées (ids dupliqués, étapes
  // injouables, recette 5).
  useGame.setState({ pendingCascade: null });
  const built = buildRiverDayCascade(useGame.getState, useGame.setState, route, { scene: to.scene ?? '', label: to.label });
  startCascade(useGame.getState, useGame.setState, { title: 'Journée de descente', icon: 'travel/wave', purpose: 'travelDay', steps: built.steps });
  const kinds = built.steps.map((x: { kind: string }) => x.kind).join(', ');
  return `cascade du jour posée : ${built.steps.length} étape(s) [${kinds}]`;
}

/** Boucle interne partagée par `__wfrp.advanceSeaDay`/`skipToArrival` : pilote la MÊME machinerie que
 *  le joueur (cascade du jour `pendingCascade` `purpose:'travelDay'`, halte de nuit `pendingRest`,
 *  Activités hebdo `pendingSeaActivities`, tout autre `pending<Flux>` par convention) — jamais un
 *  raccourci du flux testé, juste sans les clics. `real(tick,0)` (jamais un `setTimeout` patché) :
 *  certains appliers du jour (Rythme forcé/Prière) reprennent `runSeaDay` eux-mêmes via un VRAI
 *  `setTimeout(0)` différé (`seaVoyageFlow.ts`) — une boucle purement synchrone les manquerait.
 *  `stopAtNextDay` (`advanceSeaDay`) : UNE journée = EXACTEMENT une cascade `purpose:'travelDay'`
 *  (`buildSeaDayCascade`/`runSeaDay` — jamais scindée) ; on la résout PUIS on laisse la halte de nuit
 *  se dérouler (défauts de logement/tambouille pré-remplis, `restSleep`) jusqu'à ce qu'une SECONDE
 *  cascade `travelDay` FRAÎCHE (`cursor===0`, encore intacte) apparaisse — on s'arrête AVANT de la
 *  toucher (jamais `sea.daysAtSea`, qui avance AVANT la halte : #297 piège vécu — un guard sur ce seul
 *  compteur coupe la halte de nuit en plein vol). `skipToArrival` (`stopAtNextDay=false`) ignore ce
 *  garde et roule jusqu'à l'arrivée/interruption. `maxIters` = scrutations, jamais une taille attendue.
 *  `stopOnEvent` (#380) : arrêt SUPPLÉMENTAIRE dès qu'une halte/Activités hebdo porte un événement de
 *  bord RACONTÉ (`travelDay.events`, rendu `ParchmentCard` — routine, non décisionnel) — le recetteur
 *  constate la carte-parchemin au recap AVANT que le drive ne dorme la nuit. Défaut inchangé (faux). */
function driveSeaVoyage(stopAtNextDay: boolean, maxIters: number, stopOnEvent = false, stopAt?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // `globalThis` (pas `window`) — même raison que `fastForward` : identique navigateur/vitest 'node'.
    type TimeoutSetter = (cb: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => unknown;
    const real = (globalThis as unknown as { setTimeout: TimeoutSetter }).setTimeout;
    let n = 0;
    let seenTravelDays = 0; // cascades `purpose:'travelDay'` intégralement résolues (BILAN + `cascadeFinish`)
    let sawVoyage = false;
    const tick = () => {
      try {
        const s = useGame.getState();
        if (s.battle) { resolve('✗ combat en cours (issu du voyage) — voir __wfrp.battle()'); return; }
        const plan = s.travelPlan;
        // Mer OU fleuve : même machinerie de cascade du JOUR (`purpose:'travelDay'`), même halte, même
        // reprise — `advanceRiverDay` réutilise ce pilote (le fleuve enchaîne en plus la cascade
        // d'Exposition `purpose:'riverExposure'`, drainée par le bloc générique `if (p)` ci-dessous, #344).
        if (!plan?.sea && !plan?.river) { resolve(sawVoyage ? '✓ voyage terminé (accosté ou interrompu par un événement d\'auteur)' : '✗ aucun voyage (mer/fleuve) en cours'); return; }
        sawVoyage = true;
        if (n++ >= maxIters) { resolve(`✗ borne atteinte (${maxIters} scrutations, ${seenTravelDays} jour(s) résolu(s)) — voir __wfrp.state()/__wfrp.log()`); return; }
        const p = s.pendingCascade;
        if (p) {
          if (stopAtNextDay && p.purpose === 'travelDay' && p.cursor === 0 && seenTravelDays >= 1) {
            resolve(`✓ jour suivant atteint (${seenTravelDays} jour(s) résolu(s), ${Math.max(0, Math.round(plan.km - plan.kmDone))} milles restants) — cascade prête (__wfrp.modal()/roll())`);
            return;
          }
          // `stopAt` (recette #1117) : la cascade courante PORTE l'étape nommée → on s'arrête AVANT de
          // la résoudre et on rend la main. Le pilote ne se dédouble pas pour autant (aucune boucle
          // pas-à-pas recopiée ici) : la suite se joue à la modale réelle (`__wfrp.modal()/roll()`),
          // qui est précisément ce qu'une recette veut observer sur une étape précise.
          const cible = stopAt ? p.participants.findIndex((st, i) => st.kind === stopAt && i >= p.cursor) : -1;
          if (cible >= 0) {
            resolve(`✓ étape « ${stopAt} » atteinte (position ${cible + 1}/${p.participants.length}) — cascade NON résolue : __wfrp.modal()/roll()`);
            return;
          }
          if (p.cursor < p.participants.length) {
            s.cascadeResolveAll(); // « Tout lancer » — peut buter sur un CHOIX du joueur (cursor < length)
            const after = useGame.getState().pendingCascade;
            if (after && after.cursor < after.participants.length) {
              const cur = after.participants[after.cursor];
              // Un CHOIX joueur d'ÉVÉNEMENT (Cogue pirate : fuir/combattre/soumettre — cascade `purpose:test`
              // ouverte HORS journée) est une décision PRÉSENTÉE : le drive s'arrête PROPREMENT et la signale
              // (le joueur/recetteur voit les 3 choix), au lieu de trancher en silence son `defaultChoice`
              // (doctrine « aucun choix silencieux ») — c'est ce qui vidait l'état sous l'écran (400
              // scrutations orphelines). Les choix INTERNES d'une journée (`travelDay`) gardent leur défaut.
              if (cur?.options?.length && after.purpose !== 'travelDay') {
                resolve(`✓ événement présenté — « ${cur.label} » attend une décision (${cur.options.map((o) => o.key).join(' / ')}) : __wfrp.modal()/state().pendingCascade`);
                return;
              }
              if (cur?.options?.length) useGame.getState().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
            }
            real(tick, 0); return;
          }
          if (p.purpose === 'travelDay') seenTravelDays++;
          useGame.getState().cascadeFinish();
          real(tick, 0); return;
        }
        if (s.pendingRest) {
          const evts = s.pendingRest.travelDay?.events ?? [];
          if (stopOnEvent && evts.length) {
            resolve(`✓ événement de bord raconté au recap (${evts.length}) — carte-parchemin visible à la halte de nuit (__wfrp.modal()/state()) ; restSleep() ou advanceSeaDay() reprend`);
            return;
          }
          s.restSleep();
          real(tick, 0); return;
        }
        if (s.pendingSeaActivities) {
          const evts = s.pendingSeaActivities.day.events ?? [];
          if (stopOnEvent && evts.length) {
            resolve(`✓ événement de bord raconté au recap (${evts.length}) — carte-parchemin visible (Activités hebdo ouvertes) ; seaActivitiesConfirm({}) ou advanceSeaDay() reprend`);
            return;
          }
          s.seaActivitiesConfirm({}); real(tick, 0); return;
        }
        const sr = s as unknown as Record<string, unknown>;
        const open = Object.keys(sr).filter((k) => /^pending/.test(k) && (Array.isArray(sr[k]) ? (sr[k] as unknown[]).length > 0 : sr[k] != null));
        if (open.length) { devDriveModal('Roll'); devDriveModal('Confirm'); real(tick, 0); return; }
        if (plan.interrupted) { s.resumeTravel(); real(tick, 0); return; }
        // Rien à piloter LÀ (reprise différée d'un applier en vol, `setTimeout(0)` déjà posé côté
        // seaVoyageFlow) : re-scrute au tick suivant sans action, laisse la chaîne réelle rattraper.
        real(tick, 4);
      } catch (e) {
        reject(e);
      }
    };
    tick();
  });
}

/** Réglage auto-rendu par le harnais : une RÈGLE optionnelle (`policy`) ou une PRÉFÉRENCE (`preferences`). */
type SettingDef = { id: string; label: string; kind: string; options?: string[]; min?: number; max?: number; default: RuleValue };

const settingShape = (d: { kind: string; options?: string[]; min?: number; max?: number }) =>
  d.kind === 'mode' ? `{${d.options?.join('|')}}` : d.kind === 'param' ? `[${d.min}…${d.max}]` : '(true|false)';
const settingUnknown = (id: string, api: 'rules' | 'prefs') => `réglage inconnu : ${id} — voir __wfrp.${api}()`;
const settingDetail = (d: SettingDef, val: RuleValue | undefined) =>
  `${d.id} = ${JSON.stringify(val)} · ${d.label} (défaut ${JSON.stringify(d.default)} · ${settingShape(d)})`;
const settingReset = (d: SettingDef) => `${d.id} → défaut ${JSON.stringify(d.default)}`;
const settingDone = (id: string, v: RuleValue) => `✓ ${id} → ${JSON.stringify(v)}`;

/** Coerce + valide une valeur selon le `kind` du réglage — message d'erreur UNIQUE pour les deux registres. */
function coerceSetting(d: SettingDef, value: RuleValue): { v: RuleValue } | { err: string } {
  if (d.kind === 'flag') return { v: value === true || value === 'true' || value === 'on' };
  if (d.kind === 'param') return { v: Number(value) };
  if (!d.options?.includes(String(value))) {
    return { err: `${d.id} : valeur invalide « ${value} » — options : ${d.options?.join(' | ')}` };
  }
  return { v: value };
}

/** Dernier scénario lancé par `__wfrp.scenario(id, seed)`, mémorisé PAR ONGLET (sessionStorage) :
 *  un reload (HMR d'une autre session) ramène au menu en perdant tout l'état, `resumeLastScenario()`
 *  le rejoue à l'identique. Rien n'est relu au boot — la reprise est un geste de recette explicite. */
const LAST_SCENARIO_KEY = 'wfrp.dev.lastScenario';
type LastScenario = { id: string; seed?: number };

/** sessionStorage quand il existe et répond (module chargé aussi hors navigateur : tests en env node). */
function scenarioMemory(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function rememberScenario(entry: LastScenario): void {
  try {
    scenarioMemory()?.setItem(LAST_SCENARIO_KEY, JSON.stringify(entry));
  } catch {
    // stockage refusé (quota / navigation privée) : la reprise n'est qu'un confort de recette
  }
}

function recallScenario(): LastScenario | null {
  let raw: string | null;
  try {
    raw = scenarioMemory()?.getItem(LAST_SCENARIO_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LastScenario;
    return typeof parsed?.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Le refus de `ready()` DIT au recetteur ce que l'attente a mesuré : la couche `state`
 *  (`entreeEnScene.ts`) rend la cause et les ids, la console de recette en fait sa phrase. */
function refusDeReady(e: EntreeEnSceneNonAtteinte): string {
  if (e.cause === 'aucun-monde') {
    return `✗ __wfrp.ready : aucun monde monté après ${e.timeoutMs} ms — aucune scène volumique n'a signalé son entrée en scène`;
  }
  if (e.cause === 'scene-differente') {
    return `✗ __wfrp.ready : scène attendue « ${e.attendu ?? 'aucune'} » vs montée « ${e.montee} » après ${e.timeoutMs} ms`;
  }
  return `✗ __wfrp.ready : voile encore levé sur « ${e.montee} » après ${e.timeoutMs} ms`;
}

/**
 * Bascule sur l'écran de l'éditeur et ATTEND qu'il ait publié la commande nommée au pont
 * (`state/editeurBridge`) — voie UNIQUE des helpers de recette de l'éditeur : le montage de React
 * n'est pas synchrone du changement d'écran, et un helper qui appellerait le pont tout de suite
 * tomberait sur une commande absente. À la borne, refus NOMMÉ portant le helper et l'écran atteint.
 */
async function attendreCommandeEditeur(helper: string, commande: keyof CommandesEditeur, montageMs: number): Promise<void> {
  useGame.getState().setScreen('editor');
  const t0 = Date.now();
  while (!editeur[commande]) {
    if (Date.now() - t0 > montageMs) {
      throw new Error(`✗ __wfrp.${helper} : l'éditeur ne s'est pas monté après ${montageMs} ms — écran « ${useGame.getState().screen} »`);
    }
    await new Promise<void>((r) => { scheduleFlowTimer(() => r(), 50); });
  }
}

/**
 * @param scenarios REGISTRE des scénarios de test lu par `scenario()`/`resumeLastScenario()` — le
 *  registre réel par défaut ; un appelant qui doit éprouver un scénario PARTICULIER passe SA liste
 *  (`[...testScenarios, forge]`), au lieu de muter le tableau importé que d'autres modules comptent.
 */
export function buildApi(scenarios: readonly TestScenario[] = testScenarios) {
  const g = () => useGame.getState();
  const find = (id: string) => g().scene?.entities.find((e) => e.id === id);

  const runScenario = (id?: string, seed?: number) => {
    if (!id) return scenarios.map((sc) => `${sc.id} — ${sc.title}`);
    const sc = scenarios.find((t) => t.id === id);
    if (!sc) throw new Error(`__wfrp.scenario : « ${id} » introuvable — ids : ${scenarios.map((t) => t.id).join(', ')}`);
    clearAiTurnLog(); // trace IA vierge pour ce scénario
    const s = g();
    if (seed != null) s.seedRng(seed);
    if (sc.rules) for (const [rid, v] of Object.entries(sc.rules)) setRule(rid, v);
    s.setParty(sc.makeParty());
    if (sc.extraScenes?.length || sc.worldMap || sc.narratif) s.loadProject([sc.scene, ...(sc.extraScenes ?? [])], sc.scene.id, sc.worldMap ?? null, sc.narratif);
    else s.startScene(sc.scene);
    // Un plateau VIDE est un refus, jamais un silence : la recette qui continue dessus attribue son
    // rouge au geste suivant. « Vide » se mesure sur la scène ACTIVE du store après chargement —
    // aucune scène (`scene` nul) ou aucune entité peuplée (`scene.entities`, la population que lisent
    // le rendu comme les sondes `__wfrp.entities`/`visibleCount`). Le groupe n'y change rien : `setParty`
    // ne pose que `state.party` (`store.ts:2155`), et c'est `startScene` qui cherche son point de départ
    // DANS `scene.entities` (`store.ts:2159`, entité `heroStart`) — 0 entité = aucun sol sous le groupe.
    const chargee = g().scene;
    if (!chargee || chargee.entities.length === 0)
      throw new Error(
        `__wfrp.scenario : « ${id} » a chargé une scène VIDE (${chargee ? `scène « ${chargee.id} », 0 entité` : 'aucune scène active'}) — ` +
          `plateau inexploitable : le groupe posé par setParty ne vit pas dans scene.entities, aucune entité = aucun point de départ (heroStart) ni décor.`,
      );
    // La MÉMOIRE d'onglet ne retient qu'un lancement qui a passé les deux refus : mémoriser avant le
    // chargement ferait rejouer en boucle un scénario qui jette à `resumeLastScenario()`.
    rememberScenario(seed != null ? { id: sc.id, seed } : { id: sc.id });
    const scLead = g().party[0];
    if (sc.money && scLead) creditBourse(g, useGame.setState, scLead.id, sc.money); // seed de bourse du scénario (après le reset du lancement)
    if (sc.vessel) useGame.setState({ vessel: sc.vessel }); // navire de campagne (voyage/combat maritime)
    if (sc.autoCombat) g().startCombat(sc.autoCombat);
    if (g().pendingRoundStart) g().confirmRoundStart();
    if (sc.massBattle) {
      // Interlude AVANT la bataille (ADE II 8 l.65) : son budget d'Activités (max 3) est celui dans
      // lequel puise la préparation. La préparation se joue DANS le menu d'interlude (« Interlude c'est
      // interlude ») — `startMassBattle` reste donc sur l'écran d'interlude tant qu'un interlude est ouvert.
      if (sc.interludeWeeks) g().startInterlude(sc.interludeWeeks);
      g().startMassBattle(sc.massBattle);
      return `✓ bataille de masse « ${sc.title} » lancée${sc.interludeWeeks ? ' (préparation dans le menu d\'interlude)' : ''}`;
    }
    s.setScreen('campaign');
    return `✓ scénario « ${sc.title} » lancé${sc.autoCombat ? ' (combat direct, prêt à jouer)' : ''}`;
  };
  return {
    /** Le store brut (sélecteurs, getState, setState) — pour les cas non couverts par les helpers. */
    store: useGame,

    /** Instantané lisible de l'état courant. */
    state: () => {
      const s = g();
      return {
        screen: s.screen,
        sceneId: s.scene?.id,
        sceneName: s.scene?.label,
        partyPos: s.partyPos,
        mode: s.mode,
        inDialogue: !!s.dialogue,
        dialogueSpeaker: s.dialogue?.speakerId,
        inCombat: !!s.battle,
        party: s.party.map((h) => ({ id: h.id, name: h.label })),
        money: partyMoneyTotal(g),
      };
    },

    /** RECETTE COOP : la vue RÉSEAU du siège local — `state()` n'expose RIEN de `net`, alors qu'une
     *  recette à deux navigateurs se juge siège par siège (qui est qui, qui possède quoi). Copie en
     *  LECTURE : muter le retour ne touche pas le store. `gmSeat` absent = camp ennemi conduit par
     *  l'IA ; `presence` est la vue HÔTE des sièges en reconnexion (`netFlow.NetState`). */
    net: () => {
      const n = g().net;
      return {
        mode: n.mode,
        mySeat: n.mySeat,
        roomCode: n.roomCode,
        gmSeat: n.gmSeat,
        ownership: { ...n.ownership },
        seatNames: { ...n.seatNames },
        presence: { ...n.presence },
      };
    },

    /** CARTOGRAPHIE : toutes les entités de la scène + comment y accéder. */
    entities: () =>
      (g().scene?.entities ?? []).filter((e) => !e.combat?.hiddenUntilCombat).map((e) => ({
        id: e.id,
        label: e.label,
        kind: e.kind,
        pos: e.pos,
        // Ce que l'entité OFFRE, lu au dériveur unique et aux drapeaux vivants — la recette voit la
        // même liste que le joueur, jamais une carte de champs recopiée qui dérive.
        access: actionsDe(g().scene!, e, g().flags).map((a) => a.id).join('+') || '—',
      })),

    /** CARTOGRAPHIE (symétrique d'`entities()`) : les routes CLIQUABLES (`clickRoute`, MÊME source
     *  `routesRendues`) depuis le lieu courant de la carte du monde — cible une route pour
     *  `__wfrp.clickRoute(id)` quand plusieurs chips de distance sont ambigus. `etat` dit si le
     *  départ est offert (`ouverte`) ou si la route ne se CONSULTE que (`fermee-consultable`). */
    routes: () => {
      const s = g();
      const map = s.worldMap;
      if (!map || !s.scene) return '✗ aucune carte du monde ouverte (voir __wfrp.screen(\'worldmap\'))';
      return routesRendues(map, s.scene.id).map(({ route: r, ouverte }) => ({
        id: r.id,
        from: placeById(map, r.a)?.label ?? r.a,
        to: placeById(map, r.b)?.label ?? r.b,
        distanceLabel: routeDistanceLabel(r.km, r.sea),
        etat: ouverte ? 'ouverte' : 'fermee-consultable',
      }));
    },

    /** OBSERVATION seule : bounding box ÉCRAN du token `id` (combat ET exploration — même canal
     *  `data-cid`, #226) via `getBoundingClientRect`. `null` si le token n'est pas dans le DOM
     *  (hors vue, scène/combat sans ce token). Zéro action — ne pilote rien. */
    screenPos: (id: string): { x: number; y: number; width: number; height: number } | null => {
      const el = document.querySelector(`[data-cid="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    },

    /** OBSERVATION seule : bounding box ÉCRAN d'une CASE — le symétrique de `screenPos`, qui ne sait
     *  servir qu'un token porteur de `data-cid`. Une case VIDE n'a pas de nœud DOM propre : elle est
     *  projetée par `diamondCorners` (`geometry/iso`, la géométrie du RENDU lui-même), puis la
     *  transformée caméra est lue sur la CTM du groupe qui la porte — zoom, panoramique et rotation
     *  viennent donc du DOM, pas d'un second calcul à tenir à jour. `z` = étage visé (défaut 0).
     *  `null` hors scène ou tant que le stage n'est pas monté. Zéro action — ne pilote rien. */
    tileScreenPos: (tile: { x: number; y: number; z?: number }): { x: number; y: number; width: number; height: number } | null => {
      const st = useGame.getState();
      if (!st.scene) return null;
      const camGroup = document.querySelector('svg.iso-stage > g') as SVGGraphicsElement | null;
      const ctm = camGroup?.getScreenCTM();
      if (!ctm) return null;
      const dims: Dims = { ...st.scene.dimensions, rot: st.camRot, view: st.viewMode, edge: st.camEdge, yawDeg: viewYawDeg(st.camRot, st.camEdge) };
      const c = diamondCorners(tile.x, tile.y, dims, tile.z ?? 0);
      const pts = [c.top, c.right, c.bot, c.left].map(([x, y]) => new DOMPoint(x, y).matrixTransform(ctm));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    },

    /** OBSERVATION seule : CE QUE LE PICKING RÉEL RÉSOUDRAIT sous un pixel d'écran — l'INVERSE exact de
     *  `tileScreenPos`, et la chaîne MÊME que le stage exécute au clic (`gameIso/stage/pickResolve` :
     *  inversion du pixel → hit-test sprite puis sol). Ne clique RIEN : il DIT quelle case
     *  (et quel combattant, si un corps est dessiné sous le pixel) recevrait le geste. C'est l'instrument
     *  qui tranche « ma case est-elle visée ? » sans tâtonner au clic — un clic qui « ne fait rien » y
     *  montre soit un `cid` inattendu (le corps d'un voisin/engin couvre la case, et le clic part alors
     *  sur l'ENTITÉ), soit `tile: null` (aucune surface résolue à ce pixel).
     *  La SONDE elle-même vit dans le rendu (`gameIso/stage/pickProbe`) et s'enregistre ici : `src/state`
     *  ne dépend jamais de `src/gameIso` (règle 3). `null` tant que le stage n'est pas monté.
     */
    pickTileAt: (px: { x: number; y: number }) => (sondeDePicking ? sondeDePicking(px) : null),

    /** ACCÈS DIRECT : ouvre le dialogue/marchand d'une entité (téléporte le groupe à côté puis interagit). */
    talk: (id: string) => {
      const ent = find(id);
      if (!ent) return `✗ « ${id} » introuvable — voir __wfrp.entities()`;
      useGame.setState({ partyPos: { ...ent.pos } });
      g().interactEntity(id);
      const s = g();
      if (s.dialogue) return `✓ dialogue ouvert (${id})`;
      if (s.merchant) return `✓ marchand ouvert (${id})`;
      return `rien déclenché (${id}) — l'entité n'a ni dialogue ni marchand`;
    },

    /** Place le groupe sur la case d'une entité/coord (déclenche portes, triggers, fouilles au pas).
     *  Vérifie APRÈS coup que `partyPos` a réellement atteint la cible (#793) — `moveParty` peut ne
     *  PAS bouger le groupe (case bloquée/inatteignable) sans lever d'erreur ; un faux `✓` piège
     *  toute recette qui s'y fie. Position RÉELLE relue via `g()` (pas `pt`) dans les deux messages. */
    goto: (idOrXY: string | { x: number; y: number; z?: number }) => {
      // Cible une entité (sa case ET son étage z) ou des coordonnées brutes {x,y,z?}.
      const ent = typeof idOrXY === 'string' ? find(idOrXY) : null;
      const pt = typeof idOrXY === 'string' ? (ent ? { x: ent.pos.x, y: ent.pos.y, z: ent.z } : undefined) : idOrXY;
      if (!pt) return `✗ cible introuvable`;
      g().moveParty({ ...pt });
      const after = g().partyPos;
      const reached = after.x === pt.x && after.y === pt.y && (pt.z == null || (after.z ?? 0) === pt.z);
      if (!reached) return `✗ bloqué/inatteignable (${pt.x},${pt.y}${pt.z ? `,z${pt.z}` : ''}) — groupe resté en (${after.x},${after.y}${after.z ? `,z${after.z}` : ''})`;
      return `✓ groupe → (${after.x},${after.y}${after.z ? `,z${after.z}` : ''})`;
    },

    /** VISUALISER LE MULTI-NIVEAUX — décompose le rendu couche par couche (tuiles pleines/vides, murs,
     *  hauteur MÉTRIQUE min/max en mètres) + l'étage actuellement mis en avant. Pour comprendre « ce qui
     *  est au-dessus / en dessous / au même plan ». */
    levels: () => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '✗ aucune scène';
      const wallsByZ: Record<number, number> = {};
      for (const wl of sc.walls ?? []) wallsByZ[wl.z ?? 0] = (wallsByZ[wl.z ?? 0] ?? 0) + 1;
      return {
        etageActif: etageActif(s, getViewZ()),
        override: getViewZ(),
        groupeZ: s.partyPos.z ?? 0,
        couches: [...sc.layers].sort((a, b) => a.z - b.z).map((l) => {
          const pleines = l.tiles.filter((t) => !estAbsent(t)).length;
          const hs = (l.height ?? []).filter((h) => h !== 0);
          return {
            z: l.z,
            tuilesPleines: pleines,
            vide: l.tiles.length - pleines,
            murs: wallsByZ[l.z] ?? 0,
            hauteur: hs.length ? { cases: hs.length, minM: Math.min(...hs), maxM: Math.max(...hs) } : 'plat',
          };
        }),
      };
    },

    /** DEBUG affichage multi-niveaux : force l'étage ACTIF (`etageActif`). `__wfrp.viewLevel(1)` vise
     *  l'étage ; `__wfrp.viewLevel(0)` le rez ; `__wfrp.viewLevel(null)` = automatique (l'étage suit le
     *  groupe). Sans argument : renvoie l'override courant.
     *  PORTÉE : l'étage actif n'ISOLE le rendu (« les autres ne sont pas rendus ») qu'en VUE DU DESSUS
     *  — `stage/MondeDeCampagne.tsx` ne filtre `el.cell.z !== activeZ` que sous `planVue`
     *  (= `viewPolicy.etageIsole`, vrai pour le seul regard du dessus, `stage/viewPolicy.ts`). En vue
     *  ISO, les deux couches se peignent et c'est la loi de dégagement (`clearedSpace`,
     *  `builders/roofs.ts`) qui découvre ce qui abrite le groupe : `viewLevel` n'y change RIEN au monde
     *  peint. Il reste partout l'étage que le PICKING résout par défaut (`etageActif`). */
    viewLevel: (z?: number | null) => {
      if (z === undefined) return { override: getViewZ(), note: 'null = auto (suit le groupe)' };
      setViewZ(z);
      return `✓ étage affiché : ${z === null ? 'auto (suit le groupe)' : z}`;
    },

    /** PLAN ASCII de la couche (défaut = celle AFFICHÉE) — la DONNÉE rendue en box-drawing, à comparer
     *  ligne pour ligne avec ce qui est à l'écran (vue du dessus). C'est l'EXPORT de la scène
     *  (`sceneToAscii`, pur, sans effet de bord) restreint à la couche : la grille `walled`, ses TROIS
     *  légendes (cases, arêtes, zones) RESTREINTES aux glyphes que CETTE couche écrit, et son RELIEF
     *  rendu en GRILLE alignée sur la carte (`.` = hauteur 0, sinon la hauteur en mètres signée).
     *  Les arêtes portent les mots de la grammaire du plan (`schemas/grammaire/carte-ascii.ts` :
     *  mur, porte, fenêtre, jonction, diagonale) ET les chars de `wallLegend`, alloués à l'export pour
     *  les cloisons à structure/apparence. `console.log(__wfrp.ascii())` pour l'alignement monospace. */
    ascii: (z?: number) => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '✗ aucune scène';
      const zz = z ?? getViewZ() ?? (s.partyPos.z ?? 0);
      const W = sc.dimensions.w, H = sc.dimensions.h;
      const ex = sceneToAscii(sc);
      const cle = `z${zz}`;
      const grille = ex.walled[cle];
      if (grille === undefined) return `✗ aucune couche z=${zz} (couches : ${Object.keys(ex.walled).join(', ') || 'aucune'})`;
      const rangs = grille.replace(/^\n|\n$/g, '').split('\n');
      // Les légendes se restreignent à CETTE couche : l'export mutualise `legend`/`wallLegend` sur
      // toutes les grilles, montrer les glyphes d'un autre étage ferait lire une case absente.
      const casesVues = new Set<string>(), aretesVues = new Set<string>();
      rangs.forEach((ligne, ry) => {
        for (let rx = 0; rx < ligne.length; rx++) {
          const ch = ligne[rx];
          if (ry % 2 === 1 && rx % 2 === 1) casesVues.add(ch);
          else if (ry % 2 !== rx % 2) aretesVues.add(ch);
        }
      });
      const zonesVues = new Set((ex.zoneMap[cle] ?? []).join('').split(''));
      const table = (titre: string, entrees: [string, string][]) =>
        entrees.length ? `\n${titre} : ${entrees.map(([ch, v]) => `${ch} = ${v}`).join(' · ')}` : '';
      const legende = [
        `${FOND_ECRIT} = ${ex.fondParZ[cle]}`,
        ...Object.entries(ex.legend).filter(([ch]) => casesVues.has(ch)).map(([ch, t]) => `${ch} = ${t}`),
      ].join(' · ');
      const aretes: [string, string][] = Object.entries(ex.wallLegend)
        .filter(([ch]) => aretesVues.has(ch))
        .map(([ch, ov]) => [ch, Object.entries(ov).map(([k, v]) => `${k}=${v}`).join(', ')]);
      const zones: [string, string][] = Object.entries(ex.zoneLegend)
        .filter(([ch]) => zonesVues.has(ch))
        .map(([ch, zn]) => [ch, zn.label]);
      // RELIEF en grille, alignée case pour case sur la carte ci-dessus (une liste de tuples est
      // illisible passé quelques cases : 2 640 sur l'étage de l'Opéra).
      const hauteurs = new Map(ex.relief.filter((r) => (r.z ?? 0) === zz).map((r) => [`${r.cell[0]},${r.cell[1]}`, r.height]));
      const jeton = (h: number | undefined) => (h === undefined ? FOND_ECRIT : h > 0 ? `+${h}` : `${h}`);
      const larg = Math.max(...[...hauteurs.values()].map((h) => jeton(h).length), 1);
      const relief = hauteurs.size
        ? Array.from({ length: H }, (_, y) =>
            Array.from({ length: W }, (_, x) => jeton(hauteurs.get(`${x},${y}`)).padStart(larg)).join(' '),
          ).join('\n')
        : 'plat (aucune hauteur ≠ 0)';
      return (
        `étage z=${zz} (${W}×${H})\n` +
        rangs.map((l) => l.replace(/\s+$/, '')).join('\n') +
        `\nlégende : ${legende}` +
        table('légende arêtes', aretes) +
        table('légende zones', zones) +
        `\nrelief :\n${relief}`
      );
    },

    /** Navigue vers un écran (menu/party/creator/editor/test/coop/campaign) — id invalide = `throw`
     *  IMMÉDIAT (liste des ids valides) plutôt qu'un routage silencieux vers un écran blanc (#211,
     *  ex. 'game' n'existe pas : `SCREENS` est la source unique, `state/store.ts`). */
    screen: (screen: string) => {
      if (!(SCREENS as readonly string[]).includes(screen)) {
        throw new Error(`__wfrp.screen : id invalide « ${screen} » — écrans valides : ${SCREENS.join(', ')}`);
      }
      g().setScreen(screen as never);
      return g().screen;
    },

    /** Brouillard ON/OFF (recette) : `fog(false)` ou `fog()` révèle TOUTE la carte pour diagnostiquer le
     *  RENDU sans la vision ; `fog(true)` rétablit le brouillard normal. Bump `partyPos` (dep du useMemo
     *  de visibilité d'IsoStage) → recalcul + re-render immédiat. */
    fog: (on = false) => {
      setRevealAll(!on);
      useGame.setState((s) => ({ partyPos: { ...s.partyPos } }));
      return on ? 'brouillard ON' : 'brouillard OFF — toute la carte révélée';
    },

    /** Lève-toit ON/OFF (recette, #1478) — symétrique de `fog(false)` : `roofCut(false)` ou `roofCut()`
     *  débraye le dégagement de la pièce occupée, donc toits, façades et décors de toit RESTENT peints
     *  (voir un décor de façade ou de toiture depuis l'intérieur de l'empreinte) ; `roofCut(true)`
     *  rétablit le comportement de jeu. Bascule GLOBALE : la remettre à `true` avant de juger un flux
     *  de vue normal.
     *  PORTÉE : le dégagement de PIÈCE seul. Le PERÇAGE local par occlusion (#1176 M3,
     *  `gameIso/stage/percage.ts`) reste ACTIF — un disque reste percé dans la nappe autour de chaque
     *  héros qu'elle cache à l'écran. */
    roofCut: (on = false) => {
      useGame.setState({ debugRoofCut: on });
      return on
        ? 'lève-toit ON'
        : 'lève-toit OFF — toits, façades et décors de toit restent en place, hors le disque local de perçage autour de chaque héros';
    },

    /** DEBUG carte (recette) : overlay d'annotation partagé sur IsoStage — coordonnées `x,y` (+`z{n}`)
     *  centrées par case, teinte par étage (z1 cyan / z2 violet), pastilles de rôle de structure
     *  (courtine rouge / tour orange / porte jaune / escalier bleu) + légende. Pour pointer la MÊME case
     *  que l'utilisateur sans chasser les pixels. Sans argument : BASCULE ; `labels(true)`/`labels(false)`
     *  force. Zéro coût quand OFF (overlay non rendu). */
    labels: (on?: boolean) => {
      const v = on ?? !g().debugLabels;
      useGame.setState({ debugLabels: v });
      return v ? 'labels ON' : 'labels OFF';
    },

    /** COMPTE de brouillard sur l'état VIVANT : `{visible, explored, total}` — cases actuellement vues
     *  (`computeStateVisible`, la MÊME dérivation que le rendu : aucune vision recalculée ici), cases
     *  déjà explorées de la scène courante, et cases construites (dimensions × étages). Chiffrer une
     *  révélation (une cloison qui laisse voir, une lampe allumée) sans lire la carte au pixel. */
    visibleCount: () => {
      const s = g();
      const sc = s.scene;
      if (!sc) return '✗ aucune scène';
      const visible = computeStateVisible({
        scene: sc, battle: s.battle, party: s.party, partyPos: s.partyPos,
        gameTime: s.gameTime, lightLevel: s.lightLevel,
      });
      return {
        visible: visible.size,
        explored: (s.explored[sc.id] ?? []).length,
        total: sc.dimensions.w * sc.dimensions.h * sc.layers.length,
      };
    },

    /** ARÊTES de la scène (`scene.walls`) — lecture seule. Sans argument : décompte par `structure`
     *  (`Record<id, n>`, les arêtes sans structure comptées sous `(sans structure)`). Avec un id de
     *  Structure : la liste des arêtes qui la portent (`{x,y,z,side,structure,window,door,closed}` —
     *  `closed` = état VIVANT de la porte, `doorIsOpen`, jamais le seul champ authoré). */
    walls: (structure?: string) => {
      const sc = g().scene;
      if (!sc) return '✗ aucune scène';
      const all = sc.walls ?? [];
      if (structure === undefined) {
        const parStructure: Record<string, number> = {};
        for (const w of all) {
          const k = w.structure ?? '(sans structure)';
          parStructure[k] = (parStructure[k] ?? 0) + 1;
        }
        return parStructure;
      }
      return all.filter((w) => w.structure === structure).map((w) => ({
        x: w.x, y: w.y, z: w.z ?? 0, side: w.side, structure: w.structure,
        window: !!w.window, door: !!w.door,
        ...(w.door ? { closed: !doorIsOpen(sc, w) } : {}),
      }));
    },

    /** Survol PROGRAMMATIQUE (combat) : pose la tuile survolée du monde de campagne comme si la souris y
     *  était — tooltip + réticule se rendent sans chasser les pixels. `null` efface. Accepte un id
     *  de combattant, un id d'entité de scène, ou {x,y}. */
    hover: (idOrXY: string | { x: number; y: number } | null) => {
      const hook = (window as unknown as { __wfrpSetHover?: (t: { x: number; y: number } | null) => void }).__wfrpSetHover;
      if (!hook) return '✗ monde de campagne non monté';
      if (idOrXY == null) {
        hook(null);
        return '✓ survol effacé';
      }
      const pt = typeof idOrXY === 'string'
        ? inBattleId(g().battle, idOrXY)?.pos ?? find(idOrXY)?.pos
        : idOrXY;
      if (!pt) return '✗ cible introuvable (combattant ou entité)';
      hook({ ...pt });
      return `✓ survol (${pt.x},${pt.y})`;
    },

    /** Simule un BOUTON de manette (combat) en passant par le shim DEV installé par `useGamepad`
     *  (`window.__wfrpPad`) — MÊME chemin que la vraie manette, sans API Gamepad (Playwright). `name`
     *  ∈ A|B|X|Y|LB|RB|LT|RT|Back. devtools n'importe RIEN de `src/ui` : il passe par window (layering). */
    pad: (name: string) => (window as unknown as { __wfrpPad?: (n: string) => void }).__wfrpPad?.(name),

    /** Simule une DIRECTION de manette (croix/stick) via `window.__wfrpPadDir` — `dir` ∈ up|down|left|right.
     *  Carte = déplace le curseur de combat ; menu/modale = déplace le focus. */
    padDir: (dir: string) => (window as unknown as { __wfrpPadDir?: (d: string) => void }).__wfrpPadDir?.(dir),

    /** RELÂCHE un bouton / une direction (`window.__wfrpPadUp` / `__wfrpPadDirUp`). Un geste MAINTENU
     *  (marche tenue du groupe, rotation caméra continue) se recette du début à SA FIN : sans ces deux
     *  portes, une sonde arme le geste et ne le lâche jamais. */
    padUp: (name: string) => (window as unknown as { __wfrpPadUp?: (n: string) => void }).__wfrpPadUp?.(name),
    padDirUp: (dir: string) => (window as unknown as { __wfrpPadDirUp?: (d: string) => void }).__wfrpPadDirUp?.(dir),

    /** Vérité STATE du ciblage au survol — ce que le clic ferait sur cette cible pour l'actif :
     *  {kind:'ok'|'invalid'|'none', line, title, skill, base, mod, dmg | reason}. */
    aim: (id: string) => {
      const b = g().battle;
      if (!b) return '✗ pas de combat';
      const active = inBattleId(b, b.order[b.turn]);
      const target = inBattleId(b, id);
      if (!active || !target) return '✗ actif ou cible introuvable';
      return hoverTargeting(() => useGame.getState(), active, target);
    },

    /** Lance un SCÉNARIO DE TEST sans passer par le menu : __wfrp.scenario('entrainement', 42).
     *  Sans argument : liste les ids. `seed` (optionnel) rend l'initiative DÉTERMINISTE. Le combat
     *  démarre PRÊT (la pause d'ouverture du Round 1 est acquittée). Un lancement qui aboutit est
     *  mémorisé par onglet pour `resumeLastScenario()` — un refus n'écrit rien.
     *  Un id inconnu ou une scène qui charge VIDE JETTENT une `Error` NOMMÉE (#1734) : l'id inconnu
     *  porte l'id demandé et la liste des ids, la scène vide porte son id et son compte d'entités. */
    scenario: runScenario,

    /** Relance le DERNIER `scenario(id, seed)` lancé DANS CET ONGLET (mémorisé en sessionStorage,
     *  même seed) : un reload (HMR d'une autre session) ramène au menu en perdant tout l'état, ce
     *  geste de recette le rejoue à l'identique. Aucune relance AUTOMATIQUE au boot — un rechargement
     *  humain doit rendre le menu. */
    resumeLastScenario: () => {
      const last = recallScenario();
      if (!last) return '✗ aucun scénario mémorisé dans cet onglet — lancer __wfrp.scenario(id, seed) d\'abord';
      return runScenario(last.id, last.seed);
    },

    /** ATTEND la fin de l'entrée en scène du monde volumique (#1478) : après `scenario()`, `goto()` ou
     *  `campaign()`, `await __wfrp.ready()` AVANT toute capture — sinon le cliché fige le voile
     *  (« Chargement... ») ou un monde à moitié cuit. Résout quand la scène du store est montée ET
     *  son voile tombé ; rejette en NOMMANT le cas (aucun monde monté / mauvaise scène / voile encore
     *  levé). La borne par défaut (15 000 ms) est très au-dessus du plafond d'entrée en scène
     *  (`AMBIANCE.entreeEnScene.plafondMs` = 2000, `src/data/ambiance.json`) : le voile tombe de
     *  lui-même à ce plafond, un dépassement signale donc un monde qui n'a jamais monté.
     *  LIMITE CONNUE : rejouer le MÊME id de scène (`scenario('x')` deux fois) ne relance pas
     *  l'armement du voile (`GameStage3D.tsx`, effet keyé `[scene.id]`) — `ready()` résout alors
     *  pendant la re-cuisson. Changer de scénario, ou recharger la page. */
    ready: (timeoutMs = 15000) => attendreEntreeEnScene(() => g().scene?.id ?? null, timeoutMs)
      .then(({ sceneId, ms }) => `✓ monde prêt — scène « ${sceneId} », voile tombé après ${ms} ms`)
      .catch((e: unknown) => { throw e instanceof EntreeEnSceneNonAtteinte ? new Error(refusDeReady(e)) : e; }),

    /** Ouvre un document dans l'ÉDITEUR sans passer par la modale « Ouvrir » (#1478) — donc sans le
     *  dialogue de fichier de l'OS, qu'aucun pilote navigateur ne sait fermer. Sans id : rend les
     *  trois familles ouvrables (`{ projets, campagnes, scenarios }`). Avec id : bascule sur l'écran
     *  `editor`, attend que l'éditeur ait publié sa commande au pont (`state/editeurBridge`, borne
     *  3000 ms, refus NOMMÉ sinon) puis l'appelle. SETUP seulement : une campagne built-in s'y ouvre
     *  en COPIE, exactement comme par la modale. */
    editorOpen: async (id?: string, montageMs = 3000) => {
      if (!id) {
        return {
          projets: projectsLoad().map((p) => `${p.id} — ${p.label}`),
          campagnes: allBuiltinCampaigns.map((c) => `${c.id} — ${c.label}`),
          scenarios: testScenarios.map((s) => `${s.id} — ${s.title}`),
        };
      }
      await attendreCommandeEditeur('editorOpen', 'ouvrir', montageMs);
      return editeur.ouvrir!(id);
    },

    /** PRÉPARE l'état d'une entité de la scène OUVERTE à l'éditeur (#877) : patch PARTIEL, une clé à
     *  `undefined` vaut ABSENTE — c'est ainsi qu'on fabrique l'état fautif (« décor sans type ») qu'une
     *  porte doit refuser. SETUP seulement : le patch passe par le pont d'INTENTION
     *  (`state/editeurBridge`, commande `patcherEntite`) — la MÊME voie qu'`editorOpen`, jamais un
     *  accès direct à l'état React d'un panneau. Trois refus NOMMÉS : éditeur non monté (rejet,
     *  borne `montageMs`), entité inconnue (`✗ …` portant les ids de la scène), clé d'IDENTITÉ
     *  (`id`, `kind`) qu'aucun patch ne touche. */
    editorPatchEntity: async (entityId: string, patch: Record<string, unknown>, montageMs = 3000) => {
      await attendreCommandeEditeur('editorPatchEntity', 'patcherEntite', montageMs);
      return editeur.patcherEntite!(entityId, patch);
    },

    /** INVENTAIRE des entités du BROUILLON ouvert à l'éditeur (#877) : `{ id, kind, ref?, pos }` par
     *  entité — de quoi retrouver l'id que l'éditeur vient d'attribuer à ce qu'on a posé à la carte,
     *  puis le passer à `editorPatchEntity`. ATTENTION : `__wfrp.entities()` lit la scène du STORE DE JEU, pas
     *  le brouillon de l'éditeur : les deux divergent dès la première édition. Même voie et même
     *  attente qu'`editorOpen` ; rejet NOMMÉ si l'éditeur ne se monte pas. */
    editorEntities: async (montageMs = 3000) => {
      await attendreCommandeEditeur('editorEntities', 'listerEntites', montageMs);
      return editeur.listerEntites!();
    },

    /** Entrée de BIBLIOTHÈQUE DE PROJETS minimale et VALIDE (#1343) : une scène vide (`emptyScene`)
     *  enveloppée par le constructeur UNIQUE du document (`documentDeProjet`), identité d'un projet
     *  d'auteur (`MAISON_PROJET_AUTHORE`) — elle passe `parseProject`. Rien n'est écrit : la recette la
     *  DÉFORME pour son cas, puis la pose par `projectSave`. */
    projectMinimal: (id = 'projet-recette', label = 'Projet de recette'): SavedProject => {
      const scene = emptyScene();
      const project = documentDeProjet(
        { type: 'projet', id, label, versionContenu: 1, maison: MAISON_PROJET_AUTHORE },
        [scene],
        { narratif: emptyNarratif() },
      );
      return { id, label, startSceneId: scene.id, savedAt: Date.now(), published: false, project };
    },

    /** POSE une entrée en bibliothèque de projets par `projectSave` (#1343) — le cache de
     *  `projectsLoad` est mis à jour, AUCUN rechargement requis ; un écran qui liste les projets
     *  (« Ouvrir » de l'éditeur, bibliothèque de campagnes) les relit à son OUVERTURE, pas s'il est
     *  déjà ouvert. Aucune porte : une entrée DÉFORMÉE se pose telle quelle, c'est le refus du geste
     *  mesuré ensuite qu'on recette. SETUP seulement. */
    projectSave: async (entree: SavedProject) => {
      const issue = await projectSave(entree);
      return issue.ok
        ? `✓ projet « ${entree.id} » posé en bibliothèque${issue.degraded ? ' (miroir localStorage seul)' : ''}`
        : `✗ projet « ${entree.id} » non posé : ${issue.message}`;
    },

    /** Charge une CAMPAGNE BUILT-IN sans dérouler le character creator ×4 à la main :
     *  __wfrp.campaign('loup-et-saumure', 42). Sans argument : liste les ids. `sceneId` (optionnel)
     *  démarre ailleurs qu'à l'entrée par défaut. MÊME chemin que le picker `PartyScreen` (`setParty` +
     *  `setPendingCampaign` + `loadProject`) — jamais une reconstruction parallèle de l'état. */
    campaign: (id?: string, seed?: number, sceneId?: string) => {
      if (!id) return builtinCampaigns.map((c) => `${c.id} — ${c.label}`);
      const c = builtinCampaigns.find((b) => b.id === id);
      if (!c) return `✗ « ${id} » introuvable — ids : ${builtinCampaigns.map((b) => b.id).join(', ')}`;
      if (sceneId !== undefined && !c.scenes.some((sc) => sc.id === sceneId)) {
        return `✗ scène « ${sceneId} » introuvable dans « ${id} » — ids : ${c.scenes.map((sc) => sc.id).join(', ')}`;
      }
      const s = g();
      if (seed != null) s.seedRng(seed);
      s.setParty(makeShowcaseParty()); // campagnes built-in sans pré-tirés propres — groupe canonique (4 piliers)
      s.setPendingCampaign(campagneDuJeu(c));
      s.loadProject(c.scenes, sceneId ?? c.startSceneId, c.worldMap ?? null, c.narratif);
      s.setScreen('campaign');
      const after = useGame.getState();
      return `✓ campagne « ${c.label} » chargée (${after.party.length} héros, scène « ${after.scene?.id} »)`;
    },

    /** Lance une bataille de masse de démonstration (ADE II 08) sans scénario : __wfrp.massBattle(60, 40, 3).
     *  Les Scènes de COMBAT ne s'amorcent que si la scène courante porte les rencontres attendues. */
    massBattle: (ally = 50, enemy = 55, rounds = 3) => {
      g().startMassBattle({ allyMight: ally, enemyMight: enemy, plannedRounds: rounds, terrain: 'Les deux armées se font face dans la plaine.' });
      return `✓ bataille de masse lancée — Puissance ${ally} contre ${enemy}, ${rounds} Round(s)`;
    },

    /** RECETTE #380 : arme un INTERLUDE de démonstration jouable sans voyager jusqu'à Altdorf. MÊME
     *  chemin que le flux réel (`startInterlude` : `state.interlude` peuplé — Événement d100 par héros,
     *  budget d'Activités `min(3, semaines)`, écran 'interlude') — le catalogue d'Activités reste dérivé
     *  de la DONNÉE (`interludeCatalog`/`activities.json`), rien d'inventé. Sans groupe chargé, pose le
     *  groupe canonique (`makeShowcaseParty`, comme `campaign()`/`scenario()`). À conduire à la main
     *  ensuite (Activités, clôture). `weeks` (défaut 3) fixe le budget d'Activités observable. */
    interlude: (weeks = 3) => {
      const s = g();
      if (s.battle) return '✗ combat en cours — impossible d\'ouvrir un interlude (voir __wfrp.killEnemies())';
      if (s.interlude) return `interlude déjà ouvert (${Object.keys(s.interlude.perHero).length} héros) — écran 'interlude', à conduire à la main`;
      if (!s.party.length) s.setParty(makeShowcaseParty()); // pas de groupe chargé → 4 piliers canoniques
      s.startInterlude(weeks);
      const after = useGame.getState();
      if (!after.interlude) return '✗ interlude non ouvert — voir __wfrp.state()/__wfrp.log()';
      const budget = Math.min(3, Math.max(1, Math.floor(weeks)));
      return `✓ interlude ouvert (${weeks} sem., ${after.party.length} héros, ${budget} Activité(s) max/héros) — catalogue réel, écran 'interlude' (à conduire à la main)`;
    },

    /** Snapshot COMBAT compact : round, actif, modales ouvertes, et chaque combattant en une ligne. */
    battle: () => {
      const s = g();
      const b = s.battle;
      if (!b) return '✗ pas de combat en cours';
      const pendings = Object.keys(s).filter((k) => {
        if (!/^pending/.test(k)) return false;
        const v = (s as unknown as Record<string, unknown>)[k];
        return Array.isArray(v) ? v.length > 0 : v != null;
      });
      return {
        round: b.round, over: b.over, action: b.action, selectedSpellId: b.selectedSpellId,
        actif: b.order[b.turn], acted: b.acted, movementUsed: b.movementUsed,
        // L'APERÇU ARMÉ tel que le store le porte (`BattleState.preview`), sans projection maison : c'est
        // lui que le 2e clic commet (`targetingModes.samePreview`), donc la seule façon de vérifier
        // qu'un 1er clic a bien armé le geste qu'on croit.
        preview: b.preview,
        modales: pendings,
        combatants: b.combatants.map((c) => ({
          id: c.id, name: c.label, kind: c.kind, pos: c.pos,
          pb: `${c.wounds.current}/${c.wounds.max}`,
          états: (c.conditions ?? []).map((x) => `${x.id}${x.value > 1 ? ` ×${x.value}` : ''}`),
        })),
      };
    },

    /** DERNIER Test résolu (`resolveTest`, en/hors combat) — lecture SEULE de la trace posée par le
     *  SEAM `EVT.TEST_RESOLVED` (`store.ts`), pour lire le DR sans parser `innerText` (recette #514).
     *  `null` si aucun Test résolu depuis le chargement de la page. */
    lastRoll: () => (lastRollTrace ? { ...lastRollTrace } : null),

    /** TRICHE de recette : donne le TOUR à un combattant (réinitialise Action/Mouvement du tour).
     *  Saute les bornes de Round (pas de cascade de fin de Round) — pour mettre en place une
     *  situation, pas pour simuler une partie. */
    turn: (id: string) => {
      const b = g().battle;
      if (!b || b.over) return '✗ pas de combat en cours';
      const idx = b.order.indexOf(id);
      const c = inBattleId(b, id);
      if (idx < 0 || !c) return `✗ « ${id} » absent de l'ordre d'initiative`;
      if (isOutOfAction(c)) return `✗ ${c.label} est hors de combat`;
      useGame.setState({
        battle: { ...b, turn: idx, acted: false, movementUsed: 0, movedPreAction: false, action: null, selectedSpellId: null, preview: null, reachable: new Map(), moveSnapshot: null },
      });
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ au tour de ${c.label}`;
    },

    /** TRICHE de recette : téléporte un COMBATTANT (mise en place de situations LdV/portée). Cible une
     *  COQUE à postes (`postes` non vide) ou un membre d'ÉQUIPAGE de poste (`ShipPoste.crewIds`) →
     *  déplace la FORMATION SOLIDAIRE (coque + tout l'équipage des postes de la coque, MÊME delta —
     *  sémantique de `pushCommitTile`, targetingModes.ts : `pushCommitTile` n'est pas réutilisable ici,
     *  liée à `battle.reachable`/Action/Mouvement du chef ; delta ré-implémenté ici) — téléporter la
     *  coque SEULE désynchronise aperçu (postes) et vérité de portée (équipage resté en arrière), piège
     *  vécu en recette. Combattant simple (ni coque ni crew) : téléportation directe inchangée. */
    place: (id: string, pt: { x: number; y: number }) => {
      const b = g().battle;
      const c = inBattleId(b, id);
      if (!b || !c || !c.pos) return '✗ combattant introuvable (combat uniquement — hors combat : goto)';
      const hull = c.postes?.length ? c : b.combatants.find((h) => h.postes?.some((p) => p.crewIds?.includes(c.id)));
      if (!hull?.pos) {
        c.pos = { ...pt };
        useGame.setState({ battle: { ...b } });
        bus.emit(EVT.SCENE_DIRTY);
        return `✓ ${c.label} → (${pt.x},${pt.y})`;
      }
      const delta = { x: pt.x - c.pos.x, y: pt.y - c.pos.y };
      const crewIds = new Set<string>();
      for (const p of hull.postes ?? []) for (const cid of p.crewIds ?? []) crewIds.add(cid);
      const movers = [hull, ...[...crewIds]
        .map((cid) => inBattleId(b, cid))
        .filter((x): x is Combatant => !!x?.pos && x.id !== hull.id)];
      const moved = movers.map((m) => {
        m.pos = { x: m.pos!.x + delta.x, y: m.pos!.y + delta.y };
        return m.id;
      });
      useGame.setState({ battle: { ...b } });
      bus.emit(EVT.SCENE_DIRTY);
      return { msg: `✓ formation (${hull.label}) → delta (${delta.x},${delta.y}) — ${moved.length} déplacé(s)`, moved };
    },

    /** TRICHE de recette : VIRE le cap d'un NAVIRE (manœuvre, MDG 13) → re-mappe ses arcs de bordée.
     *  `side` = 'tribord'/'babord' (90°) ou un nombre de crans de 45° (>0 tribord, <0 bâbord). Vérifier
     *  ensuite avec `__wfrp.aim('cible')` qu'elle (re)tombe — ou sort — de l'arc. */
    turnShip: (shipId: string, side: 'tribord' | 'babord' | number = 'tribord') => {
      const b = g().battle;
      const ship = inBattleId(b, shipId);
      if (!b || !ship) return '✗ navire introuvable (combat uniquement)';
      const before = g().facing[shipId];
      if (!before) return `✗ ${ship.label} n'a pas de cap (facing) — pas un navire orienté ?`;
      g().shipTurn(shipId, typeof side === 'number' ? side : side === 'tribord' ? 2 : -2);
      return `✓ ${ship.label} : cap ${before} → ${g().facing[shipId]}`;
    },

    /** Recette : MANŒUVRE un navire (MDG 13) — le barreur (meilleur en Voile/Ramer de l'équipage, ou
     *  `helmsmanId`) jette un Test de Navigation → `resolveShipManeuver` → vire SUR RÉUSSITE. `side` =
     *  'tribord'/'babord' (90°) ou crans. Contrairement à `turnShip` (triche), ce virage PEUT échouer. */
    maneuver: (shipId: string, side: 'tribord' | 'babord' | number = 'tribord', helmsmanId?: string) => {
      const b = g().battle;
      const ship = inBattleId(b, shipId);
      if (!b || !ship) return '✗ navire introuvable (combat uniquement)';
      const before = g().facing[shipId];
      const r = maneuverShip(() => useGame.getState(), shipId, typeof side === 'number' ? side : side === 'tribord' ? 2 : -2, helmsmanId);
      if (!r) return '✗ manœuvre impossible';
      return r.success
        ? `✓ ${ship.label} vire (DR ${r.dr}, barreur ${r.helmsman ?? '—'}) : ${before} → ${g().facing[shipId]}`
        : `✗ ${ship.label} rate la manœuvre (DR ${r.dr}) — cap ${before} inchangé`;
    },

    /** Queue LISIBLE des journaux : les `n` dernières lignes du journal d'exploration ET du
     *  feed de combat (texte brut) — fini le mapping à la main dans les recettes. */
    log: (n = 8) => {
      const s = g();
      return {
        journal: s.journal.slice(-n),
        combat: (s.battle?.log ?? []).slice(-n).map((e) => `[${e.kind}] ${e.text}`),
      };
    },

    /** DIAGNOSTIC IA (DEV) : les `n` derniers tours pilotés par l'IA — action CHOISIE + classement des
     *  candidats (l'« intention » : `kind[:sort][→cible]=utilité`, top 8 par utilité ↓). « (forcé) » =
     *  garde psychologie/RAW hors scoring (frénésie/Brisé/Bestial/recover/fin) → classement vide. Défaut 50. */
    aiLog: (n = 50) =>
      aiTurnLog().slice(-n).map((r) =>
        `R${r.round} ${r.label}: ${r.action}${r.top.length ? '  | ' + r.top.map((t) => `${t.kind}${t.spell ? ':' + t.spell : ''}${t.targetId ? '→' + t.targetId : ''}=${t.utility}`).join('  ') : '  (forcé)'}`),

    /** Modale(s) `pending*` ouvertes + les actions de pilotage dérivées (convention <flux>Roll/Confirm/Cancel). */
    modal: () => {
      const s = g() as unknown as Record<string, unknown>;
      const open = Object.keys(s).filter((k) => /^pending/.test(k) && (Array.isArray(s[k]) ? (s[k] as unknown[]).length > 0 : s[k] != null));
      if (!open.length) return { open: [], actions: [] };
      const flux = devFluxOf(open);
      const names = flux ? ['Roll', 'Confirm', 'Cancel'].map((v) => flux + v).filter((n) => typeof s[n] === 'function') : [];
      return { open, pilote: flux ? names : open.includes('pendingRoundStart') ? ['confirmRoundStart'] : [] };
    },

    /** Lance le jet de LA modale ouverte (convention <flux>Roll) */
    roll: () => devDriveModal('Roll'),
    /** Applique/acquitte LA modale ouverte (Round → confirmRoundStart, sinon <flux>Confirm). */
    confirm: () => devDriveModal('Confirm'),
    /** Annule LA modale ouverte (<flux>Cancel). */
    cancel: () => devDriveModal('Cancel'),

    /** RECETTE : élimine tous les ennemis du combat en cours puis passe par le flux de
     *  victoire NORMAL (`checkBattleOver` : finalize, pendingVictory/butin, onVictory).
     *  `dead` couvre aussi les ennemis « importants » que la Mort Subite à 0 PB ne sort pas.
     *  `withQualityLoot` (#380) : à la victoire, INJECTE dans le butin attribuable de l'écran
     *  (`pendingVictory.gear`) un objet CATALOGUÉ portant des qualités — choisi dynamiquement (premier
     *  trapping de `trappings.json` avec `qualities` non vide, pas d'id en dur), par la MÊME brique que
     *  le vrai butin (`gearFromEffects` d'un `giveTrapping`). Défaut inchangé (aucun butin ajouté). */
    killEnemies: (opts?: { withQualityLoot?: boolean }) => {
      const s = g();
      if (!s.battle || s.battle.over) return '✗ pas de combat en cours';
      const slain = s.battle.combatants.filter((c) => c.kind === 'enemy' && !isOutOfAction(c));
      if (!slain.length) return 'aucun ennemi encore debout';
      const combatants = s.battle.combatants.map((c) =>
        c.kind === 'enemy' && !isOutOfAction(c)
          ? { ...c, dead: true, wounds: { ...c.wounds, current: 0 } }
          : c,
      );
      useGame.setState({
        battle: {
          ...s.battle,
          combatants,
          log: [...s.battle.log, ev('info', `Recette : ${slain.length} ennemi(s) éliminé(s).`)],
        },
      });
      checkBattleOver(() => useGame.getState(), useGame.setState);
      // Une cascade peut être ouverte AVANT l'écran de victoire : fin de combat (Tests de Résistance
      // maladie/Corruption, `combatEndBoundary`) OU cascade de SETUP non résolue (Surprise, purpose
      // 'combat' — #345, la victoire est désormais différée tant qu'UNE cascade est ouverte). Recette : on
      // draine d'office (sans influence) TOUTE cascade jusqu'à atteindre la victoire, sinon le drive
      // resterait bloqué sur une modale. Borne dure (la reprise 'combat' relance la boucle checkBattleOver).
      for (let guard = 0; useGame.getState().pendingCascade && !useGame.getState().battle?.over && guard < 8; guard++) {
        useGame.getState().cascadeResolveAll();
        useGame.getState().cascadeFinish();
        if (!useGame.getState().battle?.over) checkBattleOver(() => useGame.getState(), useGame.setState);
      }
      let lootNote = '';
      if (opts?.withQualityLoot) {
        const pv = useGame.getState().pendingVictory;
        const t = trappings.find((x) => x.qualities?.length);
        if (pv && t) {
          const { gear } = gearFromEffects([{ type: 'giveTrapping', trappingId: t.id }]);
          useGame.setState({ pendingVictory: { ...pv, gear: [...(pv.gear ?? []), ...gear] } });
          lootNote = ` — butin qualité ajouté : ${t.label} (${t.qualities.map((q) => q.id).join(', ')})`;
        } else if (!pv) {
          lootNote = ' — butin qualité NON ajouté (pas de victoire : cascade ouverte ou combat en cours)';
        }
      }
      return `✓ ${slain.length} ennemi(s) éliminé(s) — ${useGame.getState().battle?.over ?? 'combat en cours'}${lootNote}`;
    },

    /** RECETTE : inflige `n` Dégâts (op `wounds`, VRAI pipeline `applyOps`) à un combattant du combat — armure
     *  de coque/PA appliquée, États dérivés, puis `checkBattleOver` (reddition/naufrage/victoire). Sert à
     *  éprouver l'issue navale sans jouer chaque tir. `n` par défaut 5. */
    dealDamage: (id: string, n = 5) => {
      const s = g();
      if (!s.battle || s.battle.over) return '✗ pas de combat en cours';
      const target = inBattleId(s.battle, id);
      if (!target) return `✗ « ${id} » introuvable dans le combat — voir __wfrp.battle()`;
      const caster = s.battle.combatants.find((c) => c.kind === 'hero' && !isOutOfAction(c)) ?? target;
      const lines = applyOps(target, [{ op: 'wounds', amount: n }], { caster });
      useGame.setState({
        battle: { ...s.battle, log: [...s.battle.log, ev('info', `Recette : ${n} Dégâts infligés à ${target.label}.`), ...lines.map((l) => ev('info', l))] },
      });
      checkBattleOver(() => useGame.getState(), useGame.setState);
      const after = inBattleId(useGame.getState().battle, id);
      return `✓ ${target.label} : ${after?.wounds.current ?? target.wounds.current}/${target.wounds.max} PB — ${useGame.getState().battle?.over ?? 'combat en cours'}`;
    },

    /** RECETTE : ARME les conséquences de fin de combat (LDB 18/19/20) puis termine le combat par le
     *  flux NORMAL (`checkBattleOver`) en LAISSANT la cascade OUVERTE — contrairement à `killEnemies`
     *  qui la résout d'office. C'est la mise en place de la recette « cascade de fin de combat » :
     *   - `tookCriticalThisFight` posé sur le héros → Test d'Infection post-critique (LDB 20 l.90) ;
     *   - trait `corruption` (Mineure/Modérée/Majeure) posé sur un ennemi présent → Test d'exposition
     *     à la Corruption (LDB 19) pour TOUS les héros survivants ;
     *   - Destin/Résilience CRÉDITÉS au héros (≥1 chacun) → les boutons Chance/Résilience sont visibles
     *     dans la modale (preuve que le Test est INFLUENÇABLE avant l'écran de victoire).
     *  Puis tous les ennemis sont mis hors d'action et `checkBattleOver` ouvre la cascade
     *  (`combatEndBoundary`) AVANT `pendingVictory` — à conduire à la main (cascadeRoll/Next, Chance/
     *  Résilience), sa fermeture enchaîne sur l'écran de victoire. `level` ∈ Mineure|Modérée|Majeure. */
    combatEnd: (opts?: { heroId?: string; critical?: boolean; corruption?: string | false }) => {
      const s = g();
      if (!s.battle || s.battle.over) return '✗ pas de combat en cours';
      const level = opts?.corruption === undefined ? 'Modérée' : opts.corruption;
      const hero = (opts?.heroId
        ? s.battle.combatants.find((c) => c.id === opts.heroId && c.kind === 'hero')
        : s.battle.combatants.find((c) => c.kind === 'hero' && !isOutOfAction(c)));
      if (!hero) return '✗ aucun héros survivant ciblable';
      if (opts?.critical !== false) hero.tookCriticalThisFight = true; // Infection post-critique (LDB 20 l.90)
      hero.woundDressed = false; // pas de pansement → l'Infection s'applique
      hero.fortune = Math.max(1, hero.fortune ?? 0); // Chance visible (relance)
      hero.resilience = Math.max(1, hero.resilience ?? 0); // Résilience visible (« Je ne faillirai pas ! »)
      const enemy = s.battle.combatants.find((c) => c.kind === 'enemy');
      if (level && enemy) {
        const traits = (enemy.traits ?? []).filter((t) => t.id !== 'corruption');
        enemy.traits = [...traits, { id: 'corruption', arg: level }]; // exposition à la Corruption (LDB 85 → 19)
      }
      const combatants = s.battle.combatants.map((c) =>
        c.kind === 'enemy' && !isOutOfAction(c) ? { ...c, dead: true, wounds: { ...c.wounds, current: 0 } } : c,
      );
      useGame.setState({
        battle: { ...s.battle, combatants, log: [...s.battle.log, ev('info', 'Recette : conséquences de fin de combat armées.')] },
      });
      // Flux NORMAL : ouvre la cascade de fin de combat ; si elle s'ouvre (héros manuel), la victoire est
      // DIFFÉRÉE à sa fermeture (on NE la résout PAS ici — c'est tout l'intérêt de la recette).
      checkBattleOver(() => useGame.getState(), useGame.setState);
      const pc = useGame.getState().pendingCascade;
      return pc?.combatEndBoundary
        ? `✓ cascade de fin de combat OUVERTE (${pc.participants.length} jet(s)) AVANT la victoire — conduire à la main`
        : `pas de cascade ouverte (over=${useGame.getState().battle?.over ?? '—'}) — héros non-interactif ?`;
    },

    /** RECETTE : remet le groupe à neuf — PB max, états purgés, critiques/maladies effacés,
     *  morts relevés (party ET clones du combat en cours). */
    healParty: () => {
      const fix = (c: Combatant): Combatant => ({
        ...c,
        wounds: { ...c.wounds, current: c.wounds.max },
        conditions: [],
        criticalWounds: 0,
        diseases: [],
        dead: false,
        outOfRencontre: false,
      });
      useGame.setState((s) => ({
        party: s.party.map(fix),
        battle: s.battle
          ? { ...s.battle, combatants: s.battle.combatants.map((c) => (c.kind === 'hero' ? fix(c) : c)) }
          : s.battle,
      }));
      return `✓ groupe soigné (${g().party.length} héros)`;
    },

    /** RECETTE : crédite les bourses du groupe (couronnes d'or, réparties par tête). */
    give: (gold = 10) => {
      distributeCredit(g, useGame.setState, { gold, silver: 0, brass: 0 });
      return partyMoneyTotal(g);
    },

    /** RECETTE : donne un objet de CATALOGUE à un héros (défaut : le premier), par le VRAI pipeline
     *  `giveTrapping` du store (`applyEffects` → `itemFromGive` : item bien formé, qualités du catalogue,
     *  rangement/Encombrement recalculés). `qty` (optionnel) fixe la quantité de l'instance reçue —
     *  ex. `__wfrp.giveTrapping('hero-1', 'boulet-et-poudre', 6)` pour charger le coffre d'un canon. */
    giveTrapping: (heroId: string | undefined, trappingId: string, qty?: number) => {
      const s = g();
      const hero = heroId ? s.party.find((h) => h.id === heroId) : s.party[0];
      if (!hero) return `✗ héros « ${heroId ?? '(défaut)'} » introuvable — ${s.party.map((h) => h.id).join(', ')}`;
      // Une feuille `giveTrapping` LITTÉRALE ne porte aucun canal de dés (#1508) : la relecture de
      // l'objet donné qui suit ne peut donc pas passer devant un dé — et si ça changeait, ça lèverait.
      nePeutPasDifferer(applyEffects(() => useGame.getState(), useGame.setState, [{ type: 'giveTrapping', trappingId, heroId: hero.id }]), 'devtools.giveTrapping');
      const after = useGame.getState().party.find((h) => h.id === hero.id);
      const it = [...(after?.items ?? [])].reverse().find((i) => i.trappingId === trappingId);
      if (!it) return `✗ don échoué (trappingId « ${trappingId} » inconnu au catalogue ?)`;
      if (qty != null) { it.qty = qty; useGame.setState((st) => ({ party: [...st.party] })); }
      return `✓ ${after!.label} reçoit « ${it.label} »${qty != null ? ` ×${qty}` : ''}`;
    },

    /**
     * RECETTE : POSTE un membre d'équipage à une station de navire (#1508) — l'action RÉELLE du jeu
     * (`setShipStation`), pas une écriture parallèle : c'est elle que la fiche de bord appelle.
     */
    station: (heroId: string, stationId: string | null) => {
      const s = g();
      const hero = s.party.find((h) => h.id === heroId) ?? inBattleId(s.battle, heroId);
      if (!hero) return `✗ héros « ${heroId} » introuvable — ${s.party.map((h) => h.id).join(', ')}`;
      useGame.getState().setShipStation(hero.id, stationId);
      // Le porteur peut n'être QUE dans la file de combat (marin embarqué, pas dans `party`) : relire le
      // seul `party` rendait « station « — » » alors que l'épinglage venait d'être fait.
      const s2 = g();
      const apres = s2.party.find((h) => h.id === hero.id) ?? inBattleId(s2.battle, hero.id);
      return `✓ ${hero.label} → station « ${apres?.shipStation ?? '—'} »`;
    },

    /**
     * RECETTE : inflige un CRITIQUE DE NAVIRE à une Localisation VOULUE (#1508) — pour atteindre en un
     * geste l'épreuve d'équipage « Tomber du gréement » (MDG 13 l.684-688) et ses dés de chute.
     *
     * Le VRAI pipeline s'applique (`applyHullCriticalToTarget` → `applyHullCritical`) : seul le dé de
     * LOCALISATION est imposé, par la même porte que le moteur expose déjà à ses tests. Le d100 voulu se
     * CHERCHE sur la fonction PURE de localisation (`shipHitLocation`) — une prédiction, sans effet — et
     * l'application, elle, reste celle du jeu.
     */
    shipCrit: (location = 'greement', opts: { hullId?: string; forcedCritRoll?: number } = {}) => {
      const s = g();
      const { hullId, forcedCritRoll } = opts;
      const estCoque = (c: Combatant): boolean => !!findVehicleById(c.creatureId ?? '')?.hull;
      const enJeu = (s.battle?.combatants ?? []).filter(estCoque);
      // Par DÉFAUT, la coque des HÉROS — jamais « la première trouvée » : en combat naval, la première
      // est souvent le navire ENNEMI, et la recette frappait le mauvais bord. L'ordre de recherche suit
      // ce que le jeu appelle « notre navire » : la coque du plan de voyage, puis celle qui porte un
      // héros dans son équipage, puis (à défaut) la seule en jeu. `hullId` tranche explicitement.
      const desHeros = (c: Combatant): boolean =>
        (c.crewIds ?? []).some((id) => (s.party.some((h) => h.id === id)) || inBattleId(s.battle, id)?.kind === 'hero');
      const coque = hullId
        ? (enJeu.find((c) => c.id === hullId) ?? (s.travelPlan?.vehicle?.id === hullId ? s.travelPlan.vehicle : undefined))
        : (s.travelPlan?.vehicle ?? enJeu.find(desHeros) ?? (enJeu.length === 1 ? enJeu[0] : undefined));
      if (!coque) {
        if (hullId) return `✗ coque « ${hullId} » introuvable — en jeu : ${enJeu.map((c) => c.id).join(', ') || '(aucune)'}`;
        if (enJeu.length > 1) return `✗ PLUSIEURS coques et aucune n'est celle des héros — nomme-la : shipCrit('${location}', { hullId }) parmi ${enJeu.map((c) => c.id).join(', ')}`;
        return '✗ aucune COQUE en jeu (lance un scénario naval, ou appareille)';
      }
      const gree = findVehicleById(coque.creatureId ?? '')?.hull?.rig ?? 'mixte';
      const table = findVehicleById(coque.creatureId ?? '')?.hull?.locationTable ?? 'navire';
      let de: number | undefined;
      for (let d = 1; d <= 100 && de === undefined; d++) if (shipHitLocation(gree, d, table) === location) de = d;
      if (de === undefined) return `✗ « ${location} » n'est pas une Localisation de ce gréement (${gree})`;
      const log: string[] = [];
      applyHullCriticalToTarget(coque, log, useGame.setState, { get: () => useGame.getState(), forcedLocRoll: de, forcedCritRoll });
      for (const l of log) useGame.getState().log(l);
      return [`✓ Critique de navire « ${location} » (d100 imposé ${de}) sur ${coque.label}`, ...log];
    },

    /** RECETTE : +PX à tout le groupe (teste l'avancement). */
    xp: (amount = 100) => {
      useGame.setState((s) => ({ party: s.party.map((h) => ({ ...h, xp: (h.xp ?? 0) + amount })) }));
      return g().party.map((h) => `${h.label} : ${h.xp} PX`);
    },

    /** RECETTE : drapeaux de scénario (portes de l'arène, etc.). */
    flags: () => g().flags,
    flag: (id: string, value = true) => {
      useGame.setState((s) => ({ flags: { ...s.flags, [id]: value } }));
      return g().flags;
    },

    /** RECETTE #332 : pose le Moral d'équipage (`vessel.morale.score`, MDG 14) — setup DIRECT (même
     *  patron que `flag()`), pas le pipeline hebdomadaire (`recalcMorale`). Rend la désertion à quai
     *  (`moraleBand(score).desertionRoll`, bande ≤75) observable sans dérouler des semaines de facteurs
     *  en espérant tomber sous le seuil. `n` non borné ici (les bandes du catalogue couvrent 0…100+). */
    setMorale: (n: number) => {
      const vessel = g().vessel;
      if (!vessel) return '✗ aucun navire de campagne (state.vessel)';
      useGame.setState({ vessel: { ...vessel, morale: { ...vessel.morale, score: n } } });
      return `✓ Moral d'équipage → ${n}`;
    },

    /** RECETTE #332 : flip du siège MJ SOLO (`setGmSeat`, bac-à-sable local, siège 0) — setup légitime
     *  (3 clics réels × N scénarios par recette). `gmSeat()` sans argument bascule l'état courant ;
     *  `gmSeat(true)`/`gmSeat(false)` force. ATTENTION : le siège SURVIT à `scenario()` (mesuré #1028 : aucun
     *  chemin de lancement ne touche `net.gmSeat`) — le retirer EXPLICITEMENT entre deux scénarios.
     *  La VALIDATION du flux MJ reste la checkbox RÉELLE de l'UI — ce helper économise la mise en place, pas le test. */
    gmSeat: (on?: boolean) => {
      const v = on ?? g().net.gmSeat == null;
      g().setGmSeat(v ? 0 : null);
      return v ? '✓ siège MJ posé (siège 0)' : '✓ siège MJ retiré (IA)';
    },

    /** RECETTE : MÉMORISE un sort au grimoire d'un héros (par id) — jumeau de `talent()` pour la magie.
     *  Passe par l'EFFET MOTEUR `learnSpell` (`state/combatEffects`, trouvaille de campagne, sans PX),
     *  jamais par une écriture parallèle de `c.spells` : ce que la console pose est ce que le jeu pose. */
    spell: (heroId: string, spellId: string) => {
      nePeutPasDifferer(applyEffects(() => useGame.getState(), useGame.setState, [{ type: 'learnSpell', spell: spellId, heroId }]), 'devtools.spell');
      const who = actorIn(useGame.getState(), heroId);
      return who && (who.spells ?? []).includes(spellId)
        ? `✓ ${who.label} mémorise « ${spellId} »`
        : `✗ sort « ${spellId} » non mémorisé — voir le journal`;
    },

    /** RECETTE : octroie un Talent à un combattant (par id) — ex. Mâchoires d'acier pour tester son trigger.
     *  Dernier paramètre : `times` (défaut 1, comportement historique) OU `{ spec?, times? }` pour les talents
     *  `specsSource` dont la mécanique se lit PAR la spec (ex. Magie du Chaos — `chaosDomainOf`,
     *  `combatFeatures/dispatch.ts`, lit `talents[].spec` comme l'id du Domaine — `talent('hero-1',
     *  'magie-du-chaos', { spec: 'tzeentch' })`). */
    talent: (id: string, talentId: string, opts: number | { spec?: string; times?: number } = 1) => {
      const { spec, times } = typeof opts === 'number' ? { spec: undefined, times: opts } : { spec: opts.spec, times: opts.times ?? 1 };
      const grant = (c: Combatant): Combatant => {
        if (c.id !== id) return c;
        const acquis = { ...c };
        for (let i = 0; i < times; i++) acquerirTalent(acquis, { id: talentId, ...(spec != null ? { spec } : {}) });
        return acquis;
      };
      useGame.setState((s) => ({
        party: s.party.map(grant),
        battle: s.battle ? { ...s.battle, combatants: s.battle.combatants.map(grant) } : s.battle,
      }));
      const pose = actorIn(useGame.getState(), id)?.talents?.find((t) => t.talentId === talentId && (t.spec ?? null) === (spec ?? null));
      return pose
        ? `✓ ${id} → ${talentId}${spec ? ` (spec ${spec})` : ''} ×${pose.times}`
        : `✗ ${id} : « ${talentId} » non acquis (Maxi atteint ou combattant absent)`;
    },

    /** RECETTE : pose un Trait de créature sur un combattant, hors combat compris (ex. Marque de Tzeentch
     *  pour dérouler ses Talents de carrière à l'avancement). Passe par `grantTrait`
     *  (`engine/grantedTraits.ts`), le noyau de l'op homonyme et d'`attachMutation`. `opts` : `arg`
     *  (Cible, Domaine…) et `value` (indice). Rend l'état RÉEL relu au store. */
    trait: (id: string, traitId: string, opts: { arg?: string; value?: number } = {}) => {
      if (!findTraitById(traitId)) return `✗ trait « ${traitId} » inconnu`;
      const instance = { id: traitId, ...(opts.arg != null ? { arg: opts.arg } : {}), ...(opts.value != null ? { value: opts.value } : {}) };
      const grant = (c: Combatant): Combatant => {
        if (c.id !== id) return c;
        const porteur = { ...c };
        grantTrait(porteur, instance);
        return porteur;
      };
      useGame.setState((s) => ({
        party: s.party.map(grant),
        battle: s.battle ? { ...s.battle, combatants: s.battle.combatants.map(grant) } : s.battle,
      }));
      const pose = actorIn(useGame.getState(), id)?.traits?.some((t) => t.id === traitId && (t.arg ?? null) === (opts.arg ?? null));
      return pose ? `✓ ${id} → trait ${traitId}${opts.arg ? ` (${opts.arg})` : ''}` : `✗ ${id} : trait « ${traitId} » non posé (combattant absent)`;
    },

    /** RECETTE : simule une CHARGE de `enemyId` sur un héros (défaut : le plus proche) — déclenche le
     *  trigger `onCharged` (Frappe réactive : modale de choix puis Test d'Initiative influençable). C'est
     *  le MÊME appel que le mouvement d'IA quand un ennemi se rue au contact (resolveFreeAttacks). */
    charge: (enemyId: string, heroId?: string) => {
      const s = g();
      const b = s.battle;
      if (!b || b.over) return '✗ pas de combat en cours';
      const enemy = inBattleId(b, enemyId);
      if (!enemy) return `✗ ennemi « ${enemyId} » introuvable`;
      const heroes = b.combatants.filter((c) => c.kind === 'hero' && !isOutOfAction(c));
      const target = heroId
        ? heroes.find((c) => c.id === heroId)
        : (enemy.pos
            ? heroes.slice().sort((a, c) => {
                const d = (h: Combatant) => h.pos ? chebyshev(h.pos, enemy.pos!) : 1e9;
                return d(a) - d(c);
              })[0]
            : heroes[0]);
      if (!target) return '✗ aucun héros chargeable';
      resolveFreeAttacks(() => useGame.getState(), useGame.setState, target, 'onCharged', enemy);
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ ${enemy.label} charge ${target.label} (onCharged)`;
    },

    /** RECETTE : ajoute un Atout/Défaut (par libellé OU id de qualité) à l'arme ACTIVE d'un combattant
     *  et, optionnellement, lui crédite des Avantages — ex. `quality('hero-1','Déstabilisante',2)` pour
     *  tester le renversement onHit influençable. La qualité est reconnue label/id/casse (resolveQualities). */
    quality: (id: string, label = 'Déstabilisante', advantage?: number) => {
      const tweak = (c: Combatant): Combatant => {
        if (c.id !== id) return c;
        const weapons = (c.weapons ?? []).map((w, i) => (i === 0 ? { ...w, qualities: [...(w.qualities ?? []), parseQualityInstance(label) ?? { id: label }] } : w));
        return { ...c, weapons, ...(advantage != null ? { advantage } : {}) };
      };
      useGame.setState((s) => ({
        party: s.party.map(tweak),
        battle: s.battle ? { ...s.battle, combatants: s.battle.combatants.map(tweak) } : s.battle,
      }));
      const c = actorIn(g(), id);
      return c ? `✓ ${c.label} : arme « ${c.weapons?.[0]?.label} » + ${label}${advantage != null ? ` · ${advantage} Av` : ''}` : `✗ ${id} introuvable`;
    },

    /** RECETTE : applique un État à un combattant (par id) via le VRAI addCondition → déclenche les
     *  triggers onGainCondition (Mâchoires d'acier ouvre alors sa modale de Résistance influençable). */
    condition: (id: string, name = 'sonne', n = 1) => {
      const s = g();
      const c = actorIn(s, id);
      if (!c) return `✗ combattant ${id} introuvable`;
      addCondition(c, name, n);
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✓ ${c.label} : +${n} ${name}`;
    },

    /** RECETTE : contracte une MALADIE sur un héros via le VRAI cycle (`contractDisease`) — jamais un état
     *  forgé. `disease('hero-1','vers-de-carie', { phase:'active' })` fait AVANCER l'horloge de la maladie
     *  (`tickDisease` sur son incubation) pour la déclarer, avec le vrai jet de Localisation / transitions.
     *  Défaut : phase d'incubation (comme à la contraction réelle). */
    disease: (heroId: string, maladieId: string, opts?: { phase?: 'incubation' | 'active' }) => {
      const c = actorIn(g(), heroId);
      if (!c) return `✗ combattant ${heroId} introuvable`;
      const dz = contractDisease(maladieId, battleRng());
      if (!dz) return `✗ maladie inconnue : ${maladieId}`;
      c.diseases = [...(c.diseases ?? []), dz];
      // `phase:'active'` : on AVANCE le cycle réel de l'incubation (jamais `phase='active'` posé à la main)
      // → transition, jet de Localisation de la cloque, infectedMinutes… exactement comme le temps qui passe.
      // Les Tests du cycle ne se roulent PLUS nulle part (#1657 B3-3) : la triche les COMPTE et le dit
      // — ils se jouent à la nuit/l'avance d'horloge, par la porte. (Une incubation n'en doit aucun.)
      const dus: string[] = [];
      if (opts?.phase === 'active' && dz.phase === 'incubation') tickDisease(c, dz.minutesLeft, battleRng(), (spec) => dus.push(spec.kind));
      // Les États PORTÉS par les passifs des symptômes (op `condition` — Fièvre (Grave) → Inconscient)
      // sont MATÉRIALISÉS par la réconciliation : sans elle, la triche rendrait un état à moitié vrai.
      syncDerivedConditions(c);
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✓ ${c.label} : ${maladieId} (${c.diseases[c.diseases.length - 1].phase})${dus.length ? ` — ${dus.length} Test(s) dû(s) à la prochaine nuit : ${dus.join(', ')}` : ''}`;
    },

    /** RECETTE : instancie une créature du REGISTRE (`creatures.json`) directement EN COMBAT — VRAI
     *  pipeline (`creatureToCombatant`, `src/state/spawn.ts` — MÊME dérivation que `spawnEnemy`/le
     *  peuplement de scène : profil, armes/armure depuis les Traits, Psychologie, Groupes…), sans
     *  passer par une rencontre de scène. `spawn('gobelin')`, `spawn('gobelin', {x,y}, {side:'hero'})`.
     *  `pos` défaut : à côté du combattant ACTIF (ou, à défaut, le premier combattant positionné) —
     *  `opts.side` (`'enemy'` défaut / `'hero'` / `'npc'`) pose `kind` après coup (`'hero'` marque aussi
     *  `aiControlled` — un allié PNJ du camp héros piloté par l'IA, jamais un 5ᵉ héros manuel). */
    spawn: (creatureId: string, pos?: { x: number; y: number; z?: number }, opts?: { side?: 'hero' | 'enemy' | 'npc'; id?: string }) => {
      const b = g().battle;
      if (!b) return '✗ pas de combat en cours';
      const creature = findCreatureById(creatureId);
      if (!creature) return `✗ créature « ${creatureId} » introuvable au registre`;
      const near = inBattleId(b, b.order[b.turn])?.pos
        ?? b.combatants.find((c) => c.pos)?.pos;
      const basePos = pos ?? (near ? { x: near.x + 1, y: near.y, z: near.z } : { x: 0, y: 0 });
      let id = opts?.id ?? `spawn-${creatureId}`;
      let n = 0;
      while (b.combatants.some((c) => c.id === id)) { n += 1; id = `${opts?.id ?? `spawn-${creatureId}`}-${n}`; }
      const c = creatureToCombatant(creature, id, basePos);
      const side = opts?.side ?? 'enemy';
      if (side === 'hero') { c.kind = 'hero'; c.aiControlled = true; }
      else if (side === 'npc') c.kind = 'npc';
      useGame.setState({ battle: { ...b, combatants: [...b.combatants, c], order: [...b.order, id] } });
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ ${c.label} (${creatureId}) apparu — ${side}, (${basePos.x},${basePos.y})`;
    },

    /** RECETTE : ouvre l'étape de CHOIX « Piège-lame » (LDB 62 l.278-280) — `bladeTrap('hero-1','enemy-1', 2)`.
     *  Le héros `defenderId` a paré avec une arme Piège-lame face à la lame de `attackerId` (uid assigné si
     *  besoin) ; `defSL` = DR de la défense ajouté au Test opposé. Choisir « Piéger » ouvre alors un Test
     *  opposé de Force CADENCE-AWARE (héros manuel → étape influençable) ; succès → désarme (Stupéfiant →
     *  brise sauf Incassable). Reproduit l'entrée de production sans avoir à forcer un Critique défensif. */
    bladeTrap: (defenderId: string, attackerId: string, defSL = 4) => {
      const b = g().battle;
      if (!b) return '✗ pas en combat';
      const defender = inBattleId(b, defenderId);
      const attacker = inBattleId(b, attackerId);
      if (!defender || !attacker) return `✗ défenseur/attaquant introuvable (${defenderId}/${attackerId})`;
      const weapon = attacker.weapons?.[0];
      if (!weapon) return `✗ ${attacker.label} n'a pas d'arme active`;
      if (!weapon.uid) weapon.uid = `dev-blade-${attackerId}`; // uid universel requis pour cibler la lame
      const pbt: PendingBladeTrap = { defenderId, attackerId, weapon, parryWeaponUid: defender.weapons?.[0]?.uid ?? 'parry', defSL, roll: 33 };
      pushChoice(useGame.setState, {
        id: `cons-bladetrap-${defenderId}`, kind: 'bladeTrap', actorId: defenderId, icon: 'item/weapon',
        label: t('step.paradePiegerLame'),
        options: [{ key: 'trap', label: t('opt.piegerLame') }, { key: 'crit', label: t('opt.coupCritique') }],
        defaultChoice: 'crit', bladeTrap: pbt,
      });
      useGame.setState((s) => ({ battle: s.battle ? { ...s.battle, combatants: [...s.battle.combatants] } : s.battle }));
      return `✓ Piège-lame : ${defender.label} pare ${attacker.label} (${weapon.label}, +${defSL} DR) → choix Piéger/Critique`;
    },

    /** RECETTE : met un combattant en FOCALISATION (DR cumulé sur un sort) — `focus('hero-1')` →
     *  Armure Aethyrique DR 3. Frapper ensuite le focaliseur (attaque ennemie / `__wfrp.condition` +
     *  dégâts) déclenche `checkFocusInterruption` : Test de Calme Difficile INFLUENÇABLE (héros manuel). */
    focus: (id: string, spell = 'armure-aethyrique', dr = 3) => {
      const s = g();
      const c = actorIn(s, id);
      if (!c) return `✗ combattant ${id} introuvable`;
      c.focus = { spell, dr };
      useGame.setState((st) => ({
        party: [...st.party],
        battle: st.battle ? { ...st.battle, combatants: [...st.battle.combatants] } : st.battle,
      }));
      return `✓ ${c.label} : Focalisation ${spell} (DR ${dr})`;
    },

    /** RECETTE : pose une Peur active de `heroId` envers `enemyId` (Indice) puis simule l'APPROCHE de la
     *  source (LDB 21 l.27) — `fear('hero-1','enemy-1', 2)`. C'est le MÊME appel que le mouvement d'IA quand
     *  une source de Peur se rapproche (`approachFearTrigger`) : le héros doit réussir un Test de Calme
     *  Intermédiaire (héros manuel → étape de cascade INFLUENÇABLE) ou gagner un État Brisé. */
    fear: (heroId: string, enemyId: string, indice = 2) => {
      const b = g().battle;
      if (!b || b.over) return '✗ pas de combat en cours';
      const hero = inBattleId(b, heroId);
      const enemy = inBattleId(b, enemyId);
      if (!hero || !enemy) return `✗ héros/source introuvable (${heroId}/${enemyId})`;
      if (!hero.pos || !enemy.pos) return '✗ positions inconnues';
      hero.psychState = [
        ...(hero.psychState ?? []).filter((p) => !(p.type === 'peur' && p.sourceId === enemyId)),
        { type: 'peur', sourceId: enemyId, indice, calmeDR: 0 }, // Peur active (non vaincue) envers la source
      ];
      // `fromPos` plus loin que la position actuelle → l'approche est mesurée comme un rapprochement réel.
      const fromPos = { x: enemy.pos.x + Math.sign(enemy.pos.x - hero.pos.x || 1) * 5, y: enemy.pos.y };
      useGame.setState((s) => ({ battle: s.battle ? { ...s.battle, combatants: [...s.battle.combatants] } : s.battle }));
      approachFearTrigger(() => useGame.getState(), useGame.setState, enemy, fromPos);
      bus.emit(EVT.SCENE_DIRTY);
      return `✓ ${enemy.label} (Peur ${indice}) s'approche de ${hero.label} → Test de Calme ou Brisé`;
    },

    /** RECETTE : saute vers une scène du projet/de la campagne par id (machinerie de transition). */
    go: (sceneId: string, entry?: string) => {
      g().transitionTo(sceneId, entry);
      const after = g().scene?.id;
      return after === sceneId ? `✓ scène → ${sceneId}` : `✗ « ${sceneId} » inconnue (scène : ${after ?? '—'})`;
    },

    /** RECETTE : liste les rencontres de la scène (sans argument) ou en lance une. */
    fight: (encounterId?: string) => {
      const encs = g().scene?.encounters ?? [];
      if (!encounterId) return encs.map((e) => e.id);
      if (!encs.some((e) => e.id === encounterId))
        return `✗ rencontre inconnue — dispo : ${encs.map((e) => e.id).join(', ') || 'aucune'}`;
      g().startCombat(encounterId);
      return g().battle ? `✓ combat lancé (${encounterId})` : `rien lancé (rencontre vide ?)`;
    },

    /** RECETTE #30 : services du chantier naval au port — réparation (1 CO/Blessure, MDG 13
     *  l.643), carénage (Salissures, l.150-159), pose d'Amélioration (ch.12 l.195-364). */
    chantier: (what: 'reparer' | 'carener' | string = 'reparer', units = 1) => {
      const get = useGame.getState.bind(useGame);
      const set = useGame.setState.bind(useGame);
      const lines = what === 'reparer' ? portRepairVessel(get, set)
        : what === 'carener' ? portCareenVessel(get, set)
        : portInstallUpgrade(get, set, what, units);
      return lines.join('\n');
    },

    /** RECETTE : avance l'horloge (purge les effets à durée d'horloge). */
    time: (minutes = 60) => {
      g().advanceTime(minutes);
      return `${formatImperial(g().gameTime)}`;
    },

    /** RECETTE : le groupe dort N jours — déroule la cascade quotidienne #T3 (rations/faim,
     *  maladies, convalescence des critiques). */
    rest: (days = 1) => {
      g().restParty(days);
      return `+${days} j → ${formatImperial(g().gameTime)}`;
    },

    /** RECETTE : RÈGLES OPTIONNELLES (policy.ts / « règles maison »). `rules()` liste toutes les règles
     *  (id = valeur · forme) ; `rules(id)` détaille une règle ; `rules(id, value)` la règle (surcharge
     *  RUNTIME, non persistée — elle meurt au rechargement) ; `rules(id, null)` réinitialise au défaut
     *  ET PURGE la surcharge PERSISTÉE (couture joueur `resetHouseRule` → `localStorage`), sinon la
     *  règle ressuscitait cochee au run suivant — piège mesuré en recette (#1279). La remise à zéro est
     *  refusée en combat, comme au panneau : le helper rend alors la raison au lieu de mentir.
     *  Valide la valeur selon le `kind` (flag/param/mode). Le rythme de résolution n'est PAS une règle :
     *  voir `prefs()`. */
    rules: (id?: string, value?: RuleValue | null) => {
      if (id == null) return OPTIONAL_RULES.map((r) => `${r.group} · ${r.id} = ${JSON.stringify(rule(r.id))}  ${settingShape(r)}`);
      const def = ruleDef(id);
      if (!def) return settingUnknown(id, 'rules');
      if (value === undefined) return `${settingDetail(def, rule(id))} — ${def.ref}`;
      if (value === null) {
        const verrou = houseRulesMutability();
        if (!verrou.mutable) return verrou.reason;
        resetHouseRule(id);
        return settingReset(def);
      }
      const c = coerceSetting(def, value);
      if ('err' in c) return c.err;
      setRule(id, c.v);
      return settingDone(id, c.v);
    },

    /** RECETTE : PRÉFÉRENCES de confort (state/preferences.ts) — réglages hors règles de jeu, dont la
     *  CADENCE de combat (`prefs('combat-cadence', 'auto')` : auto = l'IA joue aussi les héros ;
     *  'rapide' = jets auto sans dépense ; 'manuel' = défaut). `prefs()` liste ; `prefs(id)` détaille ;
     *  `prefs(id, value)` écrit par la couture joueur (persistée, effet déclaré joué) ; `prefs(id, null)`
     *  réinitialise. Contrairement aux règles, modifiable EN COMBAT. */
    prefs: (id?: string, value?: PrefValue | null) => {
      if (id == null) return PREFERENCES.map((p) => `${p.id} = ${JSON.stringify(p.get())}  ${settingShape(p)}`);
      const def = preferenceDef(id);
      if (!def) return settingUnknown(id, 'prefs');
      if (value === undefined) return settingDetail(def, def.get());
      if (value === null) { resetPreference(id); return settingReset(def); }
      const c = coerceSetting(def, value);
      if ('err' in c) return c.err;
      setPreference(id, c.v);
      return settingDone(id, c.v);
    },

    /** RECETTE : diagnostic d'AUTO-CADENCE — « pourquoi ça avance / ça se fige ? ». Montre le mode, la
     *  modale active + sa politique, le verdict `willAutoResolve` (rendue ou masquée+auto-pilotée), tous
     *  les `pending*` ouverts, et l'acteur courant (aiDriven). Un `pending*` ouvert avec cadence ≠ manuel
     *  ET `willAutoResolve:false` sans attente de choix joueur = soft-lock probable (modale invisible non pilotée). */
    auto: () => {
      const s = useGame.getState();
      const sr = s as unknown as Record<string, unknown>;
      const open = Object.keys(sr).filter((k) => /^pending/.test(k) && (Array.isArray(sr[k]) ? (sr[k] as unknown[]).length > 0 : sr[k] != null));
      const b = s.battle;
      const act = b && !b.over ? inBattleId(b, b.order[b.turn]) : undefined;
      const key = pickActiveModalKey(s);
      return {
        cadence: cadence(),
        activeModal: key,
        policy: autoPolicyOf(s)?.mode ?? null,
        willAutoResolve: willAutoResolve(s),
        openPendings: open,
        roundPause: !!s.pendingRoundStart,
        medic: !!s.medic,
        active: act ? { id: act.id, kind: act.kind, aiDriven: aiDriven(s, act), acted: !!b!.acted } : null,
      };
    },

    /** RECETTE : ré-ensemence le RNG de bataille (`makeRNG`/`seedBattleRng`, déterminisme) — MÊME action
     *  que `store.seedRng` (utilisée par `scenario(id, seed)` au lancement), exposée pour re-seeder EN
     *  COURS de combat, recette reproductible sans relancer le scénario. */
    seed: (n: number) => {
      g().seedRng(n);
      return `✓ RNG de bataille re-ensemencé (seed ${n})`;
    },

    /** RECETTE #532 : lecture PURE de la séquence d100 d'un seed — instancie un `makeRNG(seed)` À
     *  PART (jamais le `battleRng` du store, ZÉRO mutation d'état) et renvoie ses `count` premiers
     *  tirages `int(1, 100)`. Fidèle au PROCHAIN jet réel du store UNIQUEMENT juste après un
     *  `seed(n)`/`scenario(id, seed)` frais — `battleRng` est PARTAGÉ (initiative/dégâts/IA
     *  s'intercalent), donc toute autre consommation entre-temps désynchronise la prédiction. Deux
     *  previews du même seed renvoient TOUJOURS la même séquence (déterminisme de `makeRNG`). */
    previewRoll: (seed: number, count = 1) => {
      const rng = makeRNG(seed);
      return Array.from({ length: count }, () => rng.int(1, 100));
    },

    /** RECETTE : avance les tours IA jusqu'au prochain tour d'un combattant piloté HUMAIN, une FENÊTRE
     *  à répondre, ou la fin du combat — SANS chemin parallèle : passe par la MÊME machinerie que la
     *  partie réelle (`maybeRunEnemyTurn`/`advanceTurn`/`runEnemyAI`), on accélère seulement les délais
     *  de lisibilité du Réalisateur (`combatDirector.beatHold`, TEMPO) le temps de l'avance — restaurés
     *  à la fin (y compris si `maxIters` est atteint).
     *
     *  CONTRAT (#1852) : il n'AMORCE un tour d'IA que si PERSONNE ne tient la main
     *  (`combatAdvanceBlocked`) et rend la main dès qu'une fenêtre s'ouvre, en la NOMMANT — c'est au
     *  scénario de recette d'y répondre comme un joueur. Il ne joue jamais deux fois le même tour (le
     *  jeton de tour vit dans la machinerie, pas ici). `maxIters` (scrutations, pas des tours) est un
     *  GARDE-FOU anti-boucle infinie, jamais une taille de tour attendue. Un coût de recette, pas un
     *  raccourci du flux testé (doctrine __wfrp : ne saute que le bruit IA, jamais l'action du joueur). */
    fastForward: (maxIters = 400) =>
      new Promise<string>((resolve, reject) => {
        // `globalThis` (pas `window`) : identique en navigateur (window === globalThis) ET testable
        // hors DOM (vitest tourne les tests d'état en environnement 'node', sans `window`). La
        // référence RESTAURÉE doit être la MÊME que celle capturée (jamais un clone `.bind`) — sous
        // fake timers, réassigner un clone empêche `vi.useRealTimers()` de reconnaître son propre
        // mock et casse `globalThis.setTimeout` pour tout test ultérieur du même worker (#flake).
        type TimeoutSetter = (cb: (...a: unknown[]) => void, ms?: number, ...a: unknown[]) => unknown;
        const g2 = globalThis as unknown as { setTimeout: TimeoutSetter };
        const real = g2.setTimeout;
        const fast: TimeoutSetter = (cb, _ms, ...a) => real(cb, 0, ...a);
        g2.setTimeout = fast;
        let restored = false;
        // idempotent + déclenchée sur TOUTE sortie (résolution normale OU exception) : jamais de
        // patch de `setTimeout` qui survit à un throw imprévu dans `status`/`kick`/`tick`.
        const restore = () => { if (!restored) { restored = true; g2.setTimeout = real; } };
        let n = 0;
        let lastKey = ''; // « round:tour » vu à la scrutation précédente
        let stalled = 0;
        const finish = (msg: string) => { restore(); resolve(msg); };
        const fail = (e: unknown) => { restore(); reject(e); };
        const status = (): { done: boolean; msg: string } => {
          const s = g();
          const b = s.battle;
          if (!b || b.over) return { done: true, msg: b?.over ? `✓ combat terminé (${b.over})` : '✓ pas de combat en cours' };
          const c = inBattleId(b, b.order[b.turn]);
          if (!c || !aiDriven(s, c)) return { done: true, msg: `✓ tour de ${c?.label ?? '—'} (piloté)` };
          // UNE FENÊTRE TIENT LA MAIN (#1852) : défense réactive, Critique, pause de Round… Rien n'avancera
          // tant qu'un humain n'aura pas répondu — on REND LA MAIN en la nommant, au lieu de scruter
          // jusqu'à la borne (et, avant, de re-kicker l'IA par-dessus).
          const fenetre = pickActiveModalKey(s);
          if (fenetre) return { done: true, msg: `✓ fenêtre « ${fenetre} » ouverte (à répondre)` };
          return { done: false, msg: '' };
        };
        // CONTRAT DU KICK : `fastForward` ne DÉCIDE rien et ne joue aucun tour à la place de la
        // machinerie — elle est auto-perpétuante (`advanceTurn` rappelle `maybeRunEnemyTurn` à chaque
        // tour). Il ne fait que RAMORCER une chaîne ARRÊTÉE (juste après `confirmRoundStart`, ou un tour
        // immobile), et seulement quand PERSONNE ne tient la main (`combatAdvanceBlocked`) : une fenêtre
        // ouverte appartient au joueur, la pause de Round aussi. Le doublon, lui, est impossible en aval
        // (jeton de tour de `runEnemyAI`/`maybeRunEnemyTurn`, #1852) — ici on ne fait que ne pas le
        // provoquer.
        const kick = () => {
          if (combatAdvanceBlocked(useGame.getState(), { roundStart: true })) return;
          maybeRunEnemyTurn(() => useGame.getState(), useGame.setState);
        };
        const tick = () => {
          try {
            const r = status();
            if (r.done) { finish(r.msg); return; }
            const b = g().battle!;
            const key = `${b.round}:${b.turn}`;
            if (key === lastKey) { if (++stalled === 1) kick(); } else { lastKey = key; stalled = 0; }
            if (n++ >= maxIters) { finish(`✗ borne atteinte (${maxIters} scrutations) sans tour humain — voir __wfrp.auto()`); return; }
            real(tick, 4);
          } catch (e) {
            fail(e);
          }
        };
        try {
          kick(); // amorce si rien n'est déjà en vol (ex. juste après confirmRoundStart)
          tick();
        } catch (e) {
          fail(e);
        }
      }),

    /** RECETTE #297 : symétrique VOYAGE de `fastForward` — pilote la journée en mer EN COURS (cascade
     *  du jour, halte de nuit, Activités hebdo) jusqu'au JOUR SUIVANT, l'arrivée ou un combat.
     *  `maxIters` (scrutations) borne l'anti-boucle infinie, jamais une durée de voyage attendue.
     *  `stopOnEveryEvent` (#380) : arrêt ADDITIONNEL au recap dès qu'un événement de bord RACONTÉ
     *  (routine, non décisionnel — carte-parchemin) vient d'être résolu, pour le constater ; défaut
     *  inchangé (arrêt uniquement au jour suivant / décision présentée). */
    advanceSeaDay: (opts: { stopOnEveryEvent?: boolean; maxIters?: number; stopAt?: string } = {}) =>
      driveSeaVoyage(true, opts.maxIters ?? 400, opts.stopOnEveryEvent ?? false, opts.stopAt),

    /** RECETTE #297 : comme `advanceSeaDay` mais ROULE jusqu'à l'ACCOSTAGE (ou une interruption —
     *  combat, échouage, péripétie d'auteur). `n` (scrutations) borne l'anti-boucle infinie. */
    skipToArrival: (n = 4000) => driveSeaVoyage(false, n),

    /** RECETTE #332 : symétrique FLUVIAL d'`advanceSeaDay` — résout la journée de descente EN COURS
     *  (cascade du jour `travelDay`, cascade d'Exposition hydrique `riverExposure` #344, halte de nuit)
     *  jusqu'au JOUR SUIVANT, l'arrivée ou un combat, aux DÉFAUTS (aucun clic). MÊME pilote que le voyage
     *  maritime (`driveSeaVoyage`, machinerie identique) — juste sans les délais/clics. `maxIters`
     *  (scrutations) borne l'anti-boucle infinie, jamais une durée de descente attendue.
     *  `stopOnEveryEvent` (#380) : arrêt ADDITIONNEL au recap dès qu'un événement de bord raconté vient
     *  d'être résolu (symétrique fluvial de `advanceSeaDay`) ; défaut inchangé. */
    advanceRiverDay: (opts: { stopOnEveryEvent?: boolean; maxIters?: number; stopAt?: string } = {}) =>
      driveSeaVoyage(true, opts.maxIters ?? 400, opts.stopOnEveryEvent ?? false, opts.stopAt),

    /** RECETTE #297 : inflige `n` Dégâts de coque HORS COMBAT (VRAI pipeline — `damageVesselHull` si un
     *  voyage est en cours sur le navire de campagne, sinon `setVesselHull` directement au port) —
     *  SOURCE UNIQUE `state.vessel.wounds` (#296 ; le piège des DEUX copies de coque — `vessel.wounds`
     *  ET la coque de trajet `travelPlan.vehicle` — est documenté dans `docs/recette-navigateur.md`).
     *  Symétrique de `__wfrp.dealDamage` (combat). */
    dealShipDamage: (n = 5) => {
      const s = g();
      if (s.battle) return '✗ combat en cours — voir __wfrp.dealDamage (coque en combat, armure de coque comprise)';
      const vessel = s.vessel;
      if (!vessel) return '✗ aucun navire de campagne (state.vessel)';
      const plan = s.travelPlan;
      // EN VOYAGE : `vessel.wounds` peut être encore ABSENT (jamais persisté depuis l'appareillage,
      // `travelPlan.vehicle` porte alors seul les Blessures réelles, pleines par défaut) — `damageVesselHull`
      // PERSISTE dans les deux cas (#296), donc pas de garde sur `vessel.wounds` sur ce chemin.
      if (plan?.vehicle && plan.vehicle.creatureId === vessel.vehicleId) {
        const lines = damageVesselHull(() => useGame.getState(), useGame.setState, plan.vehicle, n);
        const after = useGame.getState().vessel?.wounds;
        return after ? `✓ coque (voyage) : ${after.current}/${after.max} PB${lines.length ? ' — ' + lines.join(' ') : ''}` : '✗ persistance échouée — voir __wfrp.state()';
      }
      if (!vessel.wounds) return '✗ coque non initialisée (state.vessel.wounds) — hors voyage, embarquer/appareiller ou réparer au port d\'abord';
      const cur = Math.max(0, vessel.wounds.current - n);
      setVesselHull(() => useGame.getState(), useGame.setState, cur, vessel.wounds.max);
      const after = useGame.getState().vessel?.wounds;
      return after ? `✓ coque (au port) : ${after.current}/${after.max} PB` : '✗ persistance échouée — voir __wfrp.state()';
    },

    /** RECETTE #332 : déclenche `beginShipwreck` DIRECTEMENT (setup ASSUMÉ — PAS le pipeline de dégâts
     *  `dealShipDamage`/`damageVesselHull`) — la garde de naufrage n'est évaluée QU'À L'ENTRÉE de
     *  `runSeaDay` (`seaVoyageFlow.ts` : `plan.vehicle.wounds.current <= 0`) : infliger `dealShipDamage(999)`
     *  puis rouler le jour se fait EFFACER par la Réparation de fortune du MÊME jour AVANT que la garde ne
     *  soit re-consultée — piège d'ordonnancement documenté `docs/recette-navigateur.md`. Ce helper appelle
     *  la MÊME fonction que `runSeaDay`/`checkBattleOver` sur naufrage réel, juste sans la course contre
     *  la Réparation de fortune. `aboardIds` (optionnel) restreint les héros à bord (défaut : tout le
     *  groupe vivant, cf. signature `beginShipwreck`). */
    /** RECETTE #1117 : arme le CHAVIRAGE de la PROCHAINE journée fluviale — pose le vent Très fort de
     *  CÔTÉ sur `travelPlan.river` (`riverWindEffect` en dérive `capsizeRisk`, la seule combinaison de
     *  la donnée qui le porte). Le jour suivant construit alors son étape « Retirer la voile » ; son
     *  ÉCHEC ouvre le redressement Round par Round. Aucun dé n'est bidouillé : le Test se joue. */
    forceRiverCapsize: () => {
      const plan = g().travelPlan;
      if (!plan?.river) return '✗ aucune descente fluviale en cours (travelPlan.river)';
      useGame.setState({ travelPlan: { ...plan, river: { ...plan.river, windForce: 'tres-fort', windDir: 'cote' } } });
      // Le clic « Partir » construit les étapes du jour SYNCHRONE : armer après coup ne servait à rien
      // (2 appels sur 3 perdus en recette #1117). On RECONSTRUIT donc la journée EN COURS sur le vent
      // armé — quel que soit le moment de l'appel, l'étape « Retirer la voile » est au programme.
      const rebuilt = riverDayCascade();
      return `✓ vent Très fort de côté armé — ${rebuilt}`;
    },

    /** RECETTE #1117 : (re)POSE la cascade du JOUR fluvial en cours — raccourci symétrique
     *  d'`advanceSeaDay` pour observer les étapes SANS rejouer achat/carte/départ à chaque essai.
     *  Rend le compte d'étapes et leurs `kind` (ce qu'on vient d'armer se voit tout de suite). */
    riverDayCascade: () => riverDayCascade(),

    /** RECETTE #1117 : arme la MÉTÉO de mer du jour EN COURS (`sea.weather`) — `temperature` seule
     *  suffit à observer la cascade d'Exposition (bande Glaciale/Caniculaire = 4 Tests par héros,
     *  Froide/Chaude = 2, Médiane = aucun). Symétrique de `forceRiverCapsize` : aucun dé n'est
     *  bidouillé, la journée se joue. À dérouler avec `advanceSeaDay()`. */
    forceSeaWeather: (opts: { temperature?: string; precipitations?: string; visibilite?: string; vent?: string } = {}) => {
      const plan = g().travelPlan;
      if (!plan?.sea) return '✗ aucune traversée en cours (travelPlan.sea)';
      const weather = { ...plan.sea.weather, ...opts } as typeof plan.sea.weather;
      useGame.setState({ travelPlan: { ...plan, sea: { ...plan.sea, weather } } });
      return `✓ météo de mer armée (${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(', ') || 'inchangée'}) — dérouler avec __wfrp.advanceSeaDay()`;
    },

    /** RECETTE #1117 : arme la SURVITESSE du jour de mer — pose le M EFFECTIF du jour (`sea.effMToday`)
     *  et des milles parcourus, les deux entrées que lit `buildOverspeedStep`. Le seuil RAW est M+5 :
     *  sur une Cogue (M 5), un seul « +1 M » ne le franchit JAMAIS — la note de Survitesse restait
     *  invisible en recette sans cumuler des jours. `overM` = excès VOULU au-dessus du M de conception. */
    forceOverspeed: (overM = 5) => {
      const plan = g().travelPlan;
      if (!plan?.sea) return '✗ aucune traversée en cours (travelPlan.sea)';
      const vd = plan.vehicle ? findVehicleById(plan.vehicle.creatureId ?? '')?.ship : undefined;
      const baseM = vd?.sail?.m ?? vd?.oars?.m ?? 0;
      if (!baseM) return '✗ M de conception introuvable sur le navire de campagne';
      const effMToday = baseM + Math.max(1, overM);
      useGame.setState({ travelPlan: { ...plan, sea: { ...plan.sea, effMToday, milesToday: Math.max(1, plan.sea.milesToday) } } });
      return `✓ survitesse armée : M ${baseM} → ${effMToday} (M+${effMToday - baseM}) — dérouler avec __wfrp.advanceSeaDay()`;
    },

    forceShipwreck: (aboardIds?: string[]) => {
      if (!g().vessel) return '✗ aucun navire de campagne (state.vessel)';
      beginShipwreck(() => useGame.getState(), useGame.setState, aboardIds ? { aboardIds } : {});
      return g().vessel === null ? '✓ naufrage déclenché (coque + cargaison perdues) — voir __wfrp.state()/__wfrp.log()' : '✗ naufrage non déclenché (voir __wfrp.state())';
    },

    /** RECETTE #332 : force un ÉVÉNEMENT DE BORD maritime NOMMÉ (`sea-events.json`) au PROCHAIN jour de
     *  traversée — court-circuite le timer 1d10 + le tirage d100/Manann de `resolveSeaDayEvent` (le
     *  garde `sea.forcedEventId`). `id` = id d'événement (`cogue-pirate`) OU son kind (`navire-hostile`,
     *  premier match). À combiner avec `advanceSeaDay()`/`skipToArrival()` pour LE dérouler sans espérer
     *  la bande d'Humeur. Rend la désertion/l'abordage observable sans dérouler des semaines de tirages. */
    forceEncounter: (id = 'navire-hostile') => {
      const plan = g().travelPlan;
      if (!plan?.sea) return '✗ aucune traversée maritime en cours (state.travelPlan.sea)';
      const event = seaBoardEventById(id);
      if (!event) return `✗ événement « ${id} » introuvable — id ou kind d'événement de bord (sea-events.json)`;
      useGame.setState({ travelPlan: { ...plan, sea: { ...plan.sea, forcedEventId: id } } });
      return `✓ « ${event.label} » forcé au prochain jour — dérouler avec __wfrp.advanceSeaDay()`;
    },

    /** RECETTE #297 : point ON-PATH d'une route de la carte du monde CLIQUABLE depuis ici
     *  (`WorldMapView.tsx` : `pointer-events: stroke` — jamais la bbox, jamais le label) → `{x,y}` ÉCRAN
     *  à cliquer avec un VRAI clic souris (`page.mouse.click`, JAMAIS `dispatchEvent`/`browser_click`).
     *  Le milieu du tracé tombe PARFOIS derrière un décor transparent qui intercepte le clic (piège
     *  vécu) : on SONDE `elementFromPoint` au point calculé et, tant que la chaîne d'ancêtres ne porte
     *  pas `cursor:pointer`, on balaie d'autres fractions de `getPointAtLength` jusqu'à en trouver un
     *  cliquable (repli du recetteur INTÉGRÉ). Piège documenté `docs/recette-navigateur.md` § « Cliquer
     *  une ROUTE de la carte du monde ». */
    clickRoute: (routeId: string) => {
      const s = g();
      const map = s.worldMap;
      if (!map || !s.scene) return '✗ aucune carte du monde ouverte (voir __wfrp.screen(\'worldmap\'))';
      const route = map.routes.find((r) => r.id === routeId);
      if (!route) return `✗ route « ${routeId} » introuvable — ids : ${map.routes.map((r) => r.id).join(', ')}`;
      const here = placeOfScene(map, s.scene.id);
      // Seules les routes RENDUES portent un tracé de hit-test (`WorldMapView.tsx`) — MÊMES prédicats,
      // MÊME ordre : extrémités révélées + offerte depuis ici. Une route qui part vers un lieu caché
      // n'a pas de tracé : la compter décalerait l'index et cliquerait une AUTRE route (#684).
      const clickable = routesRendues(map, s.scene.id);
      const idx = clickable.findIndex((e) => e.route.id === routeId);
      if (idx < 0) return `✗ route « ${routeId} » non cliquable depuis ici (${here?.label ?? '?'})`;
      // La bande CLIQUABLE d'une route est le `path` de HIT de `MapCanvas` (`stroke="transparent"`,
      // `pointer-events: stroke`) — sélecteur RE-MESURÉ au rendu réel en recette #1117 : l'ancien
      // `path[stroke-opacity="0"]` ne correspondait à rien et rendait le helper muet.
      const paths = Array.from(document.querySelectorAll<SVGPathElement>('svg.wm-map path[stroke="transparent"][pointer-events="stroke"]'));
      const path = paths[idx];
      if (!path) return `✗ tracé SVG introuvable pour « ${routeId} » (carte du monde fermée à l'écran ?)`;
      const ctm = path.getScreenCTM();
      if (!ctm) return '✗ getScreenCTM indisponible (carte hors DOM)';
      const total = path.getTotalLength();
      const toScreen = (pt: DOMPoint) => ({ x: Math.round(pt.x * ctm.a + pt.y * ctm.c + ctm.e), y: Math.round(pt.x * ctm.b + pt.y * ctm.d + ctm.f) });
      // Un point est CLIQUABLE si l'élément sous le curseur (ou un de ses ancêtres) porte `cursor:pointer`
      // — la route (ou la couche interactive) le déclare ; un décor transparent interposé ne l'a pas.
      const clickableAt = (x: number, y: number): boolean => {
        let el: Element | null = document.elementFromPoint(x, y);
        while (el) {
          if (getComputedStyle(el).cursor === 'pointer') return true;
          el = el.parentElement;
        }
        return false;
      };
      // Milieu d'abord (comportement historique), puis fractions balayées de part et d'autre.
      const fractions = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8];
      for (const f of fractions) {
        const pt = toScreen(path.getPointAtLength(total * f));
        if (clickableAt(pt.x, pt.y)) {
          return { ...pt, note: `point ON-PATH cliquable (fraction ${f} — chaîne d'ancêtres porte cursor:pointer) : cliquer ces coordonnées ÉCRAN avec un VRAI clic souris (page.mouse.click)` };
        }
      }
      const mid = toScreen(path.getPointAtLength(total / 2));
      return { ...mid, note: 'AUCUNE fraction du tracé ne teste cliquable (elementFromPoint sans cursor:pointer) — la carte est peut-être masquée/hors premier plan ; milieu renvoyé par défaut' };
    },

    /** RECETTE #518 : remplit le brouillon du créateur de personnage OUVERT avec des défauts VALIDES
     *  jusqu'à `uptoStep` incluse (défaut : dernière étape — prêt à créer), puis avance l'étape
     *  affichée. SETUP UNIQUEMENT (sauter jusqu'à une étape sans dérouler les tirages/choix un par un)
     *  — le flux joueur réel se teste aux clics, jamais via ce raccourci. Couture `CharacterCreator.tsx`
     *  (`window.__wfrpCreator.fill`, même patron que `__wfrpSetHover`) : devtools n'importe RIEN de
     *  `src/ui` (règle 3, layering) — la logique de remplissage (`fillDraftDefaults`) et les ids
     *  d'étape restent côté `ui/creator`. Erreur lisible si le créateur n'est pas monté à l'écran. */
    fillCreatorDefaults: (uptoStep?: string) => {
      const w = window as unknown as { __wfrpCreator?: { fill: (upto?: string) => string } };
      const c = w.__wfrpCreator;
      return c ? c.fill(uptoStep) : t('dev.creatorNotMounted');
    },
  };
}

export function installDevtools() {
  const w = window as unknown as { __wfrp?: ReturnType<typeof buildApi>; __game?: typeof useGame };
  w.__wfrp = buildApi();
  w.__game = useGame; // handle brut du store (à côté de __wfrp) pour les recettes navigateur
  setAiTrace(true); // DEV uniquement (devtools chargé en dev) → la trace de décision IA s'enregistre
}
