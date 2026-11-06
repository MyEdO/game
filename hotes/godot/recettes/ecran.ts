/**
 * LES VUES FIGÉES DE L'ÉCRAN (#3328) : ce que la recette native de l'écran (`projet/recettes/ecran.gd`) montre, figé par
 * la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. Un tour de `dome` joué par le pont comme
 * Godot le joue (le début du round, la barre de l'actif, la charge armée, la fenêtre d'attaque avant puis après le
 * jet, chaque fois le geste en focus pressé), puis le combat poursuivi en joueur pressé (chaque fenêtre par son geste en
 * focus ou sa première valeur ouverte, chaque tour une charge ou une attaque sur la première cible, sinon la fin du tour) jusqu'au premier Coup
 * Critique, la fiche du premier héros ouverte par son bouton puis chacun de ses onglets par le sien, sa première
 * possession choisie (ses gestes refusés en combat), le combat poursuivi de même jusqu'à sa fin (la fenêtre de sa
 * fin, sa sortie en focus), puis, chacun sur un pont neuf, le premier document de la liasse de `documents-edo` lu, et
 * dans `magie` la Fléchette choisie parmi les sorts de l'actif, sa fenêtre d'incantation avant puis après le jet et un pas
 * de Surincantation alloué, la création d'un héros hors de la partie (`zonesDeLaCreation` sur
 * l'état initial : la race avant puis après son d100, la carrière tirée, les Caractéristiques en 100 points, chacune en
 * liste), la carte du monde et le récit d'une arrivée dans `voyage`, puis dans `bataille-de-masse` l'entre-deux-aventures
 * (un onglet par héros), les Scènes du premier Round de la bataille et l'entre-deux-Rounds, dans
 * `entre-deux-aventures` les formulaires d'ouvrage et de dépôt du forgeron, et un formulaire de chaque saisie près d'un geste refusé (`elementsDesGestes`) et d'une rangée
 * de cases. Chaque vue porte
 * ses zones, les lignes que le combat du dôme a ajoutées au journal sous `journal.lignes` (où le routeur `combat.gd` les range),
 * et l'intention que chaque formulaire joue pressé tel qu'il est dessiné (`attendus`).
 */
import { creerPont, type Suite } from '../pont/pont';
import { CLICS_DE_L_EXPLORATION, CLICS_DU_CHAMP, brouillonDeLaPartie, etatInitialDuJeu, horlogeVirtuelle } from '../../../src/noyau/index';
import type { ZonesDeLaSuite, ZonesDeLEcran } from '../../../src/hote/ecran';
import { elementsDesGestes, ligne, ONGLETS_DE_LA_FICHE, type Bouton, type Choix, type CreationOuverte, type Element, type Formulaire, type GesteDeLaCreation, type Jeu, type Ligne, type Plan, type Saisie } from '../../../src/hote/elements';
import { apresLaCreation, zonesDeLaCreation } from '../../../src/hote/creation';
import type { ArgumentDuGeste, GesteDeLaFenetre } from '../../../src/hote/gestes';

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

/** Un formulaire d'une rangée de cases, une case cochée, une libre, une refusée : il joue la liste des cochées. */
const CASES: Formulaire = {
  type: 'formulaire', id: 'cases', libelle: 'Jouer les cases', verbe: 'verbeDeRecette', focus: false, refus: null,
  champs: [{
    type: 'saisieCoches', id: 'cases/c', ton: 'neutre', nom: 'c', optionnel: false, libelle: 'Saisie c',
    valeurs: [{ libelle: 'Case A', valeur: 'a', presse: true, refus: null }, { libelle: 'Case B', valeur: 'b', presse: false, refus: null }, { libelle: 'Case C', valeur: 'c', presse: false, refus: 'Refusée' }],
  }],
};

/** Un geste ouvert que sa fermeture refuse, sa raison dite. */
const REFUSE: GesteDeLaFenetre = { cle: 'refuse', verbe: 'verbeDeRecette', libelle: 'Geste refusé', arguments: [], rendu: 'bouton', aChoisir: null, attendu: false, ouvert: true, raison: 'Fermé par le jet', reglage: false };

/** Ce que la saisie `c` dit dessinée, comme Godot la lit (`Saisie.lire`, `saisie.gd`) : `[]` rien de saisi, sinon sa
 *  valeur posée ou pressée, la liste des valeurs pressées d'une rangée de cases, l'objet de ses champs. */
