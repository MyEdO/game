import { isDeepStrictEqual } from 'node:util';
import { adresseDeCreation } from './engine/adresseDeCreation';
import { gesteDuFormulaire, zonesDeLEditeur } from './hote/editeur';
import type { Bouton } from './hote/elements';
import { editer, sceneEditee, type Segment, type SessionDEdition } from './noyau/index';
import { auChemin, estObjet } from './lib/objet.mjs';

type EcritureDOutil = ReturnType<typeof consigner> & {
  mouvement?: { geste: 'inserer'; chemin: readonly Segment[] };
  crediteParent?: true;
};

type Appui = (s: SessionDEdition, x: number, y: number) => SessionDEdition;
interface OutilsDuBanc {
  presser(s: SessionDEdition, id: string): SessionDEdition;
  cliquer: Appui;
  poserUnNavire(s: SessionDEdition, x: number, y: number, out: EcritureDOutil[]): SessionDEdition;
}

/** Les boutons disponibles dans le choix nommé de la session. */
function choix(s: SessionDEdition, id: string): Bouton[] {
  const element = Object.values(zonesDeLEditeur(s)).flat().find((e) => e.id === id);
  return element?.type === 'choix' || element?.type === 'liste' ? element.valeurs.filter((b: Bouton) => !b.refus) : [];
}

/** Le premier bouton de ce choix que la session ne tient pas déjà pressé. */
function option(s: SessionDEdition, id: string): Bouton {
  const b = choix(s, id).find((v) => !v.presse);
  if (!b) throw new Error(`aucune option non pressée dans ${id}`);
  return b;
}

/** Une écriture relue à son adresse, avec la valeur demandée par l'offre. */
function consigner(s: SessionDEdition, suite: SessionDEdition, chemin: Segment[], valeur: unknown, saisie = 'bouton') {
  const avant = sceneEditee(s);
  const apres = sceneEditee(suite);
  if (isDeepStrictEqual(auChemin(avant, chemin), valeur) || !isDeepStrictEqual(auChemin(apres, chemin), valeur)) {
    throw new Error(`le geste offert n’a pas écrit ${chemin.join('/')}`);
  }
  return { avant, apres, chemin, valeur, saisie };
}

/** Le bouton d'une liste d'id ajoute exactement l'id qu'il nomme après les entrées déjà là. */
function ajout(s: SessionDEdition, bouton: Bouton, chemin: Segment[], presser: OutilsDuBanc['presser'], out: EcritureDOutil[]): SessionDEdition {
  const id = bouton.id.slice(bouton.id.lastIndexOf('/') + 1);
  const ancienne = auChemin(sceneEditee(s), chemin);
  const liste = Array.isArray(ancienne) ? ancienne : [];
  const suite = presser(s, bouton.id);
  const nouvelle = [...liste, id];
  const conteneur = consigner(s, suite, chemin, nouvelle);
  const position = [...chemin, liste.length];
  const mouvement = { geste: 'inserer' as const, chemin: position };
  out.push({ ...conteneur, mouvement }, { ...consigner(s, suite, position, id), mouvement });
  return suite;
}

/** Le record change à la clé désignée par le contrôle joué. */
function entree(s: SessionDEdition, suite: SessionDEdition, chemin: Segment[], cle: string, valeur: unknown): EcritureDOutil {
  const avant = auChemin(sceneEditee(s), chemin);
  const apres = auChemin(sceneEditee(suite), chemin);
  if (!isDeepStrictEqual(apres, { ...(estObjet(avant) ? avant : {}), [cle]: valeur })) {
    throw new Error(`le geste offert a changé plus que ${chemin.join('/')}/${cle}`);
  }
  return consigner(s, suite, [...chemin, cle], valeur);
}

/** Le rang de l'entité ou de la zone sélectionnée, lu par l'identifiant que l'outil a posé. */
function rangSelectionne(s: SessionDEdition, collection: 'entities' | 'effectZones' | 'triggers'): number {
  const id = s.sel && 'id' in s.sel ? s.sel.id : undefined;
  const rang = sceneEditee(s)[collection]?.findIndex((e) => e.id === id) ?? -1;
  if (rang < 0) throw new Error(`aucun porteur sélectionné dans ${collection}`);
  return rang;
}

