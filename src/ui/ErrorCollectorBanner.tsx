import { useEffect, useState } from 'react';
import { errorEntries, exportErrorsJson, subscribeErrors, type ErrorEntry } from './errorCollector';
import { Modal } from './Modal';

function downloadJson(json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wfrp-erreurs-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Bandeau discret DEV uniquement (#304) : compteur d'erreurs collectées, clic → panneau + export
 *  (presse-papier + téléchargement) prêt à coller dans une issue. Chargé en chunk async depuis
 *  `App.tsx` (garde `import.meta.env.DEV`) : zéro poids dans le bundle de PROD. */
export function ErrorCollectorBanner() {
  const [entries, setEntries] = useState<ErrorEntry[]>(() => errorEntries());
  const [open, setOpen] = useState(false);
  useEffect(() => subscribeErrors(() => setEntries(errorEntries())), []);
  if (!entries.length) return null;

  const exportAll = () => {
    const json = exportErrorsJson();
    navigator.clipboard?.writeText(json).catch(() => {});
    downloadJson(json);
  };

  return (
    <>
      <button type="button" className="error-collector-badge" onClick={() => setOpen((v) => !v)}>
        {entries.length} erreur{entries.length > 1 ? 's' : ''} (DEV)
      </button>
      {open && (
        <Modal title="Erreurs collectées (session)" onClose={() => setOpen(false)} backdropClose
          footer={
            <>
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Fermer</button>
              <button type="button" className="btn" onClick={exportAll}>Exporter (JSON + presse-papier)</button>
            </>
          }
        >
          <ul className="error-collector-list">
            {entries.map((e, i) => (
              <li key={i}>
                <div className="error-collector-msg">{e.message}</div>
                <div className="error-collector-meta">
                  {e.at} · scène {e.scene ?? '—'} · v{e.version}
                </div>
                {e.stack && <pre className="error-collector-stack">{e.stack}</pre>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
