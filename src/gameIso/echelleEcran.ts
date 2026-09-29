/** Propriété CSS de l'ÉCHELLE ÉCRAN d'un groupe SVG : pixels d'écran par unité de viewBox de ce qui
 *  vit dans le groupe. Écrite par `stage/stageCam.ts:stageCamStyle` (groupe caméra du jeu) et par
 *  `TopoScene` (plan de station, `meet`) ; lue par les traits de la vue du dessus
 *  (`authoring/wallsSvg.ts:dessusSvg`), dont la chaîne SVG reste ainsi invariante au zoom. */
export const ECHELLE_ECRAN = '--k';
