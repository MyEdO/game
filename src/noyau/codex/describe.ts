/**
 * Couche `describe` du Codex — projette les données MÉCANIQUES d'une fiche (modificateurs passifs,
 * profil de manœuvre, effets déclenchés) en `CodexSection` lisibles. SOURCE UNIQUE réutilisée par
 * toutes les catégories porteuses (traits, mutations, qualités…) : enrichir une fiche = composer ces
 * sections, pas réécrire un rendu. Réutilise `opRows` (ref #495, renderer JOUEUR — chips codex-liées,
 * jamais le résumeur d'atelier `opSummary`), `humanizeCondition` (ref #495, renderer JOUEUR — jamais
 * le résumeur d'atelier `condSummary`).
 */
import type { CodexRow, CodexSection } from './registry';
import { opRows } from './opRows';
import type { GameOp } from '../../engine/ops';
import type { Flow, TriggeredEffect } from '../../data/schemas/defs-scenes/effets';
import type { EtatDeclare } from '../../data/schemas/defs-scenes/formes-d-etat';
import { walkFlow } from '../../engine/flowCore';
import { refLabel } from '../../data';
import { statName } from '../../engine/statEntry';
import { onLabel } from './triggerLabels';
import { effectTriggerSchema } from '../../data/schemas/grammaire/mecanique';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { t } from '../../i18n';
import { humanizeFlowSentence, humanizeOp, humanizeCondition, coutAvantageTexte, flowMuet } from './humanize';

/** Octrois de carrière (`grantCareerSkill`/`grantCareerTalent`) — affichés à part (cross-réf cliquable),
 *  jamais comme « modificateur continu ». Filtrés ici pour ne pas doublonner avec `careerGrantSection`. */
const CAREER_GRANT_OPS = new Set<GameOp['op']>(['grantCareerSkill', 'grantCareerTalent']);

/** Modificateurs PASSIFS continus (`GameOp[]`) → section lisible (« +5 F », « −20 aux Tests de Soc »…).
 *  Les octrois de carrière (compétence/talent ajouté à toute carrière) sont EXCLUS → `careerGrantSection`. */
export function passiveSection(ops: GameOp[] | undefined, title: string = t('codex.describe.modificateursPassifs')): CodexSection | null {
  const mods = (ops ?? []).filter((o) => !CAREER_GRANT_OPS.has(o.op));
  if (!mods.length) return null;
  return { title, layout: 'list', rows: opRows(mods) };
}

/** Compétence/Talent ajouté à « n'importe quelle Carrière » (LDB 10, ops `grantCareerSkill`/
 *  `grantCareerTalent`) → chips CROSS-RÉF cliquables (id → libellé ; le lookup ignore la spec « Au choix »
 *  via `statName`). Source unique de la projection des octrois de carrière (talents Maître artisan, Flagellant…). */
export function careerGrantSection(ops: GameOp[] | undefined, title: string = t('codex.describe.ajouteAVosCarrieres')): CodexSection | null {
  const rows: CodexRow[] = (ops ?? []).flatMap((o): CodexRow[] => {
    if (o.op === 'grantCareerSkill') { const l = refLabel('skills', o.skill); return [{ t: 'ref', category: 'skills', id: o.skill.id, label: statName(l), show: l }]; }
    if (o.op === 'grantCareerTalent') { const l = refLabel('talents', o.talent); return [{ t: 'ref', category: 'talents', id: o.talent.id, label: statName(l), show: l }]; }
    return [];
  });
  return rows.length ? { title, layout: 'chips', rows } : null;
}

/** Résumé LISIBLE d'un Flow d'effet (conditions `if` + ops `do`, jet `test`) — réutilise
 *  `humanizeCondition`/`humanizeOp` (registre JOUEUR). Le Test (SIMPLE ou OPPOSÉ) n'est PLUS une op :
 *  c'est un nœud de STRUCTURE Flow (`{kind:'test'}`) décrit ci-dessous (zéro vocabulaire dupliqué). */
function flowSummary(f: Flow, etats: readonly EtatDeclare[]): string {
  switch (f.kind) {
    case 'do': return f.effect.type === 'ops' ? f.effect.ops.map(humanizeOp).join(', ') : f.effect.type;
    case 'seq': return f.steps.map((s) => flowSummary(s, etats)).filter(Boolean).join(' ; ');
    case 'if': {
      const base = t('codex.tech.si', { cond: humanizeCondition(f.cond, etats), alors: flowSummary(f.then, etats) });
      return f.else ? `${base}${t('codex.tech.sinon', { sinon: flowSummary(f.else, etats) })}` : base;
    }
    case 'test': {
      const sujet = f.test.skill ? refLabel('skills', f.test.skill) : (f.test.characteristic ?? '');
      const oppose = f.test.opposed ? t('codex.tech.oppose', { attaquant: f.test.opposed.attackerLabel ?? f.test.opposed.attacker }) : '';
      return t('codex.tech.jet', { oppose, sujet, ok: flowSummary(f.success, etats), ko: flowSummary(f.fail, etats) });
    }
    case 'choice': {
      const cout = coutAvantageTexte(f.advantageCost);
      return t('codex.tech.choix', {
        cout: cout ? t('codex.tech.choix.cout', { cout }) : '',
        prompt: f.prompt,
        oui: flowSummary(f.yes, etats),
        non: flowMuet(f.no) ? '' : t('codex.tech.choix.non', { non: flowSummary(f.no!, etats) }),
      });
    }
  }
}

