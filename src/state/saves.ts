/**
 * Sauvegarde / chargement de partie (Jalon 5) — localStorage + export/import JSON.
 *
 * Snapshot ZÉRO-MAINTENANCE : on copie les clés de DONNÉES de `getInitialState()` depuis l'état
 * courant (toute nouvelle donnée d'état future est sauvée gratis — même principe que le reset de
 * partie, qui repart de `useGame.getInitialState()` — JAMAIS d'une liste de champs tenue à la main) ;
 * les actions (fonctions zustand) sont ignorées.
 * La scène vivante (mutée : fouilles consommées, entités retirées…), les flags, l'inventaire,
 * l'horloge et le groupe voyagent donc dans la save.
 *
 * Sauvegarde HORS COMBAT uniquement (battle non-null refusé par l'action store) : l'état
 * tactique suspendu (IA, modales de combat) n'est pas un point de reprise sûr.
 *
 * Les règles maison (surcharges de `policy.ts`, hors GameState) voyagent à part dans `rules` :
 * une save reste portable d'une machine à l'autre AVEC ses règles (le localStorage ne suffit pas).
 *
 * POLITIQUE DE VERSION (arbitrage utilisateur 2026-08-17) — deux filets DISTINCTS :
 * 1. Champs manquants (donnée AJOUTÉE depuis la save) : tolérés gratuitement par le zustand `set`
 *    au chargement (`applyLoadedSave`, `store.ts`) — un champ absent du snapshot chargé garde sa
 *    valeur d'`initialFields` (`stateFields.ts`), jamais `undefined`.
 * 2. Changement de FORME persistée : bump de `SAVE_VERSION`, et RIEN d'autre — aucune chaîne de
 *    migration, aucune fixture golden. Une save dont la version diffère de `SAVE_VERSION`
 *    (antérieure comme future) est REJETÉE et RETIRÉE du stockage à la lecture (`readSlot`), avec
 *    un message au joueur (témoin `takeObsoleteNotice`, rendu par `ui/SaveLoadModal`).
 */
import type { RuleValue } from '../engine/policy';
import type { Scene } from './scene';

