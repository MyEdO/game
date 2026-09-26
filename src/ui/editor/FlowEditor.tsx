/**
 * ÉDITEUR DE FLOW — la « liste de blocs imbriqués » (façon RPG Maker / ink) qui authore la LOGIQUE
 * d'un trigger / choix de dialogue / piège / sort : une séquence de blocs
 *   · do   (un effet)
 *   · si   (condition → ALORS / SINON)
 *   · test (jet de compétence → RÉUSSITE / ÉCHEC)
 * chaque branche étant elle-même un Flow (récursif). SOURCE UNIQUE du branchement authoré. La feuille
 * `do` réutilise `EffectFields` (sans `test` : le jet est un nœud Flow) ; le `si` réutilise `ConditionEditor`
 * (algèbre flag/horaire/ET/OU/NON, partagé avec le `when` des triggers/dialogues).
 */
import { Flow, FlowTest, EMPTY_FLOW } from '../../state/flow';
import type { Effect } from '../../state/scene';
import type { FlowTestNode } from '../../engine/flowCore';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';
import { Icon } from '../Icon';
import { DIFFICULTY_LABELS, Difficulty, CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import { isSocialTest } from '../../engine/skills';
import { menaceIds } from '../../engine/menace';
import { RefField } from '../compendium/RefField';
import { NumberField } from '../NumberField';
import { refLabel } from '../../data';
import {
  EffectFields,
  Ctx,
  EFFECT_MENU_GROUPS,
  EFFECT_ICON,
  newEffect,
  effectSummary,
} from './EffectList';
import { AddMenu, pickable } from './AddMenu';
import { ConditionEditor, condSummary } from './ConditionEditor';

/** Normalise un Flow en liste de blocs éditables (un `seq` expose ses étapes ; sinon bloc unique). */
function asSteps(flow: Flow): Flow[] {
  return flow.kind === 'seq' ? flow.steps : [flow];
}
const seqOf = (steps: Flow[]): Flow => ({ kind: 'seq', steps });

/** Résumé HUMAIN d'un nœud Flow (rangée repliée). */
function nodeSummary(node: Flow, ctx: Ctx): string | JSX.Element {
  switch (node.kind) {
    case 'do': return <><Icon id={EFFECT_ICON[node.effect.type]} size="sm" /> {effectSummary(node.effect, ctx)}</>;
    case 'if': return <><Icon id="ui/branch" size="sm" /> Si {condSummary(node.cond)}{node.else != null ? ' · sinon…' : ''}</>;
    case 'test': return <><Icon id="nav/dice" size="sm" /> Test {node.test.skill ? refLabel('skills', node.test.skill) : (node.test.characteristic || '?')} → ✓ / ✗</>;
    case 'choice': return <><Icon id="ui/balance" size="sm" /> Choix{node.advantageCost != null ? ` (${node.advantageCost} Av)` : ''} « {node.prompt} » → ✓ / ✗</>;
    case 'seq': return `▸ ${node.steps.length} bloc(s)`;
  }
}

/** Le NŒUD `test` tel qu'un porteur de SCÈNE l'épingle — la forme unique de `flowCore`, appliquée à
 *  la feuille `Effect` de la scène (transition/dialogue compris), jamais une seconde déclaration. */
export type NoeudTest = FlowTestNode<Effect>;

/** Nœud `test` NEUF, complet dès la pose — jamais un nœud à moitié valide que le schéma refuserait. */
export const noeudTestNeuf = (): NoeudTest => ({ kind: 'test', test: { difficulty: 'intermediaire' }, success: EMPTY_FLOW, fail: EMPTY_FLOW });

/**
 * Éditeur d'un CHAMP portant un nœud `test` (`{kind:'test', test, success, fail}`), pas un Flow
 * quelconque. Il compose le SOUS-éditeur de nœud (`TestFields` + un `FlowEditor` par branche), celui-là
 * même que `FlowEditor` monte quand il rencontre un `kind:'test'` — et JAMAIS la racine `FlowEditor`,
 * qui normalise ce qu'elle rend en `{kind:'seq', steps}` (`asSteps`/`seqOf`) : le nœud y perdrait son
 * `kind`, et le document ne parserait plus son schéma au save.
 *
 * `retirable` = le champ admet-il l'ABSENCE de jet (rangée de Critique sans jet). Un porteur dont le
 * jet est la seule forme admise le passe à `false` : le bouton « Retirer » ne s'affiche pas, et le
 * nœud reste porté quoi qu'il arrive.
 *
 * `branches` = ce que le CANAL du porteur sert vraiment. `'les-deux'` (défaut) pour un jet dont
 * l'issue choisit sa branche (Blessures critiques, `engine/critical.ts`). `'echec'` pour un canal
 * qui n'applique que l'échec (cycle de maladie, `state/restFlow.ts`) : la branche de réussite n'est
 * pas rendue, et le schéma du porteur la refuse peuplée (`noeudTest`, option `echecSeulServi`) —
 * une case qui ne changerait rien n'est pas offerte.
 */
export function NoeudTestField({ value, onChange, desc, retirable = true, branches = 'les-deux' }: {
  value: NoeudTest | undefined;
  onChange: (v: NoeudTest | undefined) => void;
  desc: string;
  retirable?: boolean;
  branches?: 'echec' | 'les-deux';
}) {
  return (
    <div className="ed-field">
      <span>{desc}</span>
      {value ? (
        <div className="eff-body flow-branch">
          <TestFields test={value.test} onChange={(test) => onChange({ ...value, test })} />
          {branches === 'les-deux' && (
            <div className="branch">
              <span className="branch-label ok">Si RÉUSSITE :</span>
              <FlowEditor flow={value.success} ctx={{ encounters: [], dialogues: [] }} onChange={(success) => onChange({ ...value, success })} />
            </div>
          )}
          <div className="branch">
            <span className="branch-label fail">Si ÉCHEC :</span>
            <FlowEditor flow={value.fail} ctx={{ encounters: [], dialogues: [] }} onChange={(fail) => onChange({ ...value, fail })} />
          </div>
          {retirable && <button type="button" className="btn" onClick={() => onChange(undefined)}>Retirer le jet</button>}
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => onChange(noeudTestNeuf())}>Ajouter un jet</button>
      )}
    </div>
  );
}

