/**
 * Semis des Possessions de dotation au démarrage d'une partie neuve (#617/#618 SOCLE POSSESSIONS
 * Lot 1) — seam `startScene` (`noyau/entreeEnScene.ts`), JAMAIS le chargement (la save restaure `data.possessions`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { chargerSurLeBanc, sauverLeBanc } from './persistance/save.testkit';
import { seedStartingPossessions } from './possessionsFlow';
import { createHero } from '../engine/character';
import { emptyScene } from './monde/scene';
import type { Possession } from '../engine/possession';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';

let banc: Banc;

describe('Semis de Possessions — startScene (#617/#618 Lot 1)', () => {
  beforeEach(() => {
    banc = ouvrirLeBanc();
  });

  it('dotation {vehicleId} (contrebandier niv.2 → barque-fluviale, careerLevels.json) → possession vehicule avec-le-groupe, owner = héros', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'contrebandier', label: 'Contreb.', seed: 1 });
    hero.careerLevel = 2; // la dotation barque-fluviale est portée par ce Niveau, pas le 1
    banc.getState().setParty([hero]);
    const sc = emptyScene('scene-test', 6, 6);
    sc.id = 'test-seed-vehicule';
    banc.getState().startScene(sc);
    const { possessions } = banc.getState();
    const vehicule = possessions.find((p) => p.nature === 'vehicule');
    expect(vehicule).toBeDefined();
    expect(vehicule).toMatchObject({
      nature: 'vehicule', vehicleId: 'barque-fluviale', ownerId: hero.id, location: { kind: 'avec-le-groupe' }, items: [],
    });
  });

  it("héros sans carrière (party fixture nue) → aucun crash, aucune possession semée", () => {
    const lead = combattantDeTest({ id: 'lead', label: 'L', xp: 0 });
    banc.getState().setParty([lead]);
    const sc = emptyScene('scene-test', 5, 5);
    sc.id = 'test-seed-sans-carriere';
    banc.getState().startScene(sc);
    expect(banc.getState().possessions).toHaveLength(0);
  });

  it('loadGame NE redéclenche PAS le semis — la save fait foi, jamais de doublon (#617/#618 §3)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'contrebandier', label: 'Contreb.', seed: 1 });
    hero.careerLevel = 2;
    banc.getState().setParty([hero]);
    const sc = emptyScene('scene-test', 6, 6);
    sc.id = 'test-seed-loadgame';
    banc.getState().startScene(sc);
    expect(banc.getState().possessions).toHaveLength(1); // semé UNE fois par startScene
    banc.abandonner();
    const save = sauverLeBanc(banc);
    // Simule un rechargement (état vidé, groupe reformé) puis le chargement — la save restaure le
    // registre TEL QUEL, aucun re-semis ne doit s'y ajouter.
    banc.setState({ party: [], possessions: [], scene: null });
    chargerSurLeBanc(banc, save);
    expect(banc.getState().possessions).toHaveLength(1);
  });

  it("anti-double-semis : héros ayant DÉJÀ une possession au registre n'est pas re-semé", () => {
    const hero = combattantDeTest({ id: 'h1', career: 'contrebandier', careerLevel: 2 });
    const existing: Possession = {
      uid: 'pos-1', ownerId: 'h1', nature: 'vehicule', vehicleId: 'chariot-leger', location: { kind: 'avec-le-groupe' }, items: [],
    };
    banc.setState({ party: [hero], possessions: [existing], flags: {}, gameTime: 0 });
    seedStartingPossessions(banc.getState, banc.setState);
    expect(banc.getState().possessions).toHaveLength(1); // toujours 1 : aucun 2e semis pour ce héros
  });
});
