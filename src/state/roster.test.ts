import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad, rosterAdd, rosterRemove, rosterUpdate, rosterExport, rosterImport, RosterEntry } from './roster';
import { Combatant } from '../engine/types';
import { skillBaseValue } from '../engine/skills';
import { findSpellById } from '../data';
import { SORTS_FUSIONNES_1897 } from '../data/sortsFusionnes';
import { FORMAT_DES_CHOIX } from '../engine/character';
import { skillSlots, talentSlotsUpTo } from '../engine/careerSlots';
import { levelsForCareer } from '../data';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const hero = (id: string, label = 'Héros'): Combatant => ({ id, label, kind: 'hero' }) as unknown as Combatant;
const entry = (id: string): RosterEntry => ({
  hero: hero(id),
  wealth: { gold: 1, silver: 2, brass: 3 },
});

describe('roster — persistance des personnages créés', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('vide au départ', () => {
    expect(rosterLoad()).toEqual([]);
  });

  it('rosterAdd puis rosterLoad : le personnage et sa richesse initiale sont retrouvés', () => {
    rosterAdd(entry('h1'));
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h1');
    expect(list[0].wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
  });

  it('rosterAdd avec le même hero.id remplace (pas de doublon)', () => {
    rosterAdd(entry('h1'));
    rosterAdd({ hero: hero('h1', 'Renommé'), wealth: { gold: 0, silver: 0, brass: 9 } });
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.label).toBe('Renommé');
    expect(list[0].wealth.brass).toBe(9);
  });

  it('rosterRemove retire l’entrée visée et garde les autres', () => {
    rosterAdd(entry('h1'));
    rosterAdd(entry('h2'));
    rosterRemove('h1');
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h2');
  });

  it('stockage corrompu (JSON invalide ou pas un tableau) → []', () => {
    localStorage.setItem('wfrp4.roster.v1', '{pas du json');
    expect(rosterLoad()).toEqual([]);
    localStorage.setItem('wfrp4.roster.v1', '{"a":1}');
    expect(rosterLoad()).toEqual([]);
  });

  it('entrées invalides filtrées au chargement', () => {
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([null, 42, { hero: { id: 'ok', name: 'X' }, wealth: { gold: 0, silver: 0, brass: 0 } }, { hero: {} }]),
    );
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('ok');
  });

  it('rosterLoad rejoue la migration name→label (#604) sur une entrée ANCIEN FORMAT (kind présent)', () => {
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([
        { hero: { id: 'legacy1', name: 'Ancien Nom', kind: 'hero' }, wealth: { gold: 0, silver: 0, brass: 0 } },
      ]),
    );
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.label).toBe('Ancien Nom');
    expect((list[0].hero as unknown as { name?: string }).name).toBeUndefined();
  });

  it('rosterLoad ÉCARTE un `draft` sans format (choix en libellés, #1923) : le héros reste, le brouillon ne se relit pas', () => {
    const ancien = { speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Ancien', careerTalent: 'Magie mineure', pettySpells: ['Putréfaction'] };
    const actuel = { v: FORMAT_DES_CHOIX, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Actuel', careerTalent: { id: 'magie-mineure' }, pettySpells: ['putrefaction'] };
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([
        { hero: { id: 'avant', label: 'Héros intact', kind: 'hero' }, wealth: { gold: 0, silver: 0, brass: 0 }, draft: ancien },
        { hero: { id: 'apres', label: 'Héros', kind: 'hero' }, wealth: { gold: 0, silver: 0, brass: 0 }, draft: actuel },
      ]),
    );
    const [avant, apres] = rosterLoad();
    expect(avant.hero.label).toBe('Héros intact');
    expect(avant.draft).toBeUndefined();
    expect(apres.draft).toEqual(actuel);
  });

  it('sans localStorage (environnement sans stockage) : load → [], add/remove ne jettent pas', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(rosterLoad()).toEqual([]);
    expect(() => rosterAdd(entry('h1'))).not.toThrow();
    expect(() => rosterRemove('h1')).not.toThrow();
  });

  it('rosterUpdate : met à jour le héros présent (bio propagée), sans doublon', () => {
    rosterAdd(entry('h1'));
    const edited = { id: 'h1', name: 'Héros', motivation: 'Foi', details: { ambitionShort: 'Survivre', ambitionLong: 'Régner' } } as unknown as Combatant;
    rosterUpdate(edited);
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.motivation).toBe('Foi');
    expect(list[0].hero.details?.ambitionShort).toBe('Survivre');
    expect(list[0].hero.details?.ambitionLong).toBe('Régner');
  });

  it('rosterUpdate : N’AJOUTE PAS un héros absent du roster (prétiré édité)', () => {
    rosterAdd(entry('h1'));
    rosterUpdate(hero('absent'));
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h1');
  });
});