/**
 * Éditeur du jet d'un nœud `test` (FlowTest : Compétence ET/OU Caractéristique, Difficulté, DR, outil,
 * groupes, easierIf). Les deux sujets ne s'excluent PAS — `flowTestSchema` les déclare tous deux
 * optionnels sans refinement, et `testValue` (`engine/skills.ts`) lit `characteristic` comme la carac
 * EXPLICITE contre laquelle le jet roule, celle de la Compétence n'étant que le défaut.
 */
export function TestFields({ test, onChange }: { test: FlowTest; onChange: (t: FlowTest) => void }) {
  const upd = (patch: Partial<FlowTest>) => onChange({ ...test, ...patch });
  const setEase = (patch: Partial<NonNullable<FlowTest['easierIf']>>) => {
    const m = { ...(test.easierIf ?? {}), ...patch };
    upd({ easierIf: m.hasSkill || m.hasTalent ? m : undefined });
  };
  return (
    <>
      <div className="tf-row">
        <RefField cfg={{ ds: 'skills', single: true, spec: true }} fieldKey="Compétence" value={test.skill} onChange={(v) => upd({ skill: (v as RefDesignee | null) ?? undefined })} nullable />
        {/* Caractéristique : les deux clefs COEXISTENT au schéma (`flowTestSchema`, aucune exclusion) et
            au moteur — `testValue` passe `characteristic` en `explicit` à `effectiveSkillCharKey`, qui
            REMPLACE la caractéristique par défaut de la Compétence dont les avances comptent toujours.
            Sans Compétence, c'est un Test de Caractéristique nue (Gréement fluvial : Initiative). */}
        <select
          aria-label="Caractéristique testée"
          title={test.skill ? 'Caractéristique testée à la place de celle de la Compétence (ses avances comptent toujours)' : 'Caractéristique testée — sans Compétence, le jet roule dessus seule'}
          value={test.characteristic ?? ''}
          onChange={(e) => upd({ characteristic: (e.target.value || undefined) as CharKey | undefined })}
        >
          <option value="">{test.skill ? '— Caractéristique de la Compétence —' : '— aucune Caractéristique —'}</option>
          {CHAR_KEYS.map((k) => (
            <option key={k} value={k}>{CHAR_LABELS[k]}</option>
          ))}
        </select>
        <select value={test.difficulty ?? 'intermediaire'} onChange={(e) => upd({ difficulty: e.target.value as Difficulty })}>
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
          ))}
        </select>
        <label className="dr">DR≥<NumberField variant="nu" label="Degrés de Réussite requis" value={test.requireSL ?? 0} onChange={(requireSL) => upd({ requireSL })} /></label>
        {/* Outil : picker catalogue (stocke l'id) avec repli nom pour les objets CUSTOM. */}
        <RefField cfg={{ ds: 'trappings', freeText: true }} value={test.tool} onChange={(v) => upd({ tool: v as string | undefined })} />
      </div>
      {/* ENJEU (#1117, arbitrage user 2026-08-12 / #1262) : ce que le jet met en jeu s'authore ICI, avec
          la scène — `validateScene` refuse un jet muet. Un enjeu de CATALOGUE (Flow produit par le
          moteur, jamais par cet éditeur) reste en lecture seule : sa phrase vit dans la donnée. */}
      <div className="tf-row">
        {test.stake?.key ? (
          <span className="dr" title="Enjeu servi par un dataset du moteur — il s’édite dans sa donnée, pas dans la scène.">
            Enjeu : {test.stake.key.dataset}/{test.stake.key.kind} (catalogue)
          </span>
        ) : (
          <input
            style={{ flex: 1 }}
            placeholder="Enjeu — ce que ce jet met en jeu, annoncé au joueur AVANT de lancer"
            title="Enjeu du jet : la phrase lue par le joueur dans la fenêtre de jet. Dites la conséquence RÉELLE des branches (ce que la réussite gagne, ce que l’échec coûte)."
            value={test.stake?.authored ?? ''}
            onChange={(e) => upd({ stake: e.target.value.trim() ? { authored: e.target.value } : undefined })}
          />
        )}
      </div>
      {isSocialTest(test.skill?.id, test.characteristic) && (
        <div className="tf-row">
          <input
            placeholder="Interlocuteur — groupes (Sociabilité : Animosité/Préjugé −20/−10, ex. « Elfe, Mort-vivant »)"
            value={(test.vsGroups ?? []).join(', ')}
            onChange={(e) => {
              const g = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              upd({ vsGroups: g.length ? g : undefined });
            }}
          />
        </div>
      )}
      <div className="tf-row">
        <span className="dr">Plus facile si</span>
        <RefField cfg={{ ds: 'skills', single: true, spec: true }} fieldKey="compétence" value={test.easierIf?.hasSkill} onChange={(v) => setEase({ hasSkill: (v as { id: string; spec?: string } | null) ?? undefined })} nullable />
        <input placeholder="ou talent" value={test.easierIf?.hasTalent ?? ''} onChange={(e) => setEase({ hasTalent: e.target.value || undefined })} />
        <label className="dr">−<NumberField variant="nu" label="Crans de facilité" min={1} value={test.easierIf?.steps ?? 1} onChange={(steps) => setEase({ steps })} /> cran(s)</label>
        {/* Menace du talent « Résistance (Menace) » (LDB 10) : tag qui offre son auto-succès sur CE Test.
            Les options sont les SPECS AUTHORÉES du talent (`menaceIds`, lues au catalogue) — l'auteur
            choisit un id, jamais du texte ; une spec ajoutée au Compendium apparaît ici sans code. */}
        <label className="dr" title="Résistance (Menace), LDB 10 : ce Test « résiste » à la menace indiquée — le talent y offre son auto-succès">
          Menace
          <select
            value={test.menace ?? ''}
            onChange={(e) => upd({ menace: e.target.value || undefined })}
          >
            <option value="">aucune</option>
            {menaceIds().map((m) => (
              <option key={m} value={m}>{refLabel('talents', { id: 'resistance', spec: m })}</option>
            ))}
          </select>
        </label>
        {/* Soutien (LDB 12 l.187-198) : TRI-ÉTAT authoré — le défaut suit la VOIE qui ouvre le Test
            (scène/dialogue soutenable, effet déclenché/consommable non), l'auteur peut trancher. */}
        <label className="dr" title="Soutien (LDB 12) : « selon la voie » = soutenable en scène/dialogue, non soutenable pour un effet déclenché ou un consommable ; « soutenable »/« jamais » tranchent explicitement.">
          Soutien
          <select
            value={test.noSupport === undefined ? 'voie' : test.noSupport ? 'jamais' : 'oui'}
            onChange={(e) => upd({ noSupport: e.target.value === 'voie' ? undefined : e.target.value === 'jamais' })}
          >
            <option value="voie">selon la voie</option>
            <option value="oui">soutenable</option>
            <option value="jamais">jamais</option>
          </select>
        </label>
      </div>
    </>
  );
}

