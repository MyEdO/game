import type { SourceRef } from '../data/schemas/grammaire/valeurs';
import { RefField } from './compendium/RefField';
import { NumberField } from './NumberField';

/** Saisie en cours d'une `SourceRef` : livre et page peuvent manquer tant que l'auteur tape. */
export type SourceSaisie = { book?: string; page?: number; note?: string };

/**
 * Éditeur UNIQUE d'une `SourceRef` (`sourceRefSchema`) : livre choisi dans `books` (id stocké), page
 * imprimée, `note` facultative (`avecNote`). Livre ET page vides = aucune source (`undefined`) ; la
 * `note` déjà posée survit à l'édition du livre ou de la page.
 */
export function SourceRefField({ label, value, onChange, avecNote }: {
  label: string;
  value: SourceSaisie | undefined;
  onChange: (source: SourceRef | undefined) => void;
  avecNote?: boolean;
}) {
  const s = value ?? {};
  const poser = (next: SourceSaisie) => {
    const book = next.book ?? '';
    const page = next.page ?? 0;
    onChange(book || page ? { book, page, ...(next.note ? { note: next.note } : {}) } : undefined);
  };
  // UN libellé visible (celui du champ) : livre, page et note sont des contrôles NUS, nommés pour
  // l'accessibilité seulement (`RefField nu`, `NumberField variant="nu"`).
  return (
    <div className="ed-field">
      <span>{label}</span>
      <div className="source-ref">
        <span className="source-ref-livre">
          <RefField
            cfg={{ ds: 'books', single: true }}
            label={`${label} — livre`}
            value={s.book ?? ''}
            onChange={(v) => poser({ ...s, book: typeof v === 'string' ? v : '' })}
            nullable
            nu
          />
        </span>
        <span className="source-ref-page">
          <NumberField variant="nu" label={`${label} — page`} placeholder="page" vide value={s.page} onChange={(page) => poser({ ...s, page: page ?? 0 })} />
        </span>
        {avecNote && (
          <input className="source-ref-note" aria-label={`${label} — note`} placeholder="note (facultatif)" value={s.note ?? ''} onChange={(e) => poser({ ...s, note: e.target.value || undefined })} />
        )}
      </div>
    </div>
  );
}
