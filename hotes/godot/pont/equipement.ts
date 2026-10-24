import type { CombattantProjete } from '../../../src/hote/projection';
import type { ManifesteDePersonnage } from '../asset/manifeste';

export interface ComposantDeModele {
  modele: string;
  composant: string;
  pieces: string[];
}

export type IndexDesApparences = ReadonlyMap<string, readonly ComposantDeModele[]>;

export function indexDesApparences(manifestes: readonly ManifesteDePersonnage[]): IndexDesApparences {
  const index = new Map<string, ComposantDeModele[]>();
  for (const m of manifestes) {
    for (const [composant, { apparence }] of Object.entries(m.components)) {
      if (apparence === null) continue;
      const pieces = Object.values(m.pieces).filter(p => p.component === composant).map(p => p.node);
      if (!pieces.length) continue;
      const entrees = index.get(apparence) ?? [];
      entrees.push({ modele: m.model, composant, pieces });
      index.set(apparence, entrees);
    }
  }
  return index;
}

const manifestes = import.meta.glob<ManifesteDePersonnage>('../projet/modeles/*.manifeste.json', { eager: true, import: 'default' });
export const INDEX_DES_APPARENCES = indexDesApparences(Object.keys(manifestes).sort().map(chemin => manifestes[chemin]));

export interface ChoixDeModele {
  apparence: string;
  composants: readonly ComposantDeModele[];
}

export function premierModele(candidats: readonly string[], index: IndexDesApparences): ChoixDeModele | null {
  for (const apparence of candidats) {
    const composants = index.get(apparence);
    if (composants?.length) return { apparence, composants };
  }
  return null;
}

type ArmeProjetee = CombattantProjete['equipement']['weapons'][number];
export interface ObjetADessiner {
  arme: ArmeProjetee;
  modele: ChoixDeModele | null;
}

export interface AbsenceDeModele {
  porteur: string;
  emplacement: 'tenues' | 'rangees';
  position: number;
  candidats: readonly string[];
}

export interface DessinDEquipement {
  tenues: ObjetADessiner[];
  rangees: ObjetADessiner[];
}

export interface CouvertureDesModeles {
  equipements: Record<string, DessinDEquipement>;
  couverture: { demandes: number; absences: AbsenceDeModele[] };
}

export function modelesDesCombattants(combattants: readonly CombattantProjete[], index: IndexDesApparences = INDEX_DES_APPARENCES): CouvertureDesModeles {
  const equipements: Record<string, DessinDEquipement> = {};
  const couverture: CouvertureDesModeles['couverture'] = { demandes: 0, absences: [] };
  for (const c of combattants) {
    const dessiner = (armes: readonly ArmeProjetee[], emplacement: AbsenceDeModele['emplacement']): ObjetADessiner[] => armes.flatMap((arme, position) => {
      if (arme.natural) return [];
      couverture.demandes++;
      const modele = premierModele(arme.candidats, index);
      if (!modele) couverture.absences.push({ porteur: c.id, emplacement, position, candidats: [...arme.candidats] });
      return [{ arme, modele }];
    });
    equipements[c.id] = { tenues: dessiner(c.equipement.weapons, 'tenues'), rangees: dessiner(c.equipement.rangees, 'rangees') };
  }
  return { equipements, couverture };
}
