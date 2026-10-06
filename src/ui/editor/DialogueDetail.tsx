/**
 * Détail d'UN dialogue (panneau Logique) en MASTER-DÉTAIL : liste des nœuds (▶ départ,
 * résumé des choix « → n2, n3 ») → édition d'UN nœud à la fois — fini les cartes imbriquées
 * toutes dépliées du POC. Les choix sont repliés avec résumé (texte + cible + coût), dépliables
 * pour condition/coût/effets.
 */
import { useState } from 'react';
import { Dialogue, DialogueNode, DialogueChoice } from '../../state/scene';
import { EMPTY_FLOW, type Flow } from '../../state/flow';
import { Ctx } from './EffectList';
import { Icon } from '../Icon';
import { ICON_DEFS } from '../icons';
import { FlowEditor } from './FlowEditor';
import { WhenEditor, condSummary } from './ConditionEditor';
import { ListRow } from '../ListRow';
import { NumberField } from '../NumberField';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { adresseUnPassage } from '../../data/schemas/grammaire/valeurs';
import { useClesDeRangees } from '../useClesDeRangees';
import { Row, Stack } from '../Layout';
import { coupeAuMot } from '../../lib/coupeAuMot.mjs';

/** Ids posables au clic pour `DialogueChoice.icon` — DÉRIVÉS du registre d'icônes (`ICON_DEFS`,
 *  généré depuis `icons/defs/`), jamais une liste tenue à la main. */
const CHOICE_ICON_IDS = Object.keys(ICON_DEFS).sort();

/** Nombre de blocs de PREMIER niveau d'un Flow (badge du choix). */
const flowLen = (flow?: Flow): number => (!flow ? 0 : flow.kind === 'seq' ? flow.steps.length : 1);

