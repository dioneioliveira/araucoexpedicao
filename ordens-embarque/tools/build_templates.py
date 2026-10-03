"""Gera os modelos de impressão do app a partir das planilhas OFICIAIS.

Para cada check-list:
  1. render_template.py exporta a guia oficial para PDF (1 página A4) sem mexer
     no layout, apenas esvaziando as células de dados (fórmulas);
  2. o PDF vira uma imagem PNG 300 dpi (fundo do documento impresso) e uma
     cópia do PDF em branco fica guardada em templates/ como referência;
  3. a posição de cada célula de dados é calculada a partir da grade de
     linhas/colunas do LibreOffice, calibrada pelas bordas reais do PDF;
  4. o formato de cada célula (fonte, tamanho, negrito, cor, alinhamento) é
     lido da própria planilha, para que o dado impresso fique igual ao Excel.

Saída: ../templates/{carga,veiculo}.png, ../templates/*-modelo-oficial.pdf e ../js/templates.js

Uso:
  soffice --headless --accept="socket,host=localhost,port=2002;urp;" &
  python3 build_templates.py check_list_da_carga.xlsm check_list_do_veiculo.xlsm
"""
import json, os, shutil, subprocess, sys
from collections import Counter

import openpyxl
import pdfplumber
from openpyxl.utils import column_index_from_string, range_boundaries

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PT_PER_HMM = 72 / 2540  # 1/100 mm -> pt

# célula -> chave do dado (mesmas células preenchidas pela guia CKL / Check Vc
# da planilha LOG-AGENDAMENTO)
FORMS = {
    "veiculo": {
        "sheet": "Check Veiculo",
        "title": "Check list visual do veículo (FOR.BR.0016)",
        "fields": {
            "C9": "data",
            "D10": "motorista",
            "D11": "cpf",
            "D12": "transportadora",
            "L13": "carreta",
            "L14": "cavalo",
            "L15": "truck",
        },
    },
    "carga": {
        "sheet": "Check list da carga",
        "title": "Check List de Expedição (FOR.BR.017)",
        "fields": {
            "F6": "motorista",
            "F10": "transportadora",
            "M15": "truck",
            "T15": "data",
            "M16": "cavalo",
            "M18": "carreta",
            "O21": "naContainer",
            "R21": "naContainer",
            "V21": "naContainer",
            "A23": "pallets",
            "C23": "fracionada",
            "K23": "fscClaim",
            "Q23": "otQr",
            "T23": "ot",
            "V23": "fsc",
            "A41": "janelaContainer",
            "A50": "naContainer",
            "M51": "naContainer",
            "R51": "naContainer",
            "U51": "naContainer",
            "B73": "treinamento",
            "B74": "cpfTreinamento",
            "P74": "entregaTransporte",
        },
    },
}


def calibrate(pdf_path, grid, ws):
    """Ajusta escala/origem da grade (1/100 mm) às bordas desenhadas no PDF."""
    page = pdfplumber.open(pdf_path).pages[0]
    xs, ys = Counter(), Counter()
    for o in page.lines + page.rects + page.edges:
        if abs(o["x0"] - o["x1"]) < 0.8:
            xs[round(o["x0"], 2)] += abs(o["bottom"] - o["top"])
        if abs(o["top"] - o["bottom"]) < 0.8:
            ys[round(o["top"], 2)] += abs(o["x1"] - o["x0"])
    X = [x for x, v in xs.items() if v > 20]
    Y = [y for y, v in ys.items() if v > 40]
    c0, r0, c1, r1 = range_boundaries(ws.print_area[0].split("!")[-1].replace("$", "")) \
        if isinstance(ws.print_area, list) else range_boundaries(ws.print_area.split("!")[-1].replace("$", ""))
    cols, rows = grid["cols"], grid["rows"]
    L, R, T, B = min(X), max(X), min(Y), max(Y)
    sx = (R - L) / (cols[c1] - cols[c0 - 1])
    sy = (B - T) / (rows[r1] - rows[r0 - 1])
    return {
        "sx": sx, "sy": sy,
        "x0": L - sx * cols[c0 - 1], "y0": T - sy * rows[r0 - 1],
        "width": float(page.width), "height": float(page.height),
    }