describe('roster — export / import (portabilité, versionné via migrateDoc)', () => {
  it('round-trip v1 valide → entry restituée', () => {
    const back = rosterImport(rosterExport(entry('h1')));
    expect(back.entry).toBeDefined();
    expect(back.entry!.hero.id).toBe('h1');
    expect(back.entry!.wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
  });

  it('richesse par défaut (0) si absente (mais kind/v présents)', () => {
    const str = JSON.stringify({ kind: 'wfrp4-hero', v: 1, hero: { id: 'h3', name: 'X' } });
    expect(rosterImport(str).entry?.wealth).toEqual({ gold: 0, silver: 0, brass: 0 });
  });

  it('sans version/kind (RosterEntry nu) → message explicite, jamais un import silencieux', () => {
    const res = rosterImport(JSON.stringify(entry('h2')));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('version future/inconnue (v99) → message explicite', () => {
    const res = rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 99, hero: { id: 'h4' } }));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('kind différent → message explicite', () => {
    const res = rosterImport(JSON.stringify({ kind: 'autre-chose', v: 1, hero: { id: 'h5' } }));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('erreur (JSON invalide ou hero.id manquant/non-chaîne) → message explicite, jamais null muet', () => {
    expect(rosterImport('pas du json').error).toBeTruthy();
    expect(rosterImport('{}').error).toBeTruthy();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 1, hero: {} })).error).toBeTruthy();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 1, hero: { id: 42 } })).error).toBeTruthy();
  });
});

/** Le lot L2 #1548 renomme `SkillInstance.skillId` → `id` (`engine/types.ts`). Le roster persiste des
 *  `SkillInstance` par DEUX canaux — l'export versionné (`EXPORT_VERSION`) et la liste localStorage nue.
 *  `skillBaseValue` (`engine/skills.ts:153`) ne lit QUE `s.id` : sans remap aux deux canaux, un héros
 *  d'avant le lot repart avec ses Compétences muettes (Caractéristique nue, Augmentations perdues) sans
 *  qu'aucun type ne bronche. Le roster ne se PURGE pas pour autant (l'arbitrage 2026-08-17 est borné aux
 *  saves — `migrateDoc.ts` interdit nommément la purge du roster par imitation) : il MIGRE, comme #311
 *  et #604 avant lui. Témoin : Résistance (Endurance), Endurance 35 + 20 Augmentations = 55. */
describe('roster — remap `skillId`→`id` des Compétences persistées (#1548 L2, les DEUX canaux)', () => {
  const ancienHero = (id: string) => ({
    id,
    label: 'Vétéran d’avant le lot',
    kind: 'hero',
    characteristics: { endurance: 35 },
    skills: [{ skillId: 'resistance', characteristic: 'endurance', advances: 20 }],
    talents: [],
  });

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('(a) un export à l’ANCIENNE graphie CHARGE avec ses Augmentations vivantes — jamais des Compétences muettes', () => {
    const str = JSON.stringify({ kind: 'wfrp4-hero', v: 3, hero: ancienHero('h-export'), wealth: { gold: 0, silver: 0, brass: 0 } });
    const res = rosterImport(str);
    expect(res.error).toBeUndefined();
    const skills = res.entry!.hero.skills as unknown as Record<string, unknown>[];
    expect(skills[0].id).toBe('resistance');
    expect('skillId' in skills[0]).toBe(false); // la graphie morte ne survit pas au remap
    expect(skillBaseValue(res.entry!.hero, 'resistance')).toBe(55); // 35 + 20, jamais 35 muet
  });

  it('(b) une entrée localStorage d’AVANT le lot est remappée à la lecture, les entrées saines intactes', () => {
    const saine = {
      id: 'h-saine',
      label: 'Déjà migré',
      kind: 'hero',
      characteristics: { endurance: 30 },
      skills: [{ id: 'resistance', characteristic: 'endurance', advances: 5 }],
      talents: [],
    };
    localStorage.setItem(
      'wfrp4.roster.v1',
      JSON.stringify([
        { hero: ancienHero('h-prelot'), wealth: { gold: 0, silver: 0, brass: 0 } },
        { hero: saine, wealth: { gold: 1, silver: 0, brass: 0 } },
      ]),
    );
    const list = rosterLoad();
    expect(list.map((e) => e.hero.id)).toEqual(['h-prelot', 'h-saine']); // aucune purge : les deux survivent
    expect(skillBaseValue(list[0].hero, 'resistance')).toBe(55); // remappée
    expect(skillBaseValue(list[1].hero, 'resistance')).toBe(35); // 30 + 5, intacte (le remap est un no-op)
    expect(list[1].wealth).toEqual({ gold: 1, silver: 0, brass: 0 });
  });

  it('le remap est IDEMPOTENT : une 2ᵉ lecture ne change plus rien (et `id` prime si les deux graphies traînent)', () => {
    const deuxGraphies = { ...ancienHero('h-deux'), id: 'h-deux', skills: [{ id: 'resistance', skillId: 'perime', characteristic: 'endurance', advances: 20 }] };
    localStorage.setItem('wfrp4.roster.v1', JSON.stringify([{ hero: deuxGraphies, wealth: { gold: 0, silver: 0, brass: 0 } }]));
    const un = rosterLoad();
    expect((un[0].hero.skills as unknown as Record<string, unknown>[])[0]).toEqual({ id: 'resistance', characteristic: 'endurance', advances: 20 });
    rosterAdd(un[0]); // ré-écrit puis relit : 2e passage
    expect(rosterLoad()[0].hero.skills).toEqual(un[0].hero.skills);
  });
});

