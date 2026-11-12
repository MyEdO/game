/**
 * L'ENGAGEMENT d'un héros dans le groupe (#3059, #3370) : ce qu'un siège engage (un brouillon de création ou un pré-tiré
 * désigné par son id), le héros que le noyau en bâtit, son verdict, lu par le geste ET par l'écran, et ce que
 * l'engagement d'un brouillon écrit au roster. La procédure sur le roster d'un hôte : `engagerLeHeros` (`hote/roster.ts`).
 */
import type { FabriqueDId, FabriqueDuRoster } from '../../engine/fabriqueDId';
import type { IdDeHerosDuRoster } from '../../lib/idDeHerosDuRoster';
import type { Combatant } from '../../engine/types';
import type { Money } from '../../engine/money';
import type { Jeu } from '../etat';
import type { Intention } from '../partie';
import type { RosterEntry } from '../persistance/roster';
import type { IdDePretire } from '../designations';
import type { HorsDesignation } from '../actionsDuNoyau';
import { decidingSeat } from '../netOwnership';
import { refusDAjoutAuGroupe, refusDeComposerLeHeros, refusDeRecruter } from '../partyFlow';
import { buildHero, draftWealth, stepIds, validateStep, type CreatorDraft } from './brouillon';
import { careerLabelFor, findSpeciesById, pregens } from '../../data';
import { idDuPretire, possessionsTireesDuPretire, pretire, richesseDuPretire } from '../../data/pregens';
import type { RNG } from '../../engine/dice';
import { carriereActuelle } from '../../engine/pnjDeCarriere';
import { recomputeLoadout } from '../../engine/items';
import { garanti } from '../../lib/garanti';
import { t } from '../../i18n';

/** Ce qu'un siège engage au groupe : un brouillon de création, l'id du héros qu'il bâtit posé quand le roster du siège le
 *  garde (absent : un id neuf), et l'id de son entrée de roster quand ce n'est pas le sien (`Combatant.idDeRoster`) ; ou
 *  un pré-tiré par son id. Le noyau en bâtit le héros (`herosDeLEngagement`). */
export type HerosEngage =
  | { brouillon: HorsDesignation<CreatorDraft>; id?: HorsDesignation<string>; idDeRoster?: HorsDesignation<IdDeHerosDuRoster> }
  | { pretire: IdDePretire };

/** La première étape invalide du brouillon `d` (`validateStep`) ; `null` s'il est complet. */
const refusDuBrouillon = (d: CreatorDraft): string | null => stepIds().map((id) => validateStep(d, id)).find((e) => e !== null) ?? null;

/** Le verdict de `h` AVANT tout id forgé : l'id du héros qu'il bâtira quand il se connaît (pré-tiré, id de roster posé),
 *  absent pour un brouillon sans id ; sinon la raison qui le refuse (pré-tiré inconnu, étape invalide). */
export function verdictDEngagement(h: HerosEngage): { id: string | undefined } | { refus: string } {
  if ('pretire' in h) {
    const def = pregens.find((p) => p.id === h.pretire);
    return def ? { id: idDuPretire(def.id) } : { refus: t('party.pretireInconnu', { id: String(h.pretire) }) };
  }
  const refus = refusDuBrouillon(h.brouillon);
  return refus ? { refus } : { id: h.id };
}

/** Le héros que le noyau bâtit de `h`, que `verdictDEngagement` admet : le pré-tiré de la donnée (`pretire`), augmenté de
 *  ses possessions imprimées à quantité aux dés, tirées à `rng` (`possessionsTireesDuPretire`), ou le brouillon, aux ids de
 *  `idNeuf`. */
export function herosDeLEngagement(h: HerosEngage, idNeuf: FabriqueDId, rng: RNG): Combatant {
  if ('pretire' in h) {
    const hero = pretire(idNeuf, h.pretire);
    (hero.items ??= []).push(...possessionsTireesDuPretire(garanti(pregens.find((p) => p.id === h.pretire), String(h.pretire), 'pré-tiré'), rng, idNeuf));
    recomputeLoadout(hero);
    return hero;
  }
  const hero = buildHero(h.brouillon, idNeuf, h.id);
  return h.idDeRoster ? { ...hero, idDeRoster: h.idDeRoster } : hero;
}

/** La Richesse de départ de `h` au recrutement : le dé imprimé de la fiche du pré-tiré (`richesseDuPretire`), tiré à
 *  `rng`, ou celle du brouillon (`draftWealth`). */
