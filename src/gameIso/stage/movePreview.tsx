import type { JSX } from 'react';
/**
 * Tracé d'un DÉPLACEMENT (chemin + case d'arrivée + badge d'action) — source unique du rendu, partagée
 * entre l'aperçu tap-1 (battle.preview, tactile), l'aperçu au SURVOL (desktop), l'aperçu hors combat et
 * le télégraphe de déplacement ENNEMI (teinté).
 */
import { Dims, tileCenter, diamondPath } from '../../geometry/iso';
import { footprintTiles } from '../../state/footprint';
import type { Pt } from '../../state/path';
import { GOLD_TINT } from '../highlightTints';

// `lift` = élévation-écran d'un point (socle `state/scene.ts:liftDe` fermé sur la scène, hauteur
// MÉTRIQUE de la case, couche 0 comprise) ; défaut `() => 0` pour un appelant qui n'a pas de scène.
// Chemin et destination se posent ainsi au même niveau que le trait de mur (rempart, falaise).
// `label` accepte PLUSIEURS lignes : le badge dit le geste (« Aller (2) ») puis ce qu'il fait de la
// ressource (« Mouvement 4 → 2 ») / le palier qu'il produirait — empilées vers le HAUT depuis la case,
// même classe `pv-badge` (aucun style neuf).
export function movePreviewEls(path: Pt[], dest: Pt | null, label: string | string[] | null, d: Dims, keyPrefix: string, color: string = GOLD_TINT, footN = 1, lift: (p: Pt) => number = () => 0): JSX.Element[] {
  const els: JSX.Element[] = [];
  if (path.length > 1) {
    const pts = path.map((p) => tileCenter(p.x, p.y, d, lift(p))).map((p) => `${p.cx},${p.cy}`).join(' ');
    els.push(<polyline key={`${keyPrefix}-path`} points={pts} fill="none" stroke={color} strokeWidth={3} opacity={0.9} pointerEvents="none" />);
  }
  // Destination = TOUTE l'empreinte du mobile (un grand / un cavalier sur monture 2×2 → 4 cases), pas
  // une seule (footN dérivé de la monture par l'appelant). footN=1 → un losange unique (iso-historique).
  const dz = dest ? lift(dest) : 0; // toute l'empreinte est au même étage que la destination
  if (dest) for (const t of footprintTiles(dest, footN)) els.push(<path key={`${keyPrefix}-dest-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, d, dz)} fill="none" stroke={color} strokeWidth={3} opacity={0.95} pointerEvents="none" />);
  const at = dest ?? (path.length ? path[path.length - 1] : null);
  const lignes = (typeof label === 'string' ? [label] : label ?? []).filter(Boolean);
  if (lignes.length && at) {
    const c0 = tileCenter(at.x, at.y, d, lift(at));
    lignes.forEach((ligne, i) => els.push(
      <text key={`${keyPrefix}-lbl-${i}`} x={c0.cx} y={c0.cy - 28 - (lignes.length - 1 - i) * 14} textAnchor="middle" className="pv-badge" pointerEvents="none">{ligne}</text>,
    ));
  }
  return els;
}
