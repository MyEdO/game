/**
 * Groupe d'arme CANONIQUE (WFRP4) dérivé de la donnée `Source/` (trappings.subType),
 * pas d'un parsing approximatif du libellé.
 */
import type { Combatant, SkillInstance, Weapon } from './types';
import { porteLeMarqueur } from '../data/schemas/grammaire/ref';
import { byId, findWeaponGroupById, groupeDeLArme, type ManiementAlternatif } from '../data';
import { maxBy } from './pick';

/** Groupe canonique : l'id `Weapon.subType` (#602), posé par le catalogue ou par l'éditeur ; absent =
 *  pas de Groupe (LDB 85 l.31-33). */
export function weaponGroup(w?: Pick<Weapon, 'subType'>): string | null {
  return w?.subType ?? null;
}

const marqueAPoudre = porteLeMarqueur('weaponGroup', 'poudre');
/** Groupe d'arme ou de munition À POUDRE : marqueur `poudre` de `weaponGroups.json`. LDB 62 l.99 ; LDB 62 l.129 */
export const groupeAPoudre = (id: string | null | undefined): boolean => !!id && marqueAPoudre(id);

/** Spé de Corps à corps `spec` (id de Groupe d'arme) de `c`, ou `undefined` : instance d'une Compétence dont
 *  l'entrée puise ses Spés dans les Groupes d'armes de mêlée (`specsSource`). */
export function speDeCorpsACorps(c: Pick<Combatant, 'skills'>, spec: string): SkillInstance | undefined {
  return (c.skills ?? []).find((s) => byId('skill', s.id)?.specsSource === 'weaponGroupsMelee' && (s.spec ?? '') === spec);
}

/** Un maniement alternatif retenu (`maniementRetenu`) : son Groupe de Corps à corps et sa déclaration. */
export interface ManiementRetenu extends ManiementAlternatif {
  groupe: string;
}

/** Maniement alternatif (`Weapon.manieAussi`, `GroupeDArme.manieAussi`) retenu pour `weapon` tenue par `c`,
 *  ou `undefined` quand le Groupe de l'arme l'emporte. Ouverts : les maniements dont `c` possède la Spé
 *  (AA 08 l.343), ceux `aPied` seulement si `c` n'est pas monté. `mainsTenues` : les mains qui tiennent
 *  l'arme, quand elles sont fixées ; à une main, un maniement à une main l'emporte s'il en est un ouvert, à
 *  deux mains aucun ne l'est. Arbitrage (règle 7, la source laisse le choix au porteur) : la Spé de Corps à
 *  corps aux Augmentations les plus hautes ; à égalité, celui qui ne change pas les qualités de l'arme, puis
 *  le Groupe de l'arme, puis l'ordre déclaré. Lu par `acceptableSpecs` (Compétence), `mainsDuPorteur`
 *  (mains) et `effectiveWeapon` (qualités). LDB 62 l.142-143 ; AA 08 l.188 ; AA 08 l.190 ; AA 08 l.194 ;
 *  AA 08 l.314 ; AA 08 l.343 */
export function maniementRetenu(
  c: Pick<Combatant, 'mountId' | 'skills'>,
  weapon: Pick<Weapon, 'manieAussi' | 'weaponGroup' | 'subType'>,
  mainsTenues?: 1 | 2,
): ManiementRetenu | undefined {
  const sonGroupe = groupeDeLArme(weapon);
  const famille = findWeaponGroupById(sonGroupe);
  const declares: Readonly<Record<string, ManiementAlternatif>> = { ...(famille?.kind === 'weapon' ? famille.manieAussi : undefined), ...weapon.manieAussi };
  const ouverts = Object.entries(declares)
    .filter(([groupe, m]) => !(m.aPied && c.mountId) && speDeCorpsACorps(c, groupe))
    .map(([groupe, m]): ManiementRetenu => ({ groupe, ...m }));
  if (!ouverts.length) return undefined;
  const aUneMain = ouverts.filter((m) => m.mains === 1);
  // `undefined` = le Groupe de l'arme elle-même, candidat en tête.
  const candidats = mainsTenues === 1 && aUneMain.length ? aUneMain : [undefined, ...ouverts.filter((m) => mainsTenues !== 2 || !m.mains)];
  const augmentations = (groupe?: string | null) => (groupe ? speDeCorpsACorps(c, groupe)?.advances : undefined) ?? -1;
  const gardeLesQualites = (m?: ManiementRetenu) => !m?.qualites?.length && !m?.retire?.length;
  return maxBy(candidats, (m) => 2 * augmentations(m ? m.groupe : sonGroupe) + (gardeLesQualites(m) ? 1 : 0))?.item;
}
