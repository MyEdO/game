/**
 * La session d'édition (#3508) : la couche éditée suit l'historique (annuler l'ajout d'une couche ramène au rez), un
 * geste du pointeur s'arrête au changement d'outil ou de couche, le pinceau choisi quitte le rectangle, et
 * l'enregistrement au dépôt ne tient la scène pour enregistrée qu'à l'écriture réussie ; la volée se trace case à
 * case, se pose par son plan (`planStairFlight`) sur un cran, et son tracé s'efface avec la couche ; l'inspecteur écrit
 * sur l'arête sélectionnée, `null` retirant un champ, sans cran quand rien ne change, et son brouillon tombe avec la
 * sélection ; les entités se posent, se nomment, s'orientent parmi les caps de leur type, changent de type ou de
 * couche, se copient, se collent sur la case pointée de la couche éditée et se dupliquent sur leur couche ; une entrée
 * se renomme d'un nom libre et change de couche. La scène écrit par ses écrivains dédiés (#3606) sa musique, son
 * message d'introduction, ses ancres de bataille et ses groupes ; une ouverture de façade, son apparence ; un personnage, son inventaire d'auteur,
 * et sa troupe de copies posées en un cran. Une entité écrit au formulaire tiré du schéma de son type (geste `valeur`,
 * porteur `entite`, #3606 M1a) ce qu'il offre, ses options au contexte de sa fiche, et ses fautes croisées sont celles
 * de `refusDeLEntite`.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, heightAt, type Scene } from '../monde/scene';
import { buildScene, type MapSpec } from '../mapSpec';
import { avertissementsDeLaSession, champDuMessage, editer, groupesDuLieu, ouvrirLEdition, planDeLaVolee, sceneEditee, vueDeLaScene, type GesteDEdition, type SessionDEdition } from './session';
import { provenanceDesNavires } from '../planDeNavire';
import { garanti } from '../../lib/garanti';
import { addArchitectureBody, addFacadeFeature, addFacadeSection } from '../sceneEdit';
import { ciblesDAncreDeBataille } from '../massBattleFlow';
import { apparencesDeLOuverture } from '../monde/facades';
import { allMusicDefs } from '../../data/sons/musique';
import { choixDuChamp, entiteDeLaSelection, segmentDeLaSelection } from '../sceneEditLecture';
import { refusDeLaValeur } from './session';
import { refusDeLEntite, sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { findCreatureById, traits } from '../../data';
import { inventaireApres } from '../../engine/items';
import type { Segment } from '../sceneEdit';
import { seatSlotsOf } from '../monde/seating';
import { props } from '../../data';
import { adresseDeCreation } from '../../engine/adresseDeCreation';
import { ficheDEntite } from '../monde/sceneNpc';
import { allBuiltinCampaigns, paquetDuJeu } from '../../scenes/campaign';

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

  it('enregistrer : hors du dépôt, rien ; au dépôt, les scènes ne sont enregistrées qu’à l’écriture réussie', () => {
    expect(editer(ouverte(), { geste: 'enregistrer' }).depot).toBeNull();
    const modifiee = editer(ouverte(true), { geste: 'ajouterCouche' });
    const enCours = editer(modifiee, { geste: 'enregistrer' });
    expect(enCours.depot).toEqual({ enregistrees: [sceneEditee(ouverte(true))], enCours: [sceneEditee(modifiee)] });
    expect(editer(enCours, { geste: 'enregistrement', reussi: true }).depot).toEqual({ enregistrees: [sceneEditee(modifiee)], enCours: null });
    expect(editer(enCours, { geste: 'enregistrement', reussi: false }).depot).toEqual({ enregistrees: [sceneEditee(ouverte(true))], enCours: null });
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

  it('les entités : posées sélectionnées, nommées puis rendues au nom de leur fiche, orientées parmi les caps de leur type, retypées, sur une autre couche', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const [decor, autre] = props;
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entity', kind: 'prop', ref: decor.id } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel);
    expect(ent(pose)).toMatchObject({ kind: 'prop', ref: decor.id, pos: { x: 1, y: 1 }, label: decor.label });
    expect(ent(jouer(pose, { geste: 'nommer', nom: 'Comptoir' }))?.label).toBe('Comptoir');
    expect(ent(jouer(pose, { geste: 'nommer' }))?.label, 'sans nom, il n’en porte plus').toBeUndefined();
    const tourne = jouer(pose, { geste: 'entite', patch: { facing: 'E' } });
    expect([ent(tourne)?.facing, tourne.historique.passe.length]).toEqual(['E', pose.historique.passe.length + 1]);
    expect(jouer(tourne, { geste: 'entite', patch: { facing: 'E' } }), 'rien ne change : aucun cran').toBe(tourne);
    expect(ent(jouer(tourne, { geste: 'entite', patch: { ref: autre.id } })), 'retypé, il garde son cap cardinal').toMatchObject({ ref: autre.id, facing: 'E' });
    const etage = jouer(pose, { geste: 'ajouterCouche' }, { geste: 'couche', z: 0 }, { geste: 'appui', point: point(1, 1) }, { geste: 'entite', patch: { z: 1 } });
    expect(ent(etage)?.z).toBe(1);
    expect(ent(jouer(etage, { geste: 'entite', patch: { z: 0 } }))?.z).toBeUndefined();
  });

  it('copier, coller, dupliquer : la copie se colle sur la case pointée de la couche éditée, la duplication sur la couche de l’entité', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'ajouterCouche' }, { geste: 'outil', outil: { mode: 'entity', kind: 'heroStart' } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel);
    expect(jouer(pose, { geste: 'coller' }), 'rien de copié').toBe(pose);
    const copiee = jouer(pose, { geste: 'copier' });
    expect(copiee.presse).toBe(ent(pose));
    const collee = jouer(copiee, { geste: 'outil', outil: { mode: 'select' } }, { geste: 'appui', point: point(3, 2) }, { geste: 'coller' });
    expect(ent(collee)).toMatchObject({ kind: 'heroStart', pos: { x: 3, y: 2 }, z: 1 });
    expect(ent(collee)?.id).not.toBe(ent(pose)?.id);
    const ailleurs = jouer(copiee, { geste: 'outil', outil: { mode: 'select' } }, { geste: 'appui', point: point(3, 2) }, { geste: 'couche', z: 0 });
    expect(jouer(ailleurs, { geste: 'coller' }), 'la case pointée est sur une autre couche').toBe(ailleurs);
    expect(ent(jouer(pose, { geste: 'dupliquer' }))).toMatchObject({ kind: 'heroStart', pos: { x: 2, y: 2 }, z: 1 });
  });

  it('une entrée : renommée, gardée sélectionnée ; un nom vide ou déjà pris la laisse ; sur une autre couche', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const posees = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entry' } }, { geste: 'appui', point: point(0, 0) }, { geste: 'appui', point: point(2, 2) });
    expect(posees.sel).toEqual({ type: 'entry', id: 'entree-1' });
    const renommee = jouer(posees, { geste: 'nommer', nom: ' cour ' });
    expect([renommee.sel, Object.keys(sceneEditee(renommee).entryPoints ?? {})]).toEqual([{ type: 'entry', id: 'cour' }, ['entree-0', 'cour']]);
    expect(jouer(renommee, { geste: 'nommer', nom: 'entree-0' })).toBe(renommee);
    expect(jouer(renommee, { geste: 'nommer' })).toBe(renommee);
    const etage = jouer(renommee, { geste: 'ajouterCouche' }, { geste: 'couche', z: 0 }, { geste: 'outil', outil: { mode: 'select' } }, { geste: 'appui', point: point(2, 2) }, { geste: 'entree', z: 1 });
    expect(sceneEditee(etage).entryPoints?.cour).toEqual({ x: 2, y: 2, z: 1 });
  });

  it('un décor : sa lumière allumée, réglée, éteinte ; son assise ouverte ; ses places tenues, libérées, un corps à la fois', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const ent = (s: SessionDEdition, id?: string) => (id ? sceneEditee(s).entities.find((e) => e.id === id) : entiteDeLaSelection(sceneEditee(s), s.sel));
    const pnj = jouer(ouverteSur(emptyScene('session', 8, 8)), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(6, 6) });
    const pnjId = pnj.sel?.type === 'entity' ? pnj.sel.id : '';
    const table = jouer(pnj, { geste: 'outil', outil: { mode: 'entity', kind: 'prop', ref: 'table-ronde-4-tabourets' } }, { geste: 'appui', point: point(3, 3) });
    const tableId = table.sel?.type === 'entity' ? table.sel.id : '';
    const allumee = jouer(table, { geste: 'entite', patch: { light: { radiusM: 6, tone: 'lanterne' } } });
    expect(ent(allumee)?.light).toEqual({ radiusM: 6, tone: 'lanterne' });
    expect(ent(jouer(allumee, { geste: 'entite', patch: { light: null } }))?.light).toBeUndefined();
    const ouverte = jouer(table, { geste: 'entite', patch: { assise: true } });
    expect(ent(ouverte)?.usable).toEqual({ ...ent(table)?.usable, assise: true });
    expect(ent(jouer(ouverte, { geste: 'entite', patch: { assise: false } }))?.usable, 'les actions restent').toEqual(ent(table)?.usable);
    const [p1, p2] = seatSlotsOf(sceneEditee(table), tableId).map((p) => p.slotId);
    const assis = jouer(table, { geste: 'place', place: p1, occupant: { kind: 'entity', entityId: pnjId } });
    expect(sceneEditee(assis).seatAssignments?.[tableId]).toEqual({ [p1]: { kind: 'entity', entityId: pnjId } });
    expect(ent(assis, pnjId)?.pos, 'le corps se tient sur l’abord de sa place').not.toEqual({ x: 6, y: 6 });
    const deplace = jouer(assis, { geste: 'place', place: p2, occupant: { kind: 'entity', entityId: pnjId } });
    expect(sceneEditee(deplace).seatAssignments?.[tableId], 'un corps, une place').toEqual({ [p2]: { kind: 'entity', entityId: pnjId } });
    const heros = jouer(deplace, { geste: 'place', place: p2, occupant: { kind: 'party', rang: 1 } });
    expect(sceneEditee(heros).seatAssignments?.[tableId], 'le tenant cède sa place').toEqual({ [p2]: { kind: 'party', rang: 1 } });
    expect(sceneEditee(jouer(heros, { geste: 'place', place: p2, occupant: null })).seatAssignments?.[tableId] ?? {}).toEqual({});
    expect(jouer(table, { geste: 'place', place: p1, occupant: null }), 'une place vide qu’on vide : aucun cran').toBe(table);
  });

  it('un emplacement de siège : posé, son engin, son arc, ses servants et leur chef ; son équipage exposé', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel);
    const pnjs = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(0, 0) }, { geste: 'appui', point: point(0, 1) });
    const [a, b] = sceneEditee(pnjs).entities.map((e) => e.id);
    const pose = jouer(pnjs, { geste: 'outil', outil: { mode: 'emplacement', trappingId: 'baliste' } }, { geste: 'appui', point: point(2, 2) });
    expect(ent(pose)?.postes?.[0]).toMatchObject({ trappingId: 'baliste' });
    const reglee = jouer(pose,
      { geste: 'poste', patch: { engin: 'catapulte-petite' } },
      { geste: 'poste', patch: { arc: 'tribord' } },
      { geste: 'poste', patch: { servants: [a, b] } },
      { geste: 'poste', patch: { servants: [b, a] } });
    expect(ent(reglee)).toMatchObject({ ref: 'catapulte-petite', postes: [{ trappingId: 'catapulte-petite', side: 'tribord', crewIds: [b, a] }] });
    expect(ent(jouer(reglee, { geste: 'poste', patch: { arc: null } }))?.postes?.[0].side, 'omni').toBeUndefined();
    const equipage = jouer(pose, { geste: 'entite', patch: { crewIds: [a] } });
    expect(ent(equipage)?.crewIds).toEqual([a]);
    expect(ent(jouer(equipage, { geste: 'entite', patch: { crewIds: [] } }))?.crewIds).toBeUndefined();
    expect(jouer(pnjs, { geste: 'poste', patch: { arc: 'proue' } }), 'un personnage sans poste').toBe(pnjs);
  });

  it('un personnage : embusqué ; enrôlé dans une rencontre neuve, allié piloté par l’IA, ennemi, retiré', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
    const id = pose.sel?.type === 'entity' ? pose.sel.id : '';
    const membre = (s: SessionDEdition) => sceneEditee(s).encounters[0]?.members?.find((m) => m.entityId === id);
    const embusque = jouer(pose, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['combat'], valeur: {} }, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['combat', 'hiddenUntilCombat'], valeur: true });
    expect(entiteDeLaSelection(sceneEditee(embusque), pose.sel)?.combat).toEqual({ hiddenUntilCombat: true });
    const enrole = jouer(pose, { geste: 'membre', patch: { rencontre: null, enrole: true } });
    const enc = sceneEditee(enrole).encounters[0].id;
    expect(membre(enrole)).toEqual({ entityId: id });
    const allie = jouer(enrole, { geste: 'membre', patch: { rencontre: enc, camp: 'ally' } }, { geste: 'membre', patch: { rencontre: enc, ia: true } });
    expect(membre(allie)).toMatchObject({ side: 'ally', ai: true });
    expect(membre(jouer(allie, { geste: 'membre', patch: { rencontre: enc, camp: 'enemy' } })), 'un ennemi n’est pas piloté').toMatchObject({ side: undefined, ai: undefined });
    expect(membre(jouer(allie, { geste: 'membre', patch: { rencontre: enc, enrole: false } }))).toBeUndefined();
    expect(jouer(enrole, { geste: 'membre', patch: { rencontre: enc, enrole: true } }), 'déjà membre : aucun cran').toBe(enrole);
  });

  it('un personnage : son inventaire d’auteur s’écrit par intention, un objet ajouté non porté, porté, retiré ; vidé, le champ quitte l’entité (#3684)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), pose.sel);
    const equipe = jouer(pose, { geste: 'entite', patch: { objet: { ajouter: 'cotte-de-mailles' } } }, { geste: 'entite', patch: { objet: { ajouter: 'arme-simple' } } }, { geste: 'entite', patch: { objet: { porter: 'cotte-de-mailles' } } });
    expect(ent(equipe)?.inventaire).toEqual({ 'cotte-de-mailles': true, 'arme-simple': false });
    expect(ent(jouer(equipe, { geste: 'entite', patch: { objet: { retirer: 'cotte-de-mailles' } } }, { geste: 'entite', patch: { objet: { retirer: 'arme-simple' } } }))?.inventaire).toBeUndefined();
  });

  it('un objet porté ôte ceux qui sont en conflit de port avec lui ; porté, il s’ôte (`inventaireApres`, #3684)', () => {
    const mailles = { 'cotte-de-mailles': true, 'chemise-de-mailles': false, 'arme-simple': true };
    expect(inventaireApres(mailles, { porter: 'chemise-de-mailles' }), 'deux mailles sur le Corps ne se portent pas ensemble').toEqual({ 'cotte-de-mailles': false, 'chemise-de-mailles': true, 'arme-simple': true });
    expect(inventaireApres(mailles, { porter: 'cotte-de-mailles' })).toEqual({ ...mailles, 'cotte-de-mailles': false });
    expect(inventaireApres(mailles, { ajouter: 'corde' })).toEqual({ ...mailles, corde: false });
    expect(inventaireApres(mailles, { porter: 'absent' })).toBe(mailles);
  });

  it('un personnage de carrière : son parcours s’écrit en ses quatre champs ; sans carrière, ils quittent l’entité ; ses Caractéristiques tirées, à côté de son embuscade (#773)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), pose.sel);
    const parcours = { carrieres: { medecin: 2, soldat: 2 }, talentsDeCarriere: { medecin: [{ id: 'chirurgie' }] }, competencesDeCarriere: { soldat: [{ id: 'musicien', spec: 'fifre' }] }, dotationsDeCarriere: { [adresseDeCreation.dotation([3])]: 'hallebarde' } };
    const porte = jouer(pose, { geste: 'entite', patch: { parcours } });
    expect(ent(porte)).toMatchObject(parcours);
    const sansCarriere = ent(jouer(porte, { geste: 'entite', patch: { parcours: { carrieres: {} } } }))!;
    expect((['carrieres', 'talentsDeCarriere', 'competencesDeCarriere', 'dotationsDeCarriere'] as const).filter((k) => k in sansCarriere)).toEqual([]);
    const id = pose.sel?.type === 'entity' ? pose.sel.id : '';
    const valeur = (chemin: Segment[], v: unknown): GesteDEdition => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, valeur: v });
    const tire = jouer(porte, valeur(['combat'], {}), valeur(['combat', 'hiddenUntilCombat'], true), valeur(['combat', 'randomChars'], true));
    expect(ent(tire)?.combat).toEqual({ hiddenUntilCombat: true, randomChars: true });
    expect(ent(jouer(tire, valeur(['combat', 'randomChars'], false)))?.combat).toEqual({ hiddenUntilCombat: true, randomChars: false });
  });

  it('les sorts choisis d’un personnage s’écrivent à `combat.spells`, à côté de son embuscade ; vides, ils le quittent (#3715)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), pose.sel);
    const id = pose.sel?.type === 'entity' ? pose.sel.id : '';
    const embusque: GesteDEdition[] = [{ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['combat'], valeur: {} }, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['combat', 'hiddenUntilCombat'], valeur: true }];
    const choisis = jouer(pose, ...embusque, { geste: 'entite', patch: { sorts: ['choc', 'flechette'] } });
    expect(ent(choisis)?.combat).toEqual({ hiddenUntilCombat: true, spells: ['choc', 'flechette'] });
    expect(ent(jouer(choisis, { geste: 'entite', patch: { sorts: [] } }))?.combat).toEqual({ hiddenUntilCombat: true });
  });

  it('une troupe : N copies sur les cases libres les plus proches, ids neufs, profils tirés, rencontres héritées, un seul cran (#3704)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const poser = (outil: Extract<GesteDEdition, { geste: 'outil' }>['outil'], x: number, y: number): GesteDEdition[] =>
      [{ geste: 'outil', outil }, { geste: 'appui', point: point(x, y) }, { geste: 'relache', point: point(x, y) }];
    const decor = jouer(ouverteSur(emptyScene('troupe', 8, 8)),
      ...poser({ mode: 'tile', terrain: 'mur' }, 2, 3), ...poser({ mode: 'entity', kind: 'prop', ref: 'brasero' }, 4, 3),
      ...poser({ mode: 'entity', kind: 'personnage', ref: 'humain' }, 3, 2), ...poser({ mode: 'entity', kind: 'personnage', ref: 'humain' }, 3, 3));
    const original = entiteDeLaSelection(sceneEditee(decor), decor.sel)!;
    const avant = jouer(decor, { geste: 'entite', patch: { objet: { ajouter: 'arme-simple' } } }, { geste: 'entite', patch: { objet: { porter: 'arme-simple' } } }, { geste: 'membre', patch: { rencontre: null, enrole: true } });
    const enc = sceneEditee(avant).encounters[0].id;
    const allie = jouer(avant, { geste: 'membre', patch: { rencontre: enc, camp: 'ally' } });
    const troupe = jouer(allie, { geste: 'troupe', nombre: 5 });
    const scene = sceneEditee(troupe);
    const copies = scene.entities.filter((e) => !sceneEditee(allie).entities.some((a) => a.id === e.id));
    expect(copies.map((c) => [c.pos.x, c.pos.y]), 'l’anneau autour de l’original, hors du mur, du décor et de l’autre personnage').toEqual([[2, 2], [4, 2], [2, 4], [3, 4], [4, 4]]);
    expect(new Set([...scene.entities.map((e) => e.id)]).size).toBe(scene.entities.length);
    expect(copies.every((c) => c.ref === 'humain' && c.inventaire?.['arme-simple'] && c.combat?.randomChars)).toBe(true);
    const profils = [original, ...copies].map((c) => JSON.stringify(ficheDEntite(c, () => undefined).characteristics));
    expect(new Set(profils).size, 'chaque copie tire son profil sur son id').toBe(6);
    expect(scene.encounters[0].members?.filter((m) => copies.some((c) => c.id === m.entityId)).map((m) => m.side)).toEqual(Array(5).fill('ally'));
    expect(troupe.sel, 'l’original reste sélectionné').toEqual(allie.sel);
    expect(sceneEditee(jouer(troupe, { geste: 'annuler' })), 'une annulation défait la troupe entière').toBe(sceneEditee(allie));
    const serree = jouer(ouverte(), ...poser({ mode: 'entity', kind: 'personnage', ref: 'humain' }, 1, 1), { geste: 'troupe', nombre: 30 });
    expect(sceneEditee(serree).entities, 'la couche manque de cases : chacune reçoit sa copie').toHaveLength(16);
    expect(jouer(ouverte(), ...poser({ mode: 'entity', kind: 'heroStart' }, 1, 1), { geste: 'troupe', nombre: 2 }).historique.passe, 'un départ des héros ne fait pas de troupe').toHaveLength(1);
  });
});

describe('session d’édition, les écrivains dédiés de la scène (#3606)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const sur = (patch: Extract<GesteDEdition, { geste: 'scene' }>['patch']): GesteDEdition => ({ geste: 'scene', patch });

  it('la musique : une piste du registre, le silence, puis la piste du contexte ; sans aucune piste posée, elle quitte la scène', () => {
    const [piste] = allMusicDefs();
    const posee = jouer(ouverte(), sur({ musique: { piste: 'ambient', id: piste.id } }), sur({ musique: { piste: 'combat', id: null } }));
    expect(sceneEditee(posee).music).toEqual({ ambient: piste.id, combat: null });
    const auto = jouer(posee, sur({ musique: { piste: 'ambient' } }));
    expect(sceneEditee(auto).music).toEqual({ combat: null });
    expect('music' in sceneEditee(jouer(auto, sur({ musique: { piste: 'combat' } }))), 'aucune piste : le champ quitte la scène').toBe(false);
  });

  it('le message d’introduction : saisi sur plusieurs lignes tel quel, sa provenance gardée ; vide, il se retire avec elle', () => {
    expect(champDuMessage(), 'une prose nommée se saisit sur plusieurs lignes').toMatchObject({ key: 'texte', kind: 'textarea' });
    const texte = '  Le relais est désert.\n\nUne lanterne bat au vent.';
    const source = { book: 'ldb', page: 12 };
    const scene = { ...emptyScene('session', 4, 4), startMessage: { texte: 'Ancien.', source } } as Scene;
    const saisi = jouer(ouverteSur(scene), sur({ message: texte }));
    expect(sceneEditee(saisi).startMessage).toEqual({ texte, source });
    expect('startMessage' in sceneEditee(jouer(saisi, sur({ message: '' }))), 'vide : le message quitte la scène, provenance comprise').toBe(false);
  });

  it('les ancres de bataille : ajoutées vers une Scène de Round, repointées, posées à une case, retirées ; la dernière retirée, le champ quitte la scène ; un rang absent laisse la session', () => {
    const [a, b] = ciblesDAncreDeBataille();
    const posee = jouer(ouverte(), sur({ stations: { ajouter: a.id } }), sur({ stations: { ajouter: a.id } }));
    expect(sceneEditee(posee).stations).toEqual([{ sceneId: a.id, pos: { x: 0, y: 0 } }, { sceneId: a.id, pos: { x: 0, y: 0 } }]);
    const reglee = jouer(posee, sur({ stations: { rang: 1, sceneId: b.id } }), sur({ stations: { rang: 1, pos: { x: 2, y: 3 } } }));
    expect(sceneEditee(reglee).stations?.[1]).toEqual({ sceneId: b.id, pos: { x: 2, y: 3 } });
    expect(jouer(reglee, sur({ stations: { rang: 5, sceneId: a.id } })), 'un rang absent ne se patche pas').toBe(reglee);
    expect(jouer(reglee, sur({ stations: { retirer: 5 } })), 'un rang absent ne se retire pas').toBe(reglee);
    const une = jouer(reglee, sur({ stations: { retirer: 0 } }));
    expect(sceneEditee(une).stations).toEqual([{ sceneId: b.id, pos: { x: 2, y: 3 } }]);
    expect('stations' in sceneEditee(jouer(une, sur({ stations: { retirer: 0 } }))), 'la dernière retirée : le champ quitte la scène').toBe(false);
  });

  it('les groupes du lieu : choisis parmi ceux qu’un porteur déclare, puis retirés', () => {
    const groupes = groupesDuLieu().map((g) => g.valeur);
    expect(groupes, 'un groupe relatif ne se déclare pas').not.toContain('etranger');
    const [g] = groupes as string[];
    const declares = jouer(ouverte(), sur({ scalaires: { groups: [g] } }));
    expect(sceneEditee(declares).groups).toEqual([g]);
    expect('groups' in sceneEditee(jouer(declares, sur({ scalaires: { groups: null } })))).toBe(false);
  });

  it('une ouverture de façade : son apparence parmi celles de sa sorte, puis le défaut du rendu ; une ouverture absente laisse la session', () => {
    const corps = addArchitectureBody(emptyScene('session', 6, 6), { id: 'maison' }, { x: 1, y: 1, w: 2, h: 2 });
    const pan = addFacadeSection(corps.scene, corps.id, { x: 1, y: 1, side: 'N' })!;
    const pose = addFacadeFeature(pan.scene, corps.id, pan.id)!;
    const s = { ...ouverteSur(pose.scene), sel: { type: 'facadeSection' as const, bodyId: corps.id, id: pan.id } };
    const ouverture = (x: SessionDEdition) => sceneEditee(x).architecture![0].facades[0].features![0];
    const [apparence] = apparencesDeLOuverture(ouverture(s).kind);
    const habillee = jouer(s, { geste: 'baie', id: pose.id, patch: { apparence: apparence.id } });
    expect(ouverture(habillee).appearance).toBe(apparence.id);
    expect('appearance' in ouverture(jouer(habillee, { geste: 'baie', id: pose.id, patch: { apparence: null } }))).toBe(false);
    expect(jouer(habillee, { geste: 'baie', id: 'absente', patch: { apparence: apparence.id } })).toBe(habillee);
    const decor = (['chimney', 'sign', 'belfry'] as const).find((k) => !apparencesDeLOuverture(k).some((a) => a.id === apparence.id))!;
    expect('appearance' in ouverture(jouer(habillee, { geste: 'baie', id: pose.id, patch: { sorte: decor } })), 'une sorte d’un autre catalogue retire l’apparence').toBe(false);
  });
});

describe('le porteur `entite` du geste `valeur` (#3606 M1a)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const poser = (ref: string, x: number) => jouer(ouverteSur(emptyScene('m1a', 6, 6)), { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref } }, { geste: 'appui', point: point(x, 1) }, { geste: 'relache', point: point(x, 1) });
  const idDe = (s: SessionDEdition) => (s.sel?.type === 'entity' ? s.sel.id : '');
  const valeur = (id: string, chemin: Segment[], v?: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, ...(v === undefined ? {} : { valeur: v }) });

  it('écrit le rôle au combat, l’amateur des arts et les Améliorations d’une coque ; l’entité reste sélectionnée', () => {
    const griffon = poser('griffon-zoo-imperial', 1);
    const id = idDe(griffon);
    const ecrite = jouer(griffon, valeur(id, ['combat'], {}), valeur(id, ['combat', 'randomChars'], true), valeur(id, ['combat', 'optionals'], [{ id: 'rapide' }]), valeur(id, ['combat', 'optionals', 0, 'value'], 2), valeur(id, ['amateur'], 'amateurDArt'));
    expect(entiteDeLaSelection(sceneEditee(ecrite), ecrite.sel), 'la sélection désigne toujours l’entité écrite').toMatchObject({ id, combat: { randomChars: true, optionals: [{ id: 'rapide', value: 2 }] }, amateur: 'amateurDArt' });
    expect(ecrite.historique.passe.length - griffon.historique.passe.length, 'chaque écriture sur un cran').toBe(5);
    const barge = allBuiltinCampaigns.find((c) => c.id === 'barge-du-sel')!;
    const cogue = jouer(ouvrirLEdition(paquetDuJeu(barge), false), { geste: 'scenes', quoi: 'aller', id: 'barge-du-sel-embuscade' }, { geste: 'appui', point: point(18, 7) }, { geste: 'relache', point: point(18, 7) });
    const coque = idDe(cogue);
    expect(entiteDeLaSelection(sceneEditee(cogue), cogue.sel), 'la coque pirate de l’embuscade').toMatchObject({ ref: 'cogue', upgrades: [{ id: 'renforce', value: 1 }] });
    const amelioree = jouer(cogue, valeur(coque, ['upgrades', 0, 'value'], 2));
    expect(entiteDeLaSelection(sceneEditee(amelioree), amelioree.sel)?.upgrades).toEqual([{ id: 'renforce', value: 2 }]);
    expect(refusDeLaValeur(griffon, valeur(id, ['upgrades'], [{ id: 'renforce' }])), 'seule une coque porte des Améliorations').toBe('nonOffert');
  });

  it('refuse un chemin que M1a n’offre pas : préréglage, apparence, sorts', () => {
    const griffon = poser('griffon-zoo-imperial', 1);
    const id = idDe(griffon);
    const combat = jouer(griffon, valeur(id, ['combat'], {}));
    expect([refusDeLaValeur(griffon, valeur(id, ['presetId'], 'x')), refusDeLaValeur(griffon, valeur(id, ['appearance'], {})), refusDeLaValeur(combat, valeur(id, ['combat', 'spells'], []))]).toEqual(['nonOffert', 'nonOffert', 'nonOffert']);
  });

  it('les options : tous les Traits, ceux de la fiche en tête puis les Traits standard (LDB 76 l.11, l.35) ; une note « swap » de la fiche se pose entière', () => {
    const griffon = poser('griffon-zoo-imperial', 1);
    const id = idDe(griffon);
    const avecTrait = jouer(griffon, valeur(id, ['combat'], {}), valeur(id, ['combat', 'optionals'], [{ id: 'rapide' }]));
    const ent = entiteDeLaSelection(sceneEditee(avecTrait), avecTrait.sel)!;
    const offerts = choixDuChamp('entite', ent, ['combat', 'optionals', 0, 'id'])!.map((o) => o.valeur);
    const facultatifs = findCreatureById('griffon-zoo-imperial')!.optionals.flatMap((o) => ('id' in o && offerts.includes(o.id) ? [o.id] : []));
    const standard = traits.filter((t) => t.standard && !facultatifs.includes(t.id)).map((t) => t.id);
    expect(offerts).toHaveLength(traits.length);
    expect(offerts.slice(0, facultatifs.length + standard.length)).toEqual([...facultatifs, ...standard]);
    const note = findCreatureById('griffon-zoo-imperial')!.optionals.find((o) => 'note' in o && o.note === 'swap');
    const variantes = choixDuChamp('entite', ent, ['combat', 'optionals', 0])!;
    expect(variantes.map((v) => v.valeur)).toEqual([{ id: 'rapide' }, note]);
    const posee = jouer(avecTrait, valeur(id, ['combat', 'optionals', 0], note));
    expect(entiteDeLaSelection(sceneEditee(posee), posee.sel)?.combat?.optionals).toEqual([note]);
    const editee = jouer(posee, valeur(id, ['combat', 'optionals', 0, 'wounds'], 30));
    expect(entiteDeLaSelection(sceneEditee(editee), editee.sel)?.combat?.optionals?.[0], 'posée, la note s’édite').toEqual({ ...note, wounds: 30 });
  });

  it('les fautes croisées d’une entité (`refusDeLEntite`) : le type non nommé, la fiche introuvable, le PNJ de carrière fautif, le calage et le cap d’un décor, que le `superRefine` de `sceneEntitySchema` dit à leur champ (#1882)', () => {
    const fixtures = {
    sansPorteur: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } },
    refInconnue: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'pas-une-fiche' },
    carriereSurStatbloc: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain', carrieres: { soldat: 1 }, appearance: { tenue: 'soldat' } },
    volumiqueEnDiagonale: { id: 'd', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'brasero', facing: 'NE' },
    decorHorsDeSaCase: { id: 'd', kind: 'prop', pos: { x: 0, y: 0 }, ref: 'brasero', calage: { x: 2, y: 0 } },
    admise: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, ref: 'humain' },
    } as const;
    const fautes = (ent: (typeof fixtures)[keyof typeof fixtures]) => refusDeLEntite(ent as Parameters<typeof refusDeLEntite>[0]);
    expect(fautes(fixtures.sansPorteur).map((f) => f.chemin)).toEqual([['ref']]);
    expect(fautes(fixtures.refInconnue)).toEqual([{ chemin: ['ref'], message: '« pas-une-fiche » ni créature, ni coque de véhicule, ni engin de siège' }]);
    expect(fautes(fixtures.carriereSurStatbloc)).toEqual([{ chemin: ['carrieres'], message: 'un PNJ de carrière porte la tenue de sa carrière actuelle, sans tenue d’auteur' }]);
    expect(fautes(fixtures.volumiqueEnDiagonale).map((f) => f.chemin)).toEqual([['facing']]);
    expect(fautes(fixtures.decorHorsDeSaCase).map((f) => f.chemin), 'le calage d’un décor dans sa case (#3731)').toEqual([['calage', 'x']]);
    expect(fautes(fixtures.admise)).toEqual([]);

    // Accord : le parse dit exactement ces fautes, à leur champ.
    for (const [nom, ent] of Object.entries(fixtures)) {
      const issues = sceneEntitySchema.safeParse(ent).error?.issues.filter((i) => i.code === 'custom') ?? [];
      expect(issues.map((i) => ({ chemin: i.path, message: i.message })), nom).toEqual(fautes(ent));
    }
  });
});

describe('le navire de la scène éditée (#3772)', () => {
  const bassin = (metresPerTile = 2) => ({ ...emptyScene('bassin', 24, 16), metresPerTile });
  const poserLaCaraque = (s: SessionDEdition, cap: 'N' | 'E' | 'S' | 'O' = 'E') =>
    [{ geste: 'outil', outil: { mode: 'navire', ref: 'caraque', cap } }, { geste: 'appui', point: point(10, 6) }].reduce<SessionDEdition>((t, g) => editer(t, g as GesteDEdition), s);
  const caraque = { id: 'navire-0', kind: 'personnage', ref: 'caraque', pos: { x: 10, y: 6 }, facing: 'E', label: 'Caraque' };

  it('l’outil navire pose la caraque à la case visée, à son cap, sélectionnée : la scène éditée ne porte que son entité', () => {
    const s = poserLaCaraque(ouverteSur(bassin()));
    expect(sceneEditee(s)).toEqual({ ...bassin(), entities: [caraque] });
    expect(s.sel).toEqual({ type: 'entity', id: 'navire-0' });
    expect(s.historique.passe).toHaveLength(1);
  });

  it('ses ponts sont des couches de la vue, où l’on vise : une case de pont désigne le navire, un personnage s’y pose', () => {
    const s = poserLaCaraque(ouverteSur(bassin()));
    expect(vueDeLaScene(s).layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
    const surLePont = editer(editer(s, { geste: 'outil', outil: { mode: 'select' } }), { geste: 'couche', z: 2 });
    expect(surLePont.z).toBe(2);
    const [x, y] = garanti([...provenanceDesNavires(vueDeLaScene(s)).cases.keys()].find((cle) => cle.endsWith(',2')), 'pont', 'case du pont 2').split(',').map(Number);
    const vise = editer(surLePont, { geste: 'appui', point: point(x, y) });
    expect([vise.sel, vise.pointee]).toEqual([{ type: 'entity', id: 'navire-0' }, { x, y, z: 2 }]);
    const marin = editer(editer(surLePont, { geste: 'outil', outil: { mode: 'entity', kind: 'personnage', ref: 'humain' } }), { geste: 'appui', point: point(x, y) });
    expect(sceneEditee(marin).entities.find((e) => e.ref === 'humain')).toMatchObject({ pos: { x, y }, z: 2 });
    expect(avertissementsDeLaSession(marin).map((w) => w.message).filter((m) => m.includes('inexistant'))).toEqual([]);
    expect(sceneEditee(marin).layers.map((l) => l.z), 'la scène éditée ne reçoit aucune couche des ponts').toEqual([0]);
  });

  it('une couche que seuls les ponts posent ne se retire pas ; ajouter une couche la pose au-dessus des ponts', () => {
    const s = editer(poserLaCaraque(ouverteSur(bassin())), { geste: 'couche', z: 3 });
    expect(editer(s, { geste: 'retirerCouche' })).toBe(s);
    const ajoutee = editer(s, { geste: 'ajouterCouche' });
    expect([ajoutee.z, sceneEditee(ajoutee).layers.map((l) => l.z)]).toEqual([4, [0, 4]]);
  });

  it('le cap change à l’inspecteur : ses ponts tournent avec lui, la scène éditée ne porte toujours que son entité', () => {
    const s = poserLaCaraque(ouverteSur(bassin()));
    const tourne = editer(s, { geste: 'entite', patch: { facing: 'N' } });
    expect(sceneEditee(tourne)).toEqual({ ...bassin(), entities: [{ ...caraque, facing: 'N' }] });
    const empriseDe = (t: SessionDEdition) => [...provenanceDesNavires(vueDeLaScene(t)).cases.keys()].map((cle) => cle.split(',').map(Number));
    const etendue = (cases: number[][], axe: 0 | 1) => Math.max(...cases.map((c) => c[axe])) - Math.min(...cases.map((c) => c[axe])) + 1;
    expect([etendue(empriseDe(s), 0), etendue(empriseDe(s), 1)]).toEqual([18, 5]);
    expect([etendue(empriseDe(tourne), 0), etendue(empriseDe(tourne), 1)]).toEqual([5, 18]);
  });

  it('une scène qui n’est pas à l’échelle de son plan refuse le navire', () => {
    const s = poserLaCaraque(ouverteSur(bassin(10)));
    expect(sceneEditee(s).entities).toEqual([]);
    expect(s.historique.passe).toEqual([]);
  });
});
