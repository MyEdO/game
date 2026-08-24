/**
 * LES DEUX GARDES DU REGISTRE DES ACTIONS (spec HUD « Zone 12 », sondes du juge promues).
 *
 *  (a) ATTEIGNABILITÉ — toute action déclarée dans `actions.json` a une SURFACE VIVANTE : une case
 *      de la console (par son id, ou par une clé de surface encore forkée), ou une touche du
 *      registre clavier. Ce qui n'en a pas est nommé dans `SANS_SURFACE`.
 *  (b) RÉCIPROQUE, FAIL-CLOSED — tout id de case d'action rendu par `CombatConsole.tsx` est DÉCLARÉ
 *      au registre. ZÉRO exemption : sans elle, la classe « action perdue » se reforme à la première
 *      case manuscrite. Ce volet lit des LITTÉRAUX de source : il est AVEUGLE aux cases que le porteur
 *      pose lui-même (`Combatant.barre`), d'où le volet (c).
 *  (c) DISPOSITION DATA-DRIVEN — une case posée par le joueur porte un id qu'aucun littéral ne cite :
 *      c'est le VALIDATEUR d'écriture (`poserDansBarre`) qui tient la frontière du registre, et la
 *      lecture qui absorbe une donnée héritée sans jamais inventer une case.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * `SANS_SURFACE` EST UN ÉCHAFAUDAGE DE CHANTIER, PAS UNE ABSOLUTION (posé le 2026-08-17).
 *   • CIBLE : `{}` — zéro entrée.
 *   • ÉCHÉANCE : le LOT BRANCHEMENTS de ce même chantier (spec zone 12, ordre des lots (2)) —
 *     jamais « plus tard ». Chaque lot en retire des lignes.
 *   • CLIQUET STRICT DÉCROISSANT (patron `raw-blind-refs-baseline`) : une action nouvellement sans
 *     surface qui n'est pas listée = ROUGE ; une entrée listée qui a retrouvé sa surface = ROUGE
 *     « périmée » (elle se retire dans le MÊME commit que le branchement).
 *   • RÉGIME PERMANENT — le marqueur `CHANTIER_BRANCHEMENTS_OUVERT` ferme la boucle : la baseline
 *     ne peut porter des entrées QUE tant qu'il vaut `true`, et il DOIT passer à `false` dès
 *     qu'elle est vide. Baseline vidée + marqueur éteint = toute ré-addition future est ROUGE,
 *     par construction, sans relecture humaine.
 *   • FUSION : le portage de ce worktree vers `main` exige `SANS_SURFACE = {}` ET
 *     `CHANTIER_BRANCHEMENTS_OUVERT = false` — aucun stock gelé n'atteint le tronc.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../data/index';
import { ACTION_GATES, ACTION_CANDIDATES, ACTION_PORTEURS, ACTION_RUN, GATE_ETAT_PORTE, MODES_HORS_REGISTRE, BATTLE_ACTION_MODES, actionGate, runAction } from './actionRegistry';
import { TARGETING_MODES, targetingModeLabel, CAST_MODE } from './targetingModes';
import { KEYBINDINGS } from './keybindings';
import { TAILLE_ZONE, TOUCHES_IMPRIMEES, cleEntree, dispositionDeduite, poserDansBarre, resoudreDisposition, retirerDeBarre } from './dispositionConsole';
import type { Combatant } from '../engine/types';
import { useGame, type BattleState } from './store';
import { emptyScene } from './scene';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const CONSOLE_SRC = src('../ui/CombatConsole.tsx');
/** LE PRODUCTEUR DE POOLS (`state/poolsDeCapacites`) : depuis qu'il porte la PERTINENCE (quelle case
 *  naît pour ce porteur), les ids d'action littéraux vivent là — la console et l'écran de capacités
 *  n'en font que l'habillage. Le scan lit donc les DEUX sources : une case posée par un site d'accueil
 *  (panneau-paramètre, gouttière, pastille) reste littérale à la console. */
const POOLS_SRC = src('./poolsDeCapacites.ts');
/** L'ÉCRAN DE CAPACITÉS : surface EXHAUSTIVE du même pool (il ne déclare aucune case à lui). */
const ECRAN_SRC = src('../ui/EcranCapacites.tsx');
const FRISE_SRC = src('../ui/InitiativeStrip.tsx');
const TARGETING_SRC = src('./targetingModes.ts');

/** Le chantier des BRANCHEMENTS est-il ouvert ? Voir l'en-tête : `false` verrouille la baseline à vide. */
const CHANTIER_BRANCHEMENTS_OUVERT = false;

