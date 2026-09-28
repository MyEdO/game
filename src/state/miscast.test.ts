import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyMiscast } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade, draineCascade } from './cascadeTestKit';

// Colère des dieux / Incantation Imparfaite — D'ABORD une étape à TABLE (le dé du Tableau, poussé
// inconditionnellement, #1426), PUIS la révélation en étape d'affichage de la MÊME séquence : c'est
// elle qui porte l'identité Colère/Imparfaite (label/icon), jamais le titre de cascade. Hors cascade
// d'incantation (ces tests appellent `applyMiscast` à nu), la séquence d'accueil est celle en vol,
// sinon celle de l'arène en combat (`miscastPurpose`).
describe('Miscast en séquence (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function battle() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return {
      hero: b.combatants.find((c) => c.kind === 'hero')!,
      enemy: b.combatants.find((c) => c.kind === 'enemy')!,
    };
  }

  it('une Colère des dieux d’un HÉROS ouvre une séquence (étape d’affichage)', () => {
    useGame.getState().seedRng(2);
    const { hero } = battle();
    useGame.setState({ pendingCascade: null });
    applyMiscast(useGame.getState, useGame.setState, hero, 'colere');
    const ouverte = useGame.getState().pendingCascade;
    expect(ouverte?.purpose).toBe('combat');
    expect(ouverte?.participants[0].kind, 'le dé du Tableau est une étape, pas un tirage à l’appel').toBe('miscastTable');
    avanceEtapeCascade(useGame.getState); // le dé tombe au rang de son étape → la révélation suit
    const revelation = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'miscast');
    expect(revelation?.label).toBe('Colère des dieux'); // identité sur l'ÉTAPE, pas le titre de cascade
    expect(revelation?.outcome?.length ?? revelation?.reveal?.lines.length).toBeGreaterThan(0);
  });

  it('une Incantation Imparfaite Mineure d’un HÉROS ouvre une séquence', () => {
    useGame.getState().seedRng(2);
    const { hero } = battle();
    useGame.setState({ pendingCascade: null });
    applyMiscast(useGame.getState, useGame.setState, hero, 'mineure');
    expect(useGame.getState().pendingCascade?.purpose).toBe('combat');
    expect(useGame.getState().pendingCascade?.participants[0].kind).toBe('miscastTable');
    avanceEtapeCascade(useGame.getState);
    const revelation = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'miscast');
    expect(revelation?.label).toBe('Imparfaite'); // identité Imparfaite sur l'ÉTAPE
  });

  it('une Maladresse d’un ENNEMI : étape résolue D’OFFICE par le socle, et AUCUNE révélation', () => {
    useGame.getState().seedRng(2);
    const { enemy } = battle();
    useGame.setState({ pendingCascade: null });
    applyMiscast(useGame.getState, useGame.setState, enemy, 'colere');
    // Aucun siège ne tient cet ennemi : sa table naît tirée (`cascade.poserLeCurseur`).
    const st = useGame.getState().pendingCascade!.participants[0];
    expect(st.kind).toBe('miscastTable');
    expect(st.table!.result, 'une table sans siège est restée non tirée').toBeTruthy();
    draineCascade(useGame.getState);
    // La révélation est réservée aux HÉROS : l'ennemi n'en laisse aucune derrière lui.
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});
