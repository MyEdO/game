import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect, afterEach } from 'vitest';
import type { Combatant } from './types';
import {
  HEAL_SKILL, isHealable, availableHealModes, healableTargets,
  healWoundsDelta, stopBleedOutcome, applyHealWounds, applyStopBleed,
  lodgedAmmoCount, resolveExtractLodgedAmmo, healDifficulty, soinMagiqueOperant,
} from './healing';
import { applyOps } from './ops';
import { setRule, resetRule } from './policy';
import { possesses } from './skills';
import { desDuTest } from './dice.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

function hero(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'h', label: 'Soigneur', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 38, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ id: 'guerison', advances: 10 }], talents: [],
    pos: { x: 1, y: 1 }, ...p,
  }) as Combatant;
}

describe('engine/healing — gate compétence & cibles', () => {
  it('Guérison est Avancée : sans Augmentation, le soigneur ne la possède pas (LDB 09 l.30)', () => {
    expect(possesses(hero(), { id: HEAL_SKILL })).toBe(true);
    expect(possesses(hero({ skills: [{ id: HEAL_SKILL, characteristic: 'intelligence', advances: 0 }] }), { id: HEAL_SKILL })).toBe(false);
    expect(possesses(hero({ skills: [] }), { id: HEAL_SKILL })).toBe(false);
  });

  it('isHealable : blessé OU hémorragique ; pas mort/éjecté', () => {
    expect(isHealable(hero({ wounds: blessuresDeBase(12), conditions: [] }))).toBe(false);
    expect(isHealable(hero({ wounds: blessuresDeBase(12, 5) }))).toBe(true);
    expect(isHealable(hero({ wounds: blessuresDeBase(12), conditions: [{ id: 'hemorragique', value: 1 }] }))).toBe(true);
    expect(isHealable(hero({ wounds: blessuresDeBase(12, 5), dead: true }))).toBe(false);
  });

  describe('Structure (AA 10 l.134) : Guérison sans effet ; soin magique selon la règle maison structure-soin-magique', () => {
    afterEach(() => resetRule('structure-soin-magique'));
    const mur = () => hero({ id: 'mur', kind: 'pnj', bodyShape: 'structure', wounds: blessuresDeBase(40, 5), skills: [] } as Partial<Combatant>);
    it('la Guérison ne cible jamais une Structure blessée ; un Personnage blessé, si (contrôle)', () => {
      expect(isHealable(mur())).toBe(false);
      expect(isHealable(hero({ wounds: blessuresDeBase(12, 5) }))).toBe(true);
    });
    it('défaut (désactivée) : un soin magique ne rend aucune Blessure à une Structure, mais à un Personnage', () => {
      const s = mur();
      expect(soinMagiqueOperant(s)).toBe(false);
      applyOps(s, [{ op: 'heal', amount: 3 }], { idNeuf: idsDeTest, rng: desDuTest });
      expect(s.wounds.current).toBe(5);
      const p = hero({ wounds: blessuresDeBase(12, 5) });
      applyOps(p, [{ op: 'heal', amount: 3 }], { idNeuf: idsDeTest, rng: desDuTest });
      expect(p.wounds.current).toBe(8);
    });
    it('activée : le soin magique rend ses Blessures à la Structure ; la Guérison reste sans effet', () => {
      setRule('structure-soin-magique', true);
      const s = mur();
      expect(soinMagiqueOperant(s)).toBe(true);
      applyOps(s, [{ op: 'heal', amount: 3 }], { idNeuf: idsDeTest, rng: desDuTest });
      expect(s.wounds.current).toBe(8);
      expect(isHealable(s)).toBe(false);
    });
  });

  it('availableHealModes : « wounds » bloqué si déjà soigné cette rencontre ; « bleed » indépendant', () => {
    const t = hero({ wounds: blessuresDeBase(12, 5), conditions: [{ id: 'hemorragique', value: 2 }] });
    expect(availableHealModes(t)).toEqual(['blessures', 'hemorragie']);
    expect(availableHealModes({ ...t, soinRencontreUtilise: true })).toEqual(['hemorragie']);
  });

  it('healableTargets : les soignables du pool, inconscient inclus', () => {
    const healer = hero({ wounds: blessuresDeBase(12) }); // plein PB → pas auto-soignable
    const blesse = hero({ id: 'a', wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }] });
    const ids = healableTargets([healer, blesse]).map((c) => c.id);
    expect(ids).toEqual(['a']);
  });

  it('healableTargets : un soigneur blessé peut se soigner lui-même (auto-soin)', () => {
    const healer = hero({ wounds: blessuresDeBase(12, 8) });
    expect(healableTargets([healer]).map((c) => c.id)).toContain('h');
  });
});

