/** Fond d'ambiance : une illustration stylisée en bande, que chaque hôte dessine à ses couleurs. */
export interface FondDef {
  id: string;
  label: string;
  /** Contenu INTERNE d'un viewBox 0 0 320 96, en aplats ; tokens `var(--…)` seuls, jamais de couleur en dur. */
  svg: string;
}
