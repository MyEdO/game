/**
 * Règles d'incantation révisées des Vents de Magie (`VDM 02 l.5-7`), option `magic-vdm-incantation` :
 * deux deltas câblés au moteur — Dégâts d'un Projectile magique (`VDM 02 l.68`, folio 20) et
 * « Puissance totale » d'une Incantation Critique (`VDM 02 l.55`, folio 20). Option OFF = LDB.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { OPTIONAL_RULES, setRule, resetRule, ruleDef } from './policy';
import { houseRuleTabs, OWN_TAB_MIN } from '../ui/houseRuleTabs';
import { evaluateMissile, applyFullPower, overcastSL, castAfterCrit, defaultCritChoice, type CastResult } from './magic';
import { hasInstinctiveDiction } from './combatFeatures/dispatch';
import { isDispellableCast } from '../noyau/combatFlow';
import type { PendingCast } from '../noyau/pendings';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const RULE = 'magic-vdm-incantation';

function mk(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'c', label: 'Sujet', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 42, sociabilite: 30 },
    wounds: blessuresDeBase(14), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], spells: [], xp: 0,
    ...p,
  }) as Combatant;
}

/** Projectile SANS attribut de Domaine : seuls Dégâts du Sort, DR et BFM entrent dans le calcul. */
const projectile = { label: 'Trait d’essai', type: 'Magie des Arcanes', domainId: null, missile: true, damage: 4, cn: 2, range: null, target: 1, duration: null, desc: 'Il s’agit d’un Projectile magique avec Dégâts +4.' };

/** Jet critique (double 44 réussi), DR 3. Jet inversé 44 → localisation stable. */
const crit = (cast: boolean, sl: number): CastResult => ({ cast, roll: 44, target: 60, sl, isCritical: true, isFumble: false, log: 'jet' });

afterEach(() => resetRule(RULE));

