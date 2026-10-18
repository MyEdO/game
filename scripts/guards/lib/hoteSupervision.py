import ctypes
import errno
import json
import os
import platform
import signal
import struct
import sys
import time
import uuid
from datetime import datetime, timezone


# https://man7.org/linux/man-pages/man2/ptrace.2.html
# https://man7.org/linux/man-pages/man2/seccomp.2.html
PTRACE_CONT = 7
PTRACE_GETEVENTMSG = 0x4201
PTRACE_SEIZE = 0x4206
PTRACE_INTERRUPT = 0x4207
PTRACE_LISTEN = 0x4208
OPTIONS = 0x2 | 0x4 | 0x8 | 0x10 | 0x40 | 0x100000
WALL = 0x40000000
EVENT_STOP = 128
STOP_SIGNALS = {signal.SIGSTOP, signal.SIGTSTP, signal.SIGTTIN, signal.SIGTTOU}
interrompu = False
libc = ctypes.CDLL(None, use_errno=True)
libc.ptrace.restype = ctypes.c_long
libc.ptrace.argtypes = [ctypes.c_uint, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p]


def maintenant():
    return time.time_ns() // 1000000


def interrompre(_signal, _frame):
    global interrompu
    interrompu = True


def ptrace(operation, tid, data=0):
    pointeur = ctypes.c_void_p(data) if isinstance(data, int) else data
    resultat = libc.ptrace(operation, tid, None, pointeur)
    if resultat == -1:
        code = ctypes.get_errno()
        raise OSError(code, "ptrace " + str(operation) + ": " + os.strerror(code))
    return resultat


def prctl(operation, valeur, argument=0):
    if libc.prctl(operation, valeur, argument, 0, 0) != 0:
        code = ctypes.get_errno()
        raise OSError(code, "prctl: " + os.strerror(code))


def lire_json(chemin):
    with open(chemin, encoding="utf-8-sig") as fichier:
        valeur = json.load(fichier)
    if not isinstance(valeur, dict):
        raise RuntimeError("EPROTO objet requis")
    return valeur


def ecrire_json(chemin, valeur):
    temporaire = chemin + "." + uuid.uuid4().hex + ".tmp"
    try:
        with open(temporaire, "x", encoding="utf-8") as fichier:
            json.dump(valeur, fichier, separators=(",", ":"), ensure_ascii=True)
        os.rename(temporaire, chemin)
    finally:
        if os.path.exists(temporaire):
            os.unlink(temporaire)


def entier(objet, cle):
    valeur = objet.get(cle)
    if type(valeur) is not int:
        raise RuntimeError("EPROTO entier " + cle)
    return valeur


def texte(objet, cle):
    valeur = objet.get(cle)
    if not isinstance(valeur, str) or not valeur:
        raise RuntimeError("EPROTO texte " + cle)
    return valeur


class Expiration(Exception):
    pass


class Fermeture(Exception):
    pass


class Filtre(ctypes.Structure):
    _fields_ = [("code", ctypes.c_ushort), ("jt", ctypes.c_ubyte),
                ("jf", ctypes.c_ubyte), ("k", ctypes.c_uint)]


class Programme(ctypes.Structure):
    _fields_ = [("len", ctypes.c_ushort), ("filter", ctypes.POINTER(Filtre))]


def architecture(node):
    machine = platform.machine().lower()
    if sys.platform != "linux" or ctypes.sizeof(ctypes.c_void_p) != 8:
        raise RuntimeError("EPREREQUIS Linux ABI 64 bits requis")
    if machine in ("x86_64", "amd64"):
        audit, clone, elf = 0xC000003E, 56, 62
    elif machine in ("aarch64", "arm64"):
        audit, clone, elf = 0xC00000B7, 220, 183
    else:
        raise RuntimeError("EPREREQUIS architecture non prise en charge")
    with open(node, "rb") as fichier:
        entete = fichier.read(20)
    if (len(entete) != 20 or entete[:6] != b"\x7fELF\x02\x01"
            or struct.unpack_from("<H", entete, 18)[0] != elf):
        raise RuntimeError("EPREREQUIS executable ELF ABI native requis")
    return audit, clone


