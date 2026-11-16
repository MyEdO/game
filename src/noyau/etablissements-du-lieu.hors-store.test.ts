/**
 * L'IDENTITÉ DE L'ÉTABLISSEMENT (#4277 B1) : un lieu porte plusieurs établissements d'un même type, chacun désigné par
 * son `id` (`PlaceService.id`). Chaque geste du lieu porte l'id de l'établissement : le repos ouvert est celui de
 * l'auberge désignée, son nom et ses offres ; l'échoppe ouverte tient son propre stock (`placeServiceMerchantId`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { resetSceneRegistry } from './monde/registreDesScenes';
import { emptyScene } from './monde/scene';
import { offresDuType, type OffreDAuberge, type WorldMap } from './worldMap';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { lieuEnVue } from './lieuEnVue';
import { DESIGNATIONS } from './designations';
import { t } from '../i18n';

const LITS_MITEUX = [{ id: 'commune', source: { book: 'livre-de-base', page: 302 } }] as const satisfies OffreDAuberge[];

const worldMap: WorldMap = {
  id: 'carte', label: 'Carte', routes: [],
  places: [{
    id: 'bourg', label: 'Ubersreik', pos: { x: 0, y: 0 }, scene: { id: 'place' }, taille: 3,
    services: [
      { id: 'auberge-du-port', kind: { id: 'auberge' }, label: 'Auberge du Port' },
      { id: 'lits-miteux', kind: { id: 'auberge' }, label: 'Les lits miteux', rest: { offres: [...LITS_MITEUX] } },
      { id: 'forge-nord', kind: { id: 'forgeron' }, label: 'Forge du Nord' },
      { id: 'forge-sud', kind: { id: 'forgeron' }, label: 'Forge du Sud' },
    ],
  }],
};

let banc: Banc;
const g = () => banc.getState();
const dernier = () => g().journal[g().journal.length - 1];

/** Le groupe se tient au lieu de la carte `carte`, son écran ouvert. */
function monter(carte: WorldMap = worldMap): void {
  resetSceneRegistry();
  banc = ouvrirLeBanc();
  const place = emptyScene('place', 6, 6);
  place.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  g().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest));
  g().chargerLeProjet({ scenes: [place], entryId: 'place', worldMap: carte, projet: null });
  g().ouvrirLeLieu();
}


describe('deux établissements d’un même type dans un lieu', () => {
  beforeEach(() => monter());

  it('l’écran du lieu les projette chacun, ses gestes portant SON id', () => {
    expect(lieuEnVue(g())?.services.map((s) => [s.id, s.nom, s.gestes.map((x) => [x.geste.verbe, ...x.geste.args])])).toEqual([
      ['auberge-du-port', 'Auberge du Port', [['ouvrirLeRepos', 'auberge-du-port'], ['recueillirLesRumeurs', 'auberge-du-port']]],
      ['lits-miteux', 'Les lits miteux', [['ouvrirLeRepos', 'lits-miteux'], ['recueillirLesRumeurs', 'lits-miteux']]],
      ['forge-nord', 'Forge du Nord', [['ouvrirLaBoutique', 'forge-nord']]],
      ['forge-sud', 'Forge du Sud', [['ouvrirLaBoutique', 'forge-sud']]],
    ]);
  });

  const VERBES_DU_LIEU = [
    ['ouvrirLaBoutique', 'IdDEchoppeDuLieu', ['forge-nord', 'forge-sud'], () => g().merchant !== null],
    ['ouvrirLeRepos', 'IdDHebergementDuLieu', ['auberge-du-port', 'lits-miteux'], () => g().pendingRest !== null],
    ['recueillirLesRumeurs', 'IdDHebergementDuLieu', ['auberge-du-port', 'lits-miteux'], () => g().pendingCascade !== null],
  ] as const;

  it.each(VERBES_DU_LIEU)('`%s` énumère (`%s`) les seuls établissements de son genre', (_verbe, cle, attendus) => {
    expect(DESIGNATIONS[cle].lire(g())).toEqual(attendus);
  });

  it.each(VERBES_DU_LIEU.flatMap(([verbe, cle, , joue]) => worldMap.places[0].services!.map((svc) => [verbe, svc.id, cle, joue] as const)))(
    '`%s` « %s » se joue si et seulement si l’hôte l’énumère (`%s`)',
    (verbe, id, cle, joue) => {
      const enumere = DESIGNATIONS[cle].lire(g()).includes(id);
      g()[verbe](id);
      expect(joue()).toBe(enumere);
    },
  );

  it.each([
    ['auberge-du-port', 'Auberge du Port', offresDuType('auberge')],
    ['lits-miteux', 'Les lits miteux', LITS_MITEUX],
  ])('l’auberge « %s » s’ouvre par son id : le repos porte SON nom et SES offres', (id, nom, offres) => {
    g().ouvrirLeRepos(id);
    expect([g().pendingRest?.lieu, g().pendingRest?.places, g().pendingRest?.offres]).toEqual([nom, { auberge: true }, offres]);
  });

  it('un id qui n’est pas un hébergement du lieu : le repos et les rumeurs sont refusés, et le refus est dit', () => {
    g().ouvrirLeRepos('forge-nord');
    expect([dernier(), g().pendingRest]).toEqual([t('lieu.hebergementInconnu', { service: 'forge-nord' }), null]);
    g().recueillirLesRumeurs('forge-sud');
    expect([dernier(), g().pendingCascade]).toEqual([t('lieu.hebergementInconnu', { service: 'forge-sud' }), null]);
  });

  it('les rumeurs se recueillent à l’auberge désignée', () => {
    g().recueillirLesRumeurs('lits-miteux');
    expect(g().pendingCascade).not.toBeNull();
  });

  it('deux échoppes du même type tiennent deux stocks distincts, chacun à la clé de son établissement', () => {
    g().ouvrirLaBoutique('forge-nord');
    expect(g().merchant?.entityId).toBe('lieu:bourg:forge-nord');
    banc.setState({ merchant: null });
    g().ouvrirLaBoutique('forge-sud');
    expect(g().merchant?.entityId).toBe('lieu:bourg:forge-sud');
    expect(Object.keys(g().merchantStocks).filter((k) => k.startsWith('lieu:bourg:')).sort()).toEqual(['lieu:bourg:forge-nord', 'lieu:bourg:forge-sud']);
  });
});

describe('une auberge sans nom d’auteur', () => {
  const [lieu] = worldMap.places;
  beforeEach(() => monter({ ...worldMap, places: [{ ...lieu, services: [{ id: 'chambres', kind: { id: 'auberge' } }] }] }));

  it('la nuit se passe au lieu, nommé par son libellé', () => {
    g().ouvrirLeRepos('chambres');
    expect(g().pendingRest?.lieu).toBe('Ubersreik');
  });
});
