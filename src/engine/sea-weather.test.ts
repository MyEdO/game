import { describe, it, expect } from 'vitest';
import {
  rollSeaWeather, rollWindDirection, windAspect, tickWindForce, tickWindForceDay, windEffect, windAdjustedM,
  visibilityDRPenalty, precipitationTestMods, dailyWaterLitres, windForces, temperatureDef,
  seaExposureTestsPerDay, precipitationDef,
} from './seaWeather';
import { lignesDe } from './modLine.testkit';
import { RULE_REF } from './ruleRefs';
import { t } from '../i18n';
import type { RNG } from './dice';
import { baseTestModLines } from './combat';
import type { Combatant } from './types';
import { setRule, resetRule } from './policy';
import { desEnSuite } from './dice.testkit';

/** Somme des lignes du canal Précipitations (MDG 13 l.185-200). */
const precipMod = (...a: Parameters<typeof precipitationTestMods>): number => precipitationTestMods(...a).reduce((s, m) => s + m.value, 0);

/** RNG scripté : rend la file de valeurs (clampée au domaine demandé). */
const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });

describe('rollSeaWeather — MÉTÉO DE LA MER DES GRIFFES (MDG 13 l.164-181)', () => {
  it('1d10 par aspect, été sans modificateur : 1 → Aucune/Caniculaire/Dégagé/Calme plat', () => {
    const w = rollSeaWeather('ete', seq(1, 1, 1, 1));
    expect(w).toEqual({ precipitations: 'aucune', temperature: 'caniculaire', visibilite: 'degage', vent: 'calme-plat' });
  });

  it('hiver : +4 au résultat (l.164) — un 10 devient 14 (Aucune/Glaciale/Dégagé/Calme plat)', () => {
    const w = rollSeaWeather('hiver', seq(10, 10, 10, 10));
    expect(w).toEqual({ precipitations: 'aucune', temperature: 'glaciale', visibilite: 'degage', vent: 'calme-plat' });
  });

  it('automne/printemps : +2 (l.164) — un 7 devient 9 (Légères/Froide/Brouillard/Violente tempête)', () => {
    const w = rollSeaWeather('automne', seq(7, 7, 7, 7));
    expect(w).toEqual({ precipitations: 'legeres', temperature: 'froide', visibilite: 'brouillard', vent: 'violente-tempete' });
  });

  it('mer chaude : −2 (min 1) sur Température et Visibilité SEULEMENT (l.166)', () => {
    const w = rollSeaWeather('ete', seq(2, 2, 2, 2), true);
    expect(w.precipitations).toBe('aucune'); // 2 (non modifié)
    expect(w.temperature).toBe('caniculaire'); // 2−2 → min 1
    expect(w.visibilite).toBe('degage');
    expect(w.vent).toBe('legere-brise'); // 2 (non modifié)
  });
});

