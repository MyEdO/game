/**
 * ARÊTES UTILISABLES — LE peintre des gestes portés par une arête de scène : franchir un seuil,
 * grimper, sauter en bas, frapper une fortification. UN composant, une TABLE de matière par capacité
 * (`MATIERE`) : une capacité de plus est une entrée de plus, jamais un overlay de plus.
 *
 * Ce peintre ne porte AUCUN handler de pointeur : l'arête est un étage de la chaîne de picking
 * (`stage/pickResolve.ts:areteSousLePixel`, consulté avant le rayon), et le survol comme le clic lui
 * arrivent déjà tranchés par le verdict (`areteSurvolee`, `activerArete`). Ce qu'il garde, parce que
 * la chaîne ne le rend pas : le TRACÉ ; le CLAVIER — `role="button"`, `tabIndex`, `aria-label`,
 * Entrée/Espace qui appellent la MÊME fonction que le verdict de pixel, et le FOCUS, qui pose le survol
 * par la MÊME source que le pointeur (l'accent d'une arête focalisée EST son rendu de focus : le contour
 * du navigateur ne suit pas un trait SVG transparent) ; et le `<title>`, l'infobulle NATIVE du nom au
 * survol, qu'un élément sans hit-test ne montrerait jamais — le seul trait qui le porte est donc
 * hit-testable (`pointerEvents="visibleStroke"`), sans handler : l'événement bulle jusqu'au SVG racine
 * du stage (`gameIso/SurcoucheIso.tsx`, porteur de `useStagePointer.handlers`), qui résout par le PIXEL
 * et non par la cible. Une seule chaîne d'activation, donc, et le nom de l'arête lisible au survol, rendu
 * par ce `<title>` natif.
 *
 * Sa population EST celle du dériveur (`state/aretes.ts:aretesUtilisables`) : il ne refiltre ni la
 * couche active ni le brouillard, sinon peintre et chaîne offriraient deux gestes différents.
 */
import type { ReactNode } from 'react';
import type { AreteUtilisable, CapaciteArete } from '../../state/aretes';
import type { AreteProjetee, PointEcran } from './aretesProjetees';
import { GOLD_TINT } from '../highlightTints';

/** Le segment d'écran de l'arête, tel que l'hôte l'a projeté — la matière n'en fabrique aucun autre. */
interface Segment {
  a: PointEcran;
  b: PointEcran;
}

/** Ce qu'une capacité peint SUR son segment : les classes de son groupe, ses marques et le CURSEUR de
 *  sa prise. Le trait de PRISE (transparent, a11y) est commun aux quatre et vit hors de la table. */
interface Matiere {
  classes: (arete: AreteUtilisable, accentuee: boolean) => string;
  marques: (arete: AreteUtilisable, seg: Segment, accentuee: boolean) => ReactNode;
  /** Curseur porté par le trait de prise : ce que le geste ANNONCE. Une cible de combat prend le
   *  réticule (`crosshair`), un geste de déplacement la main (`pointer`). Il vit ICI, avec la matière,
   *  parce qu'il dépend de la capacité : le stage, lui, ne connaît que la nature du verdict. */
  cursor: string;
}

/** Trait de DÉNIVELÉ (escalade, chute) : le même pointillé sobre pour les deux gestes, à l'encre
 *  `--iso-climb`, sur toute l'arête ; l'armement (survol, focus, tap-1) le rend franc. */
const denivele: Matiere = {
  cursor: 'pointer',
  classes: (arete) => `arete-denivele arete-${arete.capacite}`,
  marques: (arete, { a, b }, accentuee) => (
    <line
      data-arete-trait={arete.capacite}
      x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
      stroke="var(--iso-climb)"
      strokeWidth={9}
      strokeLinecap="round"
      strokeDasharray="3 5"
      opacity={accentuee ? 0.95 : 0.5}
      pointerEvents="none"
    />
  ),
};

/** SEUIL de pièce (passage, porte, sortie) : marqueur au MILIEU de l'arête — jamais un trait pleine
 *  arête —, symbole propre au battant fermé et à la sortie, accent local au survol. */
