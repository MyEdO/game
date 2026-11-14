import { useEffect, useId, useState } from 'react';
import type { z } from 'zod';
import { ScreenShell } from '../ScreenShell';
import { Tabs, type TabItem } from '../composites/Tabs';
import { Icon } from '../Icon';
import { MasterDetail } from '../MasterDetail';
import { ApparencesObjetsField, ReglagesApparence } from './ReglagesApparence';
import { armesDEntite } from '../../noyau/equipementDessine';
import { mergeCreatureProfile, objetDuNarratif } from '../../noyau/monde/resolveursDuNarratif';
import { charAbr, creatures, findCreatureById, memoParVersion } from '../../data';
import { CHAR_KEYS, CHAR_LABELS, type CharKey } from '../../engine/types';
import { FORMES_D_ETAT, valeursDeclarees, type FormeDEtatKind } from '../../data/schemas/defs-scenes/formes-d-etat';
import { SourceRefField, useSaisieEnCours } from '../SourceRefField';
import { useClesDeRangees } from '../useClesDeRangees';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { estDerive } from '../../noyau/codex/editFields';
import { RefNarrativeField } from '../compendium/refField/RefField';
import { LIBELLE_NARRATIF } from '../../noyau/codex/libellesNarratifs';
import { ConditionEditor } from './ConditionEditor';
import { CONDITION_KINDS_CARTE, identiteSchema } from '../../data/schemas/grammaire/campagne';
import type { RegistreReference } from '../../data/schemas/defs-scenes/registres-narratifs';
import type { CibleNarrative, Renommage } from '../../data/schemas/defs-scenes/refs-narratives';
import { ajouteEntree, idFrais, type RegistreCreable } from '../../data/schemas/defs-scenes/ecritures-du-narratif';
import { refusDeRenommage, refusDeRetrait, refusDId, renommeAuProjet, retireDuProjet, type ProjetEdite } from '../../noyau/narratifEdit';
import type { CreatureData } from '../../data';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { ListRow } from '../ListRow';
import { ChipDeRefus } from '../ChipDeRefus';
import { GatedAction, raisonSi } from '../GatedAction';
import { NumberField } from '../NumberField';
import { CouvreField, SelecteurDEntreeDeFiche } from './CouvreField';
import { Stack } from '../Layout';
import { t } from '../../i18n';
import type {
  NarratifBlock,
  PresetPnj,
  Affaire,
  Indice,
  IndiceStade,
  DocumentNarratif,
  EtatNarratif,
  OuvertureBlock,
  ClotureBlock,
  AmbianceCadre,
  EcartDeFiche,
} from '../../data/schemas/defs-scenes/narratif';
import { raceKeySchema, sexeSchema, type RaceKey, type Sexe } from '../../data/schemas/grammaire/valeurs';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { validateDocument, cheminLisible } from '../../data/schemas/validate';

/**
 * Éditeur du bloc NARRATIF d'un paquet de campagne (#765) — overlay plein-champ (`ScreenShell`, même
 * coquille que la Carte du monde). Les onglets Affaires/Indices (#670), Documents (#679), PNJ (#671
 * lot B) et États (#2539) sont ÉDITABLES ; l'onglet Objets reste en lecture. Frontière RÉFÉRENCE vs NARRATIF : ces entrées
 * référencent la règle globale PAR ID.
 */
type NarratifTab = 'cadre' | 'affaires' | 'indices' | 'documents' | 'etats' | 'presetsPnj' | 'objets' | 'ecartes';

/** Liste des créatures globales (base d'un preset), triée par libellé — patron `Inspector.tsx`. */
const optionsDeCreature = memoParVersion('creatures', () => [...creatures].map((c) => ({ id: c.id, label: c.label })).sort((a, b) => a.label.localeCompare(b.label)));

/** Id STABLE renommable, même règle que les clés d'un record du Codex : la saisie reste à l'écran telle
 *  que tapée ; un id vide ou déjà porté n'est pas retenu, et le champ le dit (`aria-invalid` + message)
 *  et le signale saisie en cours. Seul un id libre est émis. */
