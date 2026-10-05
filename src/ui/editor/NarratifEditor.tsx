import { useEffect, useId, useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { Tabs, type TabItem } from '../Tabs';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { MonsterPartsFields, ReglagesApparence } from './MonsterPartsFields';
import { isSwarm } from '../../engine/traits/dispatch';
import { mergeCreatureProfile } from '../../state/campaignData';
import { charAbr, creatures, creatureLabel, findCreatureById, memoParVersion } from '../../data';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import type { NarratifBlock, PresetPnj, Affaire, Indice, IndiceStade, OuvertureBlock, ClotureBlock, AmbianceCadre, EcartDeFiche } from '../../state/campaignNarratif';
import { ConditionEditor } from './ConditionEditor';
import { CONDITION_KINDS_CARTE } from '../../data/schemas/defs-scenes/worldmap';
import type { CreatureData } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { ListRow } from '../ListRow';
import { NumberField } from '../NumberField';
import { SourceRefField, useSaisieEnCours } from '../SourceRefField';
import { useClesDeRangees } from '../useClesDeRangees';
import { CouvreField, SelecteurDEntreeDeFiche } from './CouvreField';
import { Stack } from '../Layout';

/**
 * Éditeur du bloc NARRATIF d'un paquet de campagne (#765) — overlay plein-champ (`ScreenShell`, même
 * coquille que la Carte du monde). Les onglets Affaires/Indices (#670) et PNJ (#671 lot B) sont
 * ÉDITABLES ; l'onglet Objets reste en lecture. Frontière RÉFÉRENCE vs NARRATIF : ces entrées
 * référencent la règle globale PAR ID.
 */
type NarratifTab = 'cadre' | 'affaires' | 'indices' | 'presetsPnj' | 'objets' | 'ecartes';

/** Liste des créatures globales (base d'un preset), triée par libellé — patron `Inspector.tsx`. */
const optionsDeCreature = memoParVersion('creatures', () => [...creatures].map((c) => ({ id: c.id, label: c.label })).sort((a, b) => a.label.localeCompare(b.label)));

/** Nom affiché d'un preset dans la liste maître : profil.label, sinon la base, sinon l'id. */
function presetName(p: PresetPnj): string {
  return p.profil?.label ?? (p.base ? creatureLabel(p.base) : undefined) ?? p.id;
}

/** Id de preset frais, non-colluant avec les ids déjà présents. */
function freshPresetId(existing: PresetPnj[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((p) => p.id === x);
  while (has(`pnj-${n}`)) n++;
  return `pnj-${n}`;
}

/** Id d'affaire frais, non-colluant avec les ids déjà présents. */
function freshAffaireId(existing: Affaire[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((a) => a.id === x);
  while (has(`affaire-${n}`)) n++;
  return `affaire-${n}`;
}

/** Id d'indice frais, non-colluant avec les ids déjà présents. */
function freshIndiceId(existing: Indice[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((i) => i.id === x);
  while (has(`indice-${n}`)) n++;
  return `indice-${n}`;
}

/** Id de stade frais, non-colluant DANS l'indice porteur (`narratifSchema` exige l'unicité locale). */
function freshStadeId(existing: IndiceStade[]): string {
  let n = existing.length + 1;
  const has = (x: string) => existing.some((s) => s.id === x);
  while (has(`stade-${n}`)) n++;
  return `stade-${n}`;
}

/** L'AUTRE entrée des trois catégories narratives (affaires/indices/presetsPnj) qui porte déjà l'id
 *  candidat, hors l'entrée elle-même, nommée pour l'auteur ; `null` s'il est libre. Collision
 *  inter-catégories gardée ici ; collision avec un id global reste vérifiée par `narratifSchema` au parse. */
function porteurDeLId(
  narratif: NarratifBlock,
  candidate: string,
  self: { kind: 'affaire' | 'indice' | 'preset'; id: string },
): string | null {
  const isSelf = (kind: typeof self.kind, id: string) => kind === self.kind && id === self.id;
  const affaire = narratif.affaires.find((a) => a.id === candidate && !isSelf('affaire', a.id));
  if (affaire) return `l'affaire « ${affaire.titre} »`;
  const indice = narratif.indices.find((i) => i.id === candidate && !isSelf('indice', i.id));
  if (indice) return `l'indice « ${indice.titre} »`;
  const preset = narratif.presetsPnj.find((p) => p.id === candidate && !isSelf('preset', p.id));
  if (preset) return `le PNJ « ${presetName(preset)} »`;
  return null;
}

/** Id STABLE renommable, même règle que les clés d'un record du Codex : la saisie reste à l'écran telle
 *  que tapée ; un id vide ou déjà porté n'est pas retenu, et le champ le dit (`aria-invalid` + message)
 *  et le signale saisie en cours. Seul un id libre est émis. */
function ChampIdStable({ libelle, className = 'ed-field', value, porteurDe, onRename }: {
  libelle: string;
  className?: string;
  value: string;
  /** Ce qui porte déjà `candidat` (hors l'entrée elle-même), nommé pour l'auteur ; `null` s'il est libre. */
  porteurDe: (candidat: string) => string | null;
  onRename: (id: string) => void;
}) {
  const [saisie, setSaisie] = useState(value);
  const [retenu, setRetenu] = useState(value);
  if (retenu !== value) {
    setRetenu(value);
    setSaisie(value);
  }
  const refusDe = (candidat: string): string | null => {
    if (candidat === value) return null;
    if (candidat === '') return 'Identifiant vide';
    const porteur = porteurDe(candidat);
    return porteur && `Identifiant « ${candidat} » déjà porté par ${porteur}`;
  };
  const candidat = saisie.trim();
  const refus = refusDe(candidat);
  // La saisie devenue libre est retenue, qu'elle vienne d'une frappe ou de l'id libéré par une autre entrée.
  const aRetenir = candidat !== value && refus === null ? candidat : null;
  useEffect(() => { if (aRetenir !== null) onRename(aRetenir); }, [aRetenir, onRename]);
  useSaisieEnCours(refus !== null);
  const messageId = useId();
  return (
    <>
      <label className={className}>
        {libelle}
        <input
          value={saisie} aria-invalid={refus ? true : undefined} aria-describedby={refus ? messageId : undefined}
          onChange={(e) => setSaisie(e.target.value)}
        />
      </label>
      {refus && <span id={messageId} className="hint" role="status">{`${refus} : non retenu. L'identifiant retenu reste « ${value} ».`}</span>}
    </>
  );
}

export function NarratifEditor({ narratif, onChange, onClose }: {
  narratif: NarratifBlock;
  /** Chemin d'écriture (#671 lot B) — toute mutation de preset produit un `NarratifBlock` neuf (immutable). */
  onChange?: (n: NarratifBlock) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<NarratifTab>('affaires');
  const [selId, setSelId] = useState<string | null>(narratif.presetsPnj[0]?.id ?? null);
  const [selAffaireId, setSelAffaireId] = useState<string | null>(narratif.affaires[0]?.id ?? null);
  const [selIndiceId, setSelIndiceId] = useState<string | null>(narratif.indices[0]?.id ?? null);

  const setPresets = (presetsPnj: PresetPnj[]) => onChange?.({ ...narratif, presetsPnj });

  const addPreset = () => {
    const id = freshPresetId(narratif.presetsPnj);
    // Base par défaut = première créature globale : garantit un preset VALIDE au round-trip
    // (`narratifSchema` refuse un preset sans base ni profil) ; l'auteur la change ensuite.
    setPresets([...narratif.presetsPnj, { id, base: optionsDeCreature()[0]?.id }]);
    setSelId(id);
  };

  const removePreset = (id: string) => {
    setPresets(narratif.presetsPnj.filter((p) => p.id !== id));
    if (selId === id) setSelId(null);
  };

  const updatePreset = (id: string, patch: Partial<PresetPnj>) => {
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const renamePreset = (id: string, nextId: string) => {
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, id: nextId } : p)));
    if (selId === id) setSelId(nextId);
  };

  const selected = narratif.presetsPnj.find((p) => p.id === selId) ?? null;
  // Clé STABLE d'un porteur : elle survit au renommage de son id, qui n'est pas un changement d'entité.
  const clesPnj = useClesDeRangees(narratif.presetsPnj);
  const clesIndices = useClesDeRangees(narratif.indices);

  const setAffaires = (affaires: Affaire[]) => onChange?.({ ...narratif, affaires });

  const addAffaire = () => {
    const id = freshAffaireId(narratif.affaires);
    setAffaires([...narratif.affaires, { id, titre: 'Nouvelle affaire' }]);
    setSelAffaireId(id);
  };

  const affaireReferenced = (id: string) => narratif.indices.some((i) => i.affaireId === id);

  const removeAffaire = (id: string) => {
    if (affaireReferenced(id)) return;
    setAffaires(narratif.affaires.filter((a) => a.id !== id));
    if (selAffaireId === id) setSelAffaireId(null);
  };

  const updateAffaire = (id: string, patch: Partial<Affaire>) => {
    setAffaires(narratif.affaires.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const renameAffaire = (id: string, nextId: string) => {
    // Propage aux indices rattachés : sinon `narratifSchema` rejette un `affaireId` orphelin.
    const affaires = narratif.affaires.map((a) => (a.id === id ? { ...a, id: nextId } : a));
    const indices = narratif.indices.map((i) => (i.affaireId === id ? { ...i, affaireId: nextId } : i));
    onChange?.({ ...narratif, affaires, indices });
    if (selAffaireId === id) setSelAffaireId(nextId);
  };

  const selectedAffaire = narratif.affaires.find((a) => a.id === selAffaireId) ?? null;

  const setIndices = (indices: Indice[]) => onChange?.({ ...narratif, indices });

  const addIndice = () => {
    // Aucune affaire à rattacher : `narratifSchema` rejette un `affaireId` orphelin — no-op, le bouton
    // appelant est désactivé dans ce cas (garantit un indice VALIDE au round-trip, même esprit qu'`addPreset`).
    const firstAffaireId = narratif.affaires[0]?.id;
    if (!firstAffaireId) return;
    const id = freshIndiceId(narratif.indices);
    setIndices([...narratif.indices, { id, affaireId: firstAffaireId, kind: 'indice', titre: 'Nouvel indice', stades: [{ id: 'stade-1', prose: '' }] }]);
    setSelIndiceId(id);
  };

  const removeIndice = (id: string) => {
    // Retire aussi toute référence pendante (`refs`) d'un AUTRE indice vers celui-ci.
    const next = narratif.indices
      .filter((i) => i.id !== id)
      .map((i) => {
        if (!i.refs?.includes(id)) return i;
        const refs = i.refs.filter((r) => r !== id);
        return { ...i, refs: refs.length ? refs : undefined };
      });
    setIndices(next);
    if (selIndiceId === id) setSelIndiceId(null);
  };

  const updateIndice = (id: string, patch: Partial<Indice>) => {
    setIndices(narratif.indices.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const renameIndice = (id: string, nextId: string) => {
    // Propage aux `refs` des autres indices : sinon `narratifSchema` rejette une réf orpheline.
    const indices = narratif.indices.map((i) => {
      if (i.id === id) return { ...i, id: nextId };
      if (i.refs?.includes(id)) return { ...i, refs: i.refs.map((r) => (r === id ? nextId : r)) };
      return i;
    });
    setIndices(indices);
    if (selIndiceId === id) setSelIndiceId(nextId);
  };

  const selectedIndice = narratif.indices.find((i) => i.id === selIndiceId) ?? null;

  const setOuverture = (ouverture: OuvertureBlock | undefined) => onChange?.({ ...narratif, ouverture });
  const setCloture = (cloture: ClotureBlock | undefined) => onChange?.({ ...narratif, cloture });
  const setEcartes = (ecartes: EcartDeFiche[] | undefined) => onChange?.({ ...narratif, ecartes });

  const tabs: TabItem<NarratifTab>[] = [
    { key: 'cadre', label: 'Cadre', count: (narratif.ouverture ? 1 : 0) + (narratif.cloture ? 1 : 0) },
    { key: 'affaires', label: 'Affaires', count: narratif.affaires.length },
    { key: 'indices', label: 'Indices', count: narratif.indices.length },
    { key: 'presetsPnj', label: 'PNJ', count: narratif.presetsPnj.length },
    { key: 'objets', label: 'Objets', count: narratif.objets.length },
    { key: 'ecartes', label: 'Écarts', count: narratif.ecartes?.length ?? 0 },
  ];

  return (
    <ScreenShell
      title={<><Icon id="nav/compendium" size="sm" /> Narratif de la campagne</>}
      onClose={onClose}
      body="centered"
      tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Rubriques du narratif" />}
    >
      {tab === 'cadre' && (
        <CadreForm
          ouverture={narratif.ouverture}
          cloture={narratif.cloture}
          onOuverture={setOuverture}
          onCloture={setCloture}
        />
      )}
      {tab === 'affaires' && (
        <MasterDetail
          listLabel="Affaires"
          list={
            <>
              {narratif.affaires.length === 0
                ? <p className="empty">Aucune affaire dans cette campagne.</p>
                : narratif.affaires.map((a) => (
                    <ListRow key={a.id} selected={a.id === selAffaireId} onClick={() => setSelAffaireId(a.id)} label={a.titre} subtitle={a.id} />
                  ))}
              <button type="button" className="btn small" onClick={addAffaire}>
                <Icon id="ui/add" size="sm" /> Ajouter une affaire
              </button>
            </>
          }
          detail={
            selectedAffaire
              ? <AffaireForm
                  affaire={selectedAffaire}
                  referenced={affaireReferenced(selectedAffaire.id)}
                  porteurDe={(c) => porteurDeLId(narratif, c, { kind: 'affaire', id: selectedAffaire.id })}
                  onRename={(nextId) => renameAffaire(selectedAffaire.id, nextId)}
                  onPatch={(patch) => updateAffaire(selectedAffaire.id, patch)}
                  onRemove={() => removeAffaire(selectedAffaire.id)}
                />
              : <p className="empty">Sélectionnez une affaire à éditer, ou ajoutez-en une.</p>
          }
        />
      )}
      {tab === 'indices' && (
        <MasterDetail
          listLabel="Indices"
          list={
            <>
              {narratif.indices.length === 0
                ? <p className="empty">Aucun indice dans cette campagne.</p>
                : narratif.indices.map((i) => (
                    <ListRow key={i.id} selected={i.id === selIndiceId} onClick={() => setSelIndiceId(i.id)} label={i.titre} subtitle={i.id}>
                      <span className="chip">{i.kind === 'rumeur' ? 'Rumeur' : 'Indice'}</span>
                    </ListRow>
                  ))}
              <button
                type="button"
                className="btn small"
                disabled={narratif.affaires.length === 0}
                title={narratif.affaires.length === 0 ? 'Créez d\'abord une affaire.' : undefined}
                onClick={addIndice}
              >
                <Icon id="ui/add" size="sm" /> Ajouter un indice
              </button>
            </>
          }
          detail={
            selectedIndice
              ? <IndiceForm
                  porteur={`indice:${clesIndices[narratif.indices.indexOf(selectedIndice)]}`}
                  indice={selectedIndice}
                  affaires={narratif.affaires}
                  otherIndices={narratif.indices.filter((i) => i.id !== selectedIndice.id)}
                  porteurDe={(c) => porteurDeLId(narratif, c, { kind: 'indice', id: selectedIndice.id })}
                  onRename={(nextId) => renameIndice(selectedIndice.id, nextId)}
                  onPatch={(patch) => updateIndice(selectedIndice.id, patch)}
                  onRemove={() => removeIndice(selectedIndice.id)}
                />
              : <p className="empty">Sélectionnez un indice à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'presetsPnj' && (
        <MasterDetail
          listLabel="PNJ pré-composés"
          list={
            <>
              {narratif.presetsPnj.length === 0
                ? <p className="empty">Aucun PNJ pré-composé dans cette campagne.</p>
                : narratif.presetsPnj.map((p) => (
                    <ListRow key={p.id} selected={p.id === selId} onClick={() => setSelId(p.id)} label={presetName(p)} subtitle={p.id} />
                  ))}
              <button type="button" className="btn small" onClick={addPreset}>
                <Icon id="ui/add" size="sm" /> Ajouter un PNJ
              </button>
            </>
          }
          detail={
            selected
              ? <PresetForm
                  porteur={`pnj:${clesPnj[narratif.presetsPnj.indexOf(selected)]}`}
                  preset={selected}
                  porteurDe={(c) => porteurDeLId(narratif, c, { kind: 'preset', id: selected.id })}
                  onRename={(nextId) => renamePreset(selected.id, nextId)}
                  onPatch={(patch) => updatePreset(selected.id, patch)}
                  onRemove={() => removePreset(selected.id)}
                />
              : <p className="empty">Sélectionnez un PNJ à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'objets' && (
        narratif.objets.length === 0
          ? <p className="empty">Aucun objet narratif dans cette campagne.</p>
          : narratif.objets.map((o) => (
              <ListRow key={o.id} label={o.label}>
                <span className="chip">{o.id}</span>
              </ListRow>
            ))
      )}
      {tab === 'ecartes' && <EcartesForm ecartes={narratif.ecartes ?? []} onChange={setEcartes} />}
    </ScreenShell>
  );
}

/** CADRE du chapitre (#717) : l'ouverture cérémonielle et la clôture. La Condition de clôture est
 *  bornée aux kinds évaluables hors combat (`CONDITION_KINDS_CARTE`), comme un `when` de carte. */
function CadreForm({ ouverture, cloture, onOuverture, onCloture }: {
  ouverture?: OuvertureBlock;
  cloture?: ClotureBlock;
  onOuverture: (o: OuvertureBlock | undefined) => void;
  onCloture: (c: ClotureBlock | undefined) => void;
}) {
  const patchOuv = (patch: Partial<OuvertureBlock>) => onOuverture({ ...(ouverture ?? { titre: '', pitch: '' }), ...patch });
  // Clôture NEUVE : `{kind:'flag', expr:''}` — le défaut du `ConditionEditor` (`ConditionEditor.tsx`,
  // branche d'`all`/`any`) et de `FlowEditor`. Une Condition `always` fermerait le chapitre au PREMIER
  // lot d'effets ; un `expr` vide, lui, ne peut pas être sauvegardé (le schéma le refuse en nommant le
  // champ), donc l'auteur nomme son drapeau ou retire la clôture.
  const patchClo = (patch: Partial<ClotureBlock>) => onCloture({ ...(cloture ?? { titre: '', when: { kind: 'flag', expr: '' } }), ...patch });
  return (
    <div>
      <h4 className="mini-title">Ouverture cérémonielle</h4>
      {!ouverture ? (
        <button type="button" className="btn small" onClick={() => onOuverture({ titre: '', pitch: '' })}>
          <Icon id="ui/add" size="sm" /> Ajouter une ouverture
        </button>
      ) : (
        <>
          <label className="ed-field">
            Surtitre
            <input value={ouverture.surtitre ?? ''} onChange={(e) => patchOuv({ surtitre: e.target.value || undefined })} />
          </label>
          <label className="ed-field">
            Titre
            <input value={ouverture.titre} onChange={(e) => patchOuv({ titre: e.target.value })} />
          </label>
          <label className="ed-field">
            Sous-titre
            <input value={ouverture.sousTitre ?? ''} onChange={(e) => patchOuv({ sousTitre: e.target.value || undefined })} />
          </label>
          <label className="ed-field">
            Chapitre
            <input value={ouverture.chapitre ?? ''} onChange={(e) => patchOuv({ chapitre: e.target.value || undefined })} />
          </label>
          <label className="ed-field">
            Pitch (Markdown)
            <textarea value={ouverture.pitch} onChange={(e) => patchOuv({ pitch: e.target.value })} />
          </label>
          <SourceRefField identite="ouverture" label="Source" facultative sujet="de l'ouverture" value={ouverture.source} onChange={(source) => patchOuv({ source })} />
          <label className="ed-field">
            Ambiance
            <select value={ouverture.ambiance ?? 'veillee'} onChange={(e) => patchOuv({ ambiance: e.target.value as AmbianceCadre })}>
              <option value="veillee">Veillée</option>
              <option value="parchemin">Parchemin</option>
            </select>
          </label>
          <button type="button" className="btn small danger" onClick={() => onOuverture(undefined)}>
            <Icon id="ui/delete" size="sm" /> Retirer l'ouverture
          </button>
        </>
      )}
      <h4 className="mini-title">Clôture du chapitre</h4>
      {!cloture ? (
        <button type="button" className="btn small" onClick={() => onCloture({ titre: '', when: { kind: 'flag', expr: '' } })}>
          <Icon id="ui/add" size="sm" /> Ajouter une clôture
        </button>
      ) : (
        <>
          <label className="ed-field">
            Titre
            <input value={cloture.titre} onChange={(e) => patchClo({ titre: e.target.value })} />
          </label>
          <label className="ed-field">
            Sous-titre
            <input value={cloture.sousTitre ?? ''} onChange={(e) => patchClo({ sousTitre: e.target.value || undefined })} />
          </label>
          <div className="ed-field">
            Condition de clôture
            <ConditionEditor cond={cloture.when} kinds={CONDITION_KINDS_CARTE} onChange={(when) => patchClo({ when })} />
          </div>
          <button type="button" className="btn small danger" onClick={() => onCloture(undefined)}>
            <Icon id="ui/delete" size="sm" /> Retirer la clôture
          </button>
        </>
      )}
    </div>
  );
}

/** Formulaire d'une affaire : identité + titre + description, suppression bloquée si des indices y sont rattachés. */
function AffaireForm({ affaire, referenced, porteurDe, onRename, onPatch, onRemove }: {
  affaire: Affaire;
  referenced: boolean;
  porteurDe: (candidat: string) => string | null;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Affaire>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <ChampIdStable libelle="Identifiant (id stable)" value={affaire.id} porteurDe={porteurDe} onRename={onRename} />
      <label className="ed-field">
        Titre
        <input value={affaire.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <label className="ed-field">
        Description
        <textarea
          value={affaire.desc ?? ''}
          onChange={(e) => onPatch({ desc: e.target.value || undefined })}
        />
      </label>
      <button
        type="button"
        className="btn small danger"
        disabled={referenced}
        title={referenced ? 'Des indices référencent encore cette affaire — les retirer ou les réaffecter d\'abord.' : undefined}
        onClick={onRemove}
      >
        <Icon id="ui/delete" size="sm" /> Supprimer cette affaire
      </button>
    </div>
  );
}

/** Formulaire d'un indice/rumeur : identité + affaire + nature + titre + recoupements + stades révélables. */
function IndiceForm({ porteur, indice, affaires, otherIndices, porteurDe, onRename, onPatch, onRemove }: {
  /** Identité STABLE de l'indice, tenue par `NarratifEditor` à travers ses renommages. */
  porteur: string;
  indice: Indice;
  affaires: Affaire[];
  otherIndices: Indice[];
  porteurDe: (candidat: string) => string | null;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Indice>) => void;
  onRemove: () => void;
}) {
  const toggleRef = (id: string) => {
    const refs = indice.refs ?? [];
    const next = refs.includes(id) ? refs.filter((r) => r !== id) : [...refs, id];
    onPatch({ refs: next.length ? next : undefined });
  };

  const setStades = (stades: IndiceStade[]) => onPatch({ stades });
  const addStade = () => setStades([...indice.stades, { id: freshStadeId(indice.stades), prose: '' }]);
  const removeStade = (id: string) => {
    if (indice.stades.length <= 1) return;
    setStades(indice.stades.filter((s) => s.id !== id));
  };
  const updateStade = (id: string, patch: Partial<IndiceStade>) => {
    setStades(indice.stades.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  /** Le stade (hors `soi`) qui porte déjà `candidat` : `narratifSchema` exige l'unicité dans l'indice. */
  const stadePorteur = (soi: string, candidat: string): string | null => {
    const j = indice.stades.findIndex((s) => s.id !== soi && s.id === candidat);
    return j >= 0 ? `le stade ${j + 1}` : null;
  };
  const clesStades = useClesDeRangees(indice.stades);

  return (
    <div>
      <ChampIdStable libelle="Identifiant (id stable)" value={indice.id} porteurDe={porteurDe} onRename={onRename} />
      <div className="ed-field">
        <span>Affaire</span>
        {affaires.length === 0
          ? <p className="empty">Créez d'abord une affaire pour pouvoir y rattacher un indice.</p>
          : (
            <select aria-label="Affaire de l'indice" value={indice.affaireId} onChange={(e) => onPatch({ affaireId: e.target.value })}>
              {affaires.map((a) => (
                <option key={a.id} value={a.id}>{a.titre}</option>
              ))}
            </select>
          )}
      </div>
      <label className="ed-field">
        Nature
        <select value={indice.kind} onChange={(e) => onPatch({ kind: e.target.value as Indice['kind'] })}>
          <option value="indice">Indice</option>
          <option value="rumeur">Rumeur</option>
        </select>
      </label>
      <label className="ed-field">
        Titre
        <input value={indice.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <div className="ed-field">
        <span>Recoupements (autres indices débloqués/liés)</span>
        {otherIndices.length === 0
          ? <p className="empty">Aucun autre indice à recouper.</p>
          : otherIndices.map((o) => (
              <label key={o.id} className="ed-subfield">
                <input type="checkbox" checked={(indice.refs ?? []).includes(o.id)} onChange={() => toggleRef(o.id)} />
                {o.titre} <span className="chip">{o.id}</span>
              </label>
            ))}
      </div>
      <CouvreField value={indice.couvre} sujet="de l'indice" onChange={(couvre) => onPatch({ couvre })} />
      <div className="ed-field">
        <span>Stades révélables</span>
        {indice.stades.map((s, idx) => (
          <div key={clesStades[idx]}>
            <ChampIdStable
              libelle={`Id du stade ${idx + 1}`} className="ed-subfield" value={s.id}
              porteurDe={(c) => stadePorteur(s.id, c)} onRename={(id) => updateStade(s.id, { id })}
            />
            <label className="ed-subfield">
              Prose (stade {idx + 1})
              <textarea value={s.prose} onChange={(e) => updateStade(s.id, { prose: e.target.value })} />
            </label>
            <SourceRefField identite={`${porteur}/stade:${clesStades[idx]}`} label="Source" facultative sujet={`du stade ${idx + 1}`} value={s.source} onChange={(source) => updateStade(s.id, { source })} />
            <button
              type="button"
              className="btn small danger"
              disabled={indice.stades.length <= 1}
              title={indice.stades.length <= 1 ? 'Un indice garde au moins un stade.' : undefined}
              onClick={() => removeStade(s.id)}
            >
              <Icon id="ui/delete" size="sm" /> Supprimer le stade {idx + 1}
            </button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={addStade}>
          <Icon id="ui/add" size="sm" /> Ajouter un stade
        </button>
      </div>
      <button type="button" className="btn small danger" onClick={onRemove}>
        <Icon id="ui/delete" size="sm" /> Supprimer cet indice
      </button>
    </div>
  );
}

type OngletDuPnj = 'profil' | 'apparence' | 'couverture';

/** Rubriques du formulaire d'un PNJ (CLAUDE.md, règle stricte 4). */
const ongletsDuPnj = (preset: PresetPnj): TabItem<OngletDuPnj>[] => [
  { key: 'profil', label: 'Profil' },
  { key: 'apparence', label: 'Apparence' },
  { key: 'couverture', label: 'Couverture', count: preset.couvre?.length ?? 0 },
];

/** Formulaire d'un preset de PNJ, en onglets : profil (identité, base, caracs, source), apparence (réglages,
 *  portrait), couverture des entrées de fiche. */
function PresetForm({ porteur, preset, porteurDe, onRename, onPatch, onRemove }: {
  /** Identité STABLE du PNJ, tenue par `NarratifEditor` à travers ses renommages. */
  porteur: string;
  preset: PresetPnj;
  porteurDe: (candidat: string) => string | null;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<PresetPnj>) => void;
  onRemove: () => void;
}) {
  const profil = preset.profil ?? {};
  const appearance: EntityAppearance = preset.apparence ?? {};
  const base = preset.base ? findCreatureById(preset.base) : undefined;

  /** Fusionne un patch de `profil` (retire `profil` s'il redevient vide). */
  const patchProfil = (patch: Partial<CreatureData>) => {
    const next = { ...profil, ...patch };
    onPatch({ profil: Object.keys(next).length ? next : undefined });
  };
  /** Surcharge d'une carac (vide = héritée de la base) — retire `char` s'il redevient vide. */
  const setChar = (k: CharKey, v: number | null) => {
    const char = { ...(profil.char ?? {}) };
    if (v == null) delete char[k];
    else char[k] = v;
    patchProfil({ char: Object.keys(char).length ? char : undefined });
  };
  /** Pose l'apparence suivante (retire `apparence` si elle redevient vide). */
  const poserApparence = (next: EntityAppearance) => onPatch({ apparence: Object.keys(next).length ? next : undefined });
  const [onglet, setOnglet] = useState<OngletDuPnj>('profil');

  return (
    <Stack>
      <Tabs tabs={ongletsDuPnj(preset)} active={onglet} onChange={setOnglet} label="Rubriques du PNJ" />
      <div>
        {onglet === 'profil' && (
          <>
            <ChampIdStable libelle="Identifiant (id stable)" value={preset.id} porteurDe={porteurDe} onRename={onRename} />
            <label className="ed-field">
              Créature de base (profil de combat)
              <select value={preset.base ?? ''} onChange={(e) => onPatch({ base: e.target.value || undefined })}>
                <option value="">— aucune (profil ad hoc) —</option>
                {optionsDeCreature().map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label className="ed-field">
              Nom du PNJ
              <input
                value={profil.label ?? ''}
                placeholder={base?.label ?? 'ex. Josef Quartjin'}
                onChange={(e) => patchProfil({ label: e.target.value || undefined })}
              />
            </label>
            <div className="ed-field">
              <span>Surcharges de caractéristiques (vide = héritée de la base)</span>
              <div className="statblock-grid">
                {CHAR_KEYS.map((k) => (
                  <label key={k} className="ed-subfield" title={CHAR_LABELS[k]}>
                    {charAbr(k)}
                    <NumberField
                      variant="nu"
                      label={CHAR_LABELS[k]}
                      vide
                      value={profil.char?.[k]}
                      placeholder={base ? String(base.char[k] ?? '') : ''}
                      onChange={(n) => setChar(k, n)}
                    />
                  </label>
                ))}
              </div>
            </div>
            <SourceRefField identite={porteur} label="Source" facultative sujet="du PNJ" value={preset.source} onChange={(source) => onPatch({ source })} />
          </>
        )}
        {onglet === 'apparence' && (
          <>
            <div className="ed-field">
              <span>Apparence</span>
              <ReglagesApparence appearance={appearance} onChange={poserApparence} reglages={['species', 'sex', 'build', 'hairstyle']}
                nuee={isSwarm(base ? mergeCreatureProfile(base, profil).traits : profil.traits)} />
            </div>
            <MonsterPartsFields appearance={appearance} onChange={poserApparence} reglages={['monster', 'eyes', 'features', 'tenue', 'colors']} />
            <label className="ed-field">
              Portrait (id d'illustration)
              <input
                value={preset.portrait ?? ''}
                placeholder="id du registre d'art"
                onChange={(e) => onPatch({ portrait: e.target.value || undefined })}
              />
            </label>
          </>
        )}
        {onglet === 'couverture' && <CouvreField value={preset.couvre} sujet="du PNJ" onChange={(couvre) => onPatch({ couvre })} />}
        <button type="button" className="btn small danger" onClick={onRemove}>
          <Icon id="ui/delete" size="sm" /> Supprimer ce PNJ
        </button>
      </div>
    </Stack>
  );
}

/** ÉCARTS d'adaptation (#2290, `narratif.ecartes`) : une rangée par entrée de fiche écartée — l'entrée,
 *  son motif, le retrait. Une liste vidée se retire (`undefined`). */
function EcartesForm({ ecartes, onChange }: {
  ecartes: EcartDeFiche[];
  onChange: (ecartes: EcartDeFiche[] | undefined) => void;
}) {
  const poser = (next: EcartDeFiche[]) => onChange(next.length ? next : undefined);
  const remplacer = (i: number, patch: Partial<EcartDeFiche>) => poser(ecartes.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const prises = new Set(ecartes.map((e) => e.entree));
  const cles = useClesDeRangees(ecartes);
  const alerteId = useId();
  return (
    <div className="ed-field">
      <span>Entrées de fiche écartées par l'adaptation</span>
      {ecartes.length === 0
        ? <p className="empty">Aucune entrée de fiche écartée.</p>
        : ecartes.map((e, i) => {
            const sansMotif = !/\S/.test(e.motif);
            const alerte = `${alerteId}-${i}`;
            return (
              <div key={cles[i]}>
                <div className="fieldrow" data-variant="texte-dessous">
                  <SelecteurDEntreeDeFiche value={e.entree} exclues={prises} libelle={`Entrée écartée ${i + 1}`} onChoisir={(entree) => remplacer(i, { entree })} />
                  <button type="button" className="btn small danger" aria-label={`Retirer l'écart ${i + 1}`} title="Retirer" onClick={() => poser(ecartes.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                  <textarea
                    aria-label={`Motif de l'écart ${i + 1}`} placeholder="Motif de l'écart" value={e.motif} rows={2}
                    aria-invalid={sansMotif ? true : undefined} aria-describedby={sansMotif ? alerte : undefined}
                    onChange={(ev) => remplacer(i, { motif: ev.target.value })}
                  />
                </div>
                {sansMotif && <p id={alerte} className="chip tone-danger" role="alert">Motif requis.</p>}
              </div>
            );
          })}
      <SelecteurDEntreeDeFiche value="" exclues={prises} libelle="Écarter une entrée de fiche" onChoisir={(entree) => poser([...ecartes, { entree, motif: '' }])} />
    </div>
  );
}
