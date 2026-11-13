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
import type { SourceDeLEdition } from './adresseDeProse';
import { emptyNarratif } from '../monde/campaignNarratif';
import { emptyScene, heightAt, isWalkable, type Scene } from '../monde/scene';
import { buildScene, type MapSpec } from '../mapSpec';
import { emptyWorldMap, resolvePortRef, type WorldMap } from '../worldMap';
import { avertissementsDeLaSession, cadreDeLaSession, calqueDeLaCouche, editer, groupesDuLieu, idDeLaSceneEditee, ouvrirLEdition, planDeLaVolee, planDuLieuOuvert, projetEdite, sceneEditee, vueDeLaScene, type GesteDEdition, type SessionDEdition } from './session';
import { poserLesNavires, provenanceDesNavires } from '../planDeNavire';
import { validateScene } from '../validateScene';
import { bumperDataset } from '../../data/versionDataset';
import { flowFromEffects } from '../monde/flow';
import { fauteDAppui } from '../monde/poseDuDecor';
import type { Effect } from '../../data/schemas/defs-scenes/effets';
import { garanti } from '../../lib/garanti';
import { addArchitectureBody, addFacadeFeature, addFacadeSection, avecLaValeurDuPorteur, ECRITURES_DES_PORTEURS } from '../sceneEdit';
import { peripetieNeuve, portNeuf } from '../worldMapEdit';
import { ciblesDAncreDeBataille } from '../massBattleFlow';
import { apparencesDeLOuverture } from '../monde/facades';
import { allMusicDefs } from '../../data/sons/musique';
import { capsOfferts, choixDuChamp, entiteDeLaSelection, formulaireDe, porteurDeLaSel, segmentDeLaSelection, type CadreDuPorteur, type SorteDePorteur } from '../sceneEditLecture';
import { champsDeclares, champsDuRecord, choixDuNoeud, elementDuNoeud, recordDuNoeud } from '../codex/editFields';
import { apparencesDObjetsSchema, couleursSchema, slotSchema } from '../../data/schemas/grammaire/valeurs';
import { apparences, apparencesAdmissiblesDObjet, findTrappingById } from '../../data/apparencesObjets';
import { emptyStatblock, statblockDeLaCreature } from '../../data/valeursNeuves';
import { valeurNeuveDe } from '../valeursNeuves';
import { refusDeLaValeur, refusDeRetrait } from './session';
import { refusDeLEntite, sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { creatures, findCreatureById, MERCHANT_ARCHETYPES, navalPorts, siegeEngines, spells, talents, traits } from '../../data';
import { TAVERN_GAMES } from '../../engine/tavernGame';
import { listesDeSorts, refusDesSortsChoisis } from '../../engine/sortsDuPnj';
import { inventaireApres } from '../../engine/items';
import type { Segment } from '../sceneEdit';
import { seatSlotsOf } from '../monde/seating';
import { props } from '../../data';
import { adresseDeCreation } from '../../engine/adresseDeCreation';
import { ficheDEntite } from '../monde/sceneNpc';
import { presetDuNarratif } from '../monde/resolveursDuNarratif';
import { allBuiltinCampaigns, paquetDuJeu } from '../../scenes/campaign';
import areneProjet from '../../scenes/arene/arene-projet.json';

/** Un narratif vide : aucun preset de PNJ, aucune entrée à référencer. */
const NARRATIF_VIDE = emptyNarratif();

/** Aucun `Source/` servi : aucun chapitre. */
const SANS_SOURCE: SourceDeLEdition = { manifeste: null, chapitres: {} };

/** Le cadre d'un porteur d'une scène vide, au narratif `narratif`. */
const cadre = (narratif = NARRATIF_VIDE): CadreDuPorteur => ({ scene: emptyScene('c', 4, 4), projet: { scenes: [], narratif }, source: SANS_SOURCE });

const ouverteSur = (scene: Scene, duDepot = false, narratif = NARRATIF_VIDE): SessionDEdition => ouvrirLEdition({ scenes: [scene], narratif } as unknown as Parameters<typeof ouvrirLEdition>[0], duDepot);
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
    let s = editer(ouverte(), { geste: 'outil', outil: { mode: 'terrain', terrain: 'pierre' } });
    s = editer(s, { geste: 'rectangle', actif: true });
    s = editer(s, { geste: 'appui', point: point(1, 1) });
    expect(s.geste?.sorte).toBe('rectangle');
    expect(editer(s, { geste: 'outil', outil: { mode: 'selection' } }).geste).toBeNull();
    expect(editer(s, { geste: 'couche', z: 0 }).geste).toBeNull();
    expect(editer(s, { geste: 'couche', z: 3 }), 'une couche absente laisse la session').toBe(s);
  });

  it('choisir une taille de pinceau quitte le rectangle', () => {
    const s = editer(editer(ouverte(), { geste: 'rectangle', actif: true }), { geste: 'pinceau', taille: 3 });
    expect([s.pinceau, s.rectangle]).toEqual([3, false]);
  });

  it('enregistrer : hors du dépôt, rien ; au dépôt, le projet édité n’est enregistré qu’à l’écriture réussie', () => {
    expect(editer(ouverte(), { geste: 'enregistrer' }).depot).toBeNull();
    const ouv = ouverte(true);
    const modifiee = editer(ouv, { geste: 'ajouterCouche' });
    const enCours = editer(modifiee, { geste: 'enregistrer' });
    expect(enCours.depot!.enregistre).toBe(projetEdite(ouv));
    expect(enCours.depot!.enCours).toBe(projetEdite(modifiee));
    const reussi = editer(enCours, { geste: 'enregistrement', reussi: true }).depot!;
    expect([reussi.enregistre === projetEdite(modifiee), reussi.enCours]).toEqual([true, null]);
    const echoue = editer(enCours, { geste: 'enregistrement', reussi: false }).depot!;
    expect([echoue.enregistre === projetEdite(ouv), echoue.enCours]).toEqual([true, null]);
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
    let s = jouer(ouverteSur(scene), { geste: 'outil', outil: { mode: 'escalier', toZ: 1 } }, { geste: 'appui', point: point(1, 1) }, { geste: 'glisse', point: point(2, 1) });
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
    const choisie = jouer(ouverte(), { geste: 'outil', outil: { mode: 'arete', paint: 'wall' } }, { geste: 'appui', point: auNord }, { geste: 'relache', point: auNord },
      { geste: 'outil', outil: { mode: 'selection' } }, { geste: 'appui', point: auNord }, { geste: 'relache', point: auNord });
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
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'prop', ref: decor.id } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel);
    expect(ent(pose)).toMatchObject({ kind: 'prop', decor: { id: decor.id }, pos: { x: 1, y: 1 }, label: decor.label });
    expect(ent(jouer(pose, { geste: 'nommer', nom: 'Comptoir' }))?.label).toBe('Comptoir');
    expect(ent(jouer(pose, { geste: 'nommer' }))?.label, 'sans nom, il n’en porte plus').toBeUndefined();
    const tourne = jouer(pose, { geste: 'entite', patch: { facing: 'E' } });
    expect([ent(tourne)?.facing, tourne.historique.passe.length]).toEqual(['E', pose.historique.passe.length + 1]);
    expect(jouer(tourne, { geste: 'entite', patch: { facing: 'E' } }), 'rien ne change : aucun cran').toBe(tourne);
    expect(ent(jouer(tourne, { geste: 'entite', patch: { ref: autre.id } })), 'retypé, il garde son cap cardinal').toMatchObject({ decor: { id: autre.id }, facing: 'E' });
    const etage = jouer(pose, { geste: 'ajouterCouche' }, { geste: 'couche', z: 0 }, { geste: 'appui', point: point(1, 1) }, { geste: 'entite', patch: { z: 1 } });
    expect(ent(etage)?.z).toBe(1);
    expect(ent(jouer(etage, { geste: 'entite', patch: { z: 0 } }))?.z).toBeUndefined();
  });

  it('copier, coller, dupliquer : la copie se colle sur la case pointée de la couche éditée, la duplication sur la couche de l’entité', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'ajouterCouche' }, { geste: 'outil', outil: { mode: 'entite', kind: 'heroStart' } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel);
    expect(jouer(pose, { geste: 'coller' }), 'rien de copié').toBe(pose);
    const copiee = jouer(pose, { geste: 'copier' });
    expect(copiee.presse).toBe(ent(pose));
    const collee = jouer(copiee, { geste: 'outil', outil: { mode: 'selection' } }, { geste: 'appui', point: point(3, 2) }, { geste: 'coller' });
    expect(ent(collee)).toMatchObject({ kind: 'heroStart', pos: { x: 3, y: 2 }, z: 1 });
    expect(ent(collee)?.id).not.toBe(ent(pose)?.id);
    const ailleurs = jouer(copiee, { geste: 'outil', outil: { mode: 'selection' } }, { geste: 'appui', point: point(3, 2) }, { geste: 'couche', z: 0 });
    expect(jouer(ailleurs, { geste: 'coller' }), 'la case pointée est sur une autre couche').toBe(ailleurs);
    expect(ent(jouer(pose, { geste: 'dupliquer' }))).toMatchObject({ kind: 'heroStart', pos: { x: 2, y: 2 }, z: 1 });
  });

  it('une entrée : renommée, gardée sélectionnée ; un nom vide ou déjà pris la laisse ; sur une autre couche', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const posees = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entree' } }, { geste: 'appui', point: point(0, 0) }, { geste: 'appui', point: point(2, 2) });
    expect(posees.sel).toEqual({ type: 'entry', id: 'entree-1' });
    const renommee = jouer(posees, { geste: 'nommer', nom: ' cour ' });
    expect([renommee.sel, Object.keys(sceneEditee(renommee).entryPoints ?? {})]).toEqual([{ type: 'entry', id: 'cour' }, ['entree-0', 'cour']]);
    expect(jouer(renommee, { geste: 'nommer', nom: 'entree-0' })).toBe(renommee);
    expect(jouer(renommee, { geste: 'nommer' })).toBe(renommee);
    const etage = jouer(renommee, { geste: 'ajouterCouche' }, { geste: 'couche', z: 0 }, { geste: 'outil', outil: { mode: 'selection' } }, { geste: 'appui', point: point(2, 2) }, { geste: 'entree', z: 1 });
    expect(sceneEditee(etage).entryPoints?.cour).toEqual({ x: 2, y: 2, z: 1 });
  });

  it('un décor : sa lumière allumée, réglée, éteinte ; son assise ouverte ; ses places tenues, libérées, un corps à la fois', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const ent = (s: SessionDEdition, id?: string) => (id ? sceneEditee(s).entities.find((e) => e.id === id) : entiteDeLaSelection(sceneEditee(s), s.sel));
    const pnj = jouer(ouverteSur(emptyScene('session', 8, 8)), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(6, 6) });
    const pnjId = pnj.sel?.type === 'entity' ? pnj.sel.id : '';
    const table = jouer(pnj, { geste: 'outil', outil: { mode: 'entite', kind: 'prop', ref: 'table-ronde-4-tabourets' } }, { geste: 'appui', point: point(3, 3) });
    const tableId = table.sel?.type === 'entity' ? table.sel.id : '';
    const allumee = jouer(table, { geste: 'entite', patch: { light: { radiusM: 6, tone: 'lanterne' } } });
    expect(ent(allumee)?.light).toEqual({ radiusM: 6, tone: 'lanterne' });
    expect(ent(jouer(allumee, { geste: 'entite', patch: { light: null } }))?.light).toBeUndefined();
    const ouverte = jouer(table, { geste: 'entite', patch: { assise: true } });
    expect(ent(ouverte)?.usable).toEqual({ ...ent(table)?.usable, assise: true });
    expect(ent(jouer(ouverte, { geste: 'entite', patch: { assise: false } }))?.usable, 'les actions restent').toEqual(ent(table)?.usable);
    const [p1, p2] = seatSlotsOf(sceneEditee(table), tableId).map((p) => p.slotId);
    const assis = jouer(table, { geste: 'place', place: p1, occupant: { kind: 'entite', entityId: pnjId } });
    expect(sceneEditee(assis).seatAssignments?.[tableId]).toEqual({ [p1]: { kind: 'entite', entityId: pnjId } });
    expect(ent(assis, pnjId)?.pos, 'le corps se tient sur l’abord de sa place').not.toEqual({ x: 6, y: 6 });
    const deplace = jouer(assis, { geste: 'place', place: p2, occupant: { kind: 'entite', entityId: pnjId } });
    expect(sceneEditee(deplace).seatAssignments?.[tableId], 'un corps, une place').toEqual({ [p2]: { kind: 'entite', entityId: pnjId } });
    const heros = jouer(deplace, { geste: 'place', place: p2, occupant: { kind: 'groupe', rang: 1 } });
    expect(sceneEditee(heros).seatAssignments?.[tableId], 'le tenant cède sa place').toEqual({ [p2]: { kind: 'groupe', rang: 1 } });
    expect(sceneEditee(jouer(heros, { geste: 'place', place: p2, occupant: null })).seatAssignments?.[tableId] ?? {}).toEqual({});
    expect(jouer(table, { geste: 'place', place: p1, occupant: null }), 'une place vide qu’on vide : aucun cran').toBe(table);
  });

  it('un emplacement de siège : posé, son engin, son arc, ses servants et leur chef ; son équipage exposé', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel);
    const pnjs = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(0, 0) }, { geste: 'appui', point: point(0, 1) });
    const [a, b] = sceneEditee(pnjs).entities.map((e) => e.id);
    const pose = jouer(pnjs, { geste: 'outil', outil: { mode: 'emplacement', trappingId: 'baliste' } }, { geste: 'appui', point: point(2, 2) });
    expect(ent(pose)?.postes?.[0]).toMatchObject({ trappingId: 'baliste' });
    const reglee = jouer(pose,
      { geste: 'poste', patch: { engin: 'catapulte-petite' } },
      { geste: 'poste', patch: { arc: 'tribord' } },
      { geste: 'poste', patch: { servants: [a, b] } },
      { geste: 'poste', patch: { servants: [b, a] } });
    expect(ent(reglee)).toMatchObject({ engin: { id: 'catapulte-petite' }, postes: [{ trappingId: 'catapulte-petite', side: 'tribord', crewIds: [b, a] }] });
    expect(ent(jouer(reglee, { geste: 'poste', patch: { arc: null } }))?.postes?.[0].side, 'omni').toBeUndefined();
    const equipage = jouer(pose, { geste: 'entite', patch: { crewIds: [a] } });
    expect(ent(equipage)?.crewIds).toEqual([a]);
    expect(ent(jouer(equipage, { geste: 'entite', patch: { crewIds: [] } }))?.crewIds).toBeUndefined();
    expect(jouer(pnjs, { geste: 'poste', patch: { arc: 'proue' } }), 'un personnage sans poste').toBe(pnjs);
  });

  it('un personnage : embusqué ; enrôlé dans une rencontre neuve, allié piloté par l’IA, ennemi, retiré', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
    const id = pose.sel?.type === 'entity' ? pose.sel.id : '';
    const membre = (s: SessionDEdition) => sceneEditee(s).encounters[0]?.members?.find((m) => m.entityId === id);
    const embusque = jouer(pose, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['combat'], valeur: {} }, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['combat', 'hiddenUntilCombat'], valeur: true });
    expect(entiteDeLaSelection(sceneEditee(embusque), pose.sel)?.combat).toEqual({ hiddenUntilCombat: true });
    const enrole = jouer(pose, { geste: 'membre', patch: { rencontre: null, enrole: true } });
    const enc = sceneEditee(enrole).encounters[0].id;
    expect(membre(enrole)).toEqual({ entityId: id });
    const allie = jouer(enrole, { geste: 'membre', patch: { rencontre: enc, camp: 'allie' } }, { geste: 'membre', patch: { rencontre: enc, ia: true } });
    expect(membre(allie)).toMatchObject({ side: 'allie', ai: true });
    expect(membre(jouer(allie, { geste: 'membre', patch: { rencontre: enc, camp: 'ennemi' } })), 'un ennemi n’est pas piloté').toMatchObject({ side: undefined, ai: undefined });
    expect(membre(jouer(allie, { geste: 'membre', patch: { rencontre: enc, enrole: false } }))).toBeUndefined();
    expect(jouer(enrole, { geste: 'membre', patch: { rencontre: enc, enrole: true } }), 'déjà membre : aucun cran').toBe(enrole);
  });

  it('un personnage : son inventaire d’auteur s’écrit par intention, un objet ajouté non porté, porté, retiré ; vidé, le champ quitte l’entité (#3684)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
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
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'humain' } }, { geste: 'appui', point: point(1, 1) });
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

  it('les sorts choisis d’un personnage s’écrivent au formulaire à `combat.spells`, à côté de son embuscade ; vides, ils le quittent (#3715, #3606 étape S)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'l-ombre-du-fleuve' } }, { geste: 'appui', point: point(1, 1) });
    const ent = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), pose.sel);
    const id = pose.sel?.type === 'entity' ? pose.sel.id : '';
    const valeur = (chemin: Segment[], v: unknown): GesteDEdition => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, valeur: v });
    const choisis = jouer(pose, valeur(['combat'], {}), valeur(['combat', 'hiddenUntilCombat'], true), valeur(['combat', 'spells'], ['bondissant-comme-un-cerf']));
    expect(ent(choisis)?.combat).toEqual({ hiddenUntilCombat: true, spells: ['bondissant-comme-un-cerf'] });
    expect(ent(jouer(choisis, valeur(['combat', 'spells'], [])))?.combat).toEqual({ hiddenUntilCombat: true });
  });

  it('les sorts offerts à un personnage : ceux des listes qu’ouvre sa fiche, hors des autres choisis, la courante restant offerte, chacun refusé par ce qu’en dit `refusDesSortsChoisis` (#3715, #3606 étape S)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const pose = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'l-ombre-du-fleuve' } }, { geste: 'appui', point: point(1, 1) });
    const id = pose.sel?.type === 'entity' ? pose.sel.id : '';
    const valeur = (chemin: Segment[], v: unknown): GesteDEdition => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, valeur: v });
    const choisis = jouer(pose, valeur(['combat'], {}), valeur(['combat', 'spells'], ['bondissant-comme-un-cerf']));
    const ent = entiteDeLaSelection(sceneEditee(choisis), choisis.sel)!;
    const offerts = (rang: number) => choixDuChamp('entite', ent, ['combat', 'spells', rang], cadre())!.map((o) => o.valeur);
    const fiche = ficheDEntite(ent, presetDuNarratif(NARRATIF_VIDE));
    const listes = listesDeSorts(fiche);
    expect(offerts(1), 'au rang neuf : les sorts de ses listes, hors du choisi').toEqual(spells.filter((sp) => sp.id !== 'bondissant-comme-un-cerf' && listes.some((l) => l.admet(sp))).map((sp) => sp.id));
    expect(offerts(0), 'au rang du choisi : le choisi reste offert').toContain('bondissant-comme-un-cerf');
    expect(offerts(1), 'un Miracle d’un autre dieu n’est pas offert').not.toContain('feu-de-l-ame');
    expect(choixDuChamp('entite', ent, ['combat', 'spells', 1], cadre())!.every((o) => o.refus === (refusDesSortsChoisis(fiche, ['bondissant-comme-un-cerf', o.valeur as string]) ?? null))).toBe(true);
  });

  it('une troupe : N copies sur les cases libres les plus proches, ids neufs, profils tirés, rencontres héritées, un seul cran (#3704)', () => {
    const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
    const poser = (outil: Extract<GesteDEdition, { geste: 'outil' }>['outil'], x: number, y: number): GesteDEdition[] =>
      [{ geste: 'outil', outil }, { geste: 'appui', point: point(x, y) }, { geste: 'relache', point: point(x, y) }];
    const decor = jouer(ouverteSur(emptyScene('troupe', 8, 8)),
      ...poser({ mode: 'terrain', terrain: 'mur' }, 2, 3), ...poser({ mode: 'entite', kind: 'prop', ref: 'brasero' }, 4, 3),
      ...poser({ mode: 'entite', kind: 'personnage', ref: 'humain' }, 3, 2), ...poser({ mode: 'entite', kind: 'personnage', ref: 'humain' }, 3, 3));
    const original = entiteDeLaSelection(sceneEditee(decor), decor.sel)!;
    const avant = jouer(decor, { geste: 'entite', patch: { objet: { ajouter: 'arme-simple' } } }, { geste: 'entite', patch: { objet: { porter: 'arme-simple' } } }, { geste: 'membre', patch: { rencontre: null, enrole: true } });
    const enc = sceneEditee(avant).encounters[0].id;
    const allie = jouer(avant, { geste: 'membre', patch: { rencontre: enc, camp: 'allie' } });
    const troupe = jouer(allie, { geste: 'troupe', nombre: 5 });
    const scene = sceneEditee(troupe);
    const copies = scene.entities.filter((e) => !sceneEditee(allie).entities.some((a) => a.id === e.id));
    expect(copies.map((c) => [c.pos.x, c.pos.y]), 'l’anneau autour de l’original, hors du mur, du décor et de l’autre personnage').toEqual([[2, 2], [4, 2], [2, 4], [3, 4], [4, 4]]);
    expect(new Set([...scene.entities.map((e) => e.id)]).size).toBe(scene.entities.length);
    expect(copies.every((c) => c.creature?.id === 'humain' && c.inventaire?.['arme-simple'] && c.combat?.randomChars)).toBe(true);
    const profils = [original, ...copies].map((c) => JSON.stringify(ficheDEntite(c, () => undefined).characteristics));
    expect(new Set(profils).size, 'chaque copie tire son profil sur son id').toBe(6);
    expect(scene.encounters[0].members?.filter((m) => copies.some((c) => c.id === m.entityId)).map((m) => m.side)).toEqual(Array(5).fill('allie'));
    expect(troupe.sel, 'l’original reste sélectionné').toEqual(allie.sel);
    expect(sceneEditee(jouer(troupe, { geste: 'annuler' })), 'une annulation défait la troupe entière').toBe(sceneEditee(allie));
    const serree = jouer(ouverte(), ...poser({ mode: 'entite', kind: 'personnage', ref: 'humain' }, 1, 1), { geste: 'troupe', nombre: 30 });
    expect(sceneEditee(serree).entities, 'la couche manque de cases : chacune reçoit sa copie').toHaveLength(16);
    expect(jouer(ouverte(), ...poser({ mode: 'entite', kind: 'heroStart' }, 1, 1), { geste: 'troupe', nombre: 2 }).historique.passe, 'un départ des héros ne fait pas de troupe').toHaveLength(1);
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

describe('le porteur singulier `scene` du geste `valeur` (#3606)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const surLaScene = (s: SessionDEdition, chemin: (string | number)[], ...valeur: unknown[]): GesteDEdition =>
    ({ geste: 'valeur', porteur: porteurDeLaSel(s.sel, 'scene', idDeLaSceneEditee(s))!, chemin, ...(valeur.length ? { valeur: valeur[0] } : {}) });

  it('sans sélection, le porteur édité est la scène ouverte, sous son identifiant ; nommer, identifier et supprimer y restent ceux de la scène', () => {
    const s = ouverteSur(emptyScene('session', 4, 4));
    expect(porteurDeLaSel(s.sel, 'scene', idDeLaSceneEditee(s))).toEqual({ sorte: 'scene', id: 'session' });
    expect(sceneEditee(jouer(s, { geste: 'nommer', nom: 'Le relais' })).label).toBe('Le relais');
    expect(idDeLaSceneEditee(jouer(s, { geste: 'identifier', id: 'relais' }))).toBe('relais');
    expect(jouer(s, { geste: 'supprimer' }), 'rien à supprimer').toBe(s);
  });

  it('le message de départ : son texte saisi sur plusieurs lignes tel quel, sa provenance gardée ; vidé, il se retire avec elle', () => {
    const texte = '  Le relais est désert.\n\nUne lanterne bat au vent.';
    const adapteDe = { book: 'ldb', page: 12 };
    const s = ouverteSur({ ...emptyScene('session', 4, 4), startMessage: { texte: 'Ancien.', adapteDe } } as Scene);
    const saisi = jouer(s, surLaScene(s, ['startMessage', 'texte'], texte));
    expect(sceneEditee(saisi).startMessage).toEqual({ texte, adapteDe });
    expect('startMessage' in sceneEditee(jouer(saisi, surLaScene(saisi, ['startMessage', 'texte']))), 'vidé : le message quitte la scène, provenance comprise').toBe(false);
    expect(jouer(saisi, surLaScene(saisi, ['desc'], 'Une salle.')), 'hors du message, la scène n’offre rien').toBe(saisi);
  });
});

describe('le retrait d’un champ que son objet exige (#3606)', () => {
  const retrait = (sorte: SorteDePorteur, id: string, chemin: Segment[]): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte, id }, chemin });
  const FLUX = { kind: 'si', condition: { kind: 'flag', expr: 'porte_ouverte' }, alors: { kind: 'effet', effet: { type: 'setFlag', flag: 'entre' } }, sinon: { kind: 'effet', effet: { type: 'setFlag', flag: 'refoule' } } };

  it('vidé, le drapeau de la condition d’un flux `si` est requis : le flux, qui exige encore sa suite, reste entier', () => {
    const dialogue = { id: 'dlg1', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: 'Une porte close.', choices: [{ id: 'choix1', label: 'Entrer', flow: FLUX }] }] };
    const s = ouverteSur({ ...emptyScene('retrait', 6, 6), dialogues: [dialogue] } as unknown as Scene);
    const g = retrait('dialogue', 'dlg1', ['nodes', 0, 'choices', 0, 'flow', 'condition', 'expr']);
    expect(refusDeLaValeur(s, g)).toBe('requis');
    expect(editer(s, g), 'la session telle quelle').toBe(s);
  });

  it('vidé, le nom d’un profil personnalisé copié du Bestiaire est requis : le profil, qui exige encore ses Caractéristiques, reste', () => {
    const pose = [{ geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'l-ombre-du-fleuve' } }, { geste: 'appui', point: point(1, 1) }, { geste: 'relache', point: point(1, 1) }] satisfies GesteDEdition[];
    const posee = pose.reduce<SessionDEdition>(editer, ouverteSur(emptyScene('retrait', 6, 6)));
    const id = posee.sel?.type === 'entity' ? posee.sel.id : '';
    const s = editer(posee, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['statblock'], valeur: statblockDeLaCreature(findCreatureById('l-ombre-du-fleuve')!) });
    expect(sceneEditee(s).entities.find((e) => e.id === id)?.statblock, 'le profil copié').toBeDefined();
    const g = retrait('entite', id, ['statblock', 'label']);
    expect(refusDeLaValeur(s, g)).toBe('requis');
    expect(editer(s, g), 'la session telle quelle').toBe(s);
  });

  it('vidé, le drapeau de la porte d’un Test de traversée retire la porte, qui ne portait rien d’autre ; le Test reste', () => {
    const zone = { id: 'z1', label: 'Pont-levis', area: { kind: 'rect', x: 0, y: 0, w: 2, h: 2 }, crossTest: { skill: { id: 'athletisme' }, difficulty: 'intermediaire', gate: { kind: 'flag', expr: 'pont_baisse' } } };
    const s = ouverteSur({ ...emptyScene('retrait', 6, 6), effectZones: [zone] } as unknown as Scene);
    const g = retrait('zone', 'z1', ['crossTest', 'gate', 'expr']);
    expect(refusDeLaValeur(s, g)).toBeNull();
    expect(sceneEditee(editer(s, g)).effectZones?.[0].crossTest).toEqual({ skill: { id: 'athletisme' }, difficulty: 'intermediaire' });
  });
});

