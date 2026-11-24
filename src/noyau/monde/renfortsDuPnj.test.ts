/**
 * LES RENFORTS D'UN PNJ (#4916) : modèle de carrière, profil de héros et rôle de bête portés sur la fiche d'un profil du
 * bestiaire (`porterAuxRenforts`, au spawn). Profils et entrées FORGÉS, posés au registre (`setDataset`) et rendus :
 * chaque règle s'asserte en écart à la fiche du même profil sans renfort. BNO p.4-5 ; VO l.118, l.256, l.258-300.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { creatures, modelesDePnj, type CreatureData, type ModeleDePnjData } from '../../data';
import { setDataset } from '../../data/overrides';
import { refusDeLEntite } from '../../data/schemas/defs-scenes/scene';
import { spawnEnemy } from './spawn';
import { sourceDuTraitA } from '../../engine/armourBypass';
import { talentMaxById } from '../../engine/acquisitionTalents';
import { effectiveChar } from '../../engine/characteristics';
import { bourseOf } from '../../engine/bourse';
import type { RenfortsDuPnj } from '../../engine/renfortsDuPnj';
import type { Combatant } from '../../engine/types';

const SOURCE = { book: 'bestiaire-non-officiel', page: 4 } as const;

/** Un profil humanoïde : la Sociabilité « – », deux Traits Arme (l'un à argument), une Compétence et un Talent imprimés. */
const PROFIL = {
  id: 'profil-de-renforts', type: 'creatures', label: 'Profil de renforts', title: null, folder: 'Test',
  char: { M: 4, 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 40, agilite: 45, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: null, B: 12 },
  traits: [{ id: 'arme', value: 7 }, { id: 'arme', value: 6, arg: 'griffes', natural: true }],
  optionals: [], skills: [{ id: 'esquive', value: 40 }, { id: 'perception', value: 40 }], talents: [{ id: 'frappe-blessante' }],
  trappings: [], spells: [], source: SOURCE,
} as unknown as CreatureData;
/** Le même profil, au Trait Armure par Localisation. */
const PROFIL_ARMURE = {
  ...PROFIL, id: 'profil-de-renforts-armure', label: 'Profil de renforts armuré',
  traits: [...PROFIL.traits, { id: 'armure', parLocalisation: { tete: 1, brasG: 1, brasD: 1, corps: 2, jambeG: 1, jambeD: 1 } }],
} as unknown as CreatureData;

const ENTREES = [
  {
    id: 'modele-de-test', type: 'modeles-de-pnj', label: 'Modèle de test', kind: 'modele', aussiPour: 'Essai',
    caracteristiques: ['capacite-de-combat', 'initiative', 'agilite', 'sociabilite'],
    competences: [{ id: 'esquive' }, { id: 'corps-a-corps', spec: 'base' }],
    talents: [{ id: 'ambidextre' }, { id: 'lire-ecrire' }, { id: 'beni' }],
    traitsFacultatifs: ['furtif'],
    dotations: [{ id: 'dague' }, { label: 'Serviteur', nature: 'personne' }, { monnaie: 'silver', count: { roll: { n: 3, sides: 1 } } }],
    source: SOURCE,
  },
  {
    id: 'modele-arme-de-test', type: 'modeles-de-pnj', label: 'Modèle armuré de test', kind: 'modele',
    caracteristiques: ['capacite-de-combat', 'initiative', 'agilite', 'force'], competences: [{ id: 'esquive' }], talents: [{ id: 'lire-ecrire' }],
    dotations: [{ id: 'plastron' }], source: SOURCE,
  },
  {
    id: 'heros-de-test', type: 'modeles-de-pnj', label: 'Héros de test', kind: 'heros',
    modificateurs: { 'capacite-de-combat': 15, sociabilite: 10 }, arme: 1, armure: 1, traits: ['champion', 'endurant'], source: { ...SOURCE, page: 5 },
  },
  {
    id: 'bete-de-test', type: 'modeles-de-pnj', label: 'Bête de test', kind: 'bete',
    competence: { id: 'perception' }, bonus: 20, talent: { id: 'fuite' }, source: { ...SOURCE, page: 5 },
  },
  {
    id: 'bete-predatrice-de-test', type: 'modeles-de-pnj', label: 'Bête prédatrice de test', kind: 'bete',
    competence: { id: 'corps-a-corps', spec: 'bagarre' }, bonus: 20, talent: { id: 'frappe-blessante' }, source: { ...SOURCE, page: 5 },
  },
] as unknown as ModeleDePnjData[];