// 32 → 33 (L2 #1548, geste modèle) : une personne se RÉFÉRENCE. Le document de scène (`scene`) perd
// les deux pseudo-PNJ écrits en clair — l'effet `medicalAid` ne porte plus que son `entityId` (la
// Guérison et le Bonus d'Int se lisent sur la fiche du PNJ), et les adversaires de `startPursuit`
// sont des références de vivant (`{ ref }`) là où vivaient `label`+`movement`+`skill`. Une save de 32
// rouvrirait une infirmerie sans soigneur et une poursuite sans coureurs : elle se jette
// (politique 2 ci-dessus).
// 33 → 34 (L2 #1548, commit 4) : le VOCABULAIRE de spécialisation persisté par un héros change. Les
// emplacements d'avancement (`careerLevels.json`/`species.json`) ne portent plus le LIBELLÉ imprimé
// mais l'id de catalogue (« Érudit » → `erudits`, « Guilde » → `guildes`… 14 paires), et
// `slotCovers`/`specResolves` apparient par ÉGALITÉ STRICTE : mesuré, `slotCovers(slot,
// 'savoir-vivre', 'Érudit')` rend `false` là où `'erudits'` rend `true`. Un héros de 33 garderait un
// Talent qui ne couvre plus son emplacement — avance silencieusement perdue, retombée sur la
// Caractéristique nue : la save se jette (politique 2 ci-dessus).
// 34 → 35 (L2 #1548, commit 4bis) : la `SkillInstance` d'une créature SPAWNÉE change de forme. La
// sentinelle `spec: "au choix"` du bestiaire descendait TELLE QUELLE dans l'instance persistée (une
// spéc qu'aucun catalogue ne résout) ; elle est désormais DÉSIGNÉE au spawn (`skillsFromBook`, seedée
// sur l'uid) et l'instance porte une spéc CONCRÈTE. PORTÉE EXACTE DE LA PERTE, mesurée à
// `src/engine/skills.ts` (`s.id === skill && (spec == null || s.spec === spec)`) : un appelant
// SANS spec appariait l'instance et lisait sa valeur — c'est le Test SPÉCIALISÉ qui n'appariait rien
// et retombait sur la Caractéristique nue. Les scènes vivantes d'une save de 34 rouvriraient avec des
// pions dont les 53 lignes sentinelles échouent à tout Test spécialisé : la save se jette
// (politique 2 ci-dessus).
// 35 → 36 (L2 #1548, commit 5) : la `SkillInstance` PERSISTÉE change de forme — son champ d'identité
// `skillId` devient `id`, le terme unique de la grammaire des références. Une save de 35 rouvrirait
// avec des instances dont l'id est `undefined` : chaque appariement de `src/engine/skills.ts`
// (`s.id === skill`) échouerait et TOUT Test de Compétence retomberait sur la Caractéristique nue,
// Augmentations comprises. La save se jette (politique 2 ci-dessus).
// 36 → 37 (#717) : le cadre de campagne entre au snapshot — `objectifsSoldes` (archive des objectifs
// soldés), `chapitreDepuis` (borne d'ouverture), `clotureConsommee` (la clôture déjà jouée),
// `pendingOuverture`/`pendingChapterRecap`. Une save de 36 rouvrirait sans borne : le récap de fin de
// chapitre compterait les PX depuis le néant, et une séance déjà close se ré-armerait au premier lot
// d'effets (la Condition de clôture, elle, est restée vraie).
// 37 → 38 (#1552) : le document de SCÈNE change de forme — une scène s'annonce désormais
// (`type: 'scene'`, exigé par `sceneSchema`). `snapshotSave` recopie le `state` ENTIER dans `data`,
// `state.scene` comprise : une save de 37 rouvrirait sur une scène vivante sans `type`, que le seam
// `parseProject` refuserait au prochain export/import de son projet. La save se jette
// (politique 2 ci-dessus).
// 38 → 39 (2026-09-02, #1680 lot 1b) : le VOCABULAIRE des ids de place PERSISTÉ change. Une place de
// meuble n'est plus nommée par son côté mais par son RANG (`place-nord` → `place-1`, 6 ids de
// `props.json`) — un id cardinal mentait dès que le repère de la recette bougeait. `snapshotSave`
// recopie le `state` ENTIER, `state.scene.seatAssignments` comprise, dont les CLÉS sont ces ids
// (`propId → slotId`). Une save de 38 rouvrirait avec des clés que le catalogue ne connaît plus :
// `pruneSeatAssignments` (`store.ts:88`) les élague AVANT l'entrée en état, et tous les assis se
// lèveraient EN SILENCE — aucun message, aucune trace. La save se jette (politique 2 ci-dessus).
// 39 → 40 (#1657 B2a, #1682) : le déclencheur d'escalade PERSISTÉ sur une séquelle
// (`Trauma.critTrigger`) change de forme — sa graphie propriétaire `{resist:{difficulty, onFail}}`
// devient le nœud `test` du Flow (`noeudTest`), la forme UNIQUE du jet en donnée. Une save de 39
// rouvrirait avec une Commotion cérébrale dont `test` est `undefined` : `fireCritTriggers` lirait
// `trig.test.test.difficulty` sur rien et le critique suivant crasherait. La save se jette
// (politique 2 ci-dessus).
// 41 → 42 (#1509) : les cases qu'un décor à recette OCCUPE ne se lisent plus sur son `foot` déclaré
// mais se DÉRIVENT de son corps TOURNÉ au cap de l'instance. Aucune instance LIVRÉE ne change (les 140
// décors volumiques authored rendent la même empreinte qu'avant), mais `snapshotSave` recopie le
// `state` ENTIER, `state.scene.entities` comprise : une save porte la scène ÉDITÉE du joueur, où rien
// n'empêche de poser `table-2x1` au cap E — le schéma ne refuse que la diagonale. Une telle save,
// rouverte, changerait de MARCHABILITÉ : les cases bloquées passeraient de (x,y)+(x+1,y) à
// (x,y)+(x,y+1), et un héros sauvegardé sur l'une d'elles se retrouverait DANS le meuble. La save se
// jette (politique 2 ci-dessus).
// 42 → 43 (#1657 B3-1) : le MÊME `Trauma.critTrigger` persisté gagne son ENJEU (`test.test.stake`,
// posé à l'armement par `stampCriticalEscalation`). Le nœud ne s'auto-résout plus au moteur : il part
// par la porte, et le mint d'étape REFUSE un enjeu muet (`monoStep`, `rollSeam.ts`). Une save de 42
// rouvrirait avec une Commotion cérébrale sans enjeu : le critique suivant ouvrirait une fenêtre
// refusée au lieu du Test. La save se jette (politique 2 ci-dessus).

