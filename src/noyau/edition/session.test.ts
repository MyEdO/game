/**
 * La session d'édition (#3508) : la couche éditée suit l'historique (annuler l'ajout d'une couche ramène au rez), un
 * geste du pointeur s'arrête au changement d'outil ou de couche, le pinceau choisi quitte le rectangle, et
 * l'enregistrement au dépôt ne tient la scène pour enregistrée qu'à l'écriture réussie.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene } from '../monde/scene';
import { editer, ouvrirLEdition, sceneEditee, type SessionDEdition } from './session';

const ouverte = (duDepot = false): SessionDEdition => ouvrirLEdition({ scenes: [emptyScene('session', 4, 4)] } as unknown as Parameters<typeof ouvrirLEdition>[0], duDepot);
const point = (x: number, y: number) => ({ case: { x, y }, f: { x, y } });

describe('session d’édition', () => {
  it('ajouter une couche l’édite ; annuler l’ajout ramène au rez, rétablir garde le rez', () => {
    const s = editer(ouverte(), { geste: 'ajouterCouche' });
    expect([s.z, sceneEditee(s).layers.map((l) => l.z)]).toEqual([1, [0, 1]]);
    const annule = editer(s, { geste: 'annuler' });
    expect([annule.z, sceneEditee(annule).layers.map((l) => l.z)]).toEqual([0, [0]]);
    expect(editer(annule, { geste: 'retablir' }).z).toBe(0);
  });

  it('changer d’outil ou de couche arrête le geste en cours', () => {
    let s = editer(ouverte(), { geste: 'outil', outil: { mode: 'tile', terrain: 'pierre' } });
    s = editer(s, { geste: 'rectangle', actif: true });
    s = editer(s, { geste: 'appui', point: point(1, 1) });
    expect(s.geste?.sorte).toBe('rectangle');
    expect(editer(s, { geste: 'outil', outil: { mode: 'select' } }).geste).toBeNull();
    expect(editer(s, { geste: 'couche', z: 0 }).geste).toBeNull();
    expect(editer(s, { geste: 'couche', z: 3 }), 'une couche absente laisse la session').toBe(s);
  });

  it('choisir une taille de pinceau quitte le rectangle', () => {
    const s = editer(editer(ouverte(), { geste: 'rectangle', actif: true }), { geste: 'pinceau', taille: 3 });
    expect([s.pinceau, s.rectangle]).toEqual([3, false]);
  });

  it('enregistrer : hors du dépôt, rien ; au dépôt, la scène n’est enregistrée qu’à l’écriture réussie', () => {
    expect(editer(ouverte(), { geste: 'enregistrer' }).depot).toBeNull();
    const modifiee = editer(ouverte(true), { geste: 'ajouterCouche' });
    const enCours = editer(modifiee, { geste: 'enregistrer' });
    expect(enCours.depot).toEqual({ enregistree: sceneEditee(ouverte(true)), enCours: sceneEditee(modifiee) });
    expect(editer(enCours, { geste: 'enregistrement', reussi: true }).depot).toEqual({ enregistree: sceneEditee(modifiee), enCours: null });
    expect(editer(enCours, { geste: 'enregistrement', reussi: false }).depot).toEqual({ enregistree: sceneEditee(ouverte(true)), enCours: null });
    expect(editer(modifiee, { geste: 'enregistrement', reussi: true }), 'aucun enregistrement en cours').toBe(modifiee);
  });
});