let creaturesAvant: CreatureData[];
let entreesAvant: ModeleDePnjData[];
beforeEach(() => {
  creaturesAvant = [...creatures];
  entreesAvant = [...modelesDePnj];
  setDataset('creatures', [...creaturesAvant, PROFIL, PROFIL_ARMURE]);
  setDataset('modelesDePnj', [...entreesAvant, ...ENTREES]);
});
afterEach(() => {
  setDataset('creatures', creaturesAvant);
  setDataset('modelesDePnj', entreesAvant);
});

const fiche = (renforts?: RenfortsDuPnj, ref = PROFIL.id): Combatant => spawnEnemy({ ref, ...(renforts ? { renforts } : {}) }, 'pnj', { x: 0, y: 0 });
const avances = (c: Combatant, id: string, spec?: string) => c.skills.find((s) => s.id === id && s.spec === spec)?.advances ?? 0;
const fois = (c: Combatant, id: string) => c.talents?.find((t) => t.talentId === id)?.times ?? 0;

describe('modèle de carrière au Niveau N (VO l.118)', () => {
  it('+5×N à ses Caractéristiques, rien à une Caractéristique « – » ; +5×N Augmentations cumulées à ses Compétences', () => {
    const base = fiche();
    const c = fiche({ modele: { id: 'modele-de-test', niveau: 3 } });
    for (const k of ['capacite-de-combat', 'initiative', 'agilite'] as const) expect(c.characteristics[k] - base.characteristics[k], k).toBe(15);
    expect(c.characteristics.sociabilite).toBe(base.characteristics.sociabilite);
    expect(c.characteristics.force).toBe(base.characteristics.force);
    expect(avances(c, 'esquive') - avances(base, 'esquive')).toBe(15);
    expect(avances(c, 'corps-a-corps', 'base')).toBe(15);
  });

  it('chaque Talent acquis N fois, borné par son Maxi ; un Talent sans spécialisation se tient', () => {
    const c = fiche({ modele: { id: 'modele-de-test', niveau: 3 } });
    expect(fois(c, 'ambidextre')).toBe(2);
    expect(fois(c, 'lire-ecrire')).toBe(1);
    expect(c.talents?.find((t) => t.talentId === 'beni')).toMatchObject({ times: 1 });
    expect(fois(fiche({ modele: { id: 'modele-de-test', niveau: 1 } }), 'ambidextre')).toBe(1);
  });

  it('ses Traits sont ceux du profil : ses Traits facultatifs ne sont qu’une suggestion', () => {
    const base = fiche();
    const c = fiche({ modele: { id: 'modele-de-test', niveau: 2 } });
    expect(c.characteristics['capacite-de-combat'] - base.characteristics['capacite-de-combat']).toBe(10);
    expect(c.traits?.filter((t) => !base.traits?.some((b) => b.id === t.id)).map((t) => t.id)).toEqual([]);
  });

  it('ses possessions, ses mentions, et sa bourse, la somme de son dé', () => {
    const c = fiche({ modele: { id: 'modele-de-test', niveau: 1 } });
    expect(c.items?.some((o) => o.trappingId === 'dague')).toBe(true);
    expect(c.mentions).toEqual([{ nature: 'personne', label: 'Serviteur', nombre: 1 }]);
    expect(bourseOf(c)).toEqual({ gold: 0, silver: 3, brass: 0 });
  });
});

