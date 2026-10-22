/**
 * LES LIBELLÉS DE CE QU'UNE FENÊTRE OFFRE (#2928) : en mots du joueur, un verbe de la partie, un argument d'un verbe,
 * une valeur littérale que prend cet argument, une fenêtre qui tient la main, une étape-jet de la séquence. Le texte
 * vit au catalogue (`t()`), lu aussi par le web ; la logique reste keyée par l'id, le libellé n'est que de
 * l'affichage. `null` : le catalogue ne nomme pas cet id, ce que refusent les tests de totalité pour tout ce que
 * `fenetreDuJeu` peut rendre (`fenetres-nomment-leurs-verbes.hors-store.test.ts`, `hote/gestes.hors-store.test.ts`).
 */
import { estUneCle, t } from '../i18n';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { FLOW_VERBS } from './flowVerbs';
import type { HostJet } from './slotsDeJet';

/** Les préfixes des flux de jet, du plus long au plus court : `cascadeBatch` avant `cascade`. */
const PREFIXES = Object.keys(FLOW_VERBS).sort((a, b) => b.length - a.length);

/** Le suffixe d'un verbe `<flux><Suffixe>` (`flowActionName`), son initiale en minuscule ; `null` hors d'un flux. */
function suffixeDuFlux(verbe: string): string | null {
  const prefixe = PREFIXES.find((p) => verbe.startsWith(p) && /^[A-Z]/.test(verbe.slice(p.length)));
  return prefixe ? `${verbe.charAt(prefixe.length).toLowerCase()}${verbe.slice(prefixe.length + 1)}` : null;
}

/** Le texte de la clé `cle`, `null` si le catalogue ne la porte pas. */
const texte = (cle: string): string | null => (estUneCle(cle) ? t(cle) : null);

/** Le libellé d'un verbe : sa clé `verbe.<id>`, sinon celle du suffixe de son flux (`verbe.<suffixe>`). */
export function libelleDuVerbe(verbe: string): string | null {
  const suffixe = suffixeDuFlux(verbe);
  return texte(`verbe.${verbe}`) ?? (suffixe ? texte(`verbe.${suffixe}`) : null);
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
export const libelleDeLaFenetre = (cle: string): string | null => texte(`fenetre.${cle}`);

/** Le titre d'une étape-jet de la séquence, par son `jet`. */
export const libelleDuJet = (jet: HostJet): string => t(`jet.${jet}`);
