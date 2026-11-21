/**
 * LES RÉGLAGES d'un hôte (#3009) : les préférences de confort (`noyau/preferences.ts`) et les règles maison
 * (`engine/policy.ts`) en zones, chaque entrée rendue par la forme de son contrôle (`kind`), et le geste qui en règle
 * une, persisté dans le `Stockage` de l'hôte (`hote/preferences.ts`, `hote/reglesMaison.ts`).
 */
import {
  avecSigne,
  DIFFICULTY_LABELS,
  initialNet,
  OPTIONAL_RULES,
  PREFERENCES,
  preferenceDef,
  reglesMaisonMutables,
  valeurConforme,
  nommerLesRetraits,
  ruleOverrides,
  type Jeu as Partie,
  type Difficulty,
  type OptionalRule,
  type Preference,
  type PrefValue,
  type RuleValue,
} from '../noyau/index';
import { t } from '../i18n';
import type { Stockage } from '../lib/stockage';
import { ligne, type Bouton, type Element, type Entite, type Ligne, type Ton } from './elements';
import { reglerUnePreference } from './preferences';
import { ErreurDeGeste } from './partie';
import { prendreLeTemoinDesReglesMaison, reglerUneRegleMaison, remettreUneRegleMaison } from './reglesMaison';

/**
 * @contrat Vue
 * Les zones des réglages, que la méthode `reglages` rend avec ou sans partie ouverte. Chaque entrée y est rendue par
 * la forme de son contrôle : `flag` en choix « Non » ou « Oui », `mode` en choix de ses options, chacune à son libellé, en liste au-delà de
 * trois (`OPTIONS_EN_RANGEE`), `param` en curseur à ses bornes et à son pas. Le `jeu` d'une valeur, ou le geste du
 * curseur, est le geste que la méthode `reglages` reçoit : `{ type: 'preference' | 'regle', args: [id, valeur] }`, la
 * préférence ou la règle maison `id` réglée à `valeur` ; `{ type: 'pourcent', args: [id, valeur] }`, la préférence
 * bornée à [0, 1] réglée à `valeur` pour cent.
 */
export interface ZonesDesReglages {
  /** chaque préférence de confort de la table du noyau (`PREFERENCES`) : son contrôle, puis son aide en ligne ; une
   *  préférence bornée à [0, 1] (un volume) en curseur de 0 à 100 pour cent, au verbe `pourcent`. */
  'reglages.preferences': Element[];
  /**
   * chaque domaine des règles optionnelles en entité, dans l'ordre du registre (`regles/<domaine>`, nommée du
   * domaine) : le nombre de ses règles (`nombre`), la cire (`cire`, une icône) quand l'une d'elles est surchargée,
   * puis ses feuillets (`feuillet/<domaine>/<n>`).
   */
  'reglages.regles': Entite[];
  /** les règles maison que le registre a refusées à leur chargement, dites une fois. */
  'reglages.avis': Ligne[];
  /** « Fermer », dont le `jeu` `{ reglages: false }` ferme le panneau que `{ reglages: true }` ouvre. */
  'reglages.gestes': Bouton[];
}

/**
 * @contrat Vue
 * Un feuillet du registre des règles maison, entité nommée de son domaine : douze règles au plus
 * (`REGLES_PAR_PAGE` sur chacune de ses deux pages), dans l'ordre du registre.
 */
