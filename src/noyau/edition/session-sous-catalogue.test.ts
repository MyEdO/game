/**
 * La session d'édition juge chaque lecture sous le catalogue qu'elle porte (#5070, plan
 * `docs/plans/2026-11-25-composition-d-un-jeu.md` § 5.1, point 2, et fossile 9) : la table d'écriture, la pose des
 * ponts d'`editer`, l'inspecteur de l'hôte, la fiche d'un personnage, la validation et la porte du projet. Fixtures : un
 * navire à ponts présent SEULEMENT dans le catalogue de la suite (`navireDuLivreDeTest`), et des catalogues privés de
 * la caraque ou de toute créature, où la faute ou la fiche se juge par son absence.
 */
import { describe, expect, it } from 'vitest';
import {
  avertissementsDeLaSession,
  cadreDeLaSession,
  editer,
  essaiDeLaScene,
  ouvrirLEdition,
  projetDuDepot,
  refusDeLaValeur,
  sceneEditee,
  sessionSousLeCatalogue,
  texteAEnregistrer,
  type GesteDEdition,
  type SessionDEdition,
} from './session';
import { choixDuChamp, entiteDeLaSelection } from '../sceneEditLecture';
import { emptyNarratif } from '../monde/campaignNarratif';
import { buildScene } from '../mapSpec';
import type { Scene, SceneEntity } from '../monde/scene';
import { inspecteurDeLaSession } from '../../hote/editeur';
import { catalogueAvec } from '../../data/catalogueAvec.testkit';
import { catalogueDuProcessus } from '../../data/catalogueDuProcessus';
import { catalogueDeTest } from '../../data/schemas/catalogue/catalogueDeTest.testkit';
import type { Catalogue } from '../../data/schemas/catalogue/catalogue';
import { NAVIRE, navire, navireDuLivreDeTest } from '../navireDuLivreDeTest.testkit';

const CAT = catalogueAvec({ 'vehicles.json': [navireDuLivreDeTest()] });
/** Les véhicules du catalogue du processus, sans la caraque : aucun cap ne s'y refuse à elle. */
const SANS_CARAQUE = catalogueDeTest({ 'vehicles.json': catalogueDuProcessus()['vehicles.json'].filter((v) => v.id !== 'caraque') });
/** Un catalogue qui ne porte aucune créature : aucune entité n'y a de fiche. */
const SANS_CREATURE = catalogueDeTest({});
const CAP_NE = `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)`;

/** Le bassin 24 × 24 à l'échelle du plan, aux entités `entites`. */
const bassin = (...entites: SceneEntity[]): Scene => ({ ...buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', metresPerTile: 2 }), entities: entites });
/** Le projet du dépôt qui porte la seule scène `scene`. */
const projetDe = (scene: Scene) => ({ id: 'p', type: 'projet', label: 'P', versionContenu: 1, maison: 'catalogue', scenes: [scene], narratif: emptyNarratif() });
/** La session ouverte du dépôt sous `cat` (le catalogue du processus à défaut) sur la scène `scene`, son entité `id`
 *  sélectionnée. */
const ouverteSous = (cat: Catalogue | undefined, scene: Scene, id?: string): SessionDEdition => {
  const s = ouvrirLEdition(projetDe(scene) as unknown as Parameters<typeof ouvrirLEdition>[0], true, undefined, null, [], cat);
  return id ? editer(s, { geste: 'selectionner', porteur: { sorte: 'entite', id } }) : s;
};
const valeur = (id: string, chemin: (string | number)[], v: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, valeur: v });
const entite = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)!;
/** Les ids des éléments de l'inspecteur de l'hôte, et de leurs valeurs. */
const idsDeLInspecteur = (s: SessionDEdition) => inspecteurDeLaSession(s).flatMap((el) => [el.id, ...('valeurs' in el ? el.valeurs.map((v) => v.id) : [])]);

describe('la session écrit et pose un navire sous son catalogue', () => {
  it('la table d’écriture juge le véhicule écrit sous le catalogue de la session : la caraque au cap NE, refusée sous le processus, s’écrit sous un catalogue qui ne la porte pas', () => {
    const charrette = navire('NE', { pos: { x: 12, y: 12 }, vehicule: { id: 'charrette' } });
    const caraque = valeur('n', ['vehicule', 'id'], 'caraque');
    const sansElle = ouverteSous(SANS_CARAQUE, bassin(charrette), 'n');
    expect(refusDeLaValeur(sansElle, caraque)).toBeNull();
    expect(entite(editer(sansElle, caraque)).vehicule).toEqual({ id: 'caraque' });
    const sousLeProcessus = ouverteSous(undefined, bassin(charrette), 'n');
    expect(refusDeLaValeur(sousLeProcessus, caraque)).toEqual({ regle: "navire « caraque » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)" });
    expect(editer(sousLeProcessus, caraque)).toBe(sousLeProcessus);
  });

  it('`editer` refuse la pose de ponts qui déborde de la carte, sous le catalogue de la session seul à porter le navire', () => {
    const auBord = bassin(navire('N', { pos: { x: 6, y: 12 } }));
    const ouest = { geste: 'entite', patch: { facing: 'O' } } as const;
    const sous = ouverteSous(CAT, auBord, 'n');
    expect(editer(sous, ouest)).toBe(sous);
    const sousLeProcessus = ouverteSous(undefined, auBord, 'n');
    expect(entite(editer(sousLeProcessus, ouest)).facing, 'le navire inconnu du processus n’a pas de ponts').toBe('O');
  });

  it('l’inspecteur de l’hôte offre au navire du seul catalogue exactement les caps cardinaux', () => {
    const s = ouverteSous(CAT, bassin(navire('N', { pos: { x: 12, y: 12 } })), 'n');
    expect(idsDeLInspecteur(s).filter((i) => i.startsWith('entite/cap/'))).toEqual(['entite/cap/N', 'entite/cap/E', 'entite/cap/S', 'entite/cap/O']);
  });
});

