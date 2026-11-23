/**
 * LES CONSÉQUENCES EN VUE (#4574 lot 3) : l'étape de cascade garde les faits que son jet a appliqués à côté de
 * leur lecture (`outcome`), et la rangée du jet les publie (`LigneDeJet.consequences`) — ton vu du groupe, rien
 * avant la révélation du jet figé d'une étape opposée.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { recueillirLesRumeurs } from './innFlow';
import { seedBattleRng } from './battleRng';
import { imposerLesD100 } from './battleRng.testkit';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { buildScene } from './mapSpec';
import type { WorldMap } from './worldMap';
import { jetsEnVue } from './jetsEnVue';
import { projeter, rendreLaVue } from '../hoteTexte/vue';
import type { CascadeStep } from './pendings';
import { evaluateTest } from '../engine/tests';
import { fixtureText } from '../i18n/fixtureText';
import { buildWeatherResistanceSteps } from './travelPostes';
import { cascadeDeTest } from './cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
afterEach(() => { vi.restoreAllMocks(); });
const get = () => banc.getState();

const CARTE: WorldMap = {
  id: 'm', label: 'Le Reik',
  places: [{ id: 'A', label: 'Auberge du Cerf', pos: { x: 0, y: 0 }, scene: { id: 'auberge-a' }, services: [{ id: 'cerf', kind: { id: 'auberge' } }] }],
  routes: [],
};

/** Les rumeurs d'auberge ratées (EDOC 8 l.133), par « Tout résoudre » : l'étape validée, la cascade à son bilan. */
function rumeursRatees(): CascadeStep {
  seedBattleRng(42);
  get().fixerLeGroupe([createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', seed: 11, id: 'h-artur' })]);
  get().chargerLeProjet({ scenes: [buildScene({ id: 'auberge-a', label: 'Auberge du Cerf', desc: '.', size: [8, 6], terrain: 'planches', heroStart: [2, 3] })], entryId: 'auberge-a', worldMap: CARTE, projet: null });
  recueillirLesRumeurs(get, banc.setState, 'cerf');
  imposerLesD100(100);
  get().jetLancer('cascade');
  return get().pendingCascade!.participants[0];
}

describe('une étape de cascade garde ses faits appliqués', () => {
  it('l’Exténué des rumeurs ratées : son fait et sa ligne, posés ensemble à la validation', () => {
    const etape = rumeursRatees();
    expect(etape.faits).toEqual([{ genre: 'etat', cible: 'h-artur', camp: 'groupe', id: 'extenue', valeur: 1 }]);
    expect(etape.outcome?.map((l) => [l.text, l.tone])).toContainEqual(['Artur reçoit 1 État Exténué.', 'echec']);
  });

  it('la rangée du jet publie la conséquence, ton vu des héros', () => {
    rumeursRatees();
    const [jet] = jetsEnVue(get());
    expect(jet.lignes[0].consequences).toEqual([{ genre: 'etat', valeur: 1, qui: 'h-artur', ton: 'echec', detail: { id: 'extenue' } }]);
  });

  it('l’hôte texte lit la conséquence sur la ligne du jet', () => {
    rumeursRatees();
    expect(rendreLaVue(projeter(get(), 0, 0)).find((l) => l.startsWith('jet cascade :'))).toMatch(/ ⇒ h-artur etat extenue \+1$/);
  });

  it('une étape opposée dont le jet figé n’est pas révélé ne publie aucune conséquence', () => {
    const etape = rumeursRatees();
    const p = get().pendingCascade!;
    const fige = { ...evaluateTest(40, 50), base: 50 };
    const opposee = (result: CascadeStep['result']): CascadeStep => ({ ...etape, result, meta: { ...etape.meta, opposed: { aT: fige, attackerId: 'adversaire', attackerName: fixtureText('Adversaire') } } });
    const enVue = (step: CascadeStep) => jetsEnVue({ ...get(), pendingCascade: { ...p, participants: [step] } }).flatMap((j) => j.lignes);
    expect(enVue(opposee(etape.result)).find((l) => l.consequences), 'révélé : la conséquence se publie').toBeDefined();
    expect(enVue(opposee(null)).some((l) => l.consequences), 'non révélé : aucune conséquence').toBe(false);
  });
});

describe('une rangée de bande garde ses faits appliqués', () => {
  it('la Résistance de traversée ratée (EDOC 8 l.86) : le fait sur sa rangée, publié par la ligne de la rangée', () => {
    seedBattleRng(42);
    get().fixerLeGroupe([createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'marchand', label: 'Artur', motivation: 'x', seed: 11, id: 'h-artur' })]);
    banc.setState({ pendingCascade: cascadeDeTest(buildWeatherResistanceSteps(get, 'neige'), { title: 'Traversée', icon: 'repos/froid' }) });
    imposerLesD100(100);
    get().jetLancer('cascade');
    const [rangee] = get().pendingCascade!.participants[0].participants!;
    expect(rangee.faits).toEqual([{ genre: 'etat', cible: 'h-artur', camp: 'groupe', id: 'extenue', valeur: 1 }]);
    const [jet] = jetsEnVue(get());
    expect(jet.lignes[0].consequences).toEqual([{ genre: 'etat', valeur: 1, qui: 'h-artur', ton: 'echec', detail: { id: 'extenue' } }]);
  });
});
