export function cheminsProseNommee(fichiers: readonly { rel: string; text: string }[]): string[];
export interface ClassificationProseLocale {
  fichier: string;
  ligne: number;
  champ: string;
  sorte: 'chaine' | 'opaque';
  regime?: string;
  usage?: string;
  horsContrat?: { motif: string; preuve: string };
  composition?: string;
  opacite?: { nature: string; raison: string };
}
export function classificationsProseLocale(root: string, fichiers: readonly { rel: string; text: string }[], options?: { sourcesAdditionnelles: readonly { rel: string; text: string }[] }): { champs: ClassificationProseLocale[]; fautes: string[]; opaquesImportes: ClassificationProseLocale[]; importsSchemas: { module: string; nom: string }[] };
export function fautesProseFinale(racines: readonly unknown[], primitives: {
  descendre: (racines: readonly unknown[], visite: (v: { noeud: object; path: string }) => void | 'elaguer') => void;
  enfantsDe: (noeud: unknown) => readonly { cle?: string; segment: string; noeud: unknown }[];
  metaDesChamps: (noeud: unknown) => Readonly<Record<string, { texte?: { regime: string; horsContrat?: { motif: string; preuve: string } } }>> | undefined;
  nomDeNoeud: (noeud: unknown) => { opacite?: { nature: string; raison: string } } | undefined;
  declarationDEnfants: (noeud: unknown) => { nature: string } | undefined;
  defDe: (noeud: unknown) => { type: string } | undefined;
  declarationProseNommee: (noeud: unknown) => { champ: string; regime: string } | undefined;
}, bornesImportees?: readonly unknown[], mesure?: { bornesAtteintes: Set<unknown>; exclusions: Map<string, { motif: string; preuve: string }> }): string[];