/** Actions SANS surface vivante — nominatif, DÉCROISSANT, cible `{}` (voir en-tête). */
const SANS_SURFACE: Record<string, string> = {};

/** Clés littérales d'un motif `key:`/`id:` — une clé TEMPLATE se réduit à son préfixe littéral. */
function keysFrom(source: string, re: RegExp): string[] {
  return [...source.matchAll(re)].map((m) => m[1] ?? m[2]).filter((k): k is string => !!k);
}

/** Actions RENDUES par la console : elle ne déclare plus de cases à la main, elle CONSOMME le
 *  registre — une case naît d'un appel `cellFor('<id d'action>', …)`. On lit donc les ids d'action au
 *  site d'appel (+ le `data-cell="…"` littéral du coin de fin de tour, qui n'est pas une alvéole). */
const CONSOLE_KEYS = [CONSOLE_SRC, POOLS_SRC, ECRAN_SRC].flatMap((source) => [
  ...keysFrom(source, /cellFor\(\s*'([^']+)'()/g),
  ...keysFrom(source, /data-action="([^"]+)"()/g),
  // La console EXÉCUTE aussi des entrées sans alvéole (vignette de set, geste du bandeau de pause) :
  // son appel au registre est la surface, au même titre qu'une case.
  ...keysFrom(source, /runAction\(\s*'([^']+)'()/g),
]);

/** La FRISE d'initiative est une surface d'accueil du registre (spec §1d : `raise-hand` y vit) : elle
 *  marque l'entrée qu'elle rend par le MÊME attribut structurel que la console (`data-action`). */
const FRISE_KEYS = keysFrom(FRISE_SRC, /data-action="([^"]+)"()/g);
const KEYBINDING_IDS = KEYBINDINGS.map((b) => b.id);

/** Le bandeau de phase de la console consomme-t-il les actions d'INTERLUDE ? Elles n'ont pas de case
 *  nommée (le bandeau les rend depuis le registre, par le mode de ciblage courant) : leur surface est
 *  donc CE branchement. Il est lu sur la SOURCE, faute d'ancrage structurel ici — ce fichier tourne en
 *  environnement `node` (aucun DOM), et la seule preuve structurelle possible est de MONTER la console,
 *  ce que fait déjà `CombatConsole.test.tsx` (bandeau d'interlude : `.cc-phase [data-action=…]` rendu,
 *  cliqué, effet mesuré). Débrancher le bandeau y vire donc rouge ; ici, la lecture ne sert qu'à
 *  n'attribuer une surface aux interludes que tant que le pont existe. */
const INTERLUDE_BRANCHE = /currentInterludeAction/.test(CONSOLE_SRC);
const INTERLUDE_KEYS = INTERLUDE_BRANCHE ? ACTIONS.filter((a) => a.surface === 'interlude').map((a) => a.id) : [];

/** Un GESTE SECONDAIRE n'a pas de case nommée : la console le rend depuis le registre, par l'alvéole
 *  de son HÔTE (rendeur unique `gestes2e`), et son id n'apparaît donc dans aucun `cellFor('…')`
 *  littéral. Sa surface est CE branchement, ET la présence d'une case pour l'hôte. La preuve
 *  structurelle (l'alvéole hôte porte `data-geste-2e`, le clic droit dispatche, le refus se lit) est
 *  au DOM dans `CombatConsole.test.tsx` : débrancher le rendeur y vire rouge. */
const GESTE_2E_BRANCHE = /surface === 'geste-secondaire'/.test(POOLS_SRC);
const GESTE_2E_KEYS = GESTE_2E_BRANCHE
  ? ACTIONS.filter((a) => a.surface === 'geste-secondaire' && a.hote && CONSOLE_KEYS.includes(a.hote)).map((a) => a.id)
  : [];

/** Un REMÈDE D'ÉTAT (Se relever, Se rouler, Se libérer) n'a plus d'id cité au site : sa PERTINENCE
 *  est le gate que SON entrée DÉCLARE (`etat-porte` — l'entrée dit l'État qu'elle traite par
 *  `rule` + `ruleCategory: 'etats'`), et le producteur de pools rend TOUTES les entrées qui le
 *  portent. Sa surface est CE branchement, mesuré à sa source ; la preuve structurelle (la case
 *  naît de l'État porté, exécute son dispatcher) est au DOM dans `CombatConsole.test.tsx` (R-6). */
const REMEDE_BRANCHE = POOLS_SRC.includes('GATE_ETAT_PORTE');
const REMEDE_KEYS = REMEDE_BRANCHE
  ? ACTIONS.filter((a) => [a.gate].flat().includes(GATE_ETAT_PORTE)).map((a) => a.id)
  : [];

