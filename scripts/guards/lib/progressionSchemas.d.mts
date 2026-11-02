export interface ProgressionMark {
  col: string;
  characteristic: string;
  x: number;
  /** Couleur RVB mesurée de l'aplat (niveaux 2/3/4) ; absente au niveau 1, marqué par un glyphe. */
  teinte?: [number, number, number];
}

export interface ProgressionViolation {
  career: string;
  book: string;
  level: number;
  pdfpage: number;
  page: number;
  motif: 'affectation-divergente' | 'niveau-absent-de-la-donnee';
  /** `characteristics` du niveau dans `careerLevels.json`, trié ; `null` si le niveau manque. */
  json: string[] | null;
  /** Caractéristiques marquées sur la page, triées. */
  pdf: string[];
  marques: ProgressionMark[];
}

export interface ProgressionAmbiguity {
  book: string;
  page: number;
  pdfpage: number;
  y: number;
  titres: string[];
  candidats: string[];
}

export interface ProgressionOrphanBand {
  book: string;
  page: number;
  pdfpage: number;
  y: number;
  titres: string[];
}

export interface ProgressionFolioGap {
  career: string;
  book: string;
  declare: number | null;
  imprime: number;
}

export interface ProgressionAudit {
  violations: ProgressionViolation[];
  ambigus: ProgressionAmbiguity[];
  bandesHorsDonnee: ProgressionOrphanBand[];
  folioEcarts: ProgressionFolioGap[];
  /** Carrières de `careers.json` qu'aucune bande ne couvre, groupées par livre — l'ANGLE MORT. */
  nonCouvertes: Record<string, string[]>;
  /** Bandes appariées à une Carrière, par livre. */
  parLivre: Record<string, number>;
  totalBandes: number;
  totalCarrieres: number;
  couvertes: number;
  livresArtefact: string[];
}

export function normTitle(s: string): string;
export function auditProgressionSchemas(sources?: {
  artefact?: unknown;
  careers?: unknown;
  careerLevels?: unknown;
}): ProgressionAudit;
export function formatViolation(v: ProgressionViolation): string;
