/**
 * FORMES d'une arête de mur (#1883) et leur ADMISSION par une apparence — une propriété de la DONNÉE
 * `structureAppearance.json`, lue sur les blocs que l'apparence DÉCLARE (`window`, `door`, `parapet`,
 * `claireVoie`), jamais sur une liste d'ids ni sur l'absence d'un bloc. Source UNIQUE, lue par le schéma
 * (`schemas/defs/structureAppearance.ts`, son refine), la dérivation de forme d'un segment
 * (`state/formeArete.ts`) et le rendu (`gameIso/builders/walls.ts`, `gameIso/authoring/wallsSvg.ts`).
 */

/** `fermeture-fixe` : Structure de nature `porte` posée sans `seg.door` — brèchable, jamais ouvrable. */
export type FormeArete = 'mur-nu' | 'mur-fenetre' | 'porte-fermee' | 'porte-ouverte' | 'fermeture-fixe';

const FORMES_ARETE: readonly FormeArete[] = ['mur-nu', 'mur-fenetre', 'porte-fermee', 'porte-ouverte', 'fermeture-fixe'];

/** Formes où le mur est percé d'une BAIE (porte ouvrable, ouverte ou fermée, ou fermeture fixe). */
const BAIES: readonly FormeArete[] = ['porte-fermee', 'porte-ouverte', 'fermeture-fixe'];

/** La forme perce-t-elle le mur d'une baie (porte ouvrable ou fermeture fixe) ? */
export function estBaie(forme: FormeArete): boolean {
  return BAIES.includes(forme);
}

/** La baie est-elle BOUCHÉE (porte fermée ou fermeture fixe) — seule la porte ouverte laisse le vide ? */
export function estBaieFermee(forme: FormeArete): boolean {
  return forme === 'porte-fermee' || forme === 'fermeture-fixe';
}

/** Ce qu'une apparence déclare, et que l'admission lit. */
export interface BlocsDApparence {
  window?: unknown;
  door?: unknown;
  parapet?: { corpsDeGarde?: unknown };
  claireVoie?: unknown;
}

/** L'apparence HABILLE-t-elle une baie ? Sur une courtine (`parapet`), son `corpsDeGarde`, dont la
 *  branche de rendu barre le passage fermé de la `claireVoie` de racine — les deux blocs ensemble ;
 *  ailleurs, son bloc `door`. Le refine du schéma exige qu'un `corpsDeGarde` déclaré l'habille. */
export function habilleUneBaie(app: BlocsDApparence): boolean {
  return app.parapet ? !!app.parapet.corpsDeGarde && !!app.claireVoie : !!app.door;
}

/**
 * Formes qu'une apparence sait HABILLER, lues sur ses blocs DÉCLARÉS (`gameIso/builders/walls.ts`,
 * `wallFaces`) :
 *  - mur nu → toujours : chaque branche dessine un pan plein depuis les champs de l'apparence (courtine
 *    d'un `parapet`, claire-voie, panneau) ;
 *  - mur fenêtré → bloc `window`, hors `parapet` (la branche de courtine ne dessine pas de croisée) ;
 *  - porte fermée, ouverte, fermeture fixe → `habilleUneBaie`.
 */
export function formesAdmises(app: BlocsDApparence): readonly FormeArete[] {
  const baie = habilleUneBaie(app);
  return FORMES_ARETE.filter((f) => f === 'mur-nu' || (f === 'mur-fenetre' ? !!app.window && !app.parapet : baie));
}
