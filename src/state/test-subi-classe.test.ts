/**
 * #1874 C0 — la CLASSE, pas le cas : TOUT nœud `kind:'test'` de `src/data/*.json` joué HORS COMBAT
 * fait tomber ses conséquences sur SON sujet, et sur lui seul.
 *
 * Le banc ne connaît aucun id de donnée et ne compte aucun cardinal : il scanne la base
 * (`noeudsDeTest.testkit`), choisit la PORTE de chaque nœud par un prédicat calculé sur le NŒUD (ce
 * que ses ops exigent, où il vit), le joue sur le sujet `h3` d'un groupe de quatre, et mesure que
 * les trois autres sont IDENTIQUES en JSON. Une entrée de donnée NEUVE à branche `on:'target'` entre
 * donc dans la garde sans qu'on touche à ce fichier.
 *
 * Anti-vacuité SANS cardinal : chaque fichier porteur doit avoir au moins un nœud RÉELLEMENT ouvert
 * (une gate fermée est un no-op légitime, compté à part), et la liste des levées est attendue VIDE.
 */
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { routeTriggeredTest, bandeTriggeredTest, runCombatFlow } from './combat/triggeredTest';
import { flowTestGated, combatConditionCtx } from './combat/flowEval';
import { pushCombatStep } from './combatEffects';
import { draineCascade } from './cascadeTestKit';
import { itemFromTrappingById } from '../engine/items';
import { decorHorsCombat, noeudsDeTest, type Noeud } from './noeudsDeTest.testkit';
import type { Combatant } from '../engine/types';
import type { GameOp } from '../engine/ops';
import { EMPTY_FLOW, type Flow } from './flow';

const get = useGame.getState;
const set = useGame.setState;

/** Coque de service : les ops de chute d'un Critique de navire dimensionnent leur hauteur dessus. */
const coque = (): Combatant => ({ id: 'coque', creatureId: 'bateau-de-patrouille' } as unknown as Combatant);

function decor(): Combatant {
  seedBattleRng(1874);
  useGame.setState(decorHorsCombat() as never);
  return get().party[2];
}

/** Empreinte des porteurs AUTRES que le sujet, hors ce que la porte a dû poser au décor (une coque) :
 *  l'instantané se prend AVANT la porte, qui peut jouer INLINE — le comparé doit donc ignorer ses
 *  ajouts, pas l'inverse. */
const lesAutres = (exclus: readonly string[] = []): string =>
  JSON.stringify(get().party.filter((c) => c.id !== 'h3' && !exclus.includes(c.id)));

/** Ce qu'une branche a pu PRODUIRE sur le sujet : sa fiche, plus les dépôts qu'une op peut faire
 *  ailleurs dans l'état (effet programmé, drapeau, fenêtre ouverte). Le JOURNAL en est exclu : la
 *  résolution du jet y écrit sa ligne pour tout nœud, branche jouée ou lâchée. */
const consequenceSurLeSujet = (): string => JSON.stringify({
  sujet: get().party.find((c) => c.id === 'h3'),
  scheduledEffects: get().scheduledEffects,
  flags: get().flags,
  cascade: get().pendingCascade?.participants.map((p) => p.kind),
// Les identifiants d'objet et de configuration d'armes sont MINTÉS par des compteurs de module
// (`engine/items.ts:29`, `:782`) : deux décors successifs n'en portent jamais les mêmes. C'est une
// IDENTITÉ, pas une conséquence — on la neutralise, sinon deux courses du MÊME site différeraient
// toujours et le témoin ne mesurerait rien.
}).replace(/\b(it|lo)-\d+\b/g, '$1-#');

/** Hauteur du journal. Une conséquence peut n'exister QUE là (op `narrative`) : le contrat positif la
 *  compte, et le témoin à branches vides annule la ligne que la résolution du jet y écrit de toute façon. */
const lignesDeJournal = (): number => get().journal.length;

/** ORACLE du contrat positif : la MÊME branche appliquée DIRECTEMENT sur le sujet par le marcheur
 *  d'ACTEUR, dans le MÊME décor. Il répond à la seule question qu'on ne peut pas lire dans la donnée :
 *  cette branche PRODUIT-elle quelque chose ICI ? Une branche dont les ops portent sur un préexistant
 *  que le décor n'a pas (aggraver un symptôme d'une maladie non contractée, purger un poison absent) est
 *  inerte pour TOUT marcheur : l'exiger bruyante serait exiger un décor par entrée, donc une liste d'ids.
 *  Elle sort du contrat par un PRÉDICAT MESURÉ, jamais par une exemption écrite ici. */
function brancheInerteIci(n: Noeud, issue: boolean): boolean {
  const sujet = decor();
  const avant = consequenceSurLeSujet();
  const jAvant = lignesDeJournal() + get().pendingLogQueue.length;
  try {
    runCombatFlow({ mode: 'combat', get, set, target: sujet, caster: sujet, label: n.entryId,
      opsCtx: { sl: -10, ...(n.source ? { source: n.source } : {}) } },
    (issue ? n.node.success : n.node.fail) ?? EMPTY_FLOW);
  } catch { return true; }
  return consequenceSurLeSujet() === avant
    && lignesDeJournal() + get().pendingLogQueue.length <= jAvant
    && !get().pendingTest;
}

