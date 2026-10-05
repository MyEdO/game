/**
 * SONDE DE PICKING (recette, #1411 P2-C) — « que résoudrait un clic à CE pixel ? », sans cliquer.
 *
 * Elle ne tient AUCUNE hypothèse propre. Tout ce que le picking lit lui est FOURNI par ceux qui le
 * possèdent : la CHAÎNE de résolution ET l'inversion du pixel sont `stage/pickResolve.ts`, que le
 * geste (`stage/useStagePointer.ts`) appelle aussi ; le CADRE RENDU — projection, caméra, zoom — est
 * celui que l'hôte de rendu a COMMIS et publié (`stage/spritePicker.ts:getStageFrame`), jamais un
 * cadre rebâti depuis le store. Rebâti, il ignorait la première personne et le lacet lissé, et sa
 * caméra (`store.camPan`) valait (0,0) là où l'écran est centré sur le groupe : la sonde résolvait sur
 * une autre pose que l'image, quand elle résolvait encore. Ne lui reste que la LECTURE de l'élément de
 * stage dans le DOM, faute d'événement de pointeur qui le lui tende.
 *
 * Elle vit ICI, dans `gameIso`, et s'ENREGISTRE auprès de l'outillage de recette (`state/devtools`) :
 * `src/state` ne dépend JAMAIS de `src/gameIso` (règle 3, police de pureté d'`oxlint.config.mjs`). Le sens est donc
 * celui du dépôt — le rendu se déclare au store, le store ne va jamais le chercher.
 */
import { useGame } from '../../state/store';
import { setPickProbe, type PickProbe } from '../../state/devtools';
import { etageActif, getViewZ } from '../../state/viewLevel';
import { poseFromDims } from './projection';
import { getStageFrame, targetUnderPointer } from './spritePicker';
import { pointStageSousPixel, resoudrePixel, tireLeRayon } from './pickResolve';
import { entiteDuGeste } from './geste';

/** Ce que le picking résoudrait sous `px` (pixel CLIENT). `null` tant qu'aucun stage n'est à l'écran. */
export const pickTileAt: PickProbe = (px) => {
  const st = useGame.getState();
  const svg = document.querySelector('svg.iso-stage') as SVGSVGElement | null;
  if (!st.scene || !svg) return null;
  const scene = st.scene;
  // Le cadre PUBLIÉ est la seule pose admise : sans hôte monté, il n'y a pas d'image sous ce pixel, et
  // la sonde le NOMME plutôt que de résoudre sur une pose qu'aucun écran ne rend.
  const cadre = getStageFrame();
  if (!cadre) return { tile: null, cid: null, via: 'aucune', nature: 'case', geste: {} };
  const { dims } = cadre;
  const aretes = cadre.aretes();
  // La caméra est relue À L'APPEL, comme le geste la lit à l'instant de son événement : la boucle
  // d'images la réécrit entre deux rendus.
  const g = pointStageSousPixel(svg, px.x, px.y, cadre.camRendue(), cadre.zoom);
  if (!g) return null; // élément sans surface mesurée : aucune image à sonder
  const visé = tireLeRayon(st) ? targetUnderPointer(px.x, px.y) : null;
  const v = resoudrePixel(st, visé, () => g, { pose: poseFromDims(dims), dims, activeZ: etageActif(st, getViewZ()), aretes });
  // Le VERDICT dit ce que le pixel frappe ; le GESTE dit ce qu'un clic traiterait — un PNJ ancré sur la
  // case rend `nature:'case'` et ouvre pourtant son dialogue. Les deux sont rapportés, par la même
  // fonction que le hook appelle (`stage/geste.ts`).
  return { ...v, geste: { entId: v.tile ? entiteDuGeste(scene, v, v.tile)?.id : undefined } };
};

setPickProbe(pickTileAt);
