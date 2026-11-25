/**
 * Résolution d'un Trait OCTROYÉ (`grantTrait`, `domeWard`), que `applyOps` et `attachMutation`
 * (`engine/corruption.ts`) partagent. Dans la composante fortement connexe d'`ops.ts` par `formule.ts` :
 * #3044.
 */
import type { RNG } from './dice';
import type { Combatant, EffectSource } from './types';
import type { GameOp } from './ops';
import { indiceSurLeProfil, slBonus } from './formule';
import { traitsDuPorteur, type TraitInstance } from './statEntry';
import { TIRAGE_DE_CIBLE } from '../data/obsessions';
import { dataLabel, findDomainById, findTraitById, gods, specPoolOf } from '../data';
import type { PlayerText } from '../i18n/playerText';
import { groupMatch, groupesDe } from './groups';

type OctroiDeTrait = Extract<GameOp, { op: 'grantTrait' }>;

export interface ChoixDuTrait {
  key: string;
  label: PlayerText;
}

/** EDOC 13 l.245 ; LDB 85 l.207 ; LDB 47 l.5-11 ; LDB 51 l.5 ; ADE II 02 l.780. */
export function choixDuTrait(id: string, porteur: Combatant): ChoixDuTrait[] {
  const trait = findTraitById(id);
  if (!trait?.capabilities?.spellcaster) return [];
  const groupes = groupesDe(porteur);
  const arcanes = specPoolOf(trait).flatMap((key) => {
    const domaine = findDomainById(key);
    return domaine && (!domaine.onlyGroups || domaine.onlyGroups.some((g) => groupMatch(g, groupes)))
      ? [{ key, label: dataLabel(domaine.label) }]
      : [];
  });
  const chaos = gods.filter((dieu) => dieu.chaosSpells?.length)
    .map((dieu) => ({ key: dieu.id, label: dataLabel(dieu.label) }));
  return [...arcanes, ...chaos];
}

export function resoudreLeChoixDuTrait(o: OctroiDeTrait, arg: string): OctroiDeTrait {
  const { choix: _choix, ...octroi } = o;
  return { ...octroi, trait: { ...o.trait, arg } };
}

/**
 * Les instances qu'accorde un Trait octroyé à `porteur`, chacune à la provenance `src` : l'Indice formulé se
 * lit sur le `lanceur` (LDB 47 l.441), plus `indicePerSL` au DR `sl` (LDB 47 l.420) ; une Cible tirée donne
 * une instance par tirage (EDOC 12 l.217, l.241) ; une fourchette se tire pour le porteur (`traitsDuPorteur`).
 * SEULE résolution d'un Trait octroyé.
 */
export function traitsOctroyes(
  o: Pick<OctroiDeTrait, 'trait' | 'cible' | 'indicePerSL' | 'choix'>,
  { lanceur, porteur, rng, sl, src }: { lanceur: Combatant; porteur: Combatant; rng: RNG; sl?: number; src?: EffectSource },
): TraitInstance[] {
  const { value, ...pose } = o.trait;
  if (o.choix) {
    const premier = choixDuTrait(o.trait.id, porteur)[0];
    if (!premier) throw new Error(`Aucun choix pour le Trait « ${o.trait.id} ».`);
    pose.arg = premier.key;
  }
  const parDR = slBonus(sl, o.indicePerSL);
  const indice = value === undefined ? {} : { value: parDR ? { sum: [value, parDR] } : value };
  const cible = o.cible;
  const poses = cible
    ? Array.from({ length: cible.pick }, () => ({ ...pose, ...indice, arg: TIRAGE_DE_CIBLE[cible.table.id](rng) }))
    : [{ ...pose, ...indice }];
  return traitsDuPorteur(poses, { id: porteur.id, indice: indiceSurLeProfil(lanceur) }, porteur.traits, { src });
}
