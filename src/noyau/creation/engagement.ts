/**
 * L'ENGAGEMENT du brouillon de création dans le groupe (#3059) : son verdict, lu par le geste ET par l'écran, et ce
 * qu'il écrit. La procédure sur le roster d'un hôte : `engagerLeHeros` (`hote/roster.ts`).
 */
import type { Jeu } from '../etat';
import type { Intention } from '../partie';
import type { RosterEntry } from '../persistance/roster';
import { decidingSeat } from '../netOwnership';
import { refusComposition, refusDAjoutAuGroupe } from '../partyFlow';
import { buildHero, draftWealth, stepIds, validateStep, type CreatorDraft } from './brouillon';

/** Le refus d'un héros nouveau au groupe : le refus d'ajout du siège qui décide (`refusDAjoutAuGroupe`) ; `null` s'il
 *  y entre. */
export const refusDUnNouveauHeros = (s: Pick<Jeu, 'battle' | 'party' | 'net'>): string | null => refusDAjoutAuGroupe(s, undefined, decidingSeat(s));

/** Le refus d'engager `d` : en édition du héros `heroId`, la composition close (`refusComposition`), sinon le refus
 *  d'un héros nouveau (`refusDUnNouveauHeros`) ; puis la première étape invalide (`validateStep`). `null` s'il
 *  s'engage. */
export function refusDEngagement(s: Pick<Jeu, 'battle' | 'party' | 'net'>, d: CreatorDraft, heroId?: string): string | null {
  const composition = heroId ? refusComposition(s) : refusDUnNouveauHeros(s);
  return composition ?? stepIds().map((id) => validateStep(d, id)).find((e) => e !== null) ?? null;
}

/** Ce que l'engagement de `d` écrit : le héros (l'id `heroId` conservé en édition), sa Richesse de départ
 *  (`draftWealth`) et le brouillon EXACT, que le roster garde pour rouvrir le héros sans perte. */
export function engagement(d: CreatorDraft, heroId?: string): RosterEntry {
  return { hero: buildHero(d, heroId), wealth: draftWealth(d).montant, draft: d };
}

/** L'intention qui ajoute au groupe le héros nouveau de `d` et sa Richesse de départ (`engagement`), pour un hôte
 *  sans roster. */
export function intentionDEngagement(d: CreatorDraft): Intention {
  const { hero, wealth } = engagement(d);
  return { type: 'partyAddHero', args: [hero, wealth] };
}
