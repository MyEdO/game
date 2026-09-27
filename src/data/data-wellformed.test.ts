/**
 * Garde-fou d'INTÉGRITÉ des données app-owned (`src/data/*.json`). Attrape AU BUILD les corruptions de
 * donnée qui ne plantent qu'au runtime — typiquement une string template `"$indice"` qui atteint
 * `resolveFormula` et crashe en plein combat. GÉNÉRIQUE : balaie TOUS les `.json` (aucune liste codée
 * en dur), messages d'échec ACTIONNABLES (fichier + chemin JSON + valeur fautive).
 *
 * Cinq familles de checks :
 *  1. SYNTAXE        — chaque fichier `JSON.parse` (échec → rouge avec le fichier).
 *  2. OPS CONNUES    — toute `{op:'…'}` (hors Condition `kind`) a un `op` du vocabulaire `GameOp` réel
 *                      (extrait de l'union `GameOp` de `engine/ops.ts` par regex → zéro dérive).
 *  3. FORMULES       — tout champ Formula d'une `GameOp` (`amount`/`count`/… ) est `isValidFormula`
 *                      (number fini OU objet à clé connue). Une string qui fuit → rouge.
 *  4. PLACEHOLDERS   — une string `$…` n'est tolérée QUE si elle vaut `'$arg'`/`'$indice'` ET vit dans
 *                      les `effects` de `traits.json` (substituée par `withArg`, state/triggeredEffects).
 *  6. FLOW PUR       — chaque `TriggeredEffect.flow` (champs `TriggeredEffect[]` du catalogue, extraits
 *                      par regex de `data/index.ts` — JAMAIS une liste de fichiers à la main) ne porte pas
 *                      une op de `STRAY_IMPURE_OPS` (`interruptFocus`/`breakBlade`/`delayed`) HORS branche
 *                      `success`/`fail` d'un `test` (`flowHasImpureOpOutsideTest`, engine/flowCore) : ces
 *                      ops n'ont de hook que dans le do-loop de `runCombatFlow` avec son contexte de
 *                      branche — ailleurs, le walker pur `runPureFlowLines` (state/combatEffects) les
 *                      avalerait en silence. `grantFreeAttack` top-level reste légitime (résolu par
 *                      `resolveFreeAttacks`).
 *
 * EXCLUSION `miscast.json` (famille 3) : ce fichier est un DIALECTE source (`JsonOp`/`JsonFormula` :
 * `{sinPlus1:true}`, `sinPlus1Value`, noms paramétrés par `sinPoints`) COMPILÉ en `GameOp` réels par
 * `engine/miscast.ts::expandOp`, et validé par `engine/miscast-ops.test.ts`. Ses `op` restent vérifiés
 * (famille 2 : ce sont des noms `GameOp` standard), mais ses Formules suivent un autre vocabulaire.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidFormula } from '../engine/ops';
import { ICON_DEFS } from '../ui/icons';
import { ARG_TEMPLATE, INDICE_TEMPLATE, flowHasImpureOpOutsideTest } from '../engine/flowCore';
import type { Flow } from '../engine/flowCore';
import { ruleDef } from '../engine/policy';
import { listerArbre, listerDossier } from '../../scripts/guards/lib/lister.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const files = listerDossier(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

// --- Vocabulaire GameOp EXACT, extrait de l'union `GameOp` de engine/ops.ts (membres `| { op: '…'`) →
//     jamais une liste maintenue à la main qui dériverait de l'union.
const OPS_SRC = readFileSync(fileURLToPath(new URL('../engine/ops.ts', import.meta.url)), 'utf8');
const KNOWN_OPS = new Set([...OPS_SRC.matchAll(/\|\s*\{\s*op:\s*'([^']+)'/g)].map((m) => m[1]));
// Opérateurs de comparaison d'une Condition `compare`/`slThreshold`/… (engine/flowCore.ts `CompareOp`) :
// un AUTRE espace de noms pour la clé `op`, TOUJOURS porté par un objet à `kind` → exclu du dispatch GameOp.
const COMPARE_OPS = new Set(['>=', '<=', '==', '<', '>', '!=']);

// Champs `TriggeredEffect[]` du catalogue — EXTRAITS par regex de `data/index.ts` (jamais une liste de
// familles à la main) : `effects`/`onHitEffects`… Distincts par TYPE des `Flow` simples (`SpellData.effects`,
// `TrappingData.consumable`) qui ne matchent pas ce motif → naturellement hors périmètre du verrou.
const INDEX_SRC = readFileSync(fileURLToPath(new URL('index.ts', import.meta.url)), 'utf8');
const TRIGGERED_EFFECT_FIELDS = new Set(
  [...INDEX_SRC.matchAll(/(\w+)\?:\s*import\('\.\.\/(?:state\/flow|engine\/flowCore)'\)\.TriggeredEffect\[\]/g)].map((m) => m[1]),
);

// Fichier DIALECTE compilé (cf. en-tête) : exclu de la famille Formule.
const MISCAST = 'miscast.json';

// Champs d'une `GameOp` typés `Formula` (ou `number`, qui passe `isValidFormula`) — au minimum amount/count.
const FORMULA_FIELDS = [
  'amount', 'count', 'value', 'durationRounds', 'escapeStrength', 'escapeThreshold', 'struggleDamage', 'radius', 'damage', 'meters',
  'maxBounces', 'hopMeters', 'delayDays', 'radiusMeters', 'lengthMeters', 'bonus', 'indice', 'mod',
  'rounds', 'minutes', 'hours', 'days',
  // Extensions #50 : États à durée d'horloge (op `condition`) + ops différées (op `delayed`).
  'durationMinutes', 'durationHours', 'afterMinutes', 'afterHours', 'afterDays', 'forMinutes', 'forHours', 'forDays',
];

/** Templates d'instance substitués au runtime par `withArg` (state/triggeredEffects), PAR FICHIER — un
 *  template n'est légitime que là où le paramètre existe :
 *  - `traits.json` : `$arg` (arg d'instance, « Venin (Difficile) ») ET `$indice` — un Trait porte les deux.
 *  - `qualities.json` : `$indice` SEUL. La branche QUALITÉ d'`effectSourcesOf` appelle `withArg(effects,
 *    undefined, indice)` : une qualité n'a pas d'arg, et un `$arg` y serait DROPPÉ en silence (`substOp`
 *    rend l'op inerte, le coût d'un `choice` resterait template → nœud non offert).
 *  Ailleurs = bug.
 *  PÉRIMÈTRE DÉCLARÉ : la porte est le FICHIER + le chemin `effects`, pas le champ ; un template posé sous
 *  un autre champ d'`effects` de ces deux fichiers passerait ici et serait DROPPÉ au runtime, pas détecté. */
