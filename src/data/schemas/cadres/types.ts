/** Cadre d'un panneau : un dessin en neuf tranches, que l'hôte trace à ses couleurs autour d'un contenu de toute taille. */
export interface CadreDef {
  /** kebab-case (`chene-ferre`). */
  id: string;
  label: string;
  /** L'épaisseur, dans le cadre du dessin, de ses tranches de bord : `[gauche, haut, droite, bas]`. Les angles ne se
   *  répètent pas ; les bords se répètent sur leur longueur, le centre sur les deux axes. */
  tranches: [number, number, number, number];
  /** Contenu INTERNE d'un viewBox 0 0 128 128 ; tokens `var(--…)` seuls, jamais de couleur en dur ; l'id d'un dégradé
   *  ou d'une découpe commence par l'id du cadre. */
  svg: string;
}