describe('le porteur `entite` du geste `valeur` (#3606 M1a à M1d)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const poser = (ref: string, x: number, narratif = NARRATIF_VIDE, scene = emptyScene('m1a', 6, 6)) => jouer(ouverteSur(scene, false, narratif), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref } }, { geste: 'appui', point: point(x, 1) }, { geste: 'relache', point: point(x, 1) });
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
    expect(entiteDeLaSelection(sceneEditee(cogue), cogue.sel), 'la coque pirate de l’embuscade').toMatchObject({ vehicule: { id: 'cogue' }, upgrades: [{ id: 'renforce', value: 1 }] });
    const amelioree = jouer(cogue, valeur(coque, ['upgrades', 0, 'value'], 2));
    expect(entiteDeLaSelection(sceneEditee(amelioree), amelioree.sel)?.upgrades).toEqual([{ id: 'renforce', value: 2 }]);
    expect(refusDeLaValeur(griffon, valeur(id, ['upgrades'], [{ id: 'renforce' }])), 'seule une coque porte des Améliorations').toBe('nonOffert');
  });

  it('refuse un chemin que le formulaire n’offre pas : un preset sans preset au narratif, et les sorts d’un personnage qu’aucune liste n’ouvre', () => {
    const griffon = poser('griffon-zoo-imperial', 1);
    const id = idDe(griffon);
    const combat = jouer(griffon, valeur(id, ['combat'], {}));
    expect([refusDeLaValeur(griffon, valeur(id, ['presetId'], 'x')), refusDeLaValeur(combat, valeur(id, ['combat', 'spells'], []))]).toEqual(['nonOffert', 'nonOffert']);
  });

  it('l’apparence s’écrit champ par champ ; ses couleurs, un record, par emplacement de palette, chacun posé à la première couleur du nuancier, puis choisi ; le dernier retiré emporte le record (#3606 M1c)', () => {
    const griffon = poser('griffon-zoo-imperial', 1);
    const id = idDe(griffon);
    const apparence = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)?.appearance;
    const ecrite = jouer(griffon, valeur(id, ['appearance'], {}), valeur(id, ['appearance', 'sex'], 'F'), valeur(id, ['appearance', 'tenue'], 'nu'), valeur(id, ['appearance', 'couleurs'], {}));
    const couleurs = champsDuRecord({ key: 'couleurs', label: 'couleurs', kind: 'object', nullable: true, noeud: couleursSchema }, {}, ['appearance', 'couleurs']);
    expect(couleurs.map((c) => c.key), 'chaque emplacement de palette').toEqual(slotSchema.options);
    const [premiere, seconde] = choixDuNoeud(champsDeclares(couleurs[0].noeud)!.find(([cle]) => cle === 'id')![1])!;
    const peau = jouer(ecrite, valeur(id, ['appearance', 'couleurs', 'peau'], { id: premiere.valeur }), valeur(id, ['appearance', 'couleurs', 'peau', 'id'], seconde.valeur));
    expect(apparence(peau)).toEqual({ sex: 'F', tenue: 'nu', couleurs: { peau: { id: seconde.valeur } } });
    expect(refusDeLaValeur(peau, valeur(id, ['appearance', 'couleurs', 'plumage'], { id: premiere.valeur })), 'une clé hors des emplacements').toBe('nonOffert');
    expect(apparence(jouer(peau, valeur(id, ['appearance', 'couleurs', 'peau'])))).toEqual({ sex: 'F', tenue: 'nu' });
  });

  it('l’apparence des objets d’un personnage enrôlé : chacune de ses armes qui admet une autre apparence que sa forme, l’une de ces apparences ; non enrôlé, aucune (#3606 M1c, #2948)', () => {
    const pose = poser('sergent-du-guet', 1);
    const id = idDe(pose);
    const ent = entiteDeLaSelection(sceneEditee(pose), pose.sel)!;
    expect(choixDuChamp('entite', ent, ['appearance', 'apparencesObjets'], cadreDeLaSession(pose)), 'non enrôlé, il ne tient aucune arme').toEqual([]);
    const enrole = jouer(pose, { geste: 'membre', patch: { rencontre: null, enrole: true } }, valeur(id, ['appearance'], {}), valeur(id, ['appearance', 'apparencesObjets'], {}));
    const cles = choixDuChamp('entite', ent, ['appearance', 'apparencesObjets'], cadreDeLaSession(enrole))!;
    expect(cles.map((c) => c.valeur)).toEqual(['arme-simple']);
    const autres = apparencesAdmissiblesDObjet({ trappingId: 'arme-simple' }).filter((a) => a.id !== findTrappingById('arme-simple')!.shape!.id);
    expect(choixDuChamp('entite', ent, ['appearance', 'apparencesObjets', 'arme-simple'], cadreDeLaSession(enrole))!.map((c) => c.valeur)).toEqual(autres.map((a) => ({ id: a.id })));
    const choisie = jouer(enrole, valeur(id, ['appearance', 'apparencesObjets', 'arme-simple'], { id: autres[0].id }), valeur(id, ['appearance', 'apparencesObjets', 'arme-simple', 'id'], autres[1].id));
    expect(entiteDeLaSelection(sceneEditee(choisie), choisie.sel)?.appearance).toEqual({ apparencesObjets: { 'arme-simple': { id: autres[1].id } } });
    const etrangere = apparences.find((a) => !apparencesAdmissiblesDObjet({ trappingId: 'arme-simple' }).some((b) => b.id === a.id))!;
    expect(refusDeLaValeur(choisie, valeur(id, ['appearance', 'apparencesObjets', 'arme-simple'], { id: etrangere.id })), 'une apparence que l’objet n’admet pas').toBe('horsSorte');
    expect(refusDeLaValeur(choisie, valeur(id, ['appearance', 'apparencesObjets', 'arme-simple'], valeurNeuveDe(recordDuNoeud(apparencesDObjetsSchema)!.valeur))), 'la valeur neuve hors des choix').toBe('horsSorte');
    expect(refusDeLaValeur(enrole, valeur(id, ['appearance', 'apparencesObjets', 'dague'], { id: autres[0].id })), 'un objet hors de ses armes').toBe('nonOffert');
    expect(refusDeLaValeur(enrole, valeur(id, ['appearance', 'apparencesObjets'], 'arme-simple')), 'une clé n’est pas sa valeur').toBe('horsSorte');
  });

  it('le marchand s’écrit champ par champ, son archétype choisi au catalogue, sa majoration positive, son taux de rachat entre 0 et 1, ses jours de réassort entiers ; une valeur hors des choix ou des bornes est refusée (#3606 M1d)', () => {
    const pose = poser('humain', 1);
    const id = idDe(pose);
    const marchand = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)?.merchant;
    const [, second] = MERCHANT_ARCHETYPES;
    const merchant = formulaireDe('entite', entiteDeLaSelection(sceneEditee(pose), pose.sel)!, cadre()).find((f) => f.key === 'merchant')!;
    const archetype = champsDeclares(champsDeclares(merchant.noeud)!.find(([cle]) => cle === 'archetype')![1])!.find(([cle]) => cle === 'id')![1];
    expect(choixDuNoeud(archetype)!.map((o) => o.valeur), 'chaque archétype de marchand du catalogue').toEqual(MERCHANT_ARCHETYPES.map((a) => a.id));
    const ecrit = jouer(pose, valeur(id, ['merchant'], valeurNeuveDe(merchant.noeud)), valeur(id, ['merchant', 'archetype', 'id'], second.id),
      valeur(id, ['merchant', 'settlement'], 'ville'), valeur(id, ['merchant', 'resaleRate'], 0.25), valeur(id, ['merchant', 'buyMarkup'], 1.5), valeur(id, ['merchant', 'restockDays'], 3),
      valeur(id, ['merchant', 'guild'], true), valeur(id, ['merchant', 'marketMode'], 'simplifie'), valeur(id, ['merchant', 'tenirComptes'], false));
    expect(marchand(ecrit)).toEqual({ archetype: { id: second.id }, settlement: 'ville', resaleRate: 0.25, buyMarkup: 1.5, restockDays: 3, guild: true, marketMode: 'simplifie', tenirComptes: false });
    expect([
      refusDeLaValeur(ecrit, valeur(id, ['merchant', 'archetype', 'id'], 'inconnu')),
      refusDeLaValeur(ecrit, valeur(id, ['merchant', 'settlement'], 'hameau')),
      refusDeLaValeur(ecrit, valeur(id, ['merchant', 'resaleRate'], 1.5)),
      refusDeLaValeur(ecrit, valeur(id, ['merchant', 'buyMarkup'], 0)),
      refusDeLaValeur(ecrit, valeur(id, ['merchant', 'restockDays'], -1)),
      refusDeLaValeur(ecrit, valeur(id, ['merchant', 'restockDays'], 1.5)),
    ]).toEqual(['horsSorte', 'horsSorte', 'horsSorte', 'horsSorte', 'horsSorte', 'horsSorte']);
    expect(marchand(jouer(ecrit, valeur(id, ['merchant'])))).toBeUndefined();
  });

  it('le jeu de taverne se choisit au catalogue des jeux, sa mise de départ en sous (NADJ 04 l.72), entière et jamais négative ; un jeu hors du catalogue ou une mise négative ou fractionnaire est refusé (#3606 M1d)', () => {
    const pose = poser('humain', 1);
    const id = idDe(pose);
    const [premier, second] = TAVERN_GAMES;
    const ecrit = jouer(pose, valeur(id, ['tavernGame'], { id: premier.id }), valeur(id, ['tavernGame', 'id'], second.id), valeur(id, ['tavernGame', 'stakeBrass'], 20));
    expect(entiteDeLaSelection(sceneEditee(ecrit), ecrit.sel)?.tavernGame).toEqual({ id: second.id, stakeBrass: 20 });
    expect([refusDeLaValeur(ecrit, valeur(id, ['tavernGame', 'id'], 'inconnu')), refusDeLaValeur(ecrit, valeur(id, ['tavernGame', 'stakeBrass'], -1)), refusDeLaValeur(ecrit, valeur(id, ['tavernGame', 'stakeBrass'], 0.5))]).toEqual(['horsSorte', 'horsSorte', 'horsSorte']);
  });

  it('le dialogue se choisit parmi exactement ceux que sa scène déclare, entier ou par son identifiant ; une scène sans dialogue ne l’offre pas (#3606 M1d)', () => {
    const dialogue = (id: string) => ({ id, start: { id: 'n1' }, nodes: [{ id: 'n1', choices: [] }] });
    const scene = { ...emptyScene('m1d', 6, 6), dialogues: [dialogue('dlg-a'), dialogue('dlg-b')] };
    const pose = poser('humain', 1, NARRATIF_VIDE, scene);
    const id = idDe(pose);
    const ent = entiteDeLaSelection(sceneEditee(pose), pose.sel)!;
    expect(choixDuChamp('entite', ent, ['dialogueId'], cadreDeLaSession(pose))!.map((c) => c.valeur)).toEqual([{ id: 'dlg-a' }, { id: 'dlg-b' }]);
    expect(choixDuChamp('entite', ent, ['dialogueId', 'id'], cadreDeLaSession(pose))!.map((c) => c.valeur)).toEqual(['dlg-a', 'dlg-b']);
    const choisi = jouer(pose, valeur(id, ['dialogueId'], { id: 'dlg-a' }), valeur(id, ['dialogueId', 'id'], 'dlg-b'));
    expect(entiteDeLaSelection(sceneEditee(choisi), choisi.sel)?.dialogueId).toEqual({ id: 'dlg-b' });
    expect([refusDeLaValeur(choisi, valeur(id, ['dialogueId', 'id'], 'dlg-z')), refusDeLaValeur(pose, valeur(id, ['dialogueId'], { id: 'dlg-z' }))]).toEqual(['horsSorte', 'horsSorte']);
    const sansDialogue = poser('humain', 1);
    expect(formulaireDe('entite', entiteDeLaSelection(sceneEditee(sansDialogue), sansDialogue.sel)!, cadreDeLaSession(sansDialogue)).map((f) => f.key)).not.toContain('dialogueId');
    expect(refusDeLaValeur(sansDialogue, valeur(idDe(sansDialogue), ['dialogueId'], { id: 'dlg-a' }))).toBe('nonOffert');
  });

  it('la référence locale d’un effet se choisit parmi exactement sa portée : les scènes du projet, les personnages de la scène, ses marchands (#3606 M2d)', () => {
    const hub = areneProjet.scenes.find((sc) => sc.id === 'arene-hub')! as unknown as Scene;
    const offerts = (effect: Effect, champ: string) => {
      const declencheur = { id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'sequence' as const, etapes: [{ kind: 'effet' as const, effet: effect }] } };
      return choixDuChamp('declencheur', declencheur, ['flow', 'etapes', 0, 'effet', champ, 'id'], { scene: hub, projet: { scenes: areneProjet.scenes as unknown as Scene[], narratif: NARRATIF_VIDE }, source: SANS_SOURCE })!.map((c) => c.valeur);
    };
    expect(offerts({ type: 'transition', scene: { id: 'arene-hub' } }, 'scene')).toEqual(areneProjet.scenes.map((sc) => sc.id));
    const personnages = hub.entities.filter((e) => e.kind === 'personnage');
    expect(offerts({ type: 'medicalAid', acts: [{ act: 'blessures' }], entityId: { id: 'medecin' } }, 'entityId')).toEqual(personnages.map((e) => e.id));
    expect(offerts({ type: 'openMerchant', entityId: { id: 'medecin' } }, 'entityId')).toEqual(personnages.filter((e) => e.merchant).map((e) => e.id));
  });

  it('un profil personnalisé s’ajoute neuf au nom du personnage ou copié de sa créature du Bestiaire, puis s’écrit champ par champ, l’identifiant d’un Talent au catalogue ; une autre valeur entière est refusée (#3606 M1b)', () => {
    const ombre = poser('l-ombre-du-fleuve', 1);
    const id = idDe(ombre);
    const ent = entiteDeLaSelection(sceneEditee(ombre), ombre.sel)!;
    const creature = findCreatureById('l-ombre-du-fleuve')!;
    expect(choixDuChamp('entite', ent, ['statblock'], cadre())!.map((c) => c.valeur)).toEqual([emptyStatblock(creature.label), statblockDeLaCreature(creature)]);
    const copie = jouer(ombre, valeur(id, ['statblock'], statblockDeLaCreature(creature)), valeur(id, ['statblock', 'char', 'force'], 42), valeur(id, ['statblock', 'talents'], [{ id: 'affable' }]));
    expect(entiteDeLaSelection(sceneEditee(copie), copie.sel)?.statblock).toEqual({ ...statblockDeLaCreature(creature), char: { ...statblockDeLaCreature(creature).char, force: 42 }, talents: [{ id: 'affable' }] });
    const talent = formulaireDe('entite', entiteDeLaSelection(sceneEditee(copie), copie.sel)!, cadre()).find((f) => f.key === 'statblock')!;
    const idDuTalent = champsDeclares(elementDuNoeud(champsDeclares(talent.noeud)!.find(([cle]) => cle === 'talents')![1]))!.find(([cle]) => cle === 'id')![1];
    expect(choixDuNoeud(idDuTalent)!.map((o) => o.valeur), 'l’identifiant d’un Talent : chaque Talent du catalogue').toEqual(talents.map((t) => t.id));
    expect(refusDeLaValeur(ombre, valeur(id, ['statblock'], { type: 'statblock', label: 'autre', char: {} })), 'ni neuf ni copié').toBe('horsSorte');
  });

  it('un preset du narratif se choisit parmi ceux qu’il déclare, par son nom ; sans preset au narratif ni posé, il n’est pas offert (#3606 M1b)', () => {
    const narratif = { ...NARRATIF_VIDE, presetsPnj: [{ id: 'aubergiste', base: { id: 'humain' }, profil: { label: 'Aubergiste' } }] };
    const pose = poser('humain', 1, narratif as typeof NARRATIF_VIDE);
    const id = idDe(pose);
    const ent = entiteDeLaSelection(sceneEditee(pose), pose.sel)!;
    expect(choixDuChamp('entite', ent, ['presetId'], cadre(narratif as typeof NARRATIF_VIDE))).toEqual([{ valeur: 'aubergiste', libelle: 'Aubergiste', refus: null }]);
    expect(entiteDeLaSelection(sceneEditee(jouer(pose, valeur(id, ['presetId'], 'aubergiste'))), pose.sel)?.presetId).toBe('aubergiste');
    expect(formulaireDe('entite', ent, cadre()).map((f) => f.key)).not.toContain('presetId');
  });

  it('pour chaque créature du Bestiaire, un profil offert sans refus s’écrit en une entité que le schéma admet ; une copie que son schéma refuse le dit (#3606 M1b)', () => {
    const fautives: string[] = [];
    let refusees = 0;
    for (const c of creatures) {
      const ent = { id: 'e1', kind: 'personnage', pos: { x: 1, y: 1 }, creature: { id: c.id } } as const;
      for (const choix of choixDuChamp('entite', ent, ['statblock'], cadre()) ?? []) {
        if (choix.refus !== null) { refusees++; continue; }
        const ecrite = avecLaValeurDuPorteur('entite', ent, ['statblock'], choix.valeur, cadre());
        if (!ecrite.ok || !sceneEntitySchema.safeParse(ecrite.valeur).success) fautives.push(`${c.id} : ${choix.libelle}`);
      }
    }
    expect(fautives).toEqual([]);
    expect(refusees, 'des copies du Bestiaire sont refusées, chacune de sa raison').toBeGreaterThan(0);
  });

  it('un PNJ de carrière ne se voit offrir ni profil personnalisé, ni preset, ni tenue, qu’il ne porte pas ; le reste de son apparence, si (#3606 M1b, M1c)', () => {
    const narratif = { ...NARRATIF_VIDE, presetsPnj: [{ id: 'aubergiste', base: { id: 'humain' }, profil: { label: 'Aubergiste' } }] } as typeof NARRATIF_VIDE;
    const pnj = { id: 'p', kind: 'personnage', pos: { x: 1, y: 1 }, creature: { id: 'humain' }, carrieres: { medecin: 3 } } as const;
    expect(refusDeLEntite(pnj)).toEqual([]);
    const champs = formulaireDe('entite', pnj, cadre(narratif)).map((f) => f.key);
    expect([champs.includes('statblock'), champs.includes('presetId')]).toEqual([false, false]);
    const s = ouverteSur({ ...emptyScene('m1b', 4, 4), entities: [pnj] }, false, narratif);
    expect([refusDeLaValeur(s, valeur('p', ['statblock'], emptyStatblock()))]).toEqual(['nonOffert']);
    const habille = jouer(s, valeur('p', ['appearance'], {}));
    expect([refusDeLaValeur(habille, valeur('p', ['appearance', 'tenue'], 'nu')), refusDeLaValeur(habille, valeur('p', ['appearance', 'sex'], 'F'))]).toEqual(['nonOffert', null]);
  });

  it('les options : tous les Traits, ceux de la fiche en tête puis les Traits standard (LDB 76 l.11, l.35) ; une note « swap » de la fiche se pose entière', () => {
    const griffon = poser('griffon-zoo-imperial', 1);
    const id = idDe(griffon);
    const avecTrait = jouer(griffon, valeur(id, ['combat'], {}), valeur(id, ['combat', 'optionals'], [{ id: 'rapide' }]));
    const ent = entiteDeLaSelection(sceneEditee(avecTrait), avecTrait.sel)!;
    const offerts = choixDuChamp('entite', ent, ['combat', 'optionals', 0, 'id'], cadre())!.map((o) => o.valeur);
    const facultatifs = findCreatureById('griffon-zoo-imperial')!.optionals.flatMap((o) => ('id' in o && offerts.includes(o.id) ? [o.id] : []));
    const standard = traits.filter((t) => t.standard && !facultatifs.includes(t.id)).map((t) => t.id);
    expect(offerts).toHaveLength(traits.length);
    expect(offerts.slice(0, facultatifs.length + standard.length)).toEqual([...facultatifs, ...standard]);
    const note = findCreatureById('griffon-zoo-imperial')!.optionals.find((o) => 'note' in o && o.note === 'swap');
    const variantes = choixDuChamp('entite', ent, ['combat', 'optionals', 0], cadre())!;
    expect(variantes.map((v) => v.valeur)).toEqual([{ id: 'rapide' }, note]);
    const posee = jouer(avecTrait, valeur(id, ['combat', 'optionals', 0], note));
    expect(entiteDeLaSelection(sceneEditee(posee), posee.sel)?.combat?.optionals).toEqual([note]);
    const editee = jouer(posee, valeur(id, ['combat', 'optionals', 0, 'wounds'], 30));
    expect(entiteDeLaSelection(sceneEditee(editee), editee.sel)?.combat?.optionals?.[0], 'posée, la note s’édite').toEqual({ ...note, wounds: 30 });
  });

  it('les fautes croisées d’une entité (`refusDeLEntite`) : le type non nommé, deux corps, l’engin qui n’est pas de siège, le PNJ de carrière fautif, le calage et le cap d’un décor, que le `superRefine` de `sceneEntitySchema` dit à leur champ (#1882)', () => {
    const fixtures = {
    sansPorteur: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } },
    deuxCorps: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, vehicule: { id: 'cogue' } },
    enginHorsSiege: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, engin: { id: 'baton-de-combat' } },
    carriereSurStatbloc: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, carrieres: { soldat: 1 }, appearance: { tenue: 'soldat' } },
    volumiqueEnDiagonale: { id: 'd', kind: 'prop', pos: { x: 0, y: 0 }, decor: { id: 'brasero' }, facing: 'NE' },
    decorHorsDeSaCase: { id: 'd', kind: 'prop', pos: { x: 0, y: 0 }, decor: { id: 'brasero' }, calage: { x: 2, y: 0 } },
    admise: { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' } },
    } as const;
    const fautes = (ent: (typeof fixtures)[keyof typeof fixtures]) => refusDeLEntite(ent as Parameters<typeof refusDeLEntite>[0]);
    expect(fautes(fixtures.sansPorteur).map((f) => f.chemin)).toEqual([['creature']]);
    expect(fautes(fixtures.deuxCorps).map((f) => f.chemin)).toEqual([['vehicule']]);
    expect(fautes(fixtures.enginHorsSiege)).toEqual([{ chemin: ['engin', 'id'], message: '« baton-de-combat » n\'est pas un engin de siège' }]);
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
  const caraque = { id: 'navire-0', kind: 'personnage', vehicule: { id: 'caraque' }, pos: { x: 10, y: 6 }, facing: 'E', label: 'Caraque' };

  it('l’outil navire pose la caraque à la case visée, à son cap, sélectionnée : la scène éditée ne porte que son entité', () => {
    const s = poserLaCaraque(ouverteSur(bassin()));
    expect(sceneEditee(s)).toEqual({ ...bassin(), entities: [caraque] });
    expect(s.sel).toEqual({ type: 'entity', id: 'navire-0' });
    expect(s.historique.passe).toHaveLength(1);
  });

  it('ses ponts sont des couches de la vue, où l’on vise : une case de pont désigne le navire, un personnage s’y pose', () => {
    const s = poserLaCaraque(ouverteSur(bassin()));
    expect(vueDeLaScene(s).layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
    const surLePont = editer(editer(s, { geste: 'outil', outil: { mode: 'selection' } }), { geste: 'couche', z: 2 });
    expect(surLePont.z).toBe(2);
    const [x, y] = garanti([...provenanceDesNavires(vueDeLaScene(s)).cases.keys()].find((cle) => cle.endsWith(',2')), 'pont', 'case du pont 2').split(',').map(Number);
    const vise = editer(surLePont, { geste: 'appui', point: point(x, y) });
    expect([vise.sel, vise.pointee]).toEqual([{ type: 'entity', id: 'navire-0' }, { x, y, z: 2 }]);
    const marin = editer(editer(surLePont, { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'humain' } }), { geste: 'appui', point: point(x, y) });
    expect(sceneEditee(marin).entities.find((e) => e.creature?.id === 'humain')).toMatchObject({ pos: { x, y }, z: 2 });
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

  it('un navire chargé de biais ne fait pas tomber la vue : ses ponts ne s’y posent pas, et l’avertissement le dit', () => {
    const s = ouverteSur({ ...bassin(), entities: [{ ...caraque, facing: 'NE' }] } as Scene);
    expect(vueDeLaScene(s).layers.map((l) => l.z)).toEqual([0]);
    expect(avertissementsDeLaSession(s).filter((w) => w.refId === 'navire-0').map((w) => [w.level, w.message])).toEqual([
      ['error', expect.stringContaining("navire « caraque » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)")],
    ]);
  });

  it('le formulaire tiré du schéma n’écrit pas le cap d’un navire : seul le choix du cap le tourne, aux cardinaux', () => {
    const s = poserLaCaraque(ouverteSur(bassin()));
    expect(refusDeLaValeur(s, { geste: 'valeur', porteur: { sorte: 'entite', id: 'navire-0' }, chemin: ['facing'], valeur: 'NE' })).toBe('nonOffert');
    expect(capsOfferts(garanti(sceneEditee(s).entities[0], 'navire', 'entité'))).toEqual(['N', 'E', 'S', 'O']);
  });

  it('la validation lit le monde sur la vue : un départ, une empreinte, une chute, un appui sur un pont de la caraque, sans faux avertissement', () => {
    const vue = poserLesNavires({ ...bassin(), entities: [caraque] } as Scene);
    const [x, y] = garanti([...provenanceDesNavires(vue).cases.keys()].map((cle) => cle.split(',').map(Number))
      .find(([cx, cy, cz]) => cz === 2 && isWalkable(vue, cx, cy, 2)), 'pont', 'case marchable du pont 2');
    const depart = (p: { x: number; y: number }) => ({ ...bassin(), entities: [caraque, { id: 'depart', kind: 'heroStart', pos: p, z: 2 }] } as Scene);
    expect(validateScene([depart({ x, y })]).filter((w) => w.refId === 'depart' || w.message.includes('inatteignable'))).toEqual([]);
    const [bx, by] = garanti([...provenanceDesNavires(vue).cases.keys()].map((cle) => cle.split(',').map(Number))
      .find(([cx, cy, cz]) => cz === 2 && !isWalkable(vue, cx, cy, 2)), 'pont', 'case barrée du pont 2');
    expect(validateScene([depart({ x: bx, y: by })]).filter((w) => w.refId === 'depart').map((w) => w.message), 'une case barrée du pont se dit')
      .toEqual([expect.stringContaining("la case n'est pas marchable")]);
    const abordage = (p: { x: number; y: number }) => validateScene([{ ...bassin(), entities: [caraque, { id: 'marin', kind: 'personnage', creature: { id: 'humain' }, pos: p, z: 2 }],
      encounters: [{ id: 'abordage', members: [{ entityId: 'marin' }] }] } as Scene]).filter((w) => w.refId === 'marin' && w.message.includes('non marchable'));
    expect([abordage({ x, y }).length, abordage({ x: bx, y: by }).length], 'l’empreinte d’un membre se juge sur le pont').toEqual([0, 1]);
    const chute = (to: { x: number; y: number }) => validateScene([{ ...bassin(), entities: [caraque],
      triggers: [{ id: 'saut', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'fall', target: 'groupe', metres: 2, to: { ...to, z: 2 } }] as Effect[]) }] } as Scene])
      .filter((w) => w.refId === 'saut' && w.message.startsWith('Chute')).length;
    expect([chute({ x, y }), chute({ x: bx, y: by })], 'l’atterrissage d’une chute se juge sur le pont').toEqual([0, 1]);
    const lettre = garanti(vue.entities.filter((e) => e.kind === 'prop' && e.id.startsWith('navire-0-'))
      .map((sup) => ({ id: 'lettre', kind: 'prop' as const, decor: { id: 'lettre' }, pos: sup.pos, z: sup.z, sur: sup.id })).find((e) => !fauteDAppui(vue, e)), 'pont', 'décor du pont qui porte');
    expect(validateScene([{ ...bassin(), entities: [caraque, lettre] } as Scene]).filter((w) => w.refId === 'lettre'), 'un décor posé sur un décor du pont tient').toEqual([]);
  });

  it('la volée lit la vue : ses étages comptent les ponts, et une couche que seuls les ponts posent la refuse', () => {
    const s = editer(editer(poserLaCaraque(ouverteSur(bassin())), { geste: 'outil', outil: { mode: 'escalier', toZ: 2 } }), { geste: 'appui', point: point(2, 2) });
    expect(s.volee).toHaveLength(1);
    expect(planDeLaVolee(s)).not.toEqual({ ok: false, reason: 'étage to=z2 inexistant' });
    const surLePont = editer(editer(s, { geste: 'couche', z: 2 }), { geste: 'outil', outil: { mode: 'escalier', toZ: 3 } });
    expect(planDeLaVolee(surLePont)).toEqual({ ok: false, reason: "couche z2 des seuls ponts d'un navire : la volée ne s'y écrit pas" });
  });

  it('changer d’échelle vers celle du plan pose les ponts d’un navire, toujours à un cap cardinal', () => {
    const s = editer(ouverteSur({ ...bassin(3), entities: [caraque] } as Scene), { geste: 'scene', patch: { scalaires: { metresPerTile: 2 } } });
    expect(vueDeLaScene(s).layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
  });
});

