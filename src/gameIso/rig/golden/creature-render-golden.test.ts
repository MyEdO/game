/**
 * Golden master de RENDU SVG du bestiaire ENTIER — filet anti-régression VISUELLE pour les tranches
 * de-POC qui suivent (carrière, plan non-bipède, mutant…). Là où `creature-resolution-golden` ne fige
 * que la résolution (plan/espèce/def/échelle), celui-ci fige le SVG RÉSOLU bout-en-bout (carrière/tenue,
 * couleurs, parts, props de plan compris). Toute tranche de-POC doit reproduire ces snapshots à
 * l'identique, sinon une créature change d'apparence.
 *
 * Rend chaque entrée de `creatures.json` via le chemin de PROD (bipède = entityRigProfile+resolveRig ;
 * non-bipède = planById(bodyPlanById).resolve, opts d'apparence du RECORD via planOptsForRecord),
 * en `front`, `profile` et `back`, seed fixe.
 *
 * CE QUE LES SNAPSHOTS `back` FIGENT — ce n'est PAS une couverture d'art (#559). Sans art `back`
 * dédié sur une part, `parts/resolve.ts` (~l.185-189) FABRIQUE une silhouette dorsale générique en
 * jetons (`BACK_TORSE`/`BACK_JAMBE`/`BACK_CRANE`). Mesuré sur cette suite : 472 snapshots `back`, dont
 * 204 (43 %) portent au moins une part dorsale inventée (86 torse, 162 jambe, 5 tête). Ces snapshots
 * figent donc le REPLI, pas un dos authoré : ils protègent d'une régression de composition, ils
 * n'attestent d'aucune intention d'artiste. Ils ont vocation à être REMPLACÉS à mesure que #559 vide
 * son stock de slots front-only (167 mesurés) — un churn de ces snapshots y est ATTENDU, pas suspect.
 */
import { describe, it, expect } from 'vitest';
import { creatures } from '../../../data';
import { entityRigProfile } from '../enemyProfile';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { planById, resolveById, planOptsForRecord } from '../bodyPlan';
import { VIEWS, type View } from '../facing';
const SEED = 7;

function renderSvg(id: string, view: View): string {
  const r = resolveById(id); // résolution data-driven par ID de record (espèce explicite, jamais un name-match)
  if (r.kind === 'rig') {
    const p = entityRigProfile(id, SEED);
    return p ? bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, view, [])) : '∅rig';
  }
  const plan = planById(r.plan);
  if (!plan) return '∅noplan';
  return bonesToSvg(plan.resolve(r.species, view, plan.restPose(), planOptsForRecord(id)));
}

describe('golden — rendu SVG du bestiaire entier (anti-régression de-POC apparence)', () => {
  for (const c of creatures)
    for (const view of VIEWS)
      it(`${c.label} / ${view}`, () => {
        expect(renderSvg(c.id, view)).toMatchSnapshot(); // résolution PAR ID (clé d'affichage = label)
      });
});
