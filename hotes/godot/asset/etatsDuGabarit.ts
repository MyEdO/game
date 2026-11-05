import type { GabaritResolu } from '../../../src/noyau/index.ts';
import { tableTotale } from '../../../src/lib/tableTotale.ts';
import { CLES_DU_GABARIT, type TableDeGabarit } from './manifesteDeBase.ts';
import { coinsDeSilhouettesAtteignables, poidsDuGabarit, sensCuitsDuGabarit } from './gabarit.ts';
import { FACTEURS_NEUTRES, sontNeutres } from './facteursDuGabarit.ts';
import { NOMS_DES_SILHOUETTES } from './silhouettes.ts';

export interface EtatDuGabarit {
  readonly nom: string;
  readonly pointCuisson: boolean;
  readonly facteurs: GabaritResolu;
  readonly poidsSilhouettes: Readonly<Record<string, number>>;
  readonly poidsGabarit: Readonly<Record<string, number>>;
  readonly poidsReference: Readonly<Record<string, number>>;
}

/** #3104 issuecomment-6549354475. */
export function etatsDuGabarit(table: TableDeGabarit, silhouettes: readonly string[]): readonly EtatDuGabarit[] {
  const choix = coinsDeSilhouettesAtteignables(table, silhouettes).map((poids) => ({
    nom: NOMS_DES_SILHOUETTES.filter((nom) => poids[nom] > 0).join('_') || 'neutre', poids,
  }));
  const sensCuits = sensCuitsDuGabarit(table.bornes);
  const facteurs = [{ nom: 'neutre', pointCuisson: false, facteurs: FACTEURS_NEUTRES }];
  for (const b of sensCuits) {
    const nom = `${b.cle}_${b.sens}`;
    facteurs.push({ nom, pointCuisson: true, facteurs: { ...FACTEURS_NEUTRES, [b.cle]: b.extremite } });
    facteurs.push({ nom: `${nom}__milieu`, pointCuisson: false, facteurs: { ...FACTEURS_NEUTRES, [b.cle]: (FACTEURS_NEUTRES[b.cle] + b.extremite) / 2 } });
  }
  const combinaisons = CLES_DU_GABARIT.reduce((courants, cle) => courants.flatMap((etat) => {
    const sens = sensCuits.filter((b) => b.cle === cle);
    return sens.length ? sens.map((b) => ({ nom: `${etat.nom}_${cle}_${b.sens}`, facteurs: { ...etat.facteurs, [cle]: (FACTEURS_NEUTRES[b.cle] + b.extremite) / 2 } })) : [etat];
  }), [{ nom: 'combinaison', facteurs: FACTEURS_NEUTRES }]);
  for (const combinaison of combinaisons) {
    facteurs.push({ ...combinaison, pointCuisson: false });
    facteurs.push({ nom: `${combinaison.nom}__extremes`, pointCuisson: false,
      facteurs: Object.fromEntries(Object.entries(combinaison.facteurs).map(([cle, valeur]) =>
        [cle, cle in table.bornes ? 2 * valeur - FACTEURS_NEUTRES[cle as keyof GabaritResolu] : valeur])) as unknown as GabaritResolu });
  }
  const facteursUniques = facteurs.filter((etat, i) => !facteurs.slice(0, i).some((avant) =>
    Object.entries(etat.facteurs).every(([cle, valeur]) => avant.facteurs[cle as keyof GabaritResolu] === valeur)));
  return facteursUniques.flatMap((etat) => choix.map(({ nom, poids }) => ({
    nom: etat.nom === 'neutre' ? nom : `${etat.nom}__${nom}`,
    pointCuisson: etat.pointCuisson && nom === 'neutre',
    facteurs: etat.facteurs,
    poidsSilhouettes: poids,
    poidsGabarit: poidsDuGabarit(etat.facteurs, table.bornes, poids),
    poidsReference: poidsDuGabarit(etat.facteurs, table.bornes, tableTotale(silhouettes, () => 0)),
  })));
}

/** Les états de `etatsDuGabarit` aux facteurs neutres (`sontNeutres`) : la liste des phases neutre et silhouettes de la
 *  construction, qui la reçoivent sans la filtrer (`hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base »). */
export const etatsAuxFacteursNeutres = (table: TableDeGabarit, silhouettes: readonly string[]): readonly EtatDuGabarit[] =>
  etatsDuGabarit(table, silhouettes).filter((etat) => sontNeutres(etat.facteurs));