export interface FeuilletDesReglages {
  /** `entite`. */
  type: 'entite';
  /** `feuillet/<domaine>/<n>`, `n` compté de 1. */
  id: string;
  /** `neutre`. */
  ton: Ton;
  /** le domaine. */
  nom: string;
  /**
   * en lignes : le compte des règles du domaine (`compte`), son rang parmi les feuillets du domaine (`folio`), le
   * compte de ses règles surchargées (`modifiees`, absente sans surcharge) ; quand la page de droite porte des
   * règles, la suite du domaine (`suite`) et la plage de ses règles (`plage`). Puis chaque règle en entité nommée de
   * son libellé, `gauche/<id>` sur la page de gauche, `droite/<id>` sur celle de droite, au ton `alerte` quand elle
   * est surchargée : la ligne de sa référence au livre (`ref`, la justification d'une valeur maison au détail), celle
   * de son aide (`aide`), celle de sa valeur quand elle est un nombre (`valeur`, signée pour un modificateur, au ton
   * `ferme` quand son contrôle est refusé), son contrôle (`regle/<id>`), « Défaut » quand elle est surchargée (`retablir/<id>`, dont le
   * `jeu` est `{ type: 'retablir', args: [id] }`), et le bouton de son action quand elle vaut `action.when`
   * (`action/<id>`, dont le `jeu` `{ suite: [{ type: run, args: [] }] }` est un geste de la partie, refusé sans
   * partie ouverte). En combat et chez un invité, chaque contrôle et chaque action sont refusés avec la raison du
   * noyau (`reglesMaisonMutables`).
   */
  elements: Element[];
}

/** Une entrée des réglages : une règle maison ou une préférence de confort. */
type Forme = OptionalRule | Preference;

/** Au-delà de ce nombre d'options, un `mode` se choisit en liste plutôt qu'en rangée (`Choix`). */
const OPTIONS_EN_RANGEE = 3;

/** Les règles d'une page du registre ; un feuillet en porte deux pages. */
export const REGLES_PAR_PAGE = 6;

/** Si l'entrée `f` est un réglage borné à [0, 1], qui se règle en pour cent. */
const enPourcent = (f: Forme): boolean => f.kind === 'param' && f.min === 0 && f.max === 1;

/** Le libellé du choix `o` de l'entrée `f` : celui que sa donnée lui donne (`libelles`), sinon le nom d'une
 *  Difficulté (LDB 12 l.143-151), sinon sa valeur. */
const libelleDuChoix = (f: Forme, o: string): string =>
  f.libelles?.[o] ?? (o in DIFFICULTY_LABELS ? t(`difficulty.${o as Difficulty}`) : o);

/** La valeur `v` de la règle `r` telle qu'elle se lit : signée pour un modificateur, en négatif pour un malus. */
const lecture = (r: OptionalRule, v: number): string =>
  r.kind !== 'param' || r.modificateur === undefined ? String(v) : avecSigne(r.modificateur === 'malus' ? -v : v);

/** Le contrôle de l'entrée `f`, de valeur `valeur`, dont le geste est le verbe `verbe` des réglages. */
function controle(verbe: 'preference' | 'regle', f: Forme, valeur: PrefValue, refus: string | null): Element {
  const id = `${verbe}/${f.id}`;
  const valeurDe = (v: PrefValue, libelle: string): Bouton => ({ type: 'bouton', id: `${id}/${v}`, libelle, jeu: { type: verbe, args: [f.id, v] }, presse: v === valeur, focus: false, detail: null, touche: null, refus });
  switch (f.kind) {
    case 'flag':
      return { type: 'choix', id, ton: 'neutre', libelle: f.label, focus: false, refus, valeurs: [valeurDe(false, t('valeur.non')), valeurDe(true, t('valeur.oui'))] };
    case 'mode':
      return { type: f.options.length > OPTIONS_EN_RANGEE ? 'liste' : 'choix', id, ton: 'neutre', libelle: f.label, focus: false, refus, valeurs: f.options.map((o) => valeurDe(o, libelleDuChoix(f, o))) };
    case 'param':
      return enPourcent(f)
        ? { type: 'curseur', id, ton: 'neutre', libelle: f.label, valeur: Math.round((valeur as number) * 100), min: 0, max: 100, pas: Math.round((f.step ?? 0.01) * 100), verbe: 'pourcent', arguments: [f.id], refus }
        : { type: 'curseur', id, ton: 'neutre', libelle: f.label, valeur: valeur as number, min: f.min, max: f.max, pas: f.step ?? 1, verbe, arguments: [f.id], refus };
  }
}

/** Le pluriel d'un compte `n`, pour les patrons à `{s}`. */
const pluriel = (n: number) => ({ n, s: n > 1 ? 's' : '' });

