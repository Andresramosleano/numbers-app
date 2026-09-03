# -*- coding: utf-8 -*-
"""
DETECTOR DE DERIVA ENTRE IDIOMAS — Numbers Oracle
=================================================
Por que existe (3 sep 2026): `zh.html` nacio como copia a mano de `index.html`.
TODOS los bugs encontrados el 3 sep estaban en las partes que NO eran identicas:
arreglos que se hicieron en espanol y nunca llegaron al chino (dreamUpsell,
wcRibbonGo, applyStaticLang, media regla de CSS, y la tarjeta del Numero de Vida,
que directamente no existe en chino).

Compartir codigo en shared.css/shared.js protege lo que YA estaba igual. Esto
protege lo otro: avisa cuando una funcion que existe en los dos archivos empieza
a tener LOGICA distinta, o cuando una desaparece de uno de los dos.

Como distingue texto de logica: sustituye cada literal de cadena por «S» y
normaliza espacios. Asi, una traduccion NO es deriva; un `if` de mas, SI.

  python3 tools/comparar_idiomas.py            -> informe legible
  python3 tools/comparar_idiomas.py --breve    -> una linea (para el preflight)

Sale con codigo 1 si hay deriva NO justificada.
"""
import re, sys, json, os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------------------
# EXCEPCIONES: divergencias JUSTIFICADAS, una por una, con su motivo.
# Editar esta lista es una decision, no un tramite: si algo entra aqui sin
# motivo real, el detector deja de servir. El motivo se imprime en el informe.
# ---------------------------------------------------------------------------
IDENT_JUSTIFICADOS = {
 'showTab':'nav-ciclos en zh vs nav-oraculos en index: el boton #nav-ciclos SI existe en la bottom-nav china, que nunca se reestructuro. Cambiarlo iluminaria un boton distinto del pulsado.',
}

JUSTIFICADAS = {
 # --- distintas a proposito (medido el 3 sep) ---
 'showFuerzas':     'Unica diferencia MEDIDA: el parametro local de una funcion interna se llama es en index y zh en zh.html (var setT=function(id,es,e2) vs (id,zh,e2)), usado igual en los dos lados. Cosmetico, sin efecto. No se toca produccion por un nombre de variable.',
 'populateLeagues': 'zh tiene un fallback DE MAS que index no necesita: chip.textContent = l===en ? r.lg.en : (r.lg.zh||r.lg.es). El chino esta por delante aqui, no por detras.',
 'citySearch':      'El indice de idioma dentro del array de ciudades es distinto en cada archivo (0=es/1=en vs 1=en/2=zh).',
 'citySelect':      'Mismo motivo que citySearch: estructura de datos distinta, no texto.',
 'setLang':         'Cada archivo redirige AL OTRO; por definicion no pueden ser la misma funcion.',
 'detectRegionPricing':'index cubre Latam/USA/SEA; zh solo necesita el precio de China. Fusionar meteria logica muerta en zh.',
 'generate':        'A zh le falta la rama de cuota de Sports; Sports es lo mas parecido a una prediccion, justo lo que China prohibe.',
 'renderResult':    'zh usa tZH/tMoon/tZodiac/tAnimal (solo existen alli) para traducir signo, luna y animal.',
 'dreamCompute':    'zh NO incluye la funcion "charada" (numero de loteria folclorico): es exactamente el lenguaje que la ley china prohibe.',
 'dreamReveal':     'A zh le falta el puente hacia /suenos/, y esta bien: esas paginas solo existen en espanol (regla firme de i18n).',
 # --- el motor viejo de NUMA en zh: frente aparte, decidido el 3 sep ---
 'numaOpen':        'zh sigue con el motor NUMA de 12 preguntas; portar el oraculo de 4 capas es contenido nuevo en chino (frente aparte).',
 'numaAsk':         'Idem numaOpen.',
 'numaGreet':       'Idem numaOpen.',
 'numaAddBubble':   'Idem numaOpen.',
 # --- diferencias medidas el 3 sep que NO se corrigen (feature o riesgo) ---
 'renderProfile':   'A zh le falta ENTERA la tarjeta del Numero de Vida (JS + DOM + CSS). Es una feature que falta, no texto. APARCADA.',
 'updateFreemiumBar':'zh no tiene las 3 funciones de cuota de Sports; copiar la rama meteria un ReferenceError. APARCADA.',
 'buildSignalCard': 'zh se salta una concatenacion que index si tiene: puede ser un texto que falta en chino. SIN REVISAR, apuntada.',
 'doForgotPw':      'index envuelve los mensajes con el helper bilingue L(es,en); zh pasa el string directo. Diferencia de forma, no de comportamiento.',
 'doResetPw':       'Idem doForgotPw.',
 'loginWithGoogle': 'Idem doForgotPw, en el catch.',
}

