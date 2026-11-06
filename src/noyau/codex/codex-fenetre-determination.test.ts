/**
 * Rendu JOUEUR de la FENÊTRE de Détermination (`resolveWindow`, `engine/ops.ts`) : ce qu'une dépense
 * de Point de Détermination fait à un État porté en PASSIF est une information de DÉCISION — elle se
 * LIT au Codex, en français, jamais seulement en donnée. Trois formes DITES, et la donnée livrée
 * (Fièvre (Grave), LDB 20 l.170) mesurée telle qu'elle s'affiche.
 */
import { describe, it, expect } from 'vitest';
import { humanizeOp, humanizeResolveWindow } from './humanize';
import { symptoms } from '../../data';
import { rule } from '../../engine/policy';
import type { GameOp } from '../../engine/ops';

describe('humanizeResolveWindow — une phrase joueur par forme', () => {
  it('`none` (LDB 20 l.188) : la Détermination ne lève rien tant que la cause dure', () => {
    expect(humanizeResolveWindow('none')).toBe('la Détermination ne le lève pas tant que sa cause dure');
  });

  it('Rounds : un Round se dit « jusqu’à la fin du Round », N se chiffre', () => {
    expect(humanizeResolveWindow({ scale: 'rounds', left: 1 })).toBe('la Détermination le suspend jusqu’à la fin du Round');
    expect(humanizeResolveWindow({ scale: 'rounds', left: 3 })).toContain('3 Rounds');
  });

  it('horloge à `{rule}` : les MINUTES effectives, la règle NOMMÉE (jamais « la règle X minute(s) »)', () => {
    const dit = humanizeResolveWindow({ scale: 'clock', minutes: { rule: 'maladie-conscience-determination-minutes' } })!;
    expect(dit).toContain(`${rule('maladie-conscience-determination-minutes')} minutes`);
    expect(dit).toContain('règle « Maladie : fenêtre de conscience par Détermination (minutes) »');
    expect(dit, 'un id brut a fui à l’écran').not.toContain('maladie-conscience-determination-minutes');
  });

  it('aucune fenêtre authorée : rien à dire (la phrase ne se charge pas du défaut)', () => {
    expect(humanizeResolveWindow(undefined)).toBeUndefined();
    expect(humanizeOp({ op: 'condition', id: 'sonne' }), 'le défaut pollue toutes les chips d’État').toBe("gagne l'État *Sonné*");
  });
});

describe('humanizeOp — la chip d’État PORTE sa fenêtre', () => {
  it('la phrase de l’op enchaîne l’État puis ce que la Détermination y fait', () => {
    const dit = humanizeOp({ op: 'condition', id: 'extenue', resolveWindow: 'none' });
    expect(dit).toContain("gagne l'État *Exténué*");
    expect(dit).toContain('la Détermination ne le lève pas tant que sa cause dure');
  });

  it('la DONNÉE livrée se lit : Fièvre (Grave) → Inconscient, fenêtre en minutes (LDB 20 l.170)', () => {
    const fievre = symptoms.find((s) => s.id === 'fievre')!;
    const op = (fievre.passiveBySeverity?.grave ?? []).find((o) => o.op === 'condition') as GameOp;
    expect(op, 'la Fièvre (Grave) ne porte plus l’Inconscient en passif').toBeTruthy();
    const dit = humanizeOp(op);
    expect(dit).toContain("gagne l'État *Inconscient*");
    expect(dit).toContain(`${rule('maladie-conscience-determination-minutes')} minutes`);
  });
});
