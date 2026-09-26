/**
 * LA PASTILLE D'UNE ENTITÉ (#1411 P2-C, spec HUD combat zone 4) — le geste vit SUR ce qui l'offre :
 * « Monter » naît de la monture, « Servir »/« Pousser » de la pièce, « Ramasser » du tas au sol. Ces
 * gestes SORTENT de la console (sa géométrie est immuable, arbitrage HUD 2026-08-16) : ils se peignent
 * au-dessus de leur porteur, dans le groupe que la boucle de marche recale déjà (`TokenChromeOverlay`,
 * `subscribeStageFrames`) — aucun état React par frame.
 *
 * TAILLE ÉCRAN CONSTANTE : tout ce qui vit dans le groupe caméra est agrandi par
 * `zoom × viewBoxScale(canvas)` (`stage/stageCam`), si bien qu'une boîte de 44 unités de viewBox ne
 * mesure que 39 px à 1280×720 et 15,6 px à zoom 0,4. La pastille est du CHROME CLIQUABLE : elle porte
 * donc le contre-échelonnement de ce facteur, et sa boîte se dimensionne en PIXELS D'ÉCRAN — la cible
 * de la charte (≥ 40 px, `base.css` § RESPONSIVE) tient alors à tout zoom et tout viewport.
 *
 * PICKING : le monde entier est cliquable par UN `<svg>` (`SurcoucheIso`, handlers de `useStagePointer`),
 * et une pastille dessinée dedans y bullerait — un clic vaudrait le geste ET le clic-monde qui est
 * dessous, et un SURVOL du bouton re-résoudrait le monde sous ce pixel (le bouton flotte au-dessus de
 * la tête : la case résolue n'est plus celle du porteur). Seul le BOUTON (et le panneau qu'il ouvre)
 * reçoit le pointeur et l'arrête — down, MOVE, up, clic (`GatedAction arretePointeur`) : la boîte qui
 * l'entoure est transparente au pointeur (`pointer-events: none`), sans quoi elle mangerait une bande
 * du champ — survol compris.
 */
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Icon } from '../../ui/Icon';
import { GatedAction } from '../../ui/GatedAction';
import { PanneauParametre, type ParamOption } from '../../ui/PanneauParametre';
import { CodexRef } from '../../ui/compendium/CodexRef';
import type { OffreRendue } from '../../state/offreRendue';
import { t } from '../../i18n';
import { useGame } from '../../state/store';
import { getStagePan } from '../../state/stagePan';
import { getStageYaw } from '../../state/stageYaw';
import { subscribeStageFrames } from './stageFrames';
import type { GesteMark } from '../builders/tokenChrome';
import './pastille-entite.css';

/** Côté de la CIBLE TACTILE, en PIXELS D'ÉCRAN (canon de la charte : ≥ 40 px). */
export const PASTILLE_PX = 44;
/** Largeur de la boîte, en pixels d'écran : un libellé de geste et son coût tiennent sur une ligne. */
export const PASTILLE_W = 176;
/** Écart écran entre la tête du porteur et le bas de la pastille. */
const PASTILLE_GAP = 10;


export function PastilleEntite({ mark, headY, echelle }: { mark: GesteMark; headY: number; echelle: number }) {
  const [ouvert, setOuvert] = useState(false);
  const ancre = useRef<HTMLButtonElement>(null);
  const offres = mark.gestes;
  const unique = offres.length === 1 ? offres[0] : null;
  // Le verdict de la pastille : celui de l'offre unique ; sinon celui de la première offre OUVERTE (un
  // porteur dont un geste au moins est ouvert est cliquable), et à défaut le premier refus, qui se lit.
  const verdict = unique ? unique.gate : (offres.find((o) => o.gate.ok)?.gate ?? offres[0].gate);
  const commettre = (o: OffreRendue) => o.onSelect();
  // NOM au survol : le porteur, dans l'UNIQUE infobulle du jeu, et sa RAISON de refus quand AUCUNE de
  // ses offres n'est ouverte (arbitrage 2026-08-24 — la raison au survol, jamais en texte inline).
  const refus = offres.every((o) => !o.gate.ok) ? verdict.reason : undefined;
  const stop = (e: SyntheticEvent) => e.stopPropagation();

  // Le panneau est ancré à un déclencheur qui vit DANS le monde : dès que la caméra bouge (pan, cran de
  // molette, lacet), l'ancre glisse sous lui. Il se ferme alors — annulation GRATUITE, rien n'était
  // engagé. La mesure se fait au battement de la caméra, seul endroit où un pan hors React se voit.
  // Le repère est pris UNE fois, À L'OUVERTURE, et le zoom se LIT au store (jamais en dépendance) :
  // pris en dépendance, chaque cran de molette re-montait l'effet et re-capturait le zoom DÉJÀ changé —
  // la comparaison ne pouvait plus jamais être vraie, et le panneau survivait au zoom (recette 2026-08-23).
  useEffect(() => {
    if (!ouvert) return;
    const pan0 = getStagePan();
    const yaw0 = getStageYaw();
    const zoom0 = useGame.getState().zoom;
    return subscribeStageFrames(() => {
      const pan = getStagePan();
      if (pan.x !== pan0.x || pan.y !== pan0.y || getStageYaw() !== yaw0 || useGame.getState().zoom !== zoom0) setOuvert(false);
    });
  }, [ouvert]);

  const options: ParamOption[] = offres.map((o) => ({
    key: o.id,
    label: o.candidat ? `${o.label} — ${o.candidat}` : o.label,
    meta: o.cost,
    consequence: o.gate.ok ? undefined : o.gate.reason,
    disabled: !o.gate.ok,
    onSelect: () => commettre(o),
  }));

  return (
    <g transform={`scale(${echelle})`}>
      <foreignObject
        x={-PASTILLE_W / 2}
        y={headY / echelle - PASTILLE_PX - PASTILLE_GAP}
        width={PASTILLE_W}
        height={PASTILLE_PX + PASTILLE_GAP}
        style={{ overflow: 'visible' }}
      >
        <CodexRef
          label={mark.label ?? ''}
          refus={refus}
          wrap
          tooltipOnly
          {...(mark.label ? { fallback: {} } : null)}
        >
        <div className="pastille-entite" data-pastille-entite={mark.entityId}>
          <GatedAction
            id={`pastille-${mark.entityId}`}
            btnRef={ancre}
            tactile
            arretePointeur
            label={
              <>
                {(unique ?? offres[0]).icon ? <Icon id={(unique ?? offres[0]).icon!} size="sm" /> : null}
                <span>{unique ? unique.label : t('pastille.nGestes', { n: offres.length })}</span>
                {unique?.cost ? <span className="pe-cost">{unique.cost}</span> : null}
              </>
            }
            enabled={verdict.ok}
            reason={verdict.reason ?? ''}
            onClick={() => (unique ? commettre(unique) : setOuvert(true))}
          />
          {/* Le panneau est PORTALISÉ hors du SVG, mais ses événements remontent l'arbre REACT — donc
              jusqu'aux handlers du monde. Il les arrête ici, au même titre que le bouton. */}
          {ouvert && (
            <div onPointerDown={stop} onPointerMove={stop} onPointerUp={stop} onClick={stop}>
              <PanneauParametre
                anchor={ancre.current}
                intitule={t('pastille.intitule')}
                options={options}
                onClose={() => setOuvert(false)}
              />
            </div>
          )}
        </div>
        </CodexRef>
      </foreignObject>
    </g>
  );
}
