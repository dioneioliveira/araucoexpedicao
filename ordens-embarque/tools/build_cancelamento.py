"""Gera js/cancelamento-modelo.js a partir da planilha oficial de cancelamento de NF
(guia "FORMULÁRIO CANCELAMENTO"). A planilha original NÃO vai para o repositório.

- `arquivos`: todas as partes do .xlsx (descompactadas, base64), com os dados de exemplo
  apagados (células em vermelho) e sem os nomes de autor; o app escreve só nas células
  de dados e monta o .xlsx de novo, sem mexer em estilos, fórmulas ou estrutura.
- `layout`: larguras, alturas, mesclagens, estilos (fonte, cor, preenchimento, bordas,
  alinhamento) e textos de cada célula A1:G30, para o formulário na tela e a imagem do e-mail.

Uso: python3 tools/build_cancelamento.py caminho/Cancelamento_NF.xlsx
"""
import base64, json, os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = "xl/worksheets/sheet1.xml"
# células de dados (vermelhas) que o app preenche
CAMPOS = {"B5": "nf", "C5": "serie", "D5": "doc", "F5": "emissao", "G5": "mes", "B8": "filial",
          "B15": "razao", "G15": "valor", "B18": "transp", "B20": "motivo", "B23": "subst"}
# Wingdings → Unicode (só os usados no formulário)
WING = {"ü": "✓", "Ø": "➢"}
THEME = {0: "FFFFFF", 1: "000000", 9: "F79646"}


def tint(hexc, t):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (0, 2, 4))
    f = (lambda c: c * (1 + t)) if t < 0 else (lambda c: c + (255 - c) * t)
    return "".join(f"{round(f(c)):02X}" for c in (r, g, b))


def cor(xml):
    if not xml:
        return None
    m = re.search(r'rgb="FF([0-9A-F]{6})"', xml)
    if m:
        return m.group(1)
    m = re.search(r'theme="(\d+)"(?: tint="([-0-9.]+)")?', xml)
    if m:
        c = THEME.get(int(m.group(1)), "000000")
        return tint(c, float(m.group(2))) if m.group(2) else c
    if re.search(r'(indexed="64"|auto="1")', xml):
        return "000000"
    return None


def fonte(xml):
    return {"b": "<b/>" in xml, "sz": float((re.search(r'<sz val="([\d.]+)"', xml) or [0, 11])[1]),
            "cor": cor(re.search(r'<color [^>]*/>', xml).group(0)) if re.search(r'<color [^>]*/>', xml) else "000000",
            "nome": (re.search(r'<(?:name|rFont) val="([^"]+)"', xml) or [0, "Calibri"])[1]}