/** Toutes les `GameOp` des branches d'un nœud — la matière du prédicat de porte. */
function opsDesBranches(f: Flow | undefined, out: GameOp[] = []): GameOp[] {
  if (!f) return out;
  if (f.kind === 'do') { if (f.effect.type === 'ops') out.push(...f.effect.ops); return out; }
  if (f.kind === 'seq') { f.steps.forEach((s) => opsDesBranches(s, out)); return out; }
  if (f.kind === 'if') { opsDesBranches(f.then, out); opsDesBranches(f.else, out); return out; }
  if (f.kind === 'test') { opsDesBranches(f.success, out); opsDesBranches(f.fail, out); return out; }
  opsDesBranches(f.yes, out); opsDesBranches(f.no, out);
  return out;
}

/** PORTE d'un nœud, dérivée de ce que le nœud EST — jamais d'un nom de fichier ni d'une liste d'ids :
 *  - ses ops exigent une COQUE (une chute dont la hauteur se lit sur la taille du navire) → la porte
 *    des bandes d'équipage (`bandeTriggeredTest`) ;
 *  - il EST le Flow bu d'une possession (chemin `.consumable…`, hors greffe d'arme `onHitEffects`) →
 *    la porte du consommable (`usePartyItem`) ;
 *  - sinon la porte générale des effets déclenchés (`routeTriggeredTest`).
 */
type Porte = 'bande' | 'consommable' | 'generale';
function porteDe(n: Noeud): Porte {
  const ops = [...opsDesBranches(n.node.success), ...opsDesBranches(n.node.fail)];
  if (ops.some((o) => o.op === 'fall')) return 'bande';
  if (/^\.consumable/.test(n.chemin) && !n.chemin.includes('onHitEffects')) return 'consommable';
  return 'generale';
}

/** Ce que la porte a joué : `jouee` = la gate de la donnée était ouverte (sinon no-op légitime) ;
 *  `poses` = les porteurs que la porte a dû ajouter au décor (coque), à exclure du diff. */
type Jouee = { jouee: boolean; poses: readonly string[] };

