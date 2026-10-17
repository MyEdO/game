import { useRef, useState, type DragEvent } from 'react';
import { CALIB_INSTRUCTIONS, type CalibStep } from '../../state/traceCalibration';
import { OptionChooser } from '../OptionChooser';
import { layerLabel } from './LayerField';
import { Row } from '../Layout';
import { ChipDeRefus } from '../ChipDeRefus';

/**
 * Panneau flottant du CALQUE DE RÉFÉRENCE (#830) — décalquer une planche de livre sous la grille de
 * l'éditeur : chargement d'une image locale (fichier ou glisser-déposer), visibilité, opacité,
 * position (au-dessus/en dessous), verrouillage de rotation, et calage 2 POINTS (au lieu de curseurs
 * position/échelle/rotation à tâtonner). Composant purement présentationnel : tout l'état (image,
 * transformation, étape de calage, repli/dépli) vit dans `Editor.tsx`, qui porte aussi la
 * persistance PAR (SCÈNE, COUCHE) (`state/traceLayer.ts`) — ce panneau ne fait AUCUNE hypothèse sur
 * ce stockage.
 *
 * REPLI/DÉPLI (retour user 2026-07-25 — « comment je ferme/ouvre le calque de référence ? ») : l'
 * en-tête compact reste TOUJOURS visible (titre + étage + chevron de divulgation), replié il ne laisse RIEN
 * d'autre — c'est lui-même l'affordance de réouverture, pas de bouton séparé dans une autre barre.
 * Sans calque chargé, le corps (déplié) ne montre qu'un point d'entrée discret pour en charger un —
 * jamais les réglages (opacité/position/…) sans objet.
 */
export function TraceLayerPanel({
  hasLayer,
  ecarte,
  visible,
  opacity,
  calibStep,
  position,
  allowRotation,
  contraste,
  layerZ,
  expanded,
  onLoadFile,
  onToggleVisible,
  onOpacityChange,
  onPositionChange,
  onAllowRotationChange,
  onContrasteChange,
  onToggleExpanded,
  onStartCalibration,
  onCancelCalibration,
  onRemove,
  panelRef,
}: {
  hasLayer: boolean;
  /** Le calque enregistré de cette (scène, couche) était d'un autre format et a été retiré (#2404). */
  ecarte: boolean;
  visible: boolean;
  opacity: number;
  calibStep: CalibStep;
  /** `above` (défaut, décalquer/comparer) ou `below` (dessiner sur du vide — carte neuve). */
  position: 'above' | 'below';
  /** Autorise la calibration à déduire une rotation (planche scannée de travers) — faux par défaut. */
  allowRotation: boolean;
  /** Mode CALAGE : le mobilier volumique en aplat cyan contrasté + arêtes tant que le calque est
   *  visible (`gameIso/backends/webgl/calageProps.ts`). */
  contraste: boolean;
  /** Couche (z) à laquelle s'applique CE calque — affichée pour qu'on ne règle pas l'étage en
   *  croyant être au rez (retour user 2026-07-25). */
  layerZ: number;
  expanded: boolean;
  onLoadFile: (file: File) => void;
  onToggleVisible: () => void;
  onOpacityChange: (opacity: number) => void;
  onPositionChange: (position: 'above' | 'below') => void;
  onAllowRotationChange: (allowRotation: boolean) => void;
  onContrasteChange: (contraste: boolean) => void;
  onToggleExpanded: () => void;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onRemove: () => void;
  /** Géométrie RÉELLE du panneau (ancré bas-GAUCHE du canevas, jamais scrollé avec la grille) — même
   *  discipline que la barre d'étages : sa BOÎTE (pas sa seule hauteur : le panneau ne fait que 220px
   *  de large) sert d'obstruction au cadrage (`useEditorView.scrollTilesIntoView`), pour qu'une case
   *  fautive ne se recentre jamais dessous — ni ne se recadre pour une case qu'il ne couvre pas. */
  panelRef?: (el: HTMLDivElement | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const calibrating = calibStep !== 'idle';

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith('image/')) onLoadFile(f);
  }

  return (
    <div
      ref={panelRef}
      className={`trace-layer-panel panel${expanded ? '' : ' trace-layer-panel-collapsed'}`}
      data-depot={dragOver || undefined}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="btn trace-layer-panel-head"
        onClick={onToggleExpanded}
        aria-expanded={expanded}
      >
        <span>Calque de référence — {layerLabel(layerZ)}</span>
      </button>

      {expanded && (calibrating ? (
        <>
          <p className="hint">{CALIB_INSTRUCTIONS[calibStep as Exclude<CalibStep, 'idle'>]}</p>
          <button className="btn small" onClick={onCancelCalibration}>
            Annuler le calage
          </button>
        </>
      ) : !hasLayer ? (
        <>
          {ecarte && <ChipDeRefus refus={{ message: 'Calque de cet étage d’un autre format : il a été retiré.' }} />}
          <p className="hint">Décalquer une planche de livre (image locale) sous la grille.</p>
          <button
            className="btn small"
            onClick={() => fileRef.current?.click()}
          >
            Charger une image…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onLoadFile(f);
            }}
          />
        </>
      ) : (
        <>
          <Row>
            <Row as="label">
              <input type="checkbox" checked={visible} onChange={onToggleVisible} />
              <span>Visible</span>
            </Row>
          </Row>
          <OptionChooser
            layout="seg"
            groupLabel="Position"
            options={[
              {
                key: 'above',
                label: 'Au-dessus',
                title: 'Décalquer/comparer par-dessus la scène construite (le terrain est opaque — mode dominant)',
                selected: position === 'above',
                onSelect: () => onPositionChange('above'),
              },
              {
                key: 'below',
                label: 'En dessous',
                title: 'Dessiner sur du vide (carte neuve, sans terrain encore posé)',
                selected: position === 'below',
                onSelect: () => onPositionChange('below'),
              },
            ]}
          />
          <label className="field">
            <span>Opacité</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(opacity * 100)}
              onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
            />
          </label>
          <Row as="label">
            <input type="checkbox" checked={allowRotation} onChange={(e) => onAllowRotationChange(e.target.checked)} />
            <span title="Par défaut, le calage 2 points ne résout que translation + échelle (angle verrouillé à 0) : une planche de livre est scannée droite.">
              Autoriser la rotation (scan de travers)
            </span>
          </Row>
          <Row as="label">
            <input type="checkbox" checked={contraste} onChange={(e) => onContrasteChange(e.target.checked)} />
            <span title="Le mobilier volumique de la scène passe en aplat cyan translucide, arêtes soulignées : ce qui vient du plan dessiné et ce qui vient de la scène construite se distinguent. Sans effet quand le calque est masqué.">
              Contraste de calage
            </span>
          </Row>
          <button className="btn small btn-primary" onClick={onStartCalibration}>
            Calibrer 2 points…
          </button>
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            Remplacer l'image
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) onLoadFile(f);
            }}
          />
          <button className="btn small danger" onClick={onRemove}>
            Retirer le calque
          </button>
        </>
      ))}
    </div>
  );
}
