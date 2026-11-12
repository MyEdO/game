/**
 * #3059 — écrivains du narratif qui lisent le projet : unicité (inter-registres, règle globale, dans
 * l'entrée), propagation d'un renommage à toute référence, retrait refusé tant qu'une référence désigne.
 * Chaque résultat : aucune référence pendante (`fautesDeSites`), un narratif qui parse.
 */
import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene } from './monde/scene';
import { emptyNarratif } from './monde/campaignNarratif';
import { porteurDeLId, refusDeRenommage, refusDeRetrait, renommeAuProjet, retireDuProjet, type ProjetEdite } from './narratifEdit';
import { narratifSchema, type NarratifBlock } from '../data/schemas/defs-scenes/narratif';
import { fautesDeSites, sitesDuProjet } from '../data/schemas/defs-scenes/refs-narratives';
import { creatures } from '../data';

const narratif = (): NarratifBlock => ({
  ...emptyNarratif(),
  affaires: [{ id: 'aff', titre: 'La route' }],
  indices: [
    { id: 'ind-lettre', affaireId: 'aff', kind: 'indice', titre: 'La lettre', stades: [{ id: 'lue', prose: 'a' }, { id: 'dechiffree', prose: 'b' }] },
    { id: 'ind-sceau', affaireId: 'aff', kind: 'indice', titre: 'Le sceau', refs: ['ind-lettre'], stades: [{ id: 'vu', prose: 'c' }] },
  ],
  documents: [{ id: 'doc-affiche', titre: 'L’affiche', prose: 'VOYAGEURS' }],
  etats: [{ id: 'humeur', label: 'Humeur', maison: 'fixture', forme: { kind: 'enum', valeurs: [{ id: 'calme', label: 'Calme' }, { id: 'furieux', label: 'Furieux' }] } } as NarratifBlock['etats'][number]],
});
const salle = (): Scene => ({
  ...emptyScene('scene-test', 4, 4),
  id: 'salle', label: 'Le relais',
  triggers: [{
    id: 't0', rect: { x: 0, y: 0, w: 1, h: 1 }, once: true,
    flow: { kind: 'sequence', etapes: [
      { kind: 'effet', effet: { type: 'document', documentId: 'doc-affiche' } },
      { kind: 'effet', effet: { type: 'revealClue', indiceId: 'ind-lettre', stade: 'dechiffree' } },
    ] },
  }],
});
const projet = (): ProjetEdite => ({ scenes: [salle()], worldMap: null, narratif: narratif() });
const effets = (p: ProjetEdite) => (p.scenes[0].triggers[0].flow as { etapes: { effet: unknown }[] }).etapes.map((s) => s.effet);
const sain = (p: ProjetEdite) => {
  expect(fautesDeSites(sitesDuProjet(p), p.narratif), 'référence pendante').toEqual([]);
  expect(narratifSchema.safeParse(p.narratif).success, 'le narratif ne parse pas').toBe(true);
};

describe('unicité d’un id', () => {
  it('nomme le porteur d’un autre registre, la règle globale, une sous-entrée sœur', () => {
    const n = narratif();
    expect(porteurDeLId(n, { registre: 'affaires', id: 'aff' }, 'ind-sceau')).toBe('l\'indice « Le sceau »');
    expect(porteurDeLId(n, { registre: 'affaires', id: 'aff' }, creatures[0].id)).toBe('la règle globale (créature/possession)');
    expect(porteurDeLId(n, { registre: 'indices', id: 'ind-lettre', sous: 'lue' }, 'dechiffree')).toBe('le stade 2');
    expect(porteurDeLId(n, { registre: 'etats', id: 'humeur', sous: 'calme' }, 'furieux')).toBe('la valeur 2');
    expect(porteurDeLId(n, { registre: 'affaires', id: 'aff' }, 'aff')).toBeNull();
  });

  it('refusDeRenommage : vide, déjà porté ; inchangé et libre retenus', () => {
    const n = narratif();
    expect(refusDeRenommage(n, { registre: 'affaires', id: 'aff' }, '  ')).toBe('Identifiant vide');
    expect(refusDeRenommage(n, { registre: 'affaires', id: 'aff' }, 'doc-affiche')).toBe('Identifiant « doc-affiche » déjà porté par le document « L’affiche »');
    expect(refusDeRenommage(n, { registre: 'affaires', id: 'aff' }, 'aff')).toBeNull();
    expect(refusDeRenommage(n, { registre: 'affaires', id: 'aff' }, 'aff-neuve')).toBeNull();
  });
});

