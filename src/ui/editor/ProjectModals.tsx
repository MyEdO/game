import { useState } from 'react';
import { Modal } from '../Modal';
import { GatedAction } from '../GatedAction';
import { Icon } from '../Icon';
import { ListRow } from '../ListRow';
import { Scene } from '../../state/scene';
import { testScenarios, TestScenario } from '../../scenes/test-scenarios';
import { projectsLoad, projectRemove, nomDeProjet, estRefusee, type EntreeListee, IMPORT_FORME_DEPOT, MARQUE_AUTRE_FORMAT } from '../../state/projectLibrary';
import { ChipDeRefus, type RefusRendu } from '../ChipDeRefus';
import { allBuiltinCampaigns, BuiltinCampaign } from '../../scenes/campaign';
import { Row, Stack } from '../Layout';
import { exigerUnRefus, PROJET_AUTRE_FORMAT, SCENE_AUTRE_FORMAT, type CauseDeRefus } from '../../state/worldMap';
import { cheminLisible, type Faute, type SegmentDeLieu } from '../../data/schemas/validate';
import { projetDoc } from '../../data/schemas/defs-scenes/projet';

/**
 * Les gestes qui font passer un document par la porte du projet (`parseProject`, et
 * `parseSceneDeProjet` pour la reprise d'une sauvegarde locale), chacun avec le VERBE de son
 * refus, ce qu'il dit d'un document SANS NOM, le TERME du document d'un autre format
 * (`autreFormat`), la PHRASE de chaque cause hors schéma (`causes`), et la CONSÉQUENCE qu'il
 * ÉNONCE. Un geste qui RELIT une donnée persistée (ouverture, import, reprise) n'en énonce aucune (`null`) : son verbe la dit déjà ; son message tient
 * en une phrase, le verbe et la cause, la faute reste au détail. Un geste qui valide l'état EN COURS
 * de l'auteur énonce ce que son refus empêche et NOMME la faute (#2404). UNE table : ces chaînes
 * ne sont pas libres, un appelant ne peut pas les désaccorder — « Import refusé : ce projet ne
 * pourrait plus être rouvert » serait faux, rien n'ayant jamais été ouvert ni écrit.
 */
const PROJET_SANS_NOM = 'ce projet n’a pas de nom';

/** Ce qu'un refus HORS SCHÉMA dit à l'auteur, par CAUSE, selon ce que le geste LIT : le rapport
 *  technique reste en détail. `IMPORT_FORME_DEPOT` ne vaut que pour un geste qui lit un FICHIER ;
 *  ailleurs, la cause se dit sous le terme de l'autre format (#2404). */
type PhrasesDeCause = Readonly<Record<Exclude<CauseDeRefus, 'schema'>, string>>;
const PROJET_EN_MEMOIRE: PhrasesDeCause = {
  'prose-non-materialisee': `${PROJET_AUTRE_FORMAT}.`,
  entree: 'Sa scène de départ n’existe pas dans le projet.',
};
const FICHIER_DE_PROJET: PhrasesDeCause = { ...PROJET_EN_MEMOIRE, 'prose-non-materialisee': IMPORT_FORME_DEPOT };
const SAUVEGARDE_LOCALE: PhrasesDeCause = { 'prose-non-materialisee': `${SCENE_AUTRE_FORMAT}.`, entree: `${SCENE_AUTRE_FORMAT}.` };

