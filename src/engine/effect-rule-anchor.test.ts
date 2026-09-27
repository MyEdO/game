import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import type { Combatant } from './types';
import { applyOps } from './ops';

/**
 * GARDE DE CLASSE — tout `ActiveEffect` posé doit porter un ANCRAGE DE RÈGLE.
 *
 * Une pastille d'effet n'informe le joueur que si elle est reliée à une règle (arbitrage user
 * 2026-07-18) : `chipCodex` (`src/gameIso/effectIcons.ts`) résout par id STABLE — `sourceSpellId`
 * (sort/prière source) ou `effectId` (identité de l'effet) — et ne fabrique AUCUN repli. Un effet
 * posé sans l'un des deux s'affiche donc NU : icône + libellé, sans fiche ni popover.
 *
 * L'ancrage est stampé par `applyOps` sur TOUT effet qu'il pose (`src/engine/ops.ts`, post-passe
 * `ctx.sourceSpell`/`ctx.sourceSpellId`/`ctx.effectId`) : c'est donc l'`OpsCtx` du CALLSITE qui
 * décide. Cette garde énumère les callsites `applyOps` dont les ops peuvent poser un effet actif et
 * dont le ctx n'apporte aucun ancrage.
 *
 * BASELINE : 21 callsites résiduels, listés NOMMÉMENT ci-dessous avec leur déclencheur (43 au relevé
 * initial du 2026-07-18 : les sorts, les activités de mer/voyage et TOUS les effets déclenchés — traits,
 * talents, qualités, symptômes, États, psychologie, via `effectSourcesOf` — sont désormais ancrés). La
 * garde échoue sur toute NOUVELLE source non ancrée, et AUSSI quand un callsite listé a été ancré sans
 * être ôté de la liste : la baseline ne peut que DÉCROÎTRE.
 *
 * Identité d'un callsite = CLÉ DE CONTENU `rel | ops | ctx` (fichier sans numéro de ligne, expressions
 * `ops`/`ctx` normalisées non tronquées) — PAS `fichier:ligne` : un décalage de lignes ailleurs dans le
 * fichier ne doit pas désynchroniser la baseline. Le numéro de ligne (`at`) ne sert qu'à l'AFFICHAGE.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));

/** Les seuls porteurs d'ancrage reconnus par la post-passe d'`applyOps` (ops.ts). `source` est l'ancrage
 *  GÉNÉRAL (toute entité) ; `sourceSpellId`/`effectId` restent les canaux spécifiques préexistants. */
const ANCHOR = /\bsource\b|sourceSpellId|effectId|sourceSpell\b/;

/** Un `OpsCtx` RELAYÉ depuis l'appelant — le site n'est pas l'origine de l'effet, il ne peut pas l'ancrer.
 *  `imbrique(…)` est LA dérivation du ctx relayé pour les ops imbriquées (`engine/ops.ts`, un seul site
 *  de définition) : elle n'ôte que le drapeau de rejeu, l'ancrage y descend intact. */
const FORWARDED = /\bctx\b|Ctx\b|\binner\b|\bimbrique\(/;

/** Arguments de premier niveau d'un appel dont `(` commence à `open` — chaînes et imbrications sautées. */
function callArgs(src: string, open: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = open + 1;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { out.push(src.slice(cur, j)); return out; }
    } else if (ch === ',' && depth === 1) { out.push(src.slice(cur, j)); cur = j + 1; }
    else if (ch === '"' || ch === "'" || ch === '`') {
      const q = ch;
      j++;
      while (j < src.length && src[j] !== q) { if (src[j] === '\\') j++; j++; }
    }
  }
  return out;
}

/** Kinds de `GameOp` dont le corps pose un `ActiveEffect` — LU dans le switch d'`applyOps`, jamais
 *  recopié à la main (une op posante ajoutée demain entre d'elle-même dans le périmètre). */
