/**
 * LA FENÊTRE DU BUTIN EN DONNÉES (#2937) — l'évaluation de la fenêtre de butin qui tient la main (`butin` hors combat,
 * `victoire` en fin de combat, `fenetreDuJeu`) : la ligne à évaluer, nommée par son objet, désignée par son `uid`
 * (`LootGear`) et fermée par le refus qui la ferme, nommant le verbe général qui la règle (`evaluerLObjet`, offert par
 * `verbes:`, `reglages.ts`). La ligne que prend un héros est un choix de la fenêtre (`fenetreChoisir`,
 * `CHOIX_DES_FENETRES`). Lecteur PUR.
 */
import type { Jeu } from './etat';
import type { CleDeRegistre } from './modalArbiter';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import { fenetreDuJeu } from './combatAuto';
import { libelleDuParametre } from './libelles';
import { garanti } from '../lib/garanti';
import { gameDay, MODE_D_EVALUATION_PAR_DEFAUT, refusDEvaluation } from './merchantFlow';
import type { ChoixNomme } from './reglages';
import type { IdDeLigneDeButin } from './designations';

/** L'évaluation de la fenêtre du butin ; `null` : aucune ligne à évaluer. */
export interface FenetreDuButin {
  evaluer: ChoixNomme<IdDeLigneDeButin> | null;
}

/** Les verbes que la fenêtre du butin règle (`fenetreDuButin`), comme ceux de l'attaque. */
export const REGLAGES_DU_BUTIN = ['evaluerLObjet'] as const satisfies readonly (keyof ActionsDuNoyau)[];
const [EVALUER] = REGLAGES_DU_BUTIN;

/** Par fenêtre de butin, le pending qui porte ses lignes. */
const BUTINS = { butin: 'pendingLoot', victoire: 'pendingVictory' } as const satisfies Partial<Record<CleDeRegistre, keyof Jeu>>;

const estUnButin = (cle: string | undefined): cle is keyof typeof BUTINS => cle !== undefined && Object.prototype.hasOwnProperty.call(BUTINS, cle);

/** La fenêtre du butin qui tient la main, `null` hors d'elle. Chaque ligne porte le refus du geste qu'elle offre,
 *  `evaluerLObjet(aEvaluer)` au mode par défaut (`refusDEvaluation`). PUR. */
export function fenetreDuButin(s: Jeu): FenetreDuButin | null {
  const cle = fenetreDuJeu(s)?.cle;
  if (!estUnButin(cle)) return null;
  const jour = gameDay(s);
  const lignes = (s[BUTINS[cle]]?.gear ?? []).map((g) => ({
    valeur: g.uid, libelle: g.label, refus: refusDEvaluation(s.party, { ...g.effect, label: g.label }, MODE_D_EVALUATION_PAR_DEFAUT, jour),
  }));
  if (!lignes.length) return { evaluer: null };
  return {
    evaluer: { geste: { verbe: EVALUER }, parametre: 'aEvaluer', libelle: garanti(libelleDuParametre(EVALUER, 'aEvaluer'), EVALUER, 'libellé de la ligne de butin'), choisie: null, options: lignes },
  };
}
