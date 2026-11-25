/**
 * Provenance d'un paquet (#2001, #2427) : ses proses SOURCÉES, par co-descente du projet et de ses déclarations de
 * prose (`proseSourcees`), et ses fautes de provenance (`fautesDeProvenance`) — partagées par le commun
 * (`provenance-du-paquet.test.ts`) et par chaque projet sur ses paquets.
 */
import type { ZodType } from 'zod';
import type { ProjectDoc } from './worldMap';
import { books } from '../data';
import { coDescendre, type PointDeDonnee } from '../data/schemas/grammaire/descente';
import { declarationProseNommee, sourceHeritee } from '../data/schemas/grammaire/prose';
import { projetSchema } from '../data/schemas/defs-scenes/projet';
import { estObjet } from '../lib/objet.mjs';

export interface ProseSourcee {
  chemin: string;
  texte: string;
  source: { book?: unknown; page?: unknown };
}

/** Chemin lisible d'un point : un élément de liste est nommé par son `id` quand il en porte un. */
export const cheminDe = (p: PointDeDonnee): string =>
  p.chemin
    .map((seg, i) => {
      if (typeof seg === 'string') return `.${seg}`;
      let q: PointDeDonnee = p;
      for (let k = p.chemin.length - 1; k > i; k -= 1) q = q.parent!;
      const id = (q.valeur as { id?: unknown } | null)?.id;
      return `[${typeof id === 'string' ? id : seg}]`;
    })
    .join('');

/** #2427 — co-descente du projet et déclarations de prose. */
export function proseSourcees(projet: unknown, fichier: string, out: ProseSourcee[]): void {
  coDescendre(projetSchema, projet, (p) => {
    if (p.chemin.length === 0) return;
    const rec = p.valeur;
    if (!estObjet(rec)) return;
    const n = rec as Record<string, unknown>;
    const nommee = p.noeuds.map(declarationProseNommee).find((d) => d !== undefined);
    if (n.adapteDe !== undefined) return;
    const source = estObjet(n.source) ? n.source : nommee ? undefined : sourceHeritee(p);
    if (!source) return;
    const champs = nommee ? [nommee.champ] : ['desc'];
    for (const key of champs) {
      const texte = n[key];
      if (typeof texte === 'string') out.push({ chemin: `${fichier}${cheminDe(p)}.${key}`, texte, source });
    }
  });
}

export type DocDeProvenance = Pick<ProjectDoc, 'source' | 'scenes' | 'narratif'>;

/** #2001 ; #2427. */
export function fautesDeProvenance(doc: DocDeProvenance, fichier: string): string[] {
  const livres = new Set<string>(books.map((b) => b.id));
  const fautes: string[] = [];
  const marche = (v: unknown, chemin: string): void => {
    if (Array.isArray(v)) return v.forEach((x, i) => marche(x, `${chemin}[${i}]`));
    if (v == null || typeof v !== 'object') return;
    const adapte = (v as { adapteDe?: { book?: unknown } }).adapteDe;
    if (adapte !== undefined && !(typeof adapte.book === 'string' && livres.has(adapte.book))) {
      fautes.push(`${fichier}${chemin}.adapteDe : book « ${String(adapte.book)} » absent de books.json`);
    }
    for (const [k, x] of Object.entries(v)) marche(x, `${chemin}.${k}`);
  };
  marche(doc, '');
  coDescendre(projetSchema, doc, (p) => {
    const schema = p.noeuds.find((n): n is ZodType => declarationProseNommee(n)?.regime === 'document');
    if (!schema) return;
    const resultat = schema.safeParse(p.valeur);
    if (!resultat.success) for (const issue of resultat.error.issues) {
      fautes.push(`${fichier}${cheminDe(p)}${issue.path.length ? '.' + issue.path.join('.') : ''} : ${issue.message}`);
    }
  });
  return fautes;
}