describe('engine/healing — calculs DR (purs)', () => {
  it('healWoundsDelta : succès = BI+DR (plancher 0) ; échec BI+DR<0 = perte ; échec BI+DR≥0 = 0', () => {
    expect(healWoundsDelta(3, 2, true)).toBe(5);
    expect(healWoundsDelta(3, -5, true)).toBe(0);   // succès ne blesse jamais
    expect(healWoundsDelta(1, -4, false)).toBe(-3); // échec, BI+DR<0 → -3
    expect(healWoundsDelta(3, -1, false)).toBe(0);  // échec mais BI+DR≥0 → rien
  });

  it('stopBleedOutcome : retire 1+DR borné aux pions ; Exténué quand tout retiré ; échec = rien', () => {
    const G = { test: 'guerison', bandages: false } as const;
    expect(stopBleedOutcome(2, 5, true, G)).toEqual({ removed: 3, gainExtenue: false });
    expect(stopBleedOutcome(2, 2, true, G)).toEqual({ removed: 2, gainExtenue: true });
    expect(stopBleedOutcome(0, 3, true, G)).toEqual({ removed: 1, gainExtenue: false });
    expect(stopBleedOutcome(5, 3, false, G)).toEqual({ removed: 0, gainExtenue: false });
  });

  it('stopBleedOutcome sous Bandages : Guérison 1 + DR + 1 (LDB 09 l.261, LDB 74 l.41) ; Dextérité 1', () => {
    expect(stopBleedOutcome(1, 4, true, { test: 'guerison', bandages: true }).removed).toBe(3); // 4 − 3 = 1 restant
    expect(stopBleedOutcome(1, 4, true, { test: 'guerison', bandages: false }).removed).toBe(2); // 4 − 2 = 2 restants
    expect(stopBleedOutcome(3, 4, true, { test: 'dexterite', bandages: true }).removed).toBe(1); // 4 − 1 = 3 restants
    expect(stopBleedOutcome(3, 4, false, { test: 'dexterite', bandages: true }).removed).toBe(0);
  });
});

describe('engine/healing — mutateurs', () => {
  it('applyHealWounds : +PB plafonné max, lève l’Inconscient quand on repasse >0 (LDB 18 l.15)', () => {
    const t = hero({ id: 't', wounds: blessuresDeBase(12, 0), conditions: [{ id: 'inconscient', value: 1 }, { id: 'a-terre', value: 1 }], roundsAtZero: 3 });
    applyHealWounds(t, 5);
    expect(t.wounds.current).toBe(5);
    expect(t.conditions.find((c) => c.id === 'inconscient')).toBeUndefined(); // reprend connaissance
    expect(t.conditions.find((c) => c.id === 'a-terre')).toBeTruthy();        // mais reste à terre
    expect(t.roundsAtZero).toBe(0);
  });

  it('applyHealWounds : delta négatif inflige des Blessures (loseWounds : −Avantage + À Terre à 0)', () => {
    const t = hero({ id: 't', wounds: blessuresDeBase(12, 2), advantage: 3 });
    applyHealWounds(t, -4);
    expect(t.wounds.current).toBe(0);
    expect(t.advantage).toBe(0);
    expect(t.conditions.find((c) => c.id === 'a-terre')).toBeTruthy();
    expect(t.soinRencontreUtilise).toBeUndefined(); // pas de bénéfice → flag non posé
  });

  it('applyStopBleed : retire les pions ; Exténué quand le dernier part (LDB 16 l.109)', () => {
    const t = hero({ id: 't', conditions: [{ id: 'hemorragique', value: 2 }] });
    applyStopBleed(t, 1, { test: 'guerison', bandages: false } as const); // 1+1 = 2 pions retirés
    expect(t.conditions.find((c) => c.id === 'hemorragique')).toBeUndefined();
    expect(t.conditions.find((c) => c.id === 'extenue')).toBeTruthy();
  });
});

