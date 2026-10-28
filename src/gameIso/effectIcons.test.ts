import { describe, it, expect } from 'vitest';
import { conditionMeta, summarizeEffects, topImportantCondition, combatantFlags } from './effectIcons';
import type { Combatant, ConditionInstance, ActiveEffect, CharKey } from '../engine/types';
import { etats, psychologies, refLabel } from '../data';
import { setDataset } from '../data/overrides';
import { deElide, t } from '../i18n';
import { DIFFICULTY_LABELS } from '../engine/types';
import { poserFicheDeTest, restaurerFiche, testDeFiche } from '../state/ficheDeTest.testkit';

const cond = (name: string, value = 1): ConditionInstance => ({ id: name, value });
const buff = (label: string, bonus: number, roundsLeft: number, char?: CharKey): ActiveEffect => ({ label, bonus, duration: { scale: "rounds", left: roundsLeft }, char });

describe('conditionMeta', () => {
  it('donne une icône et marque les états incapacitants comme importants', () => {
    expect(conditionMeta('sonne').icon).toBeTruthy();
    expect(conditionMeta('sonne').important).toBe(true);
    expect(conditionMeta('inconscient').important).toBe(true);
  });
  it('marque Exténué comme non-important (état mineur)', () => {
    expect(conditionMeta('extenue').important).toBe(false);
  });
  it('un État CONNU sans icône ni sévérité retombe sur le repli (journal/info, sévérité 10)', () => {
    const livres = structuredClone(etats);
    const { icon: _icon, severity: _severity, ...nu } = livres[0];
    setDataset('etats', [...livres, { ...nu, id: 'etat-de-fixture' }]);
    try {
      expect(conditionMeta('etat-de-fixture')).toEqual({ icon: 'journal/info', severity: 10, important: false });
    } finally {
      setDataset('etats', livres);
    }
  });
  it('un id hors du registre LÈVE, un libellé n’est pas un id (#1463 LD.1)', () => {
    expect(() => conditionMeta('id-hors-registre')).toThrow(t('etats.inconnu', { id: 'id-hors-registre' }));
    expect(() => conditionMeta(etats[0].label)).toThrow(t('etats.inconnu', { id: etats[0].label }));
  });
});

describe('combatantFlags — Peur (LDB 21 l.27)', () => {
  const C = (psychState: unknown) => ({ conditions: [], psychState }) as unknown as Combatant;
  it('sous la Peur (non surmontée) → drapeau fear avec l’Indice max, et chip flag/fear visible', () => {
    const f = combatantFlags(C([{ type: 'peur', sourceId: 'x', indice: 2, calmeDR: 0 }, { type: 'peur', sourceId: 'y', indice: 3, calmeDR: 1 }]));
    expect(f.fear).toBe(3);
    const r = summarizeEffects([], [], 5, f);
    expect(r.visible.some((v) => v.icon === 'flag/fear')).toBe(true);
  });
  it('Peur surmontée ou absente → pas de drapeau', () => {
    expect(combatantFlags(C([{ type: 'peur', sourceId: 'x', indice: 2, calmeDR: 2, surmontee: true }])).fear).toBeUndefined();
    expect(combatantFlags(C([])).fear).toBeUndefined();
  });
  it('la puce nomme la compétence du Test étendu lue dans `psychology.json`, reposée sur une autre compétence', () => {
    const livre = structuredClone([...psychologies]);
    try {
      setDataset('psychologies', livre.map((p) => (p.id === 'peur' ? { ...p, test: { ...p.test, skill: { id: 'intimidation' } } } : p)));
      const puce = summarizeEffects([], [], Infinity, { fear: 2 }).visible.find((c) => c.key === 'f-fear');
      expect(puce?.label).toContain(`Test étendu ${deElide(refLabel('skills', { id: 'intimidation' }))} en fin de Round`);
    } finally {
      setDataset('psychologies', livre);
    }
  });
  it('la puce annonce le Test `se-rapprocher` de la fiche `calme-d-approche` : sa compétence ET sa Difficulté', () => {
    poserFicheDeTest();
    try {
      const posee = testDeFiche('calme-d-approche', 'se-rapprocher');
      const puce = summarizeEffects([], [], Infinity, { fear: 2 }).visible.find((c) => c.key === 'f-fear');
      expect(puce?.label).toContain(`approcher exige un Test ${deElide(refLabel('skills', posee.skill))} ${DIFFICULTY_LABELS[posee.difficulty]}`);
    } finally {
      restaurerFiche();
    }
  });
});