/** Effets DÉCLENCHÉS (`TriggeredEffect[]`) → déclencheur + cible, PUIS la phrase JOUEUR (`humanize`) de ce
 *  que l'effet fait, avec la forme TECHNIQUE d'atelier (`flowSummary`) repliée dans « Détail technique ». */
const effectRows = (effects: TriggeredEffect[] | undefined, etats: readonly EtatDeclare[]): CodexRow[] =>
  (effects ?? []).flatMap((e) => {
    const head = `${libelleDeValeur(effectTriggerSchema, e.trigger)} — ${onLabel(e.on)}`;
    const human = humanizeFlowSentence(e.flow, etats);
    const tech = flowSummary(e.flow, etats);
    const rows: CodexRow[] = [
      { t: 'sub', label: head },
      { t: 'text', text: human || t('codex.describe.aucunEffet') },
    ];
    if (tech) rows.push({ t: 'fold', summary: t('codex.describe.detailTechnique'), text: tech });
    return rows;
  });

export function effectsSection(effects: TriggeredEffect[] | undefined, etats: readonly EtatDeclare[], title: string = t('codex.describe.effetsDeclenches')): CodexSection | null {
  const rows = effectRows(effects, etats);
  return rows.length ? { title, layout: 'list', rows } : null;
}

/** Un `rollTable` se cache-t-il quelque part dans le Flow (n'importe quelle branche `do`) ? Réutilise le
 *  walker générique `walkFlow` (ref #540) — jauge s'il y a une table à EXPANSER en rangées lisibles. */
const flowHasRollTable = (f: Flow): boolean => {
  let found = false;
  walkFlow(f, (n) => {
    if (n.kind === 'do' && n.effect.type === 'ops' && n.effect.ops.some((o) => o.op === 'rollTable')) found = true;
  });
  return found;
};

/** Rangées structurées (chips codex-liées, tables `rollTable` EXPANSÉES) d'un Flow, branche par branche —
 *  ref #540 : seul canal de rendu Flow qui expose le CONTENU d'une table (le reste tient déjà dans la
 *  phrase humanisée `humanizeFlowSentence`, jamais dupliqué en chips pour les branches sans table). */
function flowOpRows(f: Flow, etats: readonly EtatDeclare[]): CodexRow[] {
  switch (f.kind) {
    case 'do':
      return f.effect.type === 'ops' ? opRows(f.effect.ops) : [];
    case 'seq':
      return f.steps.flatMap((s) => flowOpRows(s, etats));
    case 'if': {
      const rows: CodexRow[] = [];
      const then = flowOpRows(f.then, etats);
      if (then.length) rows.push({ t: 'sub', label: t('codex.describe.si', { v: humanizeCondition(f.cond, etats) }) }, ...then);
      if (f.else) {
        const els = flowOpRows(f.else, etats);
        if (els.length) rows.push({ t: 'sub', label: t('codex.describe.sinon') }, ...els);
      }
      return rows;
    }
    case 'test': {
      const rows: CodexRow[] = [];
      const succ = flowOpRows(f.success, etats);
      if (succ.length) rows.push({ t: 'sub', label: t('codex.describe.reussite') }, ...succ);
      const fail = flowOpRows(f.fail, etats);
      if (fail.length) rows.push({ t: 'sub', label: t('codex.describe.echec') }, ...fail);
      return rows;
    }
    case 'choice': {
      const rows: CodexRow[] = [];
      const yes = flowOpRows(f.yes, etats);
      if (yes.length) rows.push({ t: 'sub', label: t('codex.describe.oui') }, ...yes);
      if (f.no) {
        const no = flowOpRows(f.no, etats);
        if (no.length) rows.push({ t: 'sub', label: t('codex.describe.non') }, ...no);
      }
      return rows;
    }
  }
}

/** Effet MÉCANIQUE d'un Sort (`Flow` éditable : do/if/test) → section lisible (réutilise `flowSummary`).
 *  Source unique de la projection des effets de sort au Codex (≠ desc narrative). Vide → null. */
export function spellFlowSection(flow: Flow | undefined, etats: readonly EtatDeclare[], title: string = t('codex.describe.effetMecanique')): CodexSection | null {
  if (!flow) return null;
  const human = humanizeFlowSentence(flow, etats);
  const tech = flowSummary(flow, etats);
  const rows: CodexRow[] = [];
  if (human) rows.push({ t: 'text', text: human });
  if (tech) rows.push({ t: 'fold', summary: t('codex.describe.detailTechnique'), text: tech });
  if (flowHasRollTable(flow)) rows.push(...flowOpRows(flow, etats));
  return rows.length ? { title, layout: 'list', rows } : null;
}