/** Un pinceau de taille 1 écrit sa seule case. Une première prise prépare les grilles optionnelles. */
function peindre(depart: SessionDEdition, { presser, cliquer }: OutilsDuBanc, out: EcritureDOutil[]): void {
  const x = 1;
  const y = 1;
  const w = sceneEditee(depart).dimensions.w;
  const z = depart.z;
  const couche = sceneEditee(depart).layers.findIndex((l) => l.z === z);
  const rang = y * w + x;
  const cases = [
    { outil: 'outil/tile', liste: 'terrains', champ: 'tiles', initialiser: false },
    { outil: 'outil/height', liste: 'hauteurs', champ: 'height', initialiser: true },
    { outil: 'outil/crenellated', liste: 'parapets', champ: 'crenellated', initialiser: true },
  ] as const;
  for (const { outil, liste, champ, initialiser } of cases) {
    let s = presser(presser(depart, outil), 'pinceau/1');
    const courant = auChemin(sceneEditee(s), ['layers', couche, champ, rang]);
    const bouton = choix(s, liste).find((b) => {
      const g = 'edition' in b.jeu && b.jeu.edition;
      if (!g || g.geste !== 'outil') return false;
      const choix = g.outil;
      if (choix.mode === 'terrain') return choix.terrain !== courant;
      if (choix.mode === 'hauteur') return choix.metres !== 0;
      return choix.mode === 'crenelage' && choix.structure !== null;
    });
    if (!bouton) throw new Error(`aucune autre peinture pour ${champ}`);
    s = presser(s, bouton.id);
    if (initialiser) s = cliquer(s, x + 1, y);
    const suite = cliquer(s, x, y);
    const ici = ['layers', couche, champ];
    const avant = auChemin(sceneEditee(s), ici);
    const apres = auChemin(sceneEditee(suite), ici);
    const outilSaisi = s.outil;
    const valeur = outilSaisi.mode === 'terrain' ? outilSaisi.terrain
      : outilSaisi.mode === 'hauteur' ? outilSaisi.metres : outilSaisi.mode === 'crenelage' ? outilSaisi.structure : undefined;
    if (!Array.isArray(avant) || !isDeepStrictEqual(apres, avant.map((v, i) => i === rang ? valeur : v))) {
      throw new Error(`le pinceau ${champ} n’a pas écrit la seule case visée`);
    }
    out.push(consigner(s, suite, [...ici, rang], valeur));
  }
}

/** Une fiche est ajoutée à chacune des couvertures depuis son choix dédié. */
function couvrir(depart: SessionDEdition, { presser, cliquer }: OutilsDuBanc, out: EcritureDOutil[]): void {
  ajout(depart, option(depart, 'scene/couvre/ajouter'), ['couvre'], presser, out);
  ajout(depart, option(depart, 'scene/groupes/ajouter'), ['groups'], presser, out);
  for (const [sorte, collection] of [['effect', 'effectZones'], ['trigger', 'triggers']] as const) {
    const s = cliquer(presser(presser(depart, 'outil/zone'), `zone/${sorte}`), 2, 2);
    ajout(s, option(s, 'zone/couvre/ajouter'), [collection, rangSelectionne(s, collection), 'couvre'], presser, out);
  }
}

/** Un drapeau ajouté au formulaire est ensuite basculé à sa propre clé. */
function drapeau(depart: SessionDEdition, { presser }: OutilsDuBanc, out: EcritureDOutil[]): void {
  const cle = 'banc-drapeau';
  const geste = gesteDuFormulaire(zonesDeLEditeur(depart), { type: 'drapeau', args: [cle] });
  if (!geste) throw new Error('le formulaire d’ajout de drapeau est absent');
  const ajoute = editer(depart, geste);
  out.push(entree(depart, ajoute, ['flags'], cle, true));
  out.push(entree(ajoute, presser(ajoute, `scene/drapeau/${cle}`), ['flags'], cle, false));
}