def color_of(font):
    c = font.color
    if c is not None and isinstance(c.rgb, str) and len(c.rgb) == 8 and c.type == "rgb":
        return "#" + c.rgb[2:]
    return "#000000"


def build(src, key, spec, workdir):
    pdf = os.path.join(workdir, f"tpl_{key}.pdf")
    subprocess.run([sys.executable, os.path.join(HERE, "render_template.py"), src, spec["sheet"], pdf],
                   check=True)
    grid = json.load(open(pdf + ".grid.json"))
    ws = openpyxl.load_workbook(src)[spec["sheet"]]
    cal = calibrate(pdf, grid, ws)
    scale = cal["sx"] / PT_PER_HMM  # escala de impressão (fontes)
    merged = {}
    for rng in ws.merged_cells.ranges:
        merged[rng.coord.split(":")[0]] = rng.coord
    fields = []
    for cell, data_key in spec["fields"].items():
        rng = merged.get(cell, cell + ":" + cell)
        a, b = rng.split(":")
        ca, ra = column_index_from_string("".join(filter(str.isalpha, a))), int("".join(filter(str.isdigit, a)))
        cb, rb = column_index_from_string("".join(filter(str.isalpha, b))), int("".join(filter(str.isdigit, b)))
        x = cal["x0"] + cal["sx"] * grid["cols"][ca - 1]
        y = cal["y0"] + cal["sy"] * grid["rows"][ra - 1]
        w = cal["sx"] * (grid["cols"][cb] - grid["cols"][ca - 1])
        h = cal["sy"] * (grid["rows"][rb] - grid["rows"][ra - 1])
        c = ws[cell]
        fields.append({
            "cell": rng, "key": data_key,
            "x": round(x, 2), "y": round(y, 2), "w": round(w, 2), "h": round(h, 2),
            "font": c.font.name or "Calibri",
            "size": round((c.font.sz or 11) * scale, 2),
            "bold": bool(c.font.b), "color": color_of(c.font),
            "align": c.alignment.horizontal or "general",
            "valign": c.alignment.vertical or "bottom",
            "wrap": bool(c.alignment.wrap_text),
        })
    # fundo em PNG 300 dpi: o Chrome nem sempre pinta <img> SVG grandes na
    # impressão; PNG é decodificado de forma confiável e fica nítido no papel.
    tdir = os.path.join(ROOT, "templates")
    os.makedirs(tdir, exist_ok=True)
    base = os.path.join(workdir, f"bg_{key}")
    subprocess.run(["pdftoppm", "-r", "300", "-png", "-singlefile", pdf, base], check=True)
    from PIL import Image
    Image.open(base + ".png").convert("RGB").quantize(
        colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE
    ).save(os.path.join(tdir, f"{key}.png"), optimize=True)
    shutil.copy(pdf, os.path.join(tdir, f"{key}-modelo-oficial.pdf"))
    return {
        "title": spec["title"], "background": f"templates/{key}.png",
        "width": round(cal["width"], 3), "height": round(cal["height"], 3),
        "fields": fields,
    }


def main(carga_xlsm, veiculo_xlsm, workdir="/tmp"):
    out = {
        "veiculo": build(veiculo_xlsm, "veiculo", FORMS["veiculo"], workdir),
        "carga": build(carga_xlsm, "carga", FORMS["carga"], workdir),
    }
    js = os.path.join(ROOT, "js", "templates.js")
    os.makedirs(os.path.dirname(js), exist_ok=True)
    with open(js, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por tools/build_templates.py a partir das planilhas oficiais.\n"
                 "// NÃO editar à mão: posições em pt sobre a página A4 do modelo.\n")
        fh.write("window.ORDEM_TEMPLATES = ")
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write(";\n")
    print("ok ->", js)


if __name__ == "__main__":
    main(*sys.argv[1:])
