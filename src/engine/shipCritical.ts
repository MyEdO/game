/**
 * Résolveur de Blessures critiques sur un NAVIRE (MDG 13) — CODE GÉNÉRIQUE lisant la DONNÉE verbatim
 * (`ship-criticals.json` via `data/shipCriticals`). Module FRÈRE de `critical.ts` : il tire le d10 sur la
 * table de la Localisation et rend une issue STRUCTURÉE et PURE (ne mute rien — l'appelant applique).
 *
 * Réutilisation stricte (pas de mécanique parallèle) :
 *  - les effets « État » (`fire`→En flammes, `leak`→Voie d'eau) sont rendus en **`GameOp`** (`condition`),
 *    appliqués par `applyOps` → posent les États NAVALS data-driven d'`etats.json` (mêmes briques que
 *    `critical.ts` qui pose Sonné/Inconscient) ;
 *  - `findTableEntry` pour le lookup d10 ;
 *  - l'Équipage touché suit les Critiques de PERSONNAGE (`critical.ts`) — aucune table dupliquée.
 * Les Éclats (Indice → équipage) et les Critiques de Coque supplémentaires sont RENDUS (l'équipage et la
 * récursion de Coque relèvent de la boucle de combat naval, qui connaît l'équipage du navire).
 */
import { d10, d100, rollDice, parseDice, type RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';
import { applyOps, type GameOp } from './ops';
import { shipHitLocation, hitLocation, type ShipRig, type ShipLocation } from './combat';
import { resolveCritique, jeuDeCritique, type CriticalResolved } from './critical';
import { poserEnjeu, type FlowTestNode } from './flowCore';
import { combatStakeRef, findShipStation, type StakeRef } from '../data';
import { hullNavalTraits, shipHasNavalTrait } from './navalTraits';
import type { Combatant, NavalTraitRef } from './types';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, shipCritSet, type ShipCritSet, type ShipCritKey, type ShipCrewHit, type CrewTarget } from '../data/shipCriticals';
import { t, type MsgKey } from '../i18n';
import type { PlayerText } from '../i18n/playerText';

/** Clés de libellé des Localisations de bateau (MDG 13) — des CLÉS, jamais des textes résolus : une
 *  carte de phrases figée à l'évaluation du module ne suivrait pas `setLocale` (`src/i18n/index.ts`). */
const SHIP_LOC_KEY: Record<ShipLocation, MsgKey> = {
  equipage: 'shipLoc.equipage', avirons: 'shipLoc.avirons', greement: 'shipLoc.greement',
  coque: 'shipLoc.coque', equipements: 'shipLoc.equipements', cargaison: 'shipLoc.cargaison',
  gouvernail: 'shipLoc.gouvernail', superstructure: 'shipLoc.superstructure',
};

/** Libellé JOUEUR d'une Localisation de bateau — la donnée n'en porte pas (tables keyées par id).
 *  Résolveur TOTAL : aucun repli sur l'id, donc aucun moteur-speak à l'écran. FOYER UNIQUE (la
 *  navigation fluviale s'y branche, `state/riverVoyageFlow.ts`). */
export const shipLocationLabel = (loc: ShipLocation): PlayerText => t(SHIP_LOC_KEY[loc]);

/** Réfs de tables data-driven d'une coque (MDG naval par défaut / MSRC fluvial) — `hull.locationTable` (colonne
 *  de Localisation) + `hull.criticalTable` (jeu de Critiques). Absentes → jeu naval MDG (comportement historique). */
export interface HullCritOpts { locationTable?: string | null; criticalTable?: string | null }

/** Catégorie Codex EXACTE (`registry.ts`) d'une rangée de Critique de coque, par jeu × Localisation —
 *  jumelle de `critEntryCodexCategory` (`critical.ts`). Table CLOSE : une Localisation absente du jeu
 *  n'a pas de fiche, et l'enjeu replie alors sur le foyer du `kind` (jamais un nom inventé). */
