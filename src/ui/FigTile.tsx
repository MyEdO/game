import type { ReactNode } from 'react';
import { WaxSeal } from './WaxSeal';
import { Row } from './Layout';
import type { HitLocation } from '../engine/types';

/** Tonalité d'un badge de zone (#492 lot « corps-index », arbitrage user 2026-07-17) — postée en
 *  attribut `data-tone` (jamais une classe par ton, patron déjà tenu par `EtatPanel`/`NotchGauge`) :
 *  `or` (chargé), `warn` (à surveiller, séquelle seule), `sang` (critique/entamé), `dim` (vide/inerte). */
export type ZoneBadgeTone = 'or' | 'warn' | 'sang' | 'dim';

/** Badge PAR Localisation de `FigZoneBadges` : l'appelant fournit la donnée par zone, la primitive la liste. */
export interface ZoneBadgeSpec {
  loc: HitLocation;
  /** Nom de la zone, affiché devant sa valeur. */
  label: string;
  value: ReactNode;
  tone?: ZoneBadgeTone;
  /** Absent = badge STATIQUE (`<span>`) ; présent = un vrai `<button>` focusable. */
  onClick?: () => void;
}

/** Variantes de la tuile (`frames.css`) : rangées compactes et grandes grilles. */
export type FigTileSize = 'compact' | 'big';

/**
 * FigRow — la RANGÉE de tuiles (#717) : grille uniforme (colonnes de largeur FIXE, jamais
 * dimensionnées par le libellé le plus long), 2 colonnes sous 700px. Vit AVEC la primitive (même
 * module, même feuille `frames.css`) — un écran qui montre une compagnie compose CETTE rangée au
 * lieu de redessiner une grille ; `GroupedPickGrid` reste la variante de SÉLECTION (listbox).
 */
export function FigRow({ label, children }: { label?: string; children: ReactNode }) {
  return <div className="fig-row" role={label ? 'group' : undefined} aria-label={label}>{children}</div>;
}

export function FigZoneBadges({ badges }: { badges: ZoneBadgeSpec[] }) {
  const shownBadges = badges.filter((b) => !!b.value);
  if (shownBadges.length === 0) return null;
  return (
    <Row as="span" gap="xs" justify="center">
      {shownBadges.map((b) =>
        b.onClick ? (
          <button key={b.loc} type="button" className="fig-zone-badge" data-loc={b.loc} data-tone={b.tone} onClick={b.onClick}>
            <span className="fig-zone-name">{b.label}</span> {b.value}
          </button>
        ) : (
          <span key={b.loc} className="fig-zone-badge" data-loc={b.loc} data-tone={b.tone}>
            <span className="fig-zone-name">{b.label}</span> {b.value}
          </span>
        ),
      )}
    </Row>
  );
}

/**
 * FigTile — LA tuile UNIQUE (#430/#431), composée par `GroupedPickGrid`, le créateur,
 * l'ouverture de campagne et la galerie :
 * cadre unique à rivets d'or, nom puis compte, état sélectionné = liseré
 * doré, sceau optionnel (`sealed`, patron `SealedPlaque`). Styles : `frames.css` (SEULE définition).
 *
 * `onClick` ABSENT ⇒ rendu STATIQUE (`<div>`, aucune sémantique de bouton/option/roving-tabindex).
 */
export function FigTile({ label, sub, selected, sealed, fig = 'compact', onClick, tabIndex = -1, className }: {
  label?: string;
  sub?: string;
  selected?: boolean;
  /** Sceau de cire au coin (le choix est SCELLÉ) — absent = pas de sceau. Taille et débordement au
   *  patron de la carte-contrat (`.seat-card-seal`, CharCard) : un cachet se voit ou n'est pas un
   *  cachet — il passe PAR-DESSUS le rivet du coin. */
  sealed?: boolean;
  /** Variante — `compact` par défaut. */
  fig?: FigTileSize;
  /** Absent = tuile STATIQUE d'affichage (la compagnie de l'ouverture de campagne), aucune
   *  sémantique de picker. */
  onClick?: () => void;
  /** Roving tabindex (posé par `GroupedPickGrid`) — 0 pour la tuile active du groupe, -1 sinon. */
  tabIndex?: number;
  /** Modificateur d'appelant (ex. liseré de borne « tirée », `.rolled`) — jamais un second cadre,
   *  une classe ADDITIVE sur l'enceinte UNIQUE. */
  className?: string;
}) {
  const cls = ['fig-tile', selected && 'sel', fig !== 'compact' && fig, className].filter(Boolean).join(' ');
  const body = (
    <>
      {sealed && <WaxSeal size={40} className="fig-tile-seal" />}
      {label && <span className="fig-tile-name">{label}</span>}
      {sub && <span className="fig-tile-sub">{sub}</span>}
    </>
  );
  if (!onClick) return <div className={cls}>{body}</div>;
  return (
    <button type="button" role="option" aria-selected={selected} tabIndex={tabIndex} className={cls} onClick={onClick}>
      {body}
    </button>
  );
}
