/**
 * LE LANCEMENT D'UN SCÉNARIO (#2898) : ce qu'un hôte lance (`LancementDeScenario`, le contenu construit d'un
 * scénario de test et ses réglages de lancement) et l'UNIQUE séquence qui le joue, en deux temps, sur les actions
 * du noyau : la pose (`poserLeLancement`), puis le démarrage (`demarrerLeLancement`). Le web la joue par
 * `src/state/scenarioFlow.ts`, la partie par `Partie.lancer` (`partie.ts`). Le noyau ne lit ni le registre des
 * scénarios ni leur fiche : l'hôte construit le lancement (`lancementDuScenario`, `scenes/test-scenarios/_shared.ts`).
 */
import { setRule, type RuleValue } from '../engine/policy';
import type { Combatant } from '../engine/types';
import type { MassBattleSpec } from '../engine/massBattle';
import type { Money } from '../engine/money';
import type { Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import type { CampaignVessel } from './etat';
import type { Get, Set } from './flowTypes';
import { creditBourse } from './bourseFlow';

/** Ce qu'un scénario CONSTRUIT, à chaque appel de sa fabrique, sur les datasets VIVANTS (#1692). */
export interface ContenuDeScenario {
  party: Combatant[];
  scene: Scene;
  /** Scènes supplémentaires du scénario (destinations de voyage, intérieurs…) — chargées en projet. */
  extraScenes?: Scene[];
  /** Carte du monde du scénario (#T2 Voyage). */
  worldMap?: WorldMap;
  /** Bloc narratif du scénario (presets de PNJ/affaires/indices) — posé au chargement (`loadProject`)
   *  pour que les `presetId` des entités de scène résolvent (#671). */
  narratif?: NarratifBlock;
  /** Bataille de masse (ADE II 08) : amorce le sous-système de Puissance de Bataille après le chargement
   *  de la scène (les Scènes de combat démarrent les rencontres de cette scène). */
  massBattle?: MassBattleSpec;
  /** Navire de campagne (MDG 13-15) posé au lancement, APRÈS le reset de scène (comme la bourse). */
  vessel?: CampaignVessel;
}

/** Le contenu construit, plus ce que le lancement règle : les règles optionnelles pré-activées, la bourse du
 *  meneur, le combat direct et les semaines d'interlude ouvertes avant la bataille de masse (ADE II 8 l.65). */
export interface LancementDeScenario extends ContenuDeScenario {
  regles?: Readonly<Record<string, RuleValue>>;
  bourse?: Money;
  combatDirect?: string;
  semainesDInterlude?: number;
}

/** POSE du lancement : règles, groupe, projet ou scène. */
export function poserLeLancement(get: Get, l: LancementDeScenario): void {
  if (l.regles) for (const [id, v] of Object.entries(l.regles)) setRule(id, v);
  get().setParty(l.party);
  if (l.extraScenes?.length || l.worldMap || l.narratif) get().loadProject({ scenes: [l.scene, ...(l.extraScenes ?? [])], entryId: l.scene.id, worldMap: l.worldMap ?? null, narratif: l.narratif, projet: null });
  else get().startScene(l.scene);
}

/** DÉMARRAGE du lancement posé : bourse, navire, combat direct, interlude (ADE II 8 l.65) puis bataille de
 *  masse, sinon écran de campagne. */
export function demarrerLeLancement(get: Get, set: Set, l: LancementDeScenario): void {
  // Bourse et navire APRÈS le reset que pose le chargement de la scène.
  const lead = get().party[0];
  if (l.bourse && lead) creditBourse(get, set, lead.id, l.bourse);
  if (l.vessel) set({ vessel: l.vessel });
  if (l.combatDirect) get().startCombat(l.combatDirect);
  if (l.massBattle) {
    if (l.semainesDInterlude) get().startInterlude(l.semainesDInterlude);
    get().startMassBattle(l.massBattle);
  } else set({ screen: 'campaign' });
}

/** Lancement complet : `poserLeLancement` puis `demarrerLeLancement`. */
export function lancerLeScenario(get: Get, set: Set, l: LancementDeScenario): void {
  poserLeLancement(get, l);
  demarrerLeLancement(get, set, l);
}
