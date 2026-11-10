/**
 * GARDE DES PISTES DE CHAÎNE (#3102 ; #2972, commentaire 6389032417, « Appendices », J1) : chaque clip porte, pour
 * chaque os des chaînes du manifeste de base (`ManifesteDeBase.chaines`), une piste de rotation LINEAR, que l'hôte joue
 * telle quelle. Et, par chaîne, sur les échantillons joués, la rotation locale la plus forte d'un de ses os depuis son
 * repos, l'os nommé comme `AnimationMixer` le trouve dans la scène (`PropertyBinding.findNode`, `chargement.ts`).
 */
import { InterpolateLinear, PropertyBinding, Quaternion, type AnimationClip, type Object3D } from 'three';
import { tableTotale } from '../../../../../src/lib/tableTotale.ts';
import type { Ecart } from '../ecart.ts';
import { rotationLocale, type Pose } from '../echantillonnage.ts';

const GARDE = 'chaines';

export interface MesureDeChaine {
  readonly chaine: string;
  readonly os: number;
  /** Les clips qui portent une piste de rotation LINEAR pour chacun de ses os. */
  readonly clipsPistes: number;
  /** La rotation locale la plus forte d'un de ses os depuis son repos, en degrés, et où ; `null` sans échantillon. */
  readonly rotationMax: { readonly degres: number; readonly os: string; readonly clip: string; readonly t: number } | null;
}

/** Les écarts des pistes de chaîne de `clips`, et par chaîne le nombre de clips qui les portent toutes. */
export function gardePistesDeChaine(scene: Object3D, clips: readonly AnimationClip[], chaines: Readonly<Record<string, readonly string[]>>): { ecarts: Ecart[]; clipsPistes: Record<string, number> } {
  const ecarts: Ecart[] = [];
  const clipsPistes: Record<string, number> = tableTotale(Object.keys(chaines), () => 0);
  for (const clip of clips) {
    const pistes = new Map<string, boolean>();
    for (const piste of clip.tracks) {
      const { nodeName, propertyName } = PropertyBinding.parseTrackName(piste.name);
      const noeud = PropertyBinding.findNode(scene, nodeName) as Object3D | null;
      if (noeud && propertyName === 'quaternion') pistes.set(noeud.name, piste.getInterpolation() === InterpolateLinear);
    }
    for (const [chaine, os] of Object.entries(chaines)) {
      const absents = os.filter((o) => !pistes.has(o));
      const nonLineaires = os.filter((o) => pistes.get(o) === false);
      if (absents.length) ecarts.push({ garde: GARDE, code: 'piste-de-chaine-absente', clip: clip.name, valeur: absents.length, seuil: 0, detail: `${chaine} : sans piste de rotation : ${absents.join(', ')}` });
      if (nonLineaires.length) ecarts.push({ garde: GARDE, code: 'piste-de-chaine-non-lineaire', clip: clip.name, valeur: nonLineaires.length, seuil: 0, detail: `${chaine} : piste de rotation non LINEAR : ${nonLineaires.join(', ')}` });
      if (!absents.length && !nonLineaires.length) clipsPistes[chaine]++;
    }
  }
  return { ecarts, clipsPistes };
}

/** Le suivi des rotations des chaînes sur les échantillons : `echantillon` à chaque (clip, t) joué, `mesures` à la fin. */
export function suivreLesChaines(scene: Object3D, chaines: Readonly<Record<string, readonly string[]>>, repos: Pose) {
  const parents = new Map<string, string | undefined>();
  const auRepos = new Map<string, Quaternion>();
  for (const os of Object.values(chaines).flat()) {
    const noeud = scene.getObjectByName(os);
    if (!noeud) throw new Error(`${GARDE} : os ${os} absent de la scène`);
    parents.set(os, noeud.parent?.name);
    auRepos.set(os, rotationLocale(repos, os, noeud.parent?.name, new Quaternion()));
  }
  const pires = new Map<string, NonNullable<MesureDeChaine['rotationMax']>>();
  const courante = new Quaternion();
  return {
    echantillon(e: Pose & { readonly clip: string; readonly t: number }): void {
      for (const [chaine, liste] of Object.entries(chaines)) {
        for (const os of liste) {
          const degres = (rotationLocale(e, os, parents.get(os), courante).angleTo(auRepos.get(os) as Quaternion) * 180) / Math.PI;
          if (degres > (pires.get(chaine)?.degres ?? -1)) pires.set(chaine, { degres, os, clip: e.clip, t: e.t });
        }
      }
    },
    mesures(clipsPistes: Readonly<Record<string, number>>): MesureDeChaine[] {
      return Object.entries(chaines).map(([chaine, os]) => ({ chaine, os: os.length, clipsPistes: clipsPistes[chaine], rotationMax: pires.get(chaine) ?? null }));
    },
  };
}