function postingKinds(): Set<string> {
  const lines = readFileSync(join(SRC, 'engine/ops.ts'), 'utf8').split('\n');
  const posts = new Set<string>();
  let pending: string[] = [];
  let body: string[] = [];
  const flush = () => {
    if (pending.length && body.some((l) => /activeEffects\.push|applyActiveEffect\(|pushPerRound\(/.test(l))) {
      for (const k of pending) posts.add(k);
    }
  };
  for (const l of lines) {
    const m = l.match(/^\s*case '([a-zA-Z0-9_-]+)':\s*\{?\s*$/);
    if (m) {
      if (body.length) { flush(); pending = []; body = []; }
      pending.push(m[1]);
      continue;
    }
    if (pending.length) body.push(l);
  }
  flush();
  return posts;
}

interface Callsite { at: string; key: string; opsDisp: string; ctxDisp: string; }

function unanchoredCallsites(): Callsite[] {
  const posts = postingKinds();
  const found: Callsite[] = [];
  for (const { rel: relDepot, text: src } of readCorpus(['src'])) {
    // La CLÉ de la baseline est relative à `src/` (`engine/ops.ts`), pas à la racine du dépôt.
    const rel = relDepot.slice('src/'.length);
    let idx = 0;
    while ((idx = src.indexOf('applyOps(', idx)) >= 0) {
      const open = idx + 'applyOps'.length;
      // La DÉCLARATION d'`applyOps` n'est pas un appel.
      if (/\b(function|const|export)\s*$/.test(src.slice(Math.max(0, idx - 20), idx))) { idx = open; continue; }
      const [, opsArg = '', ctxArg = ''] = callArgs(src, open);
      const ops = opsArg.trim();
      const ctx = ctxArg.trim();
      idx = open;
      if (ANCHOR.test(ctx)) continue;
      // Ctx TRANSMIS par l'appelant (`ctx`, `{...ctx}`, `leafOpsCtx(ctx, …)`, `inner`) : l'ancrage est
      // celui du site D'ORIGINE — imputer le trou ici désignerait le facteur, pas l'expéditeur.
      if (FORWARDED.test(ctx)) continue;
      // Ops LITTÉRALES : on décide sur leurs kinds ; ops opaques (`e.ops`, variable) : conservateur.
      const kinds = [...ops.matchAll(/\bop:\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
      if (/^\[/.test(ops) && kinds.length) {
        // `condition` ne pose un effet actif que sous `perRound` — sinon c'est un État, déjà ancré
        // par son propre catalogue (`chipCodex` route un malus par `condId`).
        const posting = kinds.some((k) => (k === 'condition' ? /perRound/.test(ops) : posts.has(k)));
        if (!posting) continue;
      }
      const line = src.slice(0, idx).split('\n').length;
      const opsNorm = ops.replace(/\s+/g, ' ').trim();
      const ctxNorm = ctx.replace(/\s+/g, ' ').trim();
      found.push({
        at: `src/${rel}:${line}`,
        key: `${rel} | ${opsNorm} | ${ctxNorm}`,
        opsDisp: opsNorm.slice(0, 60),
        ctxDisp: ctxNorm.slice(0, 60),
      });
    }
  }
  return found;
}

/**
 * Stock connu au 2026-07-18 — chaque entrée est un effet actif potentiellement affiché NU au joueur.
 * Le déclencheur est nommé pour que le trou se comble, pas qu'il se compte. Cette liste ne peut que
 * décroître : ancrer un callsite (poser `effectId`/`sourceSpellId` sur son `OpsCtx`) impose de l'ôter d'ici.
 */
const BASELINE: string[] = [
  "engine/domainAttributes.ts | ops | { rng, label: 'Attribut de domaine' }", // ops d'un Attribut de domaine de magie
  'engine/shipCritical.ts | ops | { rng, hull }', // conséquence du coup à l'équipage d'un critique de navire (branche d'échec du nœud, ou ops certaines) ; la COQUE entre au contexte depuis #1657 B3-2b-c (la hauteur de chute se lit par sa Taille, MDG 13 l.684)
  'engine/shipCritical.ts | crit.ops | { rng }', // ops d'un critique de navire
  'engine/shipCritical.ts | crit.ops | { rng, crew }', // ops d'un critique de navire (équipage)
  'engine/shipCritical.ts | set.shrapnelHit! | { rng }', // éclats d'un critique de navire (le `!` tient l'anomalie NOMMÉE juste au-dessus : un jeu sans `shrapnelHit` ne peut pas porter d'Éclats)
  'engine/shipCritical.ts | extra.ops | { rng }', // ops d'un critique de navire supplémentaire
  'state/aiSpellValue.ts | [op] | { caster: c, rng: STATIC_RNG }', // simulation d'IA sur un CLONE — jamais affichée au joueur
  'state/combatEffects.ts | e.ops | { rng: battleRng() }', // ops d'un Souffle de zone (effet de scène)
  'state/combatFlow.ts | crit.ops | { rng: battleRng(), now: get().gameTime, location: loc }', // ops d'une Blessure critique en combat
  'state/combatFlow.ts | outcome.ops | { rng: battleRng() }', // ops de l'issue d'une manœuvre
  'state/interludeFlow.ts | ops | { rng: battleRng(), now: get().gameTime }', // issues DIFFÉRÉES à la clôture d'un interlude
  'state/medicFlow.ts | penalty | { rng: battleRng(), now, defaultUntilTime: now + d10(battleRng()) * 24 * 60 }', // pénalité posée par un soin raté
  'state/seaVoyageFlow.ts | p.scaldOps | { rng: battleRng(), now: get().gameTime }', // brûlure de vapeur (scaldOps) d'une pièce de machine
  "state/seaVoyageFlow.ts | [{ op: 'grantTalent', talent: { id: 'chanceux' } }] | { label: event.label, rng, defaultUntilTime: until }", // Talent Chanceux octroyé par un événement de bord
  "state/seaVoyageFlow.ts | [ { op: 'skillDRBonus', skill: { id: 'focalisation' }, bonus: 2 }, { op: 'skillDRBonus', skill: { id: 'guerison' }, bonus: 2 }, { op: 'skillDRBonus', skill: { id: 'resistance' }, bonus: 2 }, ] | { label: event.label, rng, defaultUntilTime: until }", // bonus de DR octroyés par un événement de bord
  'state/travelFlow.ts | r.entry.occupantOps | { rng: battleRng() }', // ops subies par l'occupant d'une rencontre de voyage
  'state/travelPostes.ts | [op] | ', // Exténué du Test de résistance de traversée (État : ancré par son condId)
  // #1279 S1 — EFFETS PAR MANCHE d'une séquence : les ops viennent de la DONNÉE de l'entrée qui joue
  // (`SequenceParams.rounds`), pas du socle, qui ne peut donc pas les ancrer lui-même. Aujourd'hui
  // seule la taverne en déclare (+1 Avantage au vainqueur de manche, +1 Exténué d'attrition — NADJ 16
  // l.34-35) : aucune ne pose d'`ActiveEffect`, et l'État est ancré par son `condId`. L'ancrage propre
  // est une DÉCLARATION à ajouter à l'entrée de données (les jeux de taverne n'ont pas d'entrée Codex
  // à viser à ce jour) — les deux lignes s'ôtent d'ici le jour où elle existe.
  'state/sequenceCore.ts | [...decl.winner] | { caster: c }', // ops de manche au vainqueur de la manche
  'state/sequenceCore.ts | [...decl.attrition] | { caster: c }', // ops d'attrition d'intervalle
  'state/zones.ts | z.onCross | { caster: resolveCaster(z.casterId), rng, label: z.label }', // ops de franchissement d'une zone d'effet
  'state/zones.ts | z.perRound | { caster, rng, label: z.label }', // ops récurrentes d'une zone d'effet
];

describe('ancrage de règle des ActiveEffect posés', () => {
  it('les kinds posants sont LUS dans le switch d’applyOps (le périmètre suit le moteur)', () => {
    const posts = postingKinds();
    // Témoins : `charMod` pose un effet actif temporisé, `wounds` non (dégâts immédiats).
    expect(posts.has('charMod')).toBe(true);
    expect(posts.has('perRound')).toBe(true);
    expect(posts.has('wounds')).toBe(false);
  });

  it('applyOps stampe l’ENTITÉ SOURCE du ctx sur les effets qu’il pose (ancrage général)', () => {
    const target = { id: 'c', name: 'C', characteristics: {}, conditions: [], activeEffects: [], wounds: { current: 10, max: 10, base: 10 } } as unknown as Combatant;
    applyOps(target, [{ op: 'charMod', char: 'force', mod: 10 }], {
      label: 'Force du taureau', source: { kind: 'spell', id: 'benediction-de-puissance' },
    });
    expect(target.activeEffects?.[0].source).toEqual({ kind: 'spell', id: 'benediction-de-puissance' });
  });

  it('aucune NOUVELLE source d’effet actif sans ancrage de règle (source / sourceSpellId / effectId)', () => {
    const nouveaux = unanchoredCallsites().filter((c) => !BASELINE.includes(c.key));
    expect(
      nouveaux.map((c) => `${c.at}  ops=${c.opsDisp}  ctx=${c.ctxDisp}`),
      'un effet actif posé sans ancrage s’affiche NU (ni fiche, ni popover) : passer `effectId` (ou '
        + '`sourceSpellId`) dans l’OpsCtx de ces callsites, et relier l’id à une entrée de catalogue',
    ).toEqual([]);
  });

  it('la baseline DÉCROÎT : aucun callsite listé n’a été ancré sans être ôté de la liste', () => {
    const keys = new Set(unanchoredCallsites().map((c) => c.key));
    const perimes = BASELINE.filter((k) => !keys.has(k));
    expect(
      perimes,
      'ce callsite n’existe plus (ancré, supprimé, ou son contenu ops/ctx a changé) : ôter de BASELINE',
    ).toEqual([]);
  });

  it('les clés de contenu des callsites sont UNIQUES', () => {
    const all = unanchoredCallsites().map((c) => c.key);
    expect(
      all.length,
      'deux callsites partagent la même clé de contenu (rel|ops|ctx) — la BASELINE ne peut plus les '
        + 'distinguer ; enrichir la clé',
    ).toBe(new Set(all).size);
  });
});