export function richesseDeLEngagement(h: HerosEngage, rng: RNG): Money {
  if ('pretire' in h) return richesseDuPretire(garanti(pregens.find((p) => p.id === h.pretire), String(h.pretire), 'pré-tiré'), rng);
  return draftWealth(h.brouillon).montant;
}

/** Un pré-tiré tel que le groupe le recrute : son nom, son espèce, sa carrière en cours, l'intention qui le recrute,
 *  et le refus de son recrutement (`refusDeRecruter`), `null` s'il se recrute. */
export interface PretireOffert {
  id: IdDePretire;
  nom: string;
  espece: string | null;
  carriere: string;
  recrutement: Intention;
  refus: string | null;
}

/** Chaque pré-tiré de la donnée (`pregens`, dans son ordre) tel que le groupe de `s` le recrute. */
export function pretiresOfferts(s: Pick<Jeu, 'battle' | 'party' | 'net'>): PretireOffert[] {
  return pregens.map((d) => ({
    id: d.id,
    nom: d.label,
    espece: findSpeciesById(d.species.id)?.label ?? null,
    carriere: careerLabelFor({ career: carriereActuelle(d)?.id, appearance: { sex: d.sex } }),
    recrutement: { type: 'recruterLeHeros', args: [{ pretire: d.id }] },
    refus: refusDeRecruter(s, { pretire: d.id }),
  }));
}

/** Un héros du roster tel que le groupe le recrute : son nom, son espèce, sa carrière en cours, l'intention qui le
 *  recrute, et le refus de son recrutement (`refusDeRecruter`), `null` s'il se recrute. */
export interface HerosDuRosterOffert {
  id: IdDeHerosDuRoster;
  nom: string;
  espece: string | null;
  carriere: string | null;
  recrutement: Intention;
  refus: string | null;
}

/** Chaque entrée de `roster`, dans son ordre, telle que le groupe de `s` la recrute : son brouillon engagé sous l'id
 *  de son héros, que le roster garde. */
export function herosDuRosterOfferts(s: Pick<Jeu, 'battle' | 'party' | 'net'>, roster: readonly RosterEntry[]): HerosDuRosterOffert[] {
  return roster.map((e) => {
    const engage: HerosEngage = { brouillon: e.draft, id: e.hero.id };
    return {
      id: e.hero.id,
      nom: e.hero.label,
      espece: findSpeciesById(e.hero.species)?.label ?? null,
      carriere: e.hero.career ? careerLabelFor(e.hero) : null,
      recrutement: { type: 'recruterLeHeros', args: [engage] },
      refus: refusDeRecruter(s, engage),
    };
  });
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

/** Ce que l'engagement de `d` écrit au roster : le héros (l'id `heroId` conservé en édition, sinon un id neuf de
 *  `idDuRoster`), sa Richesse de départ et le brouillon EXACT, que le roster garde pour rouvrir le héros sans perte et
 *  l'engager de nouveau. */
export function engagement(d: CreatorDraft, idDuRoster: FabriqueDuRoster, heroId?: IdDeHerosDuRoster): RosterEntry {
  const id = heroId ?? idDuRoster('hero');
  return { hero: { ...buildHero(d, idDuRoster, id), id }, wealth: draftWealth(d).montant, draft: d };
}

/** L'intention qui fait entrer un brouillon engagé au groupe. */
export type IntentionDEngagement = Extract<Intention, { type: 'recruterLeHeros' | 'remplacerLeHeros' }>;

/** L'intention qui fait entrer au groupe le brouillon `d`, son entrée de roster sous l'id `idDeLEntree` : le héros
 *  ajouté sous cet id (`recruterLeHeros`), ou, en édition, en place du héros `heroId`, qui garde son id et désigne son
 *  entrée par `idDeRoster` quand elle porte un autre id (`remplacerLeHeros`). */
export function intentionDEngagement(d: CreatorDraft, idDeLEntree: IdDeHerosDuRoster, heroId?: string): IntentionDEngagement {
  if (!heroId) return { type: 'recruterLeHeros', args: [{ brouillon: d, id: idDeLEntree }] };
  return { type: 'remplacerLeHeros', args: [heroId, { brouillon: d, id: heroId, ...(idDeLEntree === heroId ? {} : { idDeRoster: idDeLEntree }) }] };
}

/** L'intention qui renvoie du groupe le héros `heroId`. */
export function intentionDeRenvoi(heroId: string): Intention {
  return { type: 'renvoyerLeHeros', args: [heroId] };
}
