/**
 * Lecteurs et producteurs de drapeaux et d'états d'un paquet (#2219, #2539) : les sites de Condition et d'Effet de
 * l'énumérateur UNIQUE (`sitesDuPaquet`, `./sites-de-paquet.ts`), plus le `cancelFlag` d'un `delayedEffect`. Le parse de
 * `expr` est celui du moteur (`flagTerms`, `src/engine/flowCore.ts`). Skill `adapter-une-campagne`, étape 7.
 */
import { flagTerms } from '../../../engine/flowCore';
import { noeudsDeCondition, sitesDuPaquet, type PaquetASites } from './sites-de-paquet';

/** Une lecture : son lieu, ce qu'elle lit (`drapeau`, `état`, ou `valeur` = `état=valeur`), le nom lu. */
type Lecture = { lieu: string; genre: 'drapeau' | 'état' | 'valeur'; nom: string };

function lectures(p: PaquetASites): Lecture[] {
  const { conditions, effets } = sitesDuPaquet(p);
  const out: Lecture[] = [];
  for (const c of conditions)
    for (const { noeud } of noeudsDeCondition(c.condition, c.chemin)) {
      if (noeud.kind === 'flag' && typeof noeud.expr === 'string') for (const t of flagTerms(noeud.expr)) out.push({ lieu: c.lieu, genre: 'drapeau', nom: t.flag });
      if (noeud.kind === 'etat' && typeof noeud.etat === 'string') {
        out.push({ lieu: c.lieu, genre: 'état', nom: noeud.etat });
        if (typeof noeud.value === 'string') out.push({ lieu: c.lieu, genre: 'valeur', nom: `${noeud.etat}=${noeud.value}` });
      }
      const who = noeud.who as { etat?: unknown } | undefined;
      if (who && typeof who === 'object' && typeof who.etat === 'string') out.push({ lieu: c.lieu, genre: 'état', nom: who.etat });
    }
  for (const e of effets)
    if (e.effet.type === 'delayedEffect' && typeof e.effet.cancelFlag === 'string') out.push({ lieu: e.lieu, genre: 'drapeau', nom: e.effet.cancelFlag });
  return out;
}

/** Les noms PRODUITS, par genre. */
function produits(p: PaquetASites): Record<Lecture['genre'], Set<string>> {
  const out = { drapeau: new Set<string>(), état: new Set<string>(), valeur: new Set<string>() };
  for (const { effet } of sitesDuPaquet(p).effets) {
    if (effet.type === 'setFlag' && typeof effet.flag === 'string') out.drapeau.add(effet.flag);
    if ((effet.type === 'poserEtat' || effet.type === 'designerHeros') && typeof effet.etat === 'string') out.état.add(effet.etat);
    if (effet.type === 'poserEtat' && typeof effet.etat === 'string' && typeof effet.valeur === 'string') out.valeur.add(`${effet.etat}=${effet.valeur}`);
  }
  return out;
}

/** Chaque état DÉCLARÉ que le paquet ne produit pas. */
export function declaresNonProduits(p: PaquetASites): string[] {
  const prod = produits(p).état;
  return ((p.narratif as { etats?: { id: string }[] } | undefined)?.etats ?? []).map((e) => e.id).filter((id) => !prod.has(id));
}

/** `lieu : genre nom` pour chaque lecture sans producteur dans le paquet. */
export function lusSansProducteur(p: PaquetASites): string[] {
  const prod = produits(p);
  return lectures(p).filter((l) => !prod[l.genre].has(l.nom)).map((l) => `${l.lieu} : ${l.genre} ${l.nom}`);
}