export function DialogueDetail({ dialogue, onChange, ctx }: { dialogue: Dialogue; onChange: (d: Dialogue) => void; ctx: Ctx }) {
  const [nodeId, setNodeId] = useState<string>(dialogue.start);
  const node = dialogue.nodes.find((n) => n.id === nodeId) ?? dialogue.nodes[0] ?? null;

  const updNode = (patch: Partial<DialogueNode>) =>
    onChange({ ...dialogue, nodes: dialogue.nodes.map((n) => (node && n.id === node.id ? { ...n, ...patch } : n)) });
  const updChoice = (ci: number, patch: Partial<DialogueChoice>) =>
    updNode({ choices: node!.choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  const addNode = () => {
    let n = dialogue.nodes.length + 1;
    while (dialogue.nodes.some((x) => x.id === `n${n}`)) n++;
    const id = `n${n}`;
    onChange({ ...dialogue, nodes: [...dialogue.nodes, { id, choices: [] }] });
    setNodeId(id);
  };
  const clesDesChoix = useClesDeRangees(node?.choices);
  // Le panneau du nœud est keyed sur son identité STABLE : un renommage le garde, un autre nœud le remonte.
  const clesDesNoeuds = useClesDeRangees(dialogue.nodes);

  return (
    <div className="dlg-detail">
      <Row>
        <label className="ed-field dlg-id-field">
          Id du dialogue
          <input value={dialogue.id} onChange={(e) => onChange({ ...dialogue, id: e.target.value })} />
        </label>
        <label className="ed-field">
          Nœud de départ
          <select value={dialogue.start} onChange={(e) => onChange({ ...dialogue, start: e.target.value })}>
            {dialogue.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}
              </option>
            ))}
          </select>
        </label>
      </Row>

      <div className="dlg-split">
        <div className="dlg-nodes">
          <div className="mini-title">Nœuds ({dialogue.nodes.length})</div>
          {dialogue.nodes.map((n) => {
            const targets = [...new Set(n.choices.map((c) => c.next).filter(Boolean))];
            return (
              <ListRow
                key={n.id}
                selected={node?.id === n.id}
                onClick={() => setNodeId(n.id)}
                label={<>{dialogue.start === n.id ? '▶ ' : ''}<b>{n.id}</b> {n.desc ? `· ${coupeAuMot(n.desc, 24)}` : ''}</>}
              >
                {targets.length > 0 && <span className="chip">→ {targets.join(', ')}</span>}
              </ListRow>
            );
          })}
          <button className="btn small" onClick={addNode}>
            + Nœud
          </button>
        </div>

        {node && (
          <div className="dlg-node-edit panel sunken" key={clesDesNoeuds[dialogue.nodes.indexOf(node)]}>
            <Row>
              <input className="node-id" value={node.id} placeholder="id nœud" onChange={(e) => {
                const id = e.target.value;
                // renomme le nœud ET les références (start, choix → next)
                onChange({
                  ...dialogue,
                  start: dialogue.start === node.id ? id : dialogue.start,
                  nodes: dialogue.nodes.map((n) =>
                    n.id === node.id
                      ? { ...n, id }
                      : { ...n, choices: n.choices.map((c) => (c.next === node.id ? { ...c, next: id } : c)) },
                  ),
                });
                setNodeId(id);
              }} />
              <select
                className="node-speaker"
                value={node.speakerId ?? ''}
                onChange={(e) => updNode({ speakerId: e.target.value || undefined })}
                title="Locuteur de ce nœud — id d'entité de la scène (portrait + nom) ; vide = locuteur de session"
              >
                <option value="">(locuteur de session)</option>
                {ctx.personas?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label ?? p.id}
                  </option>
                ))}
              </select>
              <button
                className="btn small danger"
                title="Supprimer ce nœud"
                onClick={() => {
                  onChange({ ...dialogue, nodes: dialogue.nodes.filter((n) => n.id !== node.id) });
                  setNodeId(dialogue.start);
                }}
              >
                ✕ nœud
              </button>
            </Row>
            <ProseField label="Texte de la réplique" lecture={adresseUnPassage(node.descRef)} value={node.desc ?? ''} onChange={(desc) => updNode({ desc: desc || undefined })} />
            <ProvenanceDuTexte identite={`noeud:${clesDesNoeuds[dialogue.nodes.indexOf(node)]}`} sujet="de la réplique" value={node} onChange={updNode} />

            <div className="mini-title">Choix ({node.choices.length})</div>
            <Stack>
              {node.choices.map((c, ci) => (
                <details className="eff-row dlg-choice" key={clesDesChoix[ci]}>
                  <summary>
                    <span className="eff-summary">
                      {c.label ? `« ${coupeAuMot(c.label, 38)} »` : '(choix sans texte)'}
                      {c.next ? ` → ${c.next}` : ' → fin'}
                      {c.cost?.gold || c.cost?.silver || c.cost?.brass ? <> · <Icon id="resource/gold-purse" size="sm" /></> : ''}
                      {condSummary(c.when) ? ' · si ' + condSummary(c.when) : ''}
                      {flowLen(c.flow) ? ` · ${flowLen(c.flow)} bloc(s)` : ''}
                    </span>
                    <span className="eff-actions" onClick={(e) => e.preventDefault()}>
                      <button className="btn small danger" title="Supprimer le choix" onClick={() => updNode({ choices: node.choices.filter((_, i) => i !== ci) })}>
                        ✕
                      </button>
                    </span>
                  </summary>
                  <div className="eff-body">
                    <Row>
                      <input className="choice-text" value={c.label} onChange={(e) => updChoice(ci, { label: e.target.value })} placeholder="Texte du choix" />
                      <label className="dr" title="Icône d'affordance affichée devant le choix (registre d'icônes — jamais un emoji collé au texte).">
                        {c.icon ? <Icon id={c.icon} size="sm" /> : '—'}
                        <select value={c.icon ?? ''} onChange={(e) => updChoice(ci, { icon: e.target.value || undefined })}>
                          <option value="">(aucune icône)</option>
                          {CHOICE_ICON_IDS.map((id) => (
                            <option key={id} value={id}>
                              {id}
                            </option>
                          ))}
                        </select>
                      </label>
                    </Row>
                    <Row>
                      <label className="dr">
                        →
                        <select value={c.next ?? ''} onChange={(e) => updChoice(ci, { next: e.target.value || undefined })}>
                          <option value="">(fin / effets)</option>
                          {dialogue.nodes.map((nn) => (
                            <option key={nn.id} value={nn.id}>
                              {nn.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="choice-cost" title="Coût de l’option (service payant : auberge, péage, pot-de-vin) — CO / pa / sc">
                        <Icon id="resource/gold-purse" size="sm" />
                        {(['gold', 'silver', 'brass'] as const).map((k) => (
                          <NumberField
                            key={k}
                            variant="nu"
                            label={k === 'gold' ? 'Coût en Couronnes d’or' : k === 'silver' ? 'Coût en pistoles d’argent' : 'Coût en sous de cuivre'}
                            min={0}
                            placeholder={k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
                            vide
                            value={c.cost?.[k]}
                            onChange={(n) => {
                              const merged = { ...c.cost, [k]: n ?? undefined };
                              const any = merged.gold || merged.silver || merged.brass;
                              updChoice(ci, { cost: any ? merged : undefined });
                            }}
                          />
                        ))}
                      </span>
                    </Row>
                    <div className="mini-title" title="Le choix n'apparaît que si la condition est vraie (flag, créneau horaire, ET/OU/NON).">Affiché si</div>
                    <WhenEditor when={c.when} onChange={(when) => updChoice(ci, { when })} />
                    <div className="mini-title">À la sélection (effets · conditions · tests)</div>
                    <FlowEditor flow={c.flow ?? EMPTY_FLOW} ctx={ctx} onChange={(flow) => updChoice(ci, { flow: flowLen(flow) ? flow : undefined })} />
                  </div>
                </details>
              ))}
              <button className="btn small" onClick={() => updNode({ choices: [...node.choices, { label: '' }] })}>
                + Choix
              </button>
            </Stack>
          </div>
        )}
      </div>
    </div>
  );
}
