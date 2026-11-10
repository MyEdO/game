import { describe, it, expect } from 'vitest';
import { revealClue, discreditClue, poserLEpingle, marquerVus, estNouveauPour, type ClueState, type IndiceAffiché } from './clues';
import { IND, IND_MONO, affichés } from './clues.fixture';

describe('clues — helpers PURS (#670, mécanique maison)', () => {
  it('revealClue sur un indice absent : pose le PREMIER stade, historique à une entrée, statut révélé', () => {
    const out = revealClue({}, IND, 100);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'revele', épinglé: undefined, historique: [{ stade: 's1', at: 100 }] });
  });

  it('revealClue avec un stade explicite ultérieur : avance stadeCourant, ajoute une entrée d’historique', () => {
    const first = revealClue({}, IND, 100);
    const second = revealClue(first, IND, 200, 's2');
    expect(second['ind-lettre'].stadeCourant).toBe('s2');
    expect(second['ind-lettre'].historique).toEqual([{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }]);
  });

  it('revealClue ré-appelé sur le même stade courant : idempotent (pas de doublon d’historique)', () => {
    const first = revealClue({}, IND, 100);
    const again = revealClue(first, IND, 150);
    expect(again).toBe(first); // sans stade explicite et indice déjà présent → no-op
    const sameStade = revealClue(first, IND, 150, 's1');
    expect(sameStade['ind-lettre'].historique).toHaveLength(1);
  });

  it('revealClue sur un stade ANTÉRIEUR pas encore lu : l’ajoute à l’historique, garde le stade le plus avancé', () => {
    const avancé = revealClue({}, IND, 100, 's2');
    const out = revealClue(avancé, IND, 200, 's1');
    expect(out['ind-lettre']).toEqual<ClueState>({
      stadeCourant: 's2', statut: 'revele', épinglé: undefined,
      historique: [{ stade: 's2', at: 100 }, { stade: 's1', at: 200 }],
    });
  });

  it('revealClue sur un stade ANTÉRIEUR déjà lu, indice révélé : même Record (pas de recul, pas de doublon)', () => {
    const lu = revealClue(revealClue({}, IND, 100), IND, 200, 's2');
    expect(revealClue(lu, IND, 300, 's1')).toBe(lu);
  });

  it('revealClue sur un stade ANTÉRIEUR déjà lu, indice réfuté : réactivé au stade courant, historique inchangé', () => {
    const réfuté = discreditClue(revealClue(revealClue({}, IND, 100), IND, 200, 's2'), IND, 250);
    const out = revealClue(marquerVus(réfuté, affichés(réfuté, ['ind-lettre']), 0), IND, 300, 's1');
    expect(out['ind-lettre']).toEqual<ClueState>({
      stadeCourant: 's2', statut: 'revele', épinglé: undefined,
      historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }],
    });
  });

  it('revealClue : stadeCourant en retard sur un stade déjà lu → remis au plus avancé, sans doublon d’historique', () => {
    const hérité: Record<string, ClueState> = {
      'ind-lettre': { stadeCourant: 's1', statut: 'revele', historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }] },
    };
    expect(revealClue(hérité, IND, 300, 's2')['ind-lettre']).toEqual<ClueState>({
      stadeCourant: 's2', statut: 'revele', épinglé: undefined,
      historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }],
    });
  });

  it('revealClue avec un stade inconnu : no-op (authoring fautif, ne casse pas le jeu)', () => {
    const out = revealClue({}, IND, 100, 'stade-inconnu');
    expect(out).toEqual({});
  });

  it('revealClue ré-active une piste précédemment réfutée (garde l’historique)', () => {
    const discredited = discreditClue({}, IND, 100);
    expect(discredited['ind-lettre'].statut).toBe('refute');
    const revived = revealClue(discredited, IND, 200, 's2');
    expect(revived['ind-lettre'].statut).toBe('revele');
    expect(revived['ind-lettre'].historique).toEqual([{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }]);
  });

  it('revealClue résurrecte un indice réfuté au MÊME stade (mono-stade) — statut repasse révélé', () => {
    const revealed = revealClue({}, IND_MONO, 100);
    const discredited = discreditClue(revealed, IND_MONO, 200);
    expect(discredited['ind-mono'].statut).toBe('refute');
    const revived = revealClue(discredited, IND_MONO, 300);
    expect(revived['ind-mono'].statut).toBe('revele');
    expect(revived['ind-mono'].stadeCourant).toBe('unique');
    expect(revived['ind-mono'].historique).toEqual([{ stade: 'unique', at: 100 }]); // pas de doublon
    // ré-appeler revealClue sur un indice DÉJÀ révélé au même stade : vrai no-op (Record identique).
    const noop = revealClue(revived, IND_MONO, 400);
    expect(noop).toBe(revived);
  });

  it('discreditClue sur un indice PRÉSENT : passe réfuté, garde stadeCourant/historique/épinglé', () => {
    const revealed = revealClue({}, IND, 100);
    const pinned = poserLEpingle(revealed, 'ind-lettre', true);
    const out = discreditClue(pinned, IND, 300);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'refute', épinglé: true, historique: [{ stade: 's1', at: 100 }] });
  });

  it('discreditClue sur un indice ABSENT : créé d’abord révélé à son premier stade, puis réfuté (relisible)', () => {
    const out = discreditClue({}, IND, 100);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'refute', historique: [{ stade: 's1', at: 100 }] });
  });

  it('discreditClue sur un indice DÉJÀ réfuté : vrai no-op (Record identique, pas de re-journalisation)', () => {
    const discredited = discreditClue({}, IND, 100);
    const again = discreditClue(discredited, IND, 200);
    expect(again).toBe(discredited);
  });

  it('poserLEpingle pose la valeur absolue sur un indice présent, no-op sur un indice absent', () => {
    const revealed = revealClue({}, IND, 100);
    const pinned = poserLEpingle(revealed, 'ind-lettre', true);
    expect(pinned['ind-lettre'].épinglé).toBe(true);
    expect(poserLEpingle(pinned, 'ind-lettre', true), 'déjà épinglé : Record identique').toBe(pinned);
    const unpinned = poserLEpingle(pinned, 'ind-lettre', false);
    expect(unpinned['ind-lettre'].épinglé).toBe(false);
    expect(poserLEpingle(revealed, 'ind-lettre', false), 'jamais épinglé : Record identique').toBe(revealed);
    const absent = poserLEpingle({}, 'ind-inconnu', true);
    expect(absent).toEqual({});
  });
});