describe('vents — rose, aspect, mise à jour (MDG 13 l.250-272)', () => {
  it('rose des vents : 1-6 = dominant (ouest sur la Mer des Griffes), 7 nord, 8 sud, 9 ouest, 10 est', () => {
    expect(rollWindDirection(seq(3))).toBe('ouest');
    expect(rollWindDirection(seq(7))).toBe('nord');
    expect(rollWindDirection(seq(10))).toBe('est');
    expect(rollWindDirection(seq(4), 'nord')).toBe('nord'); // dominant paramétrable
  });

  it('aspect : cap nord + vent du nord = de face ; + vent du sud = arrière ; + vent d’est/ouest = latéral (l.262-270)', () => {
    expect(windAspect('nord', 'nord')).toBe('face');
    expect(windAspect('nord', 'sud')).toBe('arriere');
    expect(windAspect('nord', 'est')).toBe('lateral');
    expect(windAspect('ouest', 'est')).toBe('arriere');
  });

  it('tickWindForce : 1 sur 1d10 → ±1 cran ; bornes Calme plat → Légère brise / Tempête → Vent violent (l.272)', () => {
    expect(tickWindForce('vent-modere', seq(5))).toBe('vent-modere'); // pas de 1 → inchangé
    expect(tickWindForce('vent-modere', seq(1, 3))).toBe('vent-violent'); // 1 puis d10 ≤ 5 = forcir
    expect(tickWindForce('vent-modere', seq(1, 8))).toBe('brise-fraiche'); // mollir
    expect(tickWindForce('calme-plat', seq(1, 8))).toBe('legere-brise'); // ne peut que forcir
    expect(tickWindForce('violente-tempete', seq(1, 3))).toBe('vent-violent'); // ne peut que mollir
    expect(windForces()).toHaveLength(6);
  });

  /** RNG scripté STRICT : chaque valeur servie une fois, `consumed` compte les d10 tirés. */
  const file = (...vals: number[]): RNG & { consumed: () => number } => {
    let i = 0;
    return {
      int: (min, max) => { if (i >= vals.length) throw new Error('file épuisée'); return Math.min(max, Math.max(min, vals[i++])); },
      consumed: () => i,
    };
  };

  it('tickWindForceDay : aube, midi, crépuscule, minuit = 4 d10 par jour (l.272)', () => {
    const calme = file(5, 7, 2, 10);
    expect(tickWindForceDay('vent-modere', calme)).toBe('vent-modere');
    expect(calme.consumed()).toBe(4);
    const deuxCrans = file(1, 3, 6, 1, 3, 9);
    expect(tickWindForceDay('brise-fraiche', deuxCrans)).toBe('vent-violent');
    expect(deuxCrans.consumed()).toBe(6);
    const mollit = file(4, 1, 8, 4, 4);
    expect(tickWindForceDay('brise-fraiche', mollit)).toBe('legere-brise');
    expect(mollit.consumed()).toBe(5);
  });

  it('tickWindForceDay : bornes Calme plat et Violente tempête à chaque moment (l.272)', () => {
    expect(tickWindForceDay('calme-plat', file(1, 8, 1, 3, 1, 3, 1, 3))).toBe('vent-violent');
    expect(tickWindForceDay('violente-tempete', file(1, 3, 1, 8, 2, 2))).toBe('vent-modere');
    expect(tickWindForceDay('violente-tempete', file(1, 8, 1, 3, 1, 3, 1, 3))).toBe('violente-tempete');
  });
});