/** La règle `r` en entité, `cote` sa page : sa référence, son aide, son contrôle, « Défaut » quand `surcharges` la
 *  porte, son action quand elle vaut `action.when`. `refus` : le verrou du noyau ; `horsPartie` : aucune partie
 *  ouverte, où son action ne se joue pas. */
function regleEnEntite(r: OptionalRule, cote: 'gauche' | 'droite', surcharges: Readonly<Record<string, RuleValue>>, refus: string | null, horsPartie: boolean): Entite {
  const surchargee = r.id in surcharges;
  const valeur = surchargee ? surcharges[r.id] : r.default;
  const ref = r.maison === undefined ? r.ref : t('ecran.reglages.valeurMaison', { ref: r.ref });
  const action = r.action !== undefined && r.action.when === valeur ? r.action : null;
  return {
    type: 'entite', id: `${cote}/${r.id}`, ton: surchargee ? 'alerte' : 'neutre', nom: r.label,
    elements: [
      ligne('ref', ref, 'neutre', r.maison ?? null),
      ...(r.hint ? [ligne('aide', r.hint)] : []),
      ...(r.kind === 'param' ? [ligne('valeur', lecture(r, valeur as number), refus === null ? 'neutre' : 'ferme')] : []),
      controle('regle', r, valeur, refus),
      ...(surchargee ? [{ type: 'bouton' as const, id: `retablir/${r.id}`, libelle: t('ecran.reglages.defaut'), jeu: { type: 'retablir', args: [r.id] }, presse: false, focus: false, detail: null, touche: null, refus, icone: 'interface/revenir' }] : []),
      ...(action ? [{ type: 'bouton' as const, id: `action/${r.id}`, libelle: action.label, jeu: { suite: [{ type: action.run, args: [] }] }, presse: false, focus: false, detail: null, touche: null, refus: refus ?? (horsPartie ? t('ecran.reglages.horsPartie') : null), icone: action.icon }] : []),
    ],
  };
}

/** Le domaine `groupe` en entité : son nombre de règles, sa cire, ses feuillets. */
function domaineEnEntite(groupe: string, surcharges: Readonly<Record<string, RuleValue>>, refus: string | null, horsPartie: boolean): Entite {
  const regles = OPTIONAL_RULES.filter((r) => r.group === groupe);
  const modifiees = regles.filter((r) => r.id in surcharges).length;
  const parFeuillet = 2 * REGLES_PAR_PAGE;
  const total = Math.ceil(regles.length / parFeuillet);
  const feuillets = Array.from({ length: total }, (_, i): FeuilletDesReglages => {
    const gauche = regles.slice(i * parFeuillet, i * parFeuillet + REGLES_PAR_PAGE);
    const droite = regles.slice(i * parFeuillet + REGLES_PAR_PAGE, (i + 1) * parFeuillet);
    const premiere = i * parFeuillet + REGLES_PAR_PAGE + 1;
    return {
      type: 'entite', id: `feuillet/${groupe}/${i + 1}`, ton: 'neutre', nom: groupe,
      elements: [
        ligne('compte', t('ecran.reglages.compte', pluriel(regles.length))),
        ligne('folio', t('ecran.reglages.feuillet', { n: i + 1, total })),
        ...(modifiees ? [ligne('modifiees', t('ecran.reglages.modifiees', pluriel(modifiees)))] : []),
        ...(droite.length ? [ligne('suite', t('ecran.reglages.suite', { domaine: groupe })), ligne('plage', t('ecran.reglages.plage', { de: premiere, a: premiere + droite.length - 1, n: regles.length }))] : []),
        ...gauche.map((r) => regleEnEntite(r, 'gauche', surcharges, refus, horsPartie)),
        ...droite.map((r) => regleEnEntite(r, 'droite', surcharges, refus, horsPartie)),
      ],
    };
  });
  return {
    type: 'entite', id: `regles/${groupe}`, ton: 'neutre', nom: groupe,
    elements: [ligne('nombre', String(regles.length)), ...(modifiees ? [{ type: 'icone' as const, id: 'cire', icone: 'interface/cire' }] : []), ...feuillets],
  };
}