const GESTES_DE_PORTE = {
  ouverture: { verbe: 'Ouverture refusée', consequence: null, sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  enregistrement: { verbe: 'Enregistrement refusé', consequence: 'ce projet ne pourrait plus être rouvert', sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  export: { verbe: 'Export refusé', consequence: 'ce fichier ne pourrait plus être rouvert', sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  import: { verbe: 'Import refusé', consequence: null, sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: FICHIER_DE_PROJET },
  test: { verbe: 'Mise à l’essai refusée', consequence: 'ce projet ne pourrait pas être joué', sansNom: PROJET_SANS_NOM, autreFormat: PROJET_AUTRE_FORMAT, causes: PROJET_EN_MEMOIRE },
  reprise: { verbe: 'Restauration refusée', consequence: null, sansNom: 'cette sauvegarde locale n’a pas de nom', autreFormat: SCENE_AUTRE_FORMAT, causes: SAUVEGARDE_LOCALE },
} as const;

/** Geste dont la porte du document peut opposer un refus — union FERMÉE. */
export type GesteDePorte = keyof typeof GESTES_DE_PORTE;

/** Une faute SANS NOM : elle porte sur `id` ou `label` à la racine du document — aucun réglage de
 *  contenu ne sauvera le projet. credo.md:7, 1ʳᵉ phrase. */
const estSansNom = (f: Faute): boolean => f.chemin.length === 1 && (f.chemin[0] === 'id' || f.chemin[0] === 'label');

/** Le lieu d'une faute en mots d'AUTEUR : le champ RACINE sous son LIBELLÉ de document
 *  (`projetDoc.meta`), chaque élément à clé par son libellé (sa clé à défaut). */
function lieuDAuteur(lieu: readonly SegmentDeLieu[]): string {
  const [racine, ...suite] = lieu;
  const libelleDe = (champ: string): string => projetDoc.meta[champ]?.label ?? champ;
  const tete: SegmentDeLieu | undefined =
    typeof racine === 'string' ? libelleDe(racine) : typeof racine === 'object' ? { ...racine, liste: libelleDe(racine.liste) } : racine;
  return cheminLisible(tete === undefined ? [] : [tete, ...suite], (element) => element.libelle ?? element.cle);
}

/**
 * Traduit en refus d'ÉCRAN le refus que la porte oppose à un geste — UN traducteur pour tous les
 * gestes, qui lit la CAUSE et les fautes (`ProjetRefuse`), jamais le texte du rapport. Un document
 * fautif à sa RACINE et un projet SANS NOM se disent en mots d'auteur, comme la faute d'un geste qui ne
 * la nomme pas (conséquence `null`). Sinon, ce que l'auteur doit savoir tient en deux faits : la CONSÉQUENCE du refus, et OÙ est la première
 * faute ; les suivantes sont COMPTÉES. Le rapport de la porte reste en `detail` dès que le message
 * ne le reprend pas. Toute autre erreur n'est pas un refus de la porte : elle remonte telle quelle.
 */
export function refusDeLaPorteDuProjet(erreur: unknown, geste: GesteDePorte): RefusRendu {
  exigerUnRefus(erreur);
  const { verbe, consequence, sansNom, autreFormat: terme, causes } = GESTES_DE_PORTE[geste];
  const phrase = (cause: string): string =>
    consequence === null ? `${verbe} : ${cause.charAt(0).toLocaleLowerCase('fr') + cause.slice(1)}` : `${verbe} : ${consequence}. ${cause}`;
  if (erreur.cause !== 'schema') {
    return { message: phrase(causes[erreur.cause]), detail: erreur.message };
  }
  const autreFormat = { message: phrase(`${terme}.`), detail: erreur.message };
  if (erreur.fautes.some((f) => f.chemin.length === 0)) return autreFormat;
  if (erreur.fautes.some(estSansNom)) return { message: `${verbe} : ${sansNom}.`, detail: erreur.message };
  if (consequence === null) return autreFormat;
  const [premiere, ...autres] = erreur.fautes;
  const suite = autres.length > 0 ? ` (et ${autres.length} autre${autres.length > 1 ? 's' : ''} à corriger)` : '';
  // Une phrase reprend en MAJUSCULE après le point : `lieuDAuteur` rend un fragment (« Scènes … »),
  // il est donc INTRODUIT au lieu d'être recollé nu derrière la ponctuation.
  const message = `${verbe} : ${consequence}. Faute : ${lieuDAuteur(premiere.lieu)} — ${premiere.message}${suite}`;
  return autres.length > 0 ? { message, detail: erreur.message } : { message };
}

/** Refus d'un geste HORS de la porte (fichier qui n'est pas du JSON, groupe vide) : le verbe vient
 *  de la même table, le `motif` dit ce qui manque. */
export function refusMotive(geste: GesteDePorte, motif: string): RefusRendu {
  return { message: `${GESTES_DE_PORTE[geste].verbe} : ${motif}.` };
}

/** « Ouvrir » : reprendre un projet enregistré (localStorage), repartir d'une campagne du jeu
 *  (Arène + campagnes built-in — #367 : les fichiers `src/scenes/**‑projet.json` sont commités,
 *  jamais écrasés depuis l'éditeur, donc ouverture = COPIE de travail) ou d'un scénario de test. */
export function OpenProjectModal({
  onScenario,
  onProject,
  onBuiltin,
  onClose,
  error,
}: {
  onScenario: (sc: TestScenario) => void;
  onProject: (p: EntreeListee) => void;
  onBuiltin: (bc: BuiltinCampaign) => void;
  onClose: () => void;
  /** Refus de la porte à l'ouverture d'un projet (#1552) — la modale reste ouverte et le DIT :
   *  `message` est écrit en mots d'auteur (règle 4), `detail` porte le rapport de la porte, replié. */
  error?: RefusRendu | null;
}) {
  const [projects, setProjects] = useState(() => projectsLoad());
  const [delError, setDelError] = useState<string | null>(null);
  const del = (id: string) => {
    setDelError(null);
    projectRemove(id).then((res) => {
      if (!res.ok) setDelError(res.message);
    });
    setProjects(projectsLoad());
  };

  return (
    <Modal
      taille="large"
      title="Ouvrir"
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Fermer
        </button>
      }
    >
      {error && <ChipDeRefus cle={error} refus={error} />}
      {delError && <ChipDeRefus refus={{ message: delError }} />}
      {projects.length > 0 && (
        <>
          <div className="mini-title">Mes projets</div>
          <Stack>
            {projects.map((p) => (
              <ListRow key={p.id} label={nomDeProjet(p.label)}>
                {estRefusee(p) && <span className="chip tone-danger">{MARQUE_AUTRE_FORMAT}</span>}
                {p.published && <span className="chip">publiée</span>}
                <GatedAction id={`ouvrir-${p.id}`} label="Ouvrir" enabled primary={!estRefusee(p)} btnClassName="small" onClick={() => onProject(p)} />
                <button className="btn small danger" onClick={() => del(p.id)}>
                  Suppr.
                </button>
              </ListRow>
            ))}
          </Stack>
        </>
      )}
      <div className="mini-title">Campagnes du jeu</div>
      <Stack>
        {allBuiltinCampaigns.map((bc) => (
          <ListRow key={bc.id} label={<><Icon id={bc.icon} size="sm" /> {bc.label}</>}>
            <span className="chip">s’ouvre en copie</span>
            <button className="btn small btn-primary" onClick={() => onBuiltin(bc)}>
              Ouvrir
            </button>
          </ListRow>
        ))}
      </Stack>
      <div className="mini-title">Scénarios de test</div>
      <Stack>
        {testScenarios.map((sc) => (
          <ListRow key={sc.id} label={<><Icon id={sc.icon} size="sm" /> {sc.title}</>} subtitle={sc.partyNote}>
            <button className="btn small" onClick={() => onScenario(sc)}>
              Ouvrir
            </button>
          </ListRow>
        ))}
      </Stack>
    </Modal>
  );
}

/** « Enregistrer » : nomme le projet, choisit la scène de départ jouable, publie au menu. */
export function SaveProjectModal({
  initialName,
  initialPublished,
  scenes,
  initialStartId,
  onSave,
  onClose,
  error,
}: {
  initialName: string;
  initialPublished: boolean;
  scenes: Scene[];
  initialStartId: string;
  onSave: (name: string, published: boolean, startSceneId: string) => void;
  onClose: () => void;
  /** #811 : refus le plus récent (porte du document ou échec de `projectSave`), ou `null` si le chemin nominal. */
  error?: RefusRendu | null;
}) {
  const [name, setName] = useState(initialName);
  const [published, setPublished] = useState(initialPublished);
  const [start, setStart] = useState(initialStartId);

  return (
    <Modal title="Enregistrer le projet" onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <GatedAction
            id="projet-enregistrer"
            label="Enregistrer"
            enabled={!!name.trim()}
            reason="Un projet se nomme avant d’être enregistré : saisissez un nom dans le champ Nom."
            onClick={() => onSave(name.trim(), published, start)}
          />
        </>
      }
    >
      {error && <ChipDeRefus cle={error} refus={error} />}
      <label className="field">
        <span>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ma campagne" autoFocus />
      </label>
      {scenes.length > 1 && (
        <label className="field">
          <span>Scène de départ (au jeu)</span>
          <select value={start} onChange={(e) => setStart(e.target.value)}>
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label ?? s.id}
              </option>
            ))}
          </select>
        </label>
      )}
      <Row as="label">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        <span>Jouable depuis le menu principal</span>
      </Row>
    </Modal>
  );
}
