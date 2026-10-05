import { ListRow } from '../ListRow';
import { coupeAuMot } from '../../lib/coupeAuMot.mjs';
import { LIBELLES_DE_FAMILLE, nomDeFiche } from '../../data/source/dossier';
import { ENTREES_DE_DOSSIER } from '../../data/dossiers';

/**
 * Lien « élément du paquet → entrée de fiche de dossier de chapitre » (#2290) : `couvre`
 * (`couvreSchema`, `src/data/schemas/defs-scenes/communs.ts`) et `narratif.ecartes[].entree`. Les
 * entrées offertes sont celles des fiches COMMITÉES (`ENTREES_DE_DOSSIER`, `src/data/dossiers.ts`).
 */

interface OptionDEntree {
  /** Identifiant GLOBAL `<ABBR>-<NN>#<id>`. */
  id: string;
  /** Texte court de l'entrée. */
  court: string;
  /** Texte ENTIER de l'entrée, infobulle du texte court. */
  libelle: string;
}

interface GroupeDEntrees {
  libelle: string;
  options: OptionDEntree[];
}

/** Un groupe par fiche et par famille, dans l'ordre des entrées. */
const GROUPES: readonly GroupeDEntrees[] = [
  ...ENTREES_DE_DOSSIER.reduce((groupes, e) => {
    const libelle = `${nomDeFiche(e.abbr, e.nn)} · ${LIBELLES_DE_FAMILLE[e.famille]}`;
    const groupe = groupes.get(libelle) ?? { libelle, options: [] };
    groupe.options.push({ id: e.id, court: coupeAuMot(e.libelle, 70), libelle: e.libelle });
    return groupes.set(libelle, groupe);
  }, new Map<string, GroupeDEntrees>()).values(),
];
const PAR_ID = new Map(GROUPES.flatMap((g) => g.options.map((o) => [o.id, o] as const)));

/** Sélecteur d'UNE entrée de fiche : `value` vide = aucun choix (rangée d'ajout). Une valeur absente
 *  des fiches commitées reste affichée, dite introuvable. Une entrée de `exclues` autre que `value`
 *  n'est jamais relayée : la liste ne reçoit pas de doublon. */
export function SelecteurDEntreeDeFiche({ value, exclues, libelle, onChoisir }: {
  value: string;
  /** Entrées déjà prises ailleurs dans la même liste : offertes mais désactivées, jamais relayées. */
  exclues: ReadonlySet<string>;
  /** Nom accessible du sélecteur. */
  libelle: string;
  onChoisir: (id: string) => void;
}) {
  return (
    <select aria-label={libelle} title={PAR_ID.get(value)?.libelle} value={value} onChange={(e) => {
      const id = e.target.value;
      if (id && (id === value || !exclues.has(id))) onChoisir(id);
    }}>
      {value === '' && <option value="">— choisir une entrée de fiche —</option>}
      {value !== '' && !PAR_ID.has(value) && <option value={value}>{`${value} (introuvable dans les fiches)`}</option>}
      {GROUPES.map((g) => (
        <optgroup key={g.libelle} label={g.libelle}>
          {g.options.map((o) => (
            <option key={o.id} value={o.id} title={o.libelle} disabled={o.id !== value && exclues.has(o.id)}>{`${o.id} — ${o.court}`}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** `couvre` d'un élément du paquet : la liste de ses entrées couvertes, un retrait ✕ par rangée, un
 *  sélecteur d'ajout. Une liste vidée se retire (`undefined`). */
export function CouvreField({ value, onChange, sujet }: {
  value: readonly string[] | undefined;
  onChange: (next: string[] | undefined) => void;
  /** Complément des noms accessibles (« du PNJ »). */
  sujet: string;
}) {
  const ids = value ?? [];
  const poser = (next: string[]) => onChange(next.length ? next : undefined);
  return (
    <div className="ed-field">
      <span>Entrées de fiche couvertes</span>
      {ids.length === 0
        ? <p className="empty">Aucune entrée de fiche couverte.</p>
        : ids.map((id) => (
            <ListRow key={id} label={PAR_ID.get(id)?.court ?? 'Entrée introuvable dans les fiches'} title={PAR_ID.get(id)?.libelle}>
              <span className={PAR_ID.has(id) ? 'chip' : 'chip tone-warn'}>{id}</span>
              <button type="button" className="btn small danger" aria-label={`Retirer ${id} ${sujet}`} title="Retirer" onClick={() => poser(ids.filter((x) => x !== id))}>
                ✕
              </button>
            </ListRow>
          ))}
      <SelecteurDEntreeDeFiche value="" exclues={new Set(ids)} libelle={`Ajouter une entrée de fiche couverte ${sujet}`} onChoisir={(id) => poser([...ids, id])} />
    </div>
  );
}
