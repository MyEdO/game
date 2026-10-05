import { describe, it, expect } from 'vitest';
import { traumaById, dechirureFractureFicheId, traumaMovementHalved, traumaDodgePenalty, traumaCharPenalties, traumaSkillPenalty, consolidateAmputations, treatTrauma } from './trauma';
import { effectiveChar } from './characteristics';
import { effectiveMovement } from './encumbrance';
import { defenseValue } from './combat';
import type { Combatant, ItemInstance, Trauma, HitLocation } from './types';
import { objetDeTest } from './objetDeTest.testkit';

/** Trauma de déchirure/fracture posé à `location` (raccourci data-driven : id de fiche → instance). */
function tk(kind: 'dechirure' | 'fracture', severity: 'mineur' | 'majeur', location: HitLocation, opts?: { be?: number; d10?: number }): Trauma {
  return traumaById(dechirureFractureFicheId(kind, severity, location), opts, location);
}

function c(traumas: Combatant['traumas']): Combatant {
  return { traumas } as Combatant;
}

function fullCombatant(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'T', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 40, initiative: 40, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 40, sociabilite: 40 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, items: [],
    ...over,
  } as Combatant;
}

describe('traumaFromKind (LDB 18-Traumatisme)', () => {
  it('Déchirure musculaire sur Jambe → Mouvement ÷2', () => {
    const t = tk('dechirure', 'mineur', 'jambeD');
    expect(t.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(t.label).toBe('Déchirure musculaire (Mineure)');
    expect(t.location).toBe('jambeD');
  });
  it('Déchirure musculaire sur Bras → aucun effet modélisé (enregistré)', () => {
    const t = tk('dechirure', 'mineur', 'brasG');
    expect(t.ops?.some((o) => o.op === 'moveScale')).toBeFalsy();
    expect(t.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
  });
  it('Fracture Torse → F/Ag −30 + Mouvement ÷2', () => {
    const t = tk('fracture', 'majeur', 'corps');
    expect(t.ops).toContainEqual({ op: 'charMod', char: 'force', mod: -30 });
    expect(t.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -30 });
    expect(t.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(t.label).toBe('Fracture (Majeure)');
  });
  it('Fracture Jambe → Mouvement ÷2, pas de charPenalty', () => {
    const t = tk('fracture', 'mineur', 'jambeG');
    expect(t.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(t.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
  });
  it('Fracture Bras → aucun effet modélisé (latéralité non modélisée)', () => {
    const t = tk('fracture', 'mineur', 'brasD');
    expect(t.ops?.some((o) => o.op === 'moveScale')).toBeFalsy();
    expect(t.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
  });
});

describe('Prothèses — annulation de la séquelle d’amputation de jambe (LDB 73)', () => {
  const legSequela: Trauma = {
    label: 'Membre inférieur amputé (jambeD)', location: 'jambeD',
    ops: [{ op: 'moveScale', num: 1, den: 2 }, { op: 'skillMod', skill: { id: 'esquive' }, mod: -20 }],
    prosthesis: [{ trappingId: 'merveille-d-ingenierie', cancels: 'all' }, { trappingId: 'fausse-jambe', cancels: 'movement' }],
  };
  // Une prothèse doit être PORTÉE (équipée) pour lever le malus (LDB 73), pas seulement possédée. Matchée
  // par `trappingId` STABLE (≠ libellé) — `worn`/`prosthesisCancels` lisent l'id.
  const item = (trappingId: string, equipped = true): ItemInstance => objetDeTest({ uid: trappingId, trappingId, kind: 'misc', subType: 'Prothèses', qualities: [], enc: 0, equipped });

  it('sans prothèse : Mouvement ÷2 et −20 Esquive s’appliquent', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [] });
    expect(traumaMovementHalved(c)).toBe(true);
    expect(traumaDodgePenalty(c)).toBe(-20);
  });
  it('Fausse jambe portée (non entraînée) : le ÷2 SURVIT — le port de base ignore seulement 1 PM (l.23), pas tout le ÷2 ; l’Esquive reste pénalisée (LDB 73)', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('fausse-jambe')] });
    expect(traumaMovementHalved(c)).toBe(true);
    expect(traumaDodgePenalty(c)).toBe(-20);
  });
  it('Fausse jambe entraînée au Mouvement (100 PX, LDB 73) : lève le ÷2 ; l’Esquive reste pénalisée tant que les 200 PX ne sont pas dépensés', () => {
    const moveTrained: ItemInstance = { ...item('fausse-jambe'), prosthesisMoveTrained: true };
    const c = fullCombatant({ traumas: [legSequela], items: [moveTrained] });
    expect(traumaMovementHalved(c)).toBe(false);
    expect(traumaDodgePenalty(c)).toBe(-20);
  });
  it('Merveille d’ingénierie portée : annule TOUT (déplacement + Esquive)', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('merveille-d-ingenierie')] });
    expect(traumaMovementHalved(c)).toBe(false);
    expect(traumaDodgePenalty(c)).toBe(0);
  });
  it('Fausse jambe ENTRAÎNÉE (200 PX, LDB 73) rétablit AUSSI l’Esquive', () => {
    const trained: ItemInstance = { ...item('fausse-jambe'), prosthesisTrained: true };
    const c = fullCombatant({ traumas: [legSequela], items: [trained] });
    expect(traumaMovementHalved(c)).toBe(false);
    expect(traumaDodgePenalty(c)).toBe(0); // entraînée → −20 Esquive levé
  });
  it('prothèse perdue (retirée des items) : la pénalité revient', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('couverture')] });
    expect(traumaMovementHalved(c)).toBe(true);
  });
  it('prothèse POSSÉDÉE mais non portée (au sac) : le malus reste — il faut l’ÉQUIPER (LDB 73)', () => {
    const c = fullCombatant({ traumas: [legSequela], items: [item('fausse-jambe', false)] }); // equipped:false
    expect(traumaMovementHalved(c)).toBe(true);
  });

  describe('effectiveMovement — les 4 paliers de la fausse jambe (LDB 73 l.23, M=4)', () => {
    it('sans prothèse : ÷2 (M4 → 2)', () => {
      expect(effectiveMovement(fullCombatant({ traumas: [legSequela], items: [] }))).toBe(2);
    });
    it('portée non entraînée : ÷2 puis +1 PM ignoré (port de base, M4 → 3)', () => {
      expect(effectiveMovement(fullCombatant({ traumas: [legSequela], items: [item('fausse-jambe')] }))).toBe(3);
    });
    it('entraînée au Mouvement (100 PX) : ÷2 levé (M4 → 4)', () => {
      const moveTrained: ItemInstance = { ...item('fausse-jambe'), prosthesisMoveTrained: true };
      expect(effectiveMovement(fullCombatant({ traumas: [legSequela], items: [moveTrained] }))).toBe(4);
    });
    it('entraînée à l’Esquive (200 PX) : Mouvement plein + Esquive rendue', () => {
      const trained: ItemInstance = { ...item('fausse-jambe'), prosthesisTrained: true };
      const c = fullCombatant({ traumas: [legSequela], items: [trained] });
      expect(effectiveMovement(c)).toBe(4);
      expect(traumaDodgePenalty(c)).toBe(0);
    });
  });

  it('Nez doré annule le −20 Sociabilité de l’amputation du nez (charPenalty, LDB 73)', () => {
    const nez: Trauma = { label: 'Nez amputé', traumaId: 'nez-ampute', location: 'tete', ops: [{ op: 'charMod', char: 'sociabilite', mod: -20 }], prosthesis: [{ trappingId: 'nez-dore', cancels: 'all' }] };
    expect(traumaCharPenalties(fullCombatant({ traumas: [nez], items: [] }), 'sociabilite')).toEqual([-20]);
    expect(traumaCharPenalties(fullCombatant({ traumas: [nez], items: [item('nez-dore')] }), 'sociabilite')).toEqual([]);
  });
});

