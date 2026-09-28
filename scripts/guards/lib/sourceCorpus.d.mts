/** Entrée de corpus, GELÉE : le corpus est mémoïsé et partagé entre appelants. */
export interface CorpusFile {
  /** Chemin ABSOLU du fichier. */
  readonly abs: string;
  /** Chemin POSIX relatif à la racine du dépôt. */
  readonly rel: string;
  readonly text: string;
}

export interface ReadCorpusOptions {
  /** Extensions retenues (défaut : `.ts`, `.tsx`). Un `*.d.ts` est hors corpus quoi qu'il arrive. */
  exts?: string[];
  /** Garder les `*.test.*` (défaut : non). */
  tests?: boolean;
}

/** Corpus MÉMOÏSÉ par clé (dossiers + extensions + `tests`) : même clé = même tableau, gelé. Les
 *  dossiers entrent dans la clé en chemin POSIX depuis la racine — absolu, relatif et séparateur
 *  final désignent le MÊME corpus. Licéité et prix : en-tête de `sourceCorpus.mjs`.
 *  LÈVE dès qu'une BASE rend 0 fichier, en la nommant (REFUS DU VIDE, en-tête de
 *  `sourceCorpus.mjs`) : un corpus vide rendrait toute garde verte par vacuité, et sur un total
 *  agrégé une base vide resterait muette derrière une base peuplée. */
export function readCorpus(dirs: string[], opts?: ReadCorpusOptions): readonly CorpusFile[];

/** Fichier de déclaration `.d.ts`, hors de tout corpus lu ici (en-tête de `sourceCorpus.mjs`). */
export function estDeclaration(nom: string): boolean;

/** Relâche tous les corpus mémoïsés : la lecture suivante retourne au disque. Le relâchement est
 *  TOTAL (toutes les clés, pas une) et l'IDENTITÉ des tableaux et des entrées est perdue — les mémos
 *  par identité des appelants repartent de zéro. Les tests de `sourceCorpus.mjs` l'appellent. */
export function viderCorpus(): void;