const seuil: Matiere = {
  cursor: 'pointer',
  classes: (arete, accentuee) => {
    const portal = arete.portail;
    if (!portal) return '';
    return ['room-portal', `portal-${portal.kind}`, portal.exterior ? 'portal-exterior' : '', accentuee ? 'portal-highlight' : '']
      .filter(Boolean).join(' ');
  },
  marques: (arete, { a, b }, accentuee) => {
    const portal = arete.portail;
    if (!portal) return null;
    const mx = (a.cx + b.cx) / 2;
    const my = (a.cy + b.cy) / 2;
    const edgeLength = Math.hypot(b.cx - a.cx, b.cy - a.cy);
    const ux = (b.cx - a.cx) / edgeLength;
    const uy = (b.cy - a.cy) / edgeLength;
    const nx = -uy;
    const ny = ux;
    const stroke = portal.exterior
      ? GOLD_TINT
      : portal.kind === 'door-closed'
        ? 'var(--iso-door-closed)'
        : 'var(--iso-door-open)';
    return (
      <>
        <line
          data-portal-visual="passive"
          x1={mx - ux * 5.9}
          y1={my - uy * 5.9}
          x2={mx + ux * 5.9}
          y2={my + uy * 5.9}
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.38}
          pointerEvents="none"
        />
        {accentuee && (
          <line
            data-portal-visual="accent"
            x1={mx - ux * 8.9}
            y1={my - uy * 8.9}
            x2={mx + ux * 8.9}
            y2={my + uy * 8.9}
            stroke={stroke}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={0.95}
            pointerEvents="none"
          />
        )}
        {portal.kind === 'door-closed' && (
          <line
            data-portal-visual="passive"
            data-portal-symbol="closed"
            x1={mx - nx * 3.5}
            y1={my - ny * 3.5}
            x2={mx + nx * 3.5}
            y2={my + ny * 3.5}
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.38}
            pointerEvents="none"
          />
        )}
        {portal.exterior && (
          <path
            data-portal-symbol="exterior"
            d={`M${mx - nx * 2 - ux * 4},${my - ny * 2 - uy * 4} L${mx + nx * 4},${my + ny * 4} L${mx - nx * 2 + ux * 4},${my - ny * 2 + uy * 4}`}
            fill="none"
            stroke={stroke}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.38}
            pointerEvents="none"
          />
        )}
      </>
    );
  },
};

/** STRUCTURE de siège (AA 10 l.94-102) : le mur PORTE déjà son trait (`stage/layers.ts:wallTraitObjs`) et
 *  sa visée son réticule (`stage/AimOverlay.tsx`) — la capacité n'ajoute donc AUCUNE marque, elle ne
 *  met qu'une prise sur l'arête. Sa classe la nomme, comme les autres, et son curseur dit ce qu'elle
 *  est : une cible de combat. */
const fortification: Matiere = {
  cursor: 'crosshair',
  classes: (arete) => `arete-${arete.capacite}`,
  marques: () => null,
};

/** LA table : une capacité, une matière. Les deux gestes de DÉNIVELÉ partagent la leur — même trait,
 *  même encre, même largeur (verdict de design du 2026-09-10) ; ce qui les distingue est leur SOURCE
 *  (deux dériveurs) et leur libellé, tous deux déjà tranchés en amont. */
const MATIERE: Readonly<Record<CapaciteArete, Matiere>> = {
  porte: seuil,
  escalade: denivele,
  chute: denivele,
  structure: fortification,
};

interface AreteOverlayProps {
  /** Arêtes utilisables que l'hôte a dérivées PUIS projetées — chacune porte son geste, son libellé et
   *  le segment d'écran que le picking résout. Le peintre ne projette rien lui-même : une seconde
   *  projection ici, et le trait dirait un geste que le clic ne trouve pas. */
  aretes: readonly AreteProjetee[];
  /** CLÉ de l'arête survolée (pointeur ou focus clavier), source unique de l'accent et de l'armement. */
  areteSurvolee: string | null;
  activerArete: (arete: AreteUtilisable) => void;
  /** FOCUS clavier sur une arête : il pose le survol par le MÊME canal que le pixel
   *  (`useStagePointer.survolerArete`), donc l'arête focalisée porte l'accent et le geste est armé —
   *  une Entrée suffit, y compris sur un appareil qui ne survole pas. */
  onFocusArete: (arete: AreteUtilisable) => void;
  onBlurArete: () => void;
}

export function AreteOverlay({ aretes, areteSurvolee, activerArete, onFocusArete, onBlurArete }: AreteOverlayProps) {
  return (
    <>
      {aretes.map(({ arete, a, b }) => {
        const matiere = MATIERE[arete.capacite];
        const accentuee = arete.cle === areteSurvolee;
        return (
          <g key={arete.cle} className={matiere.classes(arete, accentuee)}>
            {matiere.marques(arete, { a, b }, accentuee)}
            {/* L'ARÊTE elle-même : un trait de PRISE sans aucun handler — la chaîne répond pour elle,
                à la MÊME largeur de prise. Il reste hit-testable pour la seule chose que la chaîne ne
                rend pas, l'infobulle native de son `<title>` ; l'événement qui s'y pose bulle jusqu'au
                handler racine. C'est aussi un bouton ATTEIGNABLE au clavier. Il porte enfin le `cid`
                de l'arête quand elle en a un (structure) : le nœud `[data-cid]` que la recette mesure
                (`state/devtools.ts:screenPos`) et la voie AFFINE de `stage/spritePicker.ts` lisent. */}
            <line
              data-arete-cible={arete.capacite}
              data-cid={arete.cid}
              x1={a.cx}
              y1={a.cy}
              x2={b.cx}
              y2={b.cy}
              stroke="transparent"
              strokeWidth={arete.largeurPrise}
              strokeLinecap="round"
              pointerEvents="visibleStroke"
              tabIndex={0}
              role="button"
              aria-label={arete.libelle}
              style={{ outline: 'none', cursor: matiere.cursor }}
              onFocus={() => onFocusArete(arete)}
              onBlur={() => onBlurArete()}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                activerArete(arete);
              }}
            >
              <title>{arete.libelle}</title>
            </line>
          </g>
        );
      })}
    </>
  );
}
