import ctypes
import os
import signal
import subprocess
import sys
import time

# https://man7.org/linux/man-pages/man2/PR_SET_CHILD_SUBREAPER.2const.html
# https://man7.org/linux/man-pages/man2/PR_SET_PDEATHSIG.2const.html
interrompu = False


def interrompre(_signal, _frame):
    global interrompu
    interrompu = True


def nettoyer():
    borne = time.monotonic() + 5
    while True:
        try:
            while True:
                pid, _status = os.waitpid(-1, os.WNOHANG)
                if pid == 0:
                    break
        except ChildProcessError:
            return
        with open("/proc/self/task/" + str(os.getpid()) + "/children") as fichier:
            enfants = [int(pid) for pid in fichier.read().split()]
        for pid in enfants:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        if time.monotonic() >= borne:
            raise RuntimeError("ECLEANUP enfants encore présents")
        time.sleep(0.01)


def main():
    parent = int(sys.argv[1])
    node, worker, adresse, jeton, stop = sys.argv[2:]
    signal.signal(signal.SIGTERM, interrompre)
    signal.signal(signal.SIGINT, interrompre)
    signal.signal(signal.SIGHUP, interrompre)
    libc = ctypes.CDLL(None, use_errno=True)
    code = 0
    try:
        for option, valeur in [(36, 1), (1, signal.SIGTERM)]:
            if os.getppid() != parent:
                raise RuntimeError("EPARENT parent disparu")
            if libc.prctl(option, valeur, 0, 0, 0) != 0:
                raise OSError(ctypes.get_errno(), os.strerror(ctypes.get_errno()))
            if os.getppid() != parent or interrompu:
                raise RuntimeError("EPARENT parent disparu")
        enfant = subprocess.Popen([node, worker, adresse, jeton])
        while enfant.poll() is None:
            if interrompu or os.getppid() != parent or os.path.exists(stop):
                code = 71
                break
            time.sleep(0.02)
        if enfant.returncode not in (None, 0):
            code = 70
    finally:
        nettoyer()
    return code


try:
    sys.exit(main())
except Exception as erreur:
    print("[supervision hôte] " + str(erreur), file=sys.stderr)
    sys.exit(70)