describe('la fiche d’un personnage se juge sous le catalogue de la session (`ficheEditee`)', () => {
  const ombre: SceneEntity = { id: 'o', kind: 'personnage', creature: { id: 'l-ombre-du-fleuve' }, pos: { x: 1, y: 1 }, combat: {} };
  const sansCreature = () => ouverteSous(SANS_CREATURE, bassin(ombre), 'o');
  const sousLeProcessus = () => ouverteSous(undefined, bassin(ombre), 'o');

  it('l’inspecteur ne montre ni profil porté ni sorts sous un catalogue sans sa créature ; sous le processus, il les montre', () => {
    const ids = (s: SessionDEdition) => idsDeLInspecteur(s).filter((i) => i === 'profil/caracteristiques' || i === 'sorts/connus');
    expect(ids(sansCreature())).toEqual([]);
    expect(ids(sousLeProcessus())).toEqual(['profil/caracteristiques', 'sorts/connus']);
  });

  it('le formulaire n’offre ses sorts choisis, ni de sort à choisir, que si sa fiche se juge sous le catalogue de la session', () => {
    const offre = (s: SessionDEdition) => idsDeLInspecteur(s).includes('valeur/combat/spells/ajouter');
    const choix = (s: SessionDEdition) => choixDuChamp('entite', entite(s), ['combat', 'spells', 0], cadreDeLaSession(s))!.length;
    expect([offre(sansCreature()), choix(sansCreature())]).toEqual([false, 0]);
    expect(offre(sousLeProcessus())).toBe(true);
    expect(choix(sousLeProcessus())).toBeGreaterThan(0);
  });
});

describe('la validation et la porte du projet se jugent sous le catalogue de la session', () => {
  const auNord = bassin(navire('N', { pos: { x: 12, y: 12 } }));
  const auNordEst = bassin(navire('NE', { pos: { x: 12, y: 12 } }));

  it('la validation dit le cap NE du navire du seul catalogue sous lui ; sous le processus, le navire est inconnu', () => {
    const messages = (s: SessionDEdition) => avertissementsDeLaSession(s).map((w) => w.message);
    expect(messages(ouverteSous(CAT, auNordEst))).toEqual([`entité « n » › orientation : ${CAP_NE}`]);
    expect(messages(ouverteSous(undefined, auNordEst))).toEqual([`entité « n » › coque › identifiant : « ${NAVIRE} » est absent du catalogue des véhicules (vehicles.json).`]);
  });

  it('l’ouverture du dépôt, l’enregistrement et l’essai passent la porte sous le catalogue reçu', () => {
    expect(projetDuDepot(projetDe(auNord), CAT).ok).toBe(true);
    expect(projetDuDepot(projetDe(auNord)).ok).toBe(false);
    const sous = ouverteSous(CAT, auNord);
    const sousLeProcessus = ouverteSous(undefined, auNord);
    expect([texteAEnregistrer(sous).ok, essaiDeLaScene(sous).ok]).toEqual([true, true]);
    expect([texteAEnregistrer(sousLeProcessus).ok, essaiDeLaScene(sousLeProcessus).ok]).toEqual([false, false]);
  });
});

describe('la session reposée sous un catalogue (`sessionSousLeCatalogue`, fossile 9)', () => {
  it('reposée sous son propre catalogue, elle reste la même ; sous un autre, elle juge le geste suivant et sa validation sous lui', () => {
    const s = ouverteSous(undefined, bassin(navire('N', { pos: { x: 6, y: 12 } })), 'n');
    expect(sessionSousLeCatalogue(s, s.catalogue)).toBe(s);
    expect(sessionSousLeCatalogue(s)).toBe(s);
    const reposee = sessionSousLeCatalogue(s, CAT);
    const ouest = { geste: 'entite', patch: { facing: 'O' } } as const;
    expect(entite(editer(s, ouest)).facing).toBe('O');
    expect(editer(reposee, ouest)).toBe(reposee);

    const deBiais = ouverteSous(undefined, bassin(navire('NE', { pos: { x: 12, y: 12 } })));
    const caps = (t: SessionDEdition) => avertissementsDeLaSession(t).map((w) => w.message).filter((m) => m.endsWith(CAP_NE));
    expect(caps(deBiais), 'le navire inconnu du processus n’a pas de cap jugé').toEqual([]);
    expect(caps(sessionSousLeCatalogue(deBiais, CAT)), 'mêmes scènes, autre catalogue : la validation le relit').toHaveLength(1);
  });
});
