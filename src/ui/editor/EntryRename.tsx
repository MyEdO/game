import { SaisieEnBrouillon } from '../compendium/refField/SaisieEnBrouillon';

/** Renommage d'un id STABLE (point d'entrée, zone d'effet, scène, trigger, rencontre…), en BROUILLON
 *  (`SaisieEnBrouillon`) posé au blur ou à Entrée. L'atelier RÉUTILISE l'instance d'un objet sélectionné au suivant : le brouillon
 *  tombe dès que l'id AFFICHÉ change, jamais recopié sur l'objet suivant. Le champ ne garde jamais un id
 *  que le document a REFUSÉ (doublon) : posé, le brouillon cède la place à l'id en vigueur. */
export function EntryRename({ label, caption = 'Nom (référencé par les transitions)', onRename }: { label: string; caption?: string; onRename: (next: string) => void }) {
  return (
    <label className="ed-field">
      {caption}
      <SaisieEnBrouillon
        value={label} afficher={(x) => x} relire={(t, avant) => t.trim() || avant}
        onChange={(n) => { if (n !== label) onRename(n); }} />
    </label>
  );
}
