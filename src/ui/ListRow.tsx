import type { ReactNode } from 'react';

/**
 * RANGÉE DE LISTE SÉLECTIONNABLE — définition UNIQUE du motif « nom à gauche, puces de méta à
 * droite, la rangée entière cliquable ». Il était recopié à la main sur une vingtaine de sites, avec
 * TROIS classes d'état sélectionné concurrentes (`active`, `on`, `is-selected`) — dont une,
 * `is-selected`, qui n'est stylée nulle part : la sélection y était invisible. La primitive tranche :
 * l'appelant déclare `selected`, elle pose la classe que la CSS de sa famille sait peindre.
 *
 * `variant` = la famille de style, portée en `data-variant` sur la balise : `insp` (panneaux de
 * l'ÉDITEUR) ou `codex` (écrans de consultation du JEU) — les deux vivent chez `.listrow`
 * (components.css). Les puces se passent en `children` (`<span className="chip">`) : la rangée décide
 * de leur PLACE, jamais de leur contenu. Une méta qui n'est pas une puce (une date, une ligne
 * descriptive) passe en `subtitle` : elle se range SOUS le nom, dans sa colonne.
 */
export function ListRow({
  onClick,
  label,
  subtitle,
  title,
  selected,
  variant = 'insp',
  children,
}: {
  onClick: () => void;
  /** Colonne gauche : icône + libellé. */
  label: ReactNode;
  /** Ligne secondaire sous le libellé, dans la colonne du nom (encre `.muted`). */
  subtitle?: ReactNode;
  title?: string;
  /** Sélection SIMPLE : la rangée élue est l'item COURANT de son ensemble (`aria-current`), pas un
   *  interrupteur — les rangées non élues n'annoncent donc rien. Absent = la liste ne porte AUCUNE
   *  sémantique de sélection (rangée de navigation) : ni classe d'état, ni attribut d'état. */
  selected?: boolean;
  variant?: 'insp' | 'codex';
  /** Puces de méta, alignées à droite. */
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="listrow"
      data-variant={variant}
      title={title}
      aria-current={selected ? 'true' : undefined}
      onClick={onClick}
    >
      <span className="lr-name">
        {label}
        {subtitle != null && <span className="lr-sub muted">{subtitle}</span>}
      </span>
      {children}
    </button>
  );
}
