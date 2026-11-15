/**
 * Les chambres de la nuit à l'auberge : une chambre loge 2 invités, une grande chambre 4 au double du prix, la chambre
 * se dérive du couchage de chaque dormeur et le verbe de choix refuse une chambre pleine. LDB 66 l.5, l.13, l.28
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { chambresDuRepos, restCost, restServicePrice } from './restFlow';
import type { QualiteDeRepos } from '../data/schemas/grammaire/valeurs';
import { refusDuChoix } from './choixDeFenetre';
import { emptyScene } from './monde/scene';
import { fixtureText } from '../i18n/fixtureText';
import { t } from '../i18n';
import { toBrass } from '../engine/money';
import type { Combatant } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const heros = (id: string): Combatant =>
  (blessuresSurLeProfil({
    id, label: id, kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(12, 12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], movement: 4,
  }) as Combatant);

/** La nuit à l'auberge du groupe `ids` (`morts` tombés), chacun sans repas : seule la chambre se paie. */
function nuitALAuberge(ids: string[], opts: { quality?: QualiteDeRepos; days?: number; morts?: string[] } = {}): void {
  const party = ids.map((id) => ({ ...heros(id), ...(opts.morts?.includes(id) ? { dead: true } : {}) }));
  banc.setState({ party, battle: null, pendingRest: null, scene: emptyScene('scene-test', 10, 10) });
  banc.getState().offrirLeRepos({ lieu: fixtureText('Ici'), places: { auberge: true }, quality: opts.quality, days: opts.days });
  for (const id of Object.keys(banc.getState().pendingRest!.perHero)) banc.getState().fenetreChoisir('repos', 'pitance', 'rien', id);
}
const chambres = () => chambresDuRepos(banc.getState().pendingRest!, banc.getState().party);
const note = () => toBrass(restCost(banc.getState().pendingRest!, banc.getState().party));
const chambrePrivee = () => toBrass(restServicePrice('privee'));

describe('chambres de la nuit (LDB 66 l.28)', () => {
  it('à 4 héros, le défaut apparie le groupe dans son ordre : 2 chambres, 20/-', () => {
    nuitALAuberge(['a', 'b', 'c', 'd']);
    expect(chambres().map((c) => [c.id, c.occupants])).toEqual([['chambre-1', ['a', 'b']], ['chambre-2', ['c', 'd']]]);
    expect(note()).toBe(2 * chambrePrivee());
    expect(note()).toBe(240);
  });

  it('tous en grande chambre : 1 chambre, 4 occupants, 20/-', () => {
    nuitALAuberge(['a', 'b', 'c', 'd']);
    for (const id of ['a', 'b', 'c', 'd']) banc.getState().fenetreChoisir('repos', 'couchage', 'grande-1', id);
    expect(chambres().map((c) => [c.id, c.offre, c.occupants])).toEqual([['grande-1', 'grande', ['a', 'b', 'c', 'd']]]);
    expect(note()).toBe(240);
  });

  it('à 3 héros, le troisième qui vise la chambre pleine est refusé par le verbe de choix', () => {
    nuitALAuberge(['a', 'b', 'c']);
    expect(banc.getState().pendingRest!.perHero.c.lodging).toBe('chambre-2');
    expect(refusDuChoix(banc.getState(), 'repos', 'couchage', 'chambre-1', 'c')).toBe(t('rf.chambrePleine'));
    banc.getState().fenetreChoisir('repos', 'couchage', 'chambre-1', 'c');
    expect(banc.getState().pendingRest!.perHero.c.lodging).toBe('chambre-2');
    expect(chambres().find((c) => c.id === 'chambre-1')!.occupants).toEqual(['a', 'b']);
  });

  it('un héros qui quitte sa chambre pour la salle commune n’y figure plus', () => {
    nuitALAuberge(['a', 'b']);
    banc.getState().fenetreChoisir('repos', 'couchage', 'commune', 'b');
    expect(chambres().map((c) => [c.id, c.occupants])).toEqual([['chambre-1', ['a']]]);
  });

  it('à 5 héros, le cinquième qui vise la grande chambre pleine est refusé par le verbe de choix', () => {
    nuitALAuberge(['a', 'b', 'c', 'd', 'e']);
    for (const id of ['a', 'b', 'c', 'd']) banc.getState().fenetreChoisir('repos', 'couchage', 'grande-1', id);
    expect(refusDuChoix(banc.getState(), 'repos', 'couchage', 'grande-1', 'e')).toBe(t('rf.chambrePleine'));
    banc.getState().fenetreChoisir('repos', 'couchage', 'grande-1', 'e');
    expect(banc.getState().pendingRest!.perHero.e.lodging).toBe('chambre-3');
    expect(chambres().find((c) => c.id === 'grande-1')!.occupants).toEqual(['a', 'b', 'c', 'd']);
  });

  it('une grande chambre à un seul occupant se paie entière : 20/-', () => {
    nuitALAuberge(['a']);
    banc.getState().fenetreChoisir('repos', 'couchage', 'grande-1', 'a');
    expect(note()).toBe(240);
  });

  it('une chambre de grande qualité sur 3 jours : le double, par nuit, 60/-', () => {
    nuitALAuberge(['a', 'b'], { quality: 'grande', days: 3 });
    expect(chambres().map((c) => [c.id, c.occupants])).toEqual([['chambre-1', ['a', 'b']]]);
    expect(note()).toBe(720);
  });

  it('un héros mort n’entre pas dans l’appariement par défaut : les vivants s’apparient dans leur ordre', () => {
    nuitALAuberge(['a', 'b', 'c'], { morts: ['b'] });
    expect(Object.keys(banc.getState().pendingRest!.perHero)).toEqual(['a', 'c']);
    expect(chambres().map((c) => [c.id, c.occupants])).toEqual([['chambre-1', ['a', 'c']]]);
  });

  it('un id qui n’est pas un couchage offert est refusé par le verbe de choix', () => {
    nuitALAuberge(['a', 'b']);
    expect(refusDuChoix(banc.getState(), 'repos', 'couchage', 'chambre-x', 'a')).toBe(t('choix.refus.valeur'));
  });
});
