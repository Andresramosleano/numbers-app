#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera numbers-app/numa_data_en.js a partir de los .md en inglés de NUMA.

NO TOCA EL ESPAÑOL. Es un archivo aparte de gen_numa_oracle.py a propósito: el generador
español es producción probada y no se arriesga por un cambio del inglés.

Fuentes (todas en documentos\):
  NUMA_EN_<TERR>_Q<n>_BORRADOR.md   42 archivos, 24 textos cada uno (12 PY + 12 LN)
  NUMA_EN_TIMING_Numero_de_Oro.md   12 líneas de timing (#### GN1 … GN33)

Salida: numbers-app/numa_data_en.js con  const NUMA_ORACLE_EN={...};
La forma del objeto es IDÉNTICA a la de NUMA_ORACLE (español), para que index.html
solo tenga que elegir cuál de los dos usa según el idioma.

Uso:
  python3 tools/gen_numa_oracle_en.py            # exige las 42 preguntas
  python3 tools/gen_numa_oracle_en.py --partial  # construye con lo que haya y avisa qué falta
"""
import json
import os
import re
import sys

DOCS_DIR = os.environ.get("NUMA_DOCS_DIR") or os.path.expanduser("~/mnt/documentos")
OUT_PATH = os.environ.get("NUMA_EN_OUT_PATH") or os.path.expanduser("~/mnt/numbers-app/numa_data_en.js")

TERR_ORDER = ["vida", "amor", "trabajo", "dinero", "bienestar", "hoy"]
TERR_FILE = {"vida": "VIDA", "amor": "AMOR", "trabajo": "TRABAJO",
             "dinero": "DINERO", "bienestar": "BIENESTAR", "hoy": "HOY"}
# Etiquetas de los chips de territorio en la app inglesa.
TERR_LABEL_EN = {"vida": "Life", "amor": "Love", "trabajo": "Work",
                 "dinero": "Money", "bienestar": "Wellbeing", "hoy": "Today"}
NUM_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "22", "33"]

TIMING_FILE = "NUMA_EN_TIMING_Numero_de_Oro.md"


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def parse_bloques(path):
    """Devuelve {clave: texto} para cada '#### CLAVE' del archivo.
    El texto es todo lo que sigue hasta el próximo '#'/'**', unido en un solo párrafo."""
    out, key = {}, None
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#### "):
                key = line[5:].strip()
                out[key] = ""
            elif key and line.strip() and not line.startswith(("#", "**", "---")):
                out[key] += " " + line.strip()
            elif line.startswith(("## ", "---")):
                key = None
    return {k: v.strip() for k, v in out.items() if v.strip()}


def parse_pregunta(path, terr_slug, num):
    """Lee un archivo de pregunta y devuelve (texto_pregunta, entrada, veredicto, rasgo)."""
    with open(path, encoding="utf-8") as f:
        head = [next(f, "") for _ in range(6)]
    texto = "".join(head)

    # Texto de la pregunta: '# TERR Qn — <pregunta> (BORRADOR)'  o  '## Question n: <pregunta>'
    q = None
    m = re.search(r'^#\s+\w+\s+Q\d+\s+[—–-]\s+(.+?)\s*\(BORRADOR\)\s*$', texto, re.M)
    if m:
        q = m.group(1).strip()
    if not q:
        m = re.search(r'^##\s+Question\s+\d+:\s*(.+)$', texto, re.M)
        if m:
            q = m.group(1).strip()
    if not q:
        die(f"{os.path.basename(path)}: no encuentro el texto de la pregunta en las primeras líneas")

    m = re.search(r'^\*\*ENTRY:\*\*\s*(.+)$', texto, re.M)
    if not m:
        die(f"{os.path.basename(path)}: falta la línea **ENTRY:**")
    entrada = m.group(1).strip()

    bloques = parse_bloques(path)
    veredicto, rasgo = {}, {}
    for k, v in bloques.items():
        mk = re.match(r'^(PY|LN)(\d+)$', k)
        if not mk:
            die(f"{os.path.basename(path)}: clave '{k}' no es PY<n> ni LN<n>")
        (veredicto if mk.group(1) == "PY" else rasgo)[mk.group(2)] = v

    qid = f"{terr_slug}-{num}"
    for nombre, d in (("veredicto", veredicto), ("rasgo", rasgo)):
        faltan = [k for k in NUM_KEYS if k not in d]
        if faltan:
            die(f"{qid}: faltan {nombre}s {faltan}")
        sobran = [k for k in d if k not in NUM_KEYS]
        if sobran:
            die(f"{qid}: {nombre}s con clave inesperada {sobran}")
    return q, entrada, veredicto, rasgo


def parse_timing():
    path = os.path.join(DOCS_DIR, TIMING_FILE)
    if not os.path.exists(path):
        die(f"falta {TIMING_FILE} — es el bloque 4 de toda respuesta y no existe en inglés hasta que se escriba")
    bloques = parse_bloques(path)
    timing = {}
    for k, v in bloques.items():
        mk = re.match(r'^GN(\d+)$', k)
        if not mk:
            die(f"{TIMING_FILE}: clave '{k}' no es GN<n>")
        timing[mk.group(1)] = v
    faltan = [k for k in NUM_KEYS if k not in timing]
    if faltan:
        die(f"timing: faltan {faltan}")
    return timing


def main():
    partial = "--partial" in sys.argv

    preguntas, veredicto, rasgo = {}, {}, {}
    faltantes = []
    for slug in TERR_ORDER:
        lst = []
        for n in range(1, 8):
            fname = f"NUMA_EN_{TERR_FILE[slug]}_Q{n}_BORRADOR.md"
            path = os.path.join(DOCS_DIR, fname)
            if not os.path.exists(path):
                faltantes.append(fname)
                continue
            q, entrada, ver, ras = parse_pregunta(path, slug, n)
            qid = f"{slug}-{n}"
            lst.append({"id": qid, "q": q, "entrada": entrada})
            veredicto[qid] = ver
            rasgo[qid] = ras
        preguntas[slug] = lst

    if faltantes:
        print("FALTAN %d preguntas:" % len(faltantes))
        for f in faltantes:
            print("   - " + f)
        if not partial:
            die("faltan archivos. Corre con --partial si quieres construir igual para probar.")
        print("--partial activo: se construye sin ellas. NO PUBLICAR ASÍ.")

    timing = parse_timing()

    n_preg = sum(len(v) for v in preguntas.values())
    n_ver = sum(len(v) for v in veredicto.values())
    n_ras = sum(len(v) for v in rasgo.values())
    print(f"territorios: {len(TERR_ORDER)}")
    print(f"preguntas:   {n_preg} de 42")
    print(f"veredictos:  {n_ver}  ({len(veredicto)} preguntas x 12 años)")
    print(f"rasgos:      {n_ras}  ({len(rasgo)} preguntas x 12 números de vida)")
    print(f"timing:      {len(timing)}")

    # Duplicados: dos preguntas distintas nunca deben compartir un texto exacto.
    all_v = [veredicto[q][k] for q in veredicto for k in NUM_KEYS]
    if len(set(all_v)) != len(all_v):
        die("hay veredictos duplicados en inglés")
    all_r = [rasgo[q][k] for q in rasgo for k in NUM_KEYS]
    if len(set(all_r)) != len(all_r):
        die("hay rasgos duplicados en inglés")

    # Placeholders del motor viejo que no deben viajar al oráculo.
    for qid, d in list(veredicto.items()) + list(rasgo.items()):
        for k, v in d.items():
            if "{" in v or "}" in v:
                die(f"{qid}[{k}] contiene una llave — el oráculo no usa placeholders: {v[:60]}")

    obj = {
        "territorios": [{"id": t, "label": TERR_LABEL_EN[t]} for t in TERR_ORDER],
        "preguntas": preguntas,
        "veredicto": veredicto,
        "rasgo": rasgo,
        "timing": timing,
    }

    js = ("/* ── NUMA_ORACLE_EN · generado por tools/gen_numa_oracle_en.py — no editar a mano ── */\n"
          + "const NUMA_ORACLE_EN=" + json.dumps(obj, ensure_ascii=False) + ";\n"
          + "/* ── fin NUMA_ORACLE_EN ── */\n")

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"OK — escrito {OUT_PATH} ({len(js)} bytes)")
    if faltantes:
        print("⚠️  PARCIAL: faltan %d preguntas. No publicar." % len(faltantes))


if __name__ == "__main__":
    main()