describe('summarizeEffects', () => {
  it('rend tout quand on est sous la limite', () => {
    const r = summarizeEffects([cond('sonne'), cond('aveugle')], [], 5);
    expect(r.visible).toHaveLength(2);
    expect(r.moreCount).toBe(0);
  });
  it('tronque et compte le surplus quand ça déborde', () => {
    const r = summarizeEffects([cond('sonne'), cond('aveugle'), cond('empoisonne'), cond('hemorragique')], [], 2);
    expect(r.visible).toHaveLength(2);
    expect(r.moreCount).toBe(2);
  });
  it('trie les malus par sévérité décroissante (le plus grave en premier)', () => {
    const r = summarizeEffects([cond('extenue'), cond('inconscient')], [], 5);
    expect(r.visible[0].label).toBe('Inconscient');
  });
  it('garde un empilement (value>1) comme compteur', () => {
    const r = summarizeEffects([cond('hemorragique', 3)], [], 5);
    expect(r.visible[0].count).toBe(3);
    const single = summarizeEffects([cond('sonne', 1)], [], 5);
    expect(single.visible[0].count).toBeUndefined();
  });
  it('place les buffs après les malus et expose leur durée + bonus', () => {
    const r = summarizeEffects([cond('sonne')], [buff('Bénédiction de Bataille', 10, 2, 'capacite-de-combat')], 5);
    expect(r.visible.map((c) => c.kind)).toEqual(['malus', 'buff']);
    expect(r.visible[1].rounds).toBe(2);
    expect(r.visible[1].bonus).toBe(10);
  });
  it('priorise les malus quand le débordement coupe', () => {
    const r = summarizeEffects([cond('inconscient'), cond('sonne')], [buff('X', 10, 1)], 2);
    expect(r.visible.every((c) => c.kind === 'malus')).toBe(true);
    expect(r.moreCount).toBe(1);
  });
  it('tolère des entrées vides', () => {
    expect(summarizeEffects([], [], 3)).toEqual({ visible: [], moreCount: 0 });
  });
});

describe('topImportantCondition', () => {
  it('retourne le plus grave état important', () => {
    expect(topImportantCondition([cond('aveugle'), cond('inconscient')])?.label).toBe('Inconscient');
  });
  it('null si aucun état important', () => {
    expect(topImportantCondition([cond('extenue')])).toBeNull();
  });
});

describe('summarizeEffects — états-drapeaux (Frénésie)', () => {
  it('ajoute une pastille Frénésie (kind state) quand le drapeau est posé', () => {
    const r = summarizeEffects([], [], 5, { frenzied: true });
    const fr = r.visible.find((c) => c.label === 'Frénésie');
    expect(fr).toBeTruthy();
    expect(fr?.kind).toBe('state');
    expect(fr?.icon).toBeTruthy();
  });
  it('sans drapeau, aucune pastille Frénésie', () => {
    expect(summarizeEffects([cond('sonne')], []).visible.some((c) => c.label === 'Frénésie')).toBe(false);
  });
  it('ordonne malus → état-drapeau → buff', () => {
    const r = summarizeEffects([cond('sonne')], [buff('Bénédiction', 10, 2)], 5, { frenzied: true });
    expect(r.visible.map((c) => c.kind)).toEqual(['malus', 'state', 'buff']);
  });
  it('Visée / Sur la défensive / Focalisation (avec DR en compteur)', () => {
    const r = summarizeEffects([], [], 9, { aiming: true, defensiveStance: true, focusDr: 2 });
    const labels = r.visible.map((c) => c.label);
    expect(labels.some((l) => l.startsWith('En joue'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Sur la défensive'))).toBe(true);
    const focus = r.visible.find((c) => c.label.startsWith('Focalisation'));
    expect(focus?.count).toBe(2);
  });
});
