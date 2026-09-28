/**
 * MESSAGES de COMPATIBILITÉ apparence × forme des arêtes et des façades (#1883) : les refus nommés que
 * `validateScene` émet, lus sur la dérivation de forme (`state/formeArete.ts`) et l'admission de
 * l'apparence (`data/formesDArete.ts`).
 */
import type { FacadeFeature, Scene } from './scene';
import { facadePreset, KINDS_DE_DECOR } from '../data/facadePresets';
import { facadeFeatureKindSchema } from '../data/schemas/defs-scenes/scene';
import { valeursDe } from '../data/schemas/grammaire/meta';
import { formesAdmises, type FormeArete } from '../data/formesDArete';
import { apparenceDeLArete, apparenceDOrnement, apparenceParId, formesHorsCompatibilite, libelleArete } from './formeArete';

const LIBELLE_FORME: Record<FormeArete, string> = {
  'mur-nu': 'mur nu',
  'mur-fenetre': 'mur fenêtré',
  'porte-fermee': 'porte fermée',
  'porte-ouverte': 'porte ouverte',
  'fermeture-fixe': 'fermeture fixe',
};

const libelles = (formes: readonly FormeArete[]): string => formes.map((f) => `« ${LIBELLE_FORME[f]} »`).join(', ');

/** Libellé d'un ornement, lu sur l'enum nommé `facadeFeatureKindSchema`. */
const LIBELLE_ORNEMENT = valeursDe(facadeFeatureKindSchema) as Readonly<Record<FacadeFeature['kind'], string>>;

/** Un message nommé par arête dont l'apparence RÉSOLUE (`apparenceDeLArete`) est absente du catalogue
 *  `structureAppearance.json`, ou n'habille pas une des formes que l'arête prend (lu par `validateScene`).
 *  Une arête sous une façade hors préset n'a pas d'apparence : `facadesHorsCompatibilite` dit la faute,
 *  une fois. */
export function aretesHorsCompatibilite(scene: Pick<Scene, 'walls' | 'architecture'>): string[] {
  const out: string[] = [];
  for (const w of scene.walls ?? []) {
    const ou = `Arête ${libelleArete(w)}`;
    const id = apparenceDeLArete(scene, w);
    if (id === undefined) continue;
    const app = apparenceParId(id);
    if (!app) {
      out.push(`${ou} : l’apparence « ${id} » est absente du catalogue des apparences de mur.`);
      continue;
    }
    const hors = formesHorsCompatibilite(w, app);
    if (hors.length)
      out.push(`${ou} : l’apparence « ${app.label} » n’habille pas la forme ${libelles(hors)} — elle admet ${libelles(formesAdmises(app))}. Change l’apparence, ou la nature de l’arête.`);
  }
  return out;
}

/** Un message nommé par section de façade dont l'apparence n'est pas un préset (`FACADE_PRESETS`) ; par
 *  ornement de DÉCOR (`KINDS_DE_DECOR`) sans vignette au préset ; par ornement de MUR sans apparence
 *  (`apparenceDOrnement`) ou d'apparence inconnue ; par bande de fenêtres dont
 *  l'apparence n'habille pas le mur fenêtré (lu par `validateScene`). */
export function facadesHorsCompatibilite(scene: Pick<Scene, 'architecture'>): string[] {
  const out: string[] = [];
  for (const body of scene.architecture ?? [])
    for (const section of body.facades) {
      const preset = facadePreset(section.appearance);
      if (!preset) {
        out.push(`Façade « ${section.id} » (${body.id}) : « ${section.appearance} » n’est pas un préset de façade.`);
        continue;
      }
      for (const feature of section.features ?? []) {
        const libelle = LIBELLE_ORNEMENT[feature.kind];
        const ou = `Façade « ${section.id} » (${body.id}), ornement « ${feature.id} » (${libelle})`;
        if (KINDS_DE_DECOR.has(feature.kind)) {
          if (!preset.features[feature.kind]) out.push(`${ou} : le préset « ${preset.id} » n’a pas de décor « ${libelle} ».`);
          continue;
        }
        const id = apparenceDOrnement(section.appearance, feature);
        const app = id === undefined ? undefined : apparenceParId(id);
        if (id === undefined) out.push(`${ou} : aucune apparence — ni la sienne, ni celle que route le préset « ${preset.id} ».`);
        else if (!app) out.push(`${ou} : l’apparence « ${id} » est absente du catalogue des apparences de mur.`);
        else if (feature.kind === 'window-band' && !formesAdmises(app).includes('mur-fenetre'))
          out.push(`${ou} : l’apparence « ${app.label} » n’habille pas la forme « ${LIBELLE_FORME['mur-fenetre']} ».`);
      }
    }
  return out;
}
