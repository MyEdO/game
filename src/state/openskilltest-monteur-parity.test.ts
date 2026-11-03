import { describe, it, expect } from 'vitest';
import { RULE_REF } from '../engine/ruleRefs';
import { psychologies } from '../data';
import { codexLookupById } from '../ui/compendium/registry';

/**
 * La fiche que NOMME une ligne sociale doit S'OUVRIR. Un `{category, id}` qui ne résout pas rend une
 * chip morte à l'écran — et le défaut ne se voit ni au type ni à l'arithmétique. La mesure porte sur
 * la porte RÉELLE du Codex (`codexLookupById`, le registre vivant), pour CHAQUE psychologie qui
 * déclare un `containedSocialMod` : ce sont exactement les entrées que `socialPsychLines` peut citer. La parité
 * de la cible se joue au banc du noyau (`src/noyau/openskilltest-monteur-parity.hors-store.test.ts`).
 */
describe('les fiches citées par les lignes sociales RÉSOLVENT au Codex (#1153 L2’ R3)', () => {
  it('chaque psychologie à `containedSocialMod` a sa fiche, dans l’espace utilisé par le producteur', () => {
    const concernees = psychologies.filter((p) => p.containedSocialMod != null);
    expect(concernees.length).toBeGreaterThan(0); // sinon la garde serait vide et verte
    const mortes = concernees
      .map((p) => ({ id: p.id, ref: { category: 'psychologies', id: p.id } }))
      .filter((x) => !codexLookupById(x.ref.category, x.ref.id));
    expect(mortes.map((x) => x.id), 'chip morte : la fiche ne s’ouvre pas').toEqual([]);
  });

  it('la fiche de la règle de Statut (LDB 08) s’ouvre aussi — même porte', () => {
    expect(codexLookupById(RULE_REF.statut.category, RULE_REF.statut.id)).toBeTruthy();
    expect(codexLookupById(RULE_REF['meteo-maritime'].category, RULE_REF['meteo-maritime'].id)).toBeTruthy();
    expect(codexLookupById(RULE_REF['exposition-hydrique'].category, RULE_REF['exposition-hydrique'].id)).toBeTruthy();
  });
});
