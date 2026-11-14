/**
 * LE LANCEMENT D'UN SCÉNARIO (#2898) : ce qu'un hôte lance (`LancementDeScenario`, le contenu construit d'un
 * scénario de test et ses réglages de lancement) et l'UNIQUE séquence qui le joue, en deux temps, sur les actions
 * du noyau : la pose (`poserLeLancement`), puis le démarrage (`demarrerLeLancement`). La partie la joue par
 * `Partie.lancer` (`partie.ts`). Le noyau ne lit ni le registre des scénarios, ni leur fiche, ni le catalogue des
 * campagnes : l'hôte construit le lancement (`lancementDuScenario`, `scenes/test-scenarios/_shared.ts` ;
 * `lancementDeLaCampagne`, `scenes/campaign.ts`), celui d'un projet par `lancementDuProjet`.
 */
import { poserLesRegles, type JeuDeRegles } from '../engine/policy';
import type { Combatant } from '../engine/types';
import type { MassBattleSpec } from '../engine/massBattle';
import type { Money } from '../engine/money';
import type { Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import type { CampaignDoc, CampaignVessel } from './etat';
import type { Get, Set } from './flowTypes';
import { creditBourse } from './bourseFlow';
import { semaineDuJour } from './shipCrew';
import { dayIndex } from '../engine/clock';

/** Ce qu'un scénario CONSTRUIT, à chaque appel de sa fabrique, sur les datasets VIVANTS (#1692). */
export interface ContenuDeScenario {
  party: Combatant[];
  scene: Scene;
  /** Scènes supplémentaires du scénario (destinations de voyage, intérieurs…) — chargées en projet. */
  extraScenes?: Scene[];
  /** Carte du monde du scénario (#T2 Voyage). */
  worldMap?: WorldMap;
  /** Bloc narratif du scénario (presets de PNJ/affaires/indices) — posé au chargement (`chargerLeProjet`)
   *  pour que les `presetId` des entités de scène résolvent (#671). */
  narratif?: NarratifBlock;
  /** Bataille de masse (ADE II 08) : amorce le sous-système de Puissance de Bataille après le chargement
   *  de la scène (les Scènes de combat démarrent les rencontres de cette scène). */
  massBattle?: MassBattleSpec;
  /** Navire de campagne (MDG 13-15) posé au lancement, APRÈS le reset de scène (comme la bourse). */
  vessel?: CampaignVessel;
}

/** Le contenu construit, plus ce que le lancement règle : l'identité du document de projet lancé, les règles
 *  optionnelles pré-activées, la bourse du meneur, le combat direct et les semaines d'interlude ouvertes avant la
 *  bataille de masse (ADE II 8 l.65). */
export interface LancementDeScenario extends ContenuDeScenario {
  /** L'identité du document de projet lancé (`CampaignDoc.projet`) : celle d'une campagne, `null` pour un scénario de
   *  test ou l'essai d'une scène éditée. */
  projet: CampaignDoc['projet'];
  regles?: JeuDeRegles;
  bourse?: Money;
  combatDirect?: string;
  semainesDInterlude?: number;
}

/** Le lancement du projet `projet` joué par le groupe `party`, sa scène `entree` à l'entrée, sous l'identité
 *  `identite` (`LancementDeScenario.projet`) : constructeur UNIQUE du lancement d'un paquet de scènes, celui d'une
 *  campagne (`lancementDeLaCampagne`, `scenes/campaign.ts`) comme celui de l'essai d'une scène éditée
 *  (`essaiDeLaScene`, `edition/session.ts`). */
export function lancementDuProjet(projet: { scenes: Scene[]; worldMap?: WorldMap | null; narratif?: NarratifBlock }, party: Combatant[], entree: string, identite: CampaignDoc['projet']): LancementDeScenario {
  const scene = projet.scenes.find((s) => s.id === entree);
  if (!scene) throw new Error(`lancementDuProjet : scène d’entrée « ${entree} » absente (${projet.scenes.map((s) => s.id).join(', ')})`);
  return {
    party, scene, extraScenes: projet.scenes.filter((s) => s !== scene),
    ...(projet.worldMap ? { worldMap: projet.worldMap } : {}), narratif: projet.narratif, projet: identite,
  };
}

/** POSE du lancement : règles, groupe, projet ou scène. */
export function poserLeLancement(get: Get, l: LancementDeScenario): void {
  if (l.regles) poserLesRegles(l.regles);
  get().fixerLeGroupe(l.party);
  if (l.projet || l.extraScenes?.length || l.worldMap || l.narratif) get().chargerLeProjet({ scenes: [l.scene, ...(l.extraScenes ?? [])], entryId: l.scene.id, worldMap: l.worldMap ?? null, narratif: l.narratif, projet: l.projet });
  else get().lancerLaScene(l.scene);
}

/** DÉMARRAGE du lancement posé : bourse, navire, combat direct, interlude, puis bataille de masse dont il est la
 *  préparation (ADE II 8 l.65) ; sans l'un ni l'autre, écran de campagne. */
export function demarrerLeLancement(get: Get, set: Set, l: LancementDeScenario): void {
  // Bourse et navire APRÈS le reset que pose le chargement de la scène.
  const lead = get().party[0];
  if (l.bourse && lead) creditBourse(get, set, lead.id, l.bourse);
  // Le Moral et les vivres de la cale partent du lancement. MDG 14 l.143, l.238
  const now = get().gameTime;
  if (l.vessel) set({ vessel: { ...l.vessel, morale: { ...l.vessel.morale, lastMoraleWeek: semaineDuJour(dayIndex(now)) }, ...(l.vessel.provisions ? { provisions: l.vessel.provisions.map((lot) => ({ ...lot, entre: now })) } : {}) } });
  if (l.combatDirect) get().lancerLeCombat(l.combatDirect);
  if (l.semainesDInterlude) get().ouvrirLInterlude(l.semainesDInterlude);
  if (l.massBattle) get().amorcerLaBataille(l.massBattle);
  else if (!l.semainesDInterlude) set({ screen: 'campaign' });
}

/** Lancement complet : `poserLeLancement` puis `demarrerLeLancement`. */
export function lancerLeScenario(get: Get, set: Set, l: LancementDeScenario): void {
  poserLeLancement(get, l);
  demarrerLeLancement(get, set, l);
}