describe('les actions d’un décor au formulaire tiré du schéma (#3606 M1e)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const poser = (ref: string) => jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'prop', ref } }, { geste: 'appui', point: point(1, 1) }, { geste: 'relache', point: point(1, 1) });
  const decor = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)!;
  const valeur = (s: SessionDEdition, chemin: Segment[], v?: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'entite', id: decor(s).id }, chemin, ...(v === undefined ? {} : { valeur: v }) });
  const choixDuDecor = (s: SessionDEdition, chemin: Segment[]) => choixDuChamp('entite', decor(s), chemin, cadreDeLaSession(s))?.map((c) => c.valeur);
  const fouille = (id: string) => ({ id, flow: { kind: 'sequence', etapes: [] }, unique: true });

  it('une action s’ajoute sous le premier identifiant libre, s’écrit champ par champ, se renomme par son geste dédié sous un identifiant libre seulement ; la dernière retirée, l’utilisable part', () => {
    const pose = poser('brasero');
    expect(formulaireDe('entite', decor(pose), cadreDeLaSession(pose)).map((f) => f.key)).toEqual(['usable']);
    expect(choixDuDecor(pose, ['usable']), 'l’utilisable absent se pose avec sa première action').toEqual([{ actions: [fouille('fouiller')] }]);
    const une = jouer(pose, valeur(pose, ['usable'], { actions: [fouille('fouiller')] }));
    expect(choixDuDecor(une, ['usable', 'actions', 1])).toEqual([fouille('fouiller-2')]);
    const deux = jouer(une, valeur(une, ['usable', 'actions'], [fouille('fouiller'), fouille('fouiller-2')]));
    const ecrite = jouer(deux, valeur(deux, ['usable', 'actions', 1, 'label'], 'Ouvrir le coffre'), valeur(deux, ['usable', 'actions', 1, 'consume'], true),
      valeur(deux, ['usable', 'actions', 1, 'unique'], false), valeur(deux, ['usable', 'actions', 1, 'minutes'], 5));
    expect(decor(ecrite).usable?.actions?.[1]).toEqual({ id: 'fouiller-2', label: 'Ouvrir le coffre', flow: { kind: 'sequence', etapes: [] }, consume: true, unique: false, minutes: 5 });
    expect(refusDeLaValeur(ecrite, valeur(ecrite, ['usable', 'actions', 1, 'id'], 'coffre')), 'l’identifiant ne s’écrit qu’à son geste dédié').toBe('nonOffert');
    const pas = flowFromEffects([{ type: 'endDialogue' }]);
    const enchainee = jouer(ecrite, valeur(ecrite, ['usable', 'actions', 1, 'flow'], pas));
    expect(decor(enchainee).usable?.actions?.[1].flow, 'l’enchaînement s’écrit entier').toEqual(pas);
    expect(refusDeLaValeur(ecrite, valeur(ecrite, ['usable', 'actions', 1, 'flow', 'etapes'], [null])), 'un pas que son schéma ne bâtit pas').toBe('horsSorte');
    const renommee = jouer(ecrite, { geste: 'identifier', element: 'fouiller-2', id: ' coffre ' });
    expect(decor(renommee).usable?.actions?.map((a) => a.id)).toEqual(['fouiller', 'coffre']);
    expect(jouer(renommee, { geste: 'identifier', element: 'coffre', id: 'fouiller' }), 'un identifiant déjà porté : aucun cran').toBe(renommee);
    expect(jouer(renommee, { geste: 'identifier', element: 'coffre', id: ' ' }), 'un identifiant vide : aucun cran').toBe(renommee);
    const retiree = jouer(renommee, valeur(renommee, ['usable', 'actions'], [decor(renommee).usable!.actions![1]]), valeur(renommee, ['usable', 'actions'], []));
    expect(decor(retiree).usable).toBeUndefined();
  });

  it('l’utilisable ne s’écrit entier, retrait compris, que s’il n’emporte que ce que le formulaire offre : avec l’assise posée à ses places, refusé ; sans elle, admis', () => {
    const table = jouer(poser('table-ronde-4-tabourets'), { geste: 'entite', patch: { assise: true } });
    const actions = decor(table).usable?.actions ?? [];
    const assise = jouer(table, valeur(table, ['usable', 'actions'], [...actions, ...choixDuDecor(table, ['usable', 'actions', actions.length])!]));
    const usable = (s: SessionDEdition) => formulaireDe('entite', decor(s), cadreDeLaSession(s)).find((f) => f.key === 'usable')!;
    expect(usable(assise).contexte!.ecrivable(['usable'], decor(assise).usable)).toBe(false);
    expect([refusDeLaValeur(assise, valeur(assise, ['usable'])), refusDeLaValeur(assise, valeur(assise, ['usable'], {}))]).toEqual(['nonOffert', 'nonOffert']);
    const brasero = poser('brasero');
    const sansAssise = jouer(brasero, valeur(brasero, ['usable'], { actions: [fouille('fouiller')] }));
    expect(usable(sansAssise).contexte!.ecrivable(['usable'], decor(sansAssise).usable)).toBe(true);
    expect(decor(jouer(sansAssise, valeur(sansAssise, ['usable']))).usable).toBeUndefined();
  });

  it('l’assise posée à ses places reste quand la dernière action part', () => {
    const table = jouer(poser('table-ronde-4-tabourets'), { geste: 'entite', patch: { assise: true } });
    const actions = decor(table).usable?.actions ?? [];
    const neuve = choixDuDecor(table, ['usable', 'actions', actions.length])!;
    const avec = jouer(table, valeur(table, ['usable', 'actions'], [...actions, ...neuve]));
    expect(decor(avec).usable?.actions).toHaveLength(actions.length + 1);
    expect(decor(jouer(avec, valeur(avec, ['usable', 'actions'], []))).usable).toEqual({ assise: true });
  });
});

