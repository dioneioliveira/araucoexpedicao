"""Gera ordens-embarque.html: o app inteiro em UM arquivo HTML (CSS, JS, logo,
modelos dos check-lists e gerador de QR embutidos). Abre com duplo clique,
sem servidor. Só a leitura de planilha .xlsm usa a biblioteca SheetJS via CDN.

Uso: python3 tools/build_single_html.py
"""
import base64, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as fh:
        return fh.read()


def data_uri(rel, mime):
    with open(os.path.join(ROOT, rel), "rb") as fh:
        return f"data:{mime};base64," + base64.b64encode(fh.read()).decode()


def main():
    html = read("index.html")
    logo = data_uri("assets/arauco-logo.png", "image/png")
    html = html.replace('href="assets/arauco-logo.png"', f'href="{logo}"')
    html = html.replace('src="assets/arauco-logo.png"', f'src="{logo}"')
    html = html.replace('<link rel="stylesheet" href="css/app.css">', "<style>\n" + read("css/app.css") + "\n</style>")

    tpl = read("js/templates.js")
    for key in ("veiculo", "carga"):
        tpl = tpl.replace(f'"templates/{key}.png"', '"' + data_uri(f"templates/{key}.png", "image/png") + '"')

    def inline(src, code):
        nonlocal html
        tag = f'<script src="{src}"></script>'
        assert tag in html, src
        html = html.replace(tag, "<script>\n" + code.replace("</script", "<\\/script") + "\n</script>")

    inline("vendor/qrcode.js", read("vendor/qrcode.js"))
    inline("js/templates.js", tpl)
    inline("js/parsers.js", read("js/parsers.js"))
    inline("js/sync.js", read("js/sync.js"))
    inline("js/app.js", read("js/app.js"))
    assert not re.search(r'(src|href)="(css|js|assets|templates|vendor)/', html), "recurso local não embutido"
    out = os.path.join(ROOT, "ordens-embarque.html")
    with open(out, "w", encoding="utf-8") as fh:
        # o comentário vem depois do <!doctype> para não cair em modo quirks
        html = html.replace("<!doctype html>", "<!doctype html>\n<!-- Gerado por tools/build_single_html.py. Edite index.html, css/ e js/ e gere de novo. -->", 1)
        fh.write(html)
    print(f"ok -> {out} ({os.path.getsize(out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
