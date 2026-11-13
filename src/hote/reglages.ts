/**
 * LES RÉGLAGES d'un hôte (#3009) : les préférences de confort (`noyau/preferences.ts`) et les règles maison
 * (`engine/policy.ts`) en zones, chaque entrée rendue par la forme de son contrôle (`kind`), et le geste qui en règle
 * une, persisté dans le `Stockage` de l'hôte (`hote/preferences.ts`, `hote/reglesMaison.ts`).
 */
import { OPTIONAL_RULES, PREFERENCES, preferenceDef, reglesMaisonMutables, valeurConforme, nommerLesRetraits, ruleOverrides, type Jeu as Partie, type FormeDeControle, type OptionalRule, type PrefValue, type RuleValue } from '../noyau/index';
import { t } from '../i18n';
import type { Stockage } from '../lib/stockage';
import { ligne, type Bouton, type Element, type Entite, type Ligne } from './elements';
import { reglerUnePreference } from './preferences';
import { ErreurDeGeste } from './partie';
import { prendreLeTemoinDesReglesMaison, reglerUneRegleMaison, remettreUneRegleMaison } from './reglesMaison';

/**
 * @contrat Vue
 * Les zones des réglages, que la méthode `reglages` rend avec ou sans partie ouverte. Chaque entrée y est rendue par
 * la forme de son contrôle : `flag` en choix « Non » ou « Oui », `mode` en liste de ses options, `param` en
 * curseur à ses bornes et à son pas. Le `jeu` d'une valeur, ou le geste du curseur, est le geste que la méthode
 * `reglages` reçoit : `{ type: 'preference' | 'regle', args: [id, valeur] }`, la préférence ou la règle maison `id`
 * réglée à `valeur`.
 */
export interface ZonesDesReglages {
  /** chaque préférence de confort de la table du noyau (`PREFERENCES`) : son contrôle, puis son aide en ligne. */
  'reglages.preferences': Element[];
  /**
   * chaque sous-système des règles optionnelles en entité, dans l'ordre du registre ; sous lui, pour chaque règle, la
   * ligne de sa référence au livre (son aide et la justification d'une valeur maison au détail), son contrôle, et
   * « Défaut » quand elle est surchargée, dont le `jeu` est `{ type: 'retablir', args: [id] }`. En combat, chaque
   * contrôle est refusé avec la raison du noyau (`reglesMaisonMutables`).
   */
  'reglages.regles': Entite[];
  /** les règles maison que le registre a refusées à leur chargement, dites une fois. */
  'reglages.avis': Ligne[];
  /** « Fermer », dont le `jeu` `{ reglages: false }` ferme le panneau que `{ reglages: true }` ouvre. */
  'reglages.gestes': Bouton[];
}

type Forme = FormeDeControle & { id: string; label: string };

/** Le contrôle de l'entrée `f`, de valeur `valeur`, dont le geste est le verbe `verbe` des réglages. */
function controle(verbe: 'preference' | 'regle', f: Forme, valeur: PrefValue, refus: string | null): Element {
  const id = `${verbe}/${f.id}`;
  const valeurDe = (v: PrefValue, libelle: string): Bouton => ({ type: 'bouton', id: `${id}/${v}`, libelle, jeu: { type: verbe, args: [f.id, v] }, presse: v === valeur, focus: false, refus });
  switch (f.kind) {
    case 'flag':
      return { type: 'choix', id, ton: 'neutre', libelle: f.label, focus: false, refus, valeurs: [valeurDe(false, t('valeur.non')), valeurDe(true, t('valeur.oui'))] };
    case 'mode':
      return { type: 'liste', id, ton: 'neutre', libelle: f.label, focus: false, refus, valeurs: f.options.map((o) => valeurDe(o, o)) };
    case 'param':
      return { type: 'curseur', id, ton: 'neutre', libelle: f.label, valeur: valeur as number, min: f.min, max: f.max, pas: f.step ?? 1, verbe, arguments: [f.id], refus };
  }
}