describe('les postes d’une coque au formulaire tiré du schéma (#3606 M1f)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const barge = allBuiltinCampaigns.find((c) => c.id === 'barge-du-sel')!;
  const cogue = jouer(ouvrirLEdition(paquetDuJeu(barge), false), { geste: 'scenes', quoi: 'aller', id: 'barge-du-sel-embuscade' }, { geste: 'appui', point: point(18, 7) }, { geste: 'relache', point: point(18, 7) });
  const coque = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)!;
  const valeur = (chemin: Segment[], v: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'entite', id: coque(cogue).id }, chemin, valeur: v });
  const choix = (s: SessionDEdition, chemin: Segment[]) => choixDuChamp('entite', coque(s), chemin, cadreDeLaSession(s))?.map((c) => c.valeur);
  const engins = siegeEngines().map((e) => e.id);

  it('un poste s’ajoute par son engin de siège, sa pièce se choisit parmi eux, ses servants parmi les personnages de la scène sans coque ni autre poste, son coffre parmi les munitions de sa pièce, sa munition dans son coffre, qu’elle ne quitte pas', () => {
    const postes = coque(cogue).postes!;
    expect(formulaireDe('entite', coque(cogue), cadreDeLaSession(cogue)).map((f) => f.key)).toContain('postes');
    expect(choix(cogue, ['postes', postes.length])).toEqual(engins.map((trappingId) => ({ trappingId })));
    const ajoute = jouer(cogue, valeur(['postes'], [...postes, { trappingId: engins[0] }]), valeur(['postes', postes.length, 'trappingId'], engins[1]));
    expect(coque(ajoute).postes?.[postes.length]).toEqual({ trappingId: engins[1] });
    expect(choix(ajoute, ['postes', postes.length, 'trappingId'])).toEqual(engins);
    expect(refusDeLaValeur(ajoute, valeur(['postes', postes.length, 'trappingId'], 'pas-une-piece')), 'une pièce hors catalogue').toBe('horsSorte');
    const entites = sceneEditee(cogue).entities;
    expect(entites.some((e) => e.vehicule && e.id !== coque(cogue).id), 'la scène pose une autre coque').toBe(true);
    const equipage = entites.filter((e) => e.kind === 'personnage' && !e.vehicule).map((e) => e.id);
    expect(equipage.length, 'la scène pose des personnages sans coque').toBeGreaterThan(1);
    expect(choix(ajoute, ['postes', postes.length, 'crewIds', 0])).toEqual(equipage);
    const servi = jouer(ajoute, valeur(['postes', postes.length, 'crewIds'], [equipage[0]]));
    expect(choix(servi, ['postes', postes.length, 'crewIds', 1]), 'un servant ne sert qu’une fois le poste').toEqual(equipage.slice(1));
    expect(choix(servi, ['postes', 0, 'crewIds', 0]), 'ni un autre poste de la coque').toEqual(equipage.slice(1));
    expect(choix(servi, ['postes', postes.length, 'crewIds', 0]), 'le servant courant reste offert').toEqual(equipage);
    expect(coque(cogue).postes![0].trappingId).toBe('canon-moyen');
    expect([...(choix(cogue, ['postes', 0, 'ammo']) as string[])].sort(), 'canon → boulet et mitraille seulement').toEqual(['boulet-et-poudre', 'mitraille-et-poudre']);
    expect(choix(jouer(ajoute, valeur(['postes', postes.length, 'trappingId'], 'belier-ade2')), ['postes', postes.length, 'ammo']), 'bélier → aucune').toEqual([]);
    expect(refusDeLaValeur(cogue, valeur(['postes', 0, 'ammo', 'carreau-de-baliste'], 2)), 'un carreau n’est pas offert au coffre d’un canon').toBe('nonOffert');
    const canonACarreaux = { ...coque(cogue), postes: [{ trappingId: 'canon-moyen', ammo: { 'carreau-de-baliste': 2, 'boulet-et-poudre': 4 } }] };
    expect(refusDeLEntite(canonACarreaux as Parameters<typeof refusDeLEntite>[0]), 'le parse refuse un carreau au coffre d’un canon')
      .toEqual([{ chemin: ['postes', 0, 'ammo', 'carreau-de-baliste'], message: expect.stringContaining('ne charge pas') }]);
    const dote = jouer(cogue, valeur(['postes', 0, 'ammo', 'mitraille-et-poudre'], 3));
    expect(coque(dote).postes![0].ammo).toMatchObject({ 'mitraille-et-poudre': 3 });
    expect(refusDeLaValeur(dote, valeur(['postes', 0, 'ammo', 'mitraille-et-poudre'], 0)), 'une quantité nulle').toBe('horsSorte');
    expect(choix(dote, ['postes', 0, 'selectedAmmo', 'id'])).toEqual(Object.keys(coque(dote).postes![0].ammo!));
    const choisie = jouer(dote, valeur(['postes', 0, 'selectedAmmo', 'id'], 'mitraille-et-poudre'));
    expect(coque(choisie).postes![0].selectedAmmo).toEqual({ id: 'mitraille-et-poudre' });
    expect(refusDeLaValeur(choisie, valeur(['postes', 0, 'ammo', 'mitraille-et-poudre'], undefined)), 'la munition choisie quitte le coffre')
      .toEqual({ regle: expect.stringContaining('hors du coffre') });
  });

  it('seule une coque offre ses postes', () => {
    const pnj = jouer(ouverte(), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: 'griffon-zoo-imperial' } }, { geste: 'appui', point: point(1, 1) }, { geste: 'relache', point: point(1, 1) });
    const id = entiteDeLaSelection(sceneEditee(pnj), pnj.sel)!.id;
    expect(refusDeLaValeur(pnj, { geste: 'valeur', porteur: { sorte: 'entite', id }, chemin: ['postes'], valeur: [{ trappingId: engins[0] }] })).toBe('nonOffert');
  });
});