describe('engine/healing — healDifficulty (mode → Difficulté, variante combat-aa-blessures, AA 07 l.9)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('variante LDB (défaut) : wounds/bleed/ammo tous Intermédiaire (+0)', () => {
    resetRule('combat-aa-blessures');
    expect(healDifficulty('blessures')).toBe('intermediaire');
    expect(healDifficulty('hemorragie')).toBe('intermediaire');
    expect(healDifficulty('munition')).toBe('intermediaire');
  });

  it('variante AA : bleed devient Accessible (+20), wounds/ammo restent Intermédiaire (+0)', () => {
    setRule('combat-aa-blessures', 'aa');
    expect(healDifficulty('blessures')).toBe('intermediaire');
    expect(healDifficulty('hemorragie')).toBe('accessible');
    expect(healDifficulty('munition')).toBe('intermediaire');
  });
});

describe('engine/healing — Empaleuse : munition logée bloque la Guérison (LDB 62 l.250, #473)', () => {
  it('lodgedAmmoCount lit le marqueur `munition-logee` (empilable)', () => {
    expect(lodgedAmmoCount(hero({ conditions: [] }))).toBe(0);
    expect(lodgedAmmoCount(hero({ conditions: [{ id: 'munition-logee', value: 2 }] }))).toBe(2);
  });

  it('applyHealWounds : 1 munition logée bloque 1 Blessure de soin (plafond max−1)', () => {
    const t = hero({ id: 't', wounds: blessuresDeBase(12, 8), conditions: [{ id: 'munition-logee', value: 1 }] });
    applyHealWounds(t, 5); // sans munition : 8+5 → plafonné à 12 ; avec 1 logée : plafonné à 11
    expect(t.wounds.current).toBe(11);
  });

  it('applyHealWounds : déjà au plafond (max − munitions logées) → soin bloqué net, message dédié', () => {
    const t = hero({ id: 't', wounds: blessuresDeBase(12, 11), conditions: [{ id: 'munition-logee', value: 1 }] });
    const log = applyHealWounds(t, 5);
    expect(t.wounds.current).toBe(11); // ne dépasse pas 12 − 1
    expect(log[0]).toMatch(/munition logée bloque le soin/);
  });

  it('resolveExtractLodgedAmmo : succès retire 1 munition (Test de Guérison Intermédiaire, LDB 62 l.250)', () => {
    const t = hero({ id: 't', conditions: [{ id: 'munition-logee', value: 2 }] });
    resolveExtractLodgedAmmo(t, true);
    expect(lodgedAmmoCount(t)).toBe(1);
  });

  it('resolveExtractLodgedAmmo : échec ne retire rien ; aucune munition → message dédié', () => {
    const t = hero({ id: 't', conditions: [{ id: 'munition-logee', value: 1 }] });
    resolveExtractLodgedAmmo(t, false);
    expect(lodgedAmmoCount(t)).toBe(1);
    const t2 = hero({ id: 't2', conditions: [] });
    expect(resolveExtractLodgedAmmo(t2, true)[0]).toMatch(/aucune munition/);
  });
});
