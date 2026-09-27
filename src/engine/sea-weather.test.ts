import { describe, it, expect } from 'vitest';
import {
  rollSeaWeather, rollWindDirection, windAspect, tickWindForce, windEffect, windAdjustedM,
  visibilityDRPenalty, precipitationSkillMod, dailyWaterLitres, windForces, temperatureDef,
  seaExposureTestsPerDay,
} from './seaWeather';
import type { RNG } from './dice';
import { setRule, resetRule } from './policy';

/** RNG scripté : rend la file de valeurs (clampée au domaine demandé). */
const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

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
    expect(precipitationSkillMod('abondantes', 'athletisme')).toBe(-20);
    expect(precipitationSkillMod('abondantes', 'voile')).toBe(-10);
    expect(precipitationSkillMod('abondantes', 'charme')).toBe(0);
    expect(precipitationSkillMod('tres-abondantes', 'charme')).toBe(-10);
    expect(precipitationSkillMod('aucune', 'voile')).toBe(0);
  });

  it('Précipitations : Projectiles ne subit le malus QUE pour Poudre noire (#162)', () => {
    expect(precipitationSkillMod('legeres', 'projectiles', 'arc')).toBe(0);
    expect(precipitationSkillMod('legeres', 'projectiles', 'poudre-noire')).toBe(-10);
    expect(precipitationSkillMod('legeres', 'projectiles')).toBe(0);
    expect(precipitationSkillMod('abondantes', 'projectiles', 'arc')).toBe(0);
    expect(precipitationSkillMod('abondantes', 'projectiles', 'poudre-noire')).toBe(-20);
    expect(precipitationSkillMod('tres-abondantes', 'projectiles', 'arc')).toBe(-10);
    expect(precipitationSkillMod('tres-abondantes', 'projectiles', 'poudre-noire')).toBe(-30);
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

  it('seaExposureTestsPerDay : 8 h de pont / cadence de bande (4 h → 2 Tests, 2 h → 4) ; Médiane → 0', () => {
    // Une Période de travail à la voile = 8 h (l.107) ÷ la cadence RAW (l.209-225).
    expect(seaExposureTestsPerDay('caniculaire')).toBe(4); // 8 ÷ 2
    expect(seaExposureTestsPerDay('glaciale')).toBe(4); // 8 ÷ 2
    expect(seaExposureTestsPerDay('chaude')).toBe(2); // 8 ÷ 4
    expect(seaExposureTestsPerDay('froide')).toBe(2); // 8 ÷ 4
    expect(seaExposureTestsPerDay('mediane')).toBe(0); // tolérable (l.217)
  });
});
