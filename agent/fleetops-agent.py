#!/usr/bin/env python3
"""
NebulOps Agent v2.0.0
──────────────────────
Expose les métriques système enrichies via HTTP :
  GET /metrics   → métriques complètes (disk, ram, cpu, réseau, docker, procs)
  GET /health    → statut rapide
  GET /docker    → containers Docker détaillés (si Docker installé)
  GET /network   → interfaces réseau + trafic
  GET /processes → top 10 processus CPU/RAM

Usage:
  python3 nebulops-agent.py [--port 9101] [--token SECRET]

Dépendances:
  pip3 install psutil requests
"""

import json
import os
import platform
import socket
import time
import argparse
import subprocess
import shutil
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime, timezone

# ─── CONFIGURATION ─────────────────────────────────────────────────────────────

AGENT_VERSION   = "2.0.0"
DEFAULT_PORT    = int(os.environ.get("NEBULOPS_PORT",  9101))
AUTH_TOKEN      = os.environ.get("NEBULOPS_TOKEN", "")
DISK_PATH       = "/"

# Services systemd à surveiller
WATCHED_SERVICES = [
    "nginx", "apache2", "httpd",
    "docker", "containerd",
    "mysql", "mariadb", "postgresql", "mongodb", "redis", "redis-server",
    "node", "pm2",
    "jenkins", "gitlab-runner",
    "ssh", "sshd",
    "prometheus", "grafana-server",
    "tomcat9", "tomcat",
    "rsync", "cron", "fail2ban",
    "ufw", "iptables",
]

# ─── CACHE (évite les appels Docker trop fréquents) ────────────────────────────

_cache: dict = {}
_cache_ttl   = 15  # secondes


def cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < _cache_ttl:
        return entry["data"]
    return None


def cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}
    return data


# ─── DISK ──────────────────────────────────────────────────────────────────────

def get_disk_metrics() -> dict:
    """Disque principal + toutes les partitions montées."""
    try:
        usage = shutil.disk_usage(DISK_PATH)
        total = round(usage.total / 1_073_741_824, 1)
        used  = round(usage.used  / 1_073_741_824, 1)
        free  = round(usage.free  / 1_073_741_824, 1)
        pct   = round(usage.used / usage.total * 100) if usage.total else 0
        main  = {"diskTotalGb": total, "diskUsedGb": used, "diskFreeGb": free, "diskUsedPct": pct}
    except Exception as e:
        main = {"diskTotalGb": 0, "diskUsedGb": 0, "diskFreeGb": 0, "diskUsedPct": 0, "diskError": str(e)}

    # Partitions supplémentaires (psutil)
    partitions = []
    try:
        import psutil
        for part in psutil.disk_partitions(all=False):
            if not part.mountpoint or part.mountpoint.startswith(("/sys", "/proc", "/dev")):
                continue
            try:
                u = psutil.disk_usage(part.mountpoint)
                partitions.append({
                    "mount":      part.mountpoint,
                    "device":     part.device,
                    "fstype":     part.fstype,
                    "totalGb":    round(u.total / 1_073_741_824, 1),
                    "usedGb":     round(u.used  / 1_073_741_824, 1),
                    "freeGb":     round(u.free  / 1_073_741_824, 1),
                    "usedPct":    round(u.percent),
                })
            except Exception:
                pass
    except Exception:
        pass

    return {**main, "partitions": partitions}


# ─── RAM ───────────────────────────────────────────────────────────────────────

def get_ram_metrics() -> dict:
    try:
        import psutil
        mem  = psutil.virtual_memory()
        swap = psutil.swap_memory()
        return {
            "ramTotalGb":   round(mem.total     / 1_073_741_824, 1),
            "ramUsedGb":    round(mem.used       / 1_073_741_824, 1),
            "ramFreeGb":    round(mem.available  / 1_073_741_824, 1),
            "ramUsedPct":   round(mem.percent),
            "ramFreePct":   round(100 - mem.percent),
            "ramCachedGb":  round(getattr(mem, "cached", 0) / 1_073_741_824, 1),
            "swapTotalGb":  round(swap.total / 1_073_741_824, 1),
            "swapUsedGb":   round(swap.used  / 1_073_741_824, 1),
            "swapUsedPct":  round(swap.percent),
        }
    except Exception as e:
        return {"ramTotalGb": 0, "ramUsedGb": 0, "ramFreeGb": 0,
                "ramUsedPct": 0, "ramFreePct": 0, "ramError": str(e)}


