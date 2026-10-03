# Ordens de Embarque: regras do processo

- Toda impressão de ordem de embarque imprime **os dois check-lists**, nesta
  ordem: `veiculo` (Check list visual do veículo, FOR.BR.0016) e `carga`
  (Check List de Expedição, FOR.BR.017). Ver `pagesFor()` em `js/app.js`.
- Os formulários são documentos registrados: **nunca** editar à mão
  `templates/*.png`, `templates/*-modelo-oficial.pdf` nem `js/templates.js`.
  Eles são gerados a partir dos `.xlsm` oficiais com `tools/build_templates.py`.
  Dados só entram por cima, nas células de dados (mesmas da guia CKL / Check Vc).
- Os dados de entrada seguem a guia `LOG` da planilha LOG-AGENDAMENTO (colunas
  A..Y) e a chave de ligação é o **Transporte** (LOG col. A).
- Janela de agendamento: `CONTAINER` quando a placa da carreta (7 primeiros
  caracteres) aparece na janela PIÊN CONTAINERS do SEW. Caso contrário,
  mercado interno.
- Repositório público: não versionar dados reais (CPF, nomes, placas, lista FSC).
  Eles ficam só no localStorage do navegador. Use apenas dados fictícios em exemplos.