describe('profil de héros (VO l.258-300)', () => {
  it('ses modificateurs aux Caractéristiques du profil, rien à une Caractéristique « – »', () => {
    const base = fiche();
    const c = fiche({ heros: 'heros-de-test' });
    expect(c.characteristics['capacite-de-combat'] - base.characteristics['capacite-de-combat']).toBe(15);
    expect(effectiveChar(c, 'sociabilite')).toBe(effectiveChar(base, 'sociabilite'));
  });

  it('+N à chaque Trait Arme, Armure N accordée au profil qui n’en a pas, ses Traits ajoutés', () => {
    const c = fiche({ heros: 'heros-de-test' });
    expect(c.traits?.filter((t) => t.id === 'arme').map((t) => t.value)).toEqual([8, 7]);
    expect(sourceDuTraitA(c, 'corps')?.pa).toBe(1);
    expect(c.traits?.filter((t) => ['champion', 'endurant'].includes(t.id)).map((t) => t.id).sort()).toEqual(['champion', 'endurant']);
    expect(c.wounds.max).toBeGreaterThan(fiche().wounds.max);
  });

  it('+N à chaque Localisation du Trait Armure', () => {
    const c = fiche({ heros: 'heros-de-test' }, PROFIL_ARMURE.id);
    expect(sourceDuTraitA(c, 'tete')?.pa).toBe(2);
    expect(sourceDuTraitA(c, 'corps')?.pa).toBe(3);
  });

  it('sous l’armure portée d’un modèle, le Trait Armure cède', () => {
    const c = fiche({ modele: { id: 'modele-arme-de-test', niveau: 1 }, heros: 'heros-de-test' }, PROFIL_ARMURE.id);
    expect(c.items?.find((o) => o.trappingId === 'plastron')?.equipped).toBe(true);
    expect(sourceDuTraitA(c, 'corps')).toBeUndefined();
  });
});

describe('rôle de bête (VO l.256)', () => {
  it('le bonus à sa Compétence, cumulé ; son Talent à son Maxi', () => {
    const base = fiche();
    const c = fiche({ bete: 'bete-de-test' });
    expect(avances(c, 'perception') - avances(base, 'perception')).toBe(20);
    expect(fois(c, 'fuite')).toBe(talentMaxById(c, 'fuite'));
    expect(fois(c, 'fuite')).toBeGreaterThan(1);
  });

  it('une instance déjà imprimée monte jusqu’au Maxi', () => {
    const c = fiche({ bete: 'bete-predatrice-de-test' });
    expect(fois(fiche(), 'frappe-blessante')).toBe(1);
    expect(fois(c, 'frappe-blessante')).toBe(talentMaxById(c, 'frappe-blessante'));
    expect(avances(c, 'corps-a-corps', 'bagarre')).toBe(20);
  });
});

describe('refus de scène des renforts (`refusDeLEntite`)', () => {
  const pnj = { id: 'pnj', kind: 'personnage', pos: { x: 0, y: 0 } };
  const messages = (ent: object) => refusDeLEntite(ent as Parameters<typeof refusDeLEntite>[0]).map((f) => `${f.chemin.join('.')} : ${f.message}`);

  it('un PNJ du bestiaire à modèle, héros et rôle est admis', () => {
    expect(messages({ ...pnj, creature: { id: PROFIL.id }, modeleDePnj: { 'modele-de-test': 2 }, profilDeHeros: { id: 'heros-de-test' }, roleDeBete: { id: 'bete-de-test' } })).toEqual([]);
  });

  it('des renforts hors d’un profil du Bestiaire, deux modèles, un modèle et des carrières sont refusés', () => {
    const statbloc = { label: 'S', char: {} };
    expect(messages({ ...pnj, statblock: statbloc, profilDeHeros: { id: 'heros-de-test' } })).toEqual([
      'profilDeHeros : les renforts d’un PNJ (modèle de carrière, profil de héros, rôle de bête) partent d’un profil du Bestiaire (« creature »), sans statbloc ni preset',
    ]);
    expect(messages({ ...pnj, creature: { id: PROFIL.id }, modeleDePnj: { 'modele-de-test': 1, 'modele-arme-de-test': 1 } })).toEqual([
      'modeleDePnj : un PNJ suit un modèle de carrière au plus',
    ]);
    expect(messages({ ...pnj, creature: { id: PROFIL.id }, modeleDePnj: { 'modele-de-test': 1 }, carrieres: { soldat: 1 } })).toEqual([
      'modeleDePnj : un modèle de carrière et des carrières s’excluent : un PNJ suit l’un ou les autres',
    ]);
  });
});