describe('les dialogues de la scène éditée, par la table d’écriture de leur sorte (#3606 M3b1b)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const dialogue = (id: string, nodes: Scene['dialogues'][number]['nodes'] = [{ id: 'n1', choices: [] }]) => ({ id, start: { id: nodes[0].id }, nodes });
  /** Le dialogue `accueil`, ouvert par le PNJ `aubergiste` ; `rumeurs`, par le déclencheur `seuil` ; `libre`, par personne. */
  const AUBERGE: Scene = {
    ...emptyScene('auberge', 6, 6),
    entities: [{ id: 'aubergiste', kind: 'personnage', pos: { x: 2, y: 2 }, creature: { id: 'humain' }, dialogueId: { id: 'accueil' } }],
    triggers: [{ id: 'seuil', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'startDialogue', dialogue: { id: 'rumeurs' } }] as Effect[]) }],
    dialogues: [dialogue('accueil'), dialogue('rumeurs'), dialogue('libre')],
  };
  const choisi = (sorte: 'dialogue' | 'declencheur', id: string) => jouer(ouverteSur(AUBERGE), { geste: 'selectionner', porteur: { sorte, id } });

  it('ajouter crée un dialogue sur un cran et le sélectionne ; une sorte qui ne se crée pas par la table est sans objet', () => {
    const s = ouverteSur(AUBERGE);
    const ajoute = jouer(s, { geste: 'ajouter', sorte: 'dialogue' });
    const neuf = sceneEditee(ajoute).dialogues[sceneEditee(ajoute).dialogues.length - 1];
    expect([ajoute.sel, sceneEditee(ajoute).dialogues.length, ajoute.historique.passe.length]).toEqual([{ type: 'dialogue', id: neuf.id }, 4, s.historique.passe.length + 1]);
    expect(jouer(s, { geste: 'ajouter', sorte: 'zone' })).toBe(s);
  });

  it('sélectionner pose la sélection du porteur ; un porteur absent est sans objet', () => {
    expect(choisi('dialogue', 'libre').sel).toEqual({ type: 'dialogue', id: 'libre' });
    const s = ouverteSur(AUBERGE);
    expect(jouer(s, { geste: 'selectionner', porteur: { sorte: 'dialogue', id: 'absent' } })).toBe(s);
  });

  it('nommer un dialogue le renomme, propagé au dialogue du PNJ et à « Ouvrir un dialogue », resélectionné ; un nom pris est sans objet', () => {
    const accueil = jouer(choisi('dialogue', 'accueil'), { geste: 'nommer', nom: ' bienvenue ' });
    expect([accueil.sel, sceneEditee(accueil).entities[0].dialogueId]).toEqual([{ type: 'dialogue', id: 'bienvenue' }, { id: 'bienvenue' }]);
    const rumeurs = jouer(choisi('dialogue', 'rumeurs'), { geste: 'nommer', nom: 'ragots' });
    expect([rumeurs.sel, JSON.stringify(sceneEditee(rumeurs).triggers[0].flow).includes('"ragots"')]).toEqual([{ type: 'dialogue', id: 'ragots' }, true]);
    const pris = choisi('dialogue', 'rumeurs');
    expect(jouer(pris, { geste: 'nommer', nom: 'libre' })).toBe(pris);
  });

  it('supprimer un dialogue référencé est sans objet, et son refus se dit ; un dialogue libre se retire sur un cran, annulable', () => {
    for (const id of ['accueil', 'rumeurs']) {
      const s = choisi('dialogue', id);
      expect(jouer(s, { geste: 'supprimer' }), id).toBe(s);
      expect(refusDeRetrait(s), id).toContain(`« ${id} »`);
    }
    const s = choisi('dialogue', 'libre');
    expect(refusDeRetrait(s)).toBeNull();
    const retire = jouer(s, { geste: 'supprimer' });
    expect([retire.sel, sceneEditee(retire).dialogues.map((d) => d.id), retire.historique.passe.length]).toEqual([null, ['accueil', 'rumeurs'], s.historique.passe.length + 1]);
    expect(sceneEditee(jouer(retire, { geste: 'annuler' })).dialogues.map((d) => d.id)).toEqual(['accueil', 'rumeurs', 'libre']);
  });

  it('identifier un nœud du dialogue sélectionné le renomme, propagé au départ et à chaque suite ; un nom pris est sans objet', () => {
    const scene = { ...AUBERGE, dialogues: [dialogue('libre', [{ id: 'n1', choices: [{ id: 'c1', label: 'Et ?', next: { id: 'n2' } }] }, { id: 'n2', choices: [{ id: 'c2', label: 'Encore', next: { id: 'n2' } }] }])] };
    const s = jouer(ouverteSur(scene), { geste: 'selectionner', porteur: { sorte: 'dialogue', id: 'libre' } });
    const suite = sceneEditee(jouer(s, { geste: 'identifier', element: 'n2', id: ' suite ' })).dialogues[0];
    expect([suite.nodes.map((n) => n.id), suite.nodes.map((n) => n.choices[0].next?.id)]).toEqual([['n1', 'suite'], ['suite', 'suite']]);
    expect(sceneEditee(jouer(s, { geste: 'identifier', element: 'n1', id: 'tete' })).dialogues[0].start).toEqual({ id: 'tete' });
    expect(jouer(s, { geste: 'identifier', element: 'n1', id: 'n2' })).toBe(s);
  });

  it('le déclencheur se renomme et se retire par la table de sa sorte, comme avant elle', () => {
    const renomme = jouer(choisi('declencheur', 'seuil'), { geste: 'nommer', nom: ' porte ' });
    expect([renomme.sel, sceneEditee(renomme).triggers.map((t) => t.id)]).toEqual([{ type: 'trigger', id: 'porte' }, ['porte']]);
    const s = choisi('declencheur', 'seuil');
    expect(refusDeRetrait(s)).toBeNull();
    const retire = jouer(s, { geste: 'supprimer' });
    expect([retire.sel, sceneEditee(retire).triggers]).toEqual([null, []]);
  });

  it('un avertissement d’un dialogue sélectionne ce dialogue', () => {
    const casse = { ...AUBERGE, dialogues: [...AUBERGE.dialogues, { id: 'casse', start: { id: 'absent' }, nodes: [{ id: 'n1', choices: [] }] }] };
    const s = ouverteSur(casse);
    const rang = avertissementsDeLaSession(s).findIndex((w) => w.scope === 'dialogue' && w.refId === 'casse');
    expect(rang).toBeGreaterThanOrEqual(0);
    expect(jouer(s, { geste: 'avertissement', rang }).sel).toEqual({ type: 'dialogue', id: 'casse' });
  });
});