def main(src):
    z = zipfile.ZipFile(src)
    files = {n: z.read(n) for n in z.namelist()}
    st = files["xl/styles.xml"].decode()
    sec = lambda n: re.search(rf"<{n}[^>]*>(.*?)</{n}>", st, re.S).group(1)
    numf = dict(re.findall(r'<numFmt numFmtId="(\d+)" formatCode="([^"]*)"', st))
    fonts = [fonte(x or "") for x in re.findall(r"<font(?:/>|>(.*?)</font>)", sec("fonts"), re.S)]
    fills = [cor(re.search(r"<fgColor [^>]*/>", x).group(0)) if "solid" in x else None for x in re.findall(r"<fill>(.*?)</fill>", sec("fills"), re.S)]
    def borda(x):
        out = {}
        for lado in ("left", "right", "top", "bottom"):
            m = re.search(rf'<{lado} style="(\w+)"', x or "")
            if m:
                out[lado[0]] = m.group(1)
        return out
    borders = [borda(x) for x in re.findall(r"<border(?: [^>]*)?(?:/>|>(.*?)</border>)", sec("borders"), re.S)]
    xfs = re.findall(r"<xf ([^>]*?)(?:/>|>(.*?)</xf>)", sec("cellXfs"), re.S)

    ss_xml = files["xl/sharedStrings.xml"].decode()
    sis = re.findall(r"<si>(.*?)</si>", ss_xml, re.S)
    sheet = files[SHEET].decode()

    def estilo(i):
        a, inner = xfs[i]
        g = lambda k: int((re.search(k + r'="(\d+)"', a) or [0, 0])[1])
        al = re.search(r"<alignment ([^>]*)/>", inner or "")
        al = dict(re.findall(r'(\w+)="([^"]*)"', al.group(1))) if al else {}
        return {"f": fonts[g("fontId")], "fill": fills[g("fillId")], "bd": borders[g("borderId")],
                "h": al.get("horizontal", ""), "v": al.get("vertical", "bottom"), "wrap": al.get("wrapText") == "1",
                "ind": int(al.get("indent", 0)), "fmt": numf.get(str(g("numFmtId")), "")}

    def runs(si, base):
        out = []
        rs = re.findall(r"<r>(.*?)</r>", si, re.S)
        if not rs:
            rs = [si]
        for r in rs:
            rpr = re.search(r"<rPr>(.*?)</rPr>", r, re.S)
            f = fonte(rpr.group(1)) if rpr else dict(base)
            t = "".join(re.findall(r"<t[^>]*>(.*?)</t>", r, re.S))
            t = t.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
            if f["nome"] == "Wingdings":
                t = "".join(WING.get(ch, ch) for ch in t)
                f = dict(f, nome="Segoe UI Symbol")
            out.append({"t": t, **f})
        return out

    # células de dados com exemplo: apaga o valor (mantém o estilo); textos de exemplo saem do sharedStrings
    for ref in CAMPOS:
        m = re.search(rf'<c r="{ref}"( s="\d+")?(?: t="\w+")?(?:/>|>.*?</c>)', sheet, re.S)
        if not m:
            continue
        mv = re.search(r'<v>(\d+)</v>', m.group(0))
        if 't="s"' in m.group(0) and mv and ref != "B8":
            sis[int(mv.group(1))] = "<t></t>"
        if ref in ("B8", "C5"):
            continue  # filial PB26 e série 0 ficam como padrão
        sheet = sheet.replace(m.group(0), f'<c r="{ref}"{m.group(1) or ""}/>')
    ss_xml = re.sub(r"<si>.*?</si>", lambda _m, it=iter(sis): f"<si>{next(it)}</si>", ss_xml, flags=re.S)
    files["xl/sharedStrings.xml"] = ss_xml.encode()
    files[SHEET] = sheet.encode()
    core = files["docProps/core.xml"].decode()
    core = re.sub(r"<dc:creator>.*?</dc:creator>", "<dc:creator></dc:creator>", core)
    core = re.sub(r"<cp:lastModifiedBy>.*?</cp:lastModifiedBy>", "<cp:lastModifiedBy></cp:lastModifiedBy>", core)
    files["docProps/core.xml"] = core.encode()
    wb = files["xl/workbook.xml"].decode()
    files["xl/workbook.xml"] = re.sub(r'<x15ac:absPath url="[^"]*"', '<x15ac:absPath url=""', wb).encode()

    # layout A1:G30 (área do formulário)
    cols = {}
    for mn, mx, w in re.findall(r'<col min="(\d+)" max="(\d+)" width="([\d.]+)"', sheet):
        for c in range(int(mn), min(int(mx), 7) + 1):
            cols[c] = round(float(w) * 7 + 5)
    rows_ht = {int(r): float(h) for r, h in re.findall(r'<row r="(\d+)"[^>]*? ht="([\d.]+)"', sheet)}
    rows = [round(rows_ht.get(r, 15.75) * 4 / 3) for r in range(1, 31)]
    cells = []
    for ref, s, t, inner in re.findall(r'<c r="([A-G](?:[1-9]|[12]\d|30))"(?: s="(\d+)")?(?: t="(\w+)")?(?:/>|>(.*?)</c>)', sheet, re.S):
        e = estilo(int(s or 0))
        mv = re.search(r"<v>(.*?)</v>", inner or "")
        val = None
        if t == "s" and mv:
            val = runs(sis[int(mv.group(1))], e["f"])
        elif mv and "<f>" not in (inner or ""):
            val = mv.group(1)
        cells.append({"ref": ref, "st": e, "val": val})
    merges = re.findall(r'<mergeCell ref="([A-Z]+\d+:[A-Z]+\d+)"', sheet)
    dr = files["xl/drawings/drawing1.xml"].decode()
    emu = lambda tag: int(re.search(rf"<xdr:{tag}>(\d+)</xdr:{tag}>", dr).group(1)) // 9525
    frm = re.search(r"<xdr:from>(.*?)</xdr:from>", dr, re.S).group(1)
    logo = {"col": int(re.search(r"<xdr:col>(\d+)", frm).group(1)), "row": int(re.search(r"<xdr:row>(\d+)", frm).group(1)),
            "dx": int(re.search(r"<xdr:colOff>(\d+)", frm).group(1)) // 9525, "dy": int(re.search(r"<xdr:rowOff>(\d+)", frm).group(1)) // 9525,
            "w": int(re.search(r'<a:ext cx="(\d+)"', dr).group(1)) // 9525, "h": int(re.search(r'cy="(\d+)"', dr).group(1)) // 9525,
            "src": "data:image/png;base64," + base64.b64encode(files["xl/media/image1.png"]).decode()}
    out = {"arquivos": [[n, base64.b64encode(b).decode()] for n, b in files.items()], "planilha": SHEET, "campos": CAMPOS,
           "layout": {"cols": [cols.get(c, 68) for c in range(1, 8)], "rows": rows, "cells": cells, "merges": merges, "logo": logo}}
    dst = os.path.join(ROOT, "js", "cancelamento-modelo.js")
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por tools/build_cancelamento.py a partir da planilha oficial de cancelamento de NF. Não editar.\n")
        fh.write("window.OE_CANC = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print(f"ok -> {dst} ({os.path.getsize(dst) / 1024:.0f} KB)")


if __name__ == "__main__":
    main(sys.argv[1])
