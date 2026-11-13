/** Parties NOMMÉES d'un mur assemblé par le builder du pivot — LISTE RUNTIME dont
 *  l'union `WallPart` dérive : le `switch` de `wallPartRelief` s'y mesure (garde d'exhaustivité), et le
 *  schéma de `structureAppearance.json` (`schemas/defs/structureAppearance.ts`) y contraint les clés de `relief`. Chaque backend résout la
 *  couleur de BASE d'une partie via `wallPartColor` puis applique SA lumière (orientation iso / tint POV). */
export const WALL_PARTS = [
  'face', 'poteau', 'couronnement', 'panneau', 'moulure', 'plinthe', // panneau bois encadré
  'chambranle', 'jambage', // encadrement d'une porte bois (l'ouverture elle-même est un TROU)
  'vantail', 'vantail-planche', 'poignee', // vantail de porte FERMÉE
  'vitre', 'meneau', // fenêtre AJOURÉE (vitre transparente + meneau/croisillon ; encadrée par la `face`)
  'parapet', 'bande', 'arase', 'merlon', // fortification crénelée
  'linteau', 'herse-barreau', 'herse-traverse', 'seuil', // corps de garde (herse / seuil d'éboulis)
  'gravats', 'gravats-tas', // brèche (structure abattue)
] as const;

export type WallPart = (typeof WALL_PARTS)[number];