# ─── CPU ───────────────────────────────────────────────────────────────────────

def get_cpu_metrics() -> dict:
    try:
        import psutil
        cpu_pct        = round(psutil.cpu_percent(interval=0.5))
        cpu_pct_per    = [round(p) for p in psutil.cpu_percent(interval=None, percpu=True)]
        cpu_cores_phys = psutil.cpu_count(logical=False) or 1
        cpu_cores_log  = psutil.cpu_count(logical=True)  or 1
        load_avg       = [round(x, 2) for x in psutil.getloadavg()]
        freq           = psutil.cpu_freq()
        freq_mhz       = round(freq.current) if freq else None

        return {
            "cpuLoadPct":      cpu_pct,
            "cpuCores":        cpu_cores_log,
            "cpuCoresPhysical": cpu_cores_phys,
            "cpuFreqMhz":      freq_mhz,
            "cpuPerCore":      cpu_pct_per[:8],   # max 8 pour ne pas surcharger
            "loadAvg":         load_avg,
        }
    except Exception as e:
        return {"cpuLoadPct": 0, "cpuCores": 0, "loadAvg": [0, 0, 0], "cpuError": str(e)}


# ─── UPTIME ────────────────────────────────────────────────────────────────────

def get_uptime() -> dict:
    try:
        import psutil
        boot_ts  = psutil.boot_time()
        uptime_s = time.time() - boot_ts
        return {
            "uptimeHours":   round(uptime_s / 3600, 1),
            "uptimeSeconds": int(uptime_s),
            "bootTime":      datetime.fromtimestamp(boot_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    except Exception:
        try:
            with open("/proc/uptime") as f:
                uptime_s = float(f.read().split()[0])
            return {"uptimeHours": round(uptime_s / 3600, 1), "uptimeSeconds": int(uptime_s), "bootTime": None}
        except Exception:
            return {"uptimeHours": 0, "uptimeSeconds": 0, "bootTime": None}


# ─── NETWORK ───────────────────────────────────────────────────────────────────

def get_network_metrics() -> dict:
    """Interfaces réseau : bytes in/out, erreurs, adresses IP."""
    cached = cache_get("network")
    if cached:
        return cached

    try:
        import psutil
        net_io    = psutil.net_io_counters(pernic=True)
        net_addrs = psutil.net_if_addrs()
        net_stats = psutil.net_if_stats()

        interfaces = []
        for iface, addrs in net_addrs.items():
            if iface == "lo":
                continue
            ips = [a.address for a in addrs if a.family.name in ("AF_INET", "AF_INET6") and not a.address.startswith("fe80")]
            io   = net_io.get(iface)
            stat = net_stats.get(iface)
            interfaces.append({
                "name":       iface,
                "ips":        ips[:2],
                "isUp":       stat.isup if stat else False,
                "speed":      stat.speed if stat else 0,
                "bytesSent":  io.bytes_sent  if io else 0,
                "bytesRecv":  io.bytes_recv  if io else 0,
                "mbSent":     round((io.bytes_sent  / 1_048_576), 2) if io else 0,
                "mbRecv":     round((io.bytes_recv  / 1_048_576), 2) if io else 0,
                "packetsSent": io.packets_sent if io else 0,
                "packetsRecv": io.packets_recv if io else 0,
                "errIn":      io.errin  if io else 0,
                "errOut":     io.errout if io else 0,
            })

        # Connexions TCP actives
        try:
            conns      = psutil.net_connections(kind="inet")
            tcp_estab  = sum(1 for c in conns if c.status == "ESTABLISHED")
            tcp_listen = sum(1 for c in conns if c.status == "LISTEN")
        except Exception:
            tcp_estab = tcp_listen = 0

        result = {
            "interfaces":      interfaces,
            "tcpEstablished":  tcp_estab,
            "tcpListening":    tcp_listen,
        }
        return cache_set("network", result)

    except Exception as e:
        return {"interfaces": [], "tcpEstablished": 0, "tcpListening": 0, "networkError": str(e)}


# ─── PROCESSES ─────────────────────────────────────────────────────────────────

def get_top_processes() -> list:
    """Top 10 processus par CPU, avec RAM, PID, user."""
    cached = cache_get("procs")
    if cached:
        return cached

    try:
        import psutil
        procs = []
        for p in psutil.process_iter(["pid", "name", "username", "cpu_percent", "memory_percent", "status", "cmdline"]):
            try:
                info = p.info
                if info["cpu_percent"] is None:
                    continue
                cmd = " ".join(info["cmdline"][:3]) if info.get("cmdline") else info["name"]
                procs.append({
                    "pid":      info["pid"],
                    "name":     info["name"],
                    "user":     info["username"] or "—",
                    "cpu":      round(info["cpu_percent"] or 0, 1),
                    "mem":      round(info["memory_percent"] or 0, 1),
                    "status":   info["status"],
                    "cmd":      cmd[:60],
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        top = sorted(procs, key=lambda x: x["cpu"], reverse=True)[:10]
        return cache_set("procs", top)

    except Exception as e:
        return []


# ─── SERVICES ──────────────────────────────────────────────────────────────────

def get_services() -> list:
    """Services systemd + fallback processus. Retourne running ET stopped."""
    import psutil
    try:
        running_procs = [p.name().lower() for p in psutil.process_iter(["name"])]
    except Exception:
        running_procs = []

    services = []
    for svc in WATCHED_SERVICES:
        is_running = False

        # Via systemctl
        try:
            r = subprocess.run(["systemctl", "is-active", svc],
                               capture_output=True, text=True, timeout=1)
            if r.stdout.strip() in ("active", "activating"):
                is_running = True
        except Exception:
            pass

        # Fallback processus
        if not is_running:
            if any(svc.replace("-server", "") in p for p in running_procs):
                is_running = True
            elif svc == "postgresql" and any("postgres" in p for p in running_procs):
                is_running = True

        services.append({"name": svc, "status": "running" if is_running else "stopped"})

    # Ne retourner que les services détectés (running) + ceux arrêtés connus
    return [s for s in services if s["status"] == "running"]


# ─── DOCKER ────────────────────────────────────────────────────────────────────

def get_docker_info() -> dict:
    """
    Containers Docker via la CLI `docker` (universel, pas besoin de socket).
    Retourne containers + images + version.
    """
    cached = cache_get("docker")
    if cached:
        return cached

    result = {
        "available":  False,
        "version":    None,
        "containers": [],
        "images":     [],
        "summary":    {"running": 0, "stopped": 0, "total": 0},
    }

    try:
        # Vérifier que docker est installé
        v = subprocess.run(["docker", "--version"],
                           capture_output=True, text=True, timeout=3)
        if v.returncode != 0:
            return cache_set("docker", result)

        result["available"] = True
        result["version"]   = v.stdout.strip().replace("Docker version ", "").split(",")[0]

        # ── Containers ──────────────────────────────────────────────
        fmt = (
            '{"id":"{{.ID}}",'
            '"name":"{{.Names}}",'
            '"image":"{{.Image}}",'
            '"status":"{{.Status}}",'
            '"state":"{{.State}}",'
            '"ports":"{{.Ports}}",'
            '"created":"{{.CreatedAt}}",'
            '"size":"{{.Size}}"}'
        )
        cp = subprocess.run(
            ["docker", "ps", "-a", f"--format={fmt}"],
            capture_output=True, text=True, timeout=5
        )
        containers = []
        for line in cp.stdout.strip().splitlines():
            try:
                c = json.loads(line)
                # Stats CPU/RAM si running (appel rapide --no-stream)
                cpu_pct = None
                mem_mb  = None
                if c.get("state") == "running":
                    try:
                        st = subprocess.run(
                            ["docker", "stats", "--no-stream", "--format",
                             "{{.CPUPerc}}|{{.MemUsage}}", c["id"]],
                            capture_output=True, text=True, timeout=4
                        )
                        if st.returncode == 0 and st.stdout.strip():
                            parts = st.stdout.strip().split("|")
                            cpu_pct = float(parts[0].replace("%", "").strip())
                            # MemUsage: "128MiB / 15.6GiB"
                            mem_str = parts[1].split("/")[0].strip()
                            if "MiB" in mem_str:
                                mem_mb = round(float(mem_str.replace("MiB", "")))
                            elif "GiB" in mem_str:
                                mem_mb = round(float(mem_str.replace("GiB", "")) * 1024)
                            elif "kB" in mem_str or "KiB" in mem_str:
                                mem_mb = round(float(mem_str.replace("KiB","").replace("kB","")) / 1024)
                    except Exception:
                        pass

                # Nettoyer les ports (trop verbeux sinon)
                ports_raw = c.get("ports", "")
                ports = []
                if ports_raw:
                    for seg in ports_raw.split(","):
                        seg = seg.strip()
                        if "->" in seg:
                            # "0.0.0.0:3000->3000/tcp" → "3000:3000"
                            try:
                                host_part = seg.split("->")[0].split(":")[-1]
                                cont_part = seg.split("->")[1].split("/")[0]
                                ports.append(f"{host_part}:{cont_part}")
                            except Exception:
                                ports.append(seg[:30])
                        elif seg:
                            ports.append(seg[:20])
                ports_str = ", ".join(ports[:4]) if ports else "—"

                containers.append({
                    "id":       c["id"],
                    "name":     c["name"].lstrip("/"),
                    "image":    c["image"],
                    "state":    c.get("state", "unknown"),
                    "status":   c.get("status", "unknown")[:30],
                    "ports":    ports_str,
                    "created":  c.get("created", "")[:10],
                    "size":     c.get("size", ""),
                    "cpuPct":   round(cpu_pct, 1) if cpu_pct is not None else None,
                    "memMb":    mem_mb,
                })
            except Exception:
                pass

        result["containers"] = containers
        result["summary"] = {
            "running": sum(1 for c in containers if c["state"] == "running"),
            "stopped": sum(1 for c in containers if c["state"] in ("exited", "stopped", "created")),
            "total":   len(containers),
        }

        # ── Images (top 8) ──────────────────────────────────────────
        try:
            img_fmt = '{"repo":"{{.Repository}}","tag":"{{.Tag}}","size":"{{.Size}}","created":"{{.CreatedSince}}"}'
            ip = subprocess.run(
                ["docker", "images", f"--format={img_fmt}"],
                capture_output=True, text=True, timeout=5
            )
            images = []
            for line in ip.stdout.strip().splitlines()[:8]:
                try:
                    images.append(json.loads(line))
                except Exception:
                    pass
            result["images"] = images
        except Exception:
            pass

        return cache_set("docker", result)

    except FileNotFoundError:
        result["error"] = "Docker CLI non trouvé"
        return cache_set("docker", result)
    except Exception as e:
        result["error"] = str(e)
        return cache_set("docker", result)


# ─── DOCKER LOGS ───────────────────────────────────────────────────────────────

# Patterns considérés comme erreurs dans les logs de conteneurs
_ERROR_PATTERNS = [
    "error", "exception", "traceback", "panic", "fatal", "critical",
    "unhandledrejection", "uncaughtexception",
    "econnrefused", "econnreset", "etimedout", "enotfound",
    "segfault", "sigkill", "oom", "out of memory",
    "failed", "failure",
    "prismaclicenterror", "prismaknownerror",
    "syntaxerror", "typeerror", "referenceerror",
    "cannot connect", "connection refused", "connection reset",
    "npmwarn", "npm err",
]

# Lignes à ignorer (bruit de frameworks)
_IGNORE_PATTERNS = [
    "deprecationwarning",
    "experimentalwarning",
    "ready in",
    "compiled",
    "- ready",
    "- event",
]


def get_docker_logs(since_seconds: int = 65) -> list:
    """
    Collecte les lignes d'erreur des logs Docker de tous les conteneurs en cours.
    Retourne une liste de { containerName, level, message }.
    """
    cached = cache_get("docker_logs")
    if cached is not None:
        return cached

    logs = []

    try:
        # Liste des conteneurs running uniquement
        cp = subprocess.run(
            ["docker", "ps", "--format", "{{.ID}}|{{.Names}}"],
            capture_output=True, text=True, timeout=5
        )
        if cp.returncode != 0:
            return cache_set("docker_logs", logs)

        containers = []
        for line in cp.stdout.strip().splitlines():
            parts = line.split("|", 1)
            if len(parts) == 2:
                containers.append({"id": parts[0].strip(), "name": parts[1].strip().lstrip("/")})

        for c in containers:
            try:
                lp = subprocess.run(
                    ["docker", "logs", "--since", f"{since_seconds}s", "--tail", "200", c["id"]],
                    capture_output=True, text=True, timeout=8
                )
                # Docker écrit les logs sur stderr ET stdout selon le driver
                raw_lines = (lp.stdout + lp.stderr).splitlines()

                count = 0
                for line in raw_lines:
                    if count >= 15:  # max 15 erreurs par conteneur par cycle
                        break
                    line_lower = line.lower()

                    # Ignorer les lignes de bruit connues
                    if any(ig in line_lower for ig in _IGNORE_PATTERNS):
                        continue

                    # Garder uniquement les lignes qui matchent un pattern d'erreur
                    if not any(pat in line_lower for pat in _ERROR_PATTERNS):
                        continue

                    # Déterminer le niveau
                    if any(p in line_lower for p in ["fatal", "panic", "segfault", "oom", "out of memory", "sigkill"]):
                        level = "FATAL"
                    elif any(p in line_lower for p in ["traceback", "exception", "error", "critical", "failed", "failure",
                                                        "econnrefused", "econnreset", "cannot connect", "connection refused"]):
                        level = "ERROR"
                    else:
                        level = "WARN"

                    logs.append({
                        "containerName": c["name"],
                        "level":         level,
                        "message":       line.strip()[:500],
                    })
                    count += 1

            except Exception:
                pass

    except FileNotFoundError:
        pass
    except Exception:
        pass

    return cache_set("docker_logs", logs)


# ─── SYSTÈME ───────────────────────────────────────────────────────────────────

def get_system_info() -> dict:
    info = {"hostname": "unknown", "os": "unknown", "kernel": "unknown",
            "arch": platform.machine(), "pythonVersion": platform.python_version()}
    try:
        info["hostname"] = socket.gethostname()
        info["kernel"]   = platform.release()
        info["arch"]     = platform.machine()

        # OS propre depuis /etc/os-release
        try:
            with open("/etc/os-release") as f:
                lines = {}
                for line in f:
                    line = line.strip()
                    if "=" in line:
                        k, v = line.split("=", 1)
                        lines[k] = v.strip('"')
            info["os"]          = lines.get("PRETTY_NAME", platform.platform())
            info["osId"]        = lines.get("ID", "")
            info["osVersion"]   = lines.get("VERSION_ID", "")
        except Exception:
            info["os"] = platform.platform()

        # IP principale
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            info["mainIp"] = s.getsockname()[0]
            s.close()
        except Exception:
            info["mainIp"] = "unknown"

        # Timezone
        try:
            info["timezone"] = datetime.now().astimezone().tzname() or "UTC"
        except Exception:
            info["timezone"] = "UTC"

        # Nombre d'users connectés
        try:
            import psutil
            info["loggedUsers"] = len(psutil.users())
        except Exception:
            pass

    except Exception:
        pass
    return info


# ─── STATUS GLOBAL ─────────────────────────────────────────────────────────────

def compute_status(disk: dict, cpu: dict, ram: dict) -> str:
    if (disk.get("diskUsedPct", 0) >= 95
            or cpu.get("cpuLoadPct", 0) >= 95
            or ram.get("ramUsedPct", 0) >= 95):
        return "critical"
    if (disk.get("diskUsedPct", 0) >= 80
            or cpu.get("cpuLoadPct", 0) >= 80
            or ram.get("ramUsedPct", 0) >= 85):
        return "degraded"
    return "online"


# ─── PAYLOAD COMPLET ───────────────────────────────────────────────────────────

def build_metrics() -> dict:
    """Payload /metrics : toutes les métriques sauf docker (endpoint séparé)."""
    disk    = get_disk_metrics()
    ram     = get_ram_metrics()
    cpu     = get_cpu_metrics()
    uptime  = get_uptime()
    sysinfo = get_system_info()
    svcs    = get_services()
    network = get_network_metrics()
    procs   = get_top_processes()

    return {
        # ── Disk
        **{k: v for k, v in disk.items() if k != "partitions"},
        "partitions":     disk.get("partitions", []),
        # ── RAM
        **ram,
        # ── CPU
        **cpu,
        # ── Uptime
        **uptime,
        # ── Services
        "services":       svcs,
        # ── Network
        "network":        network,
        # ── Top processes
        "topProcesses":   procs,
        # ── Système
        **sysinfo,
        "agentVersion":   AGENT_VERSION,
        "collectedAt":    datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status":         compute_status(disk, cpu, ram),
    }


# ─── HTTP HANDLER ──────────────────────────────────────────────────────────────

class AgentHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        if AUTH_TOKEN:
            token = self.headers.get("X-NebulOps-Token", "") or self.headers.get("X-FleetOps-Token", "")
            if token != AUTH_TOKEN:
                self._send(401, {"error": "Unauthorized"})
                return

        path = self.path.split("?")[0]

        if path == "/metrics":
            try:
                self._send(200, build_metrics())
            except Exception as e:
                self._send(500, {"error": str(e), "status": "error"})

        elif path == "/docker":
            try:
                self._send(200, get_docker_info())
            except Exception as e:
                self._send(500, {"error": str(e)})

        elif path == "/network":
            try:
                self._send(200, get_network_metrics())
            except Exception as e:
                self._send(500, {"error": str(e)})

        elif path == "/processes":
            try:
                self._send(200, {"processes": get_top_processes()})
            except Exception as e:
                self._send(500, {"error": str(e)})

        elif path == "/logs":
            try:
                self._send(200, {"logs": get_docker_logs()})
            except Exception as e:
                self._send(500, {"error": str(e)})

        elif path == "/health":
            self._send(200, {
                "status":       "ok",
                "agentVersion": AGENT_VERSION,
                "hostname":     socket.gethostname(),
                "uptime":       get_uptime().get("uptimeHours"),
            })

        else:
            self._send(404, {"error": "Not found", "endpoints": ["/metrics", "/docker", "/network", "/processes", "/logs", "/health"]})

    def _send(self, code: int, data):
        body = json.dumps(data, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type",   "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Agent-Version", AGENT_VERSION)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{ts}] {self.client_address[0]} {args[0]} {args[1]}")


# ─── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    global AUTH_TOKEN
    parser = argparse.ArgumentParser(description="NebulOps Agent v2")
    parser.add_argument("--port",  type=int, default=DEFAULT_PORT)
    parser.add_argument("--token", type=str, default=AUTH_TOKEN)
    args = parser.parse_args()
    if args.token:
        AUTH_TOKEN = args.token

    try:
        import psutil  # noqa
    except ImportError:
        print("❌  psutil manquant — exécutez : pip3 install psutil")
        exit(1)

    disk = get_disk_metrics()
    ram  = get_ram_metrics()
    cpu  = get_cpu_metrics()

    server = HTTPServer(("0.0.0.0", args.port), AgentHandler)
    auth   = f"token=****{AUTH_TOKEN[-4:]}" if AUTH_TOKEN else "sans auth (recommandé: --token)"

    print(f"""
╔══════════════════════════════════════════════╗
║       NebulOps Agent v{AGENT_VERSION}                  ║
╚══════════════════════════════════════════════╝
  Écoute    : http://0.0.0.0:{args.port}
  Auth      : {auth}
  Hostname  : {socket.gethostname()}

  Endpoints :
    /metrics    → métriques complètes
    /docker     → containers Docker
    /network    → interfaces réseau
    /processes  → top 10 processus
    /logs       → erreurs Docker (dernières 65s)
    /health     → statut rapide

  État actuel :
    Disque  : {disk['diskUsedPct']}% utilisé ({fmtGb(disk['diskUsedGb'])} / {fmtGb(disk['diskTotalGb'])})
    RAM     : {ram['ramUsedPct']}% utilisée ({ram['ramUsedGb']} Go / {ram['ramTotalGb']} Go)
    CPU     : {cpu['cpuLoadPct']}% ({cpu['cpuCores']} cœurs)

  Ctrl+C pour arrêter
""")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("⛔  Agent arrêté.")
        server.shutdown()


def fmtGb(g):
    if g >= 1000:
        return f"{g/1024:.1f} To"
    return f"{g} Go"


if __name__ == "__main__":
    main()