/** Les éléments de la règle `r` : sa référence, son contrôle, et « Défaut » quand `surcharges` la porte. */
function elementsDeLaRegle(r: OptionalRule, surcharges: Readonly<Record<string, RuleValue>>, refus: string | null): Element[] {
  const surchargee = r.id in surcharges;
  const detail = [r.hint, r.maison].filter((x) => x !== undefined).join('\n\n');
  return [
    ligne(`regle/${r.id}/ref`, r.ref, 'neutre', detail || null),
    controle('regle', r, surchargee ? surcharges[r.id] : r.default, refus),
    ...(surchargee ? [{ type: 'bouton' as const, id: `retablir/${r.id}`, libelle: t('ecran.reglages.defaut'), jeu: { type: 'retablir', args: [r.id] }, presse: false, focus: false, refus }] : []),
  ];
}

/** Les zones des réglages sur `stockage` ; `etat` : la partie ouverte, `null` sans partie. */
export function zonesDesReglages(stockage: Stockage | null, etat: Pick<Partie, 'battle'> | null): ZonesDesReglages {
  const verrou = reglesMaisonMutables(etat ?? { battle: null });
  const refus = verrou.mutable ? null : verrou.reason;
  const surcharges = ruleOverrides();
  const groupes = [...new Set(OPTIONAL_RULES.map((r) => r.group))];
  const retraits = prendreLeTemoinDesReglesMaison(stockage);
  return {
    'reglages.preferences': PREFERENCES.flatMap((p) => [controle('preference', p, p.get(), null), ...(p.hint ? [ligne(`preference/${p.id}/aide`, p.hint)] : [])]),
    'reglages.regles': groupes.map((groupe): Entite => ({
      type: 'entite', id: `regles/${groupe}`, ton: 'neutre', nom: groupe,
      elements: OPTIONAL_RULES.filter((r) => r.group === groupe).flatMap((r) => elementsDeLaRegle(r, surcharges, refus)),
    })),
    'reglages.avis': retraits ? [ligne('retraits', t('houseRules.retirees', { liste: nommerLesRetraits(retraits) }), 'alerte')] : [],
    'reglages.gestes': [{ type: 'bouton', id: 'fermer', libelle: t('ecran.reglages.fermer'), jeu: { reglages: false }, presse: false, focus: false, refus: null }],
  };
}

/** Joue le geste des réglages `geste` sur `stockage` et le persiste ; `etat` : la partie ouverte, `null` sans partie.
 *  Lève l'erreur de validation d'un geste, d'un id ou d'une valeur que la table ou le registre refuse, et l'erreur de
 *  règle du verrou du noyau (`reglesMaisonMutables` : un combat en cours). */
export function jouerUnReglage(stockage: Stockage | null, etat: Pick<Partie, 'battle'> | null, geste: { type: unknown; args: unknown }): void {
  const args = Array.isArray(geste.args) ? geste.args : [];
  const [id, valeur] = args;
  const refuser = (categorie: 'validation' | 'regle', raison: string): never => {
    throw new ErreurDeGeste(categorie, `reglages : ${raison}`);
  };
  if (typeof id !== 'string') return refuser('validation', 'args, l’id du réglage d’abord');
  if (geste.type === 'preference') {
    if (args.length !== 2 || !preferenceDef(id)) return refuser('validation', t('ecran.reglages.inconnu', { id }));
    if (!reglerUnePreference(stockage, id, valeur)) return refuser('validation', t('ecran.reglages.nonConforme', { valeur: JSON.stringify(valeur), id }));
    return;
  }
  if (geste.type !== 'regle' && geste.type !== 'retablir') return refuser('validation', 'type, `preference`, `regle` ou `retablir`');
  const regle = OPTIONAL_RULES.find((r) => r.id === id);
  if (!regle || args.length !== (geste.type === 'regle' ? 2 : 1)) return refuser('validation', t('houseRules.refus.inconnue', { id }));
  const conforme = valeurConforme(regle, valeur);
  if (geste.type === 'regle' && !conforme) return refuser('validation', t('houseRules.refus.valeur', { valeur: JSON.stringify(valeur), id: regle.id }));
  const jeu = etat ?? { battle: null };
  const verrou = reglesMaisonMutables(jeu);
  if (!verrou.mutable) return refuser('regle', verrou.reason);
  if (geste.type === 'retablir') remettreUneRegleMaison(stockage, jeu, regle.id);
  else if (conforme) reglerUneRegleMaison(stockage, jeu, regle.id, valeur);
}
