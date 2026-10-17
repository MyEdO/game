import { bookAbr, dataLabel, findBookById } from '../data';
import type { DescRef, SourceRef } from '../data/schemas/grammaire/valeurs';

/** Une source prête à afficher : l'ABRÉVIATION du livre et sa page. */
export interface SourceAffichee {
  book: string;
  page: number;
}

/** Une `SourceRef` de donnée (`book` = id de `books.json`) résolue pour l'affichage : l'id brut
 *  (`livre-de-base`) ne fuite jamais à l'écran, seule son abréviation (`LDB`). */
export const sourceAffichee = (ref: SourceRef): SourceAffichee => ({ book: bookAbr(ref.book), page: ref.page ?? 0 });

/** Une ADRESSE de passage prête à afficher : la réf nue (« EDO 1 ») et son intitulé complet au survol. */
export interface AdresseAffichee {
  libelle: string;
  title: string;
}

/** Une `DescRef` (#1389) résolue pour l'affichage : abréviation du livre et numéro de chapitre, sans le
 *  zéro de remplissage de sa graphie (`ch: '01'`). */
export const adresseAffichee = (ref: DescRef): AdresseAffichee => {
  const chapitre = Number(ref.ch);
  return { libelle: `${bookAbr(ref.book)} ${chapitre}`, title: `${dataLabel(findBookById(ref.book)?.label, ref.book)}, chapitre ${chapitre}` };
};

/**
 * Badge de SOURCE, UNIQUE pour tout l'app : « abréviation du livre p.page » (fiche et infobulle du Codex, Carnet,
 * document remis), l'adresse d'un passage (`adresseAffichee`), ou la réf nue d'une table entière (« LDB 18 »).
 * Son encre et son filet se lisent aux jetons du contexte (`--muted`, `--border`) — un parchemin les surcharge,
 * le badge y reste lisible.
 */
export function SourceBadge({ source }: { source: SourceAffichee | AdresseAffichee | string }) {
  if (typeof source === 'string') return <span className="source-badge">{source}</span>;
  if ('libelle' in source) return <span className="source-badge" title={source.title}>{source.libelle}</span>;
  return (
    <span className="source-badge" title={`${source.book} page ${source.page}`}>
      {source.book} p.{source.page}
    </span>
  );
}
