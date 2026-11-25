/**
 * Le détecteur de la garde « une entité ENRÔLÉE porte un NOM, jamais une légende » (#1882), joué par le commun
 * (`legende-enrolee-guard.test.ts`) et par chaque projet sur ses paquets.
 * Motif : label d'entité enrôlée, différent du nom de sa fiche, de plus de `MOTS_MAX` mots hors article initial.
 */
import { ficheDEntite } from '../noyau/monde/sceneNpc';
import { presetDuNarratif } from '../noyau/monde/resolveursDuNarratif';
import type { Scene } from '../noyau/monde/scene';
import type { NarratifBlock } from '../data/schemas/defs-scenes/narratif';

const MOTS_MAX = 3;
const ARTICLE = /^(?:les?|la|l[’'])\s*/i;
const legende = (label: string): boolean => label.trim().replace(ARTICLE, '').split(/\s+/).length > MOTS_MAX;

export type PaquetDeScenes = { scenes: Scene[]; narratif?: NarratifBlock };
type Enrole = { site: string; label: string; nomDeFiche: string };

/** Les entités enrôlées nommées des `paquets`, au SITE `scène|entité`. */
export function enroles(paquets: readonly PaquetDeScenes[]): Enrole[] {
  const out: Enrole[] = [];
  for (const { scenes, narratif } of paquets) {
    const presetPnjById = presetDuNarratif(narratif ?? null);
    for (const sc of scenes) for (const enc of sc.encounters)
      for (const m of enc.members ?? []) {
        const ent = sc.entities.find((e) => e.id === m.entityId && e.kind === 'personnage');
        if (!ent?.label) continue;
        out.push({ site: `${sc.id}|${ent.id}`, label: ent.label, nomDeFiche: ficheDEntite({ ...ent, label: undefined }, presetPnjById).label });
      }
  }
  return out;
}

/** Les légendes portées pour nom, hors les SITES exemptés (un nom propre plus long, avec sa raison). */
export const legendesPourNom = (vus: readonly Enrole[], exemptes: ReadonlyMap<string, string>): string[] =>
  vus.filter((v) => legende(v.label) && v.label !== v.nomDeFiche && !exemptes.has(v.site))
    .map((v) => `${v.site} « ${v.label} » (fiche : « ${v.nomDeFiche} »)`);
