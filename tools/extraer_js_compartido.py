# -*- coding: utf-8 -*-
"""
TANDA 1c-1 — saca a shared.js las funciones de nivel superior IDENTICAS entre
index.html y zh.html. Solo el bloque <script> inline mas grande de cada archivo.

Solo mueve DECLARACIONES `function nombre(...){...}` de nivel superior. No toca
codigo suelto, ni const/let de datos, ni callbacks anonimos.

Por que es seguro respecto al orden: shared.js se carga ANTES del script inline,
y las declaraciones de funcion se izan; una funcion que antes estaba definida en
el propio inline, ahora esta definida antes todavia. Y shared.js NO ejecuta nada
al cargarse: solo declara.
"""
import re, sys

def bloque_script_grande(data: bytes):
    mejor=None
    for m in re.finditer(rb'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', data, re.S):
        if mejor is None or len(m.group(1))>len(mejor.group(1)): mejor=m
    if mejor is None: sys.exit('no encontre <script> inline')
    return mejor

def funciones_top(js: str):
    """Devuelve [(nombre, inicio, fin)] de las `function n(...){...}` que empiezan
    en columna 0 (nivel superior). Cuenta llaves respetando cadenas, plantillas,
    comentarios y regex sencillos."""
    out=[]
    for m in re.finditer(r'(?m)^function\s+([A-Za-z_$][\w$]*)\s*\(', js):
        i=js.index('{', m.end()-1)
        prof=0; j=i; n=len(js)
        en=None  # None | "'" | '"' | '`' | '//' | '/*'
        while j<n:
            c=js[j]
            if en=='//':
                if c=='\n': en=None
            elif en=='/*':
                if js.startswith('*/',j): en=None; j+=2; continue
            elif en in ("'",'"','`'):
                if c=='\\': j+=2; continue
                if c==en: en=None
            else:
                if js.startswith('//',j): en='//'; j+=2; continue
                if js.startswith('/*',j): en='/*'; j+=2; continue
                if c in "'\"`": en=c
                elif c=='{': prof+=1
                elif c=='}':
                    prof-=1
                    if prof==0: out.append((m.group(1), m.start(), j+1)); break
            j+=1
    return out

def norm(s): return re.sub(r'\s+',' ',s).strip()

idx=open('index.html','rb').read(); zh=open('zh.html','rb').read()
mi, mz = bloque_script_grande(idx), bloque_script_grande(zh)
ji = mi.group(1).decode('utf-8'); jz = mz.group(1).decode('utf-8')
fi, fz = funciones_top(ji), funciones_top(jz)
print('funciones de nivel superior -> index: %d   zh: %d' % (len(fi), len(fz)))

cuerpo_z = {n: norm(jz[a:b]) for n,a,b in fz}
comunes=[]
for n,a,b in fi:
    if n in cuerpo_z and cuerpo_z[n]==norm(ji[a:b]): comunes.append(n)
print('identicas en los dos (mismo nombre Y mismo cuerpo): %d' % len(comunes))
si=set(comunes)

# nombres duplicados dentro de un mismo archivo: no se mueven (ambigüedad)
from collections import Counter
dup = {n for n,c in Counter([n for n,_,_ in fi]).items() if c>1} | {n for n,c in Counter([n for n,_,_ in fz]).items() if c>1}
if dup:
    print('OJO: nombres declarados mas de una vez, NO se mueven: %s' % sorted(dup))
    si -= dup
print('se mueven: %d' % len(si))

cab=("/* shared.js — funciones IDENTICAS entre index.html y zh.html.\n"
     "   Generado por tools/extraer_js_compartido.py (tanda 1c-1 del paso 1).\n"
     "   NO editar a mano: se edita aqui y se regenera.\n"
     "   Se carga ANTES del script inline de cada pagina; aqui solo hay\n"
     "   declaraciones de funcion, no se ejecuta nada al cargar. */\n")
open('shared.js','w',encoding='utf-8',newline='\n').write(
    cab + '\n'.join(ji[a:b] for n,a,b in fi if n in si) + '\n')

def quitar(js, funcs, si):
    trozos=[]; ult=0
    for n,a,b in funcs:
        if n in si:
            trozos.append(js[ult:a]); ult=b
    trozos.append(js[ult:])
    return ''.join(trozos)

TAG=b'<script src="shared.js"></script>'
def reescribir(data, m, js_nuevo, funcs, nombre, crlf):
    ini=data.rfind(b'<script', 0, m.start(1))
    salida = (data[:ini] + TAG + (b'\r\n' if crlf else b'\n') +
              data[ini:m.start(1)] + js_nuevo.encode('utf-8') + data[m.end(1):])
    assert b'\x00' not in salida
    open(nombre,'wb').write(salida)
    print('%s: %d -> %d bytes' % (nombre, len(data), len(salida)))

reescribir(idx, mi, quitar(ji, fi, si), fi, 'index.html', crlf=False)
reescribir(zh,  mz, quitar(jz, fz, si), fz, 'zh.html',    crlf=True)
