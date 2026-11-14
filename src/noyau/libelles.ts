/**
 * LES LIBELLÉS DE CE QU'UNE FENÊTRE OFFRE (#2928) : en mots du joueur, un verbe de la partie, un argument d'un verbe,
 * une valeur littérale que prend cet argument, une fenêtre qui tient la main, une étape-jet de la séquence. Le texte
 * vit au catalogue (`t()`), lu aussi par le web ; la logique reste keyée par l'id, le libellé n'est que de
 * l'affichage. `null` : le catalogue ne nomme pas cet id, ce que refusent les tests de totalité pour tout ce que
 * `fenetreDuJeu` peut rendre (`fenetres-nomment-leurs-verbes.hors-store.test.ts`, `hote/gestes.hors-store.test.ts`).
 */
import { estUneCle, t } from '../i18n';
import { garanti } from '../lib/garanti';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { verbeDeJetDe, type FlowKey } from './flowVerbs';
import type { CleDeRegistre, GesteDuJeu } from './modalArbiter';
import type { HostJet } from './slotsDeJet';
import type { FermetureDuJet } from './rollFlowFactory';
import type { ActionsDuNoyau } from './actionsDuNoyau';

/** Le texte de la clé `cle`, `null` si le catalogue ne la porte pas. */
const texte = (cle: string): string | null => (estUneCle(cle) ? t(cle) : null);

/** Le libellé d'un verbe : sa clé `verbe.<id>`. */
export const libelleDuVerbe = (verbe: string): string | null => texte(`verbe.${verbe}`);

/** Le libellé du réglage `reglage` du jet du flux `flux` : sa clé `reglage.<flux>.<reglage>`, sinon celle du réglage
 *  (`reglage.<reglage>`) ; le catalogue nomme chaque réglage déclaré (`fenetres-nomment-leurs-verbes.hors-store.test.ts`). */
export function libelleDuReglage(flux: FlowKey, reglage: string): string {
  return texte(`reglage.${flux}.${reglage}`) ?? garanti(texte(`reglage.${reglage}`), `${flux}.${reglage}`, 'libellé du réglage');
}

/** Le libellé du choix `axe` de la fenêtre `fenetre` (`fenetreChoisir`) : sa clé `verbe.<fenetre>.<axe>` ; le catalogue
 *  nomme chaque choix déclaré (`fenetres-nomment-leurs-verbes.hors-store.test.ts`). */
export const libelleDuChoix = (fenetre: string, axe: string): string => garanti(texte(`verbe.${fenetre}.${axe}`), `${fenetre}.${axe}`, 'libellé du choix');

/** Le suffixe du libellé d'un geste de fenêtre, par son verbe : `verbe.<fenetre>.valider`, `verbe.<fenetre>.fermer`. */
const GESTE_DE_FENETRE: Readonly<Record<string, string>> = { fenetreValider: 'valider', fenetreFermer: 'fermer' } satisfies { readonly [V in keyof ActionsDuNoyau]?: string };

/** Le libellé d'un geste : pour le choix d'une fenêtre, la clé de son axe (`verbe.<fenetre>.<axe>`) ; pour la validation
 *  ou la sortie d'une fenêtre, la clé propre à sa fenêtre (`verbe.<fenetre>.valider`, `verbe.<fenetre>.fermer`) ; pour
 *  le réglage d'un jet, celui du réglage (`libelleDuReglage`), `reglage.<flux>.<reglage>All` pour sa rangée omise ; pour un verbe de jet, la clé propre à son flux
 *  (`verbe.<flux>.<verbe>`, `verbe.<flux>.<verbe>All` pour sa rangée omise), sinon celle du verbe (`verbe.<verbe>`) ;
 *  tout autre geste, celui de son verbe (`libelleDuVerbe`). */
export function libelleDuGeste(g: GesteDuJeu): string | null {
  if (g.fenetre) return texte(`verbe.${g.fenetre}.${g.axe ?? GESTE_DE_FENETRE[g.verbe]}`);
  if (g.flux && g.reglage) return g.toutes ? texte(`reglage.${g.flux}.${g.reglage}All`) : libelleDuReglage(g.flux, g.reglage);
  const deJet = verbeDeJetDe(g.verbe);
  if (!deJet || !g.flux) return libelleDuVerbe(g.verbe);
  const verbe = g.toutes ? `${deJet}All` : deJet;
  return texte(`verbe.${g.flux}.${verbe}`) ?? texte(`verbe.${verbe}`);
}

const estLocalisation = (v: string): v is keyof typeof HIT_LOCATION_LABELS => Object.prototype.hasOwnProperty.call(HIT_LOCATION_LABELS, v);

/** Le libellé d'une valeur littérale de l'argument `parametre` : `valeur.<parametre>.<v>`, sinon `valeur.<v>`, une
 *  Localisation (`HIT_LOCATION_LABELS`), un booléen (`valeur.oui`, `valeur.non`), `null` (`valeur.aucun`) ; un nombre
 *  s'écrit tel quel. */
export function libelleDuLitteral(v: string | number | boolean | null, parametre?: string): string | null {
  if (v === null) return t('valeur.aucun');
  if (typeof v === 'boolean') return t(v ? 'valeur.oui' : 'valeur.non');
  if (typeof v === 'number') return String(v);
  return (parametre ? texte(`valeur.${parametre}.${v}`) : null) ?? texte(`valeur.${v}`) ?? (estLocalisation(v) ? HIT_LOCATION_LABELS[v] : null);
}

/** Le libellé de l'argument `nom` du verbe `verbe` (ou d'un champ de son objet) : `parametre.<verbe>.<nom>`, sinon
 *  `parametre.<nom>`. */
export const libelleDuParametre = (verbe: string, nom: string): string | null => texte(`parametre.${verbe}.${nom}`) ?? texte(`parametre.${nom}`);

/** Le titre d'une fenêtre qui tient la main, par sa clé (`CLES_DE_FENETRE`). */
export const libelleDeLaFenetre = (cle: CleDeRegistre): string | null => texte(`fenetre.${cle}`);

/** Le titre d'une étape-jet de la séquence, par son `jet`. */
export const libelleDuJet = (jet: HostJet): string => t(`jet.${jet}`);

/** Ce qui ferme un verbe du cycle de jet (`FermetureDuJet`), en mots du joueur. */
export const libelleDeLaFermeture = (f: FermetureDuJet): string => t(`jet.ferme.${f}`);
