# Paso 1 - mapea CSS/JS compartido entre index.html y zh.html (selector/funcion por selector/funcion).
# Uso: python3 tools/mapeo_paso1.py  (se corre sobre los archivos reales, no hace falta nada instalado).
# Salida: resumen en pantalla + numbers_paso1/resultado.json con el detalle (cuerpos completos) para inspeccion.

#!/usr/bin/env python3
import re, os, json
from collections import OrderedDict

HOME = os.path.expanduser("~")
MNT = os.path.join(HOME, "mnt", "numbers-app")
OUT = os.path.join(HOME, "numbers_paso1")
IDX_PATH = os.path.join(MNT, "index.html")
ZH_PATH = os.path.join(MNT, "zh.html")

def load(path):
    with open(path, 'rb') as f:
        raw = f.read()
    return raw.decode('utf-8', errors='replace')

idx_text = load(IDX_PATH)
zh_text  = load(ZH_PATH)

def extract_blocks(text, tag, exclude_src=False):
    out = []
    pattern = re.compile(r'<' + tag + r'\b([^>]*)>(.*?)</' + tag + r'\s*>', re.IGNORECASE | re.DOTALL)
    for m in pattern.finditer(text):
        attrs, content = m.group(1), m.group(2)
        if exclude_src and re.search(r'\bsrc\s*=', attrs, re.IGNORECASE):
            continue
        out.append(content)
    return out

idx_css = "\n".join(extract_blocks(idx_text, 'style'))
zh_css  = "\n".join(extract_blocks(zh_text, 'style'))
idx_js  = "\n".join(extract_blocks(idx_text, 'script', exclude_src=True))
zh_js   = "\n".join(extract_blocks(zh_text, 'script', exclude_src=True))
print("CSS: index=%d chars, zh=%d chars" % (len(idx_css), len(zh_css)))
print("JS:  index=%d chars, zh=%d chars" % (len(idx_js), len(zh_js)))

def norm(s):
    s = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1),16)), s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# ---------- CSS ----------
def parse_css(css):
    rules = []
    i, n = 0, len(css)
    def skip_ws_comments(i):
        while i < n:
            if css[i].isspace():
                i += 1
            elif css[i:i+2] == '/*':
                j = css.find('*/', i+2); i = n if j==-1 else j+2
            else:
                break
        return i
    while i < n:
        i = skip_ws_comments(i)
        if i >= n: break
        start = i
        j = i
        depth_found = False
        while j < n:
            c = css[j]
            if c in '"\'':
                q = c; j += 1
                while j < n and css[j] != q:
                    j += 2 if css[j] == '\\' else 1
                j += 1; continue
            if css[j:j+2] == '/*':
                k = css.find('*/', j+2); j = n if k==-1 else k+2; continue
            if c == '{': depth_found = True; break
            if c == ';': break
            j += 1
        if depth_found:
            prelude = css[start:j].strip()
            depth = 0; k = j
            while k < n:
                c = css[k]
                if c in '"\'':
                    q = c; k += 1
                    while k < n and css[k] != q:
                        k += 2 if css[k] == '\\' else 1
                    k += 1; continue
                if css[k:k+2] == '/*':
                    m2 = css.find('*/', k+2); k = n if m2==-1 else m2+2; continue
                if c == '{': depth += 1; k += 1; continue
                if c == '}':
                    depth -= 1; k += 1
                    if depth == 0: break
                    continue
                k += 1
            rules.append({'selector': prelude, 'body': css[j:k]})
            i = k
        else:
            end = j+1 if j < n else j
            stray = css[start:end].strip()
            if stray:
                rules.append({'selector': stray, 'body': ''})
            i = end
    return rules

idx_rules = parse_css(idx_css)
zh_rules  = parse_css(zh_css)
print("\nCSS reglas top-level: index=%d, zh=%d" % (len(idx_rules), len(zh_rules)))

def index_by_selector(rules):
    d = OrderedDict()
    for r in rules:
        d.setdefault(norm(r['selector']), []).append(norm(r['body']))
    return d

idx_by_sel = index_by_selector(idx_rules)
zh_by_sel  = index_by_selector(zh_rules)

css_identical, css_diff, css_only_idx, css_only_zh = [], [], [], []
all_sel = list(OrderedDict.fromkeys(list(idx_by_sel.keys()) + list(zh_by_sel.keys())))
for sel in all_sel:
    a, b = idx_by_sel.get(sel), zh_by_sel.get(sel)
    if a and b:
        (css_identical if a == b else css_diff).append(sel)
    elif a:
        css_only_idx.append(sel)
    else:
        css_only_zh.append(sel)
print("CSS -> identicas:%d | MISMO SELECTOR CUERPO DISTINTO:%d | solo index:%d | solo zh:%d" % (
    len(css_identical), len(css_diff), len(css_only_idx), len(css_only_zh)))

