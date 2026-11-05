export interface FieldTarget {
  schema: unknown;
  type: string;
  home: string;
}

export const CIBLES_DE_GRAMMAIRE: FieldTarget[];
export const LIENS_SCHEMA_TYPES: FieldTarget[];
export function fieldsOf(schema: unknown): string[];