// 43 → 44 (#1657 B3-1b) : le marqueur d'amputation DIFFÉRÉE persisté (`Trauma.pendingAmputation`,
// « Coupure à l'orteil ») change de forme — la donnée `Amputation` (`{difficulty, sequels, loss…}`)
// devient le/les nœud(s) `test` FABRIQUÉS au critique, enjeu posé (même patron que `critTrigger`).
// Une save de 43 rouvrirait avec un marqueur que `prendreAmputationsDifferees` enverrait tel quel à
// `routeTriggeredTest` : un objet sans `kind`, ni Test ouvert ni séquelle posée. La save se jette
// (politique 2 ci-dessus).

// 44 → 45 (#1657 B3-2) : le `kind` d'étape `riverSplinterDodge` SORT du vocabulaire — le coup à
// l'équipage d'un Critique de bateau passe par la porte (`triggeredBatchTest`). `pendingCascade` est
// persisté : une save de 44 prise sur une journée fluviale dont l'esquive d'éclats est ouverte
// rouvrirait avec une étape dont plus aucun applier n'est enregistré — le jet se validerait sans
// conséquence, en silence. La save se jette (politique 2 ci-dessus).

// 45 → 46 (#1657 B3-3, corrige #1685) : les étapes d'entretien PERSISTÉES (`pendingCascade`,
// `deferredUpkeepQueue` — cycle de maladie, Exposition, Récupération, contagion, convalescence)
// portaient une ligne montée sur une valeur qui IGNORAIT les États du porteur (#1685, `LDB 16
// l.125`). La forme du pas est la même, mais ses NOMBRES (base, mods, target)
// ne sont plus ceux de la porte : une save de 45 rouvrirait une fenêtre déjà montée dont la cible est
// celle d'avant (jusqu'à +30 en faveur du joueur sur un héros sous États), sans qu'aucun applier ne
// puisse la recalculer. La save se jette (politique 2 ci-dessus).
// 46 → 47 (#1599) : les États PORTÉS par un canal passif sont désormais MARQUÉS (`ConditionInstance.
// derivedFrom`) et réconciliés (`syncDerivedConditions`). Une save de 46 porte les mêmes pions SANS
// marquage : à la première réconciliation, la cible (1) et les pions dérivés comptés (0) divergent — le
// porteur regagne un Inconscient/Exténué par-dessus celui qu'il a déjà. La save se jette (politique 2).
// 47 → 48 (#1599) : la suspension d'un fait passif est GÉNÉRALE — l'`ActiveEffect` porte désormais
// `suppressedSource` (identité Codex) là où il portait `suppressedSymptom` (id nu). Une save de 47 rouvre
// avec des fenêtres de suspension (Racine de terre, fenêtre de Détermination) que plus aucun lecteur ne
// voit : le symptôme réémet ses passifs et l'État qu'il porte revient, sans que rien ne le dise. La save
// se jette (politique 2 ci-dessus).
// 48 → 49 (#1695) : un État « pour la durée du Sort » (LDB 48 l.495) est PORTÉ par l'effet actif du sort
// (`ActiveEffect.passive`) au lieu d'être copié sur le pion (`ConditionInstance.roundsLeft`). Une save de
// 48 prise en plein Transmutation de Chamon rouvre avec des pions à `roundsLeft` SANS effet porteur : ils
// tiennent leur propre compte, la Dissipation ne les emporte plus et la Détermination n'a plus de source à
// suspendre. La save se jette (politique 2 ci-dessus).
// 49 → 50 (#1791) : `ActiveEffect.passive` est le canal UNIQUE des passifs d'effet — les quatre champs
// scalaires (`skillMods`, `moveScale`, `moveMod`, `maxWeaponHands`) sont supprimés du type. Une save de 49
// rouvre avec des effets qui portent ces champs et plus rien ne les lit : le −10 d'Esquive du sort, le
// demi-Mouvement et le plafond de mains d'arme disparaissent en silence. La save se jette (politique 2
// ci-dessus).
// 50 → 51 (#1897) : 54 ids de sort du livre fan sont FUSIONNÉS dans l'entrée qui les double
// (`SORTS_FUSIONNES_1897`, `src/data/sortsFusionnes.ts`) et n'existent plus. `snapshotSave` recopie le `state`
// ENTIER, `Combatant.spells` des héros et des pions de la scène vivante comprise : une save de 50 rouvrirait
// un héros dont `findSpellById` ne résout plus le sort appris (`grimoire.ts`) — il disparaît de son
// grimoire EN SILENCE. La save se jette (politique 2 ci-dessus).
// 51 → 52 (#1473, train 2a) : les ops `grantTalent` / `grantCareerTalent` persistées passent de
// `{ talentId, spec? }` à `{ talent: { id, spec? } }` — `Combatant.mutations[].passive`,
// `ActiveEffect.grantedMutation.passive` / `.passive` / `.opsPerRound`, `ItemInstance.consumable`, les `Flow`
// de la scène vivante, du `campaignDoc` et de `scheduledEffects`, et les étapes de `pendingCascade` /
// `suspendedCascades` — et une mutation attachée porte désormais `Combatant.mutations[].talentsAcquis`.
// Une save de 51 rouvrirait avec des ops en `talentId` sur lesquelles l'octroi (`applyOps`) lève, et des
// mutations attachées sans `talentsAcquis` dont le détachement garderait le Talent octroyé. La save se
// jette (politique 2 ci-dessus).
export const SAVE_VERSION = 52;

