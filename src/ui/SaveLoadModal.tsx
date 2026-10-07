import { useEffect, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { listSaves, readSlot, deleteSlot, exportSave, takeObsoleteNotice, SAVE_SLOTS, AUTO_SLOT, type SaveSlot, type AnySlot, type SaveMeta, type ObsoleteCause, type RetraitDeSave } from '../state/saves';
import { downloadText } from '../lib/fileIo';
import { GameDate } from './GameDate';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { ChipDeRefus } from './ChipDeRefus';
import { Stack } from './Layout';
import { t, type MsgKey } from '../i18n';

/**
 * Sauvegarde / chargement (Jalon 5) — 3 emplacements manuels + 1 emplacement AUTO (écrit aux
 * checkpoints d'entrée de scène), localStorage + export/import JSON. `mode 'save'` (en jeu, hors
 * combat) écrit dans les slots manuels ; `mode 'load'` ne propose que Charger/Exporter/Supprimer.
 * L'emplacement AUTO est CHARGEABLE mais jamais écrit à la main (pas de bouton Sauvegarder).
 */
const autoMetaOf = (): SaveMeta | null => {
  const s = readSlot(AUTO_SLOT);
  return s ? { version: s.version, savedAt: s.savedAt, sceneLabel: s.sceneLabel, gameTime: s.gameTime } : null;
};

/** Message du joueur par CAUSE de rejet (`ObsoleteCause`) : l'autre format et le contenu illisible ne
 *  se disent pas d'un même mot. */
const OBSOLETE_MSG: Record<ObsoleteCause, MsgKey> = {
  autreFormat: 'saveload.error.autreFormat',
  illisible: 'saveload.error.unreadable',
};

/** Le nom, dans un message, d'un emplacement de sauvegarde. */
const nomDEmplacement = (slot: AnySlot): string =>
  (slot === AUTO_SLOT ? t('saveload.slot.auto.nom') : t('saveload.slot.label', { n: slot }));

/** Le message d'un import refusé, par cause. */
const IMPORT_MSG: Record<ObsoleteCause, MsgKey> = {
  autreFormat: 'saveload.error.import.autreFormat',
  illisible: 'saveload.error.import',
};

export function SaveLoadModal({ mode, onClose }: { mode: 'save' | 'load'; onClose: () => void }) {
  const saveGame = useGame((s) => s.saveGame);
  const loadGame = useGame((s) => s.loadGame);
  const importGame = useGame((s) => s.importGame);
  const [metas, setMetas] = useState(listSaves());
  const [autoMeta, setAutoMeta] = useState(autoMetaOf);
  const [error, setError] = useState<string | null>(null);
  const [retraits, setRetraits] = useState<readonly RetraitDeSave[]>([]);
  const noterLesRetraits = () => {
    const neufs = takeObsoleteNotice();
    if (neufs.length) setRetraits((dits) => [...dits.filter((d) => !neufs.some((n) => n.slot === d.slot)), ...neufs]);
  };
  const fileRef = useRef<HTMLInputElement>(null);
  // Une save dont la version diffère de `FORMAT_SAVE` est retirée du stockage à la lecture
  // (`readSlot`) : le témoin, posé par la lecture qui l'a jetée (`listSaves` ci-dessus, ou l'écran
  // d'accueil), devient ICI le message au joueur — sans quoi l'emplacement se viderait en silence.
  // La consommation est un EFFET, jamais un initialiseur de rendu : sous `<React.StrictMode>` (le
  // montage réel, `main.tsx`) le corps est joué DEUX fois, et la 2ᵉ passe — qui trouverait le témoin
  // déjà consommé — retiendrait `null`. L'effet ne fait que POSER un message, jamais l'effacer : son
  // double-appel StrictMode est donc sans effet.
  useEffect(() => { noterLesRetraits(); }, []);
  const refresh = () => {
    setMetas(listSaves());
    setAutoMeta(autoMetaOf());
    noterLesRetraits();
  };

  const onSave = (slot: SaveSlot) => { setError(saveGame(slot) ? null : t('saveload.error.save')); refresh(); };
  const onLoad = (slot: AnySlot) => { if (loadGame(slot)) onClose(); else setError(t('saveload.error.load')); };
  const onExport = (slot: AnySlot) => { const save = readSlot(slot); if (save) downloadText(`wfrp4-sauvegarde-${slot}.json`, exportSave(save)); };
  const onDelete = (slot: AnySlot) => { deleteSlot(slot); refresh(); };
  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    const json = await file.text();
    const refus = importGame(json);
    if (refus) setError(t(IMPORT_MSG[refus]));
    else onClose();
  };

  // Une RANGÉE de slot — partagée par les emplacements manuels (1-3) ET l'emplacement AUTO. `canSave`
  // = bouton Sauvegarder (manuel + mode save) ; l'AUTO ne l'a jamais (écrit par le jeu, pas à la main).
  const slotRow = (slot: AnySlot, label: string, m: SaveMeta | null, canSave: boolean) => (
    <div className="save-slot" key={String(slot)}>
      <div className="save-slot-meta">
        <strong>{label}</strong>
        {m ? (
          <span className="save-slot-info">{m.sceneLabel} · <GameDate time={m.gameTime} /> · {new Date(m.savedAt).toLocaleString('fr-FR')}</span>
        ) : (
          <span className="save-slot-info empty">{t('saveload.slot.empty')}</span>
        )}
      </div>
      <div className="save-slot-actions">
        {canSave && (
          <button type="button" className="btn small btn-primary" onClick={() => onSave(slot as SaveSlot)}>{t('saveload.btn.save')}</button>
        )}
        {m && (
          <>
            <button type="button" className="btn small" onClick={() => onLoad(slot)}>{t('saveload.btn.load')}</button>
            <button type="button" className="btn small" onClick={() => onExport(slot)} title={t('saveload.btn.export.title')}>{t('saveload.btn.export')}</button>
            <button type="button" className="btn small" onClick={() => onDelete(slot)} title={t('saveload.btn.delete.title')}>{t('saveload.btn.delete')}</button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      title={<><Icon id={mode === 'save' ? 'file/save' : 'file/open'} /> {mode === 'save' ? t('saveload.title.save') : t('saveload.title.load')}</>}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn small" onClick={() => fileRef.current?.click()} title={t('saveload.import.btn.title')}>
            <Icon id="file/import" /> {t('saveload.import.btn')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => void onImportFile(e.target.files?.[0])}
          />
          <button type="button" className="btn" onClick={onClose}>{t('saveload.btn.close')}</button>
        </>
      }
    >
      <div className="save-slots">
        {SAVE_SLOTS.map((slot) => slotRow(slot, t('saveload.slot.label', { n: slot }), metas[slot - 1], mode === 'save'))}
        {autoMeta && slotRow(AUTO_SLOT, 'Auto ⟳', autoMeta, false)}
      </div>
      {(retraits.length > 0 || error) && (
        <Stack>
          {retraits.map((r) => (
            <ChipDeRefus key={String(r.slot)} refus={{ message: t(OBSOLETE_MSG[r.cause], { emplacement: nomDEmplacement(r.slot) }) }} />
          ))}
          {error && <ChipDeRefus refus={{ message: error }} />}
        </Stack>
      )}
    </Modal>
  );
}