/** #1897 : 54 ids de sort du livre fan sont FUSIONNÉS dans l'entrée qui les double (`SORTS_FUSIONNES_1897`).
 *  Un héros exporté ou gardé au roster avant le lot porte l'ancien id : aux DEUX canaux il désigne
 *  l'entrée absorbante, jamais un sort que `findSpellById` ne résout plus. */
describe('roster — ids de sort FUSIONNÉS remappés (#1897, les DEUX canaux)', () => {
  const heros = (id: string) => ({ id, label: 'Apprenti d’avant le lot', kind: 'hero', spells: ['alarme', 'alerte', 'flamme', 'choc'], skills: [], talents: [] });

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('(a) un export v4 CHARGE avec ses sorts vivants, dédoublonnés à la fusion', () => {
    const res = rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 4, hero: heros('h-export'), wealth: { gold: 0, silver: 0, brass: 0 } }));
    expect(res.error).toBeUndefined();
    expect(res.entry!.hero.spells).toEqual(['alerte', 'flamme-magique', 'choc']);
    expect(res.entry!.hero.spells!.every((id) => findSpellById(id))).toBe(true);
  });

  it('(b) une entrée localStorage d’avant le lot est remappée à la lecture, et une 2ᵉ lecture ne change rien', () => {
    localStorage.setItem('wfrp4.roster.v1', JSON.stringify([{ hero: heros('h-prelot'), wealth: { gold: 0, silver: 0, brass: 0 } }]));
    const un = rosterLoad();
    expect(un[0].hero.spells).toEqual(['alerte', 'flamme-magique', 'choc']);
    rosterAdd(un[0]);
    expect(rosterLoad()[0].hero.spells).toEqual(['alerte', 'flamme-magique', 'choc']);
  });

  /** Toutes les places d'un id de sort dans un héros (`Combatant`, `src/engine/types.ts`), chacune
   *  garnie d'un id FUSIONNÉ ; à côté, des chaînes HOMONYMES hors place de sort (`bouclier` objet,
   *  case d'objet `q-objet-bouclier`) qui doivent traverser intactes. */
  const heroAToutesLesPlaces = (id: string) => ({
    id, label: 'Sorcier d’avant le lot', kind: 'hero', skills: [], talents: [],
    spells: ['alarme', 'projectile'],
    componentSpells: ['projectile'],
    focus: { spell: 'projectile', dr: 2 },
    ritual: { spellId: 'alarme', drDone: 0, drTarget: 3 },
    dispel: { spellId: 'alarme', spellCasterId: 'x', total: 1 },
    summon: { byId: 'x', spellId: 'nuee' },
    activeEffects: [{ id: 'e', sourceSpellId: 'soins', spell: { spellId: 'soins', ni: 0, casterId: id, label: 'Soins' } }],
    barre: { capacites: { 0: { actionId: 'lancer-sort', cle: 'sort-projectile' }, 1: { actionId: 'objet', cle: 'q-objet-bouclier' } } },
    items: [{ trappingId: 'bouclier' }],
  });
  const FUSIONNES = Object.keys(SORTS_FUSIONNES_1897).join('|');
  /** Les ids fusionnés qui SURVIVENT dans le héros sérialisé, à une place de sort (`sort-` compris). */
  const survivants = (hero: unknown): string[] =>
    JSON.stringify(hero).match(new RegExp(`"(?:sort-)?(?:${FUSIONNES})"`, 'g'))?.filter((m) => m !== '"bouclier"') ?? [];
  const attendu = {
    spells: ['alerte', 'carreau'],
    componentSpells: ['carreau'],
    focus: { spell: 'carreau', dr: 2 },
    ritual: { spellId: 'alerte', drDone: 0, drTarget: 3 },
    dispel: { spellId: 'alerte', spellCasterId: 'x', total: 1 },
    summon: { byId: 'x', spellId: 'menace-rampante' },
    activeEffects: [{ id: 'e', sourceSpellId: 'benediction-de-guerison', spell: { spellId: 'benediction-de-guerison', ni: 0, casterId: 'h', label: 'Soins' } }],
    barre: { capacites: { 0: { actionId: 'lancer-sort', cle: 'sort-carreau' }, 1: { actionId: 'objet', cle: 'q-objet-bouclier' } } },
    items: [{ trappingId: 'bouclier' }],
  };

  it('(c) un export v4 : AUCUN id fusionné ne survit, à aucune place de sort du héros ; les homonymes hors place traversent', () => {
    const res = rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 4, hero: heroAToutesLesPlaces('h'), wealth: { gold: 0, silver: 0, brass: 0 } }));
    expect(res.error).toBeUndefined();
    expect(survivants(res.entry!.hero)).toEqual([]);
    expect(res.entry!.hero).toMatchObject(attendu);
  });

  it('(d) le repli `rosterLoad` : AUCUN id fusionné ne survit, à aucune place de sort du héros', () => {
    localStorage.setItem('wfrp4.roster.v1', JSON.stringify([{ hero: heroAToutesLesPlaces('h'), wealth: { gold: 0, silver: 0, brass: 0 } }]));
    const [entree] = rosterLoad();
    expect(survivants(entree.hero)).toEqual([]);
    expect(entree.hero).toMatchObject(attendu);
  });
});

