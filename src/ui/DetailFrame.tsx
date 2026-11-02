import type { ReactNode } from 'react';
import { Prose } from './Prose';
import type { Porteur } from './liage';
import { Row } from './Layout';

/**
 * DetailFrame — cadre de détail de l'élue (en-tête nom + chips méta + rubriques de plein rang +
 * prose sombre à scroll interne), motif `.c-frame`/`.c-meta`/`.c-ink-prose` du kit ratifié
 * « Atelier du scribe » (#412). Aucun slot d'actions — « Suivant » fait déjà ça (le pied de l'étape
 * porte la progression, jamais dupliquée ici).
 */
export function DetailFrame({ topper, label, sub, meta, sections, prose, porteur }: {
  /** Rangée d'en-tête AVANT le nom (ex. chips de variante/lignée) — le cadre en devient le seul
   *  porteur visuel, plus de bloc sibling posé à côté (#393 P3, correction structurelle Race). */
  topper?: ReactNode;
  /** Absent = pas de bande nom/sous-titre par défaut ; `HeroSheet` peut porter son en-tête dans `sections`. */
  label?: ReactNode;
  /** Tagline SOURCÉE affichée à côté du nom (ex. « Livre de base p. 25 ») — jamais de flavor inventé,
   *  toujours dérivée d'un `source.book`/`source.page` de donnée (#393 P4). */
  sub?: ReactNode;
  /** Chips méta (statut, famille, classe…) — rendues sous le nom. */
  meta?: ReactNode;
  /** Rubriques de plein rang (compétences, talents, possessions…). */
  sections?: ReactNode;
  /** Description sourcée (Markdown verbatim) — rendue via `Prose`, scroll interne. */
  prose?: string;
  /** Champ d'où sort `prose` (`{ type, id, chemin }`) — sans lui, aucune mention n'est liée (#1392). */
  porteur?: Porteur;
}) {
  return (
    <div className="detail-frame">
      {topper}
      <DetailIdentity label={label} sub={sub} meta={meta} />
      {sections}
      {prose != null && (
        <div className="detail-frame-prose">
          <Prose md={prose} porteur={porteur} />
        </div>
      )}
    </div>
  );
}

/**
 * BANDE D'IDENTITÉ du cadre de détail : nom + tagline sourcée + rangée de chips méta. Sous-composant
 * de la MÊME primitive, pour que les vues qui portent leur propre alcôve (`HeroSheet` : identité à
 * gauche, rose à droite) composent l'identité au lieu d'en recopier le markup — `band={false}` rend
 * nom et tagline SANS la rangée `.detail-frame-head` (l'alcôve de l'appelant fait déjà la colonne).
 */
export function DetailIdentity({ label, sub, meta, band = true }: {
  label?: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  /** `false` = pas de rangée d'en-tête autour du nom (l'appelant l'empile dans sa propre colonne). */
  band?: boolean;
}) {
  const identity = (
    <>
      <h3 className="detail-frame-name">{label}</h3>
      {sub && <span className="detail-frame-sub">{sub}</span>}
    </>
  );
  return (
    <>
      {label != null && (band ? <Row className="detail-frame-head">{identity}</Row> : identity)}
      {meta && <Row className="detail-frame-meta">{meta}</Row>}
    </>
  );
}
