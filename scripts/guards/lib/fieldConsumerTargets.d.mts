export interface FieldTarget {
  schema: unknown;
  type: string;
  home: string;
}

export const TARGETS: FieldTarget[];
export const LIENS_SCHEMA_TYPES: FieldTarget[];
export function fieldsOf(schema: unknown): string[];