const TEMPLATES_PAR_FICHIER: Record<string, readonly string[]> = {
  'traits.json': [ARG_TEMPLATE, INDICE_TEMPLATE],
  'qualities.json': [INDICE_TEMPLATE],
};
const isTemplate = (v: unknown, file: string, path: string): boolean =>
  typeof v === 'string' && (TEMPLATES_PAR_FICHIER[file] ?? []).includes(v) && path.includes('effects');

/** Un objet est-il une `GameOp` à valider ? `op` string ET PAS de `kind` (les Conditions `compare`/… ont
 *  un `kind` et réutilisent la clé `op` pour un opérateur — jamais une GameOp). */
const isGameOp = (o: Record<string, unknown>): boolean => typeof o.op === 'string' && !('kind' in o);

interface Issue { file: string; path: string; detail: string }
interface Scan { parseErrors: Issue[]; unknownOps: Issue[]; badFormulas: Issue[]; badPlaceholders: Issue[]; strayImpureOps: Issue[] }

function walk(node: unknown, file: string, path: string, scan: Scan): void {
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, file, `${path}[${i}]`, scan)); return; }
  if (!node || typeof node !== 'object') return;
  const o = node as Record<string, unknown>;
  if (isGameOp(o)) {
    const op = o.op as string;
    // (2) vocabulaire — un opérateur de comparaison orphelin (sans kind) n'est pas une GameOp : on l'ignore.
    if (!KNOWN_OPS.has(op) && !COMPARE_OPS.has(op)) scan.unknownOps.push({ file, path, detail: `op inconnue : ${JSON.stringify(op)}` });
    if (KNOWN_OPS.has(op) && file !== MISCAST) {
      // (3) formules
      for (const ff of FORMULA_FIELDS) {
        if (!(ff in o)) continue;
        const v = o[ff];
        if (isTemplate(v, file, `${path}.${ff}`)) continue; // template de trait substitué par withArg
        if (!isValidFormula(v)) scan.badFormulas.push({ file, path: `${path}.${ff}`, detail: `Formule invalide (op '${op}') : ${JSON.stringify(v)}` });
      }
    }
  }
  // (4) placeholders — toute string $… hors template toléré.
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' && v.startsWith('$') && !isTemplate(v, file, `${path}.${k}`))
      scan.badPlaceholders.push({ file, path: `${path}.${k}`, detail: `placeholder $… non substitué : ${JSON.stringify(v)}` });
    // (6) flow pur — un champ `TriggeredEffect[]` du catalogue (effects/onHitEffects…) ne porte pas de
    // STRAY_IMPURE_OPS hors branche success/fail de test (cf. en-tête).
    if (TRIGGERED_EFFECT_FIELDS.has(k) && Array.isArray(v)) {
      v.forEach((te, i) => {
        if (te && typeof te === 'object' && 'flow' in te) {
          if (flowHasImpureOpOutsideTest(te.flow as Flow))
            scan.strayImpureOps.push({ file, path: `${path}.${k}[${i}].flow`, detail: `op impure (interruptFocus/breakBlade/delayed) HORS branche success/fail d'un test — avalée en silence par runPureFlowLines` });
        }
      });
    }
    walk(v, file, `${path}.${k}`, scan);
  }
}

