// @vitest-environment jsdom
/**
 * LA SECONDE LECTURE À L'ÉCRAN (#1279 Sf) — Test COMBINÉ, `LDB 12 l.202-208`, verbatim l.206 :
 * « Faire un seul Test, en comparant donc un unique jet de pourcentage avec la valeur de ces deux
 * Compétences est bien plus simple. »
 *
 * Ce que le socle expose est mesuré ailleurs (`noyau/cascade-quantite-second.hors-store.test.ts`) ; ICI c'est le
 * TEXTE rendu qui est jugé, parce que c'est lui qui a manqué au joueur : une seconde cible portée par
 * la donnée mais jamais peinte ne vaut rien. Trois états : PRÉ-JET (la cible s'annonce, le DR reste au
 * tiret d'attente), RÉSOLU (✓/✗ + DR de CETTE lecture), MASQUÉ (une ligne d'adversaire opaque ne
 * révèle pas une valeur par la bande).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { RollLine, PendingRollLine } from './RollLine';
import type { RollBreakdown } from '../engine/combat';
import type { PendingRoll } from './RollLine';

const mount = (node: React.ReactElement): HTMLDivElement => monterRacine(node).container;

afterEach(demonterRacines);

/** Les lignes `.rm-roll` rendues, dans l'ordre : la principale puis, s'il y en a une, la seconde. */
const lignes = (el: HTMLElement): string[] => [...el.querySelectorAll('.rm-roll')].map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim());

const SECONDE = { label: 'Initiative', base: 40, target: 60, difficulty: 'accessible' as const };

describe('Seconde lecture — ce que la fenêtre PEINT', () => {
  it('PRÉ-JET : la seconde cible s’annonce, son DR reste au tiret d’attente (le dé n’est pas tombé)', () => {
    const p: PendingRoll = { label: 'Pari', base: 35, target: 55, difficulty: 'accessible', second: SECONDE };
    const el = mount(<PendingRollLine p={p} />);
    const rendu = lignes(el);
    expect(rendu, 'DEUX lignes : la principale et sa seconde lecture').toHaveLength(2);
    expect(rendu[1]).toContain('Initiative');
    expect(rendu[1], 'la 2ᵉ lecture est nommée comme telle').toContain('2ᵉ lecture');
    expect(rendu[1], 'sa cible se lit AVANT le jet — c’est tout l’objet').toContain('60');
    expect(rendu[1], 'aucun second dé n’est jeté : c’est le même').toContain('même dé');
    expect(rendu[1], 'aucune issue tant que rien n’est tranché').not.toMatch(/[✓✗]/);
  });

  it('RÉSOLU : la seconde lecture porte SON verdict et SON DR, sur le MÊME dé que la ligne', () => {
    const d: RollBreakdown = {
      label: 'Pari', base: 35, modifier: 20, target: 55, roll: 52, success: true, sl: 0,
      difficulty: 'accessible',
      second: { ...SECONDE, sl: 1, success: true },
    };
    const montage = monterRacine(<RollLine d={d} />);
    const rendu = lignes(montage.container);
    expect(rendu).toHaveLength(2);
    expect(rendu[1]).toContain('Initiative');
    expect(rendu[1], 'verdict de CETTE lecture').toContain('✓');
    expect(rendu[1], 'DR de CETTE lecture, pas celui de la ligne').toContain('+1 DR');
    expect(rendu[1], 'un seul jet de pourcentage (l.206)').toContain('même dé');
    // L'échec de la seconde lecture se peint aussi, sous une première réussie — c'est le cas que le
    // joueur ne voyait qu'en le subissant (« son Initiative lâche »).
    act(() => { montage.rendre(<RollLine d={{ ...d, second: { ...SECONDE, sl: -2, success: false } }} />); });
    const rate = lignes(montage.container);
    expect(rate[1]).toContain('✗');
    expect(rate[1]).toContain('−2 DR');
  });

  it('MASQUÉE : une ligne d’adversaire opaque ne révèle PAS la seconde valeur', () => {
    const d: RollBreakdown = {
      label: 'Pari', base: 35, modifier: 20, target: 55, roll: 52, success: true, sl: 0,
      mask: 'roll', second: { ...SECONDE, sl: 1, success: true },
    };
    const rendu = lignes(mount(<RollLine d={d} />));
    expect(rendu, 'une seule ligne : la seconde lecture ne fuit pas sous le masque').toHaveLength(1);
    expect(rendu[0]).not.toContain('Initiative');
  });

  it('sans déclaration : la ligne reste ce qu’elle a toujours été (une seule lecture)', () => {
    const d: RollBreakdown = { label: 'Pari', base: 35, modifier: 20, target: 55, roll: 52, success: true, sl: 0 };
    expect(lignes(mount(<RollLine d={d} />))).toHaveLength(1);
    expect(lignes(mount(<PendingRollLine p={{ label: 'Pari', base: 35, target: 55 }} />))).toHaveLength(1);
  });
});
