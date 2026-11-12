/** Couche d'un paysage : un dessin au cadre commun, sans fond propre hors du ciel, que l'hôte trace à ses couleurs. */
export interface CoucheDePaysage {
  /** `famille-nom` en kebab-case (`ciel-nuit`, `meteo-pluie`). */
  id: string;
  label: string;
  /** Contenu INTERNE d'un viewBox 0 0 960 360 ; tokens `var(--…)` seuls, jamais de couleur en dur ; l'id d'un dégradé
   *  commence par l'id de sa couche. */
  svg: string;
}

/** Un fichier defs/ = une famille de couches (les ciels, les reliefs…). */
export type FamilleDeCouches = CoucheDePaysage[];
