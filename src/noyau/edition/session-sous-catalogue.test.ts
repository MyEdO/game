/**
 * La session d'édition juge chaque lecture sous le catalogue qu'elle porte (#5070, plan
 * `docs/plans/2026-11-25-composition-d-un-jeu.md` § 5.1, point 2, et fossile 9) : la table d'écriture, la pose des
 * ponts d'`editer`, l'inspecteur de l'hôte, la fiche d'un personnage, les fiches que la palette et l'inspecteur offrent,
 * la validation et la porte du projet. Fixtures : un navire à ponts présent SEULEMENT dans le catalogue de la suite
 * (`navireDuLivreDeTest`), un catalogue où la caraque n'a pas de ponts, un catalogue privé de toute créature, où la fiche
 * se juge par son absence, des créatures à Blessures déclarées par la suite, et une espèce déclarée dont l'une est le
 * profil standard.
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
import { choixDuChamp, entiteDeLaSelection, fichesDePersonnage, type ProjetDEdition } from '../sceneEditLecture';
import { emptyNarratif } from '../monde/campaignNarratif';
import { buildScene } from '../mapSpec';
import type { Scene, SceneEntity } from '../monde/scene';
import { boutonDeLEdition, inspecteurDeLaSession, zonesDeLEditeur } from '../../hote/editeur';
import { t } from '../../i18n';
import { catalogueAvec } from '../../data/catalogueAvec.testkit';
import { catalogueDuProcessus } from '../../data/catalogueDuProcessus';
import { catalogueDeTest, type LivreDeTest } from '../../data/schemas/catalogue/catalogueDeTest.testkit';
import type { Catalogue } from '../../data/schemas/catalogue/catalogue';
import { idDeFixture } from '../../data/idDeFixture.testkit';
import { NAVIRE, navire, navireDuLivreDeTest } from '../navireDuLivreDeTest.testkit';

const CAT = catalogueAvec({ 'vehicles.json': [navireDuLivreDeTest()] });
/** La caraque présente, sans ses ponts : un véhicule que la session connaît, qu'aucun cap ne refuse. */
const CARAQUE_SANS_PONTS = catalogueDeTest({ 'vehicles.json': catalogueDuProcessus()['vehicles.json'].map((v) => (v.id === 'caraque' ? { ...v, ponts: undefined } : v)) });
/** Un catalogue qui ne porte aucune créature : aucune entité n'y a de fiche. */
const SANS_CREATURE = catalogueDeTest({});
const CAP_NE = `navire « ${NAVIRE} » au cap NE — un navire à ponts ne prend qu'un cap cardinal (N/E/S/O)`;
/** Une fiche de personnage déclarée par la suite : une créature à Blessures (`char.B`), inconnue du processus. */
const fiche = (id: string): NonNullable<LivreDeTest['creatures.json']>[number] => ({
  id, type: 'creatures', label: id, source: { book: 'LDB', page: 1 }, title: null, folder: null,
  char: { B: 10 }, traits: [], optionals: [], skills: [], talents: [], trappings: [], spells: [], appearance: { species: 'humain' },
});

