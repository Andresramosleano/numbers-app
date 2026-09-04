#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera tools/numa_oracle_data.js a partir de los 4 .md de contenido de NUMA
(~/mnt/documentos/). No transcribe nada a mano: parsea por encabezados
markdown.

v2 (2 sep 2026): el veredicto ya no es por territorio (72) sino por PREGUNTA
(42 preguntas x 12 Años Personales = 504). Fuente: NUMA_504_Veredictos_por_Pregunta.md.
Clave en el JS: veredicto[idPregunta][añoPersonal], ej. veredicto["vida-3"]["9"].
El archivo viejo NUMA_54_Veredictos_AnoPersonal.md queda como histórico y ya no se lee.

v3 (2 sep 2026, tarde): el RASGO tampoco es por territorio (72) sino por PREGUNTA
(42 preguntas x 12 Números de Vida = 504). Fuente: NUMA_504_Rasgos_por_Pregunta.md.
Clave en el JS: rasgo[idPregunta][númeroDeVida], ej. rasgo["vida-3"]["6"].
Motivo: con 72 rasgos, los bloques 3 y 4 eran idénticos entre las 7 preguntas de un
territorio y el 49% de cada respuesta se repetía. El archivo viejo
NUMA_72_Rasgos_Caracter.md queda como histórico y ya no se lee.
El TIMING sigue siendo por Número de Oro (12) a propósito: habla del día, no de la pregunta.
"""
import json
import os
import re
import sys

DOCS_DIR = os.environ.get("NUMA_DOCS_DIR") or os.path.expanduser("~/mnt/documentos")
OUT_PATH = os.environ.get("NUMA_OUT_PATH") or os.path.expanduser("~/mnt/numbers-app/numa_data.js")

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


def blocks(text, header_regex, level=3):
    """Itera '### <header>' (o '####' con level=4) y devuelve
    (header_groups, body_text) hasta el siguiente heading de nivel <= level o '---'."""
    hashes = '#' * level
    stop = r'(?=\n#{2,%d}\s|\n---|\Z)' % level
    pattern = re.compile(
        r'^' + hashes + r'\s+' + header_regex + r'\n(?P<body>[\s\S]*?)' + stop,
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


# ── 2) Veredictos por PREGUNTA (Año Personal) ───────────────────────────
def parse_veredictos():
    """veredicto[idPregunta][año] con idPregunta = 'vida-1' … 'hoy-7'.
    Devuelve también {idPregunta: textoPregunta} para cotejar con el archivo de preguntas."""
    text = read("NUMA_504_Veredictos_por_Pregunta.md")
    text = text.split("## Cómo se usa esto")[0]
    sections = split_territorio_sections(text)
    veredicto = {}
    qtexts = {}
    for terr_name, terr_slug in TERR_SLUG.items():
        sec = sections.get(terr_name, "")
        for (num, qtext), qbody in blocks(sec, r'Pregunta (\d+):\s*(.+)', level=3):
            qid = f"{terr_slug}-{num}"
            qtexts[qid] = qtext.strip()
            veredicto[qid] = {}
            for (anio,), body in blocks(qbody, r'Año Personal (\d+) — .+', level=4):
                veredicto[qid][anio] = body
    return veredicto, qtexts


# ── 3) Rasgos de carácter por PREGUNTA (Número de Vida) ─────────────────
def parse_rasgos():
    """rasgo[idPregunta][númeroDeVida] con idPregunta = 'vida-1' … 'hoy-7'.
    Devuelve también {idPregunta: textoPregunta} para cotejar con el archivo de preguntas."""
    text = read("NUMA_504_Rasgos_por_Pregunta.md")
    sections = split_territorio_sections(text)
    rasgo = {}
    qtexts = {}
    for terr_name, terr_slug in TERR_SLUG.items():
        sec = sections.get(terr_name, "")
        for (num, qtext), qbody in blocks(sec, r'Pregunta (\d+):\s*(.+)', level=3):
            qid = f"{terr_slug}-{num}"
            qtexts[qid] = qtext.strip()
            rasgo[qid] = {}
            for (nv,), body in blocks(qbody, r'Número de Vida (\d+) — .+', level=4):
                rasgo[qid][nv] = body
    return rasgo, qtexts


# ── 4) Timing (Número de Oro) ───────────────────────────────────────────
def parse_timing():
    text = read("NUMA_Timing_Numero_de_Oro.md")
    text = text.split("## Ejemplo ensamblado")[0]
    items = blocks(text, r'Número de Oro (\d+) — .+')
    timing = {}
    for (num,), body in items:
        timing[num] = body
    return timing


def die(msg):
    print("ERROR: " + msg, file=sys.stderr)
    sys.exit(1)


def main():
    preguntas = parse_preguntas()
    veredicto, qtexts = parse_veredictos()
    rasgo, rqtexts = parse_rasgos()
    timing = parse_timing()

    territorios = [{"id": t, "label": TERR_LABEL[t]} for t in TERR_ORDER]

    n_terr = len(territorios)
    n_preg = sum(len(v) for v in preguntas.values())
    n_ver = sum(len(v) for v in veredicto.values())
    n_ras = sum(len(v) for v in rasgo.values())
    n_tim = len(timing)

    print(f"territorios: {n_terr}")
    print(f"preguntas:   {n_preg}")
    print(f"veredictos:  {n_ver}  ({len(veredicto)} preguntas x 12 años)")
    print(f"rasgos:      {n_ras}  ({len(rasgo)} preguntas x 12 números de vida)")
    print(f"timing:      {n_tim}")

    ok = (n_terr == 6 and n_preg == 42 and n_ver == 504 and n_ras == 504 and n_tim == 12)
    if not ok:
        for t in TERR_ORDER:
            nv = sum(len(veredicto.get(f"{t}-{i}", {})) for i in range(1, 8))
            nr = sum(len(rasgo.get(f"{t}-{i}", {})) for i in range(1, 8))
            print(f"  [{t}] preguntas={len(preguntas.get(t, []))} veredicto={nv} rasgo={nr}")
        die("CONTEOS NO CUADRAN — revisa el parser.")

    for t in TERR_ORDER:
        if len(preguntas[t]) != 7:
            die(f"territorio {t} tiene {len(preguntas[t])} preguntas, se esperaban 7")
        for p in preguntas[t]:
            qid = p["id"]
            if qid not in veredicto:
                die(f"falta veredicto para la pregunta {qid}")
            if qtexts.get(qid) != p["q"]:
                die(f"el texto de {qid} no coincide entre archivos:\n  preguntas: {p['q']}\n  veredictos: {qtexts.get(qid)}")
            if rqtexts.get(qid) != p["q"]:
                die(f"el texto de {qid} no coincide entre archivos:\n  preguntas: {p['q']}\n  rasgos:    {rqtexts.get(qid)}")
            if qid not in rasgo:
                die(f"falta rasgo para la pregunta {qid}")
            for k in NUM_KEYS:
                if k not in veredicto[qid]:
                    die(f"falta veredicto[{qid}][{k}]")
                if not veredicto[qid][k] or "\n" in veredicto[qid][k]:
                    die(f"veredicto[{qid}][{k}] vacío o con más de un párrafo")
                if k not in rasgo[qid]:
                    die(f"falta rasgo[{qid}][{k}]")
                if not rasgo[qid][k] or "\n" in rasgo[qid][k]:
                    die(f"rasgo[{qid}][{k}] vacío o con más de un párrafo")
    for k in NUM_KEYS:
        if k not in timing:
            die(f"falta timing[{k}]")

    all_v = [veredicto[q][k] for q in veredicto for k in NUM_KEYS]
    if len(set(all_v)) != len(all_v):
        die("hay veredictos duplicados")

    all_r = [rasgo[q][k] for q in rasgo for k in NUM_KEYS]
    if len(set(all_r)) != len(all_r):
        die("hay rasgos duplicados")

    obj = {
        "territorios": territorios,
        "preguntas": preguntas,
        "veredicto": veredicto,
        "rasgo": rasgo,
        "timing": timing,
    }

    js_obj = json.dumps(obj, ensure_ascii=False)
    CABECERA = "/* \u2500\u2500 NUMA_ORACLE \u00b7 generado por tools/gen_numa_oracle.py \u2014 no editar a mano \u2500\u2500 */\n"
    PIE = "/* \u2500\u2500 fin NUMA_ORACLE \u2500\u2500 */\n"
    js_content = CABECERA + "const NUMA_ORACLE=" + js_obj + ";\n" + PIE

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)

    print(f"OK — escrito {OUT_PATH} ({len(js_content)} bytes)")


if __name__ == "__main__":
    main()
