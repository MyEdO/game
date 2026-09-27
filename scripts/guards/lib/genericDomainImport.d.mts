export interface Systeme {
  id: string;
  modules: string[];
}
export interface Primitive {
  id: string;
  fichier: string;
}
export interface DomainImportFinding {
  target: string;
  systemId: string;
}
export interface PrimitiveDomainFinding {
  primitiveId: string;
  fichier: string;
  target: string;
  systemId: string;
}

export function computeOwnerSystems(systemes: Systeme[], cache?: Map<string, string[] | null>): Map<string, string[]>;
export function scanGenericDomainImport(
  primitiveFile: string,
  contenu: string,
  ownerSystems: Map<string, string[]>,
): DomainImportFinding[];
export function scanAllPrimitives(
  primitives: Primitive[],
  systemes: Systeme[],
  readFile?: (path: string) => string,
): PrimitiveDomainFinding[];
