/**
 * LE MENEUR A UNE SEULE DÉFINITION (#1362, lot L1a), côté web : le regard de première personne (`povActive`) et le
 * jeton de groupe que dessine l'écran suivent le cap du GROUPE, pas l'id du meneur. Le reste se joue au banc du noyau
 * (`src/noyau/meneur-unique.hors-store.test.ts`).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { useGame } from './store';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import { rotateDir8 } from '../geometry/dir8';
import { CAP_GROUPE, capDuGroupe, meneurDuMonde } from '../noyau/monde/combatants';
import { partyTokenOf } from '../gameIso/builders/tokens';
import { tokenChromes } from '../gameIso/builders/tokenChrome';
import { combatantRingDecor } from '../gameIso/builders/dynamicMarks';
import type { Combatant } from '../engine/types';
import { poserLeGroupe } from '../noyau/marcheDuGroupe';
import { combattantDeTest, blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { engage } from '../noyau/creation/engagement.testkit';

const TABLE = 'table-ronde-4-tabourets';
const PROP = 'table-1';
/** Table en (5,5) au cap N : abord nord déclaré en (5,4). */
const ABORD_NORD = { x: 5, y: 4 };

const hero = (id: string, wounds: number, talents: { talentId: string; times: number }[] = []): Combatant =>
  combattantDeTest({
    id,
    label: id.toUpperCase(),
    kind: 'heros',
    species: 'humains-reiklander',
    xp: 0,
    wounds: blessuresDeBase(12, wounds),
    conditions: [],
    movement: 4,
    talents,
  });

/** Le cap que le regard de première personne rend — même lecture que `MondeDeCampagne` (`capPov`). */
const capPov = () => { const s = useGame.getState(); return s.povActive ? capDuGroupe(s) : null; };

function scèneDeTaverne(): Scene {
  const s = emptyScene('scene-test', 12, 12);
  s.id = 'taverne';
  s.entities = [
    { id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } },
    { id: PROP, kind: 'prop', pos: { x: 5, y: 5 }, decor: { id: TABLE }, facing: 'N', usable: { assise: true } },
  ];
  return s;
}

function poser(party: Combatant[], sc: Scene, pos?: { x: number; y: number }) {
  useGame.setState({ party, scene: null, mode: 'exploration', journal: [], battle: null, dialogue: null, pendingInteract: null });
  useGame.getState().lancerLaScene(sc);
  if (pos) useGame.setState({ partyPos: { ...pos } });
}

describe('changer de meneur ne change QUE le meneur — le cap n’est keyé par aucun héros', () => {
  const povInitial = useGame.getState().povActive;
  afterEach(() => useGame.setState({ povActive: povInitial })); // magasin PARTAGÉ : remis à sa valeur

  /** Le groupe entre, pivote deux fois (regard hors du cap d'entrée), PUIS le roster mute. */
  function entrerPuisPivoter() {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.setState({ povActive: true });
    useGame.getState().pivoterLeGroupe(1);
    useGame.getState().pivoterLeGroupe(1);
  }

  it('le premier du roster tombe à 0 Blessure : le cap et le POV ne BOUGENT pas', () => {
    entrerPuisPivoter();
    expect(meneurDuMonde(useGame.getState())?.id).toBe('a');
    const capAvant = capPov();
    expect(capAvant).not.toBeNull();

    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }) : h)) }));

    expect(meneurDuMonde(useGame.getState())?.id, 'le meneur a bien changé').toBe('b');
    expect(capPov(), 'le regard ne saute pas au sud par défaut').toBe(capAvant);
  });

  it('le premier du roster devient INCONSCIENT : même continuité', () => {
    entrerPuisPivoter();
    const capAvant = capPov();
    useGame.setState((s) => ({
      party: s.party.map((h) => (h.id === 'a' ? ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] } as unknown as Combatant) : h)),
    }));
    expect(meneurDuMonde(useGame.getState())?.id).toBe('b');
    expect(capPov()).toBe(capAvant);
  });

  it('REMPLACEMENT du meneur par un héros d’id NEUF (`remplacerLeHeros`) : cap intact', () => {
    entrerPuisPivoter();
    const capAvant = capPov();
    useGame.getState().remplacerLeHeros('a', engage('a2'));
    expect(meneurDuMonde(useGame.getState())?.id).toBe('a2');
    expect(capPov(), 'aucun id de héros ne keye le cap : le remplacement ne le perd pas').toBe(capAvant);
  });

  it('AJOUT d’un héros (`recruterLeHeros`) puis chute des précédents : cap intact', () => {
    entrerPuisPivoter();
    const capAvant = capPov();
    useGame.getState().recruterLeHeros(engage('c'));
    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'c' ? h : blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }))) }));
    expect(meneurDuMonde(useGame.getState())?.id).toBe('c');
    expect(capPov()).toBe(capAvant);
  });

  it('le pivot SUIVANT repart du cap courant, pas du défaut sud', () => {
    entrerPuisPivoter();
    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }) : h)) }));
    const capAvant = capPov()!;
    useGame.getState().pivoterLeGroupe(1);
    expect(capPov()).toBe(rotateDir8(capAvant, 1));
  });
});

