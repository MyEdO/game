/**
 * Table des Péripéties de voyage (1d10) — `LDB 51 l.210-221` ; seuil du d10 quotidien : `LDB 51 l.208`
 * (`MapRoute.perilDie`, défaut 8, 0 = éteint).
 *
 * La DONNÉE vit dans `peripeties.json` (éditable, comme `creatures.json`) ; ce module = type +
 * chargement. Ajouter/régler une péripétie = éditer le JSON, jamais ce fichier. Le tirage est une
 * étape de MONDE à table (`landPerilTable`, `noyau/travelFlow.ts`).
 *
 * `kind` = ce que le MOTEUR sait jouer :
 *  - 'reposant'  : `LDB 51 l.212` ;
 *  - 'ereintant' : `LDB 51 l.215` ;
 *  - 'attaque'   : `LDB 51 l.221` (sans rencontre configurée → narratif au journal) ;
 *  - 'narratif'  : le texte de la ligne, journalisé tel quel.
 */
import { peripeties } from './index';

export interface Peripetie {
  id: string;
  type: 'peripeties';
  roll: number;
  label: string;
  desc: string;
  kind: 'reposant' | 'narratif' | 'ereintant' | 'attaque';
}

export const PERIPETIES = peripeties;