const SHIP_CRIT_CODEX_SEGMENT: Record<ShipCritKey, string> = {
  avirons: 'Avirons', greement: 'Greement', coque: 'Coque', equipements: 'Equipements',
  cargaison: 'Cargaison', gouvernail: 'Gouvernail', superstructure: 'Superstructure',
};
export function shipCritEntryCodexCategory(setId: string, location: ShipCritKey): string {
  return `${setId === RIVER_CRIT_SET.id ? 'riverCriticals' : 'shipCriticals'}${SHIP_CRIT_CODEX_SEGMENT[location]}`;
}

/** ENJEU (#1117) du coup à l'ÉQUIPAGE d'une rangée de Critique de coque — patron `enjeuDeRangee`
 *  (`critical.ts`) : le producteur nomme la LIGNE qui exige le jet, sa catégorie Codex se choisit au
 *  tirage parmi les 10 tables de coque (porte (b) `entryCategory`, `src/data/index.ts`). PUR. */
function enjeuDuCoup(setId: string, location: ShipCritKey, entryId: string): StakeRef {
  return combatStakeRef('shipCrewHit', { entryId, entryCategory: shipCritEntryCodexCategory(setId, location) });
}

/** Le coup à l'équipage d'une rangée, ENJEU POSÉ sur son nœud `test` — fabrique PURE, aucun dé
 *  (jumelle de `noeudDeRangee`). Un coup CERTAIN (`ops`, MSRC 07 l.82) ressort inchangé. */
function coupDeRangee(hit: ShipCrewHit | undefined, setId: string, location: ShipCritKey, entryId: string): ShipCrewHit | undefined {
  if (!hit?.test) return hit;
  return { ...hit, test: { ...hit.test, test: poserEnjeu(hit.test.test, enjeuDuCoup(setId, location, entryId)) } };
}

export interface ShipCriticalResolved {
  location: ShipCritKey;
  /** id STABLE du Critique (slug) — pour toute logique/réf ; `label` reste l'affichage. */
  id: string;
  label: string;
  /** Jet d10 effectif. */
  roll: number;
  /** Effets « État » à appliquer AU NAVIRE (En flammes / Voie d'eau) — langue unique `GameOp`. */
  ops: GameOp[];
  /** Éclats (Indice) : `shrapnel` membres d'équipage subissent l'effet Éclats du jeu (`set.shrapnelHit` — 9
   *  Dégâts en mer MDG, +5 en fleuve MSRC) — appliqué par la boucle de combat. Seul l'Indice est per-entry. */
  shrapnel: number;
  /** Critiques de Coque SUPPLÉMENTAIRES (déjà tirés depuis `hullCrits`, ex. « 1d10 » → un nombre). */
  extraHullCrits: number;
  /** « Canon détaché » : ce que la rangée fait à l'ÉQUIPAGE (DATA — cible, épreuve ou ops certaines). */
  crewHit?: ShipCrewHit;
  /** Effets LONG TERME / narratifs verbatim (réductions de Man/Mouvement, réparations, chutes du gréement). */
  note: string;
  log: string;
}

/** Résout un Critique de navire sur la `location` touchée (Localisation déterminée en amont via
 *  `shipHitLocation` ; l'Équipage, lui, passe par `resolveCritique`). `forcedRoll` = d10 imposé (tests). PUR. */
export function rollShipCritical(location: ShipCritKey, rng: RNG = defaultRNG, forcedRoll?: number, set: ShipCritSet = SHIP_CRIT_SET): ShipCriticalResolved {
  const roll = forcedRoll ?? d10(rng);
  const table = set.tables[location];
  if (!table) {
    // La table de Localisation appariée à ce jeu ne produit jamais une Localisation absente du jeu ; garde-fou.
    return { location, id: 'aucun', label: '—', roll, ops: [], shrapnel: 0, extraHullCrits: 0, note: '', log: t('shipCrit.noTable', { loc: shipLocationLabel(location) }) };
  }
  const entry = structuredClone(findTableEntry(table, roll)); // #2097
  // Effets « État » : AUTHORÉS en donnée (`entry.ops`, GameOp) — le résolveur n'a plus aucun couplage nom-d'État.
  const ops: GameOp[] = entry.ops ?? [];
  const extraHullCrits = entry.hullCrits ? rollDice(parseDice(entry.hullCrits)!, rng) : 0;
  return {
    location,
    id: entry.id,
    label: entry.label,
    roll,
    ops,
    shrapnel: entry.shrapnel ?? 0,
    extraHullCrits,
    crewHit: coupDeRangee(entry.crewHit, set.id, location, entry.id),
    note: entry.note,
    log: t('shipCrit.line', { loc: shipLocationLabel(location), label: entry.label, eclats: entry.shrapnel ? t('shipCrit.fragShrapnel', { n: entry.shrapnel }) : '', extra: extraHullCrits ? t('shipCrit.fragExtraHull', { n: extraHullCrits }) : '' }),
  };
}

