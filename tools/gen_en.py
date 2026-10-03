#!/usr/bin/env python3
"""Genera en.html (la portada en ingles, servida en /en) a partir de index.html.

REGLA: en.html NUNCA se edita a mano. Se edita index.html y se corre:
    python3 tools/gen_en.py          -> escribe en.html
    python3 tools/gen_en.py --check  -> exit 1 si en.html no coincide con index.html

Solo cambia la cabecera (idioma, titulo, descripcion, og/twitter, canonical) y vuelve
absolutas las rutas de los recursos. El cuerpo es identico: el arranque (head de
index.html) detecta la ruta /en y pone la app en ingles.
Decision: REGISTRO_DECISIONES 1.38 (Andres, 2 oct 2026).
"""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'index.html')
OUT = os.path.join(ROOT, 'en.html')

T_ES = 'NUMBERS ORACLE — Tu Número de Oro del Día'
T_EN = 'NUMBERS ORACLE — Your Golden Number for Today'

REPL = [
    ('<html lang="es">', '<html lang="en">'),
    ('<meta name="description" content="NUMBERS ORACLE — Tu Número de Oro del Día. Cinco fuerzas cósmicas: numerología, astrología, ciclos lunares, calendario chino y geoenergía.">',
     '<meta name="description" content="NUMBERS ORACLE — Your Golden Number for Today. Five cosmic forces: numerology, astrology, lunar cycles, the Chinese calendar and geo-energy.">'),
    ('<meta property="og:title" content="' + T_ES + '">', '<meta property="og:title" content="' + T_EN + '">'),
    ('<meta property="og:description" content="Cinco fuerzas cósmicas calculan tu número del día: numerología, astrología, ciclos lunares, calendario chino y geoenergía. Único para ti. Cambia cada 24h.">',
     '<meta property="og:description" content="Five cosmic forces calculate your number for today: numerology, astrology, lunar cycles, the Chinese calendar and geo-energy. Unique to you. Changes every 24h.">'),
    ('<meta property="og:image:alt" content="' + T_ES + '">', '<meta property="og:image:alt" content="' + T_EN + '">'),
    ('<meta property="og:locale" content="es_ES">', '<meta property="og:locale" content="en_US">'),
    ('<meta property="og:locale:alternate" content="en_US">', '<meta property="og:locale:alternate" content="es_ES">'),
    ('<meta property="og:url" content="https://www.numbersoracle.com">', '<meta property="og:url" content="https://www.numbersoracle.com/en">'),
    ('<link rel="canonical" href="https://www.numbersoracle.com/">', '<link rel="canonical" href="https://www.numbersoracle.com/en">'),
    ('<meta name="twitter:title" content="' + T_ES + '">', '<meta name="twitter:title" content="' + T_EN + '">'),
    ('<meta name="twitter:description" content="Cinco fuerzas cósmicas calculan tu número del día único para ti. Numerología, astrología, luna, calendario chino y geoenergía.">',
     '<meta name="twitter:description" content="Five cosmic forces calculate a number for today that is unique to you. Numerology, astrology, the moon, the Chinese calendar and geo-energy.">'),
    ('<title>NUMBERS ORACLE ✦ — Tu Número de Oro del Día</title>', '<title>NUMBERS ORACLE ✦ — Your Golden Number for Today</title>'),
    # rutas absolutas: /en/ (con barra) no debe romper los recursos
    ('href="shared.css"', 'href="/shared.css"'),
    ('src="shared.js"', 'src="/shared.js"'),
    ('src="numa_data.js"', 'src="/numa_data.js"'),
    ('src="numa_data_en.js"', 'src="/numa_data_en.js"'),
]
MARK = '<!-- GENERADO por tools/gen_en.py desde index.html. NO EDITAR A MANO. -->'

def build():
    with open(SRC, 'r', encoding='utf-8', newline='') as f:
        s = f.read()
    for a, b in REPL:
        n = s.count(a)
        if n != 1:
            sys.exit('gen_en: se esperaba 1 aparicion y hay %d de: %s' % (n, a[:90]))
        s = s.replace(a, b)
    nl = '\r\n' if '\r\n' in s else '\n'
    i = s.index('<head>') + len('<head>')
    return s[:i] + nl + MARK + s[i:]

if __name__ == '__main__':
    out = build()
    if '--check' in sys.argv:
        cur = open(OUT, 'r', encoding='utf-8', newline='').read() if os.path.exists(OUT) else ''
        if cur != out:
            print('en.html DESFASADO de index.html: correr python3 tools/gen_en.py'); sys.exit(1)
        print('en.html: OK (coincide con index.html)'); sys.exit(0)
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('en.html escrito (%d bytes)' % len(out.encode('utf-8')))
