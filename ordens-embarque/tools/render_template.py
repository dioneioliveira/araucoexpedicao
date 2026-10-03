"""Renderiza a guia oficial de um check-list (.xlsm) em um PDF de 1 página,
sem alterar nada do layout: apenas as células com fórmula (os "campos de dados",
que no arquivo original aparecem como #REF!/Err:504) são esvaziadas para
receberem os dados do app por cima.

Uso (LibreOffice instalado):
  soffice --headless --accept="socket,host=localhost,port=2002;urp;" &
  python3 render_template.py arquivo.xlsm "Nome da guia" saida.pdf
"""
import json, sys, time, uno
from com.sun.star.beans import PropertyValue
from com.sun.star.table.CellContentType import FORMULA


def prop(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p


def connect():
    local = uno.getComponentContext()
    resolver = local.ServiceManager.createInstanceWithContext(
        "com.sun.star.bridge.UnoUrlResolver", local)
    for _ in range(60):
        try:
            return resolver.resolve(
                "uno:socket,host=localhost,port=2002;urp;StarOffice.ComponentContext")
        except Exception:
            time.sleep(1)
    raise SystemExit("LibreOffice não respondeu")


def main(src, sheet_name, out):
    ctx = connect()
    desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
    doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), "_blank", 0,
                                       (prop("Hidden", True),))
    sheets = doc.Sheets
    for name in list(sheets.ElementNames):
        if name != sheet_name:
            sheets.removeByName(name)
    sh = sheets.getByName(sheet_name)
    cleared = []
    used = sh.createCursor(); used.gotoEndOfUsedArea(False)
    end = used.RangeAddress
    for r in range(end.EndRow + 1):
        for c in range(end.EndColumn + 1):
            cell = sh.getCellByPosition(c, r)
            if cell.Type == FORMULA:
                cleared.append(cell.AbsoluteName)
                cell.setString("")
            # Célula VAZIA com texto girado (ex.: A54:D64 da carga): no Excel o
            # giro não aparece e as bordas ficam retas, mas o LibreOffice
            # inclina as bordas. Zerar o giro reproduz o que o Excel imprime.
            if cell.RotateAngle and cell.getString() == "":
                cell.RotateAngle = 0
    # grade de colunas/linhas (1/100 mm) para posicionar os campos no PDF
    cols = [sh.getCellByPosition(c, 0).Position.X
            for c in range(end.EndColumn + 2)]
    rows = [sh.getCellByPosition(0, r).Position.Y for r in range(end.EndRow + 2)]
    with open(out + ".grid.json", "w") as fh:
        json.dump({"cols": cols, "rows": rows, "cleared": cleared}, fh)
    # A configuração de página do arquivo original (escala / ajustar a 1 página,
    # margens, cabeçalho) é mantida exatamente como foi importada.
    doc.storeToURL(uno.systemPathToFileUrl(out),
                   (prop("FilterName", "calc_pdf_Export"),))
    doc.close(True)
    print("células de dados esvaziadas:", ", ".join(cleared))


if __name__ == "__main__":
    main(*sys.argv[1:4])