export interface SaveMeta {
  version: number;
  /** ISO — horodatage réel de la sauvegarde (méta d'affichage). */
  savedAt: string;
  /** Étiquette du slot (nom de la scène courante). */
  sceneLabel: string;
  /** Horloge de jeu (minutes) au moment de la sauvegarde. */
  gameTime: number;
}

export interface SaveGame extends SaveMeta {
  /** Clés de données de GameState (deep-copiées, JSON-sûres). */
  data: Record<string, unknown>;
  /** Surcharges de règles maison (`policy.ts`) actives à la sauvegarde — optionnel : une save
   *  d'avant ce champ n'en a pas (on garde alors les règles courantes de la machine au chargement). */
  rules?: Record<string, RuleValue>;
}

export type SaveSlot = 1 | 2 | 3;
export const SAVE_SLOTS: SaveSlot[] = [1, 2, 3];
/** Emplacement AUTO (écrit par l'auto-save aux checkpoints ; chargeable, jamais écrit à la main). */
export const AUTO_SLOT = 'auto' as const;
export type AnySlot = SaveSlot | typeof AUTO_SLOT;
// #898 : la clé n'embarque plus la version (un bump de `SAVE_VERSION` rendait toute save existante
// invisible — `readSlot`/`listSaves` sondaient une clé qui n'avait jamais été écrite). La version vit
// SEULE dans le contenu (`SaveGame.version`). `LEGACY_KEY` ne sert plus qu'à NETTOYER les clés
// versionnées écrites par le code d'avant #898 : aucune ne porte la version courante.
const KEY = (slot: AnySlot) => `wfrp4.save.${slot}`;
const LEGACY_KEY = (version: number, slot: AnySlot) => `wfrp4.save.v${version}.${slot}`;

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // accès refusé (mode privé strict, iframe sandbox…)
  }
}