# ---------- JS ----------
def match_brace(text, open_pos):
    n = len(text); depth = 0; i = open_pos
    while i < n:
        c = text[i]
        if c == '/' and i+1<n and text[i+1] == '/':
            j = text.find('\n', i); i = n if j==-1 else j+1; continue
        if c == '/' and i+1<n and text[i+1] == '*':
            j = text.find('*/', i+2); i = n if j==-1 else j+2; continue
        if c in ('"', "'"):
            q = c; i += 1
            while i < n and text[i] != q:
                i += 2 if text[i] == '\\' else 1
            i += 1; continue
        if c == '`':
            i += 1; tdepth = 0
            while i < n:
                if text[i] == '\\': i += 2; continue
                if text[i] == '`' and tdepth == 0: i += 1; break
                if text[i] == '$' and i+1<n and text[i+1] == '{': tdepth += 1; i += 2; continue
                if text[i] == '}' and tdepth > 0: tdepth -= 1; i += 1; continue
                i += 1
            continue
        if c == '{': depth += 1; i += 1; continue
        if c == '}':
            depth -= 1; i += 1
            if depth == 0: return i
            continue
        i += 1
    return n

FUNC_DECL_RE = re.compile(r'function\s+([A-Za-z_$][\w$]*)\s*\(')
ASSIGN_FUNC_RE = re.compile(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\(')
ASSIGN_ARROW_RE = re.compile(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{')

def find_functions(js):
    funcs = {}
    n = len(js)
    for m in FUNC_DECL_RE.finditer(js):
        name = m.group(1); open_paren = m.end()-1
        depth = 0; k = open_paren
        while k < n:
            if js[k] == '(': depth += 1
            elif js[k] == ')':
                depth -= 1
                if depth == 0: break
            k += 1
        k += 1
        while k < n and js[k] != '{':
            if js[k].isspace(): k += 1
            elif js[k:k+2] == '//':
                j = js.find('\n', k); k = n if j==-1 else j+1
            elif js[k:k+2] == '/*':
                j = js.find('*/', k+2); k = n if j==-1 else j+2
            else: break
        if k >= n or js[k] != '{': continue
        end = match_brace(js, k)
        funcs.setdefault(name, []).append({'body': js[k:end], 'kind': 'function-decl'})
    for regex, kind in [(ASSIGN_FUNC_RE, 'assign-function'), (ASSIGN_ARROW_RE, 'assign-arrow')]:
        for m in regex.finditer(js):
            name = m.group(1); k = m.end()-1
            if k >= n or js[k] != '{': continue
            end = match_brace(js, k)
            funcs.setdefault(name, []).append({'body': js[k:end], 'kind': kind})
    return funcs

idx_funcs = find_functions(idx_js)
zh_funcs  = find_functions(zh_js)
print("\nJS funciones nombradas: index=%d nombres (%d defs) | zh=%d nombres (%d defs)" % (
    len(idx_funcs), sum(len(v) for v in idx_funcs.values()),
    len(zh_funcs), sum(len(v) for v in zh_funcs.values())))

for label, funcs in [('index.html', idx_funcs), ('zh.html', zh_funcs)]:
    dups = {k: v for k, v in funcs.items() if len(v) > 1}
    if dups:
        print("  ANOMALIA en %s: %d nombres definidos mas de 1 vez: %s" % (label, len(dups), list(dups.keys())))

fn_identical, fn_diff, fn_only_idx, fn_only_zh = [], [], [], []
all_names = list(OrderedDict.fromkeys(list(idx_funcs.keys()) + list(zh_funcs.keys())))
for name in all_names:
    a, b = idx_funcs.get(name), zh_funcs.get(name)
    if a and b:
        (fn_identical if norm(a[0]['body']) == norm(b[0]['body']) else fn_diff).append(name)
    elif a:
        fn_only_idx.append(name)
    else:
        fn_only_zh.append(name)

print("JS funciones -> identicas:%d | MISMO NOMBRE CUERPO DISTINTO:%d | solo index:%d | solo zh:%d" % (
    len(fn_identical), len(fn_diff), len(fn_only_idx), len(fn_only_zh)))
print("\nFunciones MISMO NOMBRE, CUERPO DISTINTO:")
for name in fn_diff:
    a = norm(idx_funcs[name][0]['body']); b = norm(zh_funcs[name][0]['body'])
    print("  - %-30s index=%6d chars  zh=%6d chars" % (name, len(a), len(b)))

# ---------- guardar todo para el reporte ----------
result = {
    'sizes': {'idx_css': len(idx_css), 'zh_css': len(zh_css), 'idx_js': len(idx_js), 'zh_js': len(zh_js)},
    'css': {'identical': css_identical, 'diff': css_diff, 'only_idx': css_only_idx, 'only_zh': css_only_zh},
    'js': {'identical': fn_identical, 'diff': fn_diff, 'only_idx': fn_only_idx, 'only_zh': fn_only_zh,
           'dup_idx': [k for k,v in idx_funcs.items() if len(v)>1], 'dup_zh': [k for k,v in zh_funcs.items() if len(v)>1]},
}
# cuerpos de las funciones distintas y de los selectores distintos, para inspeccion posterior
result['js_diff_bodies'] = {name: {'idx': idx_funcs[name][0]['body'], 'zh': zh_funcs[name][0]['body']} for name in fn_diff}
result['css_diff_bodies'] = {sel: {'idx': idx_by_sel[sel], 'zh': zh_by_sel[sel]} for sel in css_diff}

with open(os.path.join(OUT, 'resultado.json'), 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
print("\nGuardado: %s" % os.path.join(OUT, 'resultado.json'))