/** Joue le nœud par SA porte. */
function jouerParSaPorte(n: Noeud, sujet: Combatant): Jouee {
  // L'ENTITÉ PORTEUSE voyage avec le nœud, comme chez tout producteur réel (`effectSourcesOf`,
  // `runCastFlow`) : c'est d'elle que le nœud — et un second Test enfoui dans sa branche — dérive
  // son enjeu. L'omettre ferait juger au banc un chemin que personne n'emprunte.
  const opsCtx = { label: n.entryId, sl: -10, ...(n.source ? { source: n.source } : {}) };
  switch (porteDe(n)) {
    case 'bande': {
      // La porte des bandes REND son étape : « la couture décide où elle atterrit ». Le banc tient donc
      // le rôle de la couture — il pousse l'étape puis la joue comme un joueur (`draineCascade`) ;
      // l'abandonner ferait passer ces nœuds pour muets alors que personne ne les a joués.
      // Un coup à l'ÉQUIPAGE frappe qui TIENT un poste : la station se lit au CHEMIN du nœud
      // (`.tables.<station>[…]`), jamais à une liste écrite ici. Sans elle, la table de hauteur n'a pas
      // de colonne pour le porteur et l'op `fall` lève — fail-fast juste, décor faux.
      const station = /^\.tables\.([A-Za-z-]+)\[/.exec(n.chemin)?.[1];
      set({
        party: [...get().party.map((c) => (c.id === 'h3' ? { ...c, shipStation: station } : c)), coque()] as never,
      });
      const etape = bandeTriggeredTest(get, set, [get().party[2]], n.node, n.entryId, { ...opsCtx, hull: coque() });
      if (etape) { pushCombatStep(set, etape); draineCascade(get); }
      return { jouee: true, poses: ['coque'] };
    }
    case 'consommable': {
      const it = itemFromTrappingById(n.entryId);
      if (!it) return { jouee: false, poses: [] };
      it.uid = 'sonde-1';
      set({ party: get().party.map((c) => (c.id === 'h3' ? { ...c, items: [...(c.items ?? []), it] } : c)) as never });
      get().usePartyItem('h3', 'sonde-1');
      return { jouee: true, poses: [] };
    }
    default: {
      if (flowTestGated(n.node.test, sujet, combatConditionCtx(sujet, opsCtx))) return { jouee: false, poses: [] };
      routeTriggeredTest(get, set, sujet, sujet, n.node, opsCtx);
      return { jouee: true, poses: [] };
    }
  }
}

/** Ce qu'un site produit quand on le joue d'un bout à l'autre. `branchesVides` rejoue le MÊME site
 *  avec des branches neutralisées : c'est le TÉMOIN auquel la course réelle se compare. */
function jouerUnSite(n: Noeud, issue: boolean, opts?: { branchesVides?: boolean }):
{ jouee: boolean; autresAvant: string; autres: string; etat: string; lignes: number; file: boolean } {
  const sujet = decor();
  // INSTANTANÉ PRIS AVANT LA PORTE : la porte des bandes ne passe par AUCUNE modale (elle rend son
  // étape, jouée ici même) — un instantané pris après elle ne mesurerait plus rien pour ces nœuds-là.
  const autresAvant = lesAutres();
  const etatAvant = consequenceSurLeSujet();
  const jAvant = lignesDeJournal();
  const { jouee, poses } = jouerParSaPorte(n, sujet);
  if (!jouee) return { jouee: false, autresAvant, autres: autresAvant, etat: etatAvant, lignes: 0, file: false };
  const pt = get().pendingTest;
  if (pt) {
    set({ pendingTest: {
      ...pt,
      ...(opts?.branchesVides ? { onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW, after: EMPTY_FLOW } : {}),
      roll: issue ? 1 : 99, success: issue, sl: issue ? 2 : -3,
    } });
    get().resolveTest();
  }
  return {
    jouee: true,
    autresAvant,
    autres: lesAutres(poses),
    etat: consequenceSurLeSujet(),
    lignes: lignesDeJournal() - jAvant,
    file: get().pendingLogQueue.length > 0,
  };
}

describe('#1874 C0 — CLASSE : aucun nœud `test` de la donnée ne déborde sur le groupe', () => {
  const noeuds = noeudsDeTest();
  const fichiersPorteurs = [...new Set(noeuds.map((n) => n.fichier))];

  const leves: string[] = [];
  const deborde: string[] = [];
  const muets: string[] = [];
  /** Sites tenus au contrat positif (branche productive dans ce décor) — l'anti-vacuité du contrat. */
  let tenus = 0;
  /** Sites écartés par l'ORACLE : branche inerte dans ce décor, pour tout marcheur. */
  const inertes: string[] = [];
  const ouvertsParFichier = new Map<string, number>();
  const gatesFermees: string[] = [];

  for (const n of noeuds) {
    for (const issue of [true, false]) {
      const site = `${n.fichier} ${n.entryId}${n.chemin} [${issue ? 'success' : 'fail'}]`;
      try {
        const reel = jouerUnSite(n, issue);
        if (!reel.jouee) { gatesFermees.push(site); continue; }
        ouvertsParFichier.set(n.fichier, (ouvertsParFichier.get(n.fichier) ?? 0) + 1);
        if (reel.autres !== reel.autresAvant) deborde.push(site);
        if (reel.file) deborde.push(`${site} — file de journal NON drainée`);
        // CONTRAT POSITIF, CALIBRÉ PAR SITE : une branche que l'ORACLE dit productive ICI doit produire
        // par la PORTE aussi — sur l'ÉTAT du sujet, ou en DISANT quelque chose. Le journal seul ne peut pas
        // servir de témoin (la résolution du jet y écrit SA ligne pour tout nœud) : on rejoue donc le MÊME
        // site avec des branches VIDES et on compare — le témoin est ce que la branche ajoute PAR-DESSUS
        // ce jet-là. Sans ce contrat, « personne n'a bougé » suffirait à rendre la garde verte.
        if (brancheInerteIci(n, issue)) { inertes.push(site); continue; }
        tenus++;
        const temoin = jouerUnSite(n, issue, { branchesVides: true });

        if (reel.etat === temoin.etat && reel.lignes <= temoin.lignes) muets.push(site);
      } catch (e) {
        leves.push(`${site} — ${String(e).slice(0, 200)}`);
      }
    }
  }

  it('aucun nœud ne LÈVE sur le chemin hors combat', () => {
    expect(leves, ['Nœuds de donnée qui LÈVENT à leur porte hors combat :', ...leves].join('\n')).toEqual([]);
  });

  it('aucune conséquence ne déborde du sujet sur le reste du groupe', () => {
    expect(deborde, ['Conséquences ÉCHAPPÉES du sujet (les 3 autres héros ont bougé) :', ...deborde].join('\n')).toEqual([]);
  });

  it('chaque branche PORTEUSE produit sa conséquence sur le sujet — aucune lâchée en silence', () => {
    expect(tenus, 'aucun site tenu au contrat positif : la garde serait verte à vide').toBeGreaterThan(100);
    expect(muets, [`Nœuds MUETS (l'oracle produit, la porte non) — ${muets.length}/${tenus} ;`,
      `branches inertes dans ce décor (hors contrat, mesurées) : ${inertes.length}`, ...muets].join('\n')).toEqual([]);
  });

  it('anti-vacuité : chaque fichier porteur a au moins un nœud RÉELLEMENT ouvert', () => {
    const vides = fichiersPorteurs.filter((f) => !ouvertsParFichier.get(f));
    expect(vides, ['Fichiers porteurs dont AUCUN nœud n’a été joué (garde verte à vide) :', ...vides,
      `gates fermées (no-op légitime) : ${gatesFermees.length}`].join('\n')).toEqual([]);
  });
});