/**
 * Les clés de DONNÉES qui ne partent PAS en save — l'ensemble NOMMÉ, une raison par clé. Le contrat
 * du snapshot est POSITIF (tout champ de données de l'état initial entre), donc une exclusion qui
 * n'est pas ici n'existe pas : c'est le seul endroit à lire et à amender.
 *
 * La même couture sert la sauvegarde locale ET le snapshot réseau (`state/netFlow.ts`
 * `netSnapshot`) : ce qui sort d'ici ne traverse pas non plus vers un invité coop.
 */
const HORS_SAVE: Record<string, string> = {
  // #767 — couche runtime posée par `loadProject` ; sa persistance (forme + golden + bump
  // `SAVE_VERSION`) est le périmètre de #766.
  campaignNarratif: 'couche runtime de projet, repostée au chargement',
  // #1687 — état de la TOUCHE Alt à l'instant, pas une préférence : une save qui le porterait
  // rechargerait une partie aux utilisables révélés, touche relâchée.
  reveler: 'geste clavier en cours, jamais un état de partie',
  // #1478 — drapeaux de RECETTE (`__wfrp.labels`, `__wfrp.roofCut`), jamais une préférence de
  // partie : une save prise en recette rechargerait la carte annotée ou le lève-toit débrayé, et
  // l'invité coop en hériterait par `netSnapshot`.
  debugLabels: 'drapeau de recette (overlay de debug)',
  debugRoofCut: 'drapeau de recette (lève-toit débrayé)',
};

/** Snapshot des clés de DONNÉES de l'état courant (les fonctions/actions sont ignorées). */
export function snapshotSave(
  state: Record<string, unknown>,
  initial: Record<string, unknown>,
  savedAt: string,
  rules: Record<string, RuleValue> = {},
): SaveGame {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(initial)) {
    if (k in HORS_SAVE) continue; // exclusions NOMMÉES, avec leur raison, ci-dessus
    const v = state[k];
    if (typeof v === 'function') continue;
    data[k] = v === undefined ? null : v;
  }
  // Le document de scène est TYPÉ ici (jamais une forme structurelle ad hoc) : le `state` d'entrée est
  // un `Record` opaque, et un cast maison sur les noms de champs rendrait un renommage de `Scene`
  // INVISIBLE au typecheck — `sceneLabel` retomberait en silence sur l'id. Garde : `saves-flow.test.ts`.
  const scene = state.scene as Pick<Scene, 'label' | 'id'> | null;
  const copie = JSON.parse(JSON.stringify(data)) as Record<string, unknown>; // deep copy JSON-sûre
  purgeFoldMemo(copie.pendingCascade);
  purgeFoldMemo(copie.suspendedCascades);
  return {
    version: SAVE_VERSION,
    savedAt,
    sceneLabel: scene?.label ?? scene?.id ?? 'Sans scène',
    gameTime: typeof state.gameTime === 'number' ? state.gameTime : 0,
    data: copie,
    rules: { ...rules },
  };
}

/**
 * SECRET DES POSES — le mémo de pli d'une étape à table (`CascadeStep.foldMemo`, `cascade.
 * tableStepResolved`) porte les conséquences des dés EXPLORÉS PUIS ABANDONNÉS par le siège qui pose.
 * Il ne quitte JAMAIS ce siège : ni dans la sauvegarde, ni dans le snapshot coop diffusé aux autres
 * tables. Une seule couture pour les deux — `netFlow.netSnapshot` passe par `snapshotSave`.
 * Un rechargement re-dérive le pli à la première re-pose (le mémo est un cache, pas une donnée).
 */
