/**
 * Une paire d'AILES = un fichier `defs/<id>.ts`. Art orienté des trois vues (repère os `torse`) : ailes
 * REPLIÉES dans le dos, servies en DORSAL (dorsalOverlays) par le trait Vol et par monster.ailes :
 * `front`, vue de face (dépassent derrière les épaules) ; `back`, vue de dos (couvrent le dos, pli
 * central) ; `profile`, vue de profil (une seule aile vers l'arrière). `back` a son pli central propre
 * (≠ front), donc les 3 vues sont explicites. Ajouter un type d'ailes = un fichier.
 */
import type { ViewSet } from '../types';

export interface WingDef extends ViewSet {
  id: string;      // 'plumes', 'cuir'… — référencé par monster.ailes (bool→plumes, 'cuir') / l'élément 'ailes'
  label: string;   // libellé FR
}
