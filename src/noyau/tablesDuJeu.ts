/**
 * LES TABLES DU JEU (#2889) — chaque table du jeu rassemblée depuis les modules qui en déclarent les
 * entrées (`TABLES` de chaque module), dans l'ordre d'évaluation des modules : c'est l'ordre de lecture
 * des tables où l'ordre compte (hooks de combat et modificateurs de touche à `order` égal, familles de
 * tables tirables). Le propriétaire de l'état la pose par `brancherLeJeu` ; le socle ne lit jamais ce
 * module.
 *
 * Rassemblées au PREMIER APPEL de `tablesDuJeu()`, jamais au chargement : aucun code de premier niveau
 * ne lit une table, ce qui évite la zone morte des `const` en cycle. Ce qui est mémorisé est le
 * conteneur de fonctions et d'accesseurs : une famille de tables tirables reste un accesseur vivant
 * (#1692), si bien qu'une donnée éditée au Codex se relit à chaque tirage.
 */
import type { Cloture } from './pendings';
import type { CombatHook } from './combatHooks';
import type { HitModifier } from './combat/hitModifiers';
import type { ClotureApplier, TablesDuJeu } from './tablesPosees';
import { TABLES as authorPerils } from './authorPerils';
import { TABLES as merchantFlow } from './merchantFlow';
import { TABLES as travelPostes } from './travelPostes';
import { TABLES as triggeredTest } from './combat/triggeredTest';
import { TABLES as riverVoyageFlow } from './riverVoyageFlow';
import { TABLES as travelFlow } from './travelFlow';
import { TABLES as restFlow } from './restFlow';
import { TABLES as embrigadementFlow } from './embrigadementFlow';
import { TABLES as seaVoyageFlow } from './seaVoyageFlow';
import { TABLES as combatManeuvers } from './combatManeuvers';
import { TABLES as encounterPsychFlow } from './encounterPsychFlow';
import { TABLES as tavernFlow } from './tavernFlow';
import { TABLES as pursuitFlow } from './pursuitFlow';
import { TABLES as combatEffects } from './combatEffects';
import { TABLES as corruptionFlow } from './corruptionFlow';
import { TABLES as shipwreck } from './shipwreck';
import { TABLES as roundHooks } from './combat/roundHooks';
import { TABLES as turnHooks } from './combat/turnHooks';
import { TABLES as hitModifiers } from './combat/hitModifiers';
import { TABLES as combatFlow } from './combatFlow';
import { TABLES as seaActivities } from './seaActivities';
import { TABLES as activityWorldRolls } from './activityWorldRolls';
import { TABLES as interludeFlow } from './interludeFlow';
import { TABLES as portFlow } from './portFlow';
import { TABLES as landMarketFlow } from './landMarketFlow';
import { TABLES as innFlow } from './innFlow';
import { TABLES as sequenceCore } from './sequenceCore';
import { TABLES as conversation } from './conversation';
import { TABLES as horloge } from './horloge';
import { TABLES as interactionsDExploration } from './interactionsDExploration';
import { TABLES as issueDeCombat } from './issueDeCombat';
import { TABLES as testsDeScene } from './testsDeScene';

type Fusion<T extends readonly object[]> = T extends readonly [infer A, ...infer R extends readonly object[]] ? A & Fusion<R> : unknown;

/** Fusionne des tables à clés DISJOINTES : une entrée déclarée deux fois lève (H3, jamais deux
 *  implémentations d'une même règle). */
function disjointes<const T extends readonly object[]>(table: string, ...parts: T): Fusion<T> {
  const out: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [cle, v] of Object.entries(part)) {
      if (cle in out) throw new Error(`[tablesDuJeu] « ${cle} » déclaré deux fois dans \`${table}\``);
      out[cle] = v;
    }
  }
  return out as Fusion<T>;
}

