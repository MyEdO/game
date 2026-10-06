import { bookAbr } from '../data';
import type { SourceRef } from '../data/schemas/grammaire/valeurs';

/** Une source prête à afficher : l'ABRÉVIATION du livre et sa page. */
export interface SourceAffichee {
  book: string;
  page: number;
}

/** Une `SourceRef` de donnée (`book` = id de `books.json`) résolue pour l'affichage : l'id brut
 *  (`livre-de-base`) ne fuite jamais à l'écran, seule son abréviation (`LDB`). */
export const sourceAffichee = (ref: SourceRef): SourceAffichee => ({ book: bookAbr(ref.book), page: ref.page ?? 0 });

/**
 * Badge de SOURCE, UNIQUE pour tout l'app : « abréviation du livre p.page » (fiche et infobulle du Codex, Carnet,
 * document remis), ou la réf nue d'une table entière (« LDB 18 »). Son encre et son filet se lisent
 * aux jetons du contexte (`--muted`, `--border`) — un parchemin les surcharge, le badge y reste lisible.
 */
export function SourceBadge({ source }: { source: SourceAffichee | string }) {
  if (typeof source === 'string') return <span className="source-badge">{source}</span>;
  return (
    <span className="source-badge" title={`${source.book} page ${source.page}`}>
      {source.book} p.{source.page}
    </span>
  );
}
