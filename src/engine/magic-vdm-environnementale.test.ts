/**
 * Magie ENVIRONNEMENTALE des *Vents de Magie* (`VDM 14`, option `magic-vdm-environnementale`) :
 * l'état magique du LIEU (palier de Saturation + phénomènes arcaniques) modifie les Tests
 * d'Incantation / de Focalisation / de Dissipation.
 *
 * Les attendus chiffrés ci-dessous sont relus au Source (`Source/Warhammer v4 - Les Vents de
 * Magie/14 - Les Vents a l'oeuvre.md`), folios 189-207.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OPTIONAL_RULES, setRule, resetRule, ruleDef } from './policy';
import {
  environmentTestDR,
  environmentWidensCrit,
  modDR,
  rollArcaneTable,
} from './magicEnvironment';
import {
  arcanePhenomena,
  saturationLevels,
  windSaturationEffects,
  arcaneTables,
  findArcanePhenomenonById,
  findSaturationLevelById,
  findArcaneTableById,
  findWindSaturationEffects,
} from '../data/arcanePhenomena';
import { resolveCasting, resolveFocus, castLandProbability } from './magic';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { datasetObject, setObjectDataset } from '../data/overrides';

const RULE = 'magic-vdm-environnementale';

const spell = (domainId: string | null) => ({ domainId });
const sorcier = (talents: { talentId: string; spec?: string }[] = []): Combatant =>
  ({ id: 'c1', label: 'Sorcier', talents } as unknown as Combatant);

describe('registre — la donnée porte le chapitre 14 en entier', () => {
  it('les cinq paliers de Saturation, dans l’ordre imprimé', () => {
    expect(saturationLevels.map((l) => l.id)).toEqual(['basse', 'normale', 'elevee', 'extreme', 'corrompue']);
  });

  it('les huit Vents portent leur rangée d’Effets de Saturation, chacune rattachée à un Domaine', () => {
    expect(windSaturationEffects).toHaveLength(8);
    expect(findWindSaturationEffects('feu')?.wind).toBe('Aqshy');
    expect(findWindSaturationEffects('feu')?.effects.find((e) => e.tier === 'extreme')?.label).toBe('feux de forêt soudains');
    expect(findWindSaturationEffects('sorcellerie')).toBeUndefined();
  });

  it('chaque entrée cite son folio du livre des Vents de Magie', () => {
    const entries = [...saturationLevels, ...windSaturationEffects, ...arcanePhenomena, ...arcaneTables];
    for (const e of entries) {
      expect(e.source.book).toBe('vents-de-la-magie');
      expect(e.source.page).toBeGreaterThanOrEqual(189);
      expect(e.source.page).toBeLessThanOrEqual(207);
    }
  });

  it('les trois tables du chapitre couvrent leur dé sans trou ni chevauchement', () => {
    for (const t of arcaneTables) {
      const faces = t.die === 'd10' ? 10 : 100;
      let next = 1;
      for (const r of t.rows) {
        expect(r.min).toBe(next);
        next = r.max + 1;
      }
      expect(next - 1).toBe(faces);
    }
  });

  it('Flux magique : le d10 désigne les huit Vents, puis la Sorcellerie, puis la Magie noire et le Chaos', () => {
    expect(rollArcaneTable('vdm-flux-magique', 1).domainIds).toEqual(['bete']);
    expect(rollArcaneTable('vdm-flux-magique', 9).domainIds).toEqual(['sorcellerie']);
    const dix = rollArcaneTable('vdm-flux-magique', 10);
    expect(dix.domainIds).toEqual(['dhar']);
    expect(dix.chaosMagic).toBe(true);
  });

  it('Flux magique : la rangée 9 est RECONSTRUITE — la cellule imprimée est vide, la note le dit', () => {
    const table = findArcaneTableById('vdm-flux-magique');
    const neuf = table.rows.find((r) => r.min === 9)!;
    expect(neuf.maison).toMatch(/RECONSTRUITE/);
    expect(neuf.maison).toMatch(/VIDE/);
    // Aucune autre rangée n'est déduite : les neuf autres sont lues telles qu'imprimées.
    expect(table.rows.filter((r) => r.maison)).toHaveLength(1);
  });

  it('Corruption chaotique / nécromantique : d100 de 20 rangées chacune, tirées par findTableEntry', () => {
    expect(findArcaneTableById('vdm-corruption-chaotique').rows).toHaveLength(20);
    expect(rollArcaneTable('vdm-corruption-chaotique', 3).label).toBe('Colonnes de crânes');
    expect(rollArcaneTable('vdm-corruption-chaotique', 100).label).toBe('Pustules en germination');
    expect(rollArcaneTable('vdm-corruption-necromantique', 100).label).toBe('Brume effroyable');
  });

  it('une table inconnue échoue FRANCHEMENT (bug de données, jamais un silence)', () => {
    expect(() => findArcaneTableById('table-inexistante')).toThrow(/introuvable/);
  });

  // Câblage donnée → lecture publique : aucun index précalculé ne doit rester périmé après une
  // édition Compendium (`setObjectDataset`, `data/overrides.ts`) — même patron que
  // `noyau/monde/footprint.test.ts::câblage donnée → géométrie`.
  describe('câblage donnée → lecture directe (sans rechargement de module)', () => {
    const seed = structuredClone(datasetObject('arcanePhenomena'));
    afterEach(() => setObjectDataset('arcanePhenomena', structuredClone(seed)));

    it('muter le label d’un palier de Saturation le rend visible via findSaturationLevelById', () => {
      const next = structuredClone(datasetObject('arcanePhenomena'));
      const basse = next.saturationLevels.find((l) => l.id === 'basse')!;
      basse.label = 'Saturation basse (mutée)';
      setObjectDataset('arcanePhenomena', next);
      expect(findSaturationLevelById('basse')?.label).toBe('Saturation basse (mutée)');
      expect(saturationLevels.find((l) => l.id === 'basse')?.label).toBe('Saturation basse (mutée)');
    });

    it('muter le label d’un phénomène le rend visible via findArcanePhenomenonById', () => {
      const id = arcanePhenomena[0].id;
      const next = structuredClone(datasetObject('arcanePhenomena'));
      next.phenomena.find((p) => p.id === id)!.label = 'Phénomène muté';
      setObjectDataset('arcanePhenomena', next);
      expect(findArcanePhenomenonById(id)?.label).toBe('Phénomène muté');
    });
  });
});

describe('option `magic-vdm-environnementale` — entrée du registre', () => {
  it('groupe Magie, drapeau, DÉSACTIVÉE par défaut, réf VDM', () => {
    const def = ruleDef(RULE);
    expect(def).toBeDefined();
    expect(def?.group).toBe('Magie');
    expect(def?.kind).toBe('flag');
    expect(def?.default).toBe(false);
    expect(def?.ref).toMatch(/^VDM 14/);
    expect(OPTIONAL_RULES.filter((r) => r.id === RULE)).toHaveLength(1);
  });

  it('DÉSACTIVÉE : aucun modificateur, même dans une zone en Saturation Extrême', () => {
    resetRule(RULE);
    expect(environmentTestDR(spell('feu'), 'incantation', { saturationLevelId: 'extreme', dominantWinds: ['feu'] })).toBe(0);
    expect(environmentWidensCrit({ phenomena: [{ id: 'jonction-saturee' }] })).toBe(false);
  });
});

describe('Saturation environnementale (folio 190)', () => {
  beforeEach(() => setRule(RULE, true));
  afterEach(() => resetRule(RULE));

  it('Basse : −1 DR aux Tests d’Incantation et de Focalisation de TOUS les Domaines', () => {
    const env = { saturationLevelId: 'basse' };
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(-1);
    expect(environmentTestDR(spell('feu'), 'focalisation', env)).toBe(-1);
    expect(environmentTestDR(spell('sorcellerie'), 'incantation', env)).toBe(-1);
  });

  it('Normale : aucun modificateur', () => {
    expect(environmentTestDR(spell('feu'), 'incantation', { saturationLevelId: 'normale' })).toBe(0);
  });

  it('Élevée : +1 DR pour le ou les Domaines prépondérants SEULEMENT', () => {
    const env = { saturationLevelId: 'elevee', dominantWinds: ['feu', 'metal'] };
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(1);
    expect(environmentTestDR(spell('metal'), 'focalisation', env)).toBe(1);
    expect(environmentTestDR(spell('vie'), 'incantation', env)).toBe(0);
  });

  it('Extrême : +2 DR d’Incantation pour les prépondérants, +1 DR pour tous les autres', () => {
    const env = { saturationLevelId: 'extreme', dominantWinds: ['feu'] };
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(2);
    expect(environmentTestDR(spell('vie'), 'incantation', env)).toBe(1);
  });

  it('sans Vent prépondérant déclaré, l’Élevée ne donne RIEN (jamais un bonus par défaut)', () => {
    expect(environmentTestDR(spell('feu'), 'incantation', { saturationLevelId: 'elevee' })).toBe(0);
  });

  it('un Sort SANS Domaine (Magie mineure) échappe aux modificateurs par Vent', () => {
    const env = { saturationLevelId: 'extreme', dominantWinds: ['feu'] };
    expect(environmentTestDR(spell(null), 'incantation', env)).toBe(0);
  });
});

describe('Phénomènes arcaniques (folios 193-198)', () => {
  beforeEach(() => setRule(RULE, true));
  afterEach(() => resetRule(RULE));

  it('Ligne de force : +1 DR à l’Incantation, quel que soit le Domaine', () => {
    for (const id of ['ligne-de-force-naturelle', 'ligne-de-force-artificielle']) {
      expect(environmentTestDR(spell('vie'), 'incantation', { phenomena: [{ id }] })).toBe(1);
    }
  });

  it('Réfraction : +1 DR de Focalisation aux Domaines des Collèges, −1 DR aux autres', () => {
    const env = { phenomena: [{ id: 'pierre-gardienne-refraction' }] };
    expect(environmentTestDR(spell('cieux'), 'focalisation', env)).toBe(1);
    expect(environmentTestDR(spell('necromancie'), 'focalisation', env)).toBe(-1);
    expect(environmentTestDR(spell('cieux'), 'incantation', env)).toBe(0);
  });

  it('Vents distincts : la pierre qui réfracte Azyr ne donne son bonus qu’à Azyr (VDM 14 l.161)', () => {
    const env = { phenomena: [{ id: 'pierre-gardienne-refraction', winds: ['cieux'] }] };
    expect(environmentTestDR(spell('cieux'), 'focalisation', env)).toBe(1);
    // Un Domaine de Collège NON réfracté perd le bonus (la restriction mord)…
    expect(environmentTestDR(spell('feu'), 'focalisation', env)).toBe(0);
    // …et le malus général des autres Domaines reste dû : le RAW ne restreint que le BONUS.
    expect(environmentTestDR(spell('necromancie'), 'focalisation', env)).toBe(-1);
  });

  it('les Vents déclarés par le site n’OUVRENT jamais une portée fermée', () => {
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'cercle-d-oghams', winds: ['feu'] }] })).toBe(0);
    expect(environmentTestDR(spell('vie'), 'incantation', { phenomena: [{ id: 'ligne-de-dhar', winds: ['vie'] }] })).toBe(0);
    expect(environmentTestDR(spell('vie'), 'incantation', { phenomena: [{ id: 'cercle-d-oghams', winds: ['feu'] }] })).toBe(1);
  });

  it('Atténuation : −2 DR à l’Incantation, +2 DR à la Dissipation', () => {
    const env = { phenomena: [{ id: 'pierre-gardienne-attenuation' }] };
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(-2);
    expect(environmentTestDR(spell('feu'), 'dissipation', env)).toBe(2);
  });

  it('Amplification : +2 DR à l’Incantation', () => {
    expect(environmentTestDR(spell('cieux'), 'incantation', { phenomena: [{ id: 'pierre-gardienne-amplification' }] })).toBe(2);
  });

  it('Cercle d’oghams : +1 DR (Incantation ET Focalisation) à la Vie et à la Magie naturelle seules', () => {
    const env = { phenomena: [{ id: 'cercle-d-oghams' }] };
    expect(environmentTestDR(spell('vie'), 'incantation', env)).toBe(1);
    expect(environmentTestDR(spell('magie-naturelle'), 'focalisation', env)).toBe(1);
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(0);
  });

  it('Nexus de la Toile Géomantique : +2 DR de FOCALISATION (pas d’Incantation)', () => {
    const env = { phenomena: [{ id: 'nexus-toile-geomantique' }] };
    expect(environmentTestDR(spell('feu'), 'focalisation', env)).toBe(2);
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(0);
  });

  it('Ligne de Dhar : +1 DR à la Sorcellerie et à la Magie noire, rien au Domaine de la Vie', () => {
    const env = { phenomena: [{ id: 'ligne-de-dhar' }] };
    expect(environmentTestDR(spell('sorcellerie'), 'incantation', env)).toBe(1);
    expect(environmentTestDR(spell('dhar'), 'incantation', env)).toBe(1);
    expect(environmentTestDR(spell('vie'), 'incantation', env)).toBe(0);
  });

  it('Magie du Chaos : la portée se résout sur le LANCEUR (spec du Talent Magie du Chaos)', () => {
    const env = { phenomena: [{ id: 'corruption-chaotique' }] };
    const profane = sorcier();
    const cultiste = sorcier([{ talentId: 'magie-du-chaos', spec: 'nurgle' }]);
    expect(environmentTestDR(spell('vie'), 'incantation', env, profane)).toBe(0);
    expect(environmentTestDR(spell('vie'), 'incantation', env, cultiste)).toBe(1);
    expect(environmentTestDR(spell('vie'), 'focalisation', env, cultiste)).toBe(1);
  });

  it('Corruption nécromantique : +1 DR à la Magie noire', () => {
    const env = { phenomena: [{ id: 'corruption-necromantique' }] };
    expect(environmentTestDR(spell('dhar'), 'incantation', env)).toBe(1);
    expect(environmentTestDR(spell('lumiere'), 'incantation', env)).toBe(0);
  });

  it('Tempête de Magie : +2 DR à l’Incantation, cumulés avec les autres bonus', () => {
    const env = { phenomena: [{ id: 'tempete-de-magie' }, { id: 'ligne-de-force-naturelle' }] };
    expect(environmentTestDR(spell('mort'), 'incantation', env)).toBe(3);
  });

  it('Jonction tellurique : le cas GÉNÉRAL du RAW est +1 DR, la fourchette monte à +3', () => {
    const mod = findArcanePhenomenonById('jonction-tellurique')?.testMods?.[0];
    expect(mod?.dr).toBe(1);
    expect(mod?.drMax).toBe(3);
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'jonction-tellurique' }] })).toBe(1);
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'jonction-tellurique', dr: 3 }] })).toBe(3);
  });

  it('un DR choisi HORS de la fourchette imprimée est ramené dans les bornes', () => {
    const mod = findArcanePhenomenonById('jonction-tellurique')!.testMods![0];
    expect(modDR(mod, 9)).toBe(3);
    expect(modDR(mod, 0)).toBe(1);
  });

  it('Jonction saturée : la borne BASSE fait défaut (jamais la plus favorable au lanceur), avec sa justification maison', () => {
    const mod = findArcanePhenomenonById('jonction-saturee')?.testMods?.[0];
    expect(mod?.dr).toBe(2);
    expect(mod?.drMax).toBe(8);
    expect(mod?.maison).toBeTruthy();
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'jonction-saturee' }] })).toBe(2);
  });

  it('Jonction saturée : l’Incantation Critique s’élargit aux réussites finissant par 0', () => {
    expect(environmentWidensCrit({ phenomena: [{ id: 'jonction-saturee' }] })).toBe(true);
    expect(environmentWidensCrit({ phenomena: [{ id: 'ligne-de-force-naturelle' }] })).toBe(false);
  });

  it('Faille du Warp / Portail magique : fourchette +1 à +5 DR, loi 1d10/2 tirée par le SITE à chaque Round', () => {
    for (const id of ['faille-du-warp', 'portail-magique']) {
      const mod = findArcanePhenomenonById(id)!.testMods![0];
      expect(mod.drDie).toEqual({ faces: 10, divide: 2, perRound: true });
      expect([mod.dr, mod.drMax]).toEqual([1, 5]);
      // Sans valeur tirée, la borne BASSE fait défaut ; le DR du Round entre par `ArcaneOccurrence.dr`.
      expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id }] })).toBe(1);
      expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id, dr: 4 }] })).toBe(4);
      expect(modDR(mod, 9)).toBe(5);
    }
  });

  it('Grand Vortex : aucun modificateur de Test — il agit sur la Saturation (−1 niveau/an)', () => {
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'grand-vortex' }] })).toBe(0);
    expect(findArcanePhenomenonById('grand-vortex')?.saturation?.levelsPerYear).toBe(-1);
    expect(findSaturationLevelById('corrompue')?.corrupts).toBe(true);
  });

  it('un phénomène inconnu du registre n’apporte RIEN (jamais une exception en plein Test)', () => {
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'phenomene-inexistant' }] })).toBe(0);
  });
});

/** Lieux NOMMÉS du chapitre dont le RAW chiffre l'effet magique (`VDM 14` l.324 / l.353 / l.408). */
describe('sites arcaniques nommés (folios 200-204)', () => {
  beforeEach(() => setRule(RULE, true));
  afterEach(() => resetRule(RULE));

  it('Forge d’Henoth : +2 DR d’Incantation et −2 DR de Focalisation au Domaine du Métal SEUL', () => {
    const env = { phenomena: [{ id: 'forge-d-henoth' }] };
    expect(environmentTestDR(spell('metal'), 'incantation', env)).toBe(2);
    expect(environmentTestDR(spell('metal'), 'focalisation', env)).toBe(-2);
    expect(environmentTestDR(spell('feu'), 'incantation', env)).toBe(0);
    expect(environmentTestDR(spell('feu'), 'focalisation', env)).toBe(0);
  });

  it('Taverne d’Uli : bonus au Feu, borne BASSE +1 par défaut, plafond +3 selon la teneur des débats', () => {
    const mod = findArcanePhenomenonById('taverne-d-uli')?.testMods?.[0];
    expect([mod?.dr, mod?.drMax]).toEqual([1, 3]);
    expect(mod?.maison).toBeTruthy();
    expect(environmentTestDR(spell('feu'), 'incantation', { phenomena: [{ id: 'taverne-d-uli' }] })).toBe(1);
    expect(environmentTestDR(spell('feu'), 'focalisation', { phenomena: [{ id: 'taverne-d-uli', dr: 3 }] })).toBe(3);
    expect(environmentTestDR(spell('metal'), 'incantation', { phenomena: [{ id: 'taverne-d-uli', dr: 3 }] })).toBe(0);
  });

  it('Pierres de Barbaneagra : +2 DR d’Incantation ET de Focalisation au Domaine des Ombres seul', () => {
    const env = { phenomena: [{ id: 'pierres-de-barbaneagra' }] };
    expect(environmentTestDR(spell('ombres'), 'incantation', env)).toBe(2);
    expect(environmentTestDR(spell('ombres'), 'focalisation', env)).toBe(2);
    expect(environmentTestDR(spell('mort'), 'incantation', env)).toBe(0);
  });
});