function lueDessinee(c: Saisie): unknown[] {
  switch (c.type) {
    case 'fixe': return [c.valeur];
    case 'saisieChoix': return c.valeurs.filter((v) => v.presse).map((v) => v.valeur);
    case 'saisieCoches': return [c.valeurs.filter((v) => v.presse).map((v) => v.valeur)];
    case 'saisieNombre': return [c.valeur];
    case 'saisieTexte': return c.valeur ? [c.valeur] : [];
    case 'saisieJson': return c.valeur ? [JSON.parse(c.valeur)] : [];
    case 'saisieObjet': return [Object.fromEntries(c.champs.flatMap((x) => {
      const lue = lueDessinee(x);
      return !lue.length && x.optionnel ? [] : [[x.nom, lue.length ? lue[0] : null]];
    }))];
  }
}

/** L'intention que le formulaire `f` joue pressé tel qu'il est dessiné (`Saisie.arguments`) : un champ optionnel vide
 *  clôt les arguments, un champ requis vide part `null`. */
function telQueDessine(f: Formulaire): Jeu {
  const args: unknown[] = [];
  for (const c of f.champs) {
    const lue = lueDessinee(c);
    if (!lue.length && c.optionnel) break;
    args.push(lue.length ? lue[0] : null);
  }
  return { type: f.verbe, args };
}

/** Chaque formulaire de `elements` et des entités qu'ils portent. */
const formulaires = (elements: readonly Element[]): Formulaire[] =>
  elements.flatMap((e) => (e.type === 'formulaire' ? [e] : e.type === 'entite' ? formulaires(e.elements) : []));