def filtrer(audit, clone):
    # https://man7.org/linux/man-pages/man2/clone.2.html
    lignes = [
        (0x20, 0, 0, 4), (0x15, 1, 0, audit), (0x06, 0, 0, 0x80000000),
        (0x20, 0, 0, 0),
        (0x45, 0, 1, 0x40000000), (0x06, 0, 0, 0x80000000),
        (0x15, 0, 1, 435), (0x06, 0, 0, 0x00050000 | errno.ENOSYS),
        (0x15, 0, 3, clone), (0x20, 0, 0, 16),
        (0x45, 0, 1, 0x00800000), (0x06, 0, 0, 0x00050000 | errno.EPERM),
        (0x06, 0, 0, 0x7FFF0000),
    ]
    filtres = (Filtre * len(lignes))(*(Filtre(*ligne) for ligne in lignes))
    programme = Programme(len(lignes), filtres)
    prctl(38, 1)
    if libc.prctl(22, 2, ctypes.byref(programme), 0, 0) != 0:
        code = ctypes.get_errno()
        raise OSError(code, "EPREREQUIS seccomp: " + os.strerror(code))


def statistiques(tid):
    with open("/proc/" + str(tid) + "/stat", encoding="ascii") as fichier:
        contenu = fichier.read()
    return contenu[contenu.rfind(")") + 2:].split()


def statut(tid):
    with open("/proc/" + str(tid) + "/status", encoding="ascii") as fichier:
        champs = dict(ligne.split(":", 1) for ligne in fichier if ":" in ligne)
    return int(champs["Tgid"]), int(champs["PPid"])


