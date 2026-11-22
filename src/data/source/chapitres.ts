/** Un chapitre du manifeste des assets émis par le plugin (`source/manifest.json`). */
export interface ChapitreManifeste { ch: string; fichier: string; titre: string; octets: number }
/** L'index des chapitres servis, par livre. */
export type Manifeste = Record<string, { abbr: string; chapitres: ChapitreManifeste[] }>;