/**
 * CÂBLAGE réel : le delta ne vaut que s'il atteint `resolveCasting` / `resolveFocus`. Le jet est
 * figé (RNG déterministe), seul le contexte de lieu change — la preuve est le DELTA de DR.
 */
describe('câblage — resolveCasting / castLandProbability / resolveFocus lisent le lieu', () => {
  beforeEach(() => setRule(RULE, true));
  afterEach(() => resetRule(RULE));

  const mk = (p: Partial<Combatant> = {}): Combatant =>
    ({
      id: 'c', label: 'Sujet', kind: 'hero',
      characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 90, sociabilite: 30 },
      wounds: { current: 14, max: 14 }, advantage: 0, conditions: [], movement: 4,
      weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      skills: [{ id: 'langue', spec: 'magick', advances: 5 }, { id: 'focalisation', advances: 5 }],
      talents: [], spells: [], xp: 0,
      ...p,
    } as unknown as Combatant);

  const feu = { id: 's', label: 'Flamme d’essai', ecole: 'Magie des Arcanes', domainId: 'feu', cn: 0, range: null, target: 1, duration: null, damage: 0, desc: '' };
  const lieu = { saturationLevelId: 'elevee', dominantWinds: ['feu'] };

  it('resolveCasting : +1 DR sur le MÊME jet dans une zone Élevée dominée par Aqshy', () => {
    const sansLieu = resolveCasting(mk(), feu, makeRNG(7), 'intermediaire');
    const avecLieu = resolveCasting(mk(), feu, makeRNG(7), 'intermediaire', false, 0, {}, {}, lieu);
    expect(avecLieu.roll).toBe(sansLieu.roll);
    expect(avecLieu.sl - sansLieu.sl).toBe(1);
  });

  it('resolveCasting : l’option DÉSACTIVÉE rend le contexte de lieu inopérant (non-régression)', () => {
    resetRule(RULE);
    const sansLieu = resolveCasting(mk(), feu, makeRNG(7), 'intermediaire');
    const avecLieu = resolveCasting(mk(), feu, makeRNG(7), 'intermediaire', false, 0, {}, {}, lieu);
    expect(avecLieu.sl).toBe(sansLieu.sl);
  });

  it('castLandProbability reste le MIROIR de resolveCasting : elle lit le même lieu', () => {
    const spellNI = { ...feu, cn: 2 };
    expect(castLandProbability(mk(), spellNI, false, {}, lieu)).toBeGreaterThan(castLandProbability(mk(), spellNI, false, {}));
  });

  it('resolveFocus : le lieu entre dans le DR de Focalisation', () => {
    const sansLieu = resolveFocus(mk(), feu, makeRNG(7));
    const avecLieu = resolveFocus(mk(), feu, makeRNG(7), 'intermediaire', false, 0, {}, lieu);
    expect(avecLieu.roll).toBe(sansLieu.roll);
    expect(avecLieu.dr - sansLieu.dr).toBe(1);
  });
});
