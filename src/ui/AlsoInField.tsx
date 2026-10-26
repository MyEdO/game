import { useState } from 'react';
import { SourceRefField, useSaisieEnCours } from './SourceRefField';
import type { SecondaryRef } from '../data/schemas/grammaire/valeurs';

/** Une rangée de `AlsoInField` : `valeur` = réf COMPLÈTE émise ; absente, la rangée est un BROUILLON
 *  local, dont la citation déjà saisie attend dans `quote`. `cle` = identité stable de la rangée. */
type RangeeAlsoIn = { cle: number; valeur?: SecondaryRef; quote?: string };

/** Emplacements SECONDAIRES d'une entrée réimprimée ailleurs (`alsoIn: SecondaryRef[]`, #563, doctrine
 *  user 2026-07-17 — « jamais 2 talents différents »). L'ANCRE (`source`) reste seule à porter la
 *  `desc` (règle stricte 5) ; chaque rangée secondaire = `{book,page,note?}` + `quote` (preuve
 *  verbatim, obligatoire si le label n'est pas imprimé tel quel dans ce span). La liste n'ÉMET que ses
 *  rangées complètes, contrat de `SourceRefField` (#1993). */
export function AlsoInField({ chemin, value, onChange }: { chemin: string; value: SecondaryRef[] | undefined; onChange: (v: SecondaryRef[]) => void }) {
  const [rangees, setRangees] = useState<RangeeAlsoIn[]>(() => (value ?? []).map((valeur, cle) => ({ cle, valeur })));
  const [prochaine, setProchaine] = useState(() => value?.length ?? 0);
  // Resynchronisation sur une valeur EXTERNE nouvelle ; la liste que le champ vient d'émettre (vide,
  // le porteur la pose `undefined`) ne l'écrase pas, et ses brouillons survivent.
  const [precedente, setPrecedente] = useState(value);
  const [emise, setEmise] = useState<SecondaryRef[] | undefined>(value);
  if (precedente !== value) {
    setPrecedente(value);
    if (value !== emise && !(value === undefined && emise?.length === 0)) {
      setRangees((value ?? []).map((valeur, i) => ({ cle: prochaine + i, valeur })));
      setProchaine(prochaine + (value?.length ?? 0));
    }
  }
  const poser = (suivantes: RangeeAlsoIn[], emettre: boolean) => {
    setRangees(suivantes);
    if (!emettre) return;
    const liste = suivantes.flatMap((r) => (r.valeur ? [r.valeur] : []));
    setEmise(liste);
    onChange(liste);
  };
  const remplacer = (cle: number, r: RangeeAlsoIn) => rangees.map((x) => (x.cle === cle ? r : x));
  useSaisieEnCours(rangees.some((r) => !r.valeur && r.quote !== undefined));
  const ajouter = () => {
    poser([...rangees, { cle: prochaine }], false);
    setProchaine(prochaine + 1);
  };
  return (
    <div className="ed-field">
      <span>Autres emplacements dans les livres — la description se lit à la source principale ci-dessus</span>
      {rangees.map((r, i) => (
        <div className="ed-field" key={r.cle}>
          <SourceRefField identite={`${chemin}/${r.cle}`} label={`Emplacement ${i + 1}`} sujet={`de l'emplacement ${i + 1}`} value={r.valeur} onChange={(v) => poser(remplacer(r.cle, { cle: r.cle, valeur: r.valeur || !r.quote ? v : { ...v, quote: r.quote } }), true)} />
          <div className="fieldrow">
            <input aria-label={`Citation de l'emplacement ${i + 1}`} placeholder="citation verbatim — preuve du span (obligatoire si le label n'y est pas imprimé)" value={(r.valeur ? r.valeur.quote : r.quote) ?? ''} onChange={(e) => {
              const quote = e.target.value || undefined;
              poser(remplacer(r.cle, r.valeur ? { cle: r.cle, valeur: { ...r.valeur, quote } } : { cle: r.cle, quote }), r.valeur !== undefined);
            }} />
            <button className="btn small danger" aria-label={`Retirer l'emplacement ${i + 1}`} title="Retirer" onClick={() => poser(rangees.filter((x) => x.cle !== r.cle), r.valeur !== undefined)}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={ajouter}>+ Emplacement secondaire</button>
    </div>
  );
}
