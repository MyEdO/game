/**
 * ENTRER À UN POINT D'INTÉRÊT DU LIEU (#3611) : le choix `ecranDuLieu.entrer` désigne un point du plan du lieu où se
 * tient le groupe (`IdDePointDInteret`), le noyau en lit la scène ; l'écran du lieu fermé, un point hors de ses entrées,
 * un autre écran par-dessus ou une scène absente du registre, il refuse et le dit (`refusDuChoix`, `refusDEntrerAuPoint`).
 * L'écran du lieu le projette en geste (`lieuEnVue`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { emptyScene, type Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { lieuEnVue } from './lieuEnVue';
import { DESIGNATIONS } from './designations';
import { t } from '../i18n';

function scene(id: string): Scene {
  const s = emptyScene('scene-test', 6, 6);
  s.id = id;
  s.label = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  return s;
}

const worldMap: WorldMap = {
  id: 'poi-carte', label: 'Carte', routes: [],
  places: [{
    id: 'bourg', label: 'Bourg', pos: { x: 0, y: 0 }, scene: { id: 'poi-place' },
    poi: [
      { id: 'poi-cave', label: 'La cave', pos: { x: 10, y: 10 }, sceneId: { id: 'poi-cave' } },
      { id: 'poi-perdu', label: 'Le puits', pos: { x: 20, y: 20 }, sceneId: { id: 'nulle-part' } },
      { id: 'poi-auberge', label: 'L’auberge', pos: { x: 30, y: 30 }, serviceKind: { id: 'auberge' } },
    ],
  }],
};

let banc: Banc;
const g = () => banc.getState();
const dernier = () => g().journal[g().journal.length - 1];

describe('le choix `ecranDuLieu.entrer`', () => {
  beforeEach(() => {
    resetSceneRegistry();
    banc = ouvrirLeBanc();
    g().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest));
    g().chargerLeProjet({ scenes: [scene('poi-place'), scene('poi-cave')], entryId: 'poi-place', worldMap, projet: null });
    g().ouvrirLeLieu();
  });

  it('désigne les points du lieu qui mènent à une scène', () => {
    expect(DESIGNATIONS.IdDePointDInteret.lire(g())).toEqual(['poi-cave', 'poi-perdu']);
  });

  it('l’écran du lieu projette chaque entrée en geste, fermée par sa raison', () => {
    expect(lieuEnVue(g())?.pointsDInteret.map((p) => [p.id, p.geste.geste, p.geste.refus])).toEqual([
      ['poi-cave', { verbe: 'fenetreChoisir', args: ['ecranDuLieu', 'entrer', 'poi-cave'] }, null],
      ['poi-perdu', { verbe: 'fenetreChoisir', args: ['ecranDuLieu', 'entrer', 'poi-perdu'] }, t('lieu.pointSansScene', { poi: 'Le puits' })],
    ]);
  });

  it('entre dans la scène du point et ferme l’écran du lieu', () => {
    g().fenetreChoisir('ecranDuLieu', 'entrer', 'poi-cave');
    expect([g().scene?.id, g().lieuOuvert]).toEqual(['poi-cave', false]);
  });

  it.each([
    ['un id hors des entrées du lieu', 'nulle-part', () => t('choix.refus.valeur')],
    ['un point qui mène à un service, pas à une scène', 'poi-auberge', () => t('choix.refus.valeur')],
    ['un point vers une scène absente du registre', 'poi-perdu', () => t('lieu.pointSansScene', { poi: 'Le puits' })],
  ] as const)('refuse et le dit : %s', (_cas, poi, raison) => {
    g().fenetreChoisir('ecranDuLieu', 'entrer', poi);
    expect([g().scene?.id, g().lieuOuvert, dernier()]).toEqual(['poi-place', true, raison()]);
  });

  it('refuse et le dit l’écran du lieu fermé', () => {
    g().fenetreFermer('ecranDuLieu');
    g().fenetreChoisir('ecranDuLieu', 'entrer', 'poi-cave');
    expect([g().scene?.id, dernier()]).toEqual(['poi-place', t('choix.refus.fermee')]);
  });

  it('refuse et le dit sous un autre écran : la carte du monde ouverte par-dessus', () => {
    banc.setState({ worldMapOpen: true });
    g().fenetreChoisir('ecranDuLieu', 'entrer', 'poi-cave');
    expect([g().scene?.id, g().lieuOuvert, dernier()]).toEqual(['poi-place', true, t('lieu.horsDeLEcran')]);
  });
});
