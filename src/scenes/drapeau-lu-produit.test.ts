/**
 * GARDE ABSOLUE (#2219, #2539) — tout drapeau LU par un paquet livré a son PRODUCTEUR (`setFlag`) dans ce
 * paquet ; tout état de campagne LU (Condition `etat`, sélecteur `who: {etat}`) a le sien (`poserEtat`,
 * `designerHeros`), et toute VALEUR comparée (`etat` + `value`) un `poserEtat` de cette valeur ; tout état
 * DÉCLARÉ (`narratif.etats`) est produit dans le paquet.
 *
 * Lecteurs et producteurs : les sites de Condition et d'Effet de l'énumérateur UNIQUE
 * (`sitesDuPaquet`, `src/data/schemas/defs-scenes/sites-de-paquet.ts`), plus le `cancelFlag` d'un
 * `delayedEffect`. Le parse de `expr` est celui du moteur (`flagTerms`, `src/engine/flowCore.ts`). Skill
 * `adapter-une-campagne`, étape 7.
 *
 * ABSOLUE : aucun stock, aucune exemption — la garde NOMME ses sites.
 */
import { describe, it, expect } from 'vitest';
import { listerProjetsLivres } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { parseProject } from '../state/worldMap';
import { flagTerms } from '../engine/flowCore';
import { noeudsDeCondition, sitesDuPaquet, type PaquetASites } from '../data/schemas/defs-scenes/sites-de-paquet';

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
function declaresNonProduits(p: PaquetASites): string[] {
  const prod = produits(p).état;
  return ((p.narratif as { etats?: { id: string }[] } | undefined)?.etats ?? []).map((e) => e.id).filter((id) => !prod.has(id));
}

/** `lieu : genre nom` pour chaque lecture sans producteur dans le paquet. */
function lusSansProducteur(p: PaquetASites): string[] {
  const prod = produits(p);
  return lectures(p).filter((l) => !prod[l.genre].has(l.nom)).map((l) => `${l.lieu} : ${l.genre} ${l.nom}`);
}

describe('#2219 · #2539 — lu → producteur, sur chaque paquet livré', () => {
  for (const rel of listerProjetsLivres())
    it(rel, () => {
      expect(lusSansProducteur(parseProject(lireProjetLivre(rel))), 'drapeau ou état lu sans producteur dans le paquet').toEqual([]);
    });
});

describe('#2539 — état déclaré → produit, sur chaque paquet livré', () => {
  for (const rel of listerProjetsLivres())
    it(rel, () => {
      expect(declaresNonProduits(parseProject(lireProjetLivre(rel))), 'état de campagne déclaré sans producteur dans le paquet').toEqual([]);
    });
});

// COUVERTURE du détecteur, sur un paquet jouet : sans elle, le vert ci-dessus ne dirait rien des sites
// qu'aucun paquet livré ne peuple.
describe('#2219 · #2539 — chaque site lecteur est lu, chaque site producteur produit', () => {
  const flag = (expr: string) => ({ kind: 'flag', expr });
  const pose = (f: string) => ({ kind: 'seq', steps: [{ kind: 'do', effect: { type: 'setFlag', flag: f } }] });
  const si = (cond: unknown) => ({ kind: 'if', cond, then: { kind: 'seq', steps: [] } });
  const jouet = (): PaquetASites => ({
    scenes: [{
      id: 's',
      triggers: [
        { id: 't', rect: { x: 0, y: 0, w: 1, h: 1 }, when: { kind: 'all', of: [flag('dec')] }, flow: pose('produit') },
        { id: 'u', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: { kind: 'seq', steps: [
          si(flag('flux-declencheur')),
          { kind: 'do', effect: { type: 'delayedEffect', afterMinutes: 5, cancelFlag: 'annule', flow: si({ kind: 'etat', etat: 'issue', value: 'v' }) } },
        ] } },
      ],
      entities: [{ id: 'e', usable: { actions: [
        { id: 'a', flow: { kind: 'seq', steps: [
          { kind: 'do', effect: { type: 'setFlag', flag: 'par-action' } },
          { kind: 'test', test: { skill: { id: 'perception' }, gate: flag('porte') }, success: { kind: 'seq', steps: [] }, fail: { kind: 'seq', steps: [] } },
        ] } },
      ] } }],
      encounters: [{ id: 'r', onVictory: si({ kind: 'partyDead', who: { etat: 'sosie' } }) }],
      dialogues: [{ id: 'd', start: 'n', nodes: [{ id: 'n', desc: '…', choices: [
        { label: 'a', when: flag('choix') },
        { label: 'b', flow: si(flag('si')) },
      ] }] }],
    }],
    worldMap: { places: [{ id: 'l', when: flag('lieu,!produit,!par-action') }], routes: [{ id: 'r', when: flag(' route ') }] },
    narratif: { cloture: { when: flag('clos') } },
  });

  it('lieu, route, clôture, déclencheur (`when` et `flow`), action, rencontre, choix, `if` de dialogue, `gate` de test, `cancelFlag` sont NOMMÉS ; un drapeau posé dans `usable.actions[].flow` ou `triggers[].flow` ne l’est pas', () => {
    expect(lusSansProducteur(jouet())).toEqual([
      's › déclencheur t : drapeau dec',
      's › dialogue d : drapeau choix',
      's › déclencheur u : drapeau flux-declencheur',
      's › déclencheur u : état issue',
      's › déclencheur u : valeur issue=v',
      's › action e›a : drapeau porte',
      's › dialogue d : drapeau si',
      's › rencontre r : état sosie',
      'carte › lieu l : drapeau lieu',
      'carte › route r : drapeau route',
      'narratif › clôture : drapeau clos',
      's › déclencheur u : drapeau annule',
    ]);
  });

  const actionDe = (p: PaquetASites) => (p.scenes[0] as { entities: { usable: { actions: { flow: { steps: unknown[] } }[] } }[] }).entities[0].usable.actions[0].flow;

  it('`poserEtat` et `designerHeros` produisent l’état qu’un lecteur lit, `poserEtat` la valeur comparée', () => {
    const p = jouet();
    actionDe(p).steps.push({ kind: 'do', effect: { type: 'designerHeros', etat: 'sosie' } }, { kind: 'do', effect: { type: 'poserEtat', etat: 'issue', valeur: 'v' } });
    expect(lusSansProducteur(p).filter((l) => / : (état|valeur) /.test(l))).toEqual([]);
  });

  it('une valeur comparée que nul `poserEtat` ne pose est nommée, même si l’état est produit', () => {
    const p = jouet();
    actionDe(p).steps.push({ kind: 'do', effect: { type: 'poserEtat', etat: 'issue', valeur: 'autre' } });
    expect(lusSansProducteur(p).filter((l) => / : (état|valeur) /.test(l))).toEqual(['s › déclencheur u : valeur issue=v', 's › rencontre r : état sosie']);
  });

  it('un état déclaré que rien ne produit est nommé', () => {
    const p = jouet();
    (p.narratif as { etats?: unknown[] }).etats = [{ id: 'issue' }, { id: 'muet' }, { id: 'sosie' }];
    actionDe(p).steps.push({ kind: 'do', effect: { type: 'poserEtat', etat: 'issue', valeur: 'v' } }, { kind: 'do', effect: { type: 'designerHeros', etat: 'orphelin' } });
    expect(declaresNonProduits(p)).toEqual(['muet', 'sosie']);
  });
});