/** Les zones des réglages sur `stockage` ; `etat` : la partie ouverte, `null` sans partie. */
export function zonesDesReglages(stockage: Stockage | null, etat: Pick<Partie, 'battle' | 'net'> | null): ZonesDesReglages {
  const verrou = reglesMaisonMutables(etat ?? { battle: null, net: initialNet() });
  const refus = verrou.mutable ? null : verrou.reason;
  const surcharges = ruleOverrides();
  const groupes = [...new Set(OPTIONAL_RULES.map((r) => r.group))];
  const retraits = prendreLeTemoinDesReglesMaison(stockage);
  return {
    'reglages.preferences': PREFERENCES.flatMap((p) => [controle('preference', p, p.get(), null), ...(p.hint ? [ligne(`preference/${p.id}/aide`, p.hint)] : [])]),
    'reglages.regles': groupes.map((groupe) => domaineEnEntite(groupe, surcharges, refus, etat === null)),
    'reglages.avis': retraits ? [ligne('retraits', t('houseRules.retirees', { liste: nommerLesRetraits(retraits) }), 'alerte')] : [],
    'reglages.gestes': [{ type: 'bouton', id: 'fermer', libelle: t('ecran.reglages.fermer'), jeu: { reglages: false }, presse: false, focus: false, detail: null, touche: null, refus: null, icone: 'interface/fermer' }],
  };
}

/** Joue le geste des réglages `geste` sur `stockage` et le persiste ; `etat` : la partie ouverte, `null` sans partie.
 *  Lève l'erreur de validation d'un geste, d'un id ou d'une valeur que la table ou le registre refuse, et l'erreur de
 *  règle du verrou du noyau (`reglesMaisonMutables` : un combat en cours, un invité). */
export function jouerUnReglage(stockage: Stockage | null, etat: Pick<Partie, 'battle' | 'net'> | null, geste: { type: unknown; args: unknown }, reprojeter?: () => void): void {
  const args = Array.isArray(geste.args) ? geste.args : [];
  const [id, valeur] = args;
  const refuser = (categorie: 'validation' | 'regle', raison: string): never => {
    throw new ErreurDeGeste(categorie, categorie === 'validation' ? `reglages : ${raison}` : raison);
  };
  if (typeof id !== 'string') return refuser('validation', 'args, l’id du réglage d’abord');
  if (geste.type === 'preference' || geste.type === 'pourcent') {
    const def = preferenceDef(id);
    if (args.length !== 2 || !def || (geste.type === 'pourcent' && !enPourcent(def))) return refuser('validation', t('ecran.reglages.inconnu', { id }));
    const conforme = geste.type !== 'pourcent' ? valeur : typeof valeur === 'number' ? valeur / 100 : undefined;
    if (!reglerUnePreference(stockage, id, conforme)) return refuser('validation', t('ecran.reglages.nonConforme', { valeur: JSON.stringify(valeur), id }));
    return;
  }
  if (geste.type !== 'regle' && geste.type !== 'retablir') return refuser('validation', 'type, `preference`, `pourcent`, `regle` ou `retablir`');
  const regle = OPTIONAL_RULES.find((r) => r.id === id);
  if (!regle || args.length !== (geste.type === 'regle' ? 2 : 1)) return refuser('validation', t('houseRules.refus.inconnue', { id }));
  const conforme = valeurConforme(regle, valeur);
  if (geste.type === 'regle' && !conforme) return refuser('validation', t('houseRules.refus.valeur', { valeur: JSON.stringify(valeur), id: regle.id }));
  const jeu = etat ?? { battle: null, net: initialNet() };
  const verrou = reglesMaisonMutables(jeu);
  if (!verrou.mutable) return refuser('regle', verrou.reason);
  if (geste.type === 'retablir') remettreUneRegleMaison(stockage, jeu, regle.id, reprojeter);
  else if (conforme) reglerUneRegleMaison(stockage, jeu, regle.id, valeur, reprojeter);
}