/** Une PASTILLE D'ENTITÉ n'a pas de case : elle naît de la chose qui l'offre, sur le champ (spec zone
 *  4). Sa surface est le lecteur du registre qui la fabrique — `state/entityGestes`, qui énumère les
 *  entrées `surface: 'pastille-entite'`, appelle leur sélecteur ET leur porteur de pastille, et
 *  regroupe par entité ; une entrée sans porteur déclaré n'atteindrait donc AUCUNE entité. Comme pour
 *  le bandeau d'interlude, la lecture se fait sur la SOURCE (ce fichier tourne en environnement `node`,
 *  sans DOM) : la preuve STRUCTURELLE — une entrée `pastille-entite` FABRIQUÉE rend une pastille au DOM
 *  sans une ligne de code — est dans `gameIso/stage/pastille-entite.test.tsx`, où débrancher le rendeur
 *  vire rouge. */
const OFFRES_SRC = src('./registreOffres.ts');
/** Les surfaces que le SOCLE lit réellement (`offresDuRegistre('<surface>'`, `state/registreOffres` et ses
 *  appelants) : une entrée de ces surfaces SANS porteur déclaré est skippée EN SILENCE par le socle — elle
 *  n'atteindrait donc personne. C'est ce que la garde de porteur ci-dessous refuse. */
const OFFRES_CONSOMMEES = [...new Set(
  [OFFRES_SRC, POOLS_SRC, ECRAN_SRC]
    .flatMap((s) => s.split("offresDuRegistre(").slice(1).map((suite) => suite.split("'")[1]))
    .filter((s) => ACTIONS.some((a) => a.surface === s)), // écarte la DÉCLARATION du socle (son paramètre)
)];
const PASTILLE_BRANCHE = OFFRES_CONSOMMEES.includes('pastille-entite');
const PASTILLE_KEYS = PASTILLE_BRANCHE
  ? ACTIONS.filter((a) => a.surface === 'pastille-entite' && a.candidates && a.candidates in ACTION_PORTEURS).map((a) => a.id)
  : [];

/** Surfaces VIVANTES : la console, le bandeau d'interlude qu'elle rend, les gestes secondaires de ses
 *  alvéoles, les REMÈDES d'État que le producteur de pools rend par déclaration, les PASTILLES des
 *  entités du champ, la FRISE, et le clavier. */
const SURFACES_VIVANTES = new Set([...CONSOLE_KEYS, ...FRISE_KEYS, ...INTERLUDE_KEYS, ...GESTE_2E_KEYS, ...REMEDE_KEYS, ...PASTILLE_KEYS, ...KEYBINDING_IDS]);

/** Les clés qu'une action revendique : son id + ses clés de surface encore forkées. */
const claimedKeys = (a: (typeof ACTIONS)[number]) => [a.id, ...(a.keys ?? [])];

