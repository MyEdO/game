/**
 * LA FENÊTRE DU BUTIN EN DONNÉES (#2937) — les choix de la fenêtre de butin qui tient la main (`loot` hors combat,
 * `victory` en fin de combat, `fenetreDuJeu`) : la ligne à attribuer et la ligne à évaluer, chacune nommée par son
 * objet, et la portée de l'évaluation, chacun nommant le verbe qui le règle (`reglages.ts`). Une ligne de butin
 * (`LootGear`) n'a pas d'id : elle se désigne par son rang dans `gear`, celui que lisent `assignGearAt`
 * (`combatEffects.ts`) et `appraiseGear` (`merchantFlow.ts`). Lecteur PUR.
 */
import type { Jeu } from './etat';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import { fenetreDuJeu } from './combatAuto';
import { libelleDuLitteral, libelleDuParametre } from './libelles';
import { garanti } from '../lib/garanti';
import type { ChoixNomme } from './reglages';

/** Les choix de la fenêtre du butin ; `null` : aucune ligne à attribuer ni à évaluer. */
export interface FenetreDuButin {
  attribuer: ChoixNomme<number> | null;
  evaluer: ChoixNomme<number> | null;
  portee: ChoixNomme<'loot' | 'victory'> | null;
}

/** Les verbes que la fenêtre du butin règle (`fenetreDuButin`), comme ceux de l'attaque. */
export const REGLAGES_DU_BUTIN = ['assignLootGear', 'assignVictoryGear', 'appraiseGear'] as const satisfies readonly (keyof ActionsDuNoyau)[];

/** Par fenêtre de butin, le pending qui porte ses lignes et le verbe qui en attribue une. */
const BUTINS = {
  loot: { pending: 'pendingLoot', attribuer: 'assignLootGear' },
  victory: { pending: 'pendingVictory', attribuer: 'assignVictoryGear' },
} as const satisfies Record<string, { pending: keyof Jeu; attribuer: (typeof REGLAGES_DU_BUTIN)[number] }>;

const estUnButin = (cle: string | undefined): cle is keyof typeof BUTINS => cle !== undefined && Object.prototype.hasOwnProperty.call(BUTINS, cle);

/** La fenêtre du butin qui tient la main, `null` hors d'elle. PUR. */
export function fenetreDuButin(s: Jeu): FenetreDuButin | null {
  const cle = fenetreDuJeu(s)?.cle;
  if (!estUnButin(cle)) return null;
  const { pending, attribuer } = BUTINS[cle];
  const lignes = (s[pending]?.gear ?? []).map((g, i) => ({ valeur: i, libelle: g.label }));
  if (!lignes.length) return { attribuer: null, evaluer: null, portee: null };
  const ligne = (verbe: keyof ActionsDuNoyau): ChoixNomme<number> => ({
    verbe, parametre: 'index', libelle: garanti(libelleDuParametre(verbe, 'index'), verbe, 'libellé de la ligne de butin'), choisie: null, options: lignes,
  });
  return {
    attribuer: ligne(attribuer),
    evaluer: ligne('appraiseGear'),
    portee: {
      verbe: 'appraiseGear', parametre: 'scope', libelle: garanti(libelleDuParametre('appraiseGear', 'scope'), cle, 'libellé de la portée'), choisie: cle,
      options: [{ valeur: cle, libelle: garanti(libelleDuLitteral(cle, 'scope'), cle, 'libellé de la portée') }],
    },
  };
}