class Instance:
    def __init__(self, tgid, naissance, parent_naissance, role, origine, frequence):
        self.tgid = tgid
        self.parent_naissance = parent_naissance
        self.role = role
        self.entree = None
        self.identifiant = uuid.uuid4().hex
        secondes, reste = divmod(naissance, frequence)
        instant = datetime.fromtimestamp(origine + secondes, timezone.utc)
        self.creation = instant.strftime("%Y-%m-%dT%H:%M:%S.") + str(reste * 1000000000 // frequence).zfill(9) + "Z"


class Tache:
    def __init__(self, tid, instance):
        self.tid = tid
        self.instance = instance
        self.stop = False
        self.reprise = "cont"
        self.signal = 0
        self.interruption = False
        self.liee = True
        self.sortie = False


class Domaine:
    def __init__(self, dossier, delai):
        self.dossier = dossier
        configuration = lire_json(os.path.join(dossier, "configuration.json"))
        if entier(configuration, "version") != 1 or entier(configuration, "delaiArretMs") != delai or delai < 1:
            raise RuntimeError("EPROTO configuration")
        self.generation = texte(configuration, "generation")
        self.delai = delai
        self.erreurs = []
        self.taches = {}
        self.sorties_tracees = set()
        self.instances = {}
        self.traites = set()
        self.worker = None
        self.cible = None
        self.statut_worker = None
        self.echild = False
        self.gele = False
        self.terminaison = False
        self.echeance = None
        self.frequence = os.sysconf("SC_CLK_TCK")
        self.page = os.sysconf("SC_PAGE_SIZE")
        with open("/proc/stat", encoding="ascii") as fichier:
            self.origine = next(int(ligne.split()[1]) for ligne in fichier if ligne.startswith("btime "))
        self.hote = self.nouvelle_instance(os.getpid(), None, "hote")
        for nom in ("requetes", "reponses"):
            os.makedirs(os.path.join(dossier, nom), exist_ok=True)
        sonde = os.path.join(dossier, "hardlink-" + uuid.uuid4().hex)
        with open(sonde, "x", encoding="ascii") as fichier:
            fichier.write("1")
        try:
            os.link(sonde, sonde + ".lien")
        finally:
            if os.path.exists(sonde + ".lien"):
                os.unlink(sonde + ".lien")
            os.unlink(sonde)

    def nouvelle_instance(self, tgid, parent, role=None):
        naissance = int(statistiques(tgid)[19])
        instance = Instance(tgid, naissance, parent, role, self.origine, self.frequence)
        self.instances[instance.identifiant] = instance
        return instance

    def ajouter(self, tid, parent_tid=None, worker=False):
        self.sorties_tracees.discard(tid)
        existante = self.taches.get(tid)
        tgid, _ppid = statut(tid)
        parente = self.taches.get(parent_tid)
        if parente and parente.instance.tgid == tgid:
            instance = parente.instance
        else:
            instance = next((t.instance for t in self.taches.values() if t.instance.tgid == tgid), None)
            if instance is None:
                instance = self.nouvelle_instance(tgid, parente.instance.identifiant if parente else None,
                                                  "worker" if worker else None)
                if parente:
                    instance.entree = parente.instance.entree
        if existante:
            if existante.instance != instance:
                raise RuntimeError("ELEDGER collision TID")
            existante.liee = parent_tid is not None or worker
            if parente and instance != parente.instance:
                instance.parent_naissance = parente.instance.identifiant
                instance.entree = parente.instance.entree
            return existante
        tache = Tache(tid, instance)
        tache.liee = parent_tid is not None or worker
        self.taches[tid] = tache
        if worker:
            self.worker = instance
        return tache

    def reprendre(self, tache):
        if not tache.stop or not tache.liee:
            return
        try:
            if self.terminaison:
                ptrace(PTRACE_CONT, tache.tid, signal.SIGKILL)
            elif tache.reprise == "listen":
                ptrace(PTRACE_LISTEN, tache.tid)
            else:
                ptrace(PTRACE_CONT, tache.tid, tache.signal)
        except OSError as erreur:
            if erreur.errno != errno.ESRCH:
                raise
        tache.stop = False
        tache.signal = 0

    def traiter(self, tid, status):
        if os.WIFEXITED(status) or os.WIFSIGNALED(status):
            tache = self.taches.pop(tid, None)
            if tache is None:
                if tid in self.sorties_tracees:
                    self.sorties_tracees.discard(tid)
                    return
                self.erreurs.append("ELEDGER sortie non enregistrée")
                return
            self.sorties_tracees.add(tid)
            if tache.instance == self.worker and not any(t.instance == self.worker for t in self.taches.values()):
                self.statut_worker = status
            return
        if not os.WIFSTOPPED(status):
            raise RuntimeError("ELEDGER statut waitpid inconnu")
        evenement = status >> 16
        sig = os.WSTOPSIG(status)
        if evenement == 4:
            ancien = ctypes.c_ulong()
            ptrace(PTRACE_GETEVENTMSG, tid, ctypes.byref(ancien))
            if ancien.value != tid:
                source = self.taches.pop(ancien.value, None)
                if source is None:
                    raise RuntimeError("ELEDGER exec nonleader inconnu")
                ancienne = self.taches.get(tid)
                if ancienne and ancienne.instance != source.instance:
                    raise RuntimeError("ELEDGER exec nonleader conflit")
                source.tid = tid
                source.instance.tgid = tid
                self.taches[tid] = source
        tache = self.taches.get(tid)
        if tache is None:
            tache = self.ajouter(tid)
        tache.stop = True
        tache.reprise = "cont"
        tache.signal = 0
        if evenement in (1, 2, 3):
            enfant = ctypes.c_ulong()
            ptrace(PTRACE_GETEVENTMSG, tid, ctypes.byref(enfant))
            cree = self.ajouter(enfant.value, tid)
            if cree.stop and not self.gele:
                self.reprendre(cree)
        elif evenement == EVENT_STOP:
            if sig in STOP_SIGNALS:
                tache.reprise = "listen"
            tache.interruption = False
        elif evenement == 0:
            tache.signal = sig
        elif evenement == 6:
            tache.sortie = True
            if tache.instance == self.worker and tid == self.worker.tgid and not self.terminaison:
                annonce = ctypes.c_ulong()
                ptrace(PTRACE_GETEVENTMSG, tid, ctypes.byref(annonce))
                if not os.WIFEXITED(annonce.value) or os.WEXITSTATUS(annonce.value) != 0:
                    self.erreurs.append("EWORKER statut non nul")
                self.cloture()
        elif evenement not in (4, 6):
            raise RuntimeError("ELEDGER événement ptrace inconnu")
        tache.interruption = False
        if not self.gele:
            self.reprendre(tache)

    def drainer(self, echeance=None):
        evenements = 0
        while True:
            if evenements >= 128 or (echeance is not None and maintenant() >= echeance):
                return evenements
            try:
                tid, status = os.waitpid(-1, os.WNOHANG | WALL)
            except ChildProcessError:
                self.echild = True
                if self.taches:
                    raise RuntimeError("ELEDGER ECHILD avec ledger non vide")
                return evenements
            if tid == 0:
                self.echild = False
                return evenements
            self.echild = False
            self.traiter(tid, status)
            evenements += 1

    def verifier(self, echeance):
        if os.path.exists(os.path.join(self.dossier, "cloture.json")):
            raise Fermeture("ECLOTURE demandée")
        if maintenant() >= echeance:
            raise Expiration("EEXPIRATION requête expirée")

    def interrompre_taches(self, echeance):
        for tache in list(self.taches.values()):
            self.verifier(echeance)
            if tache.stop or tache.interruption:
                continue
            try:
                ptrace(PTRACE_INTERRUPT, tache.tid)
                tache.interruption = True
            except OSError as erreur:
                if erreur.errno != errno.ESRCH:
                    raise

    def ligne(self, instance, echeance):
        self.verifier(echeance)
        candidats = [t.tid for t in self.taches.values() if t.instance == instance]
        if instance == self.hote:
            candidats = [os.getpid()]
        if not candidats:
            raise RuntimeError("ECAPTURE instance sortie")
        erreur = None
        for tid in candidats:
            try:
                with open("/proc/" + str(tid) + "/statm", encoding="ascii") as fichier:
                    rss = int(fichier.read().split()[1]) * self.page
                _tgid, ppid = statut(tid)
                break
            except (FileNotFoundError, ProcessLookupError) as cause:
                erreur = cause
        else:
            raise RuntimeError("ECAPTURE RSS indisponible") from erreur
        vivant = instance == self.hote or any(t.instance == instance and not t.sortie for t in self.taches.values())
        return {"identifiant": instance.identifiant, "pid": instance.tgid, "ppid": ppid,
                "creation": instance.creation, "residentOctets": rss, "metriqueMemoire": "rss",
                "etat": "vivant" if vivant else "sortie", "erreurs": [], "role": instance.role, "entreeId": instance.entree}

    def sous_quiescence(self, echeance, action):
        self.gele = True
        try:
            while True:
                self.verifier(echeance)
                self.interrompre_taches(echeance)
                nombre = self.drainer(echeance)
                if all(t.stop and t.liee for t in self.taches.values()) and nombre == 0:
                    break
                time.sleep(0.001)
            resultat = action()
            if maintenant() >= echeance:
                raise Expiration("EEXPIRATION opération expirée")
            return resultat
        finally:
            self.gele = False
            if os.path.exists(os.path.join(self.dossier, "cloture.json")):
                self.terminaison = True
            for tache in list(self.taches.values()):
                self.reprendre(tache)

    def vue(self, echeance):
        def capturer():
            groupes = {t.instance.identifiant: t.instance for t in self.taches.values()}
            lignes = [self.ligne(self.hote, echeance)] + [self.ligne(g, echeance) for g in groupes.values()]
            return {"processus": lignes, "metriqueMemoire": "rss"}
        return self.sous_quiescence(echeance, capturer)

    def attribuer(self, requete, echeance):
        self.verifier(echeance)
        instance = self.instances.get(texte(requete, "identifiant"))
        if (instance is None or instance.tgid != entier(requete, "pid")
                or instance.creation != texte(requete, "creation")
                or not any(t.instance == instance and not t.sortie for t in self.taches.values())):
            raise RuntimeError("EIDENTITE instance non détenue ou sortie")
        destination = requete.get("destination")
        if not isinstance(destination, dict):
            raise RuntimeError("EPROTO destination")
        type_destination = texte(destination, "type")
        if type_destination == "parent":
            if (instance.entree is not None or instance.role in ("worker", "hote")
                    or self.worker is None or instance.parent_naissance != self.worker.identifiant
                    or (self.cible is not None and self.cible != instance)):
                raise RuntimeError("EAFFECTATION parent non prouvé")
            self.cible = instance
            instance.role = "cible"
            return
        if type_destination != "entree" or instance.role is not None:
            raise RuntimeError("EAFFECTATION destination")
        entree = texte(destination, "id")
        descendants = {instance.identifiant}
        while True:
            self.verifier(echeance)
            ajoutes = {i.identifiant for i in self.instances.values() if i.parent_naissance in descendants}
            if ajoutes <= descendants:
                break
            descendants.update(ajoutes)
        for identifiant in descendants:
            enfant = self.instances[identifiant]
            if enfant.role is not None or (enfant.entree is not None and enfant.entree != entree):
                raise RuntimeError("EAFFECTATION conflit descendant")
        for identifiant in descendants:
            self.instances[identifiant].entree = entree

    def requetes(self):
        dossier = os.path.join(self.dossier, "requetes")
        for nom in sorted(os.listdir(dossier)):
            if not nom.endswith(".json") or nom in self.traites:
                continue
            self.traites.add(nom)
            identifiant = nom[:-5]
            reponse = {"version": 1, "generation": self.generation, "id": identifiant}
            try:
                requete = lire_json(os.path.join(dossier, nom))
                if (entier(requete, "version") != 1 or texte(requete, "generation") != self.generation
                        or texte(requete, "id") != identifiant):
                    raise RuntimeError("EPROTO requête")
                echeance = entier(requete, "echeance")
                if maintenant() >= echeance:
                    raise Expiration("EEXPIRATION requête expirée")
                operation = texte(requete, "operation")
                if operation == "vue":
                    reponse["vue"] = self.vue(echeance)
                elif operation == "attribuer":
                    self.sous_quiescence(echeance, lambda: self.attribuer(requete, echeance))
                else:
                    raise RuntimeError("EPROTO opération")
                if maintenant() >= echeance:
                    raise Expiration("EEXPIRATION requête expirée")
                reponse["ok"] = True
            except Exception as erreur:
                reponse.pop("vue", None)
                code = "EXPIRATION" if isinstance(erreur, Expiration) else "FERMETURE" if isinstance(erreur, Fermeture) else "ECONTROLE"
                reponse.update(ok=False, error={"code": code, "message": str(erreur)})
                if not isinstance(erreur, (Expiration, Fermeture)):
                    self.erreurs.append(str(erreur))
            ecrire_json(os.path.join(self.dossier, "reponses", nom), reponse)
            if self.erreurs or os.path.exists(os.path.join(self.dossier, "cloture.json")):
                return

    def cloture(self):
        chemin = os.path.join(self.dossier, "cloture.json")
        if not os.path.exists(chemin):
            temporaire = chemin + "." + uuid.uuid4().hex + ".tmp"
            try:
                with open(temporaire, "x", encoding="utf-8") as fichier:
                    json.dump({"version": 1, "generation": self.generation,
                               "echeance": maintenant() + self.delai}, fichier, separators=(",", ":"))
                try:
                    os.link(temporaire, chemin)
                except FileExistsError:
                    pass
            finally:
                if os.path.exists(temporaire):
                    os.unlink(temporaire)
        valeur = lire_json(chemin)
        if entier(valeur, "version") != 1 or texte(valeur, "generation") != self.generation:
            raise RuntimeError("ECLOTURE incohérente")
        echeance = entier(valeur, "echeance")
        if echeance < 1 or echeance > maintenant() + self.delai + 1000:
            raise RuntimeError("ECLOTURE échéance")
        return echeance

    def tuer(self):
        for tgid in {t.instance.tgid for t in self.taches.values()}:
            try:
                os.kill(tgid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        for tache in list(self.taches.values()):
            self.reprendre(tache)

    def terminer(self):
        self.terminaison = True
        self.gele = False
        try:
            self.echeance = self.cloture()
        except Exception as erreur:
            self.erreurs.append(str(erreur))
            self.echeance = 0
        zero = False
        while True:
            self.tuer()
            try:
                self.drainer(self.echeance)
            except Exception as erreur:
                self.erreurs.append(str(erreur))
                break
            if not self.taches and self.echild:
                zero = maintenant() <= self.echeance
                break
            if maintenant() >= self.echeance:
                break
            time.sleep(0.001)
        if not zero:
            self.erreurs.append("ECLOTURE zéro absent dans échéance")
        ecrire_json(os.path.join(self.dossier, "certificat.json"),
                    {"version": 1, "generation": self.generation, "methode": "ledger-linux",
                     "zero": zero, "echeance": self.echeance, "erreurs": self.erreurs})
        return 0 if zero and not self.erreurs else 70


def main():
    if len(sys.argv) != 8:
        raise RuntimeError("EPROTO arguments hôte")
    parent = int(sys.argv[1])
    node, worker, adresse, jeton, dossier = sys.argv[2:7]
    delai = int(sys.argv[7])
    audit, clone = architecture(node)
    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(sig, interrompre)
    # https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html
    prctl(36, 1)
    prctl(1, signal.SIGTERM)
    if os.getppid() != parent or interrompu:
        raise RuntimeError("EPARENT parent disparu")
    domaine = Domaine(dossier, delai)
    lecture, ecriture = os.pipe()
    try:
        if os.path.exists(os.path.join(dossier, "cloture.json")):
            return domaine.terminer()
        hote_pid = os.getpid()
        enfant = os.fork()
        if enfant == 0:
            try:
                os.close(ecriture)
                prctl(1, signal.SIGKILL)
                if os.getppid() != hote_pid or os.read(lecture, 1) != b"1":
                    os._exit(70)
                os.close(lecture)
                filtrer(audit, clone)
                os.execv(node, [node, worker, adresse, jeton])
            except BaseException:
                os._exit(70)
        os.close(lecture)
        lecture = None
        domaine.ajouter(enfant, worker=True)
        ptrace(PTRACE_SEIZE, enfant, OPTIONS)
        if not (interrompu or os.getppid() != parent or os.path.exists(os.path.join(dossier, "cloture.json"))):
            os.write(ecriture, b"1")
        os.close(ecriture)
        ecriture = None
        while True:
            domaine.drainer()
            if domaine.statut_worker is not None:
                if not os.WIFEXITED(domaine.statut_worker) or os.WEXITSTATUS(domaine.statut_worker) != 0:
                    domaine.erreurs.append("EWORKER statut non nul")
                break
            if (interrompu or os.getppid() != parent or domaine.erreurs
                    or os.path.exists(os.path.join(dossier, "cloture.json"))):
                break
            domaine.requetes()
            time.sleep(0.002)
    except Exception as erreur:
        domaine.erreurs.append(str(erreur))
    finally:
        for fd in (lecture, ecriture):
            if fd is not None:
                os.close(fd)
    return domaine.terminer()


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as erreur:
        print("[supervision hôte] " + str(erreur), file=sys.stderr)
        sys.exit(70)