describe('renommeAuProjet', () => {
  it('une entrée : propage aux scènes, aux indices rattachés et aux recoupements', () => {
    const p = renommeAuProjet(projet(), { registre: 'indices', id: 'ind-lettre' }, ' ind-missive ');
    expect(p.narratif.indices.map((i) => i.id)).toEqual(['ind-missive', 'ind-sceau']);
    expect(p.narratif.indices[1].refs).toEqual(['ind-missive']);
    expect(effets(p)[1]).toEqual({ type: 'revealClue', indiceId: 'ind-missive', stade: 'dechiffree' });
    sain(p);
    const a = renommeAuProjet(projet(), { registre: 'affaires', id: 'aff' }, 'aff-route');
    expect(a.narratif.indices.map((i) => i.affaireId)).toEqual(['aff-route', 'aff-route']);
    sain(a);
  });

  it('une sous-entrée : stade et valeur, propagés', () => {
    const p = renommeAuProjet(projet(), { registre: 'indices', id: 'ind-lettre', sous: 'dechiffree' }, 'traduite');
    expect(p.narratif.indices[0].stades.map((s) => s.id)).toEqual(['lue', 'traduite']);
    expect(effets(p)[1]).toEqual({ type: 'revealClue', indiceId: 'ind-lettre', stade: 'traduite' });
    sain(p);
    const v = renommeAuProjet(projet(), { registre: 'etats', id: 'humeur', sous: 'calme' }, 'serein');
    expect((v.narratif.etats[0].forme as { valeurs: { id: string }[] }).valeurs.map((x) => x.id)).toEqual(['serein', 'furieux']);
    sain(v);
  });

  it('refusé : projet inchangé (doublon inter-registres, id global, stade sœur, vide)', () => {
    const p = projet();
    expect(renommeAuProjet(p, { registre: 'affaires', id: 'aff' }, 'doc-affiche')).toBe(p);
    expect(renommeAuProjet(p, { registre: 'affaires', id: 'aff' }, creatures[0].id)).toBe(p);
    expect(renommeAuProjet(p, { registre: 'indices', id: 'ind-lettre', sous: 'lue' }, 'dechiffree')).toBe(p);
    expect(renommeAuProjet(p, { registre: 'documents', id: 'doc-affiche' }, '')).toBe(p);
  });
});

describe('retireDuProjet', () => {
  it('une entrée désignée : refusé, la raison nomme le lieu ; projet inchangé', () => {
    const p = projet();
    expect(refusDeRetrait(p, { registre: 'documents', id: 'doc-affiche' })).toBe('Encore désigné par : scène « Le relais » — changez ou retirez ces références d\'abord.');
    expect(retireDuProjet(p, { registre: 'documents', id: 'doc-affiche' })).toBe(p);
    expect(retireDuProjet(p, { registre: 'affaires', id: 'aff' })).toBe(p);
  });

  it('un indice libre : retiré, et ses recoupements avec lui', () => {
    const p = { ...projet(), scenes: [] };
    const out = retireDuProjet(p, { registre: 'indices', id: 'ind-lettre' });
    expect(out.narratif.indices.map((i) => i.id)).toEqual(['ind-sceau']);
    expect(out.narratif.indices[0].refs).toBeUndefined();
    sain(out);
  });

  it('une sous-entrée : la dernière se garde, une désignée se refuse, une libre se retire', () => {
    const p = projet();
    expect(refusDeRetrait(p, { registre: 'indices', id: 'ind-sceau', sous: 'vu' })).toBe('Un indice garde au moins un stade.');
    expect(retireDuProjet(p, { registre: 'indices', id: 'ind-lettre', sous: 'dechiffree' })).toBe(p);
    const out = retireDuProjet(p, { registre: 'indices', id: 'ind-lettre', sous: 'lue' });
    expect(out.narratif.indices[0].stades.map((s) => s.id)).toEqual(['dechiffree']);
    sain(out);
    const v = retireDuProjet(p, { registre: 'etats', id: 'humeur', sous: 'furieux' });
    expect((v.narratif.etats[0].forme as { valeurs: { id: string }[] }).valeurs.map((x) => x.id)).toEqual(['calme']);
    expect(refusDeRetrait(v, { registre: 'etats', id: 'humeur', sous: 'calme' })).toBe('Un état énuméré garde au moins une valeur.');
    sain(v);
  });
});