describe('windEffect / windAdjustedM — EFFET DU VENT (MDG 13 l.276-286 ; Clinfoc ch.12 l.256-264)', () => {
  it('vent modéré arrière : +25 % voiles / +0 % autres ; de face : −50 % / −10 %', () => {
    expect(windEffect('vent-modere', 'arriere')).toMatchObject({ pctSail: 25, pctOther: 0 });
    expect(windEffect('vent-modere', 'face')).toMatchObject({ pctSail: -50, pctOther: -10 });
    expect(windAdjustedM(6, windEffect('vent-modere', 'arriere'), true)).toBe(8); // 6 × 1,25 = 7,5 → 8
    expect(windAdjustedM(6, windEffect('vent-modere', 'face'), true)).toBe(3);
    expect(windAdjustedM(6, windEffect('vent-modere', 'face'), false)).toBe(5); // autres : −10 %
  });

  it('calme plat → Encalminé (voiles) ; vent violent latéral → Affaler les voiles (null pour un voilier)', () => {
    expect(windAdjustedM(6, windEffect('calme-plat', 'arriere'), true)).toBeNull();
    expect(windEffect('vent-violent', 'lateral').affaler).toBe(true);
    expect(windAdjustedM(6, windEffect('vent-violent', 'lateral'), true)).toBeNull();
    expect(windAdjustedM(6, windEffect('vent-violent', 'lateral'), false)).toBe(6); // autres : −5 % → 5,7 → 6
  });

  it('brise fraîche latérale : Virement de bord + 10 % (le bonus exige un Test réussi, l.302-304)', () => {
    const c = windEffect('brise-fraiche', 'lateral');
    expect(c.virement).toBe(true);
    expect(c.pctSail).toBe(10);
  });

  it('Clinfoc (ch.12) : vent violent arrière +50 % voiles ; légère brise arrière +10 % au lieu de +0', () => {
    expect(windEffect('vent-violent', 'arriere', 'clinfoc').pctSail).toBe(50);
    expect(windEffect('legere-brise', 'arriere', 'clinfoc').pctSail).toBe(10);
    expect(windEffect('legere-brise', 'arriere').pctSail).toBe(0);
    // La colonne « autres propulsions » reste celle du tableau standard.
    expect(windEffect('legere-brise', 'arriere', 'clinfoc').pctOther).toBe(0);
  });

  it('Gréement de course (MSRC 12 l.137) : +10 % voiles vent arrière/de côté ; vent contraire malus réduit de 5 %', () => {
    // Vent arrière : std +25 % → +35 % ; vent de côté : std +25 % (avec Virement conservé) → +35 %.
    expect(windEffect('vent-modere', 'arriere', 'greement').pctSail).toBe(35);
    const lat = windEffect('vent-modere', 'lateral', 'greement');
    expect(lat.pctSail).toBe(35);
    expect(lat.virement).toBe(true); // le Gréement ne supprime pas la contrainte de Virement de bord
    // Vent contraire : malus réduit de 5 % (std −50 % → −45 %) ; légère brise de face −10 % → −5 %.
    expect(windEffect('vent-modere', 'face', 'greement').pctSail).toBe(-45);
    expect(windEffect('legere-brise', 'face', 'greement').pctSail).toBe(-5);
    // Voiles affalées / Encalminé : le gréement n'aide pas (cellule inchangée).
    expect(windEffect('vent-violent', 'lateral', 'greement').affaler).toBe(true);
    expect(windEffect('calme-plat', 'arriere', 'greement').encalmine).toBe(true);
    // Le % « autres propulsions » n'est pas touché (voiles seulement).
    expect(windEffect('vent-modere', 'face', 'greement').pctOther).toBe(-10);
  });
});

