# -*- coding: utf-8 -*-
"""Extraccion INCREMENTAL: anade a shared.js las `async function` de nivel
superior identicas entre index.html y zh.html, que la tanda 1c-1 se salto
porque su regex no contemplaba el prefijo `async`. No toca lo ya extraido."""
import re, sys
def bloque(data):
    return max(re.finditer(rb'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', data, re.S), key=lambda m: len(m.group(1)))
def top_async(js):
    out=[]
    for m in re.finditer(r'(?m)^async\s+function\s+([A-Za-z_$][\w$]*)\s*\(', js):
        i=js.index('{', m.end()-1); prof=0; j=i; n=len(js); en=None
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
                    if prof==0: out.append((m.group(1),m.start(),j+1)); break
            j+=1
    return out
norm=lambda s: re.sub(r'\s+',' ',s).strip()
idx=open('index.html','rb').read(); zh=open('zh.html','rb').read()
mi,mz=bloque(idx),bloque(zh)
ji=mi.group(1).decode('utf-8'); jz=mz.group(1).decode('utf-8')
ai,az=top_async(ji),top_async(jz)
cz={n:norm(jz[a:b]) for n,a,b in az}
si={n for n,a,b in ai if n in cz and cz[n]==norm(ji[a:b])}
sh=open('shared.js',encoding='utf-8').read()
ya=[n for n in si if re.search(r'(?m)^(?:async\s+)?function\s+'+re.escape(n)+r'\s*\(', sh)]
if ya: sys.exit('ABORTADO: ya estan en shared.js: '+', '.join(ya))
print('async identicas a mover: %d -> %s' % (len(si), sorted(si)))
open('shared.js','w',encoding='utf-8',newline='\n').write(
    sh.rstrip('\n') + '\n\n/* --- anadidas el 3 sep 2026: async function que la primera extraccion\n'
    '   se salto porque su regex no aceptaba el prefijo `async`. --- */\n'
    + '\n'.join(ji[a:b] for n,a,b in ai if n in si) + '\n')
def quitar(js, funcs):
    tr=[]; ult=0
    for n,a,b in funcs:
        if n in si: tr.append(js[ult:a]); ult=b
    tr.append(js[ult:]); return ''.join(tr)
for data,m,js,funcs,nombre in ((idx,mi,ji,ai,'index.html'),(zh,mz,jz,az,'zh.html')):
    out=data[:m.start(1)] + quitar(js,funcs).encode('utf-8') + data[m.end(1):]
    assert b'\x00' not in out
    open(nombre,'wb').write(out); print('%s: %d -> %d bytes' % (nombre,len(data),len(out)))
