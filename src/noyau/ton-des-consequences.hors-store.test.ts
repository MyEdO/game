/**
 * LE TON d'une conséquence d'étape, posé à sa NAISSANCE (#4574, #349) : une conséquence appliquée prend le ton du
 * premier fait de SON application (`tonnerLApplication`) avant d'être versée parmi des lignes authorées ; le goulot
 * (`commitStep`) ne déduit plus rien. Et une application rend UNE entrée par ligne, jamais une ligne jointe.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { applyOps } from '../engine/ops';
import { absorberDans, type Applique } from '../engine/faits';
import { ligneDeTexte } from '../engine/journal';
import { desDuTest } from '../engine/dice.testkit';
import { startCascade, advanceCascade, type CascadeApplier } from './cascade';
import { tonDuFait, tonnerLApplication } from './recapLine';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import type { CascadeStep } from './pendings';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Valide l'étape d'affichage `kind`, suivie d'une étape qui garde la séquence ouverte, et rend l'étape validée. */
function validee(kind: string): CascadeStep {
  const g = banc.getState;
  startCascade(g, banc.setState, { title: 'T', purpose: 'test', steps: [
    { id: 'e', kind: cleDeFixture(kind), label: fixtureText('e') },
    { id: 'suite', kind: cleDeFixture('garde'), label: fixtureText('suite') },
  ] });
  advanceCascade(g, banc.setState);
  const etape = g().pendingCascade!.participants[0];
  expect(etape.committed, 'l’étape est validée').toBe(true);
  return etape;
}

describe('le ton d’une conséquence d’étape naît avec son application (#4574)', () => {
  let appliquee: Applique;
  beforeEach(() => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Brawn', seed: 1 });
    banc.setState({ battle: null, pendingCascade: null, suspendedCascades: [], journal: [], party: [h] });
    const appliers: Record<string, CascadeApplier> = {
      // Une ligne AUTHORÉE sans ton, puis une conséquence appliquée (Exténué) versée derrière elle.
      authoreePuisFait: () => {
        const applique: Applique = { lignes: [ligneDeTexte('Brawn tient son poste.')], faits: [] };
        appliquee = tonnerLApplication(applyOps(banc.getState().party[0], [{ op: 'condition', id: { id: 'extenue' }, value: 1 }], { idNeuf: idsDeTest, rng: desDuTest }));
        absorberDans(applique, appliquee);
        return { applique };
      },
      // L'étape qui suit : la séquence reste ouverte, l'étape validée se lit au slot.
      garde: () => {},
      // Une application à DEUX lignes : une Blessure, puis un Avantage.
      deuxLignes: () => ({ applique: tonnerLApplication(applyOps(banc.getState().party[0], [{ op: 'wounds', amount: 1 }, { op: 'gainAdvantage', amount: 1 }], { idNeuf: idsDeTest, rng: desDuTest })) }),
    };
    avecLesTables({ appliers });
  });

  it('l’entrée authorée reste sans ton, celle du fait porte le ton de son fait — sur l’étape et au journal', () => {
    const etape = validee('authoreePuisFait');
    expect(appliquee.faits.length, 'l’application porte son fait').toBeGreaterThan(0);
    const [authoree, ...duFait] = etape.outcome!.map((l) => l.entree);
    expect(authoree).toEqual({ sorte: 'ligne', texte: 'Brawn tient son poste.' });
    expect(duFait.length).toBeGreaterThan(0);
    expect(duFait.map((e) => e.ton)).toEqual(duFait.map(() => tonDuFait(appliquee.faits[0])));
    expect(banc.getState().journal.slice(-etape.outcome!.length)).toEqual(etape.outcome!.map((l) => l.entree));
  });

  it('une application à deux lignes rend deux entrées, jamais une ligne jointe', () => {
    const etape = validee('deuxLignes');
    expect(etape.outcome!.map((l) => l.entree.texte)).toEqual(['Brawn subit 1 Blessure(s) (ignorant BE et PA).', 'Brawn gagne 1 Avantage.']);
  });
});