describe('clues — nouveauté vue PAR SIÈGE (#2415)', () => {
  /** L'indice tel que le siège 0 l'a déjà affiché au carnet. */
  const lu = (clues: Record<string, ClueState>, id: string) => marquerVus(clues, affichés(clues, [id]), 0);

  it('un indice NEUF est nouveau pour tout siège', () => {
    const c = revealClue({}, IND, 100)['ind-lettre'];
    expect(estNouveauPour(c, 0)).toBe(true);
    expect(estNouveauPour(c, 1)).toBe(true);
  });

  it('marquerVus marque le SEUL siège nommé : l’autre voit encore la nouveauté', () => {
    const neuf = revealClue({}, IND, 100);
    const c = marquerVus(neuf, affichés(neuf, ['ind-lettre']), 1)['ind-lettre'];
    expect(c.vuParSiège).toEqual({ 1: true });
    expect(estNouveauPour(c, 1)).toBe(false);
    expect(estNouveauPour(c, 0)).toBe(true);
  });

  it('revealClue RETIRE `vuParSiège` quand l’indice AVANCE d’un stade', () => {
    const avancé = revealClue(lu(revealClue({}, IND, 100), 'ind-lettre'), IND, 200, 's2');
    expect(avancé['ind-lettre'].vuParSiège).toBeUndefined();
  });

  it('revealClue RETIRE `vuParSiège` sur une piste écartée, déjà vue, qui est RÉACTIVÉE', () => {
    const écartéeLue = lu(discreditClue(revealClue({}, IND_MONO, 100), IND_MONO, 200), 'ind-mono');
    expect(écartéeLue['ind-mono'].vuParSiège).toEqual({ 0: true });
    expect(revealClue(écartéeLue, IND_MONO, 300)['ind-mono'].vuParSiège).toBeUndefined();
  });

  it('discreditClue RETIRE `vuParSiège` d’un indice déjà vu', () => {
    const réfuté = discreditClue(lu(revealClue({}, IND, 100), 'ind-lettre'), IND, 200);
    expect(réfuté['ind-lettre'].statut).toBe('refute');
    expect(réfuté['ind-lettre'].vuParSiège).toBeUndefined();
  });

  it('revealClue sans changement (déjà révélé au stade cible) : même Record, `vuParSiège` gardé', () => {
    const luAvant = lu(revealClue({}, IND, 100), 'ind-lettre');
    const again = revealClue(luAvant, IND, 150, 's1');
    expect(again).toBe(luAvant);
    expect(again['ind-lettre'].vuParSiège).toEqual({ 0: true });
  });

  it('marquerVus marque les seuls indices nommés, et garde le reste de l’état', () => {
    const deux = revealClue(revealClue({}, IND, 100), IND_MONO, 100);
    const out = marquerVus(deux, affichés(deux, ['ind-lettre']), 0);
    expect(out['ind-lettre']).toEqual<ClueState>({ stadeCourant: 's1', statut: 'revele', épinglé: undefined, historique: [{ stade: 's1', at: 100 }], vuParSiège: { 0: true } });
    expect(out['ind-mono'].vuParSiège).toBeUndefined();
  });

  it('marquerVus déjà posé pour ce siège (ou id inconnu) : même Record', () => {
    const luAvant = lu(revealClue({}, IND, 100), 'ind-lettre');
    const inconnu: IndiceAffiché = { id: 'ind-inconnu', étapes: 1, statut: 'revele', stadeCourant: 's1' };
    expect(marquerVus(luAvant, [...affichés(luAvant, ['ind-lettre']), inconnu], 0)).toBe(luAvant);
  });

  it('marquerVus ignore un indice qui a CHANGÉ depuis son affichage (stade avancé, statut basculé)', () => {
    const s1 = revealClue({}, IND, 100);
    const vuÀS1 = affichés(s1, ['ind-lettre']);
    const s2 = revealClue(s1, IND, 200, 's2');
    expect(marquerVus(s2, vuÀS1, 1), 'stade avancé depuis l’affichage').toBe(s2);
    const réfuté = discreditClue(s1, IND, 200);
    expect(marquerVus(réfuté, vuÀS1, 1), 'statut basculé depuis l’affichage').toBe(réfuté);
  });

  it('marquerVus ignore un indice dont seul `stadeCourant` a remonté depuis son affichage (historique et statut identiques)', () => {
    const enRetard: Record<string, ClueState> = {
      'ind-lettre': { stadeCourant: 's1', statut: 'revele', historique: [{ stade: 's1', at: 100 }, { stade: 's2', at: 200 }] },
    };
    const vuEnRetard = affichés(enRetard, ['ind-lettre']);
    const remonté = revealClue(enRetard, IND, 300, 's2');
    expect(remonté['ind-lettre'].stadeCourant, 'témoin : revealClue a remonté le stade courant').toBe('s2');
    expect(remonté['ind-lettre'].historique, 'témoin : même historique').toHaveLength(2);
    expect(remonté['ind-lettre'].statut, 'témoin : même statut').toBe('revele');
    expect(estNouveauPour(marquerVus(remonté, vuEnRetard, 1)['ind-lettre'], 1), 's2 courant marqué vu sur l’affichage de s1').toBe(true);
  });

  it('poserLEpingle (geste du joueur) garde `vuParSiège`', () => {
    const épinglé = poserLEpingle(lu(revealClue({}, IND, 100), 'ind-lettre'), 'ind-lettre', true);
    expect(épinglé['ind-lettre'].épinglé).toBe(true);
    expect(épinglé['ind-lettre'].vuParSiège).toEqual({ 0: true });
  });
});
