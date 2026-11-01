import type { CombattantProjete } from '../../../src/hote/projection';
import type { ManifesteMontable, Montage } from '../asset/montage';
import { estModeleModulaire } from '../asset/modeles';
import { findTeinteById } from '../../../src/noyau/index';

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

const manifestes = import.meta.glob<unknown>('../projet/modeles/*.manifeste.json', { eager: true, import: 'default' });
export const INDEX_DES_APPARENCES = indexDesApparences(Object.keys(manifestes).sort().map(chemin => manifestes[chemin]).filter((m): m is ManifesteMontable => !estModeleModulaire(m)));

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
type ArmeRangeeProjetee = CombattantProjete['equipement']['rangees'][number];
export interface ObjetADessiner<A extends ArmeRangeeProjetee> {
  arme: A;
  modele: ChoixDeModele | null;
  palette: NonNullable<ReturnType<typeof findTeinteById>>['palette'] | null;
}

export interface AbsenceDeModele {
  porteur: string;
  emplacement: 'tenues' | 'rangees';
  position: number;
  candidats: readonly string[];
}

export interface DessinDEquipement {
  tenues: ObjetADessiner<ArmeProjetee>[];
  rangees: ObjetADessiner<ArmeRangeeProjetee>[];
}

export interface CouvertureDesModeles {
  equipements: Record<string, DessinDEquipement>;
  couverture: { demandes: number; absences: AbsenceDeModele[] };
}

export function modelesDesCombattants(combattants: readonly CombattantProjete[], index: IndexDesApparences = INDEX_DES_APPARENCES): CouvertureDesModeles {
  const equipements: Record<string, DessinDEquipement> = {};
  const couverture: CouvertureDesModeles['couverture'] = { demandes: 0, absences: [] };
  for (const c of combattants) {
    const dessiner = <A extends ArmeRangeeProjetee>(arme: A, position: number, usage: EmplacementDeModele): ObjetADessiner<A>[] => {
      if (arme.natural) return [];
      couverture.demandes++;
      const modele = premierModele(arme.candidats, index, usage);
      if (!modele) couverture.absences.push({ porteur: c.id, emplacement: usage.emplacement, position, candidats: [...arme.candidats] });
      return [{ arme, modele, palette: structuredClone(findTeinteById(arme.teinte)?.palette ?? null) }];
    };
    equipements[c.id] = {
      tenues: c.equipement.weapons.flatMap((arme, position) => dessiner(arme, position, { emplacement: 'tenues', main: arme.hand })),
      rangees: c.equipement.rangees.flatMap((arme, position) => dessiner(arme, position, { emplacement: 'rangees' })),
    };
  }
  return { equipements, couverture };
}
