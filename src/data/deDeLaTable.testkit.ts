/** Pilotage du DÉ DE TIRAGE d'une table en test : posé au seam d'en-tête (`setEnTete`, #1667). */
import { ancetreDuDe, deDeLaTable, setEnTete, type DatasetKey } from './overrides';

/** `corps` joué sous le dé `die` posé sur la table de `cle`, à l'ancêtre qui le porte (`ancetreDuDe`) ;
 *  le dé imprimé rendu ensuite. */
export function sousLeDe(cle: DatasetKey, die: string, corps: () => void): void {
  const ancetre = ancetreDuDe(cle)!;
  const imprime = deDeLaTable(cle);
  setEnTete(cle, [{ ancetre, champ: 'die', valeur: die }]);
  try { corps(); } finally { setEnTete(cle, [{ ancetre, champ: 'die', valeur: imprime }]); }
}
