import type { CombattantProjete } from '../../../src/hote/projection';
import type { ManifesteMontable, Montage } from '../asset/montage';

export interface ComposantDeModele {
  modele: string;
  composant: string;
  pieces: string[];
}

type ComposantIndexe = ComposantDeModele & { portage: Montage['composants'][string] | null };
export type IndexDesApparences = ReadonlyMap<string, readonly ComposantIndexe[]>;

export function indexDesApparences(manifestes: readonly ManifesteMontable[]): IndexDesApparences {
  const index = new Map<string, ComposantIndexe[]>();
  for (const m of manifestes) {
    for (const [composant, { apparence }] of Object.entries(m.components)) {
      if (apparence === null) continue;
      const pieces = Object.values(m.pieces).filter(p => p.component === composant).map(p => p.node);
      if (!pieces.length) continue;
      const entrees = index.get(apparence) ?? [];
      entrees.push({ modele: m.model, composant, pieces, portage: m.montage.composants[composant] ?? null });
      index.set(apparence, entrees);
    }
  }
  return index;
}

const manifestes = import.meta.glob<ManifesteMontable>('../projet/modeles/*.manifeste.json', { eager: true, import: 'default' });
export const INDEX_DES_APPARENCES = indexDesApparences(Object.keys(manifestes).sort().map(chemin => manifestes[chemin]));

export interface ChoixDeModele {
  apparence: string;
  composants: readonly ComposantDeModele[];
}

export type EmplacementDeModele = { emplacement: 'tenues'; main: 'main' | 'off' } | { emplacement: 'rangees' };

export function premierModele(candidats: readonly string[], index: IndexDesApparences, usage: EmplacementDeModele): ChoixDeModele | null {
  for (const apparence of candidats) {
    const choisi = index.get(apparence)?.find(c => c.portage !== null && (usage.emplacement === 'rangees' ? !!c.portage.rangement : c.portage.prise === usage.main));
    if (choisi) {
      const { modele, composant, pieces } = choisi;
      return { apparence, composants: [{ modele, composant, pieces }] };
    }
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
      const usage: EmplacementDeModele = emplacement === 'tenues' ? { emplacement, main: arme.hand } : { emplacement };
      const modele = premierModele(arme.candidats, index, usage);
      if (!modele) couverture.absences.push({ porteur: c.id, emplacement, position, candidats: [...arme.candidats] });
      return [{ arme, modele }];
    });
    equipements[c.id] = { tenues: dessiner(c.equipement.weapons, 'tenues'), rangees: dessiner(c.equipement.rangees, 'rangees') };
  }
  return { equipements, couverture };
}