/** Résultat d'un Critique encaissé par un NAVIRE : la Localisation touchée, et soit un coup à l'ÉQUIPAGE
 *  (résolu par l'appelant en Critique de PERSONNAGE — `resolveCritique` — sur un marin exposé), soit un
 *  Critique de Coque (`crit`). */
export interface ShipCriticalHit {
  location: ShipLocation;
  /** Coup sur l'Équipage (MDG 13) : la touche revient à un membre d'équipage exposé. */
  crewHit: boolean;
  /** Critique de coque (Localisation ≠ Équipage). */
  crit?: ShipCriticalResolved;
}

/**
 * BRAIN du combat naval (MDG 13) — un coup CRITIQUE sur un navire : on détermine d'abord la
 * Localisation selon le gréement (`shipHitLocation`), puis on résout la table de cette Localisation.
 * Un coup à l'Équipage revient à un marin (Critique de personnage, géré par l'appelant qui connaît
 * l'équipage exposé). PUR — `forcedLocRoll`/`forcedCritRoll` figent les d100/d10 pour les tests.
 */
export function resolveShipCriticalHit(
  rig: ShipRig, rng: RNG = defaultRNG, forcedLocRoll?: number, forcedCritRoll?: number, opts?: HullCritOpts,
): ShipCriticalHit {
  const set = shipCritSet(opts?.criticalTable);
  const location = shipHitLocation(rig, forcedLocRoll ?? d100(rng), opts?.locationTable ?? 'navire');
  if (location === 'equipage') return { location, crewHit: true };
  return { location, crewHit: false, crit: rollShipCritical(location, rng, forcedCritRoll, set) };
}

/** Membres d'équipage EXPOSÉS au coup (`MSRC 07 l.70`, `MDG 13 l.584`) pouvant encaisser une touche
 *  (Équipage / Éclats) : vivants et pas à 0 Blessure. PUR. */
export function exposedCrew(crew: Combatant[]): Combatant[] {
  return crew.filter((c) => !c.dead && (c.wounds?.current ?? 0) > 0);
}

/** Issue d'un Critique encaissé par une COQUE et RÉPERCUTÉ sur son équipage (MDG 13-14). */
export interface HullCriticalOutcome {
  location: ShipLocation;
  /** États NAVALS posés sur la coque (Voie d'eau / En flammes) — déjà appliqués. */
  hullOps: GameOp[];
  /** Localisation « Équipage » : un marin exposé encaisse un Critique de PERSONNAGE (déjà appliqué). */
  crewCrit?: { crewId: string; crit: CriticalResolved };
  /** Éclats : marins touchés (effet data `SHRAPNEL_HIT` déjà appliqué — le Dégât réel, mitigé BE/PA, est
   *  journalisé par l'op `wounds` dans `lines`, pas réintrospecté ici). */
  shrapnel: { crewId: string }[];
  /** Critiques de Coque SUPPLÉMENTAIRES résolus (1d10…) — ops déjà appliqués à la coque. */
  extraHullCrits: ShipCriticalResolved[];
  /** Coup à l'ÉQUIPAGE de la rangée : conséquence certaine DÉJÀ appliquée, épreuve RENDUE. L'appelant
   *  (`state`) ouvre `testFlow` par la porte canonique sur les `victims`. */
  crewHit?: CrewHitOutcome & { label: string };
  lines: string[];
}

