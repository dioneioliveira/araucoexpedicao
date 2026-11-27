#!/usr/bin/env python3
"""Gera simulador-nr11/index.html (arquivo único, offline) a partir de src/ e vendor/."""
import re, pathlib
root = pathlib.Path(__file__).parent
html = (root/'src'/'index.src.html').read_text(encoding='utf-8')
def inline(m):
    rel = m.group(1)
    p = root/rel
    code = p.read_text(encoding='utf-8')
    code = code.replace('</script', '<\\/script')
    return '<script>\n' + code + '\n</script>'
html = re.sub(r'<!--INLINE:([^>]+?)-->', inline, html)
(root/'index.html').write_text(html, encoding='utf-8')
print('index.html', round(len(html)/1024), 'KB')
