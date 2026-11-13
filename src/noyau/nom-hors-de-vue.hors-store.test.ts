/**
 * LE TEXTE DU MOTEUR NE NOMME PAS UN COMBATTANT HORS DE VUE (#4017) : `brancherLeJeu` pose le nommeur (`nomDe`, sur
 * `nomEnVue`). `siege-enceinte` pose au départ des assaillants que la muraille cache au groupe, d'autres qu'il voit.
 */
import { describe, expect, it } from 'vitest';
import { ouvrirLeBanc } from './banc.testkit';
import { frapper } from './coupHorsBataille.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { battleRng } from './battleRng';
import { resolveMelee } from '../engine/combat';
import { lancerLeScenario } from './lancementDeScenario';
import { combattantEnVue } from './visionDuGroupe';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { testScenarios } from '../scenes/test-scenarios/index';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { t } from '../i18n';
import type { Jeu } from './etat';
import type { Combatant } from '../engine/types';

const INCONNU = t('vision.horsDeVue');

/** Le banc sur `siege-enceinte`, le premier héros, un assaillant armé au contact hors de vue et un en vue. */
function siege() {
  const banc = ouvrirLeBanc();
  lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(testScenarios.find((s) => s.id === 'siege-enceinte')!, idsDeTest));
  const etat = banc.getState() as unknown as Jeu;
  const combattants = etat.battle!.combatants;
  const ennemis = combattants.filter((c) => c.kind === 'ennemi' && c.weapons[0]?.type === 'melee');
  return {
    banc,
    heros: combattants.find((c) => c.kind === 'heros')!,
    cache: ennemis.find((c) => !combattantEnVue(etat, c))!,
    vu: ennemis.find((c) => combattantEnVue(etat, c))!,
  };
}

/** Les d100 d'un coup de `attaquant` qui touche `cible` sans la mettre hors de combat ni ouvrir de Critique : la
 *  ligne du coup s'écrit alors au journal à l'application. */
function desDUneTouche(attaquant: Combatant, cible: Combatant): number[] {
  for (let a = 2; a < 100; a += 3) for (let d = 3; d < 100; d += 4) {
    imposerLesD100(a, d);
    const res = resolveMelee(attaquant, cible, attaquant.weapons[0], battleRng());
    if (res.hit && !res.critical && (res.woundsLost ?? 0) > 0 && res.woundsLost! < cible.wounds.current) return [a, d];
  }
  throw new Error(`aucune touche légère de ${attaquant.id} sur ${cible.id}`);
}

/** Le texte du journal du combat du banc. */
const journal = (banc: ReturnType<typeof siege>['banc']): string[] => banc.getState().battle!.log.map((l) => (typeof l === 'string' ? l : l.text));

describe('siege-enceinte — la touche d’un assaillant', () => {
  it('hors de vue : « Inconnu touche … » dans la ligne d’issue et au journal', () => {
    const { banc, heros, cache } = siege();
    expect(cache, 'un assaillant hors de vue').toBeDefined();
    const res = frapper(banc, cache, heros, desDUneTouche(cache, heros), cache.weapons[0]);
    const tete = t('touche.tete', { attaquant: INCONNU, cible: heros.label });
    expect(res.log.startsWith(tete), res.log).toBe(true);
    expect(journal(banc).filter((l) => l.startsWith(tete)), journal(banc).join('\n')).toHaveLength(1);
    expect(journal(banc).filter((l) => l.includes(cache.label)), 'son nom n’est nulle part au journal').toEqual([]);
  });

  it('en vue : son nom', () => {
    const { banc, heros, vu } = siege();
    expect(vu, 'un assaillant en vue').toBeDefined();
    const res = frapper(banc, vu, heros, desDUneTouche(vu, heros), vu.weapons[0]);
    const tete = t('touche.tete', { attaquant: vu.label, cible: heros.label });
    expect(res.log.startsWith(tete), res.log).toBe(true);
    expect(journal(banc).filter((l) => l.startsWith(tete)), journal(banc).join('\n')).toHaveLength(1);
  });
});