/** Équipage EXPOSÉ d'un poste tiré au sort (MDG « Canon détaché »). PUR. `[]` si la coque n'a aucun poste. */
function posteCrew(hull: Combatant, crew: Combatant[], rng: RNG): Combatant[] {
  const postes = hull.postes;
  if (!postes?.length) return [];
  const poste = postes[rng.int(0, postes.length - 1)];
  return (poste.crewIds ?? [])
    .map((id) => crew.find((c) => c.id === id))
    .filter((c): c is Combatant => !!c && !c.dead && (c.wounds?.current ?? 0) > 0);
}

/** Issue d'un coup à l'ÉQUIPAGE : QUI est visé, l'ÉPREUVE à ouvrir par la porte, et ce que la
 *  conséquence CERTAINE a déjà fait. */
export interface CrewHitOutcome {
  /** Ids des marins VISÉS par le coup (`crewTarget`) — l'ordre est celui de la sélection. */
  victims: string[];
  /** Nœud `test` de la rangée, ENJEU POSÉ : la couche `state` l'OUVRE (une bande de N rangées, une
   *  par siège). Absent quand la rangée n'appelle aucun jet. */
  testFlow?: FlowTestNode;
  /** Marins ayant réellement encaissé la conséquence CERTAINE (`ops`, déjà appliquée). */
  hits: { crewId: string }[];
  /** Stations VISÉES que cette coque n'a pas (`requiresTrait` non tenu — `MSRC 07 l.94` « Si le bateau
   *  dispose d'une cale ») : personne n'y est touché, et l'appelant le DIT au journal. */
  stationsFermees: string[];
}

/**
 * La station `id` existe-t-elle À BORD ? La DONNÉE porte le gate (`requiresTrait` de
 * `ship-stations.json`) : `cale` exige le Trait naval `cale` (`MSRC 07 l.94` « Si le bateau dispose
 * d'une cale »), `nid-de-pie` l'Amélioration du même nom (`MDG 12 l.299`). Aucun branchement par id
 * de station ne vit ici. Station inconnue = anomalie NOMMÉE (l'authoring l'a écrite hors catalogue).
 *
 * Prend les RÉFS NAVALES, pas un porteur — même forme que `shipHasNavalTrait`, et les deux porteurs
 * du dépôt (coque en jeu `hullNavalTraits`, navire de campagne `vesselNavalTraits`) y entrent par
 * leur propre adaptateur : l'écran d'appareillage gate ses stations avec CE gate, pas une copie. PUR.
 */
export function shipStationOuverte(traits: NavalTraitRef[] | undefined, id: string): boolean {
  const station = findShipStation(id);
  if (!station) throw new Error(`shipStationOuverte : station inconnue « ${id} » (catalogue ship-stations.json).`);
  if (!station.requiresTrait) return true;
  return shipHasNavalTrait(traits, station.requiresTrait.id);
}

/**
 * QUI encaisse — les trois désignations de `crewTarget`, résolues sur l'ÉPINGLAGE du joueur, jamais
 * sur une inférence par Compétence (le livre demande qui « se trouve » à un poste, pas qui SAIT y
 * servir) :
 *  - `{poste:true}` : l'équipage d'un poste tiré au sort (`MDG 13 l.763`) ;
 *  - `{stations}` : `Combatant.shipStation` STRICTEMENT égal à l'une des stations OUVERTES à bord
 *    (`MDG 13 l.680/l.714/l.730/l.751`, `MSRC 07 l.78/l.82/l.94`) ;
 *  - `{role}` : `Combatant.shipRole` STRICTEMENT égal (`MSRC 07 l.86` « au timonier », singulier) — une
 *    affectation déduite des Compétences en désignerait autant que de marins à Voile, là où le livre
 *    n'en frappe qu'UN.
 * PUR ; le RNG ne sert qu'au tirage du poste.
 */