describe('roster — clés d’emplacement de carrière en ids (#1924, les DEUX canaux)', () => {
  // Soldat, Niveau 1 : « Musicien (Tambour ou Fifre) », 7e Compétence. Clé d'avant : résumé en libellés.
  const cleEnLibelles = '1:skill:6:Musicien';
  const cleEnIds = () => {
    const levels = levelsForCareer('soldat');
    return [...skillSlots(levels, 4), ...talentSlotsUpTo(levels, 4)].find((s) => s.key.startsWith('1:skill:6:'))!.key;
  };
  const heros = (id: string) => ({ id, label: 'Soldat', kind: 'hero', skills: [], talents: [], careerSlotChoices: { soldat: { [cleEnLibelles]: 'musicien|tambour' } } });

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('la clé d’après résume l’emplacement en ids, jamais en libellés', () => {
    expect(cleEnIds()).toBe('1:skill:6:musicien*');
  });
  it('(a) un export v5 charge avec ses désignations aux clés en ids', () => {
    const res = rosterImport(JSON.stringify({ kind: 'wfrp4-hero', v: 5, hero: heros('h-export'), wealth: { gold: 0, silver: 0, brass: 0 } }));
    expect(res.entry?.hero.careerSlotChoices).toEqual({ soldat: { [cleEnIds()]: 'musicien|tambour' } });
  });
  it('(b) une entrée localStorage d’avant le lot est réécrite à la lecture, et une 2e lecture ne change rien', () => {
    localStorage.setItem('wfrp4.roster.v1', JSON.stringify([{ hero: heros('h-local'), wealth: { gold: 0, silver: 0, brass: 0 } }]));
    const une = rosterLoad();
    expect(une[0].hero.careerSlotChoices).toEqual({ soldat: { [cleEnIds()]: 'musicien|tambour' } });
    localStorage.setItem('wfrp4.roster.v1', JSON.stringify(une));
    expect(rosterLoad()).toEqual(une);
  });
});
