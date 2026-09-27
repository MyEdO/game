/**
 * Un APPENDICE monstrueux (cornes/queue) = un fichier `defs/<id>.ts`. Art SVG ORIENTÉ porté PAR le def
 * (comme têtes/tenues/nuées) : `front`, art de face (repère local de l'os ; jetons @peau/@cheveux…
 * autorisés) ; `profile`, art de profil dédié (cornes balayées haut-arrière, queue traînant vers −x ;
 * une corne de face plaquée sur une tête tournée lit faux) ; `back`, art de dos facultatif (défaut =
 * `front`, cornes symétriques, lues juste de dos). Référencé PAR ID depuis : têtes monstrueuses
 * (`monster.cornes`), `features`/overlays de créature (`appendageFeature`), `traitVisuals`. Résolu
 * partout via `viewOrFront`. Ajouter un type = déposer un fichier + `npm run gen`.
 */
import type { ViewSet } from '../types';

export type AppendageDef = {
  id: string;      // 'cornes-taureau', 'queue-rat'… — clé référencée par les consommateurs
  label: string;   // libellé FR (sélecteur d'éditeur)
} & Omit<ViewSet, 'back'> & Partial<ViewSet>;
