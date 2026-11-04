import { useState } from 'react';
import { Modal } from '../Modal';
import { GatedAction } from '../GatedAction';
import { Icon } from '../Icon';
import { ListRow } from '../ListRow';
import { Scene } from '../../noyau/monde/scene';
import { testScenarios, TestScenario } from '../../scenes/test-scenarios';
import { projectsLoad, projectRemove, estRefusee } from '../../state/projectLibrary';
import { nomDeProjet, type EntreeListee, MARQUE_AUTRE_FORMAT } from '../../noyau/persistance/bibliotheque';
import { ChipDeRefus } from '../ChipDeRefus';
import type { RefusRendu } from '../../noyau/persistance/refusDeLaPorte';
import { allBuiltinCampaigns, BuiltinCampaign } from '../../scenes/campaign';
import { Row, Stack } from '../Layout';

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