const scan: Scan = { parseErrors: [], unknownOps: [], badFormulas: [], badPlaceholders: [], strayImpureOps: [] };
for (const f of files) {
  let data: unknown;
  try { data = JSON.parse(readFileSync(join(DIR, f), 'utf8')); }
  catch (e) { scan.parseErrors.push({ file: f, path: '', detail: (e as Error).message }); continue; }
  walk(data, f, '', scan);
}
const fmt = (issues: Issue[]) => issues.map((i) => `  ${i.file}${i.path} → ${i.detail}`).join('\n');

describe('Intégrité des données src/data/*.json', () => {
  it('extraction du vocabulaire GameOp depuis ops.ts (méta — non vide, ops phares présentes)', () => {
    expect(KNOWN_OPS.size).toBeGreaterThan(60);
    for (const op of ['wounds', 'condition', 'summon', 'grantTrait', 'narrative']) expect(KNOWN_OPS.has(op)).toBe(true);
  });
  it('1 — chaque .json parse', () => {
    expect(scan.parseErrors, `JSON malformé :\n${fmt(scan.parseErrors)}`).toEqual([]);
  });
  it('2 — toute op appartient au vocabulaire GameOp', () => {
    expect(scan.unknownOps, `Op(s) hors vocabulaire GameOp (typo ?) :\n${fmt(scan.unknownOps)}`).toEqual([]);
  });
  it('3 — tout champ Formula est une Formule valide (number fini OU objet à clé connue)', () => {
    expect(scan.badFormulas, `Formule(s) invalide(s) — une string ici planterait resolveFormula :\n${fmt(scan.badFormulas)}`).toEqual([]);
  });
  it("4 — aucune string $… non substituée (sauf template $arg/$indice dans les effects de traits.json / qualities.json)", () => {
    expect(scan.badPlaceholders, `Placeholder(s) $… qui fuiraient au runtime :\n${fmt(scan.badPlaceholders)}`).toEqual([]);
  });
  it("4bis — le périmètre de template est PAR FICHIER : `$arg` dans une qualité est un placeholder (contre-épreuve)", () => {
    const probe = (file: string, gabarit: string) => {
      const s: Scan = { parseErrors: [], unknownOps: [], badFormulas: [], badPlaceholders: [], strayImpureOps: [] };
      walk({ effects: [{ trigger: 'onCrit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'a-terre', durationRounds: gabarit }] } } }] }, file, '', s);
      return s.badPlaceholders;
    };
    expect(probe('traits.json', '$arg'), 'un Trait porte un `$arg` : `withArg` le substitue.').toEqual([]);
    expect(probe('traits.json', '$indice'), 'un Trait porte un `$indice`.').toEqual([]);
    expect(probe('qualities.json', '$indice'), 'une qualité porte son Indice (`AA 08 l.87`).').toEqual([]);
    expect(
      probe('qualities.json', '$arg'),
      '`$arg` toléré dans une qualité : la branche QUALITÉ passe `arg: undefined`, il serait DROPPÉ en silence.',
    ).toHaveLength(1);
    expect(probe('spells.json', '$indice'), 'un template hors des deux fichiers porteurs doit rester un placeholder.').toHaveLength(1);
  });
  it("6 — extraction des champs TriggeredEffect[] depuis data/index.ts (méta — non vide, effects/onHitEffects présents)", () => {
    expect(TRIGGERED_EFFECT_FIELDS.size).toBeGreaterThan(0);
    for (const field of ['effects', 'onHitEffects']) expect(TRIGGERED_EFFECT_FIELDS.has(field)).toBe(true);
  });
  it("6bis — aucun flow d'effet DÉCLENCHÉ ne porte d'op impure hors branche success/fail d'un test", () => {
    expect(scan.strayImpureOps, `Op(s) impure(s) inexprimable(s) hors test :\n${fmt(scan.strayImpureOps)}`).toEqual([]);
  });
  it('7 — species.json : family non vide sur chaque espèce (groupage du rail créateur — remplace la regex sur label)', () => {
    const species = JSON.parse(readFileSync(join(DIR, 'species.json'), 'utf8')) as { id: string; family?: string }[];
    const missing = species.filter((s) => typeof s.family !== 'string' || !s.family.trim()).map((s) => s.id);
    expect(missing, `Espèce(s) sans family :\n  ${missing.join('\n  ')}`).toEqual([]);
  });
  it("8 — activities.json : chaque Activité porte une icône du registre (ActivityDef.icon ∈ ICON_DEFS)", () => {
    const activities = JSON.parse(readFileSync(join(DIR, 'activities.json'), 'utf8')) as { id: string; icon?: string }[];
    const bad = activities.filter((a) => typeof a.icon !== 'string' || !(a.icon in ICON_DEFS)).map((a) => `${a.id} → ${JSON.stringify(a.icon)}`);
    expect(bad, `Activité(s) sans icône du registre (src/ui/icons) :\n  ${bad.join('\n  ')}`).toEqual([]);
  });
  it("9 — actions.json : id unique, icône du registre, règle liée à une catégorie (registre des actions, spec HUD zone 12)", () => {
    const actions = JSON.parse(readFileSync(join(DIR, 'actions.json'), 'utf8')) as {
      id: string; icon?: string; rule?: string; ruleCategory?: string;
    }[];
    const badIcon = actions.filter((a) => typeof a.icon !== 'string' || !(a.icon in ICON_DEFS)).map((a) => `${a.id} → ${JSON.stringify(a.icon)}`);
    expect(badIcon, `Action(s) sans icône du registre (src/ui/icons) :\n  ${badIcon.join('\n  ')}`).toEqual([]);
    const seen = new Set<string>();
    const dupes = actions.filter((a) => (seen.has(a.id) ? true : (seen.add(a.id), false))).map((a) => a.id);
    expect(dupes, `Id(s) d'action en double :\n  ${dupes.join('\n  ')}`).toEqual([]);
    const orphanRule = actions.filter((a) => !!a.rule !== !!a.ruleCategory).map((a) => a.id);
    expect(orphanRule, `Action(s) dont rule et ruleCategory ne vont pas ensemble :\n  ${orphanRule.join('\n  ')}`).toEqual([]);
  });
});

/**
 * Une qualité qui DÉCLARE un Indice (`QualityData.indice`) l'EXIGE sur chacune de ses références.
 * L'Indice est le paramètre de l'effet authoré : `effectSourcesOf` passe `withArg(effects, undefined,
 * indice)`, et un `$indice` non substitué rend le nœud porteur inerte — le 2ᵉ Hémorragique de Taillade
 * n'est jamais offert (`AA 08 l.87`), en silence. Le silence RUNTIME reste la 2ᵉ ligne
 * (`state/combat/triggeredTest.ts::resolveFlowChoice`, coût resté template → branche `no`) ; ici, la
 * donnée est refusée AVANT.
 *
 * RÈGLE UNIFORME, sans exception par id : la porte est « la qualité déclare `indice` », pas « la qualité
 * s'appelle Taillade ». Elle vaut donc aussi pour `solide` (qui déclare `indice` sans unité) — au relevé,
 * les DEUX populations sont déjà conformes, la garde ne migre rien, elle empêche la régression.
 *
 * PÉRIMÈTRE : les deux racines AUTHORÉES en JSON — `src/data/*.json` (catalogue `trappings.json`, armes
 * embarquées de `creatures.json`) et les documents de `src/scenes`. ANGLE MORT nommé : les scénarios de
 * test écrits en TS (`src/scenes/test-scenarios/*.ts`) ne sont pas parsés ici — le même trou d'entrée que
 * `scenarios-contrat.test.ts` couvre par ailleurs.
 */
describe('Indice d’Atout — une qualité qui déclare `indice` l’exige sur CHAQUE référence', () => {
  const SCENES_DIR = fileURLToPath(new URL('../scenes', import.meta.url));
  const jsonSous = (dir: string): string[] =>
    listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => join(dir, rel));
  const racines = [...files.map((f) => join(DIR, f)), ...jsonSous(SCENES_DIR)];

  /** Ids des qualités qui DÉCLARENT un Indice — lus de la donnée, jamais listés à la main. */
  const indices = new Set(
    (JSON.parse(readFileSync(join(DIR, 'qualities.json'), 'utf8')) as { id: string; indice?: unknown }[])
      .filter((q) => q.indice).map((q) => q.id),
  );

  /** Toute réf d'Atout posée sous une clé `qualities` des deux racines, avec son chemin. */
  const refs: { site: string; ref: Record<string, unknown> }[] = [];
  for (const f of racines) {
    let data: unknown;
    try { data = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    const rel = f.slice(f.lastIndexOf('src')).replace(/\\/g, '/');
    const visite = (n: unknown, path: string): void => {
      if (Array.isArray(n)) return n.forEach((v, i) => visite(v, `${path}[${i}]`));
      if (!n || typeof n !== 'object') return;
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        if (k === 'qualities' && Array.isArray(v))
          v.forEach((q, i) => { if (q && typeof q === 'object') refs.push({ site: `${rel}${path}.qualities[${i}]`, ref: q as Record<string, unknown> }); });
        visite(v, `${path}.${k}`);
      }
    };
    visite(data, '');
  }

  it('le scan VOIT les deux populations qu’il prétend garder (sinon un vert vide passerait)', () => {
    expect(indices.size, 'aucune qualité ne déclare d’Indice : la garde ne mesure plus rien.').toBeGreaterThan(0);
    expect(refs.length, 'aucune référence d’Atout trouvée dans les deux racines authorées.').toBeGreaterThan(100);
    expect(refs.filter((r) => indices.has(r.ref.id as string)).length, 'aucune référence vers une qualité INDICÉE.').toBeGreaterThan(0);
  });

  it('aucune référence vers une qualité INDICÉE sans `value` — le manque est NOMMÉ à son site', () => {
    const nus = refs
      .filter((r) => indices.has(r.ref.id as string) && typeof r.ref.value !== 'number')
      .map((r) => `${r.site} → ${JSON.stringify(r.ref)}`);
    expect(
      nus,
      'Référence(s) vers une qualité qui DÉCLARE un Indice, posée(s) SANS `value` — son effet authoré resterait ' +
        `inerte au runtime (template non substitué) :\n  ${nus.join('\n  ')}`,
    ).toEqual([]);
  });
});

/**
 * Un État PORTÉ par un canal passif (op `condition` dans `passive`/`passiveBySeverity`/`visiblePassive`)
 * peut venir de N'IMPORTE quel porteur : ce qu'une dépense de Détermination y fait est dit par l'OP
 * elle-même (`resolveWindow`), plus par un drapeau de son porteur. Ce que cette garde tient encore :
 * chaque op porteuse doit déclarer une fenêtre DÉCLARABLE — `'none'` (refus, LDB 20 l.188), une durée
 * authorée (LDB 20 l.170), ou RIEN, auquel cas le défaut de LDB 16 l.117 (un Round) s'applique.
 */
describe('États portés par un canal PASSIF — la fenêtre de Détermination est DÉCLARABLE (#1599)', () => {
  // Tout canal PASSIF, quel que soit le schéma qui le déclare (`passive`, `passiveBySeverity`,
  // `visiblePassive`, `infectionPassive`…) : la garde se lie à la NOMENCLATURE, pas à une liste qu'un
  // canal neuf laisserait derrière elle.
  const estCanalPassif = (cle: string): boolean => /passive/i.test(cle);
  /** Chaque op `condition` trouvée sous un canal passif : fichier, id de l'entrée, État porté, fenêtre. */
  const porteurs: { file: string; id: string; cond: string; window: unknown }[] = [];
  const marche = (node: unknown, file: string, entree: string | undefined): void => {
    if (Array.isArray(node)) { node.forEach((n) => marche(n, file, entree)); return; }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : entree;
    for (const [k, v] of Object.entries(obj)) {
      if (estCanalPassif(k)) {
        const listes: unknown[] = Array.isArray(v) ? [v] : v && typeof v === 'object' ? Object.values(v) : [];
        for (const ops of listes) {
          if (!Array.isArray(ops)) continue;
          for (const op of ops) {
            if ((op as Record<string, unknown>)?.op === 'condition') porteurs.push({ file, id: id ?? '?', cond: String((op as Record<string, unknown>).id), window: (op as Record<string, unknown>).resolveWindow });
          }
        }
      }
      marche(v, file, id);
    }
  };
  for (const f of files) {
    try { marche(JSON.parse(readFileSync(join(DIR, f), 'utf8')), f, undefined); } catch { /* parse déjà rapporté plus haut */ }
  }

  it('chaque op porteuse déclare une fenêtre de Détermination DÉCLARABLE (ou aucune = défaut l.117)', () => {
    const declarable = (w: unknown): boolean =>
      w === undefined || w === 'none'
      || (!!w && typeof w === 'object'
        && ((w as Record<string, unknown>).scale === 'rounds' ? isValidFormula((w as Record<string, unknown>).left)
          : (w as Record<string, unknown>).scale === 'clock' && isValidFormula((w as Record<string, unknown>).minutes)));
    const fautifs = porteurs
      .filter((p) => !declarable(p.window))
      .map((p) => `${p.file} › ${p.id} porte l'État « ${p.cond} » avec une fenêtre illisible : ${JSON.stringify(p.window)} — attendu « none », {scale:'rounds',left:Formula}, {scale:'clock',minutes:Formula}, ou rien (LDB 16 l.117).`);
    expect(fautifs, 'fenêtre de Détermination non déclarable').toEqual([]);
  });

  it('le scan VOIT les porteurs du RAW (Fièvre Grave l.170 → Inconscient, Malaise l.188 → Exténué)', () => {
    const vus = porteurs.filter((p) => p.file === 'symptoms.json').map((p) => `${p.id}→${p.cond}`).sort();
    expect(vus).toEqual(['fievre→inconscient', 'malaise→extenue']);
    expect(porteurs.find((p) => p.id === 'malaise')!.window, 'le verrou de l.188 n’est plus en donnée').toBe('none');
    expect(porteurs.find((p) => p.id === 'fievre')!.window).toEqual({ scale: 'clock', minutes: { rule: 'maladie-conscience-determination-minutes' } });
  });

  /**
   * Le moteur ne CHOISIT pas entre deux fenêtres : `fenetreDetermination` lit l'op porteuse trouvée
   * (`opPorteuseDEtat`, engine/conditions.ts) — la PREMIÈRE. Deux ops `condition` d'une MÊME entité qui
   * portent le MÊME État avec des fenêtres DIFFÉRENTES rendraient donc le verdict dépendant de l'ordre
   * des canaux dans le JSON. La donnée ne peut pas diverger : c'est ICI que ça se refuse, nominativement.
   */
  it('deux ops porteuses du MÊME État dans la MÊME entité déclarent la MÊME fenêtre', () => {
    const parCle = new Map<string, { p: (typeof porteurs)[number]; fenetres: Set<string> }>();
    for (const p of porteurs) {
      const cle = `${p.file} ${p.id} ${p.cond}`;
      const vu = parCle.get(cle) ?? { p, fenetres: new Set<string>() };
      vu.fenetres.add(JSON.stringify(p.window ?? null));
      parCle.set(cle, vu);
    }
    const fautifs = [...parCle.values()]
      .filter((v) => v.fenetres.size > 1)
      .map((v) => `${v.p.file} › ${v.p.id} porte l'État « ${v.p.cond} » avec ${v.fenetres.size} fenêtres de Détermination DIFFÉRENTES (${[...v.fenetres].join(' vs ')}) — la fenêtre lue dépendrait de l'ordre des canaux passifs.`);
    expect(fautifs, 'fenêtre de Détermination divergente pour un même État').toEqual([]);
  });
});

/**
 * Terme `{rule}` d'une `Formula` (`engine/ops.ts`) : la quantité vient du registre des règles
 * optionnelles. Aucun schéma ne lit un registre — c'est donc ICI que l'id est tenu : il doit exister
 * ET porter une valeur NUMÉRIQUE (`kind: 'param'`), sans quoi `resolveFormula` rendrait 0 en silence.
 */
describe('terme `{rule}` d’une Formula — l’id résout dans le registre des règles optionnelles (#1599)', () => {
  // La MÊME graphie `{rule:'<id>'}` sert déjà de GATE de variante (`variants[].when`, `data/index.ts`),
  // où toute forme de règle est légitime (interrupteur, mode). Le terme de Formula, lui, vit sous une
  // `GameOp` et se RÉSOUT en nombre : c'est ce SITE qui exige une règle `param`.
  const termes: { file: string; id: string; dansOp: boolean }[] = [];
  const marche = (node: unknown, file: string, dansOp: boolean): void => {
    if (Array.isArray(node)) { node.forEach((n) => marche(n, file, dansOp)); return; }
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const sousOp = dansOp || typeof obj.op === 'string';
    if (typeof obj.rule === 'string' && Object.keys(obj).length === 1) termes.push({ file, id: obj.rule, dansOp: sousOp });
    for (const v of Object.values(obj)) marche(v, file, sousOp);
  };
  for (const f of files) {
    try { marche(JSON.parse(readFileSync(join(DIR, f), 'utf8')), f, false); } catch { /* parse déjà rapporté plus haut */ }
  }

  it('le scan VOIT les deux populations (gate de variante ET terme de Formula)', () => {
    expect(termes.length, 'aucun `{rule}` trouvé : la garde ne mesure rien').toBeGreaterThan(0);
    expect(termes.filter((t) => t.dansOp).length, 'aucun terme `{rule}` sous une op').toBeGreaterThan(0);
  });

  it('chaque `{rule}` authoré vise une règle EXISTANTE ; sous une op, elle est NUMÉRIQUE', () => {
    const fautifs = termes
      .filter(({ id, dansOp }) => (dansOp ? ruleDef(id)?.kind !== 'param' : !ruleDef(id)))
      .map(({ file, id, dansOp }) => `${file} : {rule:'${id}'} — ${dansOp ? "sous une op : règle inconnue ou non numérique (kind='param' attendu)" : 'règle inconnue'} (reglesOptionnelles.json).`);
    expect(fautifs, 'terme `{rule}` qui ne résout pas').toEqual([]);
  });
});