function ChampIdStable({ libelle, className = 'ed-field', value, refusDe, onRename }: {
  libelle: string;
  className?: string;
  value: string;
  /** Le refus de retenir `candidat` (rogné), `null` s'il est retenu ou inchangé (`refusDeRenommage`). */
  refusDe: (candidat: string) => string | null;
  onRename: (id: string) => void;
}) {
  const [saisie, setSaisie] = useState(value);
  const [retenu, setRetenu] = useState(value);
  if (retenu !== value) {
    setRetenu(value);
    setSaisie(value);
  }
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

export function NarratifEditor({ projet, onChange, onClose }: {
  projet: ProjetEdite;
  /** Chemin d'écriture (#671 lot B) — toute mutation produit un projet neuf (immutable) ; seules les
   *  racines touchées changent d'identité. Un renommage porte son `Renommage`, pour que le détenteur
   *  d'un historique le propage aussi aux instantanés. */
  onChange?: (p: ProjetEdite, renommage?: Renommage) => void;
  onClose: () => void;
}) {
  const narratif = projet.narratif;
  const [tab, setTab] = useState<NarratifTab>('affaires');
  const [selId, setSelId] = useState<string | null>(narratif.presetsPnj[0]?.id ?? null);
  const [selAffaireId, setSelAffaireId] = useState<string | null>(narratif.affaires[0]?.id ?? null);
  const [selIndiceId, setSelIndiceId] = useState<string | null>(narratif.indices[0]?.id ?? null);
  const [selDocumentId, setSelDocumentId] = useState<string | null>(narratif.documents[0]?.id ?? null);
  const [selEtatId, setSelEtatId] = useState<string | null>(narratif.etats[0]?.id ?? null);

  const poserNarratif = (n: NarratifBlock) => onChange?.({ ...projet, narratif: n });

  /** Renomme `cible` en `nextId` (`renommeAuProjet`), propagé à toute référence du projet ; un renommage
   *  refusé ne pose rien. Rend l'id retenu, ou `null`. */
  const renomme = (cible: CibleNarrative, nextId: string): string | null => {
    const p = renommeAuProjet(projet, cible, nextId);
    if (p === projet) return null;
    const nouveau = nextId.trim();
    onChange?.(p, { cible, nouveau });
    return nouveau;
  };
  /** Le refus de renommer `cible` en `candidat` (`ChampIdStable`). */
  const refusDe = (registre: RegistreReference, id: string, sous?: string) => (candidat: string) => refusDeRenommage(narratif, { registre, id, sous }, candidat);
  /** Le refus de retirer `cible` (`BoutonRetirer`). */
  const refusDeRetirer = (registre: RegistreReference, id: string, sous?: string) => refusDeRetrait(projet, { registre, id, sous });
  /** Retire `cible` (`retireDuProjet`) ; rend `true` s'il est retiré. */
  const retire = (cible: CibleNarrative): boolean => {
    const p = retireDuProjet(projet, cible);
    if (p === projet) return false;
    onChange?.(p);
    return true;
  };
  /** Crée une entrée (`ajouteEntree`) et la sélectionne. */
  const ajoute = <R extends RegistreCreable>(registre: R, entree: Omit<NarratifBlock[R][number], 'id'>, choisir: (id: string) => void) => {
    const out = ajouteEntree(narratif, registre, entree);
    poserNarratif(out.narratif);
    choisir(out.id);
  };

  const setPresets = (presetsPnj: PresetPnj[]) => poserNarratif({ ...narratif, presetsPnj });

  // Base par défaut = première créature globale : garantit un preset VALIDE au round-trip
  // (`narratifSchema` refuse un preset sans base ni profil) ; l'auteur la change ensuite.
  const addPreset = () => {
    const premiere = optionsDeCreature()[0];
    ajoute('presetsPnj', { base: premiere && { id: premiere.id } }, setSelId);
  };

  const removePreset = (id: string) => {
    if (retire({ registre: 'presetsPnj', id }) && selId === id) setSelId(null);
  };

  const updatePreset = (id: string, patch: Partial<PresetPnj>) => {
    setPresets(narratif.presetsPnj.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const renamePreset = (id: string, nextId: string) => {
    const nouveau = renomme({ registre: 'presetsPnj', id }, nextId);
    if (nouveau && selId === id) setSelId(nouveau);
  };

  const selected = narratif.presetsPnj.find((p) => p.id === selId) ?? null;
  // Clé STABLE d'un porteur : elle survit au renommage de son id, qui n'est pas un changement d'entité.
  const clesPnj = useClesDeRangees(narratif.presetsPnj);
  const clesIndices = useClesDeRangees(narratif.indices);
  const clesDocuments = useClesDeRangees(narratif.documents);
  const clesEtats = useClesDeRangees(narratif.etats);

  const setAffaires = (affaires: Affaire[]) => poserNarratif({ ...narratif, affaires });

  const addAffaire = () => ajoute('affaires', { titre: 'Nouvelle affaire' }, setSelAffaireId);

  const removeAffaire = (id: string) => {
    if (retire({ registre: 'affaires', id }) && selAffaireId === id) setSelAffaireId(null);
  };

  const updateAffaire = (id: string, patch: Partial<Affaire>) => {
    setAffaires(narratif.affaires.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const renameAffaire = (id: string, nextId: string) => {
    const nouveau = renomme({ registre: 'affaires', id }, nextId);
    if (nouveau && selAffaireId === id) setSelAffaireId(nouveau);
  };

  const selectedAffaire = narratif.affaires.find((a) => a.id === selAffaireId) ?? null;

  const setIndices = (indices: Indice[]) => poserNarratif({ ...narratif, indices });

  const addIndice = () => {
    // Aucune affaire à rattacher : `narratifSchema` rejette un `affaireId` orphelin — no-op, le bouton
    // appelant est désactivé dans ce cas (garantit un indice VALIDE au round-trip, même esprit qu'`addPreset`).
    const firstAffaireId = narratif.affaires[0]?.id;
    if (!firstAffaireId) return;
    ajoute('indices', { affaireId: firstAffaireId, kind: 'indice', titre: 'Nouvel indice', stades: [{ id: 'stade-1', prose: '' }] }, setSelIndiceId);
  };

  const removeIndice = (id: string) => {
    if (retire({ registre: 'indices', id }) && selIndiceId === id) setSelIndiceId(null);
  };

  const updateIndice = (id: string, patch: Partial<Indice>) => {
    setIndices(narratif.indices.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const renameIndice = (id: string, nextId: string) => {
    const nouveau = renomme({ registre: 'indices', id }, nextId);
    if (nouveau && selIndiceId === id) setSelIndiceId(nouveau);
  };

  const selectedIndice = narratif.indices.find((i) => i.id === selIndiceId) ?? null;

  const setDocuments = (documents: DocumentNarratif[]) => poserNarratif({ ...narratif, documents });

  const addDocument = () => ajoute('documents', { titre: 'Nouveau document', prose: '' }, setSelDocumentId);

  const removeDocument = (id: string) => {
    if (retire({ registre: 'documents', id }) && selDocumentId === id) setSelDocumentId(null);
  };

  const updateDocument = (id: string, patch: Partial<DocumentNarratif>) => {
    setDocuments(narratif.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const renameDocument = (id: string, nextId: string) => {
    const nouveau = renomme({ registre: 'documents', id }, nextId);
    if (nouveau && selDocumentId === id) setSelDocumentId(nouveau);
  };

  const selectedDocument = narratif.documents.find((d) => d.id === selDocumentId) ?? null;

  const setEtats = (etats: EtatNarratif[]) => poserNarratif({ ...narratif, etats });
  const addEtat = () => ajoute('etats', { label: 'Nouvel état', forme: formeNeuve('heros') }, setSelEtatId);
  const removeEtat = (id: string) => {
    if (retire({ registre: 'etats', id }) && selEtatId === id) setSelEtatId(null);
  };
  const updateEtat = (id: string, patch: Partial<EtatNarratif>) => setEtats(narratif.etats.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const renameEtat = (id: string, nextId: string) => {
    const nouveau = renomme({ registre: 'etats', id }, nextId);
    if (nouveau && selEtatId === id) setSelEtatId(nouveau);
  };
  const selectedEtat = narratif.etats.find((x) => x.id === selEtatId) ?? null;

  const setOuverture = (ouverture: OuvertureBlock | undefined) => poserNarratif({ ...narratif, ouverture });
  const setCloture = (cloture: ClotureBlock | undefined) => poserNarratif({ ...narratif, cloture });
  const setEcartes = (ecartes: EcartDeFiche[] | undefined) => poserNarratif({ ...narratif, ecartes });

  const tabs: TabItem<NarratifTab>[] = [
    { key: 'cadre', label: 'Cadre', count: (narratif.ouverture ? 1 : 0) + (narratif.cloture ? 1 : 0) },
    { key: 'affaires', label: 'Affaires', count: narratif.affaires.length },
    { key: 'indices', label: 'Indices', count: narratif.indices.length },
    { key: 'documents', label: 'Documents', count: narratif.documents.length },
    { key: 'etats', label: 'États', count: narratif.etats.length },
    { key: 'presetsPnj', label: 'PNJ', count: narratif.presetsPnj.length },
    { key: 'objets', label: 'Objets', count: narratif.objets.length },
    { key: 'ecartes', label: 'Écarts', count: narratif.ecartes?.length ?? 0 },
  ];

  return (
    <ScreenShell
      title={<><Icon id="navigation/compendium" size="sm" /> Narratif de la campagne</>}
      onClose={onClose}
      body="centered"
      tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Rubriques du narratif" />}
    >
      {tab === 'cadre' && (
        <CadreForm
          narratif={narratif}
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
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addAffaire}>
              <Icon id="interface/ajouter" size="sm" /> Ajouter une affaire
            </button>
          }
          detail={
            selectedAffaire
              ? <AffaireForm
                  affaire={selectedAffaire}
                  refus={refusDeRetirer('affaires', selectedAffaire.id)}
                  refusDe={refusDe('affaires', selectedAffaire.id)}
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
            </>
          }
          action={
            <GatedAction
              id="ajouter-indice"
              label={<><Icon id="interface/ajouter" size="sm" /> Ajouter un indice</>}
              enabled={narratif.affaires.length > 0}
              {...raisonSi(narratif.affaires.length === 0 ? 'Créez d’abord une affaire.' : undefined)}
              onClick={addIndice}
              primary={false}
              btnClassName="small"
            />
          }
          detail={
            selectedIndice
              ? <IndiceForm
                  porteur={`indice:${clesIndices[narratif.indices.indexOf(selectedIndice)]}`}
                  indice={selectedIndice}
                  narratif={narratif}
                  affaires={narratif.affaires}
                  otherIndices={narratif.indices.filter((i) => i.id !== selectedIndice.id)}
                  refusDe={refusDe('indices', selectedIndice.id)}
                  onRename={(nextId) => renameIndice(selectedIndice.id, nextId)}
                  onPatch={(patch) => updateIndice(selectedIndice.id, patch)}
                  refusDeRenommerStade={(stade) => refusDe('indices', selectedIndice.id, stade)}
                  onRenameStade={(from, nextId) => renomme({ registre: 'indices', id: selectedIndice.id, sous: from }, nextId)}
                  refusDeStade={(stade) => refusDeRetirer('indices', selectedIndice.id, stade)}
                  onRemoveStade={(stade) => retire({ registre: 'indices', id: selectedIndice.id, sous: stade })}
                  refus={refusDeRetirer('indices', selectedIndice.id)}
                  onRemove={() => removeIndice(selectedIndice.id)}
                />
              : <p className="empty">Sélectionnez un indice à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'documents' && (
        <MasterDetail
          listLabel="Documents"
          list={
            <>
              {narratif.documents.length === 0
                ? <p className="empty">Aucun document dans cette campagne.</p>
                : narratif.documents.map((d) => (
                    <ListRow key={d.id} selected={d.id === selDocumentId} onClick={() => setSelDocumentId(d.id)} label={d.titre} subtitle={d.id} />
                  ))}
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addDocument}>
              <Icon id="interface/ajouter" size="sm" /> Ajouter un document
            </button>
          }
          detail={
            selectedDocument
              ? <DocumentForm
                  porteur={`document:${clesDocuments[narratif.documents.indexOf(selectedDocument)]}`}
                  doc={selectedDocument}
                  refusDe={refusDe('documents', selectedDocument.id)}
                  refus={refusDeRetirer('documents', selectedDocument.id)}
                  onRename={(nextId) => renameDocument(selectedDocument.id, nextId)}
                  onPatch={(patch) => updateDocument(selectedDocument.id, patch)}
                  onRemove={() => removeDocument(selectedDocument.id)}
                />
              : <p className="empty">Sélectionnez un document à éditer, ou ajoutez-en un.</p>
          }
        />
      )}
      {tab === 'etats' && (
        <MasterDetail
          listLabel="États de campagne"
          list={
            <>
              {narratif.etats.length === 0
                ? <p className="empty">Aucun état de campagne dans cette campagne.</p>
                : narratif.etats.map((x) => (
                    <ListRow key={x.id} selected={x.id === selEtatId} onClick={() => setSelEtatId(x.id)} label={x.label} subtitle={x.id}>
                      <span className="chip">{FORMES_D_ETAT[x.forme.kind].label}</span>
                    </ListRow>
                  ))}
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addEtat}>
              <Icon id="interface/ajouter" size="sm" /> Ajouter un état
            </button>
          }
          detail={
            selectedEtat
              ? <EtatForm
                  porteur={`etat:${clesEtats[narratif.etats.indexOf(selectedEtat)]}`}
                  etat={selectedEtat}
                  refusDe={refusDe('etats', selectedEtat.id)}
                  refus={refusDeRetirer('etats', selectedEtat.id)}
                  refusDeRenommerValeur={(valeur) => refusDe('etats', selectedEtat.id, valeur)}
                  refusDeValeur={(valeur) => refusDeRetirer('etats', selectedEtat.id, valeur)}
                  onRemoveValeur={(valeur) => retire({ registre: 'etats', id: selectedEtat.id, sous: valeur })}
                  onRename={(nextId) => renameEtat(selectedEtat.id, nextId)}
                  onRenameValeur={(from, nextId) => renomme({ registre: 'etats', id: selectedEtat.id, sous: from }, nextId)}
                  onPatch={(patch) => updateEtat(selectedEtat.id, patch)}
                  onRemove={() => removeEtat(selectedEtat.id)}
                />
              : <p className="empty">Sélectionnez un état à éditer, ou ajoutez-en un.</p>
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
                    <ListRow key={p.id} selected={p.id === selId} onClick={() => setSelId(p.id)} label={LIBELLE_NARRATIF.presetsPnj(p)} subtitle={p.id} />
                  ))}
            </>
          }
          action={
            <button type="button" className="btn small" onClick={addPreset}>
              <Icon id="interface/ajouter" size="sm" /> Ajouter un PNJ
            </button>
          }
          detail={
            selected
              ? <PresetForm narratif={narratif}
                  porteur={`pnj:${clesPnj[narratif.presetsPnj.indexOf(selected)]}`}
                  preset={selected}
                  refusDe={refusDe('presetsPnj', selected.id)}
                  onRename={(nextId) => renamePreset(selected.id, nextId)}
                  onPatch={(patch) => updatePreset(selected.id, patch)}
                  refus={refusDeRetirer('presetsPnj', selected.id)}
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
function CadreForm({ narratif, ouverture, cloture, onOuverture, onCloture }: {
  /** Les états de campagne qu'une clôture peut lire. */
  narratif: NarratifBlock;
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
          <Icon id="interface/ajouter" size="sm" /> Ajouter une ouverture
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
          <ProseField label="Sous-titre de l'ouverture" value={ouverture.sousTitre?.texte ?? ''} onChange={(texte) => patchOuv({ sousTitre: texte ? { ...ouverture.sousTitre, texte } : undefined })} />
          {ouverture.sousTitre && <ProvenanceDuTexte copie identite="ouverture/sous-titre" sujet="du sous-titre de l'ouverture" value={ouverture.sousTitre} onChange={(patch) => patchOuv({ sousTitre: { ...ouverture.sousTitre!, ...patch } })} />}
          <label className="ed-field">
            Chapitre
            <input value={ouverture.chapitre ?? ''} onChange={(e) => patchOuv({ chapitre: e.target.value || undefined })} />
          </label>
          <ProseField label="Pitch (Markdown)" value={ouverture.pitch} onChange={(pitch) => patchOuv({ pitch })} />
          <ProvenanceDuTexte identite="ouverture" copie sujet="de l'ouverture" value={ouverture} onChange={patchOuv} />
          <label className="ed-field">
            Ambiance
            <select value={ouverture.ambiance ?? 'veillee'} onChange={(e) => patchOuv({ ambiance: e.target.value as AmbianceCadre })}>
              <option value="veillee">Veillée</option>
              <option value="parchemin">Parchemin</option>
            </select>
          </label>
          <button type="button" className="btn small danger" onClick={() => onOuverture(undefined)}>
            <Icon id="interface/supprimer" size="sm" /> Retirer l'ouverture
          </button>
        </>
      )}
      <h4 className="mini-title">Clôture du chapitre</h4>
      {!cloture ? (
        <button type="button" className="btn small" onClick={() => onCloture({ titre: '', when: { kind: 'flag', expr: '' } })}>
          <Icon id="interface/ajouter" size="sm" /> Ajouter une clôture
        </button>
      ) : (
        <>
          <label className="ed-field">
            Titre
            <input value={cloture.titre} onChange={(e) => patchClo({ titre: e.target.value })} />
          </label>
          <ProseField label="Sous-titre de la clôture" value={cloture.sousTitre?.texte ?? ''} onChange={(texte) => patchClo({ sousTitre: texte ? { ...cloture.sousTitre, texte } : undefined })} />
          {cloture.sousTitre && <ProvenanceDuTexte copie identite="cloture/sous-titre" sujet="du sous-titre de la clôture" value={cloture.sousTitre} onChange={(patch) => patchClo({ sousTitre: { ...cloture.sousTitre!, ...patch } })} />}
          <div className="ed-field">
            Condition de clôture
            <ConditionEditor cond={cloture.when} kinds={CONDITION_KINDS_CARTE} narratif={narratif} onChange={(when) => patchClo({ when })} />
          </div>
          <button type="button" className="btn small danger" onClick={() => onCloture(undefined)}>
            <Icon id="interface/supprimer" size="sm" /> Retirer la clôture
          </button>
        </>
      )}
    </div>
  );
}

/** Formulaire d'une affaire : identité + titre + description, suppression bloquée si des indices y sont rattachés. */
function AffaireForm({ affaire, refus, refusDe, onRename, onPatch, onRemove }: {
  affaire: Affaire;
  refus: string | undefined;
  refusDe: (candidat: string) => string | null;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Affaire>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <ChampIdStable libelle="Identifiant (id stable)" value={affaire.id} refusDe={refusDe} onRename={onRename} />
      <label className="ed-field">
        Titre
        <input value={affaire.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <ProseField label="Description" value={affaire.desc ?? ''} onChange={(desc) => onPatch({ desc: desc || undefined })} />
      <BoutonRetirer id={`supprimer-affaire-${affaire.id}`} libelle="Supprimer cette affaire" refus={refus} onRemove={onRemove} />
    </div>
  );
}

/** Formulaire d'un document remis au joueur (#679) : identité + titre + prose Markdown VERBATIM + source,
 *  suppression bloquée tant qu'un stade d'indice le croise. */
function DocumentForm({ porteur, doc, refusDe, refus, onRename, onPatch, onRemove }: {
  /** Identité STABLE du document, tenue par `NarratifEditor` à travers ses renommages. */
  porteur: string;
  doc: DocumentNarratif;
  refusDe: (candidat: string) => string | null;
  refus: string | undefined;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<DocumentNarratif>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <ChampIdStable libelle="Identifiant (id stable)" value={doc.id} refusDe={refusDe} onRename={onRename} />
      <label className="ed-field">
        Titre
        <input value={doc.titre} onChange={(e) => onPatch({ titre: e.target.value })} />
      </label>
      <ProseField label="Texte (verbatim de la source, Markdown)" value={doc.prose} onChange={(prose) => onPatch({ prose })} />
      <SourceRefField identite={porteur} label="Source" facultative sujet="du document" value={doc.source} onChange={(source) => onPatch({ source })} />
      <BoutonRetirer id={`supprimer-document-${doc.id}`} libelle="Supprimer ce document" refus={refus} onRemove={onRemove} />
    </div>
  );
}

/** La forme NEUVE d'un état de forme `kind` : une forme à valeurs déclarées en porte une, que l'auteur renomme. */
function formeNeuve(kind: FormeDEtatKind): EtatNarratif['forme'] {
  return (FORMES_D_ETAT[kind].valeursDeclarees ? { kind, valeurs: [{ id: 'valeur-1', label: 'Valeur 1' }] } : { kind }) as EtatNarratif['forme'];
}

/** Formulaire d'un ÉTAT DE CAMPAGNE (#2539) : identité, libellé, provenance (source OU raison maison), forme (`FORMES_D_ETAT`)
 *  et, pour une forme qui les déclare, ses valeurs (id stable + libellé). Changer de forme est refusé tant
 *  qu'une référence désigne l'état (l'usage qu'elle en fait dépend de la forme). */
function EtatForm({ porteur, etat, refusDe, refus, refusDeRenommerValeur, refusDeValeur, onRename, onRenameValeur, onRemoveValeur, onPatch, onRemove }: {
  /** Identité STABLE de l'état, tenue par `NarratifEditor` à travers ses renommages. */
  porteur: string;
  etat: EtatNarratif;
  refusDe: (candidat: string) => string | null;
  refus: string | undefined;
  /** Le refus de renommer une valeur en `candidat` (`refusDeRenommage`). */
  refusDeRenommerValeur: (valeur: string) => (candidat: string) => string | null;
  /** Raison qui refuse de retirer cette valeur (`refusDeRetrait`), ou `undefined`. */
  refusDeValeur: (valeur: string) => string | undefined;
  /** Retire une valeur (`retireDuProjet`). */
  onRemoveValeur: (valeur: string) => void;
  onRename: (nextId: string) => void;
  /** Renomme une valeur ET propage le renommage aux références qui la nomment. */
  onRenameValeur: (from: string, nextId: string) => void;
  onPatch: (patch: Partial<EtatNarratif>) => void;
  onRemove: () => void;
}) {
  const valeurs = valeursDeclarees(etat);
  const clesValeurs = useClesDeRangees(valeurs);
  const setValeurs = (vs: readonly { id: string; label: string }[]) => onPatch({ forme: { ...etat.forme, valeurs: [...vs] } as EtatNarratif['forme'] });
  /** Changer de forme ne perd ni l'usage d'une référence, ni une identité. */
  const refusDeForme = refus ?? (etat.forme.kind === 'heros' && etat.forme.identite ? 'Retirez d’abord l’identité de l’état : une autre forme n’en porte pas.' : undefined);
  return (
    <div>
      <ChampIdStable libelle="Identifiant (id stable)" value={etat.id} refusDe={refusDe} onRename={onRename} />
      <label className="ed-field">
        Libellé
        <input value={etat.label} onChange={(e) => onPatch({ label: e.target.value })} />
      </label>
      <SourceRefField identite={porteur} label="Source" facultative sujet="de l’état" value={etat.source} onChange={(source) => onPatch({ source })} />
      <label className="ed-field">Raison maison de l’état (sans source)
        <input value={etat.maison ?? ''} onChange={(e) => onPatch({ maison: e.target.value || undefined })} />
      </label>
      {!etat.source && !etat.maison && (
        <ChipDeRefus fixe refus={{ message: 'Provenance exigée : la source de l’état, ou sa raison maison ; sans elle le projet est refusé au chargement.' }} />
      )}
      <label className="ed-field">
        Forme
        <select value={etat.forme.kind} disabled={!!refusDeForme} title={refusDeForme} onChange={(e) => onPatch({ forme: formeNeuve(e.target.value as FormeDEtatKind) })}>
          {(Object.keys(FORMES_D_ETAT) as FormeDEtatKind[]).map((k) => <option key={k} value={k}>{FORMES_D_ETAT[k].label}</option>)}
        </select>
      </label>
      {FORMES_D_ETAT[etat.forme.kind].valeursDeclarees && (
        <div className="ed-field">
          <span>Valeurs</span>
          {valeurs.map((v, idx) => (
            <div key={clesValeurs[idx]}>
              <ChampIdStable
                libelle={`Id de la valeur ${idx + 1}`} className="ed-subfield" value={v.id}
                refusDe={refusDeRenommerValeur(v.id)} onRename={(id) => onRenameValeur(v.id, id)}
              />
              <label className="ed-subfield">
                {`Libellé de la valeur ${idx + 1}`}
                <input value={v.label} onChange={(e) => setValeurs(valeurs.map((x) => (x.id === v.id ? { ...x, label: e.target.value } : x)))} />
              </label>
              <BoutonRetirer id={`supprimer-valeur-${etat.id}-${v.id}`} libelle={`Supprimer la valeur ${idx + 1}`} refus={refusDeValeur(v.id)} onRemove={() => onRemoveValeur(v.id)} />
            </div>
          ))}
          <button type="button" className="btn small" onClick={() => setValeurs([...valeurs, { id: idFrais('valeur', valeurs), label: `Valeur ${valeurs.length + 1}` }])}>
            <Icon id="interface/ajouter" size="sm" /> Ajouter une valeur
          </button>
        </div>
      )}
      {etat.forme.kind === 'heros' && (
        etat.forme.identite
          ? <IdentiteForm porteur={porteur} identite={etat.forme.identite} onChange={(identite) => onPatch({ forme: identite ? { kind: 'heros', identite } : { kind: 'heros' } })} />
          : (
            <button type="button" className="btn small" onClick={() => onPatch({ forme: { kind: 'heros', identite: identiteNeuve() } })}>
              <Icon id="interface/ajouter" size="sm" /> Ajouter une identité
            </button>
          )
      )}
      <BoutonRetirer id={`supprimer-etat-${etat.id}`} libelle="Supprimer cet état" refus={refus} onRemove={onRemove} />
    </div>
  );
}

type Identite = z.infer<typeof identiteSchema>;
type LigneDIdentite = Identite['lignes'][number];
type ValeurDIdentite = LigneDIdentite['valeurs'][number];

/** Une identité neuve : une ancre, le repère qui la porte, aucune ligne. */
const identiteNeuve = (): Identite => ({ ancres: ['Nom'], reperes: [{ id: 'repere-1', fragment: 'Nom' }], lignes: [] });

const COUPLES_D_IDENTITE: readonly { espece: RaceKey; sexe: Sexe }[] = raceKeySchema.options.flatMap((espece) => sexeSchema.options.map((sexe) => ({ espece, sexe })));
const libelleDeLigne = (l: { espece: RaceKey; sexe: Sexe }): string => `${t(`espece.individu.${l.espece}`)} ${libelleDeValeur(sexeSchema, l.sexe).toLowerCase()}`;

/** IDENTITÉ d'un état `heros` (EDO 02 l.112-127) : ancres, repères (id stable + fragment verbatim du paquet) et, par
 *  espèce et sexe, la valeur de chaque repère et sa provenance. Un renommage de repère suit dans chaque ligne ; un
 *  repère dont une valeur est saisie ne se retire pas. */
function IdentiteForm({ porteur, identite, onChange }: { porteur: string; identite: Identite; onChange: (identite: Identite | undefined) => void }) {
  const clesAncres = useClesDeRangees(identite.ancres);
  const clesReperes = useClesDeRangees(identite.reperes);
  const clesLignes = useClesDeRangees(identite.lignes);
  const fautes = validateDocument(identiteSchema, identite) ?? [];
  const poser = (patch: Partial<Identite>) => onChange({ ...identite, ...patch });
  const setLigne = (j: number, ligne: LigneDIdentite) => poser({ lignes: identite.lignes.map((l, k) => (k === j ? ligne : l)) });
  const renommerRepere = (de: string, vers: string) => poser({
    reperes: identite.reperes.map((r) => (r.id === de ? { ...r, id: vers } : r)),
    lignes: identite.lignes.map((l) => ({ ...l, valeurs: l.valeurs.map((v) => (v.repere === de ? { ...v, repere: vers } : v)) })),
  });
  const retirerRepere = (id: string) => poser({
    reperes: identite.reperes.filter((r) => r.id !== id),
    lignes: identite.lignes.map((l) => ({ ...l, valeurs: l.valeurs.filter((v) => v.repere !== id) })),
  });
  const ajouterRepere = () => {
    const id = idFrais('repere', identite.reperes);
    poser({ reperes: [...identite.reperes, { id, fragment: '' }], lignes: identite.lignes.map((l) => ({ ...l, valeurs: [...l.valeurs, { repere: id, valeur: '' }] })) });
  };
  const refusDuRepere = (id: string): string | undefined => {
    if (identite.reperes.length <= 1) return 'Une identité garde au moins un repère.';
    const saisies = identite.lignes.filter((l) => l.valeurs.some((v) => v.repere === id && v.valeur.trim())).map(libelleDeLigne);
    return saisies.length ? `Valeur saisie pour : ${saisies.join(', ')} — videz-la d’abord.` : undefined;
  };
  const libre = COUPLES_D_IDENTITE.find((c) => !identite.lignes.some((l) => l.espece === c.espece && l.sexe === c.sexe));
  const ajouterLigne = () => {
    if (!libre) return;
    poser({ lignes: [...identite.lignes, { ...libre, valeurs: identite.reperes.map((r) => ({ repere: r.id, valeur: '' })) }] });
  };
  return (
    <div className="ed-field">
      <span>Identité</span>
      {identite.ancres.map((a, i) => (
        <div key={clesAncres[i]}>
          <label className="ed-subfield">
            {`Ancre ${i + 1}`}
            <input value={a} onChange={(e) => poser({ ancres: identite.ancres.map((x, k) => (k === i ? e.target.value : x)) })} />
          </label>
          <BoutonRetirer id={`supprimer-ancre-${porteur}-${clesAncres[i]}`} libelle={`Supprimer l’ancre ${i + 1}`} refus={identite.ancres.length <= 1 ? 'Une identité garde au moins une ancre.' : undefined} onRemove={() => poser({ ancres: identite.ancres.filter((_, k) => k !== i) })} />
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => poser({ ancres: [...identite.ancres, ''] })}>
        <Icon id="interface/ajouter" size="sm" /> Ajouter une ancre
      </button>
      {identite.reperes.map((r, i) => (
        <div key={clesReperes[i]}>
          <ChampIdStable
            libelle={`Id du repère ${i + 1}`} className="ed-subfield" value={r.id}
            refusDe={(c) => refusDId(r.id, c.trim(), (x) => { const j = identite.reperes.findIndex((y) => y.id !== r.id && y.id === x); return j >= 0 ? `le repère ${j + 1}` : null; })}
            onRename={(id) => renommerRepere(r.id, id)}
          />
          <label className="ed-subfield">
            {`Fragment du repère ${i + 1}`}
            <input value={r.fragment} onChange={(e) => poser({ reperes: identite.reperes.map((x) => (x.id === r.id ? { ...x, fragment: e.target.value } : x)) })} />
          </label>
          <BoutonRetirer id={`supprimer-repere-${porteur}-${r.id}`} libelle={`Supprimer le repère ${i + 1}`} refus={refusDuRepere(r.id)} onRemove={() => retirerRepere(r.id)} />
        </div>
      ))}
      <button type="button" className="btn small" onClick={ajouterRepere}>
        <Icon id="interface/ajouter" size="sm" /> Ajouter un repère
      </button>
      {identite.lignes.map((l, j) => (
        <div key={clesLignes[j]}>
          <label className="ed-subfield">
            {`Espèce de la ligne ${j + 1}`}
            <select value={l.espece} onChange={(e) => setLigne(j, { ...l, espece: e.target.value as RaceKey })}>
              {raceKeySchema.options.map((k) => <option key={k} value={k}>{t(`espece.individu.${k}`)}</option>)}
            </select>
          </label>
          <label className="ed-subfield">
            {`Sexe de la ligne ${j + 1}`}
            <select value={l.sexe} onChange={(e) => setLigne(j, { ...l, sexe: e.target.value as Sexe })}>
              {sexeSchema.options.map((v) => <option key={v} value={v}>{libelleDeValeur(sexeSchema, v)}</option>)}
            </select>
          </label>
          {identite.reperes.map((r) => {
            const k = l.valeurs.findIndex((x) => x.repere === r.id);
            const v: ValeurDIdentite = k >= 0 ? l.valeurs[k] : { repere: r.id, valeur: '' };
            const setValeur = (patch: Partial<Omit<ValeurDIdentite, 'repere'>>) => setLigne(j, { ...l, valeurs: k >= 0 ? l.valeurs.map((x, n) => (n === k ? { ...x, ...patch } : x)) : [...l.valeurs, { ...v, ...patch }] });
            const nomDuRepere = r.fragment.trim() && identite.reperes.filter((x) => x.fragment === r.fragment).length === 1 ? r.fragment : r.id;
            const sujet = `de « ${nomDuRepere} » (${libelleDeLigne(l)})`;
            return (
              <div key={r.id}>
                <label className="ed-subfield">
                  {`Valeur ${sujet}`}
                  <input value={v.valeur} onChange={(e) => setValeur({ valeur: e.target.value })} />
                </label>
                <ProvenanceDuTexte copie identite={`${porteur}/identite/${clesLignes[j]}/${r.id}`} sujet={sujet} value={v} onChange={setValeur} />
              </div>
            );
          })}
          <BoutonRetirer id={`supprimer-ligne-${porteur}-${clesLignes[j]}`} libelle={`Supprimer la ligne ${j + 1}`} refus={undefined} onRemove={() => poser({ lignes: identite.lignes.filter((_, k) => k !== j) })} />
        </div>
      ))}
      <GatedAction
        id={`ajouter-ligne-${porteur}`}
        label={<><Icon id="interface/ajouter" size="sm" /> Ajouter une ligne</>}
        enabled={!!libre}
        {...raisonSi(libre ? undefined : 'Chaque espèce et chaque sexe a déjà sa ligne.')}
        onClick={ajouterLigne}
        primary={false}
        btnClassName="small"
      />
      {fautes.map((f, i) => <ChipDeRefus key={i} fixe refus={{ message: `${cheminLisible(f.lieu)} : ${f.message}` }} />)}
      <BoutonRetirer id={`supprimer-identite-${porteur}`} libelle="Retirer l’identité" refus={undefined} onRemove={() => onChange(undefined)} />
    </div>
  );
}

/** Retrait d'une entrée du narratif, REFUSÉ tant qu'une référence la désigne : la raison nomme les
 *  lieux qui la désignent (`refusDeRetrait`). */
function BoutonRetirer({ id, libelle, refus, onRemove }: { id: string; libelle: string; refus: string | undefined; onRemove: () => void }) {
  return (
    <GatedAction
      id={id}
      label={<><Icon id="interface/supprimer" size="sm" /> {libelle}</>}
      enabled={!refus}
      {...raisonSi(refus)}
      onClick={onRemove}
      primary={false}
      btnClassName="small danger"
    />
  );
}

/** Formulaire d'un indice/rumeur : identité + affaire + nature + titre + recoupements + stades révélables. */
function IndiceForm({ porteur, indice, narratif, affaires, otherIndices, refusDe, onRename, onPatch, refusDeRenommerStade, onRenameStade, refusDeStade, onRemoveStade, refus, onRemove }: {
  /** Identité STABLE de l'indice, tenue par `NarratifEditor` à travers ses renommages. */
  porteur: string;
  indice: Indice;
  narratif: NarratifBlock;
  affaires: Affaire[];
  otherIndices: Indice[];
  refusDe: (candidat: string) => string | null;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<Indice>) => void;
  /** Le refus de renommer un stade en `candidat` (`refusDeRenommage`). */
  refusDeRenommerStade: (stade: string) => (candidat: string) => string | null;
  /** Renomme un stade ET propage le renommage aux Effects qui le désignent. */
  onRenameStade: (from: string, nextId: string) => void;
  /** Raison qui refuse de retirer ce stade (`refusDeRetrait`), ou `undefined`. */
  refusDeStade: (stade: string) => string | undefined;
  /** Retire un stade (`retireDuProjet`). */
  onRemoveStade: (stade: string) => void;
  refus: string | undefined;
  onRemove: () => void;
}) {
  const toggleRef = (id: string) => {
    const refs = indice.refs ?? [];
    const next = refs.includes(id) ? refs.filter((r) => r !== id) : [...refs, id];
    onPatch({ refs: next.length ? next : undefined });
  };

  const setStades = (stades: IndiceStade[]) => onPatch({ stades });
  const addStade = () => setStades([...indice.stades, { id: idFrais('stade', indice.stades), prose: '' }]);
  const updateStade = (id: string, patch: Partial<IndiceStade>) => {
    setStades(indice.stades.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };
  const clesStades = useClesDeRangees(indice.stades);

  return (
    <div>
      <ChampIdStable libelle="Identifiant (id stable)" value={indice.id} refusDe={refusDe} onRename={onRename} />
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
              refusDe={refusDeRenommerStade(s.id)} onRename={(id) => onRenameStade(s.id, id)}
            />
            {/* Au moins la prose ou le document (`raffineNarratif`). */}
            <ProseField
              label={`Prose (stade ${idx + 1}${s.documentId ? ', facultative : le stade croise un document' : ''})`}
              value={s.prose ?? ''}
              onChange={(prose) => updateStade(s.id, { prose: prose || !s.documentId ? prose : undefined })}
            />
            <RefNarrativeField
              cle="documentId"
              narratif={narratif}
              label={`Document croisé du stade ${idx + 1}`}
              value={s.documentId}
              onChange={(documentId) => updateStade(s.id, { documentId, prose: documentId ? s.prose : (s.prose ?? '') })}
              nullable
            />
            <ProvenanceDuTexte identite={`${porteur}/stade:${clesStades[idx]}`} copie sujet={`du stade ${idx + 1}`} value={s} onChange={(p) => updateStade(s.id, p)} />
            <BoutonRetirer id={`supprimer-stade-${indice.id}-${s.id}`} libelle={`Supprimer le stade ${idx + 1}`} refus={refusDeStade(s.id)} onRemove={() => onRemoveStade(s.id)} />
          </div>
        ))}
        <button type="button" className="btn small" onClick={addStade}>
          <Icon id="interface/ajouter" size="sm" /> Ajouter un stade
        </button>
      </div>
      <BoutonRetirer id={`supprimer-indice-${indice.id}`} libelle="Supprimer cet indice" refus={refus} onRemove={onRemove} />
    </div>
  );
}

type OngletDuPnj = 'profil' | 'apparence' | 'couverture';

/** Rubriques du formulaire d'un PNJ (AGENTS.md, règle stricte 4). */
const ongletsDuPnj = (preset: PresetPnj): TabItem<OngletDuPnj>[] => [
  { key: 'profil', label: 'Profil' },
  { key: 'apparence', label: 'Apparence' },
  { key: 'couverture', label: 'Couverture', count: preset.couvre?.length ?? 0 },
];

/** Formulaire d'un preset de PNJ, en onglets : profil (identité, base, caracs, source), apparence (réglages,
 *  portrait), couverture des entrées de fiche. */
function PresetForm({ porteur, preset, refusDe, onRename, onPatch, refus, onRemove, narratif }: {
  narratif: NarratifBlock;
  /** Identité STABLE du PNJ, tenue par `NarratifEditor` à travers ses renommages. */
  porteur: string;
  preset: PresetPnj;
  refusDe: (candidat: string) => string | null;
  onRename: (nextId: string) => void;
  onPatch: (patch: Partial<PresetPnj>) => void;
  refus: string | undefined;
  onRemove: () => void;
}) {
  const profil = preset.profil ?? {};
  const appearance: EntityAppearance = preset.apparence ?? {};
  const base = preset.base ? findCreatureById(preset.base.id) : undefined;
  const fusion = base ? mergeCreatureProfile(base, profil) : profil;
  const descAdressee = estDerive({ ...profil }, 'desc');
  const { descRef } = profil;

  /** `profil` patché : une clé à `undefined` se retire, et `profil` vide aussi. */
  const profilPatche = (patch: Partial<CreatureData>): Partial<CreatureData> | undefined => {
    const next = Object.fromEntries(Object.entries({ ...profil, ...patch }).filter(([, v]) => v !== undefined)) as Partial<CreatureData>;
    return Object.keys(next).length ? next : undefined;
  };
  const patchProfil = (patch: Partial<CreatureData>) => onPatch({ profil: profilPatche(patch) });
  /** Surcharge d'une carac (vide = héritée de la base) — retire `char` s'il redevient vide. */
  const setChar = (k: CharKey, v: number | null) => {
    const char = { ...(profil.char ?? {}) };
    if (v == null) delete char[k];
    else char[k] = v;
    patchProfil({ char: Object.keys(char).length ? char : undefined });
  };
  /** Pose l'apparence suivante (retire `apparence` si elle redevient vide). */
  const poserApparence = (next: EntityAppearance) =>
    onPatch({ apparence: Object.keys(next).length ? (next as PresetPnj['apparence']) : undefined });
  const [onglet, setOnglet] = useState<OngletDuPnj>('profil');

  return (
    <Stack>
      <Tabs tabs={ongletsDuPnj(preset)} active={onglet} onChange={setOnglet} label="Rubriques du PNJ" />
      <div>
        {onglet === 'profil' && (
          <>
            <ChampIdStable libelle="Identifiant (id stable)" value={preset.id} refusDe={refusDe} onRename={onRename} />
            <label className="ed-field">
              Créature de base (profil de combat)
              <select value={preset.base?.id ?? ''} onChange={(e) => onPatch({ base: e.target.value ? { id: e.target.value } : undefined })}>
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
            <ProseField label="Description" lecture={descAdressee ? profil.desc ?? '' : undefined} value={profil.desc ?? ''} onChange={(desc) => patchProfil({ desc: desc || undefined })} />
            <ProvenanceDuTexte
              identite={porteur} copie sujet="du PNJ" value={preset} onChange={onPatch}
              adresseEmbarquee={{ descRef, onDetacher: (provenance) => onPatch({ ...provenance, profil: profilPatche({ descRef: undefined }) }) }}
            />
          </>
        )}
        {onglet === 'apparence' && (
          <>
            <div className="ed-field">
              <span>Apparence</span>
              <ReglagesApparence appearance={appearance} onChange={poserApparence} reglages={['species', 'sex']} />
            </div>
            <ApparencesObjetsField resolveTrapping={objetDuNarratif(narratif)} appearance={appearance} onChange={poserApparence}
              weapons={armesDEntite(objetDuNarratif(narratif), undefined, { traits: fusion.traits, char: fusion.char })} />
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
        <BoutonRetirer id={`supprimer-preset-${preset.id}`} libelle="Supprimer ce PNJ" refus={refus} onRemove={onRemove} />
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
                {sansMotif && <ChipDeRefus fixe id={alerte} refus={{ message: 'Motif requis.' }} />}
              </div>
            );
          })}
      <SelecteurDEntreeDeFiche value="" exclues={prises} libelle="Écarter une entrée de fiche" onChoisir={(entree) => poser([...ecartes, { entree, motif: '' }])} />
    </div>
  );
}
