/**
 * Aperçu RENDU d'une créature depuis sa donnée (id + apparence) — face + profil. Rendu par le MÊME
 * chemin que le jeu (entityRigProfile/resolveRig pour les bipèdes, gabarit pour les non-bipèdes), pour
 * UN individu : celui de la graine de l'apparence, sinon de l'id du record. En jeu, un profil générique
 * tire ses teintes et sa coiffure par instance, donc diffère de cet individu. Recomputé à chaque
 * changement d'apparence : dans l'éditeur, on voit en DIRECT le résultat de la modification.
 */
import { useMemo } from 'react';
import { entityRigProfile } from '../../gameIso/rig/enemyProfile';
import { resolveRig } from '../../gameIso/rig/composeRig';
import { bonesToSvg } from '../../gameIso/rig/renderBones';
import { resolveRender, planById, planOptsForRecord } from '../../gameIso/rig/bodyPlan';
import { hashSeed } from '../../engine/dice';
import { findCreatureById } from '../../data';
import type { View } from '../../gameIso/rig/facing';
import type { EntityAppearance } from '../../engine/authoringAppearance';

// `name` = id de créature (Codex/bestiaire) ; `a.species` = id du vocabulaire rig (validé par
// asRigSpeciesId en aval). Les Nuées tirent leur trait du record par id.
// `porteur` = espèce du PORTEUR déclarée par l'appelant quand l'apparence est un FRAGMENT (mutation,
// trait) : elle alimente l'argument `species` que `resolveRender` consulte en premier, et le fragment
// se compose PAR-DESSUS par le canal habituel (`entityRigProfile`). Sans porteur, rien ne change.
function rigSvg(name: string, a: EntityAppearance | undefined, view: View, porteur?: string): string {
  const species = a?.species ?? porteur;
  const r = resolveRender(species, findCreatureById(name)?.traits, name);
  if (r.kind === 'rig') {
    const p = entityRigProfile(name, hashSeed(name), { ...a, species });
    return p ? bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, view, [])) : '';
  }
  const plan = planById(r.plan);
  if (!plan) return '';
  if (!plan.hasView(r.species, view)) return '';
  return bonesToSvg(plan.resolve(r.species, view, plan.restPose(), planOptsForRecord(name, a)));
}

export function CreaturePreview({ label, appearance, porteur }: { label: string; appearance?: EntityAppearance; porteur?: string }) {
  const key = JSON.stringify(appearance ?? {});
  const views = useMemo(
    () => (['front', 'profile'] as View[]).map((v) => ({ v, svg: rigSvg(label, appearance, v, porteur) })),
    [label, key, porteur], // re-rend à CHAQUE édition d'apparence
  );
  return (
    <div className="creature-preview">
      {views.map(({ v, svg }) => (
        <svg key={v} viewBox="0 0 120 150" className="creature-preview-svg" aria-label={`${label} (${v})`}>
          <g dangerouslySetInnerHTML={{ __html: svg }} />
        </svg>
      ))}
    </div>
  );
}