/**
 * CÂBLAGE DU RENDU — le SEUL lecteur qui dessine le cap du jeton de groupe : le disque de la vue du
 * dessus (la marque de `tokenChromes`, dont `TokenDisc` lit la `capKey`). Mesuré sur la CHAÎNE que
 * l'écran monte : gestes RÉELS du store → `partyTokenOf` → `tokenChromes`.
 */
describe('le RENDU du jeton de groupe lit la clé de cap PUBLIÉE, pas l’id du meneur', () => {
  /** La chaîne de l'écran, depuis l'état courant. */
  const rendu = () => {
    const s = useGame.getState();
    const jeton = partyTokenOf(s.scene!, meneurDuMonde(s), s.partyPos, s.party.map((h) => h.id))!;
    const marques = tokenChromes([], { ghostIds: new Set<string>(), hoveredId: null }, jeton);
    const marque = marques[marques.length - 1];
    return { marque, capLuParLeDisque: s.facing[marque.capKey] };
  };

  it('PIVOTS : le disque sert le cap du GROUPE', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivoterLeGroupe(1);
    useGame.getState().pivoterLeGroupe(1);
    const cap = capDuGroupe(useGame.getState());
    const { marque, capLuParLeDisque } = rendu();
    expect(marque.capKey, 'la marque du disque s’abonne à la clé de GROUPE').toBe(CAP_GROUPE);
    expect(capLuParLeDisque).toBe(cap);
    expect(marque.id, 'l’IDENTITÉ du jeton reste celle du meneur : bus, chrome et caméra la suivent').toBe('a');
  });

  it('MARCHE : le pas oriente ce que le disque lit', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), { x: 2, y: 2 });
    poserLeGroupe(useGame.getState, useGame.setState, { x: 3, y: 2 });
    expect(rendu().capLuParLeDisque, 'un pas vers l’est').toBe('E');
  });

  it('CHANGEMENT DE MENEUR : l’identité du jeton change, le regard NON', () => {
    poser([hero('a', 12), hero('b', 12)], scèneDeTaverne(), ABORD_NORD);
    useGame.getState().pivoterLeGroupe(1);
    const avant = rendu();
    useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 } }) : h)) }));
    const apres = rendu();
    expect(apres.marque.id, 'le jeton est le nouveau meneur').toBe('b');
    expect(apres.capLuParLeDisque, 'le disque ne saute pas au sud').toBe(avant.capLuParLeDisque);
    expect(apres.marque.capKey).toBe(CAP_GROUPE);
    const population = useGame.getState().party;
    expect(apres.marque.team).toEqual(combatantRingDecor(population[1], population.map((h) => h.id), population));
  });
});

