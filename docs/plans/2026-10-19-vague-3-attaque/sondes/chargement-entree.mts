// Juge v6 : le chargement d'une save sous D5 v6 (« applyLoadedSave pose repriseDeLaPartie(save.data) …, PUIS
// marquerLEntree(neuve: true) »), observé par la règle d'adaptateur (« quand le rang change … une entrée
// neuve: false sauvegarde ensuite (autoSave) » chez le propriétaire). Modèle pur, au texte de D5.
type E = { sceneId: string; neuve: boolean; rang: number } | null;
const ecrits: string[] = [];
let etat: { entreeEnScene: E } = { entreeEnScene: { sceneId: 'auberge', neuve: false, rang: 9 } }; // partie en cours
const observer = (prev: E, s: E) => {
  if ((prev?.rang ?? null) === (s?.rang ?? null)) return;
  ecrits.push(`remettreLAdaptateur(${s?.neuve})`);
  if (s && !s.neuve) ecrits.push('autoSave → AUTO_SLOT écrasé par la partie chargée');
};
const set = (patch: { entreeEnScene: E }) => { const prev = etat.entreeEnScene; etat = { ...etat, ...patch }; observer(prev, etat.entreeEnScene); };
const saveManuelle = { entreeEnScene: { sceneId: 'port', neuve: false, rang: 4 } as E }; // posée à une transition passée
set({ entreeEnScene: saveManuelle.entreeEnScene });                                     // repriseDeLaPartie(save.data)
set({ entreeEnScene: { sceneId: 'port', neuve: true, rang: 1 + Math.max(etat.entreeEnScene?.rang ?? 0, saveManuelle.entreeEnScene!.rang) } }); // marquerLEntree(neuve: true)
console.log('D5 v6, chargement en deux écritures :', JSON.stringify(ecrits));
