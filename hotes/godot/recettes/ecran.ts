/**
 * LES VUES FIGÉES DE L'ÉCRAN (#3328) : ce que la recette native de l'écran (`projet/recettes/ecran.gd`) montre, figé par
 * la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. Un tour de `dome` joué par le pont comme
 * Godot le joue (le début du round, la barre de l'actif, la charge armée, la fenêtre d'attaque avant puis après le
 * jet, chaque fois le geste en focus pressé), puis le combat poursuivi en joueur pressé (chaque fenêtre par son geste en
 * focus ou sa première valeur ouverte, chaque tour une charge ou une attaque sur la première cible, sinon la fin du tour) jusqu'au premier Coup
 * Critique, la fiche du premier héros ouverte par son bouton puis chacun de ses onglets par le sien, sa première
 * possession choisie (ses gestes refusés en combat), le combat poursuivi de même jusqu'à sa fin (la fenêtre de sa
 * fin, sa sortie en focus), la création d'un héros hors de la partie (`zonesDeLaCreation` sur
 * l'état initial : la race avant puis après son d100, la carrière tirée, les Caractéristiques en 100 points, chacune en
 * liste), et un formulaire
 * de chaque saisie près d'un geste refusé (`elementsDesGestes`). Chaque vue porte
 * ses zones, les lignes que le tour a ajoutées au journal sous `journal.lignes` (où le routeur `combat.gd` les range),
 * et l'intention que chaque formulaire joue pressé tel qu'il est dessiné (`attendus`).
 */
import { creerPont, SANS_BORNE, type Suite } from '../pont/pont';
import { CLICS_DU_CHAMP, brouillonDeLaPartie, creerPartie, etatInitialDuJeu, horlogeVirtuelle } from '../../../src/noyau/index';
import { zonesDeLEcran, type ZonesDeLaSuite, type ZonesDeLEcran } from '../../../src/hote/ecran';
import { elementsDesGestes, ligne, ONGLETS_DE_LA_FICHE, type Bouton, type Choix, type CreationOuverte, type GesteDeLaCreation, type Jeu, type Ligne } from '../../../src/hote/elements';
import { apresLaCreation, zonesDeLaCreation } from '../../../src/hote/creation';
import { fenetreADessiner, type ArgumentDuGeste, type GesteDeLaFenetre } from '../../../src/hote/gestes';
import { projeter } from '../../../src/hote/projection';
import { nouvelEntete, scenarioDeTest } from '../../../src/hote/partie';

/** Une vue de l'écran figée : son nom, sa disposition, ses zones, et l'intention de chaque formulaire par son id. */
export interface VueFigee {
  nom: string;
  disposition: string | null;
  zones: ZonesDeLEcran & ZonesDeLaSuite;
  attendus: Record<string, Jeu>;
}

/** Un argument saisi du formulaire de recette. */
const argument = (nom: string, saisie: ArgumentDuGeste['saisie'], partie: Partial<ArgumentDuGeste>): ArgumentDuGeste => ({
  nom, optionnel: false, saisie, libelle: `Saisie ${nom}`, valeur: null, valeurs: null, bornes: null, note: null, champs: null, ...partie,
});

/** Un geste en formulaire, une saisie de chaque sorte, et les arguments qu'il joue pressé tel qu'il est dessiné. */
const FORMULAIRE: GesteDeLaFenetre = {
  cle: 'formulaire', verbe: 'verbeDeRecette', libelle: 'Jouer le formulaire', rendu: 'formulaire', aChoisir: null, attendu: true, ouvert: true, raison: null, reglage: false,
  arguments: [
    argument('pid', 'fixe', { libelle: null, valeur: 'designe' }),
    argument('choix', 'choix', { valeur: 'b', valeurs: [{ valeur: 'a', libelle: 'Valeur A', refus: null }, { valeur: 'b', libelle: 'Valeur B', refus: null }, { valeur: 'c', libelle: 'Valeur C', refus: 'Refusée' }] }),
    argument('nombre', 'nombre', { valeur: 3, bornes: { min: 0, max: 10, pas: 1 } }),
    argument('texte', 'texte', { valeur: 'mot' }),
    argument('json', 'json', { valeur: { a: 1 } }),
    argument('objet', 'objet', { champs: [argument('x', 'nombre', { valeur: 2 }), argument('y', 'texte', { valeur: 'z' })] }),
  ],
};
const ARGUMENTS_DU_FORMULAIRE = ['designe', 'b', 3, 'mot', { a: 1 }, { x: 2, y: 'z' }];