function crewHitVictims(hull: Combatant, crew: Combatant[], crewTarget: CrewTarget, rng: RNG): { victims: Combatant[]; fermees: string[] } {
  if ('poste' in crewTarget) return { victims: posteCrew(hull, crew, rng), fermees: [] };
  if ('role' in crewTarget) return { victims: exposedCrew(crew).filter((c) => c.shipRole === crewTarget.role.id), fermees: [] };
  const ouvertes = crewTarget.stations.filter((id) => shipStationOuverte(hullNavalTraits(hull), id));
  return {
    victims: exposedCrew(crew).filter((c) => c.shipStation !== undefined && ouvertes.includes(c.shipStation)),
    fermees: crewTarget.stations.filter((id) => !ouvertes.includes(id)),
  };
}

/**
 * Coup à l'ÉQUIPAGE consécutif à un Critique de coque, data-driven (`ShipCrewHit`) :
 *  - `crewTarget` (REQUIS) dit QUI encaisse — cf. `crewHitVictims` ;
 *  - `test` PRÉSENT → le nœud est RENDU (jamais roulé ici) : la porte canonique décide de la surface ;
 *  - `ops` à la place → conséquence CERTAINE, sans jet, appliquée ici (MSRC 07 l.82).
 * La branche d'ÉCHEC porte seule la conséquence (une réussite n'applique rien), verrouillé par
 * `echecSeulServi` (`grammaire/mecanique.ts`) ; c'est la porte qui la joue. PUR (mute les marins
 * touchés par un coup CERTAIN via `applyOps`) ; le RNG injecté sert au
 * SEUL tirage du poste (MDG 13 l.763), jamais à l'issue d'un Test.
 */
export function applyCrewHit(hull: Combatant, crew: Combatant[], crewHit: ShipCrewHit, rng: RNG = defaultRNG): CrewHitOutcome {
  const { victims, fermees } = crewHitVictims(hull, crew, crewHit.crewTarget, rng);
  const ids = victims.map((c) => c.id);
  if (crewHit.test) return { victims: ids, testFlow: crewHit.test, hits: [], stationsFermees: fermees };
  const ops = crewHit.ops ?? [];
  const hits: { crewId: string }[] = [];
  for (const sailor of victims) {
    applyOps(sailor, ops, { rng, hull });
    hits.push({ crewId: sailor.id });
  }
  return { victims: ids, hits, stationsFermees: fermees };
}

/**
 * APPLIQUE un coup critique encaissé par une COQUE à elle-même ET à son ÉQUIPAGE (MDG 13-14) — la
 * brique qui fait que `crewIds` touche de VRAIS marins. PUR (mute la coque + les marins via `applyOps` /
 * `resolveCritique`, RNG injecté) :
 *  - Localisation « Équipage » → un marin EXPOSÉ encaisse un Critique de PERSONNAGE (table LDB/AA via
 *    `resolveCritique`, aucune table dupliquée) ;
 *  - sinon → les États navals de la table sont posés sur la coque ; les Éclats infligent 9 Dégâts à
 *    autant de marins exposés ; les Critiques de Coque supplémentaires (1d10…) sont résolus sur la coque.
 */
