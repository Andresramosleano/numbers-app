#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera tools/numa_oracle_data.js a partir de los 4 .md de contenido de NUMA
(~/mnt/documentos/). No transcribe nada a mano: parsea por encabezados
markdown. Ver PASO 2 del prompt de la tarea para las reglas completas.
"""
import json
import os
import re
import sys

DOCS_DIR = os.path.expanduser("~/mnt/documentos")
OUT_PATH = os.path.expanduser("~/mnt/numbers-app/tools/numa_oracle_data.js")

TERR_SLUG = {
    "VIDA": "vida",
    "AMOR": "amor",
    "TRABAJO": "trabajo",
    "DINERO": "dinero",
    "BIENESTAR": "bienestar",
    "HOY": "hoy",
}
TERR_LABEL = {
    "vida": "Vida",
    "amor": "Amor",
    "trabajo": "Trabajo",
    "dinero": "Dinero",
    "bienestar": "Bienestar",
    "hoy": "Hoy",
}
TERR_ORDER = ["vida", "amor", "trabajo", "dinero", "bienestar", "hoy"]
NUM_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "11", "22", "33"]


def read(fname):
    path = os.path.join(DOCS_DIR, fname)
    with open(path, encoding="utf-8") as f:
        return f.read()


def split_territorio_sections(text):
    """Devuelve dict {'VIDA': texto_de_la_seccion, ...} cortando en cada
    '## Territorio: X' hasta el siguiente '## ' (o fin de archivo)."""
    out = {}
    heads = list(re.finditer(r'^##\s+(.*)$', text, re.M))
    for i, h in enumerate(heads):
        title = h.group(1).strip()
        m = re.match(r'Territorio:\s*(\w+)', title)
        if not m:
            continue
        terr_name = m.group(1)
        start = h.end()
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        out[terr_name] = text[start:end]
    return out


def blocks(text, header_regex):
    """Itera '### <header>' y devuelve (header_groups, body_text) hasta el
    siguiente heading de nivel 2/3 o '---'."""
    pattern = re.compile(
        r'^###\s+' + header_regex + r'\n(?P<body>[\s\S]*?)(?=\n#{2,3}\s|\n---|\Z)',
        re.M,
    )
    out = []
    for m in pattern.finditer(text):
        out.append((m.groups()[:-1], m.group('body').strip()))
    return out


# ── 1) Preguntas y entradas ─────────────────────────────────────────────
def parse_preguntas():
    text = read("NUMA_Preguntas_y_Entradas.md")
    sections = split_territorio_sections(text)
    preguntas = {}
    for terr_name, terr_slug in TERR_SLUG.items():
        sec = sections.get(terr_name, "")
        items = blocks(sec, r'(\d+)\.\s*(.+)')
        lst = []
        for (num, qtext), body in items:
            m = re.search(r'\*\*Entrada:\*\*\s*(.+)', body)
            entrada = m.group(1).strip() if m else ""
            lst.append({
                "id": f"{terr_slug}-{num}",
                "q": qtext.strip(),
                "entrada": entrada,
            })
        preguntas[terr_slug] = lst
    return preguntas


# ── 2) Veredictos (Año Personal) ────────────────────────────────────────
def parse_veredictos():
    text = read("NUMA_54_Veredictos_AnoPersonal.md")
    text = text.split("## Cómo se usa esto")[0]
    sections = split_territorio_sections(text)
    veredicto = {t: {} for t in TERR_ORDER}

    for terr_name, terr_slug in TERR_SLUG.items():
        sec = sections.get(terr_name, "")
        items = blocks(sec, r'Año Personal (\d+) — .+')
        for (num,), body in items:
            veredicto[terr_slug][num] = body

    m = re.search(r'^##\s+Números maestros.*$', text, re.M)
    if m:
        maestros_text = text[m.end():]
        items = blocks(maestros_text, r'Territorio (\w+) · Año Personal (\d+) — .+')
        for (terr_name, num), body in items:
            terr_slug = TERR_SLUG.get(terr_name)
            if terr_slug:
                veredicto[terr_slug][num] = body
    return veredicto


# ── 3) Rasgos de carácter (Número de Vida) ──────────────────────────────
def parse_rasgos():
    text = read("NUMA_72_Rasgos_Caracter.md")
    sections = split_territorio_sections(text)
    rasgo = {t: {} for t in TERR_ORDER}
    for terr_name, terr_slug in TERR_SLUG.items():
        sec = sections.get(terr_name, "")
        items = blocks(sec, r'Número de Vida (\d+) — .+')
        for (num,), body in items:
            rasgo[terr_slug][num] = body
    return rasgo


# ── 4) Timing (Número de Oro) ───────────────────────────────────────────
def parse_timing():
    text = read("NUMA_Timing_Numero_de_Oro.md")
    text = text.split("## Ejemplo ensamblado")[0]
    items = blocks(text, r'Número de Oro (\d+) — .+')
    timing = {}
    for (num,), body in items:
        timing[num] = body
    return timing


def main():
    preguntas = parse_preguntas()
    veredicto = parse_veredictos()
    rasgo = parse_rasgos()
    timing = parse_timing()

    territorios = [{"id": t, "label": TERR_LABEL[t]} for t in TERR_ORDER]

    n_terr = len(territorios)
    n_preg = sum(len(v) for v in preguntas.values())
    n_ver = sum(len(v) for v in veredicto.values())
    n_ras = sum(len(v) for v in rasgo.values())
    n_tim = len(timing)

    print(f"territorios: {n_terr}")
    print(f"preguntas:   {n_preg}")
    print(f"veredictos:  {n_ver}")
    print(f"rasgos:      {n_ras}")
    print(f"timing:      {n_tim}")

    ok = (n_terr == 6 and n_preg == 42 and n_ver == 72 and n_ras == 72 and n_tim == 12)
    if not ok:
        for t in TERR_ORDER:
            print(f"  [{t}] preguntas={len(preguntas.get(t, []))} "
                  f"veredicto={len(veredicto.get(t, {}))} "
                  f"rasgo={len(rasgo.get(t, {}))}")
        print("CONTEOS NO CUADRAN — revisa el parser.", file=sys.stderr)
        sys.exit(1)

    for t in TERR_ORDER:
        if len(preguntas[t]) != 7:
            print(f"ERROR: territorio {t} tiene {len(preguntas[t])} preguntas, se esperaban 7", file=sys.stderr)
            sys.exit(1)
        for k in NUM_KEYS[:9]:
            if k not in veredicto[t]:
                print(f"ERROR: falta veredicto[{t}][{k}]", file=sys.stderr)
                sys.exit(1)
        for k in ["11", "22", "33"]:
            if k not in veredicto[t]:
                print(f"ERROR: falta veredicto maestro [{t}][{k}]", file=sys.stderr)
                sys.exit(1)
        for k in NUM_KEYS:
            if k not in rasgo[t]:
                print(f"ERROR: falta rasgo[{t}][{k}]", file=sys.stderr)
                sys.exit(1)
    for k in NUM_KEYS:
        if k not in timing:
            print(f"ERROR: falta timing[{k}]", file=sys.stderr)
            sys.exit(1)

    obj = {
        "territorios": territorios,
        "preguntas": preguntas,
        "veredicto": veredicto,
        "rasgo": rasgo,
        "timing": timing,
    }

    js_obj = json.dumps(obj, ensure_ascii=False)
    js_content = "const NUMA_ORACLE=" + js_obj + ";\n"

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"OK — escrito {OUT_PATH} ({len(js_content)} bytes)")


if __name__ == "__main__":
    main()
