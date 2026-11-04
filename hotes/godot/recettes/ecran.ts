/**
 * LES VUES FIGÉES DE L'ÉCRAN (#3328) : ce que la recette native de l'écran (`projet/recettes/ecran.gd`) montre, figé par
 * la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. Un tour de `dome` joué par le pont comme
 * Godot le joue (le début du round, la barre de l'actif, la charge armée, la fenêtre d'attaque avant puis après le
 * jet, chaque fois le geste en focus pressé) et un formulaire de chaque saisie près d'un geste refusé (`elementsDesGestes`). Chaque vue porte
 * ses zones, les lignes que le tour a ajoutées au journal sous `journal.lignes` (où le routeur `combat.gd` les range),
 * et l'intention que chaque formulaire joue pressé tel qu'il est dessiné (`attendus`).
 */
import { creerPont, type Suite } from '../pont/pont';
import { horlogeVirtuelle } from '../../../src/noyau/index';
import type { ZonesDeLaSuite, ZonesDeLEcran } from '../../../src/hote/ecran';
import { elementsDesGestes, ligne, type Bouton, type Jeu, type Ligne } from '../../../src/hote/elements';
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
  cle: 'formulaire', verbe: 'verbeDeRecette', libelle: 'Jouer le formulaire', rendu: 'formulaire', aChoisir: null, attendu: true, ouvert: true, raison: null,
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

/** Un geste ouvert que sa fermeture refuse, sa raison dite. */
const REFUSE: GesteDeLaFenetre = { cle: 'refuse', verbe: 'verbeDeRecette', libelle: 'Geste refusé', arguments: [], rendu: 'bouton', aChoisir: null, attendu: false, ouvert: true, raison: 'Fermé par le jet' };

export function figerVuesDeLEcran(): VueFigee[] {
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
  s = jouer('jouer', { type: s.vue.champ!.combattant, args: [cible] });
  figer('fenêtre d’attaque', s);
  s = jouer('jouer', enFocus(s));
  figer('jet d’attaque tombé', s);

  const vides: ZonesDeLEcran = {
    'fenetre.titre': [], 'fenetre.etape': [], 'fenetre.corps': [], 'fenetre.gestes': [],
    'combat.tour': [], 'combat.actif': [], 'combat.avis': [], 'combat.offres': [], 'journal.titre': [],
  };
  vues.push({
    nom: 'formulaire de chaque saisie',
    disposition: null,
    zones: { ...vides, 'fenetre.titre': [ligne('titre', 'Formulaire de recette')], 'fenetre.gestes': elementsDesGestes([FORMULAIRE, REFUSE]), 'journal.lignes': [...lignes] },
    attendus: { [FORMULAIRE.cle]: { type: FORMULAIRE.verbe, args: ARGUMENTS_DU_FORMULAIRE } },
  });
  return vues;
}
