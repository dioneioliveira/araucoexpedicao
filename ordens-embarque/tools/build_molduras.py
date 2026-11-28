"""Embute o simulador de carga de molduras (carregador-molduras.html) no app.

Copia o HTML para vendor/carregador-molduras.html (trocando as placas e o container do exemplo por dados
fictícios, porque o repositório é público) e gera js/molduras-sim.js com o HTML numa string
(window.OE_MOLD_HTML). O app roda o simulador num iframe escondido e usa a API window.CarregadorMolduras.

Uso: python3 tools/build_molduras.py [caminho/carregador-molduras.html]
     (sem caminho, regenera a partir de vendor/carregador-molduras.html)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, "vendor", "carregador-molduras.html")
FICTICIOS = {"MKJ2C75": "ABC1D23", "RXL7F62": "EFG4H56", "GLDU9835887": "ABCU1234560"}


def main(src):
    html = open(src, encoding="utf-8").read()
    for real, fake in FICTICIOS.items():
        html = html.replace(real, fake)
    if src != VENDOR:
        with open(VENDOR, "w", encoding="utf-8") as fh:
            fh.write(html)
    assert "CarregadorMolduras" in html, "o HTML não tem a API window.CarregadorMolduras"
    dst = os.path.join(ROOT, "js", "molduras-sim.js")
    with open(dst, "w", encoding="utf-8") as fh:
        fh.write("// Gerado por tools/build_molduras.py a partir de vendor/carregador-molduras.html. Não editar.\n")
        fh.write("window.OE_MOLD_HTML = " + json.dumps(html, ensure_ascii=False) + ";\n")
    print(f"ok -> {dst} ({os.path.getsize(dst) / 1024:.0f} KB)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else VENDOR)