/** Le bassin 24 × 24 à l'échelle du plan, aux entités `entites`. */
const bassin = (...entites: SceneEntity[]): Scene => ({ ...buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', metresPerTile: 2 }), entities: entites });
/** Le projet du dépôt qui porte la seule scène `scene`. */
const projetDe = (scene: Scene) => ({ id: 'p', type: 'projet', label: 'P', versionContenu: 1, maison: 'catalogue', scenes: [scene], narratif: emptyNarratif() });
/** La session ouverte du dépôt sous `cat` (le catalogue du processus à défaut) sur la scène `scene`, son entité `id`
 *  sélectionnée. */
const ouverteSous = (cat: Catalogue | undefined, scene: Scene, id?: string): SessionDEdition => {
  const s = ouvrirLEdition(projetDe(scene) as ProjetDEdition, { duDepot: true }, cat);
  return id ? editer(s, { geste: 'selectionner', porteur: { sorte: 'entite', id } }) : s;
};
const valeur = (id: string, chemin: (string | number)[], v: unknown): Extract<GesteDEdition, { geste: 'valeur' }> => ({ geste: 'valeur', porteur: { sorte: 'entite', id }, chemin, valeur: v });
const entite = (s: SessionDEdition) => entiteDeLaSelection(sceneEditee(s), s.sel)!;
/** Les ids des éléments de l'inspecteur de l'hôte, et de leurs valeurs. */
const idsDeLInspecteur = (s: SessionDEdition) => inspecteurDeLaSession(s).flatMap((el) => [el.id, ...('valeurs' in el ? el.valeurs.map((v) => v.id) : [])]);

describe('la session écrit et pose un navire sous son catalogue', () => {
  it('la table d’écriture juge le véhicule écrit sous le catalogue de la session : la caraque au cap NE, refusée sous le processus, s’écrit sous un catalogue où elle n’a pas de ponts', () => {
    const charrette = navire('NE', { pos: { x: 12, y: 12 }, vehicule: { id: 'charrette' } });
    const caraque = valeur('n', ['vehicule', 'id'], 'caraque');
    const sansPonts = ouverteSous(CARAQUE_SANS_PONTS, bassin(charrette), 'n');
    expect(refusDeLaValeur(sansPonts, caraque)).toBeNull();
    const ecrite = editer(sansPonts, caraque);
    expect(entite(ecrite).vehicule).toEqual({ id: 'caraque' });
    const duVehicule = avertissementsDeLaSession(ecrite).map((w) => w.message).filter((m) => /caraque|véhicule|vehicles/.test(m));
    expect(duVehicule, 'la validation de la session ne dit rien du véhicule écrit').toEqual([]);
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

describe('les fiches qu’un personnage nomme se lisent sous le catalogue de la session (`fichesDePersonnage`)', () => {
  const FICHE = 'fiche-de-la-suite';
  /** La seule fiche de personnage que la suite déclare (`fiche`). */
  const SOUS_LA_FICHE = catalogueAvec({ 'creatures.json': [fiche(FICHE)] });
  const posee: SceneEntity = { id: 'f', kind: 'personnage', creature: { id: FICHE }, pos: { x: 1, y: 1 } };
  /** Les ids des fiches de la palette de l'outil personnage. */
  const palette = (cat: Catalogue | undefined) => {
    const s = editer(ouverteSous(cat, bassin()), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: FICHE } });
    return zonesDeLEditeur(s)['editeur.options'].flatMap((el) => ('valeurs' in el ? el.valeurs.map((v) => v.id) : [])).filter((i) => i.startsWith('personnage/'));
  };
  const auChoixFiche = (cat: Catalogue | undefined) => idsDeLInspecteur(ouverteSous(cat, bassin(posee), 'f')).includes(`entite/type/${FICHE}`);

  it('la palette et le choix « Fiche » de l’inspecteur offrent la fiche du seul catalogue de la session ; sous le processus, ni l’un ni l’autre', () => {
    expect(palette(SOUS_LA_FICHE)).toContain(`personnage/${FICHE}`);
    expect(auChoixFiche(SOUS_LA_FICHE)).toBe(true);
    expect(palette(undefined)).not.toContain(`personnage/${FICHE}`);
    expect(auChoixFiche(undefined)).toBe(false);
  });
});

describe('l’outil personnage se lit sous le catalogue de la session (`fichesDePersonnage`)', () => {
  const ORDINAIRE = 'fiche-ordinaire-de-la-suite';
  const STANDARD = 'fiche-standard-de-la-suite';
  /** Une espèce déclarée par la suite, aux valeurs neutres, dont le profil standard (`LDB 77 l.7`) est `STANDARD`. */
  const espece: NonNullable<LivreDeTest['species.json']>[number] = {
    id: 'espece-de-la-suite', type: 'species', label: 'Espèce de la suite', source: { book: 'LDB', page: 1 },
    family: 'Suite', refChar: 'humain', refCareer: 'humain', movement: 4,
    fate: { fate: 0, resilience: 0, extra: 0 }, skills: [], talents: [], grantGroups: [],
    baseChar: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: 0, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    profilStandard: { id: idDeFixture('creature', STANDARD) },
  };
  const SOUS_DEUX_FICHES = catalogueDeTest({ 'creatures.json': [fiche(ORDINAIRE), fiche(STANDARD)], 'species.json': [espece] });
  const outilPersonnage = (s: SessionDEdition) =>
    zonesDeLEditeur(s)['editeur.outils'].flatMap((el) => ('valeurs' in el ? el.valeurs : [])).find((b) => b.id === 'outil/personnage');

  it('sous un catalogue sans fiche, le bouton Personnage est refusé, et son geste joué rend ce refus', () => {
    const s = ouverteSous(SANS_CREATURE, bassin());
    const bouton = outilPersonnage(s);
    expect(bouton?.refus).toBe(t('ecran.editeur.personnage.sansFiche'));
    expect(bouton?.jeu).toEqual({ edition: { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: null } } });
    expect(boutonDeLEdition(zonesDeLEditeur(s), { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: null } })).toMatchObject({ id: 'outil/personnage', refus: bouton?.refus });
    const enMain = editer(s, { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: ORDINAIRE } });
    expect(outilPersonnage(enMain)?.refus, 'l’outil personnage déjà en main ne lève pas le refus').toBe(t('ecran.editeur.personnage.sansFiche'));
  });

  it('sous un catalogue qui porte une fiche, le bouton Personnage est offert, sa référence par défaut la première fiche', () => {
    const bouton = outilPersonnage(ouverteSous(catalogueDeTest({ 'creatures.json': [fiche(ORDINAIRE)] }), bassin()));
    expect(bouton?.refus).toBeNull();
    expect(bouton?.jeu).toEqual({ edition: { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: ORDINAIRE } } });
  });

  it('le profil standard d’une espèce du catalogue vient en tête des fiches, et de la référence par défaut', () => {
    expect(fichesDePersonnage(SOUS_DEUX_FICHES).map((c) => c.id)).toEqual([STANDARD, ORDINAIRE]);
    expect(outilPersonnage(ouverteSous(SOUS_DEUX_FICHES, bassin()))?.jeu).toEqual({ edition: { geste: 'outil', outil: { mode: 'entite', kind: 'personnage', ref: STANDARD } } });
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
