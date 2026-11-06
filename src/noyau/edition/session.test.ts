/**
 * La session d'édition (#3508) : la couche éditée suit l'historique (annuler l'ajout d'une couche ramène au rez), un
 * geste du pointeur s'arrête au changement d'outil ou de couche, le pinceau choisi quitte le rectangle, et
 * l'enregistrement au dépôt ne tient la scène pour enregistrée qu'à l'écriture réussie ; la volée se trace case à
 * case, se pose par son plan (`planStairFlight`) sur un cran, et son tracé s'efface avec la couche ; l'inspecteur écrit
 * sur l'arête sélectionnée, `null` retirant un champ, sans cran quand rien ne change, et son brouillon tombe avec la
 * sélection.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, heightAt, type Scene } from '../monde/scene';
import { buildScene, type MapSpec } from '../mapSpec';
import { editer, ouvrirLEdition, planDeLaVolee, sceneEditee, type GesteDEdition, type SessionDEdition } from './session';
import { segmentDeLaSelection } from '../sceneEditLecture';

const ouverteSur = (scene: Scene, duDepot = false): SessionDEdition => ouvrirLEdition({ scenes: [scene] } as unknown as Parameters<typeof ouvrirLEdition>[0], duDepot);
const ouverte = (duDepot = false): SessionDEdition => ouverteSur(emptyScene('session', 4, 4), duDepot);
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

  it('la volée : tracée case à case (repasser retire), posée par son plan sur un cran, refusée sans plan ; la couche change, le tracé s’efface', () => {
    // Foyer coté 1 m (F), trois cases de volée (E), galerie cotée 4 m (G) sur la couche 1.
    const scene = buildScene({
      id: 's', label: 'S', size: [4, 3], terrain: 'mur',
      levels: { z0: ['....', 'FEEE', '....'].join('\n'), z1: ['...G', '....', '....'].join('\n') },
      elevate: { F: 1, G: 4 }, legend: { F: 'pave', G: 'pierre', E: 'pierre' },
    } as MapSpec);
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    let s = jouer(ouverteSur(scene), { geste: 'outil', outil: { mode: 'stair', toZ: 1 } }, { geste: 'appui', point: point(1, 1) }, { geste: 'glisse', point: point(2, 1) });
    expect(jouer(s, { geste: 'poserVolee' }), 'deux cases ne franchissent pas 3 m').toBe(s);
    expect(planDeLaVolee(s)).toMatchObject({ ok: false });
    s = jouer(s, { geste: 'glisse', point: point(3, 1) }, { geste: 'relache', point: point(3, 1) });
    expect(s.volee).toEqual([{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }]);
    expect(sceneEditee(s), 'le tracé n’écrit rien').toBe(scene);
    const posee = jouer(s, { geste: 'poserVolee' });
    expect([1, 2, 3].map((x) => heightAt(sceneEditee(posee), x, 1, 0))).toEqual([2, 3, 4]);
    expect([posee.volee, sceneEditee(jouer(posee, { geste: 'annuler' }))]).toEqual([[], scene]);
    expect(jouer(s, { geste: 'appui', point: point(2, 1) }).volee, 'repasser sur une case la retire').toEqual([{ x: 1, y: 1 }, { x: 3, y: 1 }]);
    expect(jouer(s, { geste: 'effacerVolee' }).volee).toEqual([]);
    expect(jouer(s, { geste: 'couche', z: 0 }).volee).toEqual([]);
  });

  it('l’inspecteur : écrit sur l’arête sélectionnée et la garde, null retire, rien ne change sans cran ; le brouillon tombe avec la sélection ; supprimer', () => {
    const auNord = { case: { x: 1, y: 1 }, f: { x: 1, y: 0.6 } };
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const choisie = jouer(ouverte(), { geste: 'outil', outil: { mode: 'wall', paint: 'wall' } }, { geste: 'appui', point: auNord }, { geste: 'relache', point: auNord },
      { geste: 'outil', outil: { mode: 'select' } }, { geste: 'appui', point: auNord }, { geste: 'relache', point: auNord });
    const arete = (s: SessionDEdition) => segmentDeLaSelection(sceneEditee(s), s.sel);
    expect(arete(choisie)).toMatchObject({ x: 1, y: 1, side: 'N' });
    expect(jouer(choisie, { geste: 'arete', patch: { door: null } }), 'une cloison le reste : rien à écrire').toBe(choisie);
    const porte = jouer(choisie, { geste: 'arete', patch: { door: true, closed: true } });
    expect([arete(porte)?.door, arete(porte)?.closed, porte.historique.passe.length]).toEqual([true, true, choisie.historique.passe.length + 1]);
    expect(arete(jouer(porte, { geste: 'arete', patch: { closed: null } }))?.closed).toBeUndefined();
    const brouillon = jouer(porte, { geste: 'arete', brouillon: { secret: { face: 'porteuse' } } });
    expect([brouillon.brouillon, sceneEditee(brouillon)]).toEqual([{ secret: { face: 'porteuse' } }, sceneEditee(porte)]);
    expect(jouer(brouillon, { geste: 'appui', point: point(2, 2) }).brouillon, 'une autre sélection le lève').toBeNull();
    const supprimee = jouer(porte, { geste: 'supprimer' });
    expect([supprimee.sel, sceneEditee(supprimee).walls ?? []]).toEqual([null, []]);
  });
});