describe('les rencontres de la scène éditée, par la table d’écriture de leur sorte (#3606 M4b)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const personnage = (id: string): Scene['entities'][number] => ({ id, kind: 'personnage', pos: { x: 1, y: 1 }, creature: { id: 'humain' } });
  /** `enc-bois`, lancée par le déclencheur `lisiere` et l'embuscade de la route `route-bois` ; `enc-pont`, par la
   *  poursuite du déclencheur `pont` ; `enc-libre`, par personne. Dans `enc-bois`, `cavalier` chevauche `cheval`. */
  const CLAIRIERE: Scene = {
    ...emptyScene('clairiere', 6, 6),
    entities: ['cavalier', 'cheval', 'archer', 'badaud'].map(personnage),
    triggers: [
      { id: 'lisiere', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'startCombat', encounter: { id: 'enc-bois' } }] as Effect[]) },
      { id: 'pont', rect: { x: 1, y: 0, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { id: 'humain' } }], encounter: { id: 'enc-pont' } }] as Effect[]) },
    ],
    encounters: [
      { id: 'enc-bois', members: [{ entityId: 'cavalier', ridesEntityId: { id: 'cheval' } }, { entityId: 'cheval', mount: true }, { entityId: 'archer' }] },
      { id: 'enc-pont', members: [] },
      { id: 'enc-libre', members: [] },
    ],
  };
  const CARTE = {
    ...emptyWorldMap('carte'),
    routes: [{ id: 'route-bois', a: { id: 'x' }, b: { id: 'y' }, km: 1, modes: ['pied'], ambush: { scene: { id: 'clairiere' }, encounter: 'enc-bois' } }],
  } satisfies WorldMap;
  const ouverteSurLaCarte = (worldMap: WorldMap) => ouvrirLEdition({ scenes: [CLAIRIERE], narratif: NARRATIF_VIDE, worldMap } as unknown as Parameters<typeof ouvrirLEdition>[0], false);
  const choisie = (id: string, worldMap: WorldMap = CARTE) => jouer(ouverteSurLaCarte(worldMap), { geste: 'selectionner', porteur: { sorte: 'rencontre', id } });
  const ids = (s: SessionDEdition) => sceneEditee(s).encounters.map((e) => e.id);

  it('ajouter crée une rencontre sans membre sur un cran et la sélectionne', () => {
    const s = ouverteSurLaCarte(CARTE);
    const ajoute = jouer(s, { geste: 'ajouter', sorte: 'rencontre' });
    const neuve = sceneEditee(ajoute).encounters[3];
    expect([ajoute.sel, neuve.members, ajoute.historique.passe.length]).toEqual([{ type: 'encounter', id: neuve.id }, [], s.historique.passe.length + 1]);
  });

  it('nommer une rencontre la renomme, propagé à « Démarrer un combat » et à la poursuite, resélectionnée ; un nom pris est sans objet', () => {
    const bois = jouer(choisie('enc-bois', emptyWorldMap('carte')), { geste: 'nommer', nom: ' enc-foret ' });
    expect([bois.sel, ids(bois), JSON.stringify(sceneEditee(bois).triggers[0].flow).includes('"enc-foret"')]).toEqual([{ type: 'encounter', id: 'enc-foret' }, ['enc-foret', 'enc-pont', 'enc-libre'], true]);
    const pont = jouer(choisie('enc-pont'), { geste: 'nommer', nom: 'enc-gue' });
    expect(JSON.stringify(sceneEditee(pont).triggers[1].flow).includes('"enc-gue"')).toBe(true);
    expect(validateScene([sceneEditee(pont)]).filter((w) => w.level === 'error' && w.message.includes('catalogue des rencontres'))).toEqual([]);
    const pris = choisie('enc-pont');
    expect(jouer(pris, { geste: 'nommer', nom: 'enc-libre' })).toBe(pris);
  });

  it('nommer une rencontre qu’une embuscade de route du projet lance la renomme à l’embuscade de chaque route qui vise sa scène, sur un cran ; son retrait reste refusé, la route dite (#3606)', () => {
    const ailleurs = { id: 'route-ailleurs', a: { id: 'x' }, b: { id: 'y' }, km: 1, modes: ['pied'], ambush: { scene: { id: 'autre' }, encounter: 'enc-bois' } } satisfies WorldMap['routes'][number];
    const s = choisie('enc-bois', { ...CARTE, routes: [...CARTE.routes, ailleurs] });
    const renomme = jouer(s, { geste: 'nommer', nom: ' enc-foret ' });
    expect([renomme.sel, ids(renomme), renomme.historique.passe.length]).toEqual([{ type: 'encounter', id: 'enc-foret' }, ['enc-foret', 'enc-pont', 'enc-libre'], s.historique.passe.length + 1]);
    expect(projetEdite(renomme).worldMap!.routes.map((r) => [r.id, r.ambush?.encounter])).toEqual([['route-bois', 'enc-foret'], ['route-ailleurs', 'enc-bois']]);
    expect(projetEdite(jouer(renomme, { geste: 'annuler' })).worldMap!.routes[0].ambush?.encounter).toBe('enc-bois');
    expect(refusDeRetrait(renomme)).toBe('La rencontre « enc-foret » est l’embuscade de la route « route-bois » de la carte du monde.');
    expect(jouer(renomme, { geste: 'supprimer' })).toBe(renomme);
  });

  it('supprimer une rencontre qu’un effet de la scène lance est sans objet, et son refus se dit ; une rencontre libre se retire sur un cran', () => {
    const s = choisie('enc-pont');
    expect(jouer(s, { geste: 'supprimer' })).toBe(s);
    expect(refusDeRetrait(s)).toContain('« enc-pont »');
    const libre = choisie('enc-libre');
    expect(refusDeRetrait(libre)).toBeNull();
    const retire = jouer(libre, { geste: 'supprimer' });
    expect([retire.sel, ids(retire), retire.historique.passe.length]).toEqual([null, ['enc-bois', 'enc-pont'], libre.historique.passe.length + 1]);
  });

  it('la cible de la victoire s’écrit parmi les membres, la monture chevauchée parmi les montures ; la liste des membres ne s’écrit pas entière (#3606)', () => {
    const s = choisie('enc-bois');
    const valeur = (chemin: Segment[], v?: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'rencontre', id: 'enc-bois' }, chemin, ...(v === undefined ? {} : { valeur: v }) });
    const offerts = (chemin: Segment[]) => choixDuChamp('rencontre', sceneEditee(s).encounters[0], chemin, cadreDeLaSession(s))?.map((c) => c.valeur);
    expect(offerts(['victoryCondition', 'targetId'])).toEqual([{ id: 'cavalier' }, { id: 'cheval' }, { id: 'archer' }]);
    expect(offerts(['members', 2, 'ridesEntityId'])).toEqual([{ id: 'cheval' }]);
    const seuil = jouer(s, valeur(['victoryCondition'], { type: 'woundsThreshold', atOrBelowPercent: 50 }), valeur(['victoryCondition', 'targetId'], { id: 'archer' }));
    expect(sceneEditee(seuil).encounters[0].victoryCondition).toEqual({ type: 'woundsThreshold', targetId: { id: 'archer' }, atOrBelowPercent: 50 });
    expect(refusDeLaValeur(seuil, valeur(['victoryCondition', 'targetId'], { id: 'badaud' })), 'un personnage hors de la rencontre').toBe('horsSorte');
    expect(sceneEditee(jouer(s, valeur(['members', 2, 'ridesEntityId'], { id: 'cheval' }))).encounters[0].members![2]).toEqual({ entityId: 'archer', ridesEntityId: { id: 'cheval' } });
    const membres = sceneEditee(s).encounters[0].members!;
    expect(refusDeLaValeur(s, valeur(['members'], [...membres, { entityId: 'badaud' }])), 'enrôler passe par `addMember`').toBe('nonOffert');
    expect(refusDeLaValeur(s, valeur(['members'], [])), 'retirer passe par `removeMember`').toBe('nonOffert');
    expect(refusDeLaValeur(s, valeur(['members', 0, 'entityId'], 'badaud'))).toBe('nonOffert');
  });

  it('un avertissement d’une rencontre sélectionne cette rencontre', () => {
    const casse = { ...CLAIRIERE, encounters: [...CLAIRIERE.encounters, { id: 'enc-casse', members: [{ entityId: 'fantome' }] }] };
    const s = ouverteSur(casse);
    const rang = avertissementsDeLaSession(s).findIndex((w) => w.scope === 'encounter' && w.refId === 'enc-casse');
    expect(rang).toBeGreaterThanOrEqual(0);
    expect(jouer(s, { geste: 'avertissement', rang }).sel).toEqual({ type: 'encounter', id: 'enc-casse' });
  });
});

describe('la validation de la session ne se refait que quand le projet change (#3993)', () => {
  it('deux sessions au même projet rendent les mêmes avertissements ; une scène écrite ou un dataset re-daté les refait, au contenu de `validateScene`', () => {
    const projet = { scenes: [{ ...emptyScene('valide', 4, 4), walls: [{ x: 1, y: 1, side: 'N' }] }], narratif: NARRATIF_VIDE } as unknown as Parameters<typeof ouvrirLEdition>[0];
    const direct = (s: SessionDEdition) => validateScene([sceneEditee(s)], undefined, NARRATIF_VIDE).filter((w) => w.sceneId === idDeLaSceneEditee(s) || w.scope === 'worldMap');
    const a = avertissementsDeLaSession(ouvrirLEdition(projet, false));
    expect(a.length, 'le mur en impasse est averti').toBeGreaterThan(0);
    const b = avertissementsDeLaSession(ouvrirLEdition(projet, false));
    b.forEach((w, i) => expect(w).toBe(a[i]));
    expect(b).toEqual(direct(ouvrirLEdition(projet, false)));

    const ecrite = editer(ouvrirLEdition(projet, false), { geste: 'ajouterCouche' });
    const c = avertissementsDeLaSession(ecrite);
    expect(c[0]).not.toBe(a[0]);
    expect(c).toEqual(direct(ecrite));

    bumperDataset('criticalsTete');
    const d = avertissementsDeLaSession(ecrite);
    expect(d[0]).not.toBe(c[0]);
    expect(d).toEqual(c);
  });
});

describe('l’historique de l’éditeur tient le projet et sa scène montrée (#3606)', () => {
  const projet = { scenes: [emptyScene('a', 4, 4), emptyScene('b', 4, 4)], narratif: NARRATIF_VIDE } as unknown as Parameters<typeof ouvrirLEdition>[0];
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const vers = (id: string): GesteDEdition => ({ geste: 'scenes', quoi: 'aller', id });
  const couches = (s: SessionDEdition, id: string) => projetEdite(s).scenes.find((sc) => sc.id === id)!.layers.map((l) => l.z);
  const ANNULER: GesteDEdition = { geste: 'annuler' };
  const RETABLIR: GesteDEdition = { geste: 'retablir' };
  const COUCHE: GesteDEdition = { geste: 'ajouterCouche' };

  it('écrire dans A, aller en B sans cran, écrire, annuler deux fois rend le projet d’origine, chaque cran montrant sa scène ; rétablir aussi', () => {
    const ouv = ouvrirLEdition(projet, false);
    const enB = jouer(ouv, COUCHE, vers('b'));
    expect([enB.historique.passe.length, idDeLaSceneEditee(enB), enB.z], 'aller est une navigation').toEqual([1, 'b', 0]);
    const ecrite = jouer(enB, COUCHE, { geste: 'outil', outil: { mode: 'terrain', terrain: 'pierre' } });
    const une = jouer(ecrite, ANNULER);
    expect([idDeLaSceneEditee(une), couches(une, 'a'), couches(une, 'b')]).toEqual(['b', [0, 1], [0]]);
    const deux = jouer(une, ANNULER);
    expect([idDeLaSceneEditee(deux), deux.z, deux.outil], 'une autre scène montrée remet à zéro').toEqual(['a', 0, { mode: 'selection' }]);
    expect(projetEdite(deux)).toBe(projetEdite(ouv));
    const r1 = jouer(deux, RETABLIR);
    expect([idDeLaSceneEditee(r1), couches(r1, 'a'), couches(r1, 'b')]).toEqual(['a', [0, 1], [0]]);
    const r2 = jouer(r1, RETABLIR);
    expect(idDeLaSceneEditee(r2)).toBe('b');
    expect(projetEdite(r2)).toBe(projetEdite(ecrite));
  });

  it('annuler depuis A un cran posé sur B montre B ; rétablir aussi', () => {
    const depuisA = jouer(ouvrirLEdition(projet, false), vers('b'), COUCHE, vers('a'));
    const annule = jouer(depuisA, ANNULER);
    expect([idDeLaSceneEditee(annule), couches(annule, 'b')]).toEqual(['b', [0]]);
    const retabli = jouer(jouer(annule, vers('a')), RETABLIR);
    expect([idDeLaSceneEditee(retabli), couches(retabli, 'b')]).toEqual(['b', [0, 1]]);
  });

  it('ajouter, dupliquer et retirer une scène posent un cran ; annulés, la scène montrée est au projet', () => {
    const ouv = ouvrirLEdition(projet, false);
    const ids = (s: SessionDEdition) => projetEdite(s).scenes.map((sc) => sc.id);
    for (const quoi of ['ajouter', 'dupliquer'] as const) {
      const neuve = jouer(ouv, { geste: 'scenes', quoi });
      expect([neuve.historique.passe.length, idDeLaSceneEditee(neuve)]).toEqual([1, 'scene-0']);
      const annule = jouer(neuve, ANNULER);
      expect([idDeLaSceneEditee(annule), projetEdite(annule)], `annuler ${quoi} pendant qu’on édite la scène neuve`).toEqual(['a', projetEdite(ouv)]);
      expect(idDeLaSceneEditee(jouer(annule, RETABLIR))).toBe('scene-0');
    }
    const retiree = jouer(ouv, { geste: 'scenes', quoi: 'retirer' });
    expect([ids(retiree), idDeLaSceneEditee(retiree)]).toEqual([['b'], 'b']);
    const ressuscitee = jouer(retiree, ANNULER);
    expect([idDeLaSceneEditee(ressuscitee), projetEdite(ressuscitee)]).toEqual(['a', projetEdite(ouv)]);
    expect(idDeLaSceneEditee(jouer(ressuscitee, RETABLIR)), 'rétablir le retrait montre la scène qui reste').toBe('b');
    expect(idDeLaSceneEditee(jouer(ouv, { geste: 'scenes', quoi: 'ajouter' }, { geste: 'scenes', quoi: 'retirer' }, { geste: 'scenes', quoi: 'ajouter' })), 'un id neuf ne reprend aucun id d’un cran').toBe('scene-1');
  });

  it('l’enregistrement voit une écriture faite sur une scène quittée', () => {
    const enCours = jouer(ouvrirLEdition(projet, true), COUCHE, vers('b'), { geste: 'enregistrer' });
    expect(enCours.depot!.enCours!.scenes.find((sc) => sc.id === 'a')!.layers.map((l) => l.z)).toEqual([0, 1]);
  });

  it('renommer la scène réécrit chaque cran, sa scène montrée comprise ; un id d’un cran se refuse', () => {
    const renommee = jouer(ouvrirLEdition(projet, false), vers('b'), COUCHE, vers('a'), { geste: 'identifier', id: 'aa' });
    expect(projetEdite(renommee).scenes.map((sc) => sc.id)).toEqual(['aa', 'b']);
    const annule = jouer(renommee, ANNULER);
    expect([idDeLaSceneEditee(annule), projetEdite(annule).scenes.map((sc) => sc.id)]).toEqual(['b', ['aa', 'b']]);
    const sansB = jouer(ouvrirLEdition(projet, false), { geste: 'scenes', quoi: 'retirer' }, vers('b'));
    expect(jouer(sansB, { geste: 'identifier', id: 'a' }), 'a vit dans un cran passé').toBe(sansB);
  });

  it('renommée, la scène qu’un cran passé ou futur montrait revient sous son nouvel id', () => {
    const passee = jouer(ouvrirLEdition(projet, false), COUCHE, { geste: 'identifier', id: 'aa' }, ANNULER);
    expect([idDeLaSceneEditee(passee), sceneEditee(passee).id, couches(passee, 'aa')], 'annuler').toEqual(['aa', 'aa', [0]]);
    const future = jouer(ouvrirLEdition(projet, false), COUCHE, ANNULER, { geste: 'identifier', id: 'aa' }, RETABLIR);
    expect([idDeLaSceneEditee(future), sceneEditee(future).id, couches(future, 'aa')], 'rétablir').toEqual(['aa', 'aa', [0, 1]]);
  });

  it('les calques d’une scène retirée ressuscitent avec elle ; l’enregistrement réussi les oublie', () => {
    const calee = jouer(ouvrirLEdition(projet, true), { geste: 'planche' }, { geste: 'chargement', image: { largeur: 20, hauteur: 10 } });
    expect(calqueDeLaCouche(calee)).toBeDefined();
    const retiree = jouer(calee, { geste: 'scenes', quoi: 'retirer' });
    expect(calqueDeLaCouche(jouer(retiree, ANNULER)), 'annuler le retrait rend le calque').toBe(calqueDeLaCouche(calee));
    const enregistree = jouer(retiree, { geste: 'enregistrer' }, { geste: 'enregistrement', reussi: true });
    expect(Object.keys(enregistree.calques)).toEqual([]);
    expect(Object.keys(jouer(retiree, { geste: 'enregistrer' }, { geste: 'enregistrement', reussi: false }).calques)).toEqual(['a']);
  });
});