export function figerVuesDeLEcran(): VueFigee[] {
  const lignes: Ligne[] = [];
  const vues: VueFigee[] = [];
  /** Un pont neuf et ses appels ; `jouer` rejoue les jetons de chaque suite sur l'horloge virtuelle et verse les lignes
   *  de chaque suite à `journal`. L'écran de la recette ne fait qu'ajouter à son journal et les ids d'une ligne
   *  repartent de zéro à chaque partie : seul le combat du dôme verse au journal des vues. */
  const unPont = (journal: Ligne[]) => {
    const pont = creerPont();
    const appeler = (methode: string, entree: unknown): Suite => {
      const r = JSON.parse(pont.appeler(methode, JSON.stringify(entree))) as { ok: boolean } & Suite;
      if (!r.ok) throw new Error(`${methode} ${JSON.stringify(entree)} : ${JSON.stringify(r)}`);
      return r;
    };
    const jouer = (methode: string, entree: unknown): Suite => {
      let s = appeler(methode, entree);
      journal.push(...s.zones['journal.lignes']);
      horlogeVirtuelle((jeton) => {
        s = appeler('reprendre', { jeton });
        journal.push(...s.zones['journal.lignes']);
        return s.programmes;
      }, s.programmes).vider();
      return s;
    };
    return { appeler, jouer, fermer: pont.fermer };
  };
  const figer = (nom: string, s: Suite) => vues.push({
    nom, disposition: s.vue.disposition, zones: { ...s.vue.zones, 'journal.lignes': [...lignes] },
    attendus: Object.fromEntries(Object.values(s.vue.zones).flatMap((z) => formulaires(z)).map((f) => [f.id, telQueDessine(f)])),
  });
  const enFocus = (s: Suite): Jeu => {
    const b = s.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus);
    if (!b) throw new Error(`aucun bouton que l’Entrée joue dans ${JSON.stringify(s.vue.zones['fenetre.gestes'].map((g) => g.id))}`);
    return b.jeu;
  };

  const { appeler, jouer, fermer } = unPont(lignes);
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
  fermer();

  /** Une fenêtre après l'autre, chacune par son geste pressé, tant qu'une tient la main. */
  const viderLesFenetres = (j: ReturnType<typeof unPont>['jouer'], s: Suite): Suite => {
    for (let pas = 0; s.vue.projection.fenetre; pas++) {
      if (pas > 20) throw new Error(`fenêtres sans fin : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
      s = j('jouer', presse(s));
    }
    return s;
  };

  const liasse = unPont([]);
  s = viderLesFenetres(liasse.jouer, liasse.jouer('demarrer', { scenario: 'documents-edo', graine: 7 }));
  s = liasse.jouer('jouer', { type: CLICS_DE_L_EXPLORATION.case, args: [{ x: 2, y: 2 }] });
  s = liasse.jouer('jouer', s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Liasse de documents : Parcourir la liasse')!.jeu);
  const reponse = (debut: string) => s.vue.zones['dialogue.reponses'].find((b) => b.libelle.startsWith(debut))!.jeu;
  s = liasse.jouer('jouer', reponse('Chapitre 1'));
  s = liasse.jouer('jouer', reponse('Lire'));
  figer('pièce remise, la première de la liasse', s);
  liasse.fermer();

  const magie = unPont([]);
  s = viderLesFenetres(magie.jouer, magie.jouer('demarrer', { scenario: 'magie', graine: 7 }));
  s = viderLesFenetres(magie.jouer, magie.jouer('jouer', { type: CLICS_DE_L_EXPLORATION.case, args: [{ x: 16, y: 11 }] }));
  const sorts = s.vue.zones['combat.offres'].find((c): c is Choix => c.id === 'offre/cast-spell')!;
  s = magie.jouer('jouer', sorts.valeurs.find((b) => b.libelle === 'Fléchette')!.jeu);
  figer('sort choisi parmi ceux de l’actif', s);
  s = magie.jouer('jouer', { type: CLICS_DU_CHAMP.combattant, args: [s.vue.projection.combat!.cibles.liste[0]] });
  figer('fenêtre d’incantation', s);
  s = magie.jouer('jouer', enFocus(s));
  figer('jet d’incantation tombé', s);
  s = magie.jouer('jouer', (s.vue.zones['fenetre.reglages'][0] as Choix).valeurs[1].jeu);
  figer('un pas de Surincantation alloué', s);
  magie.fermer();

  const voyage = unPont([]);
  s = viderLesFenetres(voyage.jouer, voyage.jouer('demarrer', { scenario: 'voyage', graine: 7 }));
  s = voyage.jouer('jouer', s.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Carte du monde')!.jeu);
  figer('carte du monde', s);
  const plan = s.vue.zones['fenetre.corps'].find((e): e is Plan => e.type === 'plan')!;
  s = voyage.jouer('jouer', plan.points.flatMap((p) => p.elements).find((e): e is Choix => e.id === 'r-grandroute')!.valeurs[0].jeu);
  for (let pas = 0; !s.vue.zones['fenetre.corps'].some((e) => e.id === 'recit/issue'); pas++) {
    if (pas > 80) throw new Error(`aucun récit de voyage après ${pas} gestes : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
    if (s.vue.zones['fenetre.corps'].some((e) => e.id === 'repos/nuit')) figer('repos, la nuit à régler', s);
    s = voyage.jouer('jouer', presse(s));
  }
  figer('récit de voyage, arrivée', s);
  s = voyage.jouer('jouer', enFocus(s));
  figer('écran du lieu, ses services et ses trajets', s);
  voyage.fermer();

  const repit = unPont([]);
  s = repit.jouer('demarrer', { scenario: 'bataille-de-masse', graine: 7 });
  for (let pas = 0; !s.vue.zones['fenetre.corps'].some((e) => e.id === 'repit/semaines'); pas++) {
    if (pas > 12) throw new Error(`aucun répit entre deux aventures après ${pas} gestes : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
    s = repit.jouer('jouer', enFocus(s));
  }
  figer('entre deux aventures, un onglet par héros', s);
  s = repit.jouer('jouer', enFocus(s));
  const geste = (s: Suite, id: string): Jeu => {
    const b = s.vue.zones['fenetre.corps'].find((e): e is Bouton => e.type === 'bouton' && e.id === id);
    if (!b) throw new Error(`aucun geste ${id} dans ${JSON.stringify(s.vue.zones['fenetre.corps'].map((e) => e.id))}`);
    return b.jeu;
  };
  figer('bataille de masse, les Scènes du Round', s);
  s = repit.jouer('jouer', geste(s, 'bataille/geste/0'));
  figer('bataille de masse, entre deux Rounds', s);
  repit.fermer();

  const forge = unPont([]);
  s = forge.jouer('demarrer', { scenario: 'entre-deux-aventures', graine: 7 });
  for (let pas = 0; !s.vue.zones['fenetre.corps'].some((e) => e.id === 'repit/semaines'); pas++) {
    if (pas > 8) throw new Error(`aucun répit entre deux aventures après ${pas} gestes : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
    s = forge.jouer('jouer', enFocus(s));
  }
  figer('entre deux aventures, l’ouvrage et le dépôt du forgeron', s);
  forge.fermer();

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
    zones: { ...vides, 'fenetre.titre': [ligne('titre', 'Formulaire de recette')], 'fenetre.gestes': [...elementsDesGestes([FORMULAIRE, REFUSE]), CASES], 'journal.lignes': [...lignes] },
    attendus: { [FORMULAIRE.cle]: { type: FORMULAIRE.verbe, args: ARGUMENTS_DU_FORMULAIRE }, [CASES.id]: { type: CASES.verbe, args: [['a']] } },
  });
  return vues;
}