export function applyHullCritical(
  hull: Combatant, crew: Combatant[], rig: ShipRig, rng: RNG = defaultRNG, forcedLocRoll?: number, forcedCritRoll?: number, opts?: HullCritOpts,
): HullCriticalOutcome {
  const set = shipCritSet(opts?.criticalTable);
  let hit = resolveShipCriticalHit(rig, rng, forcedLocRoll, forcedCritRoll, opts);
  const lines: string[] = [];
  const exposed = exposedCrew(crew);

  // Aucun marin exposé : le coup NE SE PERD PAS — il retombe sur la Localisation que le jeu de tables
  // AUTHORE (`replisSansExpose`). MDG 13 l.584 l'imprime ; MSRC 07 l.70 le laissait au MJ, et il n'y a
  // pas de MJ (CLAUDE.md règle 7) : l'arbitrage vit en donnée, éditable.
  if (hit.crewHit && !exposed.length) {
    const cible = set.replisSansExpose.cible;
    lines.push(t('shipCrit.crewNoneExposed', { loc: shipLocationLabel(cible) }));
    hit = { location: cible, crewHit: false, crit: rollShipCritical(cible, rng, forcedCritRoll, set) };
  }

  if (hit.crewHit) {
    const sailor = exposed[0]!;
    const crit = resolveCritique(jeuDeCritique(), sailor, hitLocation(d100(rng)), rng);
    applyOps(sailor, crit.ops, { rng });
    if (crit.traumas.length) sailor.traumas = [...(sailor.traumas ?? []), ...crit.traumas];
    if (crit.lethal) { sailor.wounds.current = 0; sailor.dead = true; }
    lines.push(t('shipCrit.crewHit', { name: sailor.label, label: crit.label }));
    return { location: 'equipage', hullOps: [], shrapnel: [], extraHullCrits: [], crewCrit: { crewId: sailor.id, crit }, lines };
  }

  const crit = hit.crit!;
  lines.push(crit.log);
  // Effets de coque en `GameOp` : États navals (Voie d'eau / En flammes) ET « Canon perdu » (op
  // `removeShipPoste`, qui démancipe le chef via `crew`). On capte leurs lignes de journal.
  lines.push(...applyOps(hull, crit.ops, { rng, crew }));

  // Coup à l'équipage consécutif au Critique (`crewHit` data-driven) : l'équipage d'un poste tiré au
  // sort (MDG 13 l.763), les PRÉSENCES nommées (MDG 13 l.680/l.714/l.730/l.751, MSRC 07 l.78/l.82/
  // l.94) ou le rôle nommé (MSRC 07 l.86). Le canon reste à bord (≠ « Canon perdu », op
  // `removeShipPoste`). L'ÉPREUVE n'est PAS jouée ici : elle ressort en `crewHit.testFlow`, que
  // l'appelant ouvre par la porte.
  let crewHitOut: (CrewHitOutcome & { label: string }) | undefined;
  if (crit.crewHit) {
    const out = applyCrewHit(hull, crew, crit.crewHit, rng);
    crewHitOut = { ...out, label: crit.label };
    for (const id of out.stationsFermees) lines.push(t('shipCrit.stationFermee', { loc: findShipStation(id)?.label ?? id }));
    if (out.hits.length) lines.push(t('shipCrit.crewTakes', { n: out.hits.length, label: crit.label }));
  }

  // Éclats → effet data `set.shrapnelHit` (op `wounds` : 9 Dégâts en mer MDG / +5 en fleuve MSRC) à autant de
  // marins exposés que l'Indice (plafonné au nombre de marins). L'op JOURNALISE elle-même le Dégât réel
  // (mitigé BE/PA) → on capte ses lignes (comme les ops de coque ci-dessus), aucun littéral ni réintrospection.
  const shrapnel: { crewId: string }[] = [];
  const shrapnelLines: string[] = [];
  if (crit.shrapnel > 0 && !set.shrapnelHit) {
    throw new Error(`applyHullCritical : la rangée « ${crit.label} » porte Éclats ${crit.shrapnel} mais le jeu « ${set.id} » n'authore aucun effet d'Éclats (shrapnelHit).`);
  }
  for (let i = 0; i < crit.shrapnel && i < exposed.length; i++) {
    const sailor = exposed[i];
    shrapnelLines.push(...applyOps(sailor, set.shrapnelHit!, { rng }));
    shrapnel.push({ crewId: sailor.id });
  }
  if (shrapnel.length) {
    lines.push(t('shipCrit.shrapnelHits', { indice: crit.shrapnel, n: shrapnel.length }));
    lines.push(...shrapnelLines);
  }

  // Critiques de Coque supplémentaires (1d10…) — résolus sur la Coque (ops seulement, pas de récursion d'Éclats).
  const extraHullCrits: ShipCriticalResolved[] = [];
  for (let i = 0; i < crit.extraHullCrits; i++) {
    const extra = rollShipCritical('coque', rng);
    applyOps(hull, extra.ops, { rng });
    extraHullCrits.push(extra);
  }
  if (extraHullCrits.length) lines.push(t('shipCrit.extraHull', { n: extraHullCrits.length }));

  return { location: crit.location, hullOps: crit.ops, shrapnel, extraHullCrits, ...(crewHitOut ? { crewHit: crewHitOut } : {}), lines };
}
