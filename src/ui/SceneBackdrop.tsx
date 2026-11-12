import { CADRE_DES_FONDS, FONDS } from '../data/fonds';
import { RuleDivider } from './Ornaments';

/**
 * Slot d'illustration d'ambiance (#371 lot 1) — bande en bord haut d'un panneau (auberge du hub,
 * table de jeu de taverne…). `backdropId` réfère le registre `src/data/fonds` ; absent ou id
 * inconnu → repli élégant (dégradé de tokens + fleuron des `Ornaments`), jamais un trou.
 */
export function SceneBackdrop({ backdropId, className }: { backdropId?: string; className?: string }) {
  const def = backdropId ? FONDS[backdropId] : undefined;
  return (
    <div className={`scene-backdrop${className ? ` ${className}` : ''}`}>
      {def ? (
        <svg viewBox={`0 0 ${CADRE_DES_FONDS.largeur} ${CADRE_DES_FONDS.hauteur}`} preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false" dangerouslySetInnerHTML={{ __html: def.svg }} />
      ) : (
        <div className="scene-backdrop-fallback"><RuleDivider /></div>
      )}
    </div>
  );
}
