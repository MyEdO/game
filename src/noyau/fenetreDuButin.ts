/**
 * LA FENÊTRE DU BUTIN EN DONNÉES (#2937) — l'évaluation de la fenêtre de butin qui tient la main (`loot` hors combat,
 * `victory` en fin de combat, `fenetreDuJeu`) : la ligne à évaluer, nommée par son objet et désignée par son `uid`
 * (`LootGear`), et la portée de l'évaluation, chacune nommant le verbe qui la règle (`reglages.ts`). La ligne que prend
 * un héros est un choix de la fenêtre (`fenetreChoisir`, `CHOIX_DES_FENETRES`). Lecteur PUR.
 */
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import { fenetreDuJeu } from './combatAuto';
import { libelleDuLitteral, libelleDuParametre } from './libelles';
import { garanti } from '../lib/garanti';
import type { ChoixNomme } from './reglages';
import type { IdDeLigneDeButin } from './designations';

/** L'évaluation de la fenêtre du butin ; `null` : aucune ligne à évaluer. */
export interface FenetreDuButin {
  evaluer: ChoixNomme<IdDeLigneDeButin> | null;
  portee: ChoixNomme<'loot' | 'victory'> | null;
}

/** Les verbes que la fenêtre du butin règle (`fenetreDuButin`), comme ceux de l'attaque. */
export const REGLAGES_DU_BUTIN = ['evaluerLeButin'] as const satisfies readonly (keyof ActionsDuNoyau)[];
const [EVALUER] = REGLAGES_DU_BUTIN;

/** Par fenêtre de butin, le pending qui porte ses lignes. */
const BUTINS = { loot: 'pendingLoot', victory: 'pendingVictory' } as const satisfies Record<string, keyof Jeu>;

const estUnButin = (cle: string | undefined): cle is keyof typeof BUTINS => cle !== undefined && Object.prototype.hasOwnProperty.call(BUTINS, cle);

/** La fenêtre du butin qui tient la main, `null` hors d'elle. PUR. */
export function fenetreDuButin(s: Jeu): FenetreDuButin | null {
  const cle = fenetreDuJeu(s)?.cle;
  if (!estUnButin(cle)) return null;
  const lignes = (s[BUTINS[cle]]?.gear ?? []).map((g) => ({ valeur: g.uid, libelle: g.label }));
  if (!lignes.length) return { evaluer: null, portee: null };
  return {
    evaluer: { geste: { verbe: EVALUER }, parametre: 'uid', libelle: garanti(libelleDuParametre(EVALUER, 'uid'), EVALUER, 'libellé de la ligne de butin'), choisie: null, options: lignes },
    portee: {
      geste: { verbe: EVALUER }, parametre: 'scope', libelle: garanti(libelleDuParametre(EVALUER, 'scope'), cle, 'libellé de la portée'), choisie: cle,
      options: [{ valeur: cle, libelle: garanti(libelleDuLitteral(cle, 'scope'), cle, 'libellé de la portée') }],
    },
  };
}