/** Le premier document de la liasse de « Documents de L'Ennemi dans l'Ombre » remis dans une partie neuve, sa fenêtre
 *  dessinée, puis la partie fermée : le noyau n'en tient qu'une, et le pont garde la sienne. */
function vueDuDocument(): { disposition: string; zones: ZonesDeLEcran } {
  const [doc] = scenarioDeTest('documents-edo').construire().narratif!.documents;
  const e = nouvelEntete('documents-edo', { graine: 7 });
  const partie = creerPartie(etatInitialDuJeu(), { graine: e.graine, reglesMaison: e.regles, cadence: e.cadence, desFixes: e.desFixes, persisterLeHeros: () => {} });
  try {
    partie.etat().remettreDocument({ title: doc.titre, text: doc.prose, documentId: doc.id });
    const etat = partie.etat();
    const fenetre = fenetreADessiner(etat);
    return { disposition: fenetre!.disposition, zones: zonesDeLEcran(etat, projeter(etat, 0, 0, SANS_BORNE), fenetre, null, null) };
  } finally {
    partie.fermer();
  }
}

/** Un geste ouvert que sa fermeture refuse, sa raison dite. */
const REFUSE: GesteDeLaFenetre = { cle: 'refuse', verbe: 'verbeDeRecette', libelle: 'Geste refusé', arguments: [], rendu: 'bouton', aChoisir: null, attendu: false, ouvert: true, raison: 'Fermé par le jet', reglage: false };

