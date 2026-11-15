/**
 * L'OFFRE DE L'ÉTABLISSEMENT (#4277 B2b) : la qualité et les offres d'auberge d'un établissement d'hébergement ont UN
 * porteur, `PlaceService.rest`, résolu une fois à l'ouverture du repos et porté par `PendingRest` : couchages, pitances,
 * prix (`prixDeLOffre`) et risque (`risquesDesOffres`) le lisent là. ACE 02 l.99 ; LDB 66 l.5, l.12-16, l.28
 */
import { describe, it, expect } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { emptyScene } from './monde/scene';
import type { MapPlace, OffreDAuberge, WorldMap } from './worldMap';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { appariementEnChambres, couchagesDeLaNuit, foodOptions, partsDuRepos, prixDeLOffre } from './restFlow';
import { toBrass } from '../engine/money';
import { seedBattleRng } from './battleRng';
import { ensureBourse, setBourseBrass } from '../engine/bourse';
import { stepPrecision } from './rollSeam';
import { diseaseLabel } from '../data';
import { t } from '../i18n';
import loupEtSaumure from '../scenes/loup-et-saumure/loup-et-saumure-projet.json';

const ACE = { book: 'altdorf-couronne-de-l-empire', page: 31, note: 'ACE 02 l.99' };
/** L'asile de nuit de Miriam : chambre commune 5 sc (vérole urticante 5 %), repas 3 sc (courante galopante 5 %). ACE 02 l.99 */
const ASILE: OffreDAuberge[] = [
  { id: 'commune', prix: { brass: 5 }, risque: { maladie: { id: 'verole-urticante' }, pourcent: 5 }, source: ACE },
  { id: 'repas', prix: { brass: 3 }, risque: { maladie: { id: 'courante-galopante' }, pourcent: 5 }, source: ACE },
];

let banc: Banc;
const g = () => banc.getState();

/** Le groupe au lieu dont l'unique établissement est `service`, le repos de cet établissement ouvert. */
function reposA(service: NonNullable<MapPlace['services']>[number]): void {
  resetSceneRegistry();
  banc = ouvrirLeBanc();
  const place = emptyScene('place', 6, 6);
  place.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  const carte: WorldMap = { id: 'carte', label: 'Carte', routes: [], places: [{ id: 'bourg', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: { id: 'place' }, services: [service] }] };
  g().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest).map((h) => { const b = ensureBourse(h, idsDeTest); setBourseBrass(b, 1000, idsDeTest); return b; }));
  g().chargerLeProjet({ scenes: [place], entryId: 'place', worldMap: carte, projet: null });
  g().ouvrirLeLieu();
  g().ouvrirLeRepos(service.id);
}
const nuit = () => g().pendingRest!;
const vivants = () => g().party.filter((h) => !h.dead);

