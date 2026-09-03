# -*- coding: utf-8 -*-
"""
TANDA 1b — saca a shared.css las reglas CSS identicas entre index.html y zh.html.
Solo toca el bloque <style> GRANDE de cada archivo (el primero); los bloques
pequenos se dejan como estan para acotar el riesgo.
Se ejecuta en binario y verifica cada anclaje. No publica nada.
"""
import re, sys, io

def partir_reglas(css: str):
    """Parte CSS de nivel superior en unidades. @media/@supports/@keyframes
    cuentan como UNA unidad (con todo su cuerpo). Respeta comentarios y cadenas."""
    reglas, i, n, ini = [], 0, len(css), 0
    prof, en_com, en_str, q = 0, False, False, ''
    while i < n:
        c = css[i]
        if en_com:
            if css.startswith('*/', i): en_com=False; i+=2; continue
            i+=1; continue
        if en_str:
            if c=='\\': i+=2; continue
            if c==q: en_str=False
            i+=1; continue
        if css.startswith('/*', i): en_com=True; i+=2; continue
        if c in '"\'': en_str=True; q=c; i+=1; continue
        if c=='{': prof+=1
        elif c=='}':
            prof-=1
            if prof==0:
                reglas.append(css[ini:i+1]); i+=1
                while i<n and css[i] in ' \t\r\n': i+=1
                ini=i; continue
        i+=1
    resto = css[ini:].strip()
    if resto: reglas.append(resto)
    return reglas

def norm(r: str) -> str:
    """Normaliza para comparar: quita comentarios y colapsa espacios."""
    r = re.sub(r'/\*.*?\*/', '', r, flags=re.S)
    return re.sub(r'\s+', ' ', r).strip()

def bloque_style(data: bytes):
    m = re.search(rb'<style[^>]*>(.*?)</style>', data, re.S)
    if not m: sys.exit('no encontre <style> en el archivo')
    return m

idx = open('index.html','rb').read()
zh  = open('zh.html','rb').read()
mi, mz = bloque_style(idx), bloque_style(zh)
css_i = mi.group(1).decode('utf-8')
css_z = mz.group(1).decode('utf-8')

ri, rz = partir_reglas(css_i), partir_reglas(css_z)
print('reglas de nivel superior -> index: %d   zh: %d' % (len(ri), len(rz)))

set_z = {}
for r in rz: set_z.setdefault(norm(r), 0); set_z[norm(r)] += 1
comunes_norm = set()
for r in ri:
    k = norm(r)
    if k in set_z: comunes_norm.add(k)
print('reglas identicas en los dos: %d' % len(comunes_norm))

# url( relativas: si las hubiera, moverlas de archivo cambiaria como resuelven.
urls = re.findall(r'url\(\s*["\']?([^)"\']+)', css_i)
rel = [u for u in urls if not u.startswith(('data:','http','//','/'))]
print('url() relativas en el CSS (romperian al mover de archivo): %d %s' % (len(rel), rel[:5]))
if rel: sys.exit('ABORTADO: hay url() relativas; hay que reescribirlas antes de mover el CSS.')

# shared.css conserva el ORDEN de index.html
compartidas = [r for r in ri if norm(r) in comunes_norm]
resto_i     = [r for r in ri if norm(r) not in comunes_norm]
resto_z     = [r for r in rz if norm(r) not in comunes_norm]
print('-> shared.css: %d reglas | quedan inline: index %d, zh %d'
      % (len(compartidas), len(resto_i), len(resto_z)))

cab = ("/* shared.css — reglas de CSS identicas entre index.html y zh.html.\n"
       "   Generado por tools/extraer_css_compartido.py (tanda 1b del paso 1).\n"
       "   NO editar a mano: se edita aqui y se regenera, o se rompe la unificacion.\n"
       "   Un arreglo aqui vale para los dos idiomas. */\n")
open('shared.css','w',encoding='utf-8',newline='\n').write(cab + '\n'.join(compartidas) + '\n')

LINK = b'<link rel="stylesheet" href="/shared.css">'
def reescribir(data, m, resto, nombre, crlf):
    nl = '\r\n' if crlf else '\n'
    nuevo_css = nl.join(resto)
    ini_style = data.rfind(b'<style', 0, m.start(1))
    assert ini_style != -1
    salida = (data[:ini_style] + LINK + (b'\r\n' if crlf else b'\n')
              + data[ini_style:m.start(1)] + nuevo_css.encode('utf-8') + data[m.end(1):])
    assert b'\x00' not in salida
    open(nombre,'wb').write(salida)
    print('%s: %d -> %d bytes' % (nombre, len(data), len(salida)))

reescribir(idx, mi, resto_i, 'index.html', crlf=False)
reescribir(zh,  mz, resto_z, 'zh.html',    crlf=True)