/** Une liste dont chaque entrée porte un id déclaré une seule fois (par phase pour les hooks). */
function uniques<T extends CombatHook | HitModifier>(table: string, liste: readonly T[]): readonly T[] {
  const vus = new Set<string>();
  for (const e of liste) {
    const cle = 'phase' in e ? `${e.phase}:${e.id}` : e.id;
    if (vus.has(cle)) throw new Error(`[tablesDuJeu] « ${cle} » déclaré deux fois dans \`${table}\``);
    vus.add(cle);
  }
  return liste;
}

function assembler() {
  const appliers = disjointes('appliers', authorPerils.appliers, merchantFlow.appliers, travelPostes.appliers, triggeredTest.appliers,
    riverVoyageFlow.appliers, travelFlow.appliers, restFlow.appliers, embrigadementFlow.appliers, seaVoyageFlow.appliers,
    combatManeuvers.appliers, encounterPsychFlow.appliers, tavernFlow.appliers, pursuitFlow.appliers, combatEffects.appliers,
    corruptionFlow.appliers, shipwreck.appliers, roundHooks.appliers, turnHooks.appliers, combatFlow.appliers,
    seaActivities.appliers, activityWorldRolls.appliers, interludeFlow.appliers, portFlow.appliers, landMarketFlow.appliers,
    innFlow.appliers);
  const clotures = disjointes('clotures', combatEffects.clotures, combatFlow.clotures, conversation.clotures, horloge.clotures,
    interactionsDExploration.clotures, issueDeCombat.clotures, testsDeScene.clotures) satisfies { readonly [K in Cloture['verbe']]: ClotureApplier<K> };
  const generateursDEtal = disjointes('generateursDEtal', portFlow.generateursDEtal, landMarketFlow.generateursDEtal) satisfies TablesDuJeu['generateursDEtal'];
  return {
    appliers,
    plis: disjointes('plis', combatFlow.plis),
    reglesDeSucces: disjointes('reglesDeSucces', seaVoyageFlow.reglesDeSucces),
    issuesDeTestEtendu: disjointes('issuesDeTestEtendu', seaActivities.issuesDeTestEtendu),
    tablesTirables: disjointes('tablesTirables', travelFlow.tablesTirables, combatFlow.tablesTirables, interludeFlow.tablesTirables),
    famillesTirables: [...travelFlow.famillesTirables, ...seaVoyageFlow.famillesTirables, ...tavernFlow.famillesTirables,
      ...corruptionFlow.famillesTirables, ...combatFlow.famillesTirables],
    crochetsDeCombat: uniques('crochetsDeCombat', [...roundHooks.crochetsDeCombat, ...turnHooks.crochetsDeCombat]),
    modificateursDeTouche: uniques('modificateursDeTouche', hitModifiers.modificateursDeTouche),
    clotures,
    lancerLeSort: combatFlow.lancerLeSort,
    lancerLeSortGaranti: combatFlow.lancerLeSortGaranti,
    apresToucheDeManoeuvre: combatFlow.apresToucheDeManoeuvre,
    sequences: disjointes('sequences', tavernFlow.sequences, pursuitFlow.sequences) satisfies TablesDuJeu['sequences'],
    scoresDeSequence: sequenceCore.scoresDeSequence,
    departages: sequenceCore.departages,
    effetsDePot: sequenceCore.effetsDePot,
    lancers: sequenceCore.lancers,
    interruptionsDePeril: disjointes('interruptionsDePeril', travelFlow.interruptionsDePeril, seaVoyageFlow.interruptionsDePeril),
    generateursDEtal,
  } satisfies TablesDuJeu;
}

/** Gèle chaque table et leur conteneur : une table posée ne se mute jamais en place (une fixture de test
 *  se pose par `avecLesTables`). */
function gelees<T extends object>(tables: T): Readonly<T> {
  for (const table of Object.values(tables)) if (typeof table === 'object' && table) Object.freeze(table);
  return Object.freeze(tables);
}

let memo: TablesDuJeu | null = null;

/** Les tables du jeu, rassemblées et gelées à leur premier appel. */
export function tablesDuJeu(): TablesDuJeu {
  return (memo ??= gelees(assembler()));
}