/** Menu « + Bloc » : un nœud logique (si/test) ou une feuille d'effet (do, par catégorie). */
function FlowAddMenu({ onAdd }: { onAdd: (node: Flow) => void }) {
  return (
    <AddMenu
      label="+ Bloc"
      groups={[
        {
          title: 'Logique',
          items: [
            {
              key: 'if',
              label: <><Icon id="ui/branch" size="sm" /> Condition (si…)</>,
              onPick: () => onAdd({ kind: 'if', cond: { kind: 'flag', expr: '' }, then: EMPTY_FLOW }),
            },
            {
              key: 'test',
              label: <><Icon id="nav/dice" size="sm" /> Test de compétence</>,
              onPick: () => onAdd({ kind: 'test', test: { skill: { id: '' }, difficulty: 'intermediaire', requireSL: 0 }, success: EMPTY_FLOW, fail: EMPTY_FLOW }),
            },
          ],
        },
        ...pickable(EFFECT_MENU_GROUPS, (key) => onAdd({ kind: 'do', effect: newEffect(key as Effect['type']) })),
      ]}
    />
  );
}

export function FlowEditor({ flow, onChange, ctx }: { flow: Flow; onChange: (f: Flow) => void; ctx: Ctx }) {
  const steps = asSteps(flow);
  const set = (next: Flow[]) => onChange(seqOf(next));
  const updAt = (i: number, node: Flow) => set(steps.map((s, j) => (j === i ? node : s)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  return (
    <div className="flow-list eff-list">
      {steps.map((node, i) => (
        <details className={`eff-row flow-node flow-${node.kind}`} key={i} open={node.kind !== 'do'}>
          <summary>
            <span className="eff-summary">{nodeSummary(node, ctx)}</span>
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter (l'ordre compte)" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === steps.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer le bloc" onClick={() => set(steps.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          {node.kind === 'do' && (
            <EffectFields effect={node.effect} ctx={ctx} onChange={(eff) => updAt(i, { kind: 'do', effect: eff })} />
          )}
          {node.kind === 'if' && (
            <div className="eff-body flow-branch">
              <ConditionEditor cond={node.cond} onChange={(c) => updAt(i, { ...node, cond: c })} />
              <div className="branch">
                <span className="branch-label ok">ALORS :</span>
                <FlowEditor flow={node.then} ctx={ctx} onChange={(f) => updAt(i, { ...node, then: f })} />
              </div>
              <label className="ed-check">
                <input type="checkbox" checked={node.else != null} onChange={(e) => updAt(i, { ...node, else: e.target.checked ? EMPTY_FLOW : undefined })} /> sinon…
              </label>
              {node.else != null && (
                <div className="branch">
                  <span className="branch-label fail">SINON :</span>
                  <FlowEditor flow={node.else} ctx={ctx} onChange={(f) => updAt(i, { ...node, else: f })} />
                </div>
              )}
            </div>
          )}
          {node.kind === 'test' && (
            <div className="eff-body flow-branch">
              <TestFields test={node.test} onChange={(t) => updAt(i, { ...node, test: t })} />
              <div className="branch">
                <span className="branch-label ok">Si RÉUSSITE :</span>
                <FlowEditor flow={node.success} ctx={ctx} onChange={(f) => updAt(i, { ...node, success: f })} />
              </div>
              <div className="branch">
                <span className="branch-label fail">Si ÉCHEC :</span>
                <FlowEditor flow={node.fail} ctx={ctx} onChange={(f) => updAt(i, { ...node, fail: f })} />
              </div>
            </div>
          )}
          {node.kind === 'seq' && (
            <div className="eff-body">
              <FlowEditor flow={node} ctx={ctx} onChange={(f) => updAt(i, f)} />
            </div>
          )}
        </details>
      ))}
      <FlowAddMenu onAdd={(node) => set([...steps, node])} />
    </div>
  );
}