describe('registre des actions — cohérence interne (ids de code résolus)', () => {
  it('chaque `gate` déclaré existe dans ACTION_GATES (un id, ou chacun des ids composés)', () => {
    const bad = ACTIONS.filter((a) => [a.gate].flat().some((g) => !(g in ACTION_GATES))).map((a) => `${a.id} → ${a.gate}`);
    expect(bad, `gate(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `candidates` déclaré existe dans ACTION_CANDIDATES', () => {
    const bad = ACTIONS.filter((a) => a.candidates && !(a.candidates in ACTION_CANDIDATES)).map((a) => `${a.id} → ${a.candidates}`);
    expect(bad, `sélecteur(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('toute surface CONSOMMÉE PAR LE SOCLE déclare sa population ET son porteur (`ACTION_PORTEURS`)', () => {
    // Le socle (`state/registreOffres.offresDuRegistre`) SKIPPE EN SILENCE une entrée dont le sélecteur
    // n'a pas d'enveloppe de porteur : personne ne saurait identifier ses candidats, et l'action
    // n'atteindrait aucune surface sans que rien ne le dise. La garde porte donc sur TOUTES les surfaces
    // que le socle lit — lues à SA source (`OFFRES_CONSOMMEES`), jamais recopiées : brancher une 3ᵉ
    // surface dessus l’amène automatiquement ici.
    expect(OFFRES_CONSOMMEES.length, 'aucune surface branchée au socle : sa lecture serait morte').toBeGreaterThan(1);
    const parCandidat = ACTIONS.filter((a) => OFFRES_CONSOMMEES.includes(a.surface));
    expect(parCandidat.length, 'aucune action offerte par candidat').toBeGreaterThan(0);
    const orphelines = parCandidat
      .filter((a) => !a.candidates || !(a.candidates in ACTION_PORTEURS))
      .map((a) => `${a.id} (${a.surface}) → ${a.candidates ?? "—"}`);
    expect(orphelines, `action(s) offerte(s) par candidat sans porteur déclaré (le socle les skipperait en silence) :\n  ${orphelines.join('\n  ')}`).toEqual([]);
  });
  it('chaque `run` déclaré existe dans ACTION_RUN', () => {
    const bad = ACTIONS.filter((a) => a.run && !(a.run in ACTION_RUN)).map((a) => `${a.id} → ${a.run}`);
    expect(bad, `dispatcher(s) inconnu(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('chaque `mode` déclaré est un TargetingMode existant (`targetingModes.ts`)', () => {
    const bad = ACTIONS.filter((a) => a.mode && !TARGETING_SRC.includes(`id: '${a.mode}'`)).map((a) => `${a.id} → ${a.mode}`);
    expect(bad, `mode(s) de ciblage inexistant(s) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it('PARITÉ INVERSE — tout mode de ciblage a une action PORTEUSE au registre (aucun mode sans surface)', () => {
    // Méta d'abord : le catalogue énumérable doit couvrir les modes DÉCLARÉS dans la source (un mode
    // oublié au catalogue rendrait la parité verte à tort).
    const idsSource = [...new Set([...TARGETING_SRC.matchAll(/^\s*id: '([a-z-]+)'/gm)].map((m) => m[1]))];
    const horsCatalogue = idsSource.filter((id) => !TARGETING_MODES.some((m) => m.id === id));
    expect(horsCatalogue, `mode(s) déclaré(s) mais absent(s) de TARGETING_MODES :\n  ${horsCatalogue.join('\n  ')}`).toEqual([]);
    // Parité : un mode que le joueur peut atteindre sans action porteuse est un ciblage SANS SORTIE.
    const orphelins = TARGETING_MODES.filter((m) => !ACTIONS.some((a) => a.mode === m.id)).map((m) => m.id);
    expect(
      orphelins,
      `mode(s) de ciblage qu'aucune action ne porte (armer/sortir ce mode n'a aucune surface) :\n  ${orphelins.join('\n  ')}`,
    ).toEqual([]);
  });
  /**
   * ARMEMENT — la valeur qu'une action pose dans `battle.action` (`armed`) est un MODE de ciblage du
   * catalogue, et c'est le `mode` que la MÊME entrée déclare. Conséquence lue par les consommateurs :
   * « quel geste arme le mode X ? » se résout par le champ `mode`/`armed`, l'id de l'entrée porteuse
   * étant libre (`cast-spell` arme `cast`, `push-engine` arme `push`).
   */
  it('tout `armed` déclaré est un mode du catalogue, égal au `mode` de son entrée (mode incantation → `cast-spell`)', () => {
    const armantes = ACTIONS.filter((a) => a.armed);
    expect(armantes.length, 'aucune action armante mesurée : la garde serait verte à vide').toBeGreaterThan(0);
    const bad = armantes
      .filter((a) => !TARGETING_MODES.some((m) => m.id === a.armed) || a.mode !== a.armed)
      .map((a) => `${a.id} → armed:${a.armed} / mode:${a.mode ?? '—'}`);
    expect(bad, `action(s) dont l'armement ne désigne pas son propre mode de ciblage :\n  ${bad.join('\n  ')}`).toEqual([]);
    // Résolution NOMMÉE du mode incantation : une seule entrée l'arme, et c'est `cast-spell`.
    const incantation = armantes.filter((a) => a.armed === CAST_MODE.id).map((a) => a.id);
    expect(incantation, `le mode ${CAST_MODE.id} doit être armé par une entrée unique`).toEqual(['cast-spell']);
  });

  it('un mode d’INTERLUDE porte son nom de phase, et sa sortie dit si Échap peut la prendre', () => {
    const interludes = ACTIONS.filter((a) => a.surface === 'interlude');
    expect(interludes.length, 'aucune action d’interlude : le bandeau n’aurait rien à rendre').toBeGreaterThan(0);
    const muets = interludes.filter((a) => !a.mode || !targetingModeLabel(a.mode)).map((a) => a.id);
    expect(muets, `interlude(s) dont le mode n'a pas de libellé de phase :\n  ${muets.join('\n  ')}`).toEqual([]);
    const sansVerdict = interludes.filter((a) => typeof a.exitSafe !== 'boolean').map((a) => a.id);
    expect(sansVerdict, `interlude(s) sans verdict exitSafe :\n  ${sansVerdict.join('\n  ')}`).toEqual([]);
  });
  it('chaque action rend un VERDICT sur un état réel (aucun gate ne jette, aucune raison muette)', () => {
    const active = {
      id: 'H', kind: 'hero', advantage: 0, conditions: [], wounds: { current: 10, max: 10 },
      weapons: [], items: [], skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 },
      characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    } as unknown as Parameters<typeof actionGate>[1]['active'];
    const battle = {
      combatants: [active], order: ['H'], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as unknown as Parameters<typeof actionGate>[1]['battle'];
    const muets = ACTIONS.filter((a) => {
      const v = actionGate(a.id, { active, battle });
      return typeof v.ok !== 'boolean' || (!v.ok && !v.reason);
    }).map((a) => a.id);
    expect(muets, `Action(s) dont le gate ne rend pas un verdict motivé :\n  ${muets.join('\n  ')}`).toEqual([]);
    // Fail-closed : un id inconnu ne « passe » jamais.
    expect(actionGate('id-inexistant', { active, battle }).ok).toBe(false);
  });
  it('`BattleState.action` se type DEPUIS le registre : `armed` + MODES_HORS_REGISTRE = BATTLE_ACTION_MODES', () => {
    const derives = new Set([
      ...ACTIONS.flatMap((a) => (a.armed ? [a.armed] : [])),
      ...Object.keys(MODES_HORS_REGISTRE),
    ]);
    expect([...derives].sort()).toEqual([...BATTLE_ACTION_MODES].sort());
  });
});

describe('(a) atteignabilité — toute action du registre a une surface vivante', () => {
  const sansSurface = ACTIONS.filter((a) => !claimedKeys(a).some((k) => SURFACES_VIVANTES.has(k))).map((a) => a.id);

  it('aucune action NOUVELLEMENT sans surface (cliquet : la liste ne remonte jamais)', () => {
    const nouvelles = sansSurface.filter((id) => !(id in SANS_SURFACE));
    expect(
      nouvelles,
      `Action(s) sans case, sans pastille et sans touche — brancher une surface, ou (si c'est un lot ultérieur) l'inscrire nominativement dans SANS_SURFACE :\n  ${nouvelles.join('\n  ')}`,
    ).toEqual([]);
  });

  it('aucune entrée PÉRIMÉE : une action qui a retrouvé sa surface quitte la baseline', () => {
    const perimees = Object.keys(SANS_SURFACE).filter((id) => !sansSurface.includes(id));
    expect(
      perimees,
      `Entrée(s) de SANS_SURFACE devenue(s) fausse(s) (action branchée, ou id disparu du registre) — les retirer :\n  ${perimees.join('\n  ')}`,
    ).toEqual([]);
  });

  it('chaque entrée de la baseline porte SA raison et SON adresse de destination', () => {
    const muettes = Object.entries(SANS_SURFACE).filter(([, r]) => !r || r.trim().length < 15).map(([id]) => id);
    expect(muettes, `Entrée(s) sans adresse de destination :\n  ${muettes.join('\n  ')}`).toEqual([]);
  });

  it('RÉGIME PERMANENT : la baseline n’a d’entrées que chantier OUVERT, et s’éteint avec lui', () => {
    const n = Object.keys(SANS_SURFACE).length;
    if (n > 0) {
      expect(
        CHANTIER_BRANCHEMENTS_OUVERT,
        `${n} action(s) sans surface alors que le chantier des branchements est déclaré CLOS : plus aucun stock gelé n'est recevable — brancher, ou rouvrir le chantier explicitement.`,
      ).toBe(true);
    } else {
      expect(
        CHANTIER_BRANCHEMENTS_OUVERT,
        'baseline VIDE : éteindre `CHANTIER_BRANCHEMENTS_OUVERT` (le verrou passe en régime permanent — toute ré-addition devient rouge).',
      ).toBe(false);
    }
  });
});

describe('(c) disposition data-driven — le validateur d’écriture tient la frontière du registre', () => {
  /** Un porteur nu : seule sa disposition nous intéresse ici. */
  const porteur = () => ({ id: 'H', label: 'H' } as unknown as Combatant);
  /** Une entrée : l'action, et la CLÉ DÉCLARÉE de sa case (par défaut celle du registre). */
  const e = (actionId: string, cle = actionId) => ({ actionId, cle });
  /** Les entrées que la console DÉDUIT réellement (littéraux `cellFor('…')`), bornées aux déclarées. */
  const deduitsReels = [...new Set(CONSOLE_KEYS)].filter((k) => ACTIONS.some((a) => a.id === k)).map((id) => e(id));

  it('ÉCRITURE fail-fast : id hors registre, rang hors borne, zone inconnue, arsenal sans set', () => {
    expect(() => poserDansBarre(porteur(), { zone: 'capacites', index: 0 }, e('action-qui-nexiste-pas'))).toThrow(/registre/);
    expect(() => poserDansBarre(porteur(), { zone: 'capacites', index: TAILLE_ZONE.capacites }, e('defend'))).toThrow(/hors de la zone/);
    expect(() => poserDansBarre(porteur(), { zone: 'capacites', index: -1 }, e('defend'))).toThrow(/hors de la zone/);
    expect(() => poserDansBarre(porteur(), { zone: 'nulle-part' as never, index: 0 }, e('defend'))).toThrow(/zone inconnue/);
    expect(() => poserDansBarre(porteur(), { zone: 'arsenal', index: 0 }, e('defend'))).toThrow(/PAR SET/);
    // … et le témoin POSITIF : les mêmes adresses, valides, passent (la garde ne refuse pas tout).
    expect(() => poserDansBarre(porteur(), { zone: 'capacites', index: TAILLE_ZONE.capacites - 1 }, e('defend'))).not.toThrow();
    expect(() => poserDansBarre(porteur(), { zone: 'arsenal', index: 0, setId: 'set-1' }, e('defend'))).not.toThrow();
    expect(() => retirerDeBarre(porteur(), { zone: 'accesRapide', index: 0 })).not.toThrow();
  });

  it('LECTURE par adresse : l’entrée posée se rend à SON rang, le rang vidé le reste, les voisins ne glissent pas', () => {
    const deduite = dispositionDeduite('capacites', [e('course'), e('mouvement'), e('defend')]);
    const pose = poserDansBarre(porteur(), { zone: 'capacites', index: 5 }, e('aim'));
    const rendu = resoudreDisposition(pose.barre, 'capacites', deduite);
    expect(rendu[5]).toEqual(e('aim'));
    expect(rendu.slice(0, 3), 'le pré-remplissage déduit a bougé').toEqual(deduite);
    // Case VIDÉE : elle reste vide, la déduction ne la reprend PAS ; le pré-remplissage s'écoule dans
    // les rangs LIBRES suivants, sans rien perdre ni dupliquer.
    const vide = retirerDeBarre(pose, { zone: 'capacites', index: 0 });
    const apres = resoudreDisposition(vide.barre, 'capacites', deduite);
    expect(apres[0], 'la case vidée a été reprise par la déduction').toBeNull();
    expect(apres.slice(1, 4), 'le pré-remplissage a perdu ou dupliqué une entrée').toEqual(deduite);
    expect(apres[5], 'le rang POSÉ a bougé alors qu’une autre case était vidée').toEqual(e('aim'));
    // L'arsenal s'adresse PAR SET : la disposition d'un set n'atteint pas l'autre.
    const arsenal = poserDansBarre(porteur(), { zone: 'arsenal', index: 1, setId: 'set-a' }, e('charge'));
    const deduiteA = dispositionDeduite('arsenal', [e('attaque')]);
    expect(resoudreDisposition(arsenal.barre, 'arsenal', deduiteA, 'set-a')[1]).toEqual(e('charge'));
    expect(resoudreDisposition(arsenal.barre, 'arsenal', deduiteA, 'set-b')[1]).toBeNull();
  });

  /**
   * LE CHEMIN RÉEL DE LA SAVE : `saves.ts` sérialise l'état par `JSON.parse(JSON.stringify(data))`, et
   * le snapshot réseau passe par le même goulot. Un tableau à trous en serait ressorti `[null, null, …]`
   * — soit « rangs 0-1 VIDÉS » alors que le joueur n'avait touché QUE le rang 3. La zone est donc un
   * objet creux, et cet aller-retour est la mesure qui le tient.
   */
  it('ALLER-RETOUR JSON (chemin de `saves.ts`) : poser au rang 3 ne vide pas les rangs 0-2', () => {
    const deduite = dispositionDeduite('capacites', [e('course'), e('mouvement'), e('defend')]);
    const pose = poserDansBarre(porteur(), { zone: 'capacites', index: 3 }, e('aim'));
    const avant = resoudreDisposition(pose.barre, 'capacites', deduite);
    const apresSave = resoudreDisposition(JSON.parse(JSON.stringify(pose.barre)), 'capacites', deduite);
    expect(apresSave, 'la sauvegarde a changé ce que la console rend').toEqual(avant);
    expect(apresSave.slice(0, 3), 'les rangs jamais touchés ont été vidés par la sérialisation').toEqual(deduite);
    expect(apresSave[3]).toEqual(e('aim'));
  });

  /**
   * UNE ADRESSE DÉSIGNE « CE SORT-LÀ » : plusieurs cases partagent un même `actionId` (`cast-spell` par
   * sort, `select-attack` par attaque, `use-item` par objet). Sans la CLÉ de la case, l'adresse rendrait
   * la n-ième occurrence de l'offre — donc un autre sort dès que l'offre change d'ordre.
   */
  it('l’adresse porte la CLÉ de la case : elle survit à une permutation de l’offre, et poser DÉPLACE', () => {
    const feu = e('cast-spell', 'sort-boule-de-feu');
    const lumiere = e('cast-spell', 'sort-lumiere');
    const pose = poserDansBarre(porteur(), { zone: 'capacites', index: 0 }, feu);
    // L'offre change d'ordre (un sort appris, un autre épuisé) : l'adresse rend TOUJOURS le même sort.
    for (const offre of [[feu, lumiere], [lumiere, feu]]) {
      const rendu = resoudreDisposition(pose.barre, 'capacites', dispositionDeduite('capacites', offre));
      expect(rendu[0], 'l’adresse a changé de sort avec l’ordre de l’offre').toEqual(feu);
      // POSER = DÉPLACER : le sort posé ne se dédouble pas dans le pré-remplissage…
      expect(rendu.filter((x) => x && cleEntree(x) === cleEntree(feu)).length, 'le sort posé apparaît deux fois').toBe(1);
      // … et il ne laisse pas de trou derrière lui : l'autre sort remonte à sa place.
      expect(rendu[1], 'poser une capacité déduite a troué le pré-remplissage').toEqual(lumiere);
    }
  });

  /**
   * L'IDENTITÉ EST CELLE DU MODÈLE, PAS DE L'INSTANCE (sonde du juge S7) : la case d'un consommable se
   * déclare `q-objet-<trappingId>` — boire une potion consomme un `uid` mais ne déplace RIEN. Une
   * adresse bâtie sur l'uid d'args (`itemUid`) mourrait à la première gorgée.
   */
  it('l’adresse d’un consommable SURVIT à la consommation d’une instance (identité de modèle)', () => {
    const potion = e('use-item', 'q-objet-potion-de-soin');
    const pose = poserDansBarre(porteur(), { zone: 'accesRapide', index: 2 }, potion);
    const rendu = resoudreDisposition(pose.barre, 'accesRapide', dispositionDeduite('accesRapide', [potion, e('heal', 'q-soigner')]));
    expect(rendu[2], 'la potion a quitté l’adresse où le joueur l’avait posée').toEqual(potion);
    // TÉMOIN — une adresse d'INSTANCE (ce que produirait un balayage d'`args` : `itemUid`) ne
    // désigne PLUS aucune case de l'offre dès que l'uid change ; celle du MODÈLE, si.
    const offre = dispositionDeduite('accesRapide', [potion]);
    const parInstance = poserDansBarre(porteur(), { zone: 'accesRapide', index: 2 }, e('use-item', 'itm-42'));
    const renduInstance = resoudreDisposition(parInstance.barre, 'accesRapide', offre)[2]!;
    const offerte = (x: typeof potion) => offre.some((o) => cleEntree(o) === cleEntree(x));
    expect(offerte(renduInstance), 'témoin muet : l’identité d’instance aurait dû ne désigner aucune case').toBe(false);
    expect(offerte(potion), 'l’identité de MODÈLE ne désigne plus la case offerte').toBe(true);
  });

  /** Sonde du juge S6 : deux cases de même identité rendraient la même alvéole deux fois. */
  it('COLLISION D’ADRESSE : deux cases de même identité dans une zone sont un bug, et il se voit', () => {
    const feu = e('cast-spell', 'sort-boule-de-feu');
    expect(() => dispositionDeduite('capacites', [feu, e('course'), feu])).toThrow(/deux cases de même identité/);
    // Même action, clés DIFFÉRENTES : aucune collision (c'est le cas normal des N alvéoles d'une action).
    expect(() => dispositionDeduite('capacites', [feu, e('cast-spell', 'sort-lumiere')])).not.toThrow();
  });

  it('LECTURE tolérante : un id que ce binaire ne connaît plus est IGNORÉ, sa case reste vide', () => {
    // Donnée héritée (save d'une autre version) : elle n'a pas pu passer par le validateur.
    const herite = { capacites: { 0: e('id-dune-autre-version') } };
    const rendu = resoudreDisposition(herite, 'capacites', dispositionDeduite('capacites', [e('course')]));
    expect(rendu[0], 'la déduction a repris une case que le joueur avait remplie').toBeNull();
  });

  it('le PRÉ-REMPLISSAGE ne produit que des ids du registre (et refuse tout le reste)', () => {
    expect(deduitsReels.length, 'aucun id déduit mesuré : la sonde serait verte à vide').toBeGreaterThan(10);
    expect(() => dispositionDeduite('capacites', deduitsReels)).not.toThrow();
    expect(() => dispositionDeduite('capacites', [e('course'), e('pas-une-action')])).toThrow(/registre/);
    // Géométrie : la zone ne pré-remplit jamais au-delà de son compte de cases.
    expect(dispositionDeduite('arsenal', deduitsReels).length).toBe(TAILLE_ZONE.arsenal);
    expect(resoudreDisposition(undefined, 'arsenal', dispositionDeduite('arsenal', [])).length).toBe(TAILLE_ZONE.arsenal);
  });

  it('CLAVIER par adresse : exactement 8 liaisons de rang, sur les 8 premiers rangs des capacités', () => {
    const rangs = KEYBINDINGS.filter((b) => b.section === 'hotbar');
    expect(rangs.map((b) => b.id)).toEqual(Array.from({ length: TOUCHES_IMPRIMEES }, (_, i) => `hotbar-${i + 1}`));
    expect(rangs.flatMap((b) => b.codes)).toEqual(Array.from({ length: TOUCHES_IMPRIMEES }, (_, i) => `Digit${i + 1}`));
    expect(rangs.length, 'les touches imprimées et les liaisons de rang doivent être le MÊME compte').toBe(TOUCHES_IMPRIMEES);
    expect(TOUCHES_IMPRIMEES).toBeLessThanOrEqual(TAILLE_ZONE.capacites);
  });
});

describe('(b) réciproque fail-closed — aucune case d’action hors registre', () => {
  const declared = new Set(ACTIONS.flatMap(claimedKeys));

  it('toute case d’action de CombatConsole est déclarée au registre', () => {
    const orphelines = [...new Set(CONSOLE_KEYS)].filter((k) => !declared.has(k));
    expect(
      orphelines,
      `Case(s) de console inconnue(s) du registre (déclarer l'action dans src/data/actions.json — aucune exemption) :\n  ${orphelines.join('\n  ')}`,
    ).toEqual([]);
  });

  it('méta — l’extracteur voit bien des clés (une regex muette rendrait la garde verte à tort)', () => {
    expect(CONSOLE_KEYS.length).toBeGreaterThan(10);
  });
});

/**
 * POURQUOI CHAQUE INTERLUDE PORTE SON PROPRE DISPATCHER (#1411 P0-B) — les sorties ne sont pas
 * interchangeables : `battleSelectAction` (sortie de la bordée) est AVALÉ sous un flux différé
 * (`combatBusy`, `combatSlice.ts:2875`), là où `cleaveEnd`/`dualStrikeSkip` sont justement les verbes
 * DE ces flux. Un dispatcher mutualisé rendrait la sortie muette dès qu'un flux se superpose. Le
 * témoin POSITIF (sans flux, la sortie mord) borne la mesure.
 */
describe('sorties d’interlude — le dispatcher mutualisé est inexprimable (témoin mesuré)', () => {
  /** Combat minimal réel : un héros ACTIF, une scène, le mode de bordée armé. */
  function combatArme(over: Partial<BattleState> = {}) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gunnar', rng: makeRNG(7) });
    h.id = 'h1';
    h.pos = { x: 5, y: 5 };
    useGame.setState({
      party: [h], scene: emptyScene(), pendingCleave: null, pendingDualStrike: null, pendingCast: null,
      battle: {
        combatants: [h], order: [h.id], baseOrder: [h.id], turn: 0, round: 1, action: 'battery',
        selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false,
        log: [], over: null, ...over,
      } as unknown as BattleState,
    });
    return h;
  }

  afterEach(() => { useGame.setState({ battle: null, pendingCleave: null }); });

  it('TÉMOIN — sans flux différé, la sortie de bordée désarme bien le mode', () => {
    combatArme();
    runAction('battery-cancel', useGame.getState);
    expect(useGame.getState().battle!.action).toBeNull();
  });

  it('MESURE — sous un flux différé, la MÊME sortie est avalée (donc jamais partagée avec cleave/dual)', () => {
    const h = combatArme();
    useGame.setState({ pendingCleave: { attackerId: h.id, hitIds: [], count: 0 } as never });
    runAction('battery-cancel', useGame.getState);
    expect(
      useGame.getState().battle!.action,
      'la sortie de bordée est avalée sous `combatBusy` — c’est pourquoi cleave/dual portent leurs propres verbes',
    ).toBe('battery');
    // … et le verbe DE ce flux, lui, passe : chaque interlude sort par SON dispatcher.
    runAction('cleave-end', useGame.getState);
    expect(useGame.getState().pendingCleave).toBeNull();
  });
});
