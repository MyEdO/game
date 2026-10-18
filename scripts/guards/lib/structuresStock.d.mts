export const STRUCTURES_CIBLES: ReadonlyArray<{
  concept: string;
  signature: string;
  date: string;
}>;

export const STRUCTURES_FORMES: ReadonlyArray<{
  concept: string;
  dataset: string;
  champ: string;
  signature: string;
  statut: 'historique' | 'divergente';
  strate: 'Référence' | 'Valeur' | 'Ops' | 'Document';
  occurrences: number;
  lot: string;
  date: string;
}>;

export const STRUCTURES_DEFAUT: ReadonlyArray<{
  dataset: string;
  cle: string;
  date: string;
}>;

export const STRUCTURES_HOMONYMES: ReadonlyArray<{
  cle: string;
  classes: readonly string[];
  occurrences: number;
  lot: string;
  date: string;
}>;

export const STRUCTURES_ENVELOPPE: ReadonlyArray<{
  role: string;
  cle: string;
  motif: 'clé divergente' | 'type divergent' | 'clé absente';
  detail: string;
  document: string;
  chemin: string;
  occurrences: number;
  lot: string;
  date: string;
}>;

export const STRUCTURES_REDECLARATIONS: ReadonlyArray<{
  def: string;
  champ: string;
  concept: string;
  signature: string;
  statut: string;
  commun: string;
  occurrences: number;
  lot: string;
  date: string;
}>;

export const STRUCTURES_ORPHELINES: ReadonlyArray<{
  dataset: string;
  champ: string;
  signature: string;
  motif: 'clé de référence non résolue' | 'clé réservée' | 'identité non résolue';
  occurrences: number;
  lot: string;
  date: string;
}>;

export const STRUCTURES_OPS: ReadonlyArray<{
  op: string;
  signature: string;
  dataset: string;
  occurrences: number;
  lot: string;
  date: string;
}>;
