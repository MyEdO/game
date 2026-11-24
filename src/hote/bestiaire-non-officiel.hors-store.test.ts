/**
 * Le *Bestiaire non officiel* est un livre de la base commune (#4916, épique #4903 L12) : chacune de ses créatures se
 * pose dans une scène que `validateScene` accepte et se lève en combattant, chacun de ses Traits propres est au
 * catalogue, cité à sa page, ses modèles de carrière, profils de héros et rôles de bête se posent sur un PNJ de scène, et une
 * rencontre contre l'une d'elles se joue jusqu'à son issue.
 */
import { describe, it, expect } from 'vitest';
import { books, creatures, traits } from '../data';
import { buildScene, type EncounterSpec } from '../noyau/mapSpec';
import { validateScene } from '../noyau/validateScene';
import { creatureToCombatant } from '../noyau/monde/spawn';
import { ficheDEntite } from '../noyau/monde/sceneNpc';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import type { Combatant } from '../noyau/index';
import { ouvrirLeLancement } from './partie';
import { jouerLaRencontre } from './rencontre';

const LIVRE = 'bestiaire-non-officiel';
const DU_LIVRE = creatures.filter((c) => c.source.book === LIVRE);
const ORIGINE = { x: 0, y: 0 };

/** La rencontre `id` des créatures `ennemis`, en colonne à l'est de l'arène. */
const rencontre = (id: string, ennemis: readonly string[]): EncounterSpec => ({ id, enemies: ennemis.map((creature, i) => ({ creature: { id: creature }, pos: { x: 11, y: 1 + (i % 6) } })) });

/** Un héros au profil `cc` en Capacité de Combat et de Tir, armé d'une épée bâtarde. */
function heros(id: string, cc: number): Combatant {
  const h = combattantDeTest({ id, label: id, kind: 'heros', characteristics: { 'capacite-de-combat': cc, 'capacite-de-tir': cc, endurance: 40, force: 40 }, fate: 2 });
  h.items = [itemFromTrappingById('epee-batarde', idsDeTest)!];
  recomputeLoadout(h);
  return h;
}

describe('Bestiaire non officiel, livre de la base commune (#4916)', () => {
  it('est au registre des livres, sans extraction', () => {
    const livre = books.find((b) => b.id === LIVRE);
    expect(livre).toMatchObject({ abbr: 'BNO', language: 'VF' });
    expect(livre).not.toHaveProperty('dir');
  });

  it('chaque Trait qu’il imprime est au catalogue, cité à sa page', () => {
    const imprimes = new Set(DU_LIVRE.flatMap((c) => [...c.traits, ...c.optionals]).flatMap((t) => ('id' in t ? [t.id] : [])));
    const propres = traits.filter((t) => t.source.book === LIVRE);
    expect(propres.length).toBeGreaterThan(0);
    for (const t of propres) {
      expect(t.source.page, t.id).toBeGreaterThan(0);
      expect(imprimes.has(t.id), `${t.id} n'est imprimé par aucune créature du livre`).toBe(true);
    }
    for (const id of imprimes) expect(traits.some((t) => t.id === id), id).toBe(true);
  });

  it('chacune de ses créatures, citée à sa page, se pose dans une scène valide et se lève en combattant', () => {
    expect(DU_LIVRE.length).toBeGreaterThan(0);
    for (let i = 0; i < DU_LIVRE.length; i += 6) {
      const lot = DU_LIVRE.slice(i, i + 6);
      const scene = buildScene({ id: `bno-${i}`, label: 'Arène', size: [14, 8], heroStart: [2, 4], encounters: [rencontre('rencontre', lot.map((c) => c.id))] });
      expect(validateScene([scene]).filter((w) => w.level === 'error'), lot.map((c) => c.id).join(', ')).toEqual([]);
    }
    for (const c of DU_LIVRE) {
      expect(c.source.page, c.id).toBeGreaterThan(0);
      const combattant = creatureToCombatant(c, `bno-${c.id}`, ORIGINE);
      expect(combattant.wounds.max, c.id).toBeGreaterThan(0);
    }
  });

  it('un PNJ à modèle de carrière et profil de héros, une bête à rôle, posés en scène, sont valides et se lèvent en combattants', () => {
    const scene = buildScene({ id: 'bno-renforts', label: 'Arène', size: [14, 8], heroStart: [2, 4], encounters: [rencontre('rencontre', ['humain', 'jaguars'])] });
    const [pnj, bete] = scene.entities.filter((e) => e.kind === 'personnage');
    Object.assign(pnj, { modeleDePnj: { 'modele-guerrier': 2 }, profilDeHeros: { id: 'heros-mineur' } });
    Object.assign(bete, { roleDeBete: { id: 'bete-predateur' } });
    expect(validateScene([scene]).filter((w) => w.level === 'error')).toEqual([]);
    expect(ficheDEntite(pnj, () => undefined).porteurDeFiche?.renforts).toEqual({ modele: { id: 'modele-guerrier', niveau: 2 }, heros: 'heros-mineur' });
    expect(ficheDEntite(bete, () => undefined).porteurDeFiche?.renforts).toEqual({ bete: 'bete-predateur' });
  });

  it('une rencontre contre une de ses créatures se joue jusqu’à son issue', () => {
    const o = ouvrirLeLancement({ graine: 1, regles: {}, cadence: 'auto', desFixes: false }, () => ({
      party: [heros('h1', 60), heros('h2', 60)], projet: null, combatDirect: 'rencontre',
      scene: buildScene({ id: 'arene', label: 'Arène', size: [14, 8], terrain: 'herbe', heroStart: [2, 4], ambientLight: 'jour', encounters: [rencontre('rencontre', ['jaguars'])] }),
    }), () => {});
    try {
      const issue = jouerLaRencontre(o, o.lancement);
      expect(['victoire', 'defaite']).toContain(issue.issue);
      expect(o.partie.etat().battle).toBeNull();
    } finally {
      o.partie.fermer();
    }
  });
});