describe('consolidateAmputations — cumul doigts (l.251) & dents (l.247) ; pénalité de combat CONTEXTUELLE à l’arme (#101)', () => {
  const finger = (loc: 'brasG' | 'brasD', count = 1): Trauma => ({ label: `Doigts amputés (${loc})`, traumaId: 'doigt-ampute', location: loc, count });
  const teeth = (count: number): Trauma => ({ label: 'Dents perdues', traumaId: 'dents-perdues', location: 'tete', count });

  it('cas réel : 1 doigt (main droite) + 3 dents → doigt count 1 SANS charMod (−5 = weapon-context) ; −1 Soc dents', () => {
    const c = fullCombatant({ traumas: [finger('brasD', 1), teeth(3)] });
    consolidateAmputations(c);
    const f = (c.traumas ?? []).find((t) => t.traumaId === 'doigt-ampute')!;
    expect(f.count).toBe(1);
    expect(f.ops?.some((o) => o.op === 'charMod')).toBeFalsy(); // pénalité −5/doigt portée par amputationCombatPenalty
    const d = (c.traumas ?? []).find((t) => t.traumaId === 'dents-perdues')!;
    expect(d.count).toBe(3);
    expect(d.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -1 }); // floor(3/2) = 1 paire
  });

  it('deux pertes de doigts (même main) fusionnent en count 2, SANS charMod', () => {
    const c = fullCombatant({ traumas: [finger('brasD', 1), finger('brasD', 1)] });
    consolidateAmputations(c);
    const fingers = (c.traumas ?? []).filter((t) => t.traumaId === 'doigt-ampute');
    expect(fingers).toHaveLength(1); // fusionné en un seul
    expect(fingers[0].count).toBe(2);
    expect(fingers[0].ops?.some((o) => o.op === 'charMod')).toBeFalsy();
  });

  it('4 doigts perdus → règle de la main tranchée (maxWeaponHands, SANS charMod : −20 = weapon-context)', () => {
    const c = fullCombatant({ traumas: [finger('brasD', 3), finger('brasD', 1)] });
    consolidateAmputations(c);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'doigt-ampute')).toBe(false); // plus de « doigts »
    const hand = (c.traumas ?? []).find((t) => t.traumaId === 'main-bras-ampute')!;
    expect(hand.ops?.some((o) => o.op === 'maxWeaponHands')).toBe(true);
    expect(hand.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
  });

  it('idempotent : reconsolider ne change rien', () => {
    const c = fullCombatant({ traumas: [teeth(5)] });
    consolidateAmputations(c);
    const before = JSON.stringify(c.traumas);
    consolidateAmputations(c);
    expect(JSON.stringify(c.traumas)).toBe(before);
  });
});