# ---------------------------------------------------------------------------
# Funciones que existen en UN SOLO archivo, a proposito.
# ---------------------------------------------------------------------------
SOLO_EN_UNO = {
 'numaTerritorioActivo':'Oraculo NUMA de 4 capas: solo index. Portarlo al chino es contenido nuevo (frente aparte).',
 'numaPersonalYear':'Idem oraculo NUMA de 4 capas.', 'numaNumeroVida':'Idem oraculo NUMA de 4 capas.',
 'numaNumeroOro':'Idem oraculo NUMA de 4 capas.', 'numaPick':'Idem oraculo NUMA de 4 capas.',
 'numaRenderTerritorios':'Idem oraculo NUMA de 4 capas.', 'numaRenderChipsTerritorio':'Idem oraculo NUMA de 4 capas.',
 'numaModoLectura':'Modo lectura de NUMA: solo index (va con el oraculo de 4 capas).',
 'numaVolverPreguntas':'Idem modo lectura de NUMA.',
 'sportsQuotaKey':'Cuota de Sports: solo index. Sports es lo mas parecido a una prediccion, que China prohibe.',
 'sportsQuotaToday':'Idem cuota de Sports.', 'incrementSportsQuota':'Idem cuota de Sports.',
 'tZH':'Traduce al chino signo/luna/animal. index no la necesita.',
 'tMoon':'Idem tZH.', 'tZodiac':'Idem tZH.', 'tAnimal':'Idem tZH.',
}

# Literales que NO son texto de usuario sino identificadores del DOM o claves:
# un id equivocado aqui es un bug real (paso el 3 sep con nav-ciclos/nav-oraculos)
# y la pasada de "logica" no lo ve, porque enmascara las cadenas.
# Calibrado midiendo (3 sep): la primera version marcaba tambien 'Usuario',
# 'Ocultar', 'Reintentar', 'Force'... que son TEXTO DE USUARIO, no ids. En este
# codigo los ids y clases del DOM son siempre minusculas con guion o guion bajo
# (nav-ciclos, tab-form, numa-terrs, profile-lifenum-box, latam_annual). Una
# palabra suelta capitalizada nunca es un id. Con esta regla los 6 falsos
# positivos medidos desaparecen y el caso real (nav-ciclos) se sigue viendo.
RE_IDENT = re.compile(r"^[#.]?[a-z][a-z0-9]*([-_][a-z0-9]+)+$")
NO_SON_IDENT = {'true','false','none','block','flex','hidden','active','show','open'}

def bloque_script_grande(data: bytes):
    mejor = None
    for m in re.finditer(rb'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', data, re.S):
        if mejor is None or len(m.group(1)) > len(mejor.group(1)): mejor = m
    if mejor is None: sys.exit('no encontre <script> inline')
    return mejor

def funciones_top(js: str):
    """Declaraciones `[async ]function nombre(...){...}` en columna cero.
    Cuenta llaves respetando cadenas, plantillas y comentarios."""
    out = []
    for m in re.finditer(r'(?m)^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', js):
        i = js.index('{', m.end()-1); prof = 0; j = i; n = len(js); en = None
        while j < n:
            c = js[j]
            if en == '//':
                if c == '\n': en = None
            elif en == '/*':
                if js.startswith('*/', j): en = None; j += 2; continue
            elif en in ("'", '"', '`'):
                if c == '\\': j += 2; continue
                if c == en: en = None
            else:
                if js.startswith('//', j): en = '//'; j += 2; continue
                if js.startswith('/*', j): en = '/*'; j += 2; continue
                if c in "'\"`": en = c
                elif c == '{': prof += 1
                elif c == '}':
                    prof -= 1
                    if prof == 0: out.append((m.group(1), m.start(), j+1)); break
            j += 1
    return out

def sin_texto(s: str) -> str:
    """Reemplaza cada literal de cadena por «S». Una traduccion deja de ser una
    diferencia; un cambio de logica sigue siendolo. Tambien quita comentarios,
    porque un comentario traducido tampoco es deriva."""
    out = []; i = 0; n = len(s)
    while i < n:
        c = s[i]
        if s.startswith('//', i):
            j = s.find('\n', i); i = n if j < 0 else j; continue
        if s.startswith('/*', i):
            j = s.find('*/', i); i = n if j < 0 else j+2; continue
        if c in "'\"`":
            q = c; j = i+1
            while j < n:
                if s[j] == '\\': j += 2; continue
                if s[j] == q: break
                j += 1
            out.append('«S»'); i = j+1; continue
        out.append(c); i += 1
    return re.sub(r'\s+', ' ', ''.join(out)).strip()

def identificadores(cuerpo: str):
    """Literales que parecen un id/clase/selector del DOM. Se comparan aparte
    porque la pasada de logica los enmascara y ahi se escondio el bug de
    nav-ciclos: en zh el boton #nav-ciclos existe y en index ya no."""
    out=set(); i=0; n=len(cuerpo)
    while i<n:
        c=cuerpo[i]
        if cuerpo.startswith('//',i):
            j=cuerpo.find('\n',i); i=n if j<0 else j; continue
        if cuerpo.startswith('/*',i):
            j=cuerpo.find('*/',i); i=n if j<0 else j+2; continue
        if c in "'\"`":
            q=c; j=i+1
            while j<n:
                if cuerpo[j]=='\\': j+=2; continue
                if cuerpo[j]==q: break
                j+=1
            lit=cuerpo[i+1:j]
            if RE_IDENT.match(lit) and lit.lower() not in NO_SON_IDENT and len(lit)>2:
                out.add(lit)
            i=j+1; continue
        i+=1
    return out