export function figerVuesDeLEcran(): VueFigee[] {
  const remis = vueDuDocument();
  const pont = creerPont();
  const appeler = (methode: string, entree: unknown): Suite => {
    const r = JSON.parse(pont.appeler(methode, JSON.stringify(entree))) as { ok: boolean } & Suite;
    if (!r.ok) throw new Error(`${methode} ${JSON.stringify(entree)} : ${JSON.stringify(r)}`);
    return r;
  };
  const lignes: Ligne[] = [];
  const jouer = (methode: string, entree: unknown): Suite => {
    let s = appeler(methode, entree);
    lignes.push(...s.zones['journal.lignes']);
    horlogeVirtuelle((jeton) => {
      s = appeler('reprendre', { jeton });
      lignes.push(...s.zones['journal.lignes']);
      return s.programmes;
    }, s.programmes).vider();
    return s;
  };
  const vues: VueFigee[] = [];
  const figer = (nom: string, s: Suite) => vues.push({ nom, disposition: s.vue.disposition, zones: { ...s.vue.zones, 'journal.lignes': [...lignes] }, attendus: {} });
  const enFocus = (s: Suite): Jeu => {
    const b = s.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus);
    if (!b) throw new Error(`aucun bouton que l’Entrée joue dans ${JSON.stringify(s.vue.zones['fenetre.gestes'].map((g) => g.id))}`);
    return b.jeu;
  };

  let s = jouer('demarrer', { scenario: 'dome', graine: 7 });
  figer('début du round', s);
  s = jouer('jouer', enFocus(s));
  figer('barre de l’actif', s);
  s = jouer('jouer', { offre: 'charge' });
  figer('charge armée', s);
  const [cible] = s.vue.projection.combat!.cibles.liste;
  s = jouer('jouer', { type: CLICS_DU_CHAMP.combattant, args: [cible] });
  figer('fenêtre d’attaque', s);
  s = jouer('jouer', enFocus(s));
  figer('jet d’attaque tombé', s);
  s = jouer('jouer', enFocus(s));
  for (let tours = 0; s.vue.projection.fenetre?.etape?.genre !== 'defenseJet'; tours++) {
    if (tours > 4) throw new Error(`aucune Défense après ${tours} fins de tour : ${JSON.stringify(s.vue.projection.fenetre)}`);
    s = jouer('jouer', { offre: 'end-turn' });
    if (s.vue.projection.combat!.finDeTourArmee) s = jouer('jouer', { offre: 'end-turn' });
  }
  figer('Défense', s);
  s = jouer('jouer', enFocus(s));
  figer('jet de Défense tombé', s);
  /** Le geste du joueur pressé : dans une fenêtre, son geste en focus, sinon sa première valeur ouverte ; sinon, une
   *  charge ou une attaque sur la première cible, ou la fin du tour. */
  const presse = (s: Suite): Jeu => {
    const c = s.vue.projection.combat!;
    if (s.vue.projection.fenetre) {
      const g = s.vue.zones['fenetre.gestes'];
      return g.some((b) => b.type === 'bouton' && b.focus) ? enFocus(s) : g.flatMap((x) => (x.type === 'choix' ? x.valeurs : [])).find((b) => !b.refus)!.jeu;
    }
    const offres = s.vue.zones['combat.offres'].flatMap((x) => x.valeurs).filter((b) => !b.refus);
    return c.intention && c.cibles.liste.length ? { type: CLICS_DU_CHAMP.combattant, args: [c.cibles.liste[0]] }
      : (offres.find((o) => !c.intention && (o.id === 'charge' || o.id === 'attaque')) ?? offres.find((o) => o.id === 'end-turn')!).jeu;
  };
  for (let pas = 0; s.vue.projection.fenetre?.etape?.genre !== 'critical'; pas++) {
    const c = s.vue.projection.combat!;
    if (pas > 300 || c.fin) throw new Error(`aucun Coup Critique après ${pas} gestes : combat ${c.fin ?? 'en cours'}`);
    s = jouer('jouer', presse(s));
  }
  figer('Coup Critique', s);
  s = appeler('fiche', s.vue.zones['groupe.heros'][0].jeu);
  for (const onglet of ONGLETS_DE_LA_FICHE) {
    s = appeler('fiche', s.vue.zones['fiche.gestes'].find((b) => b.id === `onglet/${onglet}`)!.jeu);
    figer(`fiche du héros, ${onglet}`, s);
  }
  s = appeler('fiche', s.vue.zones['fiche.corps'].find((e): e is Bouton => e.type === 'bouton')!.jeu);
  figer('fiche du héros, une possession choisie', s);
  s = appeler('fiche', { fiche: null });
  const fini = (s: Suite) => !!s.vue.projection.combat?.fin && !!s.vue.projection.fenetre && !s.vue.projection.fenetre.etape;
  for (let pas = 0; !fini(s); pas++) {
    if (pas > 600) throw new Error(`aucune fin du combat après ${pas} gestes`);
    s = jouer('jouer', presse(s));
  }
  figer(`fin du combat, ${s.vue.zones['fenetre.titre'][0]?.texte ?? 'sans fenêtre'}`, s);

  vues.push({ nom: 'pièce remise, la première de la liasse', disposition: remis.disposition, zones: { ...remis.zones, 'journal.lignes': [...lignes] }, attendus: {} });

  const vides: ZonesDeLEcran = {
    'fenetre.titre': [], 'fenetre.etape': [], 'fenetre.corps': [], 'fenetre.reglages': [], 'fenetre.gestes': [],
    'combat.tour': [], 'combat.ordre': [], 'combat.actif': [], 'combat.avis': [], 'combat.apercu': [], 'combat.offres': [], 'exploration.gestes': [], 'dialogue.orateur': [], 'dialogue.replique': [], 'dialogue.reponses': [], 'journal.titre': [],
    'groupe.heros': [], 'fiche.heros': [], 'fiche.gestes': [], 'fiche.corps': [], 'fiche.objet': [],
    'groupe.gestes': [], 'creation.titre': [], 'creation.corps': [], 'creation.gestes': [],
  };
  const etat = etatInitialDuJeu();
  let creation: CreationOuverte = { brouillon: brouillonDeLaPartie(7, 0), page: 'species' };
  const figerLaCreation = (nom: string) => vues.push({ nom, disposition: null, zones: { ...vides, ...zonesDeLaCreation(etat, creation), 'journal.lignes': [...lignes] }, attendus: {} });
  const jouerLaCreation = (id: string, valeur?: string) => {
    const e = zonesDeLaCreation(etat, creation)['creation.corps'].find((x) => x.id === id)!;
    const b = (e.type === 'bouton' ? e : (e as Choix).valeurs.find((v) => v.libelle === valeur)!).jeu as { creation: Exclude<GesteDeLaCreation, { geste: 'ouvrir' | 'engager' }> };
    creation = apresLaCreation(creation, b.creation);
  };
  figerLaCreation('création, la race avant le d100');
  jouerLaCreation('tirage');
  figerLaCreation('création, la race tirée');
  creation = { ...creation, page: 'career' };
  jouerLaCreation('tirage');
  figerLaCreation('création, la carrière tirée');
  creation = { ...creation, page: 'chars' };
  jouerLaCreation('methode', 'Répartir 100 points');
  figerLaCreation('création, les Caractéristiques en 100 points');

  vues.push({
    nom: 'formulaire de chaque saisie',
    disposition: null,
    zones: { ...vides, 'fenetre.titre': [ligne('titre', 'Formulaire de recette')], 'fenetre.gestes': elementsDesGestes([FORMULAIRE, REFUSE]), 'journal.lignes': [...lignes] },
    attendus: { [FORMULAIRE.cle]: { type: FORMULAIRE.verbe, args: ARGUMENTS_DU_FORMULAIRE } },
  });
  return vues;
}