/** Les choix d'un même personnage écrivent son objet porté, son niveau puis sa dotation. */
function personnage(depart: SessionDEdition, outils: OutilsDuBanc, out: EcritureDOutil[]): void {
  const { presser, cliquer, poserUnNavire } = outils;
  const pnj = cliquer(presser(depart, 'outil/personnage'), 2, 2);
  const rang = rangSelectionne(pnj, 'entities');
  const chemin = ['entities', rang];
  ajout(pnj, option(pnj, 'entite/couvre/ajouter'), [...chemin, 'couvre'], presser, out);
  const objet = 'cotte-de-mailles';
  const ajoute = presser(pnj, `inventaire/ajouter/${objet}`);
  const porte = presser(ajoute, `inventaire/${objet}/porte`);
  out.push(entree(ajoute, porte, [...chemin, 'inventaire'], objet, true));

  const soldat = presser(pnj, 'carriere/ajouter/soldat');
  const niveau = presser(soldat, 'carriere/soldat/niveau/2');
  out.push(entree(soldat, niveau, [...chemin, 'carrieres'], 'soldat', 2));
  const adresse = adresseDeCreation.dotation([3]);
  const dotation = presser(niveau, `carriere/dotation/${adresse}/hallebarde`);
  out.push(entree(niveau, dotation, [...chemin, 'dotationsDeCarriere'], adresse, 'hallebarde'));

  const navire = poserUnNavire(pnj, 8, 6, out);
  const cheminNavire = ['entities', rangSelectionne(navire, 'entities')];
  const changement = option(navire, 'valeur/vehicule/id');
  const joue = gesteDuFormulaire(zonesDeLEditeur(navire), JSON.parse(JSON.stringify(changement.jeu)));
  if (joue?.geste !== 'valeur' || typeof joue.valeur !== 'string') throw new Error('le choix de véhicule ne livre aucun identifiant');
  const change = presser(navire, changement.id);
  out.push({ ...consigner(navire, change, [...cheminNavire, ...joue.chemin], joue.valeur, 'saisieChoix'), crediteParent: true });

  const id = sceneEditee(pnj).entities[rang].id;
  const b = choix(navire, 'equipage').find((v) => v.id === `equipage/${id}`);
  if (!b) throw new Error('le personnage est absent des choix d’équipage');
  ajout(navire, b, [...cheminNavire, 'crewIds'], presser, out);
}

/** Une pièce de la même couche est offerte par les inspecteurs d'étage et de façade. */
function architecture(depart: SessionDEdition, { presser, cliquer }: OutilsDuBanc, out: EcritureDOutil[]): void {
  const couche = presser(depart, 'couche/ajouter');
  const aPiece = cliquer(presser(presser(couche, 'outil/zone'), 'zone/room'), 2, 2);
  const rez = presser(aPiece, 'couche/0');
  const bati = presser(cliquer(presser(rez, 'outil/architecture'), 2, 2), 'batir/corps');
  const etage = presser(bati, 'batir/etage');
  const sel = etage.sel;
  if (sel?.type !== 'architectureStorey') throw new Error('aucun étage sélectionné');
  const corps = sceneEditee(etage).architecture?.findIndex((b) => b.id === sel.bodyId) ?? -1;
  const rangEtage = sceneEditee(etage).architecture?.[corps]?.storeys.findIndex((e) => e.id === sel.id) ?? -1;
  ajout(etage, option(etage, 'etage/pieces'), ['architecture', corps, 'storeys', rangEtage, 'roomZoneIds'], presser, out);

  const outil = presser(etage, 'architecture/facade');
  const point = { case: { x: 2, y: 2 }, f: { x: 2, y: 1.55 } };
  const facade = editer(editer(outil, { geste: 'appui', point }), { geste: 'relache', point });
  const prise = facade.sel;
  if (prise?.type !== 'facadeSection') throw new Error('aucune façade sélectionnée');
  const rangFacade = sceneEditee(facade).architecture?.[corps]?.facades.findIndex((f) => f.id === prise.id) ?? -1;
  ajout(facade, option(facade, 'facade/pieces'), ['architecture', corps, 'facades', rangFacade, 'roomZoneIds'], presser, out);
}

/** Les entrées que les outils de scène écrivent par leurs boutons et leurs positions. */
export function ecrituresDesOutilsDeScene(depart: SessionDEdition, outils: OutilsDuBanc): EcritureDOutil[] {
  const out: EcritureDOutil[] = [];
  for (const famille of [peindre, couvrir, drapeau, personnage, architecture]) famille(depart, outils, out);
  return out;
}
