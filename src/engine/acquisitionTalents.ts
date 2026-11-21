import { chaosSpellsOf, findTalentById } from '../data';
import { memeSpecialisation, type RefDesignee } from '../data/schemas/grammaire/ref';
import { bonus } from './characteristics';
import { baseWithTalents } from './talentsPossedes';
import type { Combatant, TalentInstance } from './types';
import { effectiveEntry } from './variants';

/** LDB 05 l.406 ; LDB 07 l.47 ; LDB 10 l.17–18, l.704 ; AA 13 l.54–59, l.70–74. */
export function talentMaxById(hero: PorteurDeTalents, talentId: string, spec?: string): number | null {
  const max = effectiveEntry(findTalentById(talentId))?.max;
  if (max == null) return null;
  if (typeof max === 'number') return max;
  if (max === 'sortsDuDomaine') return spec ? chaosSpellsOf(spec).length : null;
  return bonus(baseWithTalents(hero, max.bonusOf));
}

/** LDB 07 l.105, l.156 ; LDB 10 l.17–18, l.548 ; LDB 46 l.177. */
export function talentAcquisitions(hero: Pick<PorteurDeTalents, 'talents'>, talentId: string, spec?: string): number {
  const parDomaine = findTalentById(talentId)?.grantsArcaneDomain === true;
  return (hero.talents ?? [])
    .filter((t) => t.talentId === talentId && (!parDomaine || memeSpecialisation(t.spec, spec)))
    .reduce((n, t) => n + t.times, 0);
}

/** Le héros a-t-il atteint le Maxi de ce Talent (`talentAcquisitions`). */
export function talentMaxReached(hero: PorteurDeTalents, talentId: string, spec?: string): boolean {
  const max = talentMaxById(hero, talentId, spec);
  return max != null && talentAcquisitions(hero, talentId, spec) >= max;
}

/** Ce que l'acquisition d'un Talent lit et écrit sur son porteur. */
export type PorteurDeTalents = Pick<Combatant, 'characteristics'> & { talents?: TalentInstance[] };

/** L'instance `x` est-elle le Talent `ref` (id et spécialisation) ? */
export const estLInstanceDe = (ref: RefDesignee) => (x: TalentInstance): boolean => x.talentId === ref.id && memeSpecialisation(x.spec, ref.spec);

/**
 * ACQUISITION d'une instance de Talent — seule couture qui écrit `talents` : le Maxi borne (`LDB 10
 * l.18`, `talentMaxReached`), puis l'instance existante gagne un `times`, ou une instance neuve est
 * posée. Rend `false`, sans rien écrire, quand le Maxi est atteint.
 */
export function acquerirTalent(porteur: PorteurDeTalents, ref: RefDesignee): boolean {
  if (talentMaxReached(porteur, ref.id, ref.spec)) return false;
  const talents = porteur.talents ?? [];
  const meme = estLInstanceDe(ref);
  porteur.talents = talents.some(meme)
    ? talents.map((x) => (meme(x) ? { ...x, times: x.times + 1 } : x))
    : [...talents, { talentId: ref.id, ...(ref.spec ? { spec: ref.spec } : {}), times: 1 }];
  return true;
}

/** INVERSE d'`acquerirTalent` : l'instance perd un `times`, et disparaît au dernier. */
export function retirerTalent(porteur: PorteurDeTalents, ref: RefDesignee): void {
  const talents = porteur.talents ?? [];
  const meme = estLInstanceDe(ref);
  const instance = talents.find(meme);
  if (!instance) return;
  porteur.talents = instance.times > 1
    ? talents.map((x) => (meme(x) ? { ...x, times: x.times - 1 } : x))
    : talents.filter((x) => !meme(x));
}