def main():
    breve = '--breve' in sys.argv
    idx = open(os.path.join(RAIZ, 'index.html'), 'rb').read()
    zh  = open(os.path.join(RAIZ, 'zh.html'),   'rb').read()
    compartido = os.path.join(RAIZ, 'shared.js')
    js_sh = open(compartido, encoding='utf-8').read() if os.path.exists(compartido) else ''

    ji = bloque_script_grande(idx).group(1).decode('utf-8')
    jz = bloque_script_grande(zh ).group(1).decode('utf-8')
    fi = {n: ji[a:b] for n, a, b in funciones_top(ji)}
    fz = {n: jz[a:b] for n, a, b in funciones_top(jz)}
    fsh = {n for n, a, b in funciones_top(js_sh)}

    solo_idx = sorted(n for n in set(fi)-set(fz)-fsh if n not in SOLO_EN_UNO)
    solo_zh  = sorted(n for n in set(fz)-set(fi)-fsh if n not in SOLO_EN_UNO)
    deriva, justif = [], []
    for n in sorted(set(fi) & set(fz)):
        if sin_texto(fi[n]) == sin_texto(fz[n]): continue
        (justif if n in JUSTIFICADAS else deriva).append(n)
    # pasada B: identificadores del DOM distintos entre los dos archivos
    ident_dif, ident_just = [], []
    for n in sorted(set(fi) & set(fz)):
        a_, b_ = identificadores(fi[n]), identificadores(fz[n])
        if a_ == b_: continue
        d = 'solo index: '+', '.join(sorted(a_-b_)) if a_-b_ else ''
        d += (' | ' if d and b_-a_ else '') + ('solo zh: '+', '.join(sorted(b_-a_)) if b_-a_ else '')
        (ident_just if n in JUSTIFICADAS or n in IDENT_JUSTIFICADOS else ident_dif).append((n,d))

    if breve:
        mal = len(deriva)+len(solo_idx)+len(solo_zh)+len(ident_dif)
        print('idiomas: %s | compartidas:%d | logica-distinta:%d ids-distintos:%d solo-en-uno:%d  (justificadas: %d logica, %d ids, %d solo-en-uno)%s'
              % ('OK' if not mal else 'DERIVA', len(fsh), len(deriva), len(ident_dif),
                 len(solo_idx)+len(solo_zh), len(justif), len(ident_just), len(SOLO_EN_UNO),
                 '' if not mal else ' -> ' + ', '.join(deriva+[n for n,_ in ident_dif]+solo_idx+solo_zh)))
        return 1 if mal else 0

    print('=== DERIVA ENTRE index.html Y zh.html ===')
    print('funciones en shared.js (comunes a los dos): %d' % len(fsh))
    print('funciones propias de index: %d | propias de zh: %d' % (len(fi), len(fz)))
    print()
    print('--- LOGICA DISTINTA, SIN JUSTIFICAR (%d)  <-- esto es lo que hay que mirar' % len(deriva))
    for n in deriva: print('   !! %s' % n)
    if not deriva: print('   (ninguna)')
    print()
    print('--- SOLO EN UNO DE LOS DOS (%d)' % (len(solo_idx)+len(solo_zh)))
    for n in solo_idx: print('   !! %s  -- solo en index.html' % n)
    for n in solo_zh:  print('   !! %s  -- solo en zh.html' % n)
    if not solo_idx and not solo_zh: print('   (ninguna)')
    print()
    print('--- IDENTIFICADORES DEL DOM DISTINTOS, SIN JUSTIFICAR (%d)  <-- un id equivocado es un bug real' % len(ident_dif))
    for n,d in ident_dif: print('   !! %-20s %s' % (n,d))
    if not ident_dif: print('   (ninguno)')
    print()
    print('--- IDENTIFICADORES DISTINTOS, JUSTIFICADOS (%d)' % len(ident_just))
    for n,d in ident_just: print('   ok %-20s %s' % (n, IDENT_JUSTIFICADOS.get(n) or d))
    print()
    print('--- LOGICA DISTINTA, JUSTIFICADA (%d)' % len(justif))
    for n in justif: print('   ok %-20s %s' % (n, JUSTIFICADAS[n]))
    sobra = sorted(set(JUSTIFICADAS) - set(justif) - set(fsh))
    if sobra:
        print()
        print('--- EXCEPCIONES QUE YA NO HACEN FALTA (%d): esas funciones ya no divergen o' % len(sobra))
        print('    ya no existen. Quitarlas de JUSTIFICADAS para que la lista no envejezca:')
        for n in sobra: print('   -- %s' % n)
    return 1 if deriva or solo_idx or solo_zh else 0

sys.exit(main())