describe('Registre des règles optionnelles — l’option VDM s’auto-rend dans le panneau (#733)', () => {
  it('entrée `magic-vdm-incantation` : groupe Magie, drapeau, DÉSACTIVÉE par défaut, réf VDM', () => {
    const def = ruleDef(RULE);
    expect(def).toBeTruthy();
    expect(def!.group).toBe('Magie');
    expect(def!.kind).toBe('flag');
    expect(def!.default).toBe(false);
    expect(def!.ref).toBe('VDM 02 l.5-7');
    expect(def!.label).toBeTruthy();
    expect(def!.hint).toBeTruthy();
  });

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

describe('Projectile magique — Dégâts (`VDM 02 l.68`, folio 20)', () => {
  const caster = mk({ id: 'w', label: 'Mage' }); // BFM 4
  const target = mk({ id: 't', kind: 'enemy' }); // BE 3, aucune PA

  it('option OFF (LDB 46 l.101) : Dégâts du Sort + DR + BFM', () => {
    const r = evaluateMissile(caster, target, projectile as never, crit(true, 3));
    expect(r.damage).toBe(4 + 3 + 4);
    expect(r.woundsLost).toBe(11 - 3);
  });

  it('option ON : Dégâts du Sort + BFM, le DR n’est PLUS ajouté', () => {
    setRule(RULE, true);
    const r = evaluateMissile(caster, target, projectile as never, crit(true, 3));
    expect(r.damage).toBe(4 + 4);
    expect(r.woundsLost).toBe(8 - 3);
  });

  it('CÂBLAGE : le même jet ne donne pas les mêmes Dégâts selon l’option', () => {
    const ldb = evaluateMissile(caster, target, projectile as never, crit(true, 3)).damage;
    setRule(RULE, true);
    const vdm = evaluateMissile(caster, target, projectile as never, crit(true, 3)).damage;
    expect(vdm).not.toBe(ldb);
    expect(ldb! - vdm!).toBe(3); // exactement le DR retiré
  });
});

describe('Incantation Critique — « Puissance totale » (`VDM 02 l.55`, folio 20)', () => {
  it('option OFF (LDB 46 l.31) : le Sort est lancé, le DR est INCHANGÉ', () => {
    const res = applyFullPower(crit(false, 1));
    expect(res.cast).toBe(true);
    expect(res.sl).toBe(1);
  });

  it('option OFF, Sort déjà lancé : le résultat est rendu À L’IDENTIQUE (aucun repêchage)', () => {
    const base = crit(true, 5);
    expect(applyFullPower(base)).toBe(base);
  });

  it('option ON : le chiffre des DIZAINES du lancer d’Incantation s’ajoute au DR', () => {
    setRule(RULE, true);
    expect(applyFullPower(crit(false, 1))).toMatchObject({ cast: true, sl: 1 + 4 }); // jet 44 → 4
    expect(applyFullPower({ ...crit(true, 2), roll: 99 })).toMatchObject({ cast: true, sl: 2 + 9 });
    expect(applyFullPower({ ...crit(true, 2), roll: 11 })).toMatchObject({ cast: true, sl: 2 + 1 });
  });

  it('CÂBLAGE : le DR de Surincantation grandit sous l’option, pas sous le LDB', () => {
    const res = crit(true, 3);
    expect(overcastSL(res, 'puissance', false)).toBe(3);
    setRule(RULE, true);
    expect(overcastSL(res, 'puissance', false)).toBe(3 + 4);
  });

  it('le DR ne bouge que pour l’effet « Puissance totale » — les deux autres n’y touchent pas', () => {
    setRule(RULE, true);
    const res = crit(true, 3);
    expect(overcastSL(res, 'critique', true)).toBe(3);
    expect(overcastSL(res, 'ineluctable', false)).toBe(3);
    expect(overcastSL({ ...res, isCritical: false }, 'puissance', false)).toBe(3); // pas de Critique
  });

  it('sans choix explicite, le DÉFAUT décide (repêchage, sinon Blessure Critique / Force inéluctable)', () => {
    expect(defaultCritChoice({ cast: false }, false)).toBe('puissance');
    expect(defaultCritChoice({ cast: true }, true)).toBe('critique');
    expect(defaultCritChoice({ cast: true }, false)).toBe('ineluctable');
    setRule(RULE, true);
    expect(overcastSL(crit(false, 0), undefined, false)).toBe(0 + 4); // défaut = Puissance totale
  });

  it('« Puissance totale » lance le Sort dans les deux régimes (prédicat unique)', () => {
    expect(castAfterCrit(crit(false, 0), 'puissance', false)).toBe(true);
    expect(castAfterCrit(crit(false, 0), 'ineluctable', false)).toBe(false);
    setRule(RULE, true);
    expect(castAfterCrit(crit(false, 0), 'puissance', false)).toBe(true);
  });

  it('le contrecoup d’Incantation Critique reste lu sur le Talent Diction instinctive (`VDM 02 l.52`)', () => {
    setRule(RULE, true);
    expect(hasInstinctiveDiction(mk({ talents: [{ talentId: 'diction-instinctive', times: 1 }] as Combatant['talents'] }))).toBe(true);
    expect(hasInstinctiveDiction(mk())).toBe(false);
  });
});

describe('« Force inéluctable » et la Dissipation — la CONDITION diffère par régime', () => {
  /** Incantation FIGÉE au choix `ineluctable`, DR suffisant ou non. */
  const pc = (cast: boolean) => ({
    casterId: 'w', targetId: 't', spellId: 'x', missile: true, focused: false,
    result: crit(cast, 3), critChoice: 'ineluctable' as const,
  }) as unknown as PendingCast;

  it('option OFF (`LDB 46 l.32`) : « si vous obtenez suffisamment de DR » — sans le DR, le Sort reste dissipable', () => {
    expect(isDispellableCast(pc(true), projectile as never), 'DR suffisant → indissipable').toBe(false);
    expect(isDispellableCast(pc(false), projectile as never), 'DR insuffisant → dissipable').toBe(true);
  });

  it('option ON (`VDM 02 l.56`) : le choix suffit, sans condition de DR', () => {
    setRule(RULE, true);
    expect(isDispellableCast(pc(true), projectile as never)).toBe(false);
    expect(isDispellableCast(pc(false), projectile as never), 'aucune condition de DR sous VDM').toBe(false);
    // « Puissance totale » (`VDM 02 l.55`) reste dissipable dans le régime révisé.
    const puissance = { ...pc(false), critChoice: 'puissance' } as unknown as PendingCast;
    expect(isDispellableCast(puissance, projectile as never)).toBe(true);
  });
});