describe('la carte du monde, document ouvert du menu Fichier, ses lieux et ses routes par la table d’écriture de leur sorte (#3606 M5)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const BOURG: Scene = { ...emptyScene('bourg', 6, 6), entryPoints: { porte: { x: 0, y: 0 }, quai: { x: 1, y: 0 } }, encounters: [{ id: 'enc-a', members: [] }, { id: 'enc-b', members: [] }] };
  const VAL: Scene = emptyScene('val', 6, 6);
  const ouvert = (worldMap?: WorldMap) => ouvrirLEdition({ scenes: [BOURG, VAL], narratif: NARRATIF_VIDE, ...(worldMap ? { worldMap } : {}) } as unknown as Parameters<typeof ouvrirLEdition>[0], false);
  const valeur = (sorte: SorteDePorteur, id: string, chemin: Segment[], v?: unknown): Extract<GesteDEdition, { geste: 'valeur' }> =>
    ({ geste: 'valeur', porteur: { sorte, id }, chemin, ...(v === undefined ? {} : { valeur: v }) });
  const carte = (s: SessionDEdition) => projetEdite(s).worldMap!;
  /** `x` et `y`, reliés par `r`, à pied et en diligence, le billet de diligence vendu depuis `x`. */
  const RELIEE: WorldMap = {
    ...emptyWorldMap('monde'),
    places: [{ id: 'x', label: 'X', pos: { x: 20, y: 20 }, scene: { id: 'bourg' } }, { id: 'y', label: 'Y', pos: { x: 60, y: 20 }, scene: { id: 'val' } }],
    routes: [{ id: 'r', a: { id: 'x' }, b: { id: 'y' }, km: 12, modes: ['pied', 'diligence'], billets: { diligence: { prix: {}, depuis: { id: 'x' } } } }],
  };

  it('ouvrir la carte d’un projet qui n’en a pas la crée vide sur un cran, son singulier édité sans sélection ; annuler la retire et rend la scène ; rouvrir le document ouvert est sans objet', () => {
    const s = ouvert();
    const sur = jouer(s, { geste: 'document', document: 'carte' });
    expect([sur.document, carte(sur), sur.historique.passe.length, porteurDeLaSel(sur.sel, sur.document, idDeLaSceneEditee(sur))])
      .toEqual(['carte', emptyWorldMap('carte-0'), s.historique.passe.length + 1, { sorte: 'carte', id: 'carte' }]);
    expect(jouer(sur, { geste: 'document', document: 'carte' })).toBe(sur);
    const annule = jouer(sur, { geste: 'annuler' });
    expect([annule.document, projetEdite(annule).worldMap]).toEqual(['scene', undefined]);
  });

  it('ouvrir la carte d’un projet qui en a une, puis revenir à la scène, navigue sans cran et remet la session à zéro', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'selectionner', porteur: { sorte: 'entite', id: 'absent' } }, { geste: 'outil', outil: { mode: 'gomme' } });
    const sur = jouer(s, { geste: 'document', document: 'carte' });
    expect([sur.document, sur.historique, sur.outil, sur.sel]).toEqual(['carte', s.historique, { mode: 'selection' }, null]);
    const retour = jouer(sur, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'x' } }, { geste: 'document', document: 'scene' });
    expect([retour.document, retour.sel, retour.historique, porteurDeLaSel(retour.sel, retour.document, idDeLaSceneEditee(retour))]).toEqual(['scene', null, s.historique, { sorte: 'scene', id: 'bourg' }]);
  });

  it('la carte écrit son libellé, son fond et ses réglages, sur un cran ; sa liste de lieux ne s’écrit pas par elle', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' });
    const ecrite = jouer(s, valeur('carte', 'carte', ['label'], 'Le Reikland'), valeur('carte', 'carte', ['background'], 'cartes/reikland.png'), valeur('carte', 'carte', ['params'], {}), valeur('carte', 'carte', ['params', 'hoursPerDay'], 8));
    expect([carte(ecrite).label, carte(ecrite).background, carte(ecrite).params, ecrite.historique.passe.length]).toEqual(['Le Reikland', 'cartes/reikland.png', { hoursPerDay: 8 }, s.historique.passe.length + 4]);
    expect(refusDeLaValeur(s, valeur('carte', 'carte', ['places'], []))).toBe('nonOffert');
  });

  it('ajouter un lieu le pose au centre des bornes, décalé s’il en chevauche un, sous un identifiant frais, sélectionné sur un cran ; sa position ne s’écrit pas au formulaire', () => {
    const s = jouer(ouvert(), { geste: 'document', document: 'carte' });
    const un = jouer(s, { geste: 'ajouter', sorte: 'lieu' });
    const deux = jouer(un, { geste: 'ajouter', sorte: 'lieu' });
    expect([deux.sel, carte(deux).places.map((p) => [p.id, p.pos, p.scene.id]), deux.historique.passe.length])
      .toEqual([{ type: 'place', id: 'lieu-1' }, [['lieu-0', { x: 50, y: 50 }, 'bourg'], ['lieu-1', { x: 58, y: 50 }, 'bourg']], s.historique.passe.length + 2]);
    expect([refusDeLaValeur(deux, valeur('lieu', 'lieu-1', ['pos'], { x: 10, y: 10 })), refusDeLaValeur(deux, valeur('lieu', 'lieu-1', ['id'], 'autre'))]).toEqual(['nonOffert', 'nonOffert']);
    expect(carte(jouer(deux, { geste: 'annuler' })).places.map((p) => p.id)).toEqual(['lieu-0']);
  });

  it('un lieu écrit son libellé, son port neuf et ses services ; son entrée parmi celles de sa scène ; chaque écriture s’annule', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' }, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'x' } });
    const ecrit = jouer(s,
      valeur('lieu', 'x', ['label'], 'Ubersreik'),
      valeur('lieu', 'x', ['port'], portNeuf()),
      valeur('lieu', 'x', ['services'], [{ kind: { id: 'auberge' } }]),
      valeur('lieu', 'x', ['entry'], 'quai'));
    expect(carte(ecrit).places[0]).toEqual({ ...RELIEE.places[0], label: 'Ubersreik', port: portNeuf(), services: [{ kind: { id: 'auberge' } }], entry: 'quai' });
    expect(choixDuChamp('lieu', carte(s).places[0], ['entry'], cadreDeLaSession(s))?.map((c) => c.valeur)).toEqual(['porte', 'quai']);
    const ports = choixDuChamp('lieu', carte(s).places[0], ['port'], cadreDeLaSession(s));
    expect([ports?.map((c) => c.valeur), choixDuChamp('lieu', carte(ecrit).places[0], ['port'], cadreDeLaSession(ecrit))]).toEqual([[portNeuf(), ...navalPorts.map((p) => resolvePortRef({ ref: p.id }))], undefined]);
    const duCatalogue = resolvePortRef({ ref: navalPorts[0].id });
    expect(carte(jouer(s, valeur('lieu', 'x', ['port'], duCatalogue))).places[0].port, 'un port du catalogue se pose avec son profil').toEqual(duCatalogue);
    expect(refusDeLaValeur(s, valeur('lieu', 'x', ['entry'], 'nulle-part'))).toBe('horsSorte');
    expect(jouer(s, { geste: 'nommer', nom: 'z' }), 'un lieu ne se renomme pas : aucun écrivain ne propage son identifiant').toBe(s);
    const annule = jouer(ecrit, { geste: 'annuler' }, { geste: 'annuler' }, { geste: 'annuler' }, { geste: 'annuler' });
    expect(carte(annule)).toEqual(RELIEE);
  });

  it('relier deux lieux pose une route depuis le lieu sélectionné vers l’un de ceux qu’il rejoint, sélectionnée sur un cran ; sans lieu offert, c’est sans objet', () => {
    const s = jouer(ouvert(), { geste: 'document', document: 'carte' }, { geste: 'ajouter', sorte: 'lieu' }, { geste: 'ajouter', sorte: 'lieu' }, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'lieu-0' } });
    expect(ECRITURES_DES_PORTEURS.route.avecs!(projetEdite(s), idDeLaSceneEditee(s), s.sel)).toEqual(['lieu-1']);
    expect(jouer(s, { geste: 'ajouter', sorte: 'route' }), 'sans l’autre lieu').toBe(s);
    expect(jouer(s, { geste: 'ajouter', sorte: 'route', avec: 'lieu-0' }), 'une boucle').toBe(s);
    const reliee = jouer(s, { geste: 'ajouter', sorte: 'route', avec: 'lieu-1' });
    expect([reliee.sel, carte(reliee).routes, reliee.historique.passe.length]).toEqual([{ type: 'route', id: 'trajet-0' }, [{ id: 'trajet-0', a: { id: 'lieu-0' }, b: { id: 'lieu-1' }, km: 10, modes: ['pied'] }], s.historique.passe.length + 1]);
    const depuis = jouer(reliee, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'lieu-0' } });
    expect(ECRITURES_DES_PORTEURS.route.avecs!(projetEdite(depuis), idDeLaSceneEditee(depuis), depuis.sel), 'la paire est reliée dans les deux sens').toEqual([]);
    expect(carte(jouer(reliee, { geste: 'annuler' })).routes).toEqual([]);
  });

  it('une route écrit sa distance et gagne une péripétie neuve ; remplacer le mode qui porte un billet est refusé, dit ; ses modes vidés retombent à pied', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' }, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } });
    expect(carte(jouer(s, valeur('route', 'r', ['km'], 25))).routes[0].km).toBe(25);
    expect(carte(jouer(s, valeur('route', 'r', ['perils'], [peripetieNeuve()]))).routes[0].perils).toEqual([peripetieNeuve()]);
    const remplace = valeur('route', 'r', ['modes'], ['pied', 'monture']);
    expect(refusDeLaValeur(s, remplace)).toEqual({ regle: 'La route « r » garde ses modes : un billet y est posé sur le mode que vous retirez. Retirez d’abord le billet.' });
    expect(jouer(s, remplace)).toBe(s);
    const libre = jouer(s, valeur('route', 'r', ['billets']), valeur('route', 'r', ['modes'], []));
    expect([carte(libre).routes[0].billets, carte(libre).routes[0].modes]).toEqual([undefined, ['pied']]);
  });

  it('le départ d’un billet ne s’offre qu’aux extrémités de sa route à double sens, chacune à son nom : un autre lieu de la carte est refusé', () => {
    const TROIS: WorldMap = { ...RELIEE, places: [...RELIEE.places, { id: 'z', label: 'Z', pos: { x: 80, y: 80 }, scene: { id: 'val' } }] };
    const s = jouer(ouvert(TROIS), { geste: 'document', document: 'carte' }, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } });
    const choix = (chemin: Segment[]) => choixDuChamp('route', carte(s).routes[0], chemin, cadreDeLaSession(s))?.map((c) => [c.valeur, c.libelle]);
    expect([choix(['billets', 'diligence', 'depuis']), choix(['billets', 'diligence', 'depuis', 'id'])]).toEqual([[[{ id: 'x' }, 'X'], [{ id: 'y' }, 'Y']], [['x', 'X'], ['y', 'Y']]]);
    expect(refusDeLaValeur(s, valeur('route', 'r', ['billets', 'diligence', 'depuis'], { id: 'z' }))).toBe('horsSorte');
    expect(carte(jouer(s, valeur('route', 'r', ['billets', 'diligence', 'depuis'], { id: 'y' }))).routes[0].billets?.diligence?.depuis).toEqual({ id: 'y' });
  });

  it('l’embuscade d’une route prend sa scène, puis sa rencontre parmi celles de cette scène ; la rencontre ne se retire plus tant que l’embuscade la lance', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' }, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } });
    const scene = jouer(s, valeur('route', 'r', ['ambush'], { scene: { id: '' }, encounter: '' }), valeur('route', 'r', ['ambush', 'scene'], { id: 'bourg' }));
    expect(choixDuChamp('route', carte(scene).routes[0], ['ambush', 'encounter'], cadreDeLaSession(scene))?.map((c) => c.valeur)).toEqual(['enc-a', 'enc-b']);
    expect(choixDuChamp('route', carte(scene).routes[0], ['ambush', 'entry'], cadreDeLaSession(scene))?.map((c) => c.valeur)).toEqual(['porte', 'quai']);
    const rencontre = jouer(scene, valeur('route', 'r', ['ambush', 'encounter'], 'enc-b'));
    expect(carte(rencontre).routes[0].ambush).toEqual({ scene: { id: 'bourg' }, encounter: 'enc-b' });
    expect(refusDeLaValeur(scene, valeur('route', 'r', ['ambush', 'encounter'], 'enc-ailleurs'))).toBe('horsSorte');
    const visee = jouer(rencontre, { geste: 'document', document: 'scene' }, { geste: 'selectionner', porteur: { sorte: 'rencontre', id: 'enc-b' } });
    expect(refusDeRetrait(visee)).toBe('La rencontre « enc-b » est l’embuscade de la route « r » de la carte du monde.');
  });

  it('supprimer un lieu retire ses routes avec lui, sur un cran ; annuler les rend', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' }, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'x' } });
    const retire = jouer(s, { geste: 'supprimer' });
    expect([retire.sel, carte(retire).places.map((p) => p.id), carte(retire).routes, retire.historique.passe.length]).toEqual([null, ['y'], [], s.historique.passe.length + 1]);
    expect(carte(jouer(retire, { geste: 'annuler' }))).toEqual(RELIEE);
    const route = jouer(s, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } }, { geste: 'supprimer' });
    expect([carte(route).places.length, carte(route).routes]).toEqual([2, []]);
  });

  it('un avertissement d’un lieu de la carte ouvre la carte et sélectionne ce lieu', () => {
    const casse: WorldMap = { ...RELIEE, places: [{ ...RELIEE.places[0], scene: { id: 'absente' } }, RELIEE.places[1]] };
    const s = ouvert(casse);
    const rang = avertissementsDeLaSession(s).findIndex((w) => w.scope === 'worldMap' && w.refId === 'x');
    expect(rang).toBeGreaterThanOrEqual(0);
    const vu = jouer(s, { geste: 'avertissement', rang });
    expect([vu.document, vu.sel]).toEqual(['carte', { type: 'place', id: 'x' }]);
  });

  /** Le point `(x, y)` du plan de la carte, en unités de la position d'un lieu, sa case la partie entière. */
  const pt = (x: number, y: number) => ({ case: { x: Math.floor(x), y: Math.floor(y) }, f: { x, y } });
  /** `x` et `y`, sans route. */
  const DEUX_LIEUX: WorldMap = { ...RELIEE, routes: [] };
  const lieuxDe = (s: SessionDEdition) => carte(s).places.map((p) => [p.id, p.pos]);

  it('à la sélection, l’appui sur un lieu le sélectionne, son glissé le pose au point, borné, sur un seul cran ; un clic sans glissé n’écrit rien ; l’appui sur une route la sélectionne, sur le fond plus rien', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' });
    const clic = jouer(s, { geste: 'appui', point: pt(20.5, 20.5) }, { geste: 'relache', point: pt(20.5, 20.5) });
    expect([clic.sel, clic.historique]).toEqual([{ type: 'place', id: 'x' }, s.historique]);
    const glisse = jouer(s, { geste: 'appui', point: pt(20.5, 20.5) }, { geste: 'glisse', point: pt(30.4, 25) });
    expect([lieuxDe(glisse), glisse.historique.passe.length]).toEqual([[['x', { x: 30, y: 25 }], ['y', { x: 60, y: 20 }]], s.historique.passe.length + 1]);
    const loin = jouer(glisse, { geste: 'glisse', point: pt(150, -5) }, { geste: 'relache', point: pt(150, -5) });
    expect([lieuxDe(loin)[0], loin.historique.passe.length, loin.geste]).toEqual([['x', { x: 98, y: 4 }], s.historique.passe.length + 1, null]);
    expect(carte(jouer(loin, { geste: 'annuler' }))).toEqual(RELIEE);
    expect(jouer(s, { geste: 'appui', point: pt(40, 20.5) }).sel).toEqual({ type: 'route', id: 'r' });
    expect(jouer(s, { geste: 'appui', point: pt(20, 20) }, { geste: 'relache', point: pt(20, 20) }, { geste: 'appui', point: pt(40, 60) }).sel).toBeNull();
  });

  it('à l’outil Lieu, l’appui sur le fond pose un lieu neuf au point, lié à la première scène, sélectionné sur un cran ; sur un lieu, il le sélectionne', () => {
    const s = jouer(ouvert(DEUX_LIEUX), { geste: 'document', document: 'carte' }, { geste: 'outil', outil: { mode: 'lieu' } });
    const pose = jouer(s, { geste: 'appui', point: pt(70.6, 80.2) });
    expect([pose.sel, carte(pose).places[2], pose.historique.passe.length]).toEqual([{ type: 'place', id: 'lieu-0' }, { id: 'lieu-0', label: expect.any(String), pos: { x: 71, y: 80 }, scene: { id: 'bourg' } }, s.historique.passe.length + 1]);
    const sur = jouer(s, { geste: 'appui', point: pt(60, 20) });
    expect([sur.sel, sur.historique]).toEqual([{ type: 'place', id: 'y' }, s.historique]);
  });

  it('à l’outil Chemin, une route se tire d’un lieu à un autre : son bout suit le pointeur, le relâché sur l’autre lieu la pose, sélectionnée sur un cran ; relâchée sur le fond, rien', () => {
    const s = jouer(ouvert(DEUX_LIEUX), { geste: 'document', document: 'carte' }, { geste: 'outil', outil: { mode: 'chemin' } });
    const tiree = jouer(s, { geste: 'appui', point: pt(20, 20) }, { geste: 'glisse', point: pt(45, 33) });
    expect([tiree.geste, tiree.historique]).toEqual([{ sorte: 'liaison', depuis: 'x', bout: { x: 45, y: 33 } }, s.historique]);
    const posee = jouer(tiree, { geste: 'relache', point: pt(60.5, 19.5) });
    expect([posee.sel, carte(posee).routes, posee.historique.passe.length, posee.geste]).toEqual([{ type: 'route', id: 'trajet-0' }, [{ id: 'trajet-0', a: { id: 'x' }, b: { id: 'y' }, km: 10, modes: ['pied'] }], s.historique.passe.length + 1, null]);
    const perdue = jouer(tiree, { geste: 'relache', point: pt(40, 60) });
    expect([perdue.historique, perdue.geste]).toEqual([s.historique, null]);
  });

  it('sans sélection sur la carte, nommer et identifier sont sans objet : la scène garde son nom et son identifiant ; supprimer retire la carte du projet sur un cran, la scène redevenant ouverte', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' });
    expect(jouer(s, { geste: 'nommer', nom: 'Autre' })).toBe(s);
    expect(jouer(s, { geste: 'identifier', id: 'autre' })).toBe(s);
    const retiree = jouer(s, { geste: 'supprimer' });
    expect([retiree.document, projetEdite(retiree).worldMap, retiree.historique.passe.length]).toEqual(['scene', undefined, s.historique.passe.length + 1]);
    expect(carte(jouer(retiree, { geste: 'annuler' }))).toEqual(RELIEE);
  });

  it('le sens d’une route s’oriente depuis l’une de ses extrémités ou dans les deux sens, sur un cran, refusé quand une autre route de la paire l’offre déjà', () => {
    const s = jouer(ouvert(RELIEE), { geste: 'document', document: 'carte' }, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } });
    const depuisX = jouer(s, { geste: 'sens', depuis: 'x' });
    expect([carte(depuisX).routes[0].from, depuisX.historique.passe.length, depuisX.sel]).toEqual([{ id: 'x' }, s.historique.passe.length + 1, { type: 'route', id: 'r' }]);
    expect(jouer(depuisX, { geste: 'sens', depuis: 'x' }), 'déjà dans ce sens').toBe(depuisX);
    const retour = jouer(depuisX, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'y' } }, { geste: 'ajouter', sorte: 'route', avec: 'x' }, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } });
    expect(carte(retour).routes[1].from).toEqual({ id: 'y' });
    expect(jouer(retour, { geste: 'sens', depuis: null }), 'le retour est déjà offert').toBe(retour);
    expect(jouer(retour, { geste: 'sens', depuis: 'y' })).toBe(retour);
    expect(carte(jouer(depuisX, { geste: 'sens', depuis: null })).routes[0].from).toBeUndefined();
  });
});

