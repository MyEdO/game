import type { JSX } from 'react';
import { useId } from 'react';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { Stack } from '../Layout';
/**
 * ÉDITEUR DE FLOW — la « liste de blocs imbriqués » (façon RPG Maker / ink) qui authore la LOGIQUE
 * d'un trigger / choix de dialogue / piège / sort : une séquence de blocs
 *   · do   (un effet)
 *   · si   (condition → ALORS / SINON)
 *   · test (jet de compétence → RÉUSSITE / ÉCHEC)
 * chaque branche étant elle-même un Flow (récursif). SOURCE UNIQUE du branchement authoré. La feuille
 * `effet` réutilise `EffectFields` (sans `test` : le jet est un nœud Flow) ; le `si` réutilise `ConditionEditor`
 * (algèbre flag/horaire/ET/OU/NON, partagé avec le `when` des triggers/dialogues).
 */
import { FlowTest, EMPTY_FLOW } from '../../engine/flowCore';
import type { Effect, Flow } from '../../data/schemas/defs-scenes/effets';
import type { FlowTestNode } from '../../engine/flowCore';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';
import { Icon } from '../Icon';
import { DIFFICULTE_PAR_DEFAUT, DIFFICULTY_LABELS, Difficulty, CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import { isSocialTest } from '../../engine/skills';
import { menaceIds } from '../../engine/menace';
import { ListeDIds, RefField } from '../compendium/refField/RefField';
import { flowTestSchema, menaceSchema } from '../../data/schemas/grammaire/mecanique';
import { NumberField } from '../NumberField';
import { useClesDeRangees } from '../useClesDeRangees';
import { refLabel } from '../../data';
import {
  EffectFields,
  Ctx,
  menuDEffets,
  EFFECT_ICON,
  effectSummary,
  ctxDeCatalogue,
} from './EffectList';
import type { RacineDeCatalogue } from '../../noyau/combatEffects';
import { AddMenu, pickable } from './AddMenu';
import { newEffect } from '../../noyau/valeursNeuves';
import { blocNeuf, noeudTestNeuf } from '../../data/valeursNeuves';
import { ConditionEditor } from './ConditionEditor';
import { condSummary } from './interne/resumeDeCondition';

/** Normalise un Flow en liste de blocs éditables (un `sequence` expose ses étapes ; sinon bloc unique). */
function asSteps(flow: Flow): Flow[] {
  return flow.kind === 'sequence' ? flow.etapes : [flow];
}
const seqOf = (steps: Flow[]): Flow => ({ kind: 'sequence', etapes: steps });

/** Résumé HUMAIN d'un nœud Flow (rangée repliée). */
function nodeSummary(node: Flow, ctx: Ctx): string | JSX.Element {
  switch (node.kind) {
    case 'effet': return <><Icon id={EFFECT_ICON[node.effet.type]} size="sm" /> {effectSummary(node.effet, ctx)}</>;
    case 'si': return <><Icon id="interface/branchement" size="sm" /> Si {condSummary(node.condition, ctx.narratif)}{node.sinon != null ? ' · sinon…' : ''}</>;
    case 'test': return <><Icon id="navigation/des" size="sm" /> Test {node.test.skill ? refLabel('skills', node.test.skill) : (node.test.characteristic || '?')} → ✓ / ✗</>;
    case 'choix': return <><Icon id="interface/balance" size="sm" /> Choix{node.coutEnAvantage != null ? ` (${node.coutEnAvantage} Av)` : ''} « {node.invite} » → ✓ / ✗</>;
    case 'sequence': return `▸ ${node.etapes.length} bloc(s)`;
  }
}

/** Le NŒUD `test` tel qu'un porteur de SCÈNE l'épingle — la forme unique de `flowCore`, appliquée à
 *  la feuille `Effect` de la scène (transition/dialogue compris), jamais une seconde déclaration. */
export type NoeudTest = FlowTestNode<Effect>;

/**
 * Éditeur d'un CHAMP portant un nœud `test` (`{kind:'test', test, success, fail}`), pas un Flow
 * quelconque. Il compose le SOUS-éditeur de nœud (`TestFields` + un `FlowEditor` par branche), celui-là
 * même que `FlowEditor` monte quand il rencontre un `kind:'test'` — et JAMAIS la racine `FlowEditor`,
 * qui normalise ce qu'elle rend en `{kind:'sequence', steps}` (`asSteps`/`seqOf`) : le nœud y perdrait son
 * `kind`, et le document ne parserait plus son schéma au save.
 *
 * `retirable` = le champ admet-il l'ABSENCE de jet (rangée de Critique sans jet). Un porteur dont le
 * jet est la seule forme admise le passe à `false` : le bouton « Retirer » ne s'affiche pas, et le
 * nœud reste porté quoi qu'il arrive.
 *
 * `racine` = la racine de catalogue du champ (`CIBLES_PAR_RACINE`, `noyau/combatEffects.ts`) : ses
 * branches n'offrent que les cibles que le marcheur de CE champ honore.
 *
 * `branches` = ce que le CANAL du porteur sert vraiment. `'les-deux'` (défaut) pour un jet dont
 * l'issue choisit sa branche (Blessures critiques, `engine/critical.ts`). `'echec'` pour un canal
 * qui n'applique que l'échec (cycle de maladie, `noyau/restFlow.ts`) : la branche de réussite n'est
 * pas rendue, et le schéma du porteur la refuse peuplée (`noeudTest`, option `echecSeulServi`) —
 * une case qui ne changerait rien n'est pas offerte.
 */
export function NoeudTestField({ value, onChange, desc, racine, retirable = true, branches = 'les-deux' }: {
  value: NoeudTest | undefined;
  onChange: (v: NoeudTest | undefined) => void;
  desc: string;
  racine: RacineDeCatalogue;
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
              <FlowEditor flow={value.reussite} ctx={ctxDeCatalogue(racine)} onChange={(success) => onChange({ ...value, reussite: success })} />
            </div>
          )}
          <div className="branch">
            <span className="branch-label fail">Si ÉCHEC :</span>
            <FlowEditor flow={value.echec} ctx={ctxDeCatalogue(racine)} onChange={(fail) => onChange({ ...value, echec: fail })} />
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
  const identite = useId();
  // lecture déclarée : l'éditeur montre et réécrit les valeurs authorées
  const { difficulty, easierIf, gate } = test;
  const upd = (patch: Partial<FlowTest>) => onChange({ ...test, ...patch });
  const setEase = (patch: Partial<NonNullable<FlowTest['easierIf']>>) => {
    const m = { ...(easierIf ?? {}), ...patch };
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
        <select value={difficulty ?? DIFFICULTE_PAR_DEFAUT} onChange={(e) => upd({ difficulty: e.target.value as Difficulty })}>
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
          <Stack>
            <ProseField label="Enjeu du jet" value={test.stake?.authored ?? ''} onChange={(authored) => upd({ stake: authored.trim() ? { authored, ...(test.stake?.authored !== undefined ? { source: test.stake.source, adapteDe: test.stake.adapteDe } : {}) } : undefined })} />
            {test.stake?.authored !== undefined && <ProvenanceDuTexte copie identite={`${identite}/enjeu`} sujet="de l'enjeu" value={test.stake} onChange={(patch) => upd({ stake: { authored: test.stake!.authored!, ...patch } })} />}
          </Stack>
        )}
      </div>
      {/* GATE : no-op si fausse ; dans un Flow de scène, filtre les héros qui peuvent jeter (MDG 15 l.197). */}
      <div className="tf-row">
        <label className="ed-check" title="Le Test n’a lieu que si cette Condition est vraie ; en scène, seuls les héros qui la satisfont peuvent le jeter">
          <input type="checkbox" checked={gate !== undefined} onChange={(e) => upd({ gate: e.target.checked ? { kind: 'always' } : undefined })} /> Condition d’accès
        </label>
        {gate && <ConditionEditor cond={gate} onChange={(g) => upd({ gate: g })} />}
      </div>
      {isSocialTest(test) && (
        <div className="tf-row">
          <ListeDIds
            noeud={flowTestSchema.shape.vsGroups}
            label="Groupes de l’interlocuteur"
            title="Animosité et Préjugé du jeteur envers ces Groupes modifient le Test de Sociabilité"
            value={test.vsGroups}
            onChange={(vsGroups) => upd({ vsGroups })}
          />
        </div>
      )}
      <div className="tf-row">
        <span className="dr">Plus facile si</span>
        <RefField cfg={{ ds: 'skills', single: true, spec: true }} fieldKey="compétence" value={easierIf?.hasSkill} onChange={(v) => setEase({ hasSkill: (v as { id: string; spec?: string } | null) ?? undefined })} nullable />
        <RefField cfg={{ ds: 'talents', single: true }} fieldKey="ou talent" value={easierIf?.hasTalent} onChange={(v) => setEase({ hasTalent: (v as string | null) || undefined })} nullable />
        <label className="dr">−<NumberField variant="nu" label="Crans de facilité" min={1} value={easierIf?.steps ?? 1} onChange={(steps) => setEase({ steps })} /> cran(s)</label>
        {/* Menace du talent « Résistance (Menace) » (LDB 10) : tag qui offre son auto-succès sur CE Test.
            Les options sont les SPECS AUTHORÉES du talent (`menaceIds`, lues au catalogue) — l'auteur
            choisit un id, jamais du texte ; une spec ajoutée au Compendium apparaît ici sans code. */}
        <label className="dr" title="Résistance (Menace), LDB 10 : ce Test « résiste » à la menace indiquée — le talent y offre son auto-succès">
          Menace
          <select
            value={test.menace ?? ''}
            onChange={(e) => { const lue = menaceSchema.safeParse(e.target.value); upd({ menace: lue.success ? lue.data : undefined }); }}
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
function FlowAddMenu({ onAdd, ctx }: { onAdd: (node: Flow) => void; ctx: Ctx }) {
  return (
    <AddMenu
      label="+ Bloc"
      groups={[
        {
          title: 'Logique',
          items: [
            {
              key: 'si',
              label: <><Icon id="interface/branchement" size="sm" /> Condition (si…)</>,
              onPick: () => onAdd(blocNeuf('si')),
            },
            {
              key: 'test',
              label: <><Icon id="navigation/des" size="sm" /> Test de compétence</>,
              onPick: () => onAdd(blocNeuf('test')),
            },
            {
              key: 'choix',
              label: <><Icon id="interface/balance" size="sm" /> Choix du joueur</>,
              onPick: () => onAdd(blocNeuf('choix')),
            },
          ],
        },
        ...pickable(menuDEffets(ctx), (key) => onAdd({ kind: 'effet', effet: newEffect(key as Effect['type']) })),
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
  const cles = useClesDeRangees(steps);
  return (
    <div className="flow-list eff-list">
      {steps.map((node, i) => (
        <details className={`eff-row flow-node flow-${node.kind}`} key={cles[i]} open={node.kind !== 'effet'}>
          <summary>
            <span className="eff-summary">{nodeSummary(node, ctx)}</span>
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter (l'ordre compte)" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === steps.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer le bloc" onClick={() => set(steps.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          {node.kind === 'effet' && (
            <EffectFields effect={node.effet} ctx={ctx} onChange={(eff) => updAt(i, { kind: 'effet', effet: eff })} />
          )}
          {node.kind === 'si' && (
            <div className="eff-body flow-branch">
              <ConditionEditor cond={node.condition} narratif={ctx.narratif} noeud={ctx.famille?.condition} onChange={(c) => updAt(i, { ...node, condition: c })} />
              <div className="branch">
                <span className="branch-label ok">ALORS :</span>
                <FlowEditor flow={node.alors} ctx={ctx} onChange={(f) => updAt(i, { ...node, alors: f })} />
              </div>
              <label className="ed-check">
                <input type="checkbox" checked={node.sinon != null} onChange={(e) => updAt(i, { ...node, sinon: e.target.checked ? EMPTY_FLOW : undefined })} /> sinon…
              </label>
              {node.sinon != null && (
                <div className="branch">
                  <span className="branch-label fail">SINON :</span>
                  <FlowEditor flow={node.sinon} ctx={ctx} onChange={(f) => updAt(i, { ...node, sinon: f })} />
                </div>
              )}
            </div>
          )}
          {node.kind === 'test' && (
            <div className="eff-body flow-branch">
              <TestFields test={node.test} onChange={(t) => updAt(i, { ...node, test: t })} />
              <div className="branch">
                <span className="branch-label ok">Si RÉUSSITE :</span>
                <FlowEditor flow={node.reussite} ctx={ctx} onChange={(f) => updAt(i, { ...node, reussite: f })} />
              </div>
              <div className="branch">
                <span className="branch-label fail">Si ÉCHEC :</span>
                <FlowEditor flow={node.echec} ctx={ctx} onChange={(f) => updAt(i, { ...node, echec: f })} />
              </div>
            </div>
          )}
          {node.kind === 'sequence' && (
            <div className="eff-body">
              <FlowEditor flow={node} ctx={ctx} onChange={(f) => updAt(i, f)} />
            </div>
          )}
          {node.kind === 'choix' && (
            <Stack className="eff-body">
              <ProseField label="Invite du choix" value={node.invite} onChange={(invite) => updAt(i, { ...node, invite })} />
              <ProvenanceDuTexte copie identite={`${cles[i]}/choix`} sujet="du choix" value={node} onChange={(patch) => updAt(i, { ...node, ...patch })} />
              <NumberField label="Coût en Avantage" value={typeof node.coutEnAvantage === 'number' ? node.coutEnAvantage : 0} min={0} onChange={(coutEnAvantage) => updAt(i, { ...node, coutEnAvantage })} />
              <span className="branch-label ok">Si OUI :</span>
              <FlowEditor flow={node.oui} ctx={ctx} onChange={(yes) => updAt(i, { ...node, oui: yes })} />
              <label className="ed-check"><input type="checkbox" checked={node.non !== undefined} onChange={(e) => updAt(i, { ...node, non: e.target.checked ? EMPTY_FLOW : undefined })} /> Branche NON</label>
              {node.non && <FlowEditor flow={node.non} ctx={ctx} onChange={(no) => updAt(i, { ...node, non: no })} />}
            </Stack>
          )}
        </details>
      ))}
      <FlowAddMenu onAdd={(node) => set([...steps, node])} ctx={ctx} />
    </div>
  );
}