describe('consolidateAmputations — escalade `ajoute` des organes pairés (LDB 18 l.273/277)', () => {
  const eye = (): Trauma => traumaById('oeil-perdu', undefined, 'tete');
  const ear = (): Trauma => traumaById('oreille-perdue', undefined, 'tete');
  it('un seul œil : pas de cécité, mais −5 Soc par orbite vide (l.273)', () => {
    const c = fullCombatant({ traumas: [eye()] });
    expect(consolidateAmputations(c)).toHaveLength(0);
    expect((c.traumas ?? []).some((t) => t.traumaId === 'cecite')).toBe(false);
    expect((c.traumas ?? []).find((t) => t.traumaId === 'oeil-perdu')!.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -5 });
  });
  it('deux yeux : Cécité EN PLUS de la séquelle comptée (−10 Soc pour 2 orbites) ; idempotent', () => {
    const c = fullCombatant({ traumas: [eye(), eye()] });
    consolidateAmputations(c);
    const cec = (c.traumas ?? []).find((t) => t.traumaId === 'cecite')!;
    expect(cec.ops).toContainEqual({ op: 'skillMod', skill: { id: 'esquive' }, mod: -30 });
    expect(cec.ops).toContainEqual({ op: 'charMod', char: 'capacite-de-combat', mod: -30 });
    expect(cec.ops).toContainEqual({ op: 'charMod', char: 'capacite-de-tir', mod: -30 });
    const yeux = (c.traumas ?? []).find((t) => t.traumaId === 'oeil-perdu')!;
    expect(yeux.count).toBe(2);
    expect(yeux.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -10 });
    expect(consolidateAmputations(c)).toHaveLength(0); // pas de doublon
    expect((c.traumas ?? []).filter((t) => t.traumaId === 'cecite')).toHaveLength(1);
  });
  it('deux oreilles : Surdité (−20 Perception, restreint aux Tests basés sur l’ouïe)', () => {
    const c = fullCombatant({ traumas: [ear(), ear()] });
    consolidateAmputations(c);
    expect((c.traumas ?? []).find((t) => t.traumaId === 'surdite')!.ops).toContainEqual({ op: 'skillMod', skill: { id: 'perception' }, mod: -20, sense: 'ouie' });
  });
});

describe('traumaMovementHalved', () => {
  it('vrai si un trauma réduit le Mouvement', () => {
    expect(traumaMovementHalved(c([tk('fracture', 'mineur', 'jambeG')]))).toBe(true);
    expect(traumaMovementHalved(c([tk('fracture', 'mineur', 'brasD')]))).toBe(false);
    expect(traumaMovementHalved(c(undefined))).toBe(false);
  });
});