describe('les points d’intérêt d’un lieu, sur le plan du lieu de la carte du monde (#3606 M5)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const BOURG: Scene = emptyScene('bourg', 6, 6);
  const ouvert = (worldMap: WorldMap) => ouvrirLEdition({ scenes: [BOURG, emptyScene('val', 6, 6)], narratif: NARRATIF_VIDE, worldMap } as unknown as Parameters<typeof ouvrirLEdition>[0], false);
  const carte = (s: SessionDEdition) => projetEdite(s).worldMap!;
  const pt = (x: number, y: number) => ({ case: { x: Math.floor(x), y: Math.floor(y) }, f: { x, y } });
  /** `x`, au point d'intérêt `forge` (20, 30) de son plan, et `y`, à la position (20, 30) de la carte. */
  const CARTE: WorldMap = {
    ...emptyWorldMap('monde'),
    places: [
      { id: 'x', label: 'X', pos: { x: 60, y: 60 }, scene: { id: 'bourg' }, poi: [{ id: 'forge', label: 'Forge', pos: { x: 20, y: 30 }, serviceKind: { id: 'forgeron' } }] },
      { id: 'y', label: 'Y', pos: { x: 20, y: 30 }, scene: { id: 'val' } },
    ],
    routes: [],
  };
  const surLePlan = (s = ouvert(CARTE)) => jouer(s, { geste: 'document', document: 'carte' }, { geste: 'planDuLieu', lieu: 'x' });
  const poiDe = (s: SessionDEdition) => carte(s).places[0].poi;

  it('ouvrir le plan d’un lieu le sélectionne, sans cran ; le refermer rend le plan de la carte ; un lieu inconnu, ou la scène ouverte, c’est sans objet', () => {
    const s = surLePlan();
    expect([s.sel, s.planDuLieu, planDuLieuOuvert(s)?.lieu.id, s.historique.passe.length]).toEqual([{ type: 'place', id: 'x' }, { poi: null }, 'x', 0]);
    expect(jouer(s, { geste: 'planDuLieu', lieu: null }).planDuLieu).toBeNull();
    const surLaCarte = jouer(ouvert(CARTE), { geste: 'document', document: 'carte' });
    expect(jouer(surLaCarte, { geste: 'planDuLieu', lieu: 'absent' })).toBe(surLaCarte);
    const surLaScene = ouvert(CARTE);
    expect(jouer(surLaScene, { geste: 'planDuLieu', lieu: 'x' })).toBe(surLaScene);
    expect(jouer(s, { geste: 'document', document: 'scene' }).planDuLieu, 'changer de document le ferme').toBeNull();
  });

  it('le plan ouvert reçoit le pointeur, pas la carte : l’appui y désigne le point d’intérêt touché, son glissé le pose au point, borné, sur un seul cran', () => {
    const s = surLePlan();
    const clic = jouer(s, { geste: 'appui', point: pt(20.5, 30.5) }, { geste: 'relache', point: pt(20.5, 30.5) });
    expect([clic.planDuLieu, clic.sel, clic.historique]).toEqual([{ poi: 'forge' }, { type: 'place', id: 'x' }, s.historique]);
    const glisse = jouer(s, { geste: 'appui', point: pt(20.5, 30.5) }, { geste: 'glisse', point: pt(44.6, 51) }, { geste: 'glisse', point: pt(130, -4) }, { geste: 'relache', point: pt(130, -4) });
    expect([poiDe(glisse)?.[0].pos, glisse.historique.passe.length, glisse.geste, carte(glisse).places[1].pos]).toEqual([{ x: 100, y: 0 }, 1, null, { x: 20, y: 30 }]);
    expect(carte(jouer(glisse, { geste: 'annuler' }))).toEqual(CARTE);
    expect(jouer(clic, { geste: 'appui', point: pt(70, 70) }).planDuLieu, 'le fond ne désigne aucun point').toEqual({ poi: null });
  });

  it('à l’outil Épingler, l’appui sur le fond pose un point d’intérêt neuf au point, menant à la première scène dont il prend le nom, désigné sur un cran ; ses champs s’écrivent au formulaire du lieu', () => {
    const s = jouer(surLePlan(), { geste: 'outil', outil: { mode: 'epingler' } });
    const pose = jouer(s, { geste: 'appui', point: pt(70.4, 80.6) });
    expect([poiDe(pose)?.[1], pose.planDuLieu, pose.historique.passe.length]).toEqual([{ id: 'poi-0', label: BOURG.label, pos: { x: 70, y: 81 }, sceneId: { id: 'bourg' } }, { poi: 'poi-0' }, s.historique.passe.length + 1]);
    const nomme = jouer(pose, { geste: 'valeur', porteur: { sorte: 'lieu', id: 'x' }, chemin: ['poi', 1, 'label'], valeur: 'Auberge' });
    expect(poiDe(nomme)?.[1].label).toBe('Auberge');
    expect(refusDeLaValeur(pose, { geste: 'valeur', porteur: { sorte: 'lieu', id: 'x' }, chemin: ['poi', 1, 'pos'], valeur: { x: 1, y: 1 } }), 'sa position ne s’écrit qu’au plan').toBe('nonOffert');
    expect(choixDuChamp('lieu', carte(pose).places[0], ['poi', 1, 'sceneId'], cadreDeLaSession(pose))?.map((c) => c.valeur), 'sa scène parmi celles du projet').toEqual([{ id: 'bourg' }, { id: 'val' }]);
  });

  it('retirer le point d’intérêt désigné l’ôte du lieu sur un cran, la liste vidée retirée ; sans point désigné, c’est sans objet', () => {
    const s = surLePlan();
    expect(jouer(s, { geste: 'retirerPoi' })).toBe(s);
    const designe = jouer(s, { geste: 'appui', point: pt(20, 30) }, { geste: 'relache', point: pt(20, 30) });
    const retire = jouer(designe, { geste: 'retirerPoi' });
    expect([carte(retire).places[0], retire.planDuLieu, retire.historique.passe.length]).toEqual([{ id: 'x', label: 'X', pos: { x: 60, y: 60 }, scene: { id: 'bourg' } }, { poi: null }, 1]);
    expect(carte(jouer(retire, { geste: 'annuler' }))).toEqual(CARTE);
  });

  it('le plan ouvert est celui du lieu sélectionné : annuler ou rétablir sur son plan gardent ce lieu sélectionné, son point désigné s’il y est encore ; sélectionner un autre porteur le ferme', () => {
    const s = jouer(surLePlan(), { geste: 'outil', outil: { mode: 'epingler' } }, { geste: 'appui', point: pt(70, 80) }, { geste: 'relache', point: pt(70, 80) });
    const annule = jouer(s, { geste: 'annuler' });
    expect([annule.sel, planDuLieuOuvert(annule)?.lieu.id, planDuLieuOuvert(annule)?.poi, poiDe(annule)]).toEqual([{ type: 'place', id: 'x' }, 'x', null, CARTE.places[0].poi]);
    const retabli = jouer(annule, { geste: 'retablir' });
    expect([retabli.sel, planDuLieuOuvert(retabli)?.lieu.id, poiDe(retabli)?.length]).toEqual([{ type: 'place', id: 'x' }, 'x', 2]);
    const ailleurs = jouer(s, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'y' } }, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'x' } });
    expect([planDuLieuOuvert(ailleurs)?.lieu.id, ailleurs.sel], 'le plan suit le lieu sélectionné').toEqual(['x', { type: 'place', id: 'x' }]);
    const route = jouer(ouvert({ ...CARTE, routes: [{ id: 'r', from: 'x', to: 'y', mode: 'route' }] } as unknown as WorldMap), { geste: 'document', document: 'carte' }, { geste: 'planDuLieu', lieu: 'x' }, { geste: 'selectionner', porteur: { sorte: 'route', id: 'r' } });
    expect([route.sel, route.planDuLieu, planDuLieuOuvert(route)], 'une route sélectionnée ferme le plan').toEqual([{ type: 'route', id: 'r' }, null, undefined]);
    expect(planDuLieuOuvert(jouer(route, { geste: 'selectionner', porteur: { sorte: 'lieu', id: 'x' } })), 'resélectionner le lieu ne le rouvre pas').toBeUndefined();
  });

  it('annuler la pose du lieu dont le plan est ouvert ferme ce plan, la sélection tombée : jamais un plan sans son lieu à l’inspecteur', () => {
    const pose = jouer(ouvert(CARTE), { geste: 'document', document: 'carte' }, { geste: 'outil', outil: { mode: 'lieu' } }, { geste: 'appui', point: pt(80, 80) }, { geste: 'relache', point: pt(80, 80) });
    const neuf = carte(pose).places[2]?.id;
    expect(neuf, 'un lieu neuf est posé').toBeDefined();
    const plan = jouer(pose, { geste: 'planDuLieu', lieu: neuf! });
    expect(planDuLieuOuvert(plan)?.lieu.id).toBe(neuf);
    const annule = jouer(plan, { geste: 'annuler' });
    expect([annule.sel, annule.planDuLieu, planDuLieuOuvert(annule), carte(annule).places.length]).toEqual([null, null, undefined, 2]);
  });
});

describe('les axes actifs du projet, réglés sur l’écran de la carte du monde (#3606 M5, #409)', () => {
  const jouer = (s: SessionDEdition, ...gestes: GesteDEdition[]) => gestes.reduce(editer, s);
  const axes = (v?: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'projet', id: 'projet' }, chemin: ['activeAxes'], ...(v === undefined ? {} : { valeur: v }) });
  const surLaCarte = () => jouer(ouvrirLEdition({ id: 'p', scenes: [emptyScene('bourg', 4, 4)], narratif: NARRATIF_VIDE, worldMap: emptyWorldMap('monde') } as unknown as Parameters<typeof ouvrirLEdition>[0], false), { geste: 'document', document: 'carte' });

  it('ils s’écrivent au projet parmi les axes du catalogue, chacun sur un cran, la carte gardée ; un axe hors catalogue est refusé', () => {
    const s = surLaCarte();
    const deux = jouer(s, axes(['melee']), axes(['melee', 'tir']));
    expect([projetEdite(deux).activeAxes, projetEdite(deux).worldMap, deux.historique.passe.length]).toEqual([['melee', 'tir'], projetEdite(s).worldMap, s.historique.passe.length + 2]);
    expect(refusDeLaValeur(s, axes(['plongee-sous-marine']))).toBe('horsSorte');
    expect(jouer(deux, axes(['melee', 'tir'])), 'les mêmes axes : rien ne change').toBe(deux);
  });

  it('vidés, ils sont absents du projet, qui vaut le socle', () => {
    const vides = jouer(surLaCarte(), axes(['melee']), axes([]));
    expect(['activeAxes' in projetEdite(vides), vides.historique.passe.length]).toEqual([false, 2]);
    expect('activeAxes' in projetEdite(jouer(surLaCarte(), axes(['melee']), axes()))).toBe(false);
  });
});
