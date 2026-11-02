import { defsGlobaux } from '../gameIso/sprites';

/** Injection UNIQUE des <defs> partagés (dégradés terrain, alarme et FX) pour tout le document :
 *  les références SVG url(#id) se résolvent au niveau du DOCUMENT, donc un seul hôte monté
 *  en tête d'App suffit à tous les <svg> de l'UI (fiche, créateur, Codex, éditeur…).
 *  Exceptions qui GARDENT leurs defs locaux : les rendus SSR autonomes (planches de `scripts/qc/`,
 *  ItemIcon rendu hors App). */
export function GlobalSvgDefs() {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: defsGlobaux() }} />
    </svg>
  );
}
