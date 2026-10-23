import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppraiseModalView } from './AppraiseModal';
import { useGame } from '../state/store';
import type { PendingAppraise } from '../noyau/pendings';
import type { Combatant, SkillInstance } from '../engine/types';
import { addCondition, COND } from '../engine/conditions';
import { testValue, skillBaseValue } from '../engine/skills';

const base: PendingAppraise = {
  actorId: 'h',
  actorName: 'H',
  itemUid: 'x',
  itemName: 'Épée mystérieuse',
  truePriceBrass: 240,
  availability: 'Rare',
  skillValue: 45,
  difficulty: 'intermediaire',
  target: 45,
  roll: null,
  success: false,
  sl: 0,
};
const noop = () => {};

/** Évaluateur minimal : Int 40 + 15 Augmentations d'Évaluation (la Compétence que roule le flux). */
function hero(): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero', speciesId: 'humains-reiklander',
    characteristics: { intelligence: 40, sociabilite: 40, agilite: 40 } as Combatant['characteristics'],
    skills: [{ id: 'evaluation', advances: 15 }] as SkillInstance[],
    talents: [], items: [], conditions: [], advantage: 0, weapons: [],
  } as unknown as Combatant;
}

describe('AppraiseModal (#2e)', () => {
  it('avant le jet : bouton Lancer + nom de l’objet', () => {
    const html = renderToStaticMarkup(
      <AppraiseModalView pa={base} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).toMatch(/Lancer/);
    expect(html).toContain('Épée mystérieuse');
  });

  it('#1064 — Soutien (LDB 12) : chip NOMMÉE et base rebasée, avant comme après le jet', () => {
    const pa: PendingAppraise = { ...base, skillValue: 65, target: 65, support: { count: 2, bonus: 20, ids: ['h2', 'h3'] } };
    const pre = renderToStaticMarkup(
      <AppraiseModalView pa={pa} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(pre).toContain('Soutien');
    expect(pre).toContain('+20 Soutien');
    expect(pre).toContain('45'); // base RÉELLE du meneur (65 − 20), plus une valeur qui tombe du ciel
    const post = renderToStaticMarkup(
      <AppraiseModalView pa={{ ...pa, roll: 20, success: true, sl: 2 }} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(post).toContain('+20 Soutien'); // le détail SURVIT au jet (pile le moment où on lit son résultat)
  });

  it('#1178 — l’État PÈSE : chip NOMMÉE « Empoisonné », base sur le Niveau de Compétence nu, zéro chip « autres »', () => {
    const evaluateur = hero();
    addCondition(evaluateur, COND.empoisonne);
    // La valeur JETÉE est celle que le flux roule (`partyAssisted` → `testValue`), jamais un nombre forgé.
    const skillValue = testValue(evaluateur, 'evaluation', 'intelligence');
    const pa: PendingAppraise = { ...base, skillValue, target: skillValue };
    const html = renderToStaticMarkup(
      <AppraiseModalView pa={pa} actor={evaluateur} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(skillValue).toBeLessThan(skillBaseValue(evaluateur, 'evaluation', undefined, 'intelligence')); // l'État pèse VRAIMENT
    expect(html).toContain('−10 Empoisonné'); // l'octroyeur est NOMMÉ
    expect(html).not.toContain('autres'); // aucune chip anonyme de reliquat (`RollLine`)
    const lu = html.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, ' '); // ce que l'œil lit, sans le markup
    expect(lu).toMatch(new RegExp(`\\b${skillBaseValue(evaluateur, 'evaluation', undefined, 'intelligence')}\\b`)); // base = Niveau nu
    expect(lu).toMatch(new RegExp(`\\b${skillValue}\\b`)); // la CIBLE ne bouge pas
  });

  it('#1178 — contrôle NÉGATIF : évaluateur sans État, aucune chip nouvelle', () => {
    const sain = hero();
    const skillValue = testValue(sain, 'evaluation', 'intelligence');
    const html = renderToStaticMarkup(
      <AppraiseModalView pa={{ ...base, skillValue, target: skillValue }} actor={sain} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    expect(html).not.toContain('rm-mod'); // la ligne de jet ne porte AUCUNE chip de modificateur
  });

  it('après une réussite : « révélé » + bouton Appliquer', () => {
    const pa: PendingAppraise = { ...base, roll: 20, success: true, sl: 2 };
    useGame.setState({ pendingAppraise: pa }); // la coquille juge la clôture sur l'Évaluation en attente
    const html = renderToStaticMarkup(
      <AppraiseModalView pa={pa} fortune={0} onRoll={noop} onReroll={noop} onBonusSL={noop} onConfirm={noop} onCancel={noop} />,
    );
    useGame.setState({ pendingAppraise: null });
    expect(html).toContain('révélé');
    expect(html).toMatch(/Appliquer/);
  });
});
