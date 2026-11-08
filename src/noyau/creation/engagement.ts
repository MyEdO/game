/**
 * L'ENGAGEMENT d'un héros dans le groupe (#3059, #3370) : ce qu'un siège engage (un brouillon de création ou un pré-tiré
 * désigné par son id), le héros que le noyau en bâtit, son verdict, lu par le geste ET par l'écran, et ce que
 * l'engagement d'un brouillon écrit au roster. La procédure sur le roster d'un hôte : `engagerLeHeros` (`hote/roster.ts`).
 */
import type { FabriqueDId } from '../../engine/fabriqueDId';
import type { Combatant } from '../../engine/types';
import type { Money } from '../../engine/money';
import type { Jeu } from '../etat';
import type { Intention } from '../partie';
import type { RosterEntry } from '../persistance/roster';
import type { IdDePretire } from '../designations';
import type { HorsDesignation } from '../actionsDuNoyau';
import { decidingSeat } from '../netOwnership';
import { refusDAjoutAuGroupe, refusDeComposerLeHeros } from '../partyFlow';
import { buildHero, draftWealth, stepIds, validateStep, type CreatorDraft } from './brouillon';
import { pregens } from '../../data';
import { idDuPretire, pretireAvecRichesse } from '../../data/pregens';
import { garanti } from '../../lib/garanti';
import { t } from '../../i18n';

/** Ce qu'un siège engage au groupe : un brouillon de création, l'id du héros qu'il bâtit posé quand le roster du siège le
 *  garde (absent : un id neuf), ou un pré-tiré par son id. Le noyau en bâtit le héros (`herosDeLEngagement`). */
export type HerosEngage = { brouillon: HorsDesignation<CreatorDraft>; id?: HorsDesignation<string> } | { pretire: IdDePretire };

/** La première étape invalide du brouillon `d` (`validateStep`) ; `null` s'il est complet. */
const refusDuBrouillon = (d: CreatorDraft): string | null => stepIds().map((id) => validateStep(d, id)).find((e) => e !== null) ?? null;

/** Le héros que bâtit le brouillon `d` (l'id `id` posé) et sa Richesse de départ (`draftWealth`). */
const batirLeBrouillon = (d: CreatorDraft, idNeuf: FabriqueDId, id?: string): { hero: Combatant; wealth: Money } => ({ hero: buildHero(d, idNeuf, id), wealth: draftWealth(d).montant });

/** Le verdict de `h` AVANT tout id forgé : l'id du héros qu'il bâtira quand il se connaît (pré-tiré, id de roster posé),
 *  absent pour un brouillon sans id ; sinon la raison qui le refuse (pré-tiré inconnu, étape invalide). */
export function verdictDEngagement(h: HerosEngage): { id: string | undefined } | { refus: string } {
  if ('pretire' in h) {
    const def = pregens.find((p) => p.id === h.pretire);
    return def ? { id: idDuPretire(def.seed) } : { refus: t('party.pretireInconnu', { id: String(h.pretire) }) };
  }
  const refus = refusDuBrouillon(h.brouillon);
  return refus ? { refus } : { id: h.id };
}

/** Le héros que le noyau bâtit de `h`, que `verdictDEngagement` admet, et sa Richesse de départ : le pré-tiré de la donnée
 *  (`pretireAvecRichesse`) ou le brouillon, aux ids de `idNeuf`. */
export function herosDeLEngagement(h: HerosEngage, idNeuf: FabriqueDId): { hero: Combatant; wealth: Money } {
  if ('pretire' in h) return pretireAvecRichesse(garanti(pregens.find((p) => p.id === h.pretire), 'pré-tiré', String(h.pretire)), idNeuf);
  return batirLeBrouillon(h.brouillon, idNeuf, h.id);
}

/** Le refus d'un héros nouveau au groupe : le refus d'ajout du siège qui décide (`refusDAjoutAuGroupe`) ; `null` s'il
 *  y entre. */
export const refusDUnNouveauHeros = (s: Pick<Jeu, 'battle' | 'party' | 'net'>): string | null => refusDAjoutAuGroupe(s, undefined, decidingSeat(s));

/** Le refus d'engager `d` pour le siège qui décide : en édition du héros `heroId`, le refus de le composer
 *  (`refusDeComposerLeHeros`), sinon le refus d'un héros nouveau (`refusDUnNouveauHeros`) ; puis la première étape
 *  invalide (`refusDuBrouillon`). `null` s'il s'engage. */
export function refusDEngagement(s: Pick<Jeu, 'battle' | 'party' | 'net'>, d: CreatorDraft, heroId?: string): string | null {
  return (heroId ? refusDeComposerLeHeros(s, heroId, decidingSeat(s)) : refusDUnNouveauHeros(s)) ?? refusDuBrouillon(d);
}

/** Ce que l'engagement de `d` écrit au roster : le héros (l'id `heroId` conservé en édition), sa Richesse de départ et
 *  le brouillon EXACT, que le roster garde pour rouvrir le héros sans perte et l'engager de nouveau. */
export function engagement(d: CreatorDraft, idNeuf: FabriqueDId, heroId?: string): RosterEntry {
  return { ...batirLeBrouillon(d, idNeuf, heroId), draft: d };
}

/** L'intention qui engage au groupe le héros nouveau de `d`, pour un hôte sans roster. */
export function intentionDEngagement(d: CreatorDraft): Intention {
  return { type: 'recruterLeHeros', args: [{ brouillon: d }] };
}