describe('effets d’ambiance — Précipitations / Température / Visibilité (MDG 13 l.187-243)', () => {
  it('Visibilité : Brume −1 DR au-delà de 20 m ; Purée de pois −3 DR au-delà de 5 m ; rien en deçà', () => {
    expect(visibilityDRPenalty('brume', 25)).toBe(-1);
    expect(visibilityDRPenalty('brume', 15)).toBe(0);
    expect(visibilityDRPenalty('puree-de-pois', 6)).toBe(-3);
    expect(visibilityDRPenalty('degage', 500)).toBe(0);
  });

  it('Précipitations : Abondantes = −20 Athlétisme, −10 Voile ; Très abondantes = −10 « tous les autres Tests »', () => {
    expect(precipMod('abondantes', 'athletisme')).toBe(-20);
    expect(precipMod('abondantes', 'voile')).toBe(-10);
    expect(precipMod('abondantes', 'charme')).toBe(0);
    expect(precipMod('tres-abondantes', 'charme')).toBe(-10);
    expect(precipMod('aucune', 'voile')).toBe(0);
  });

  it('Précipitations : le canal rend UNE ligne « Météo » de famille circonstance, et frappe le Test de Caractéristique en Très abondantes', () => {
    expect(precipitationTestMods('tres-abondantes', 'voile')).toEqual([{ label: t('tp.modWeather', { weather: precipitationDef('tres-abondantes').label }), value: -20, famille: 'circonstance', ref: RULE_REF['meteo-maritime'] }]);
    expect(precipMod('tres-abondantes')).toBe(-10);
    expect(precipMod('abondantes')).toBe(0);
    expect(precipitationTestMods(undefined, 'voile')).toEqual([]);
    expect(precipitationTestMods('aucune', 'voile')).toEqual([]);
  });

  it('Précipitations : Projectiles ne subit le malus QUE pour Poudre noire (#162)', () => {
    expect(precipMod('legeres', 'projectiles', 'arc')).toBe(0);
    expect(precipMod('legeres', 'projectiles', 'poudre-noire')).toBe(-10);
    expect(precipMod('legeres', 'projectiles')).toBe(0);
    expect(precipMod('abondantes', 'projectiles', 'arc')).toBe(0);
    expect(precipMod('abondantes', 'projectiles', 'poudre-noire')).toBe(-20);
    expect(precipMod('tres-abondantes', 'projectiles', 'arc')).toBe(-10);
    expect(precipMod('tres-abondantes', 'projectiles', 'poudre-noire')).toBe(-30);
  });

  it('Température : Caniculaire = Test toutes les 2 h Intermédiaire (+0), 4 L/jour ; Glaciale = 2 h, froid', () => {
    expect(temperatureDef('caniculaire')).toMatchObject({ testEveryHours: 2, difficulty: 'intermediaire', exposure: 'chaleur' });
    expect(temperatureDef('glaciale')).toMatchObject({ testEveryHours: 2, exposure: 'froid' });
    expect(temperatureDef('mediane').testEveryHours).toBeUndefined();
    expect(dailyWaterLitres('caniculaire')).toBe(4);
    expect(dailyWaterLitres('chaude')).toBe(3);
    expect(dailyWaterLitres('mediane')).toBe(3); // régime de bord « 2 à 3 litres » (MDG 14 l.242)
  });
  it('règle `sea-water-litres-mediane` surchargée (borne basse 2 L) : suit la surcharge', () => {
    setRule('sea-water-litres-mediane', 2);
    expect(dailyWaterLitres('mediane')).toBe(2);
    expect(dailyWaterLitres('caniculaire')).toBe(4); // bandes déjà chiffrées : jamais affectées
    resetRule('sea-water-litres-mediane');
    expect(dailyWaterLitres('mediane')).toBe(3);
  });

  it('seaExposureTestsPerDay : Tests d’Exposition d’une journée en mer par bande de Température (MDG 13 l.107, l.185, l.203-225 ; décision A1 #1595)', () => {
    // `WORK_PERIOD_HOURS.voile` ÷ `testEveryHours` de la bande.
    expect(seaExposureTestsPerDay('caniculaire')).toBe(4); // 8 ÷ 2
    expect(seaExposureTestsPerDay('glaciale')).toBe(4); // 8 ÷ 2
    expect(seaExposureTestsPerDay('chaude')).toBe(2); // 8 ÷ 4
    expect(seaExposureTestsPerDay('froide')).toBe(2); // 8 ÷ 4
    expect(seaExposureTestsPerDay('mediane')).toBe(0); // tolérable (l.217)
  });
});

describe('`baseTestModLines` — les Précipitations lisent la Compétence que l’appelant déclare (MDG 13 l.185, #1936)', () => {
  const surLePont = (): Combatant => ({
    id: 'x', label: 'X', kind: 'hero', characteristics: {}, skills: [], talents: [], traits: [],
    conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
    wounds: { current: 10, max: 10, base: 10 }, advantage: 0, envPrecipitation: 'tres-abondantes',
  }) as unknown as Combatant;
  const meteo = (lines: ReturnType<typeof baseTestModLines>) => lignesDe(lines, RULE_REF['meteo-maritime']).map((l) => l.value);

  it('un Test d’Athlétisme porte le −30 de sa Compétence, pas le −10 du Test de Caractéristique', () => {
    expect(meteo(baseTestModLines(surLePont(), 'agilite', { skill: 'athletisme' }))).toEqual([-30]);
  });

  it('sans Compétence déclarée (Empoignade, Test de Force) : le −10 de « tous les autres Tests »', () => {
    expect(meteo(baseTestModLines(surLePont(), 'force', { movement: true }))).toEqual([-10]);
  });
});