function purgeFoldMemo(v: unknown): void {
  if (Array.isArray(v)) { for (const x of v) purgeFoldMemo(x); return; }
  if (!v || typeof v !== 'object') return;
  const o = v as Record<string, unknown>;
  delete o.foldMemo;
  for (const k of Object.keys(o)) purgeFoldMemo(o[k]);
}

// ── Règles maison dans le snapshot COOP (parité hôte/invité) ──────────────────────────────────
// Le snapshot réseau n'a qu'un champ `data` opaque (cf. net/session) : les surcharges de `policy.ts`
// y voyagent sous une clé RÉSERVÉE. Helpers PURS (testés), réutilisés par netFlow.

/** Clé réservée du payload coop transportant les règles maison (hors GameState). */
export const HOUSE_RULES_KEY = '__houseRules';

/** Joint les règles maison au snapshot coop (sous la clé réservée). */
export function packHouseRules(data: Record<string, unknown>, rules: Record<string, RuleValue>): Record<string, unknown> {
  return { ...data, [HOUSE_RULES_KEY]: rules };
}

/** Sépare les règles maison du reste de l'état (clé réservée retirée de `game` → pas de pollution). */
export function unpackHouseRules(data: Record<string, unknown>): { game: Record<string, unknown>; rules?: Record<string, RuleValue> } {
  const { [HOUSE_RULES_KEY]: rules, ...game } = data;
  return { game, rules: rules as Record<string, RuleValue> | undefined };
}

/** Validation de forme d'une save (version COURANTE + data objet). */
export function isValidSave(s: unknown): s is SaveGame {
  return !!s && typeof s === 'object'
    && (s as SaveGame).version === SAVE_VERSION
    && typeof (s as SaveGame).savedAt === 'string'
    && !!(s as SaveGame).data && typeof (s as SaveGame).data === 'object';
}

/** Lit un document de save parsé : la version DOIT être `SAVE_VERSION`. Toute autre version —
 *  antérieure comme future — et toute forme invalide rendent `null`. */
export function parseSave(parsed: unknown): SaveGame | null {
  return isValidSave(parsed) ? parsed : null;
}

/** CAUSE du rejet d'une sauvegarde — l'écran de chargement en fait un message DISTINCT : la save
 *  d'une version antérieure, celle d'une version plus récente (retour à un build ancien) et le
 *  contenu illisible ne se disent pas d'un même mot. */
export type ObsoleteCause = 'anterieure' | 'future' | 'illisible';

/** Témoin « une sauvegarde a été trouvée puis retirée » + sa cause — posé par `readSlot`, consommé
 *  par l'écran de chargement. La PREMIÈRE cause d'une salve de lectures (`listSaves` en balaie trois)
 *  est celle qui parle : elle correspond à l'emplacement le plus haut de la liste. */
let obsoleteCause: ObsoleteCause | null = null;

/** Consomme le témoin de rejet (et le remet à zéro) — la cause si une save a été retirée du stockage
 *  depuis la dernière consommation, `null` sinon. */
export function takeObsoleteNotice(): ObsoleteCause | null {
  const c = obsoleteCause;
  obsoleteCause = null;
  return c;
}

/** Clé de mise à l'écart d'une save FUTURE, écrite par le code d'AVANT l'arbitrage 2026-08-17 (une
 *  save plus récente que l'app y était sauvegardée avant écrasement). Plus personne ne l'écrit : elle
 *  n'est plus qu'à PURGER, comme le reste de l'emplacement. */
const FUTURE_KEY = (slot: AnySlot) => `wfrp4.save.future.${slot}`;

/** TOUTES les clés de stockage d'un emplacement : la clé stable, la clé de QUARANTAINE historique et
 *  les clés VERSIONNÉES historiques (`wfrp4.save.vN.slot`, #898). */
function slotKeys(slot: AnySlot): string[] {
  const keys = [KEY(slot), FUTURE_KEY(slot)];
  for (let v = 1; v <= SAVE_VERSION; v++) keys.push(LEGACY_KEY(v, slot));
  return keys;
}

