/**
 * Une CAPE/manteau porté = un fichier `defs/<id>.ts`. Appendice DORSAL (os `torse`), art orienté des
 * trois vues (règles de vue/profondeur codifiées par `dorsalOverlays`) : `front`, vue de face (plan
 * fond : silhouette derrière le corps) ; `back`, vue de dos (plan avant : couvre le dos, plis) ;
 * `profile`, vue de profil (drapé ancré à l'épaule, tombant sur le dos −x). Purement cosmétique (slot
 * Cape de la fiche). Ajouter un type de cape = déposer un fichier.
 */
import type { ViewSet } from '../types';

export interface CapeDef extends ViewSet {
  id: string;      // 'voyage'… — référencé par l'emplacement Cape (equip.cape)
  label: string;   // libellé FR
}
