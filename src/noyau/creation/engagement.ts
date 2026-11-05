/**
 * L'ENGAGEMENT du brouillon de création dans le groupe (#3059) : son verdict, lu par le geste ET par l'écran, et ce
 * qu'il écrit. La procédure sur le roster d'un hôte : `engagerLeHeros` (`hote/roster.ts`).
 */
import type { Jeu } from '../etat';
import type { RosterEntry } from '../persistance/roster';
import { decidingSeat } from '../netOwnership';
import { refusDAjoutAuGroupe, refusDeComposerLeHeros } from '../partyFlow';
import { buildHero, draftWealth, stepIds, validateStep, type CreatorDraft } from './brouillon';

/** Le refus d'engager `d` pour le siège qui décide : en édition du héros `heroId`, le refus de le composer
 *  (`refusDeComposerLeHeros`), sinon le refus d'ajout (`refusDAjoutAuGroupe`) ; puis la première étape invalide
 *  (`validateStep`). `null` s'il s'engage. */
export function refusDEngagement(s: Jeu, d: CreatorDraft, heroId?: string): string | null {
  const composition = heroId ? refusDeComposerLeHeros(s, heroId, decidingSeat(s)) : refusDAjoutAuGroupe(s, undefined, decidingSeat(s));
  return composition ?? stepIds().map((id) => validateStep(d, id)).find((e) => e !== null) ?? null;
}

/** Ce que l'engagement de `d` écrit : le héros (l'id `heroId` conservé en édition), sa Richesse de départ
 *  (`draftWealth`) et le brouillon EXACT, que le roster garde pour rouvrir le héros sans perte. */
export function engagement(d: CreatorDraft, heroId?: string): RosterEntry {
  return { hero: buildHero(d, heroId), wealth: draftWealth(d).montant, draft: d };
}
