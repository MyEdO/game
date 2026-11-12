import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyMiscast } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade, draineCascade } from './cascade.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Colère des dieux / Incantation Imparfaite — D'ABORD une étape à TABLE (le dé du Tableau, poussé
// inconditionnellement, #1426), PUIS la révélation en étape d'affichage de la MÊME séquence : c'est
// elle qui porte l'identité Colère/Imparfaite (label/icon), jamais le titre de cascade. Hors cascade
// d'incantation (ces tests appellent `applyMiscast` à nu), la séquence d'accueil est celle en vol,
// sinon celle de l'arène en combat (`miscastPurpose`).
describe('Miscast en séquence (store)', () => {
  function battle() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    return {
      hero: b.combatants.find((c) => c.kind === 'heros')!,
      enemy: b.combatants.find((c) => c.kind === 'ennemi')!,
    };
  }

  it('une Colère des dieux d’un HÉROS ouvre une séquence (étape d’affichage)', () => {
    banc.getState().ensemencerLeTirage(2);
    const { hero } = battle();
    banc.setState({ pendingCascade: null });
    applyMiscast(banc.getState, banc.setState, hero, 'colere');
    const ouverte = banc.getState().pendingCascade;
    expect(ouverte?.purpose).toBe('combat');
    expect(ouverte?.participants[0].kind, 'le dé du Tableau est une étape, pas un tirage à l’appel').toBe('tableDIncantationImparfaite');
    avanceEtapeCascade(banc.getState); // le dé tombe au rang de son étape → la révélation suit
    const revelation = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'incantationImparfaite');
    expect(revelation?.label).toBe('Colère des dieux'); // identité sur l'ÉTAPE, pas le titre de cascade
    expect(revelation?.outcome?.length ?? revelation?.reveal?.lines.length).toBeGreaterThan(0);
  });

  it('une Incantation Imparfaite Mineure d’un HÉROS ouvre une séquence', () => {
    banc.getState().ensemencerLeTirage(2);
    const { hero } = battle();
    banc.setState({ pendingCascade: null });
    applyMiscast(banc.getState, banc.setState, hero, 'mineure');
    expect(banc.getState().pendingCascade?.purpose).toBe('combat');
    expect(banc.getState().pendingCascade?.participants[0].kind).toBe('tableDIncantationImparfaite');
    avanceEtapeCascade(banc.getState);
    const revelation = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'incantationImparfaite');
    expect(revelation?.label).toBe('Imparfaite'); // identité Imparfaite sur l'ÉTAPE
  });

  it('une Maladresse d’un ENNEMI : étape résolue D’OFFICE par le socle, et AUCUNE révélation', () => {
    banc.getState().ensemencerLeTirage(2);
    const { enemy } = battle();
    banc.setState({ pendingCascade: null });
    applyMiscast(banc.getState, banc.setState, enemy, 'colere');
    // Aucun siège ne tient cet ennemi : sa table naît tirée (`cascade.poserLeCurseur`).
    const st = banc.getState().pendingCascade!.participants[0];
    expect(st.kind).toBe('tableDIncantationImparfaite');
    expect(st.table!.result, 'une table sans siège est restée non tirée').toBeTruthy();
    draineCascade(banc.getState);
    // La révélation est réservée aux HÉROS : l'ennemi n'en laisse aucune derrière lui.
    expect(banc.getState().pendingCascade).toBeNull();
  });
});