describe('l’asile de nuit (ACE 02 l.99)', () => {
  it('offre ses seuls couchages et pitances, la salle commune par défaut, aucune chambre', () => {
    reposA({ id: 'asile', kind: { id: 'auberge' }, rest: { offres: ASILE } });
    const [h] = vivants();
    expect(couchagesDeLaNuit(nuit(), g().party, h.id).map((c) => c.id)).toEqual(['commune', 'dehors']);
    expect(foodOptions(nuit(), h).filter((f) => f !== 'ration')).toEqual(['repas', 'rien']);
    expect(vivants().map((x) => nuit().perHero[x.id].lodging)).toEqual(vivants().map(() => 'commune'));
  });

  it('chaque offre se paie à son prix, sans facteur de qualité', () => {
    reposA({ id: 'asile', kind: { id: 'auberge' }, rest: { quality: 'grande', offres: ASILE } });
    const [h] = vivants();
    g().fenetreChoisir('repos', 'pitance', 'repas', h.id);
    expect(toBrass(partsDuRepos(nuit(), g().party)[h.id])).toBe(5 + 3);
  });

  it('dormir joue le risque de chaque offre pour qui la prend, et pour lui seul', () => {
    const certain = ASILE.map((o) => ({ ...o, risque: { ...o.risque!, pourcent: 100 } }));
    reposA({ id: 'asile', kind: { id: 'auberge' }, rest: { offres: certain } });
    const [preneur, ...autres] = vivants();
    g().fenetreChoisir('repos', 'pitance', 'repas', preneur.id);
    for (const a of autres) {
      g().fenetreChoisir('repos', 'couchage', 'dehors', a.id);
      g().fenetreChoisir('repos', 'pitance', 'rien', a.id);
    }
    seedBattleRng(4277);
    g().fenetreValider('repos');
    const contagions = g().pendingCascade!.participants.filter((s) => s.kind === 'contagion').map((s) => [s.actorId, s.label]);
    expect(contagions.map(([id]) => id)).toEqual([preneur.id, preneur.id]);
    expect(contagions.map(([, l]) => l)).toEqual([stepPrecision(t('step.contagion'), diseaseLabel('courante-galopante')), stepPrecision(t('step.contagion'), diseaseLabel('verole-urticante'))]);
  });

  /** L'asile au risque certain : un preneur qui ne règle que `reglage`, les autres dehors et sans pitance ; les
   *  contagions de la nuit, par héros. */
  function contagionsDuPreneur(reglage: { couchage: 'commune' | 'dehors'; pitance: 'repas' | 'rien' }) {
    const certain = ASILE.map((o) => ({ ...o, risque: { ...o.risque!, pourcent: 100 } }));
    reposA({ id: 'asile', kind: { id: 'auberge' }, rest: { offres: certain } });
    const [preneur, ...autres] = vivants();
    g().fenetreChoisir('repos', 'couchage', reglage.couchage, preneur.id);
    g().fenetreChoisir('repos', 'pitance', reglage.pitance, preneur.id);
    for (const a of autres) {
      g().fenetreChoisir('repos', 'couchage', 'dehors', a.id);
      g().fenetreChoisir('repos', 'pitance', 'rien', a.id);
    }
    seedBattleRng(4277);
    g().fenetreValider('repos');
    return g().pendingCascade!.participants.filter((s) => s.kind === 'contagion').map((s) => [s.actorId, s.label]);
  }

  it('la salle commune sans repas n’expose qu’à la vérole urticante', () => {
    const contagions = contagionsDuPreneur({ couchage: 'commune', pitance: 'rien' });
    expect(contagions).toEqual([[vivants()[0].id, stepPrecision(t('step.contagion'), diseaseLabel('verole-urticante'))]]);
  });

  it('le repas sans salle commune n’expose qu’à la courante galopante', () => {
    const contagions = contagionsDuPreneur({ couchage: 'dehors', pitance: 'repas' });
    expect(contagions).toEqual([[vivants()[0].id, stepPrecision(t('step.contagion'), diseaseLabel('courante-galopante'))]]);
  });
});

describe('le couchage par défaut d’un établissement (#4277)', () => {
  it.each([[['commune', 'grande']], [['grande', 'commune']]] as const)('ne dépend pas de l’ordre des offres %j : la grande chambre de troupe', (ids) => {
    reposA({ id: 'auberge', kind: { id: 'auberge' }, rest: { offres: ids.map((id) => ({ id, source: ACE })) } });
    const enGrandeChambre = appariementEnChambres(vivants(), 'grande');
    expect(vivants().map((h) => nuit().perHero[h.id].lodging)).toEqual(vivants().map((h) => enGrandeChambre[h.id]));
  });
});

describe('une auberge de grande qualité (LDB 66 l.5)', () => {
  it('chambre et repas au double du livre', () => {
    reposA({ id: 'auberge', kind: { id: 'auberge' }, rest: { quality: 'grande' } });
    const [a, b] = vivants();
    for (const h of [a, b]) g().fenetreChoisir('repos', 'pitance', 'repas', h.id);
    expect(nuit().perHero[a.id].lodging).toBe(nuit().perHero[b.id].lodging);
    const chambre = toBrass(prixDeLOffre({ id: 'chambre' }, 'normale'));
    const repas = toBrass(prixDeLOffre({ id: 'repas' }, 'normale'));
    const parts = partsDuRepos(nuit(), g().party);
    expect(toBrass(parts[a.id]) + toBrass(parts[b.id])).toBe(2 * chambre + 2 * 2 * repas);
  });
});

describe('un établissement d’hébergement sans `rest` (#4277 B1)', () => {
  it('ouvre le repos avec les offres du livre, en chambres', () => {
    reposA({ id: 'auberge', kind: { id: 'auberge' } });
    expect(nuit().offres.map((o) => o.id)).toEqual(['commune', 'chambre', 'grande', 'repas']);
    expect(nuit().perHero[vivants()[0].id].lodging).toBe('chambre-1');
  });

  const auberges = loupEtSaumure.worldMap.places.flatMap((p) => (p.services ?? []).filter((s) => s.kind.id === 'auberge').map((s) => [p.id, s] as const));
  it('« Le Loup et la Saumure » déclare deux auberges', () => {
    expect(auberges.map(([lieu]) => lieu)).toEqual(['salzenmund', 'erengrad']);
  });
  it.each(auberges)('l’auberge de %s ouvre le repos avec l’offre par défaut', (_lieu, auberge) => {
    reposA({ ...auberge, kind: { id: 'auberge' } });
    expect(nuit().offres.map((o) => o.id)).toEqual(['commune', 'chambre', 'grande', 'repas']);
  });
});
