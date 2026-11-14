import { idDeFixture } from '../data/idDeFixture.testkit';
import { describe, it, expect } from 'vitest';
import { OPTIONAL_RULES, type OptionalRule } from '../engine/policy';
import { houseRuleTabs, MISC_TAB_KEY, OWN_TAB_MIN } from './houseRuleTabs';

const fake = (id: string, group: string): OptionalRule => ({
  id: idDeFixture('regleOptionnelle', id), type: 'reglesOptionnelles', group, label: id, ref: 'LDB 12 l.1', kind: 'flag', default: false,
});

describe('houseRuleTabs — découpe dérivée du registre des règles optionnelles (#839)', () => {
  it('AUCUNE règle perdue : la somme des règles des onglets vaut OPTIONAL_RULES.length', () => {
    const tabs = houseRuleTabs();
    const total = tabs.reduce((n, t) => n + t.rules.length, 0);
    expect(total).toBe(OPTIONAL_RULES.length);
    const ids = tabs.flatMap((t) => t.rules.map((r) => r.id));
    expect(new Set(ids).size).toBe(OPTIONAL_RULES.length); // partition : aucun doublon non plus
    expect(ids.slice().sort()).toEqual(OPTIONAL_RULES.map((r) => r.id).sort());
  });

  it('un groupe d’un registre INÉDIT reste atteignable (rien n’est codé en dur)', () => {
    const rules = [...OPTIONAL_RULES, fake('rule-inedite', 'Groupe Inédit')];
    const tabs = houseRuleTabs(rules);
    expect(tabs.flatMap((t) => t.rules.map((r) => r.id))).toContain('rule-inedite');
    expect(tabs.reduce((n, t) => n + t.rules.length, 0)).toBe(rules.length);
  });

  it('un groupe atteint son PROPRE onglet à partir du seuil, en-dessous il va au fourre-tout', () => {
    const gros = Array.from({ length: OWN_TAB_MIN }, (_, i) => fake(`gros-${i}`, 'Gros'));
    const petit = [fake('petit-0', 'Petit')];
    const tabs = houseRuleTabs([...gros, ...petit]);
    expect(tabs.map((t) => t.key)).toEqual([`g:Gros`, MISC_TAB_KEY]);
    expect(tabs[1].rules.map((r) => r.id)).toEqual(['petit-0']);
    expect(tabs[1].groups).toEqual(['Petit']); // l'intertitre de groupe survit dans le fourre-tout
  });

  it('sans résiduel, pas d’onglet fourre-tout vide', () => {
    const tabs = houseRuleTabs(Array.from({ length: OWN_TAB_MIN }, (_, i) => fake(`g-${i}`, 'Seul')));
    expect(tabs.map((t) => t.key)).toEqual(['g:Seul']);
  });
});

describe('Registre des règles optionnelles — l’option VDM s’auto-rend dans le panneau (#733)', () => {
  const RULE = 'magie-vdm-incantation';

  it('le panneau la RENDRA sans une ligne d’UI : elle est dans la découpe dérivée du registre', () => {
    const tabs = houseRuleTabs();
    expect(tabs.flatMap((t) => t.rules.map((r) => r.id))).toContain(RULE);
    expect(tabs.reduce((n, t) => n + t.rules.length, 0)).toBe(OPTIONAL_RULES.length); // partition TOTALE
  });

  it('le groupe Magie atteint le seuil et obtient son PROPRE onglet', () => {
    const magie = OPTIONAL_RULES.filter((r) => r.group === 'Magie');
    expect(magie.length).toBeGreaterThanOrEqual(OWN_TAB_MIN);
    const tab = houseRuleTabs().find((t) => t.key === 'g:Magie');
    expect(tab).toBeTruthy();
    expect(tab!.groups).toEqual(['Magie']);
    expect(tab!.rules.map((r) => r.id)).toContain(RULE);
  });
});