describe('traumas — câblage moteur', () => {
  it('Fracture Torse réduit Force et Agilité de 30 (effectiveChar)', () => {
    const cc = fullCombatant({ traumas: [tk('fracture', 'mineur', 'corps')] });
    expect(effectiveChar(cc, 'force')).toBe(10);  // 40 − 30
    expect(effectiveChar(cc, 'agilite')).toBe(10);
    expect(effectiveChar(cc, 'capacite-de-combat')).toBe(40); // non touché
  });
  it('Trauma de jambe réduit le Mouvement effectif de moitié', () => {
    const cc = fullCombatant({ traumas: [tk('fracture', 'mineur', 'jambeG')] });
    expect(effectiveMovement(cc)).toBe(2); // floor(4/2)
  });
  it('Sans trauma de mouvement, Mouvement inchangé', () => {
    const cc = fullCombatant({ traumas: [tk('fracture', 'mineur', 'brasD')] });
    expect(effectiveMovement(cc)).toBe(4);
  });
  it('Fracture de jambe réduit l’Esquive de 20 (règle du Pied, LDB 18 l.285)', () => {
    const sain = fullCombatant();
    expect(defenseValue(sain, 'esquive')).toBe(40); // Ag 40, pas de pénalité
    const blesse = fullCombatant({ traumas: [tk('fracture', 'mineur', 'jambeG')] });
    expect(defenseValue(blesse, 'esquive')).toBe(20); // 40 − 20 (mobilité)
  });
  it('Déchirure de jambe Mineure réduit l’Esquive de 10', () => {
    const c = fullCombatant({ traumas: [tk('dechirure', 'mineur', 'jambeD')] });
    expect(defenseValue(c, 'esquive')).toBe(30); // 40 − 10
  });
});

describe('traumaSkillPenalty — Surdité restreinte aux Tests auditifs (LDB 18 : "Tests de Perception basés sur l’ouïe")', () => {
  const deaf = (): Combatant => fullCombatant({ traumas: [traumaById('surdite', undefined, 'tete')] });

  it('sens du Test INCONNU (aucun appelant ne le précise encore) : la pénalité s’applique par défaut', () => {
    expect(traumaSkillPenalty(deaf(), 'perception')).toBe(-20);
  });
  it('Test de Perception basé sur l’OUÏE : pénalisé', () => {
    expect(traumaSkillPenalty(deaf(), 'perception', 'ouie')).toBe(-20);
  });
  it('Test de Perception basé sur la VUE : exempté — le RAW ne vise QUE les Tests basés sur l’ouïe', () => {
    expect(traumaSkillPenalty(deaf(), 'perception', 'vue')).toBe(0);
  });
  it('Cécité reste inconditionnelle (compétences nommées CC/CT/Esquive/Chevaucher, pas de restriction de sens)', () => {
    const c = fullCombatant({ traumas: [traumaById('cecite', undefined, 'tete')] });
    expect(traumaCharPenalties(c, 'capacite-de-combat')).toEqual([-30]);
    expect(traumaDodgePenalty(c)).toBe(-30);
  });
});

describe('treatTrauma — rôle d’INFORMATION de la Guérison sur la déchirure MAJEURE (LDB 18)', () => {
  function tornMajor(recoveryDays = 40): Trauma {
    return { ...tk('dechirure', 'majeur', 'jambeD'), recoveryDays, recoveryTotal: recoveryDays };
  }
  it('ne raccourcit PAS la convalescence (aucune accélération), mais diagnostique le délai restant', () => {
    const cc = fullCombatant({ traumas: [tornMajor(40)] });
    const log = treatTrauma(cc, 3, true);
    const t = cc.traumas![0];
    expect(t.recoveryDays).toBe(40); // inchangé : la Guérison n'accélère rien sur une déchirure majeure
    expect(t.healAccelerated).toBe(true); // le jet est tout de même consommé (une seule fois, l.317)
    expect(log[0]).toContain('40'); // diagnostic concret : jours restants avant de pouvoir réutiliser le membre
  });
  it('le jet ÉCHOUÉ consomme aussi le jet unique, sans diagnostic', () => {
    const cc = fullCombatant({ traumas: [tornMajor(40)] });
    treatTrauma(cc, 0, false);
    expect(cc.traumas![0].healAccelerated).toBe(true);
    expect(cc.traumas![0].recoveryDays).toBe(40);
  });
});
