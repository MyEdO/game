/**
 * PLAQUES DE NOM (#1687) — le NOM des utilisables que la frame montre, posé au-dessus d'eux dans le
 * SVG du plateau. C'est le second peintre de la MÊME liste que les anneaux du monde volumique
 * (`builders/interactHalos`) : un utilisable révélé (Alt maintenu) ou survolé porte son nom, un
 * utilisable MUET n'en porte pas, et le décor qui n'offre rien n'entre jamais dans cette liste.
 *
 * POURQUOI PAS LE PRODUCTEUR D'OFFRES : une plaque ne promet aucun geste — elle dit « ceci a un nom
 * et quelque chose à offrir ». La lier aux offres rendues (`state/offresUtilisables`) lui imposerait
 * la portée du groupe et le tour de l'actif, que la révélation ignore.
 *
 * ANCRAGE : celui de la pastille de gestes, à la lettre — `chromeTransform` pour la case et
 * `chromeHeadPx` pour la hauteur de tête (`InteractHalo` EST un `Ancrage`). Deux calculs de hauteur
 * divergeraient au premier décor volumique.
 *
 * PAS UNE CIBLE : `pointer-events: none` de bout en bout. Le monde entier est cliquable par UN `<svg>`
 * (`SurcoucheIso`) ; une plaque qui prendrait le pointeur mangerait une bande du champ au-dessus de
 * chaque décor, survol compris.
 */
import { CodexTitre } from '../../ui/compendium/CodexRef';
import type { Dims } from '../../geometry/iso';
import type { InteractHalo } from '../builders/interactHalos';
import { useRef } from 'react';
import { chromeHeadPx, chromeTransform, useEchelleEcran, type LiftAt } from './TokenChromeOverlay';
import type { WalkPos } from '../fx/walkPose';
import './plaque-nom.css';

/** Largeur de la boîte, en pixels d'écran : un nom de décor y tient sur une ou deux lignes. */
export const PLAQUE_W = 160;
/** Hauteur de la boîte et écart écran entre la tête du porteur et le bas de la plaque. */
export const PLAQUE_H = 34;
const PLAQUE_GAP = 8;

export interface PlaquesDeNomProps {
  /** Les halos de la frame (`builders/interactHalos`) — la MÊME liste que celle du monde volumique. */
  halos: readonly InteractHalo[];
  dims: Dims;
  liftAt: LiftAt;
  /** Verdict `pionsEnDisques` : la hauteur de tête en dépend, comme pour le chrome des jetons. */
  pions: boolean;
  /** Position visuelle à un instant donné — la même source que le chrome (un décor ne marche pas,
   *  mais l'ancrage, lui, n'a qu'une formule). */
  walkPosAt: (now: number) => WalkPos;
}

export function PlaquesDeNom({ halos, dims, liftAt, pions, walkPosAt }: PlaquesDeNomProps): JSX.Element {
  const mesure = useRef<SVGGElement | null>(null);
  // TAILLE ÉCRAN CONSTANTE : un nom se lit à tout zoom — même contre-échelle que la pastille de gestes
  // (`stage/stageCam`, mesurée sur le SVG porteur).
  const echelle = useEchelleEcran(mesure);
  const wp = walkPosAt(performance.now());
  return (
    <>
      <g ref={mesure} data-plaque-mesure="" pointerEvents="none" />
      {halos.filter((h) => h.etat !== 'muet' && h.label).map((h) => (
        <g key={h.id} data-plaque-nom={h.id} transform={chromeTransform(h, dims, liftAt, wp)} pointerEvents="none">
          <g transform={`scale(${echelle})`}>
            <foreignObject
              x={-PLAQUE_W / 2}
              y={-chromeHeadPx(pions, h) / echelle - PLAQUE_H - PLAQUE_GAP}
              width={PLAQUE_W}
              height={PLAQUE_H}
              style={{ overflow: 'visible' }}
            >
              <div className="plaque-nom halo-champ">
                <CodexTitre title={h.label} />
              </div>
            </foreignObject>
          </g>
        </g>
      ))}
    </>
  );
}
