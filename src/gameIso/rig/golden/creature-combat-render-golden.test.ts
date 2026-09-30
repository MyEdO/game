/**
 * Golden master du rendu COMBAT des bipèdes par le chemin RÉEL de prod (`sceneMeshes.actorDrawInputs`) :
 * spawn (`creatureToCombatant`) → `enemyRigProfile` PUIS application des visuels d'ÉTAT du combattant
 * (`combatantAppearance` + `combatantOverlays` = mutations RÉELLES de `c.mutations`, amputations,
 * traits) → SVG. Couvre le chemin SPÉCIFIQUE au combat : équipement synthétisé des traits/PA, tenue
 * data-driven, ET les calques de mutation DATA-DRIVEN (ex. Mutant → trait « Mutation (Cornes
 * asymétriques) » + tirage → cornes + mutation tirée). Filet contre toute régression d'apparence en
 * combat.
 *
 * Non-bipèdes : `actorDrawInputs(c).rig` absent (rendus par le chemin plan = déjà couvert par
 * `creature-render-golden`) → ignorés ici.
 *
 * CE QUE LES SNAPSHOTS `back` FIGENT — ce n'est PAS une couverture d'art (#559). Sans art `back`
 * dédié sur une part, `parts/resolve.ts` (~l.185-189) FABRIQUE une silhouette dorsale générique en
 * jetons (`BACK_TORSE`/`BACK_JAMBE`/`BACK_CRANE`). Cette suite est la plus exposée (100 % bipèdes,
 * donc 100 % soumise à ce repli) : 331 snapshots `back`, dont 277 (84 %) portent au moins une part
 * dorsale inventée (221 torse, 235 jambe, 1 tête). Ces snapshots figent donc le REPLI, pas un dos
 * authoré : ils protègent d'une régression de composition, ils n'attestent d'aucune intention
 * d'artiste. Ils ont vocation à être REMPLACÉS à mesure que #559 vide son stock de slots front-only
 * (167 mesurés) — un churn de ces snapshots y est ATTENDU, pas suspect.
 */
import { VIEWS } from '../facing';
import { describe, it, expect } from 'vitest';
import { creatures } from '../../../data';
import { creatureToCombatant } from '../../../state/spawn';
import { actorDrawInputs } from '../../backends/webgl/sceneMeshes';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';

describe('golden — rendu COMBAT (spawn→enemyRigProfile→visuels d’état) du bestiaire bipède', () => {
  for (const cr of creatures) {
    const c = creatureToCombatant(cr, `g-${cr.label}`, { x: 0, y: 0 });
    const rig = actorDrawInputs(c).rig;
    if (!rig) continue; // non-bipède → chemin plan (couvert par creature-render-golden)
    for (const view of VIEWS)
      it(`${cr.label} / ${view}`, () => {
        expect(bonesToSvg(resolveRig(rig.appearance, rig.equip, {}, rig.tenue, view, rig.overlays))).toMatchSnapshot();
      });
  }
});