/** JETTE le contenu d'un emplacement (toutes ses clés) et pose le témoin de message avec sa cause. Un
 *  stockage qui refuse la suppression ne fait pas échouer la lecture — le message part quand même. */
function discardSlot(s: Storage, slot: AnySlot, cause: ObsoleteCause): void {
  obsoleteCause ??= cause;
  try {
    for (const k of slotKeys(slot)) s.removeItem(k);
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

export function saveToSlot(slot: AnySlot, save: SaveGame): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(KEY(slot), JSON.stringify(save));
    return s.getItem(KEY(slot)) != null; // confirme l'écriture (quota plein → null)
  } catch {
    return false;
  }
}

/** Cause du rejet d'un document parsé dont la forme n'est pas celle d'une save COURANTE : la version
 *  la dit quand elle est lisible, sinon le document est simplement illisible. */
function causeOf(parsed: unknown): ObsoleteCause {
  const v = (parsed as { version?: unknown } | null | undefined)?.version;
  if (typeof v !== 'number') return 'illisible';
  return v > SAVE_VERSION ? 'future' : 'anterieure';
}

/** Cause du rejet d'un emplacement SANS clé stable mais dont une clé résiduelle survit : la clé de
 *  quarantaine ne portait que des saves FUTURES, une clé versionnée que des versions antérieures. */
function residualCause(s: Storage, slot: AnySlot): ObsoleteCause | null {
  if (s.getItem(FUTURE_KEY(slot)) != null) return 'future';
  return slotKeys(slot).some((k) => s.getItem(k) != null) ? 'anterieure' : null;
}

/** Lit l'emplacement : une save à `SAVE_VERSION`, ou `null`. Tout contenu d'une AUTRE version (clé
 *  stable, clé de quarantaine ou clé versionnée historique) ou illisible est JETÉ, témoin posé. */
export function readSlot(slot: AnySlot): SaveGame | null {
  const s = storage();
  if (!s) return null;
  let raw: string | null;
  try {
    raw = s.getItem(KEY(slot));
  } catch {
    return null;
  }
  if (raw == null) {
    try {
      const cause = residualCause(s, slot);
      if (cause) discardSlot(s, slot, cause);
    } catch {
      // stockage devenu indisponible en cours de sondage : rien à jeter
    }
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    discardSlot(s, slot, 'illisible'); // contenu illisible : il ne redeviendra jamais chargeable
    return null;
  }
  const save = parseSave(parsed);
  if (!save) {
    discardSlot(s, slot, causeOf(parsed));
    return null;
  }
  // La save est valide, mais une clé résiduelle d'un ancien code peut encore squatter l'emplacement.
  try {
    for (const k of slotKeys(slot)) if (k !== KEY(slot) && s.getItem(k) != null) s.removeItem(k);
  } catch {
    // stockage indisponible : rien à nettoyer
  }
  return save;
}

export function deleteSlot(slot: AnySlot): void {
  try {
    const s = storage();
    if (!s) return;
    for (const k of slotKeys(slot)) s.removeItem(k);
  } catch {
    // stockage indisponible : rien à supprimer
  }
}

/** Métadonnées des 3 slots (null = vide) — pour l'UI de la modale Sauvegarde/Chargement. */
export function listSaves(): ({ slot: SaveSlot } & SaveMeta | null)[] {
  return SAVE_SLOTS.map((slot) => {
    const s = readSlot(slot);
    return s ? { slot, version: s.version, savedAt: s.savedAt, sceneLabel: s.sceneLabel, gameTime: s.gameTime } : null;
  });
}

/** Export : JSON lisible (téléchargement / presse-papier). */
export function exportSave(save: SaveGame): string {
  return JSON.stringify(save, null, 2);
}

/** Import : parse + validation (null si invalide ou d'une AUTRE version que `SAVE_VERSION`). */
export function importSave(json: string): SaveGame | null {
  try {
    return parseSave(JSON.parse(json));
  } catch {
    return null;
  }
}
