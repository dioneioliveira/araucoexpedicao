/* ===== Treinamento NR-11 (apresentação em HTML) =====
   Reconstrução em HTML do treinamento "Operação de Empilhadeira – Formação NR-11" (Dionei Cleiton de Oliveira),
   com transições entre slides, animações de entrada e telas interativas ligadas ao simulador. */
'use strict';
const TRN = (function(){
  const $t = s => document.querySelector(s);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const AUTHOR = 'Dionei Cleiton de Oliveira';

  /* ====================== CONTEÚDO ====================== */
  const EMPREGADOR = [
    'Garantir condições seguras para a operação dos equipamentos de movimentação e transporte;',
    'Fornecer treinamento teórico e prático adequado aos operadores, com reciclagens periódicas;',
    'Realizar inspeções e manutenções preventivas e corretivas nos equipamentos para garantir sua segurança;',
    'Disponibilizar equipamentos de proteção individual (EPIs) e cobrar seu uso correto;',
    'Elaborar e implementar procedimentos de operação e segurança, com base em normas técnicas;',
    'Controlar o ambiente de trabalho, eliminando ou minimizando riscos de acidentes;',
    'Designar operadores autorizados e habilitados, impedindo o uso por pessoas não treinadas;',
    'Registrar e documentar treinamentos, inspeções e ocorrências relacionadas à operação dos equipamentos.'];
  const OPERADOR = [
    'Operar os equipamentos somente após treinamento e autorização formal do empregador;',
    'Seguir rigorosamente os procedimentos e normas de segurança estabelecidos pela empresa;',
    'Utilizar os EPIs fornecidos durante a operação dos equipamentos;',
    'Realizar inspeções diárias no equipamento antes do uso, verificando se há defeitos ou irregularidades;',
    'Comunicar imediatamente ao empregador qualquer irregularidade, defeito ou situação de risco identificada;',
    'Não operar equipamentos sob efeito de álcool, drogas ou medicamentos que comprometam a segurança;',
    'Respeitar a capacidade máxima dos equipamentos e não realizar operações arriscadas ou não previstas;',
    'Manter atenção constante durante a operação, evitando distrações que possam causar acidentes.'];

  const REGRAS = [
    'Não iniciar seu turno de trabalho sem inspecionar detalhadamente o equipamento.',
    'Não operar com equipamento defeituoso, ou modificado sem aprovação do fabricante.',
    'Não frear bruscamente, sem necessidade, principalmente quando estiver com a carga.',
    'Não passar sob os garfos quando elevados.',
    'Não operar o equipamento sob o efeito de medicação forte ou bebidas alcoólicas.',
    'Não fumar no local de recarga de baterias.',
    'Não transportar pessoas (caronas).',
    'Não trafegar com braços e pernas para fora do equipamento.',
    'Não permitir que pessoas não habilitadas operem seu equipamento.',
    'Não trafegar com velocidade acima do permitido para o local.',
    'Não levar cargas somente com um dos garfos.',
    'Não elevar cargas mais pesadas que as indicações nas plaquetas de identificação.',
    'Não conduzir a empilhadeira com os garfos elevados.',
    'Não operar sem visibilidade. Sempre que possível, andar em sentido oposto aos garfos.',
    'Não se deslocar em rampas acentuadas (nas rampas a carga deve sempre estar voltada para o lado mais alto).',
    'Não estacionar ou abandonar o equipamento em local não permitido.',
    'Não abandonar o equipamento sem acionar o freio de estacionamento.',
    'Não estacionar com garfos elevados.'];

  const PROC = [
    [1,'Ao ligar a empilhadeira certifique que a marcha está desengatada.'],
    [2,'Engatar as marchas (frente e ré) sem arranhar, pisando a embreagem até o fim.'],
    [3,'Verificar se o freio de mão está desengatado.'],
    [4,'Transitar sempre com garfos a 15 ou 20 cm longe do solo.'],
    [5,'Se transitar em marcha ré, olhar com cuidado o piso, pessoas e obstáculos nas proximidades.'],
    [6,'Se for transitar para frente, ficar atento ao piso, às pessoas e aos obstáculos nas proximidades.'],
    [7,'Tirar o pé do freio e acelerar devagar para a saída.'],
    [8,'Para carregar, conservar a empilhadeira na posição horizontal e a torre na vertical.'],
    [9,'Baixar os garfos somente até a altura suficiente para que entrem embaixo do que vai ser levantado.'],
    [10,'Posicionar a empilhadeira frontalmente (ou parcialmente) à carga até que ela encoste na torre, e levantar os garfos.'],
    [11,'Deslocar de ré a empilhadeira até que a mesma tenha saído do lugar.'],
    [12,'Levantar os garfos o mínimo possível durante o transporte.'],
    [13,'Inclinar a torre para o lado do motorista (para trás) sempre que tiver carga.'],
    [14,'Fazer as manobras necessárias, sempre cuidando do que está às suas costas e de ambos os lados.'],
    [15,'Dirigir com cuidado pelos caminhos.'],
    [16,'Em cruzamentos ou passagens sem visão, buzinar sempre.'],
    [17,'Não fazer curvas em alta velocidade.'],
    [18,'Diminuir a marcha quando o piso tiver ondulações ou estiver molhado.'],
    [19,'Levantar e abaixar os garfos sempre que tiver de ultrapassar obstáculos.'],
    [20,'Transportando carga delicada, andar na menor velocidade possível, para evitar a queda.'],
    [21,'Transportando tambores, evitar parar ou ultrapassar obstáculos: uma parada brusca pode causar a queda. Tambores devem ser amarrados entre si.'],
    [22,'Avaliar bem o local por onde irá passar, para não provocar colisões da máquina ou da carga.'],
    [24,'Buzinar regularmente (pelo menos três vezes) ao se aproximar de pessoas que estejam andando, puxando carrinho ou carregando algo.'],
    [25,'Evitar manobras muito difíceis.'],
    [26,'Não provocar situações embaraçosas e perigosas.'],
    [27,'Não assustar propositalmente os colegas.'],
    [28,'Não andar em grande velocidade.'],
    [29,'Não fumar enquanto estiver ao volante ou abastecendo a empilhadeira.'],
    [30,'Segurar sempre o volante com duas mãos, a não ser quando tiver que acionar o comando.'],
    [31,'Não admitir brincadeiras em volta da empilhadeira.'],
    [32,'Considerar sempre o tipo de material a ser transportado.'],
    [33,'Verificar a maneira mais fácil de carregar e descarregar o material.'],
    [34,'Verificar sempre o peso e o volume da carga.'],
    [35,'Durante as descargas, não permitir pessoas em volta da empilhadeira.'],
    [36,'Olhar sempre para trás na hora de dar marcha à ré, após a descarga.'],
    [37,'Tomar cuidados especiais com determinados materiais a serem transportados.'],
    [38,'Usar calçados apropriados.'],
    [39,'Ao iniciar o serviço, limpar a máquina por fora, tirar o óleo do piso e limpar as partes fixas.'],
    [40,'Não mexer no motor e acessórios da empilhadeira.'],
    [41,'Comunicar imediatamente ao supervisor ou à manutenção qualquer defeito verificado.'],
    [42,'Sempre que não tiver visão de frente, dirigir a máquina de marcha à ré.'],
    [43,'Com a empilhadeira carregada, descer rampas em marcha à ré.'],
    [44,'Com a empilhadeira descarregada, andar sempre de frente.'],
    [45,'Dirigindo em marcha à ré, olhando pelo lado direito, usar o pé direito.'],
    [46,'Andando para frente, usar o pé direito para acelerar e o esquerdo para frear (hidramático).'],
    [47,'Seguindo outra empilhadeira, não ultrapassar, a não ser que ela pare e seja avisada.'],
    [48,'Nunca fazer reversão (para frente ou para trás) com a máquina em movimento.'],
    [49,'Para verificar o nível do óleo, deixar a máquina em lugar plano.'],
    [50,'Encher o tanque de combustível sempre antes de iniciar o serviço.'],
    [51,'Ao operar, nunca deixar de observar: pressão do óleo, amperagem, temperatura e nível de combustível.'],
    [52,'Não dirigir a empilhadeira com a perna esquerda para fora.'],
    [53,'Nunca transportar pessoas na empilhadeira, qualquer que seja o local ou motivo alegado.'],
    [54,'Não deixar estopas, panos ou resíduos de óleo e graxa sobre a empilhadeira: pode causar incêndio.'],
    [55,'Observar os regulamentos e a sinalização de trânsito ao operar fora da propriedade da empresa.'],
    [56,'Observar os regulamentos e vias de trânsito dentro do estabelecimento.'],
    [57,'Não efetuar meia-volta em rampa ou plano inclinado: há possibilidade de tombamento.'],
    [58,'Certificar-se de que as rodas e as extremidades da carroceria do caminhão estejam calçadas antes de entrar com a empilhadeira.'],
    [59,'Não transportar líquidos inflamáveis ou corrosivos, a não ser em recipientes especiais.'],
    [60,'Verificar o lacre do extintor de incêndio.'],
    [61,'Usar macacão ou outra indumentária específica para dirigir empilhadeira.'],
    [62,'Usar luvas, sempre que possível, para mexer na carga.'],
    [63,'Nunca ajustar a carga introduzindo o braço pela coluna.'],
    [64,'Não utilizar o acelerador como buzina.'],
    [65,'Nunca soltar os garfos totalmente no chão para chamar a atenção de pedestres.'],
    [66,'Não utilizar os garfos para empurrar, qualquer que seja o objeto.'],
    [67,'Pessoas não autorizadas ou não treinadas não devem dirigir empilhadeiras.'],
    [68,'Utilizar somente macaco tipo jacaré para trocar os pneus da empilhadeira.'],
    [69,'Tomar cuidado ao passar embaixo de pontes rolantes.'],
    [70,'Nunca deixar a máquina em movimento ou ligada quando estiver fora dela.'],
    [71,'Nenhuma carga deverá ser levantada ou transportada em um só garfo.'],
    [72,'Nos dias chuvosos, usar capa ao trafegar em pátio aberto e encerados para proteção da carga.'],
    [73,'Não dirigir com as mãos molhadas ou sujas de graxa.'],
    [74,'Tambores somente devem ser transportados em estrados.'],
    [75,'Ao transportar tubos de oxigênio ou acetileno, evitar choques violentos e contato da válvula com substâncias graxas.'],
    [76,'Iniciar o carregamento dos caminhões da frente da carroceria para trás.'],
    [77,'Cargas colocadas de um lado da carroceria devem ser descarregadas por este mesmo lado.'],
    [78,'Dirigir-se sempre perpendicularmente à carroceria do caminhão.'],
    [79,'Deve-se empilhar somente materiais iguais.'],
    [80,'Pilhas de tambores: até o limite de três camadas, com chapas de madeira entre elas.'],
    [81,'Amarrados de chapas: empilhar até o máximo de dois metros de altura.'],
    [82,'Observar sempre uma distância de cinco centímetros entre as pilhas.'],
    [83,'Observar sempre o alinhamento da pilha na horizontal e na vertical.'],
    [84,'Ao empilhar estrados com sacos, verificar se as pilhas não ficam inclinadas por má arrumação.'],
    [85,'Ao empilhar estrados com sacos, verificar se o estrado tem fundo fechado. Se não tiver, não empilhe.'],
    [86,'Depositar cinco camadas de saco por estrado no máximo.'],
    [87,'Colocar o equipamento de forma que possa ser removido por empilhadeira e permita acesso aos demais.'],
    [88,'Ao pegar estrados no sentido longitudinal (lado maior), usar luvas de prolongamento nos garfos.'],
    [89,'Empilhando a partir de 2 metros de altura, redobrar a atenção: o equilíbrio da máquina e da pilha fica instável.'],
    [90,'Fardos de alumínio: no máximo dois por vez, é uma carga muito instável.'],
    [91,'Nenhum equipamento deve ser colocado de forma a obstruir os corredores de circulação.'],
    [92,'Ao estacionar, verificar se o local é plano e não obstrui extintor, hidrantes, passagem de pessoas e saídas de emergência.'],
    [93,'Não transportar latas empilhadas: somente duas dispostas lado a lado.'],
    [94,'Não se atirar contra as cargas: você pode danificar o material e se ferir.'],
    [95,'Evitar marchas à ré bruscas, principalmente transportando cargas.'],
    [96,'Nunca puxar ou empurrar carros, caminhões, empilhadeiras ou outro veículo com a empilhadeira.'],
    [97,'Nunca deixar alguém embaixo de cargas suspensas com a empilhadeira.'],
    [98,'Manter distância razoável de outros veículos: no mínimo, a de três empilhadeiras.'],
    [99,'Utilizar sempre o protetor do operador e o protetor de cargas.'],
    [100,'Antes de iniciar o serviço, verificar a tabela de observações diárias deixada pelo outro operador.'],
    [101,'Para transportar paletes vazios com segurança, a carga máxima é de treze paletes.'],
    [102,'No fim do turno: freio de estacionamento, garfo no chão, torre um pouco para frente, câmbio em neutro, máquina funcionando e fechar o registro de gás para queimar o combustível das mangueiras.'],
    [103,'Princípio de incêndio: manter a calma, fechar o registro de gás, pegar o extintor, retirar o lacre e direcionar o jato para a base do fogo.']];

  const CHECKLIST = ['Cilindro de gás e suporte','Mangueira de gás','Correntes','Garfos / torre','Extintor','Pneus e aros','Assento e cinto','Faróis e giroflex','Retrovisores','Blue spot','Sensor e câmera de ré','Coletor, cabos e carregador','Nível de óleo do motor','Nível do líquido de arrefecimento','Nível de óleo hidráulico','Pintura / adesivos','Comandos da torre e direção','Alavancas de controle','Freios','Hit not','Identificação da carga na torre'];

  /* ---- seções ---- */
  const chunk = (arr,n)=>{ const o=[]; for(let i=0;i<arr.length;i+=n) o.push(arr.slice(i,i+n)); return o; };
  const procSlides = chunk(PROC,14).map((c,i,all)=>({k:'cols',title:`Procedimentos de operação <em>${c[0][0]}–${c[c.length-1][0]}</em>`,items:c}));

  const SECTIONS = [
   {id:'ctx',title:'Abertura e contexto',short:'Contexto da NR-11',tr:'slide',slides:[
     {k:'title'},
     {k:'text',title:'O que é a <em>NR-11</em>?',paras:['É uma norma brasileira que estabelece os requisitos de segurança para o <b>transporte, movimentação, armazenagem e manuseio de materiais</b>, tanto em atividades industriais quanto na construção civil.'],quote:true},
     {k:'text',title:'Objetivo do <em>treinamento</em>',paras:['Capacitar operadores de empilhadeira para o <b>uso seguro e eficiente</b> do equipamento, conforme os requisitos da NR-11, prevenindo acidentes e promovendo a segurança no ambiente de trabalho.'],quote:true},
     {k:'norm',title:'NR-11 · equipamentos de movimentação',items:[
        ['11.1.3','Os equipamentos utilizados na movimentação de materiais — elevadores de carga, guindastes, pontes rolantes, talhas, empilhadeiras, guinchos, esteiras-rolantes, transportadores — serão calculados e construídos de maneira que ofereçam as necessárias garantias de resistência e segurança, e conservados em perfeitas condições de trabalho.'],
        ['11.1.3.1','Especial atenção será dada aos cabos de aço, cordas, correntes, roldanas e ganchos, que deverão ser inspecionados permanentemente, substituindo-se suas partes defeituosas.']]},
     {k:'norm',title:'NR-11 · carga máxima e treinamento',items:[
        ['11.1.3.2','Em todo o equipamento será indicada, em lugar visível, a carga máxima de trabalho permitida.'],
        ['11.1.3.3','Para os equipamentos destinados à movimentação de pessoal serão exigidas condições especiais de segurança.'],
        ['11.1.5','Nos equipamentos de transporte com força motriz própria, o operador deverá receber treinamento específico, dado pela empresa, que o habilitará nessa função.']]},
     {k:'norm',title:'NR-11 · habilitação e sinalização',items:[
        ['11.1.6','Os operadores de equipamentos de transporte motorizado deverão ser habilitados e só poderão dirigir se, durante o horário de trabalho, portarem cartão de identificação com nome e fotografia, em lugar visível.'],
        ['11.1.6.1','O cartão terá validade de 1 (um) ano, salvo imprevisto, e, para a revalidação, o empregado deverá passar por exame de saúde completo, por conta do empregador.'],
        ['11.1.7','Os equipamentos de transporte motorizados deverão possuir sinal sonoro e luminoso de advertência (buzina, alarme de marcha à ré, giroflex).']]},
     {k:'norm',title:'NR-11 · inspeção e ambientes fechados',items:[
        ['11.1.8','Todos os transportadores industriais serão permanentemente inspecionados e as peças defeituosas, ou que apresentem deficiências, deverão ser imediatamente substituídas.'],
        ['11.1.9','Nos locais fechados ou pouco ventilados, a emissão de gases tóxicos pelas máquinas transportadoras deverá ser controlada para evitar concentrações acima dos limites permissíveis.'],
        ['11.1.10','Em locais fechados e sem ventilação é proibida a utilização de máquinas transportadoras movidas a motores de combustão interna, salvo se providas de dispositivos neutralizadores adequados.']]},
     {k:'two',title:'Responsabilidades <em>na NR-11</em>',left:{h:'Do empregador',items:EMPREGADOR},right:{h:'Do operador',items:OPERADOR}}]},

   {id:'emp',title:'A empilhadeira',short:'A empilhadeira',tr:'rise',slides:[
     {k:'text',title:'Definição de <em>empilhadeira</em>',paras:['<b>Empilhadeira:</b> máquina especial, com características operacionais projetadas para desenvolver trabalhos específicos.','<b>Conceito:</b> veículo automotor utilizado para transporte e movimentação de materiais. Possui garfos e outros dispositivos de sustentação de carga e foi projetada para permitir o deslocamento de materiais no sentido <b>horizontal e vertical</b>. É utilizada para transportar, empilhar e desempilhar cargas, com capacidade de se autocarregar, conforme as especificações dos fabricantes.']},
     {k:'cards',title:'Classificação · <em>abastecimento</em>',cols:4,cards:[
        {ic:'⛽',h:'Gasolina',t:'É a empilhadeira que mais polui o ambiente.',c:'red'},
        {ic:'🛢️',h:'Diesel',t:'Apresenta menor poluição que a gasolina.',c:'amb'},
        {ic:'🔥',h:'Gás (GLP)',t:'Polui menos que as anteriores, por ser mais perfeita a queima do combustível.',c:'lime'},
        {ic:'⚡',h:'Elétrica',t:'Não polui (não há combustão). Mais usada em empresas alimentícias, farmacêuticas e espaços confinados. Neste tipo existe maior possibilidade de incêndio.',c:'grn'}]},
     {k:'cards',title:'Características · <em>transmissões</em>',cols:4,cards:[
        {h:'Mecânica normal',t:'Câmbio convencional, com embreagem e conversor de torque. Exige mais habilidade do operador na troca de marchas.',c:'lime'},
        {h:'Mecânica com acoplamento fluido',t:'Acoplamento hidráulico que reduz o atrito direto da embreagem, evita o desgaste prematuro e dá mais suavidade.',c:''},
        {h:'Hidráulica normal (hidramática)',t:'Transmissão automática hidráulica: alavanca com duas posições (frente e ré) e uma, duas ou mais velocidades.',c:'amb'},
        {h:'Hidrostática',t:'Bomba hidráulica ligada ao motor movimenta um motor hidráulico nas rodas. Sem câmbio nem embreagem: controle preciso e menos manutenção.',c:'grn'}]},
     {k:'chips',title:'Componentes <em>principais</em>',items:['Estrutura de chassi','Tanque de combustível','Tanque de fluido hidráulico','Contrapeso','Painel de instrumentos','Rodas pneumáticas','Rodas maciças','Eixos traseiros','Motor','Radiador','Embreagem','Caixa de mudança','Eixo dianteiro','Sistema de direção','Capuz','Assento','Cilindros hidráulicos de inclinação','Torre de elevação','Garfos','Tubulação, bombas e válvulas hidráulicas'],num:true,go:['asm:chassi','Ver cada componente na Montagem 3D']},
     {k:'list',title:'Componentes · <em>funções-chave</em>',items:['<b>Garfos:</b> onde a carga é transportada','<b>Contrapeso:</b> equilibra a carga na frente','<b>Ponto de apoio:</b> o eixo dianteiro, pivô da “gangorra”','<b>Torre do elevador:</b> sobe e desce a carga','<b>Placa de encosto:</b> impede a carga de recuar sobre o operador','<b>Plaqueta de identificação:</b> capacidade e dados da máquina'],go:['asm:contrapeso','Ver na Montagem 3D']},
     {k:'chips',title:'Painel e <em>comandos</em>',items:['Alavanca','Pedal','Assento do operador','Alavanca de controle de elevação','Alavanca de controle de inclinação','Volante','Buzina','Lâmpada piloto','Painel de instrumentos','Ignição (chave)','Freio de estacionamento','Pedal do acelerador','Botão do afogador','Pedal do freio'],num:true,go:['asm:painel','Ver painel e alavancas na Montagem 3D']},
     {k:'chips',title:'Partes e <em>componentes de segurança</em>',items:['Contrapeso','Garfos','Torre','Grade','Protetor do operador','Assento','Eixo de direção','Roda e pneus','Eixo dianteiro / ponto de apoio / tração','Iluminação','Carro da torre','Buzina','Blue spot','Espelhos','Câmeras','Sensores','Horímetro','Freios','Comandos','Extintor de incêndio','Cilindro de GLP','Placa de capacidade de carga'],go:['asm:protetor','Ver protetor, assento e cinto na Montagem 3D']},
     {k:'cards',title:'Sinalização e <em>segurança ativa</em>',cols:4,cards:[
        {h:'01 · Baliza (giroflex)',t:'Sistema de luz que permite ao pedestre detectar a presença de um equipamento móvel.'},
        {h:'02 · Câmera de ré',t:'Melhora o campo de visão do operador, por uma tela no cockpit, na hora de recuar.'},
        {h:'03 · Foco traseiro',t:'Melhora as condições de iluminação na hora de recuar.'},
        {h:'04 · Luz spot azul',t:'(dianteira e traseira) Faz as pessoas detectarem a presença da empilhadeira antes da aproximação.'},
        {h:'05 · Alarme sonoro de recuo',t:'Alerta o pedestre de que o equipamento está recuando.'},
        {h:'06 · Sensores traseiros',t:'Permitem ao operador detectar objetos durante a manobra em marcha à ré.'},
        {h:'07 · Cunhas / calços',t:'Dispositivos destinados a imobilizar o equipamento durante intervenções necessárias.'}],go:['asm:luzes','Ver sinalização na Montagem 3D']},
     {k:'chips',title:'Cilindro de <em>GLP (P-20)</em>',items:['Cilindro','Engate rápido','Válvula de alívio do cilindro','Pino-trava','Medidor de nível do GLP','Registro de abastecimento do motor','Registro de segurança do cilindro'],num:true}]},

   {id:'est',title:'Estabilidade',short:'Estabilidade',tr:'zoom',slides:[
     {k:'seesaw',title:'O princípio é o de uma <em>gangorra</em>'},
     {k:'loadcenter',title:'Centro de carga e <em>capacidade</em>'},
     {k:'chart',title:'Quanto maior a elevação, <em>menor a capacidade</em>'},
     {k:'list',title:'Tabela de carga · <em>como ler</em>',items:['Descubra o <b>centro de carga</b> da carga a levantar','Confirme o <b>peso da carga</b>','Veja a <b>elevação</b> (altura dos garfos) necessária','A capacidade residual é o menor valor permitido para essa combinação','Existem vários modelos de gráfico (Hyster, Max Load…): sempre use o <b>da placa da sua máquina</b>'],go:['load:2','Testar no simulador: Tabela de elevação']},
     {k:'fork75',title:'O garfo deve cobrir pelo menos <em>¾ (75%)</em> da carga'},
     {k:'base3',title:'Estabilidade lateral · <em>base de 3 pontos</em>'},
     {k:'tri',title:'Triângulo de <em>estabilidade</em> · casos'}]},

   {id:'op',title:'Operação segura',short:'Operação segura',tr:'slideL',slides:[
     {k:'check',title:'Antes de operar · <em>checklist rápido</em>',items:['Realizar checklist e verificação da empilhadeira','Ajustar o assento','Ajustar o volante','Verificar a posição das rodas','Testar comandos','Ajustar os espelhos','Limpar o equipamento','Ajustar o cinto de segurança','Verificar inclinação da torre','Verificar elevação da torre','Verificar correntes e mangueiras']},
     {k:'dos',title:'Regras básicas · <em>nunca</em>',items:['Operar o equipamento em caso de falhas ou necessidade de manutenção','Transportar pessoas (caronas)','Operar sob efeito de medicação forte ou bebidas alcoólicas']},
     {k:'dos',title:'Regras básicas · <em>nunca</em>',items:['Trafegar com braços e pernas para fora do equipamento','Permitir que pessoas não habilitadas operem seu equipamento','Trafegar com velocidade acima do permitido']},
     {k:'dos',title:'Regras básicas · <em>nunca</em>',items:['Transportar ou elevar cargas somente com um dos garfos','Ultrapassar os limites de carga','Conduzir ou estacionar a empilhadeira com os garfos elevados']},
     {k:'dos',ok:true,title:'Segurança para o operador · <em>sempre</em>',items:['Transitar com os garfos a 15 ou 20 cm do solo','Transitar de ré com carga, e de frente quando estiver vazio (atento a desníveis)','Buzinar em cruzamentos e locais sem visibilidade'],go:['load:3','Testar: curva com carga elevada']},
     {k:'cols',title:'Regras básicas de segurança <em>1–9</em>',items:REGRAS.slice(0,9).map((t,i)=>[i+1,t])},
     {k:'cols',title:'Regras básicas de segurança <em>10–18</em>',items:REGRAS.slice(9).map((t,i)=>[i+10,t])}].concat(procSlides)},

   {id:'man',title:'Inspeção e manutenção',short:'Inspeção e manutenção',tr:'flip',slides:[
     {k:'quote',title:'Inspeção e <em>manutenção</em>',q:'11.1.8 — “Todos os transportadores industriais serão permanentemente inspecionados e as peças defeituosas, ou que apresentem deficiência, deverão ser imediatamente substituídas.”',sub:'Calculados e construídos de maneira que ofereçam garantias de resistência e segurança, conservados em perfeitas condições de trabalho; carga máxima e identificação indicadas em lugar visível.'},
     {k:'check',title:'<em>Checklist</em> diário da empilhadeira',items:CHECKLIST,small:true,go:['asm:eixoF','Ver pneus, correntes e garfos na Montagem 3D']},
     {k:'text',title:'Procedimento de <em>check list e manutenção</em>',paras:['<b>PO.J.441</b> · Estabelece um padrão para o preenchimento do check list e a manutenção das empilhadeiras na Arauco, planta Jaguariaíva.','<b>Operador de empilhadeira:</b> parte operacional, inspeções, preenchimento do check list e da solicitação de manutenção.','<b>Controlador de operações:</b> auxilia no registro e controle dos check lists e do formulário de solicitação de manutenção.','<b>Líder de operações:</b> gestão da operação do procedimento. <b>Coordenador de logística:</b> responsável pela área.']},
     {k:'list',title:'Defeito encontrado? <em>Comunique já</em>',items:['<b>Comunicar imediatamente</b> ao supervisor ou à manutenção qualquer defeito verificado','Preencher a <b>solicitação de manutenção</b>','Equipamento defeituoso ou modificado sem aprovação do fabricante <b>não opera</b>','Consultar a <b>tabela de observações diárias</b> deixada pelo operador anterior','Vazamento de óleo, corrente com folga, garfo trincado: <b>parar</b> e sinalizar']}]},

   {id:'risk',title:'Gerenciamento de riscos',short:'Gerenciamento de riscos',tr:'rise',slides:[
     {k:'cards',title:'Condição insegura × <em>ato inseguro</em>',cols:2,cards:[
        {h:'O que é uma condição insegura?',t:'São as que comprometem a segurança do trabalhador nos locais de serviço: falhas, defeitos, irregularidades técnicas e carência de dispositivos de segurança que colocam em risco a integridade física e/ou a saúde das pessoas e a própria segurança das instalações e equipamentos.',c:'amb'},
        {h:'O que é um ato inseguro?',t:'São condutas nas quais os colaboradores se expõem aos riscos de acidentes de trabalho. Correspondem ao desrespeito a um procedimento ou ordem e são responsáveis por muitos dos acidentes laborais.',c:'red'}]},
     {k:'cards',title:'Situações de risco na <em>operação</em>',cols:5,cards:[
        {ic:'🚶',h:'Atropelamentos',t:'',c:'red'},{ic:'📦',h:'Queda da carga',t:'',c:'amb'},{ic:'🖐️',h:'Prensamento',t:'',c:'red'},{ic:'💥',h:'Colisões',t:'Em estruturas ou entre equipamentos',c:'amb'},{ic:'⚠️',h:'Tombamento',t:'',c:'red'}],note:'Esses são apenas alguns exemplos. Por isso devemos estar seguros em nossas ações, aplicando e respeitando os procedimentos necessários.'},
     {k:'cards',title:'Atos e condições inseguros · <em>casos para discussão</em>',cols:3,cards:[
        {h:'Colisões de empilhadeira',t:'Estruturas, equipamentos e pedestres.',c:'amb'},{h:'Tombamento frontal',t:'Carga acima da capacidade ou longe do talão.',c:'red'},{h:'Excesso de carga',t:'Vídeo do curso presencial.',c:'red'},
        {h:'Operação perigosa',t:'Imagens do curso: garfos altos, curva em velocidade, manobra em rampa.',c:'amb'},{h:'Mais uma imprudência…',t:'Atos inseguros se repetem quando viram hábito.',c:''},{h:'Resultado de tentar segurar a carga',t:'Nunca tente segurar uma carga que está caindo.',c:'red'}]},
     {k:'scene',title:'Análise de risco · <em>quantos riscos você identifica?</em>'},
     {k:'cards',title:'Cuidando de si, <em>do outro</em>',cols:3,cards:[
        {ic:'🛡️',h:'Cuidando de si',t:'Realizando as inspeções e análises necessárias para o trabalho seguro.',c:'lime'},
        {ic:'🤝',h:'Cuidando do outro',t:'Auxiliando e corrigindo atos para que não se tornem hábito inseguro.',c:'grn'},
        {ic:'💬',h:'Deixando ser cuidado',t:'Aceitando orientações e correções dos colegas.',c:''}],note:'Devemos sempre nos auxiliar e corrigir nossos atos, para que não se tornem um hábito inseguro.'}]},

   {id:'end',title:'Encerramento',short:'Encerramento',tr:'fade',slides:[
     {k:'list',title:'Documentação e <em>avaliação</em>',items:['Avaliação <b>teórica e prática</b>','Entrega de <b>certificado</b> (carga horária mínima de 8 horas)','Cartão de identificação do operador, com nome e foto, em lugar visível (11.1.6)'],link:['https://claude.ai/artifact/LoXzQTj4Dt3uN6YW9yKMqz','Abrir a Prova NR-11 (documento)']},
     {k:'cards',title:'Informações <em>importantes</em>',cols:3,cards:[
        {ic:'⏱️',h:'Carga horária',t:'8 h (4 h teóricas + 4 h práticas)',c:'lime'},{ic:'🔄',h:'Reciclagem',t:'A cada 2 anos',c:'grn'},{ic:'📘',h:'Base legal',t:'NR-11, NR-12, NR-17 e CTB',c:''}],note:'Valores conforme a apresentação do curso.'},
     {k:'closing'}]}
  ];

  /* ====================== MOTOR DA APRESENTAÇÃO ====================== */
  const flat=[]; SECTIONS.forEach((s,si)=>s.slides.forEach((d,i)=>flat.push({si,i,d,sec:s})));
  const N=flat.length;
  let cur=-1, built=false, auto=false, autoT=0, inited=false, st3=null, active=false, panelOpen=false, trSeq=['slide','rise','zoom','slideL','fade','flip'];

  const rv=(i,c='')=>`class="rv ${c}" style="--d:${300+i*140}"`;
  const goBtn=(go,i)=>go?`<button class="tbtn sec rv" style="--d:${300+i*140}" data-go="${go[0]}">${esc(go[1])} →</button>`:'';

  function slideHTML(f,n){
    const d=f.d, tag=`<span class="tag">${String(f.si+1).padStart(2,'0')} · ${esc(f.sec.title)}</span>`;
    const foot=`<div class="foot"><span>NR-11 · Operação de Empilhadeira · ${AUTHOR}</span><span>${n+1} / ${N}</span></div>`;
    const wrap=(body,extra='')=>`<div class="in ${extra}">${tag}<h2 ${rv(0,'fade')}>${d.title}</h2><div class="body">${body}</div></div>${foot}`;
    switch(d.k){
      case 'title': return `<div class="in title-s"><span class="tag rv fade" style="--d:200">NR-11 · Formação de operadores</span><h1 ${rv(1)}>Treinamento <em>Operação de Empilhadeira</em></h1><div class="sub rv" style="--d:700">Formação de operadores de empilhadeira · NR-11 — Transporte, movimentação, armazenagem e manuseio de materiais</div><div class="by rv" style="--d:950">${AUTHOR}</div></div><div class="stage3d" data-3d></div>${foot}`;
      case 'text': return wrap(d.paras.map((p,i)=>`<p class="rv ${d.quote?'quote big':''}" style="--d:${400+i*350}">${p}</p>`).join(''));
      case 'norm': return wrap(`<div class="norm">${d.items.map((it,i)=>`<div class="nm rv l" style="--d:${400+i*260}"><b>${it[0]}</b><span>${it[1]}</span></div>`).join('')}</div>`);
      case 'two': return wrap(`<div class="row2">${[d.left,d.right].map((c,ci)=>`<div class="cd ${ci?'lime':''} rv" style="--d:${400+ci*300};padding:calc(var(--u)*1.2)"><b>${c.h}</b><div class="lst sm" style="justify-content:flex-start;gap:calc(var(--u)*.45)">${c.items.map((t,i)=>`<div class="li rv fade" style="--d:${700+ci*300+i*160};font-size:calc(var(--u)*1.2);line-height:1.3">${t}</div>`).join('')}</div></div>`).join('')}</div>`);
      case 'cards': return wrap(`<div class="cards" style="--c:${d.cols}">${d.cards.map((c,i)=>`<div class="cd ${c.c||''} rv pop" style="--d:${450+i*180}">${c.ic?`<div class="ic">${c.ic}</div>`:''}<b>${c.h}</b><span>${c.t||''}</span></div>`).join('')}</div>${d.note?`<p ${rv(d.cards.length+3,'fade')} style="margin-top:calc(var(--u)*1.4);font-size:calc(var(--u)*1.7);color:#6a6a6a">${d.note}</p>`:''}${goBtn(d.go,d.cards.length+2)}`);
      case 'chips': return wrap(`<div class="chips">${d.items.map((t,i)=>`<span class="chip2 rv pop" style="--d:${420+i*70}">${d.num?`<i>${i+1}</i>`:''}${t}</span>`).join('')}</div>${goBtn(d.go,6)}`);
      case 'list': return wrap(`<div class="lst">${d.items.map((t,i)=>`<div class="li rv l" style="--d:${420+i*230}">${t}</div>`).join('')}</div>${goBtn(d.go,d.items.length+2)}${d.link?`<a class="tbtn sec rv" style="--d:1800;text-decoration:none;display:inline-block" href="${d.link[0]}" target="_blank" rel="noopener">${esc(d.link[1])} ↗</a>`:''}`);
      case 'dos': return wrap(`<div class="dos">${d.items.map((t,i)=>`<div class="dn ${d.ok?'ok':''} rv pop" style="--d:${450+i*320}"><div class="x">${d.ok?'✓':'✕'}</div><span>${t}</span></div>`).join('')}</div>${goBtn(d.go,5)}`);
      case 'cols': return wrap(`<div class="cols">${d.items.map((it,i)=>`<div class="li rv fade" style="--d:${350+i*110}"><b>${it[0]}.</b><span>${it[1]}</span></div>`).join('')}</div>`);
      case 'check': return wrap(`<div class="chk" ${d.small?'style="grid-template-columns:repeat(3,1fr);gap:calc(var(--u)*.55) calc(var(--u)*1.2)"':''}>${d.items.map((t,i)=>`<div class="ck rv pop" style="--d:${400+i*120};${d.small?'font-size:calc(var(--u)*1.35);padding:calc(var(--u)*.55) calc(var(--u)*.9)':''}"><i>✓</i>${t}</div>`).join('')}</div>${goBtn(d.go,8)}`);
      case 'quote': return wrap(`<div class="quote big rv" style="--d:500;margin-top:calc(var(--u)*1)">${d.q}</div><p ${rv(5,'fade')} style="margin-top:calc(var(--u)*1.6);color:#6a6a6a;font-size:calc(var(--u)*1.7)">${d.sub}</p>`);
      case 'closing': return `<div class="in title-s"><span class="tag rv fade" style="--d:200">Fim</span><h1 ${rv(1)}>Segurança é <em>decisão</em> de cada um</h1><div class="sub rv" style="--d:700">Inspecione, respeite a placa de capacidade, mantenha os garfos baixos e cuide de quem está ao seu redor.</div><div class="by rv" style="--d:950">${AUTHOR}</div></div><div class="stage3d" data-3d></div>${foot}`;
      default: return wrap(CUSTOM[d.k]?CUSTOM[d.k].html(d):'');
    }
  }

  /* ====================== TELAS INTERATIVAS ====================== */
  function withTruck(key,fn){ const sT=T, sE=EDGES; T=TRUCKS[key]; EDGES=triEdges(T); try{ return fn(); } finally { T=sT; EDGES=sE; } }
  const CUSTOM = {};

  /* --- gangorra --- */
  CUSTOM.seesaw={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.5"><svg id="ssSvg" viewBox="0 0 640 300"></svg></div><div style="display:flex;flex-direction:column;justify-content:center"><p class="rv" style="--d:700">O <b>ponto de apoio</b> é o eixo dianteiro. De um lado, o <b>contrapeso</b>; do outro, a <b>carga</b>. Se a carga for muito pesada ou mal posicionada, o contrapeso não segura e a empilhadeira <b>tomba para a frente</b>.</p><div class="ctl rv" style="--d:1000"><span>Carga</span><input id="ssRange" type="range" min="0" max="5000" step="100" value="3000"><b id="ssKg" style="min-width:calc(var(--u)*7)">3000 kg</b></div><div id="ssState" class="rv" style="--d:1200;margin-top:calc(var(--u)*.8)"></div></div></div>`,
    init(el){ const svg=el.querySelector('#ssSvg'), rg=el.querySelector('#ssRange'), kg=el.querySelector('#ssKg'), stt=el.querySelector('#ssState'); let ang=0, tgt=0, raf=0;
      const draw=()=>{ const w=+rg.value; svg.innerHTML=`<g transform="translate(320 196)"><polygon points="0,0 -34,58 34,58" fill="#B7D9D8" stroke="#5BA8A5" stroke-width="3"/>
        <g transform="rotate(${ang.toFixed(2)})"><rect x="-290" y="-14" width="580" height="14" rx="7" fill="#7A7A7A"/>
        <g transform="translate(-200 -14)"><rect x="-62" y="-66" width="124" height="66" rx="10" fill="#D0CC00" stroke="#8d8a00" stroke-width="3"/><text y="-36" text-anchor="middle" font-size="22" font-weight="700" fill="#3d3b00">3000 kg</text><text y="-14" text-anchor="middle" font-size="13" fill="#3d3b00">contrapeso</text></g>
        <g transform="translate(200 -14)"><rect x="-62" y="-${30+w/5000*60}" width="124" height="${30+w/5000*60}" rx="10" fill="#e9b872" stroke="#b8620a" stroke-width="3"/><text y="-${12+w/5000*60}" text-anchor="middle" font-size="22" font-weight="700" fill="#4A3000">${w} kg</text><text y="-${w/5000*60-6}" text-anchor="middle" font-size="13" fill="#4A3000">carga</text></g></g></g>
        <text x="320" y="296" text-anchor="middle" font-size="15" fill="#7A7A7A" font-weight="600">ponto de apoio · eixo dianteiro</text>`; };
      const upd=()=>{ const w=+rg.value; kg.textContent=w+' kg'; tgt=Math.max(-14,Math.min(14,(w-3000)/3000*12)); stt.innerHTML=Math.abs(w-3000)<150?'<span class="pill ok">Equilíbrio</span>':w>3000?'<span class="pill bad">A carga vence: risco de tombamento frontal</span>':'<span class="pill ok">O contrapeso segura a carga</span>'; };
      const loop=()=>{ ang+=(tgt-ang)*0.08; draw(); raf=requestAnimationFrame(loop); };
      rg.oninput=upd; upd(); ang=-8; loop(); el.__stop=()=>cancelAnimationFrame(raf); el.__start=()=>{ cancelAnimationFrame(raf); loop(); }; } };

  /* --- centro de carga --- */
  CUSTOM.loadcenter={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.35"><svg id="lcSvg" viewBox="0 0 560 300"></svg></div><div style="display:flex;flex-direction:column;justify-content:center;flex:1.1"><table class="t2 rv" style="--d:700"><tr><th>Capacidade da máquina</th><th>Centro de carga (D)</th></tr><tr><td>até 999 kg</td><td><b>400 mm</b></td></tr><tr><td>1000 a 4999 kg</td><td><b>500 mm</b></td></tr><tr><td>5000 a 7000 kg</td><td><b>600 mm</b></td></tr></table><div class="ctl rv" style="--d:1000"><span>D da carga</span><input id="lcRange" type="range" min="300" max="1000" step="10" value="500"><b id="lcD" style="min-width:calc(var(--u)*6)">500 mm</b></div><div id="lcOut" class="rv" style="--d:1200;margin-top:calc(var(--u)*.6);font-size:calc(var(--u)*1.7)"></div></div></div>`,
    init(el){ const svg=el.querySelector('#lcSvg'), rg=el.querySelector('#lcRange'), dd=el.querySelector('#lcD'), out=el.querySelector('#lcOut'); const Q=TRUCKS['2.5'], a=Q.a;
      const upd=()=>{ const D=+rg.value; dd.textContent=D+' mm'; const cap=Math.floor(Q.Q*(a+Q.D)/(a+D/1000)/10)*10, capc=Math.min(Q.Q,cap), x=150+D*0.42;
        svg.innerHTML=`<line x1="20" y1="250" x2="540" y2="250" stroke="#aab3b3" stroke-width="3"/>
          <circle cx="90" cy="226" r="26" fill="#17191c"/><circle cx="90" cy="226" r="11" fill="#aeb6bf"/>
          <path d="M40 200 L40 150 Q40 120 80 120 L130 120 L150 90 L150 200 Z" fill="#D0CC00" stroke="#7d7a00" stroke-width="2"/>
          <rect x="146" y="40" width="10" height="200" fill="#3C444F"/><rect x="156" y="226" width="300" height="10" rx="3" fill="#b4bcc6" stroke="#2d333b"/>
          <rect x="156" y="130" width="${Math.min(300,D*0.84)}" height="96" fill="#d3ad74" stroke="#7a5a2e" stroke-width="2"/>
          <line x1="156" y1="112" x2="${156+D*0.42}" y2="112" stroke="#d98a00" stroke-width="3"/><circle cx="${156+D*0.42}" cy="178" r="7" fill="#d9780f"/>
          <line x1="${156+D*0.42}" y1="178" x2="${156+D*0.42}" y2="112" stroke="#d98a00" stroke-dasharray="4 4"/>
          <text x="${156+D*0.21}" y="102" text-anchor="middle" font-size="16" font-weight="700" fill="#d98a00">D = ${D} mm</text>
          <text x="156" y="272" font-size="13" fill="#7A7A7A">talão dos garfos</text>
          <text x="${156+D*0.42}" y="272" text-anchor="middle" font-size="13" fill="#d9780f">centro de carga</text>`;
        out.innerHTML=`Máquina de ${Q.Q} kg (D nominal 500 mm): com D = <b>${D} mm</b> a capacidade cai para <b>${capc} kg</b>.`; };
      rg.oninput=upd; upd(); } };

  /* --- capacidade × elevação --- */
  CUSTOM.chart={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.5"><svg id="chSvg" viewBox="0 0 600 320"></svg></div><div style="display:flex;flex-direction:column;justify-content:center"><p class="rv" style="--d:700">A relação entre <b>peso da carga</b> e <b>altura de elevação</b> afeta diretamente a estabilidade: quanto mais alto, mais alto fica o centro de gravidade e menor a capacidade.</p><p class="rv" style="--d:1000;color:#6a6a6a;font-size:calc(var(--u)*1.55)">Curva calculada pelo simulador para empilhadeira de 2,5 t, centro de carga de 500 mm. Em campo, vale sempre a placa do fabricante.</p><button class="tbtn rv" style="--d:1300" data-go="load:2">Testar no simulador →</button></div></div>`,
    init(el){ const svg=el.querySelector('#chSvg'); const Q=TRUCKS['2.5']; const pts=[]; for(let h=0;h<=5.5+1e-9;h+=0.25) pts.push([h,capacity(Q,h,0.5)]);
      const X=h=>60+h/5.5*520, Y=q=>270-q/2800*230; const path=pts.map((p,i)=>(i?'L':'M')+X(p[0]).toFixed(1)+' '+Y(p[1]).toFixed(1)).join('');
      let g=''; for(let q=0;q<=2500;q+=500) g+=`<line x1="60" x2="580" y1="${Y(q)}" y2="${Y(q)}" stroke="#E3E6E6"/><text x="52" y="${Y(q)+4}" text-anchor="end" font-size="12" fill="#7A7A7A">${q}</text>`;
      for(let h=0;h<=5;h++) g+=`<text x="${X(h)}" y="292" text-anchor="middle" font-size="12" fill="#7A7A7A">${h} m</text>`;
      svg.innerHTML=`${g}<text x="320" y="314" text-anchor="middle" font-size="13" fill="#7A7A7A" font-weight="600">altura dos garfos</text><text x="14" y="150" transform="rotate(-90 14 150)" text-anchor="middle" font-size="13" fill="#7A7A7A" font-weight="600">capacidade (kg)</text>
        <path d="${path}L${X(5.5)} 270L60 270Z" fill="rgba(183,217,216,.35)"/><path id="chLine" d="${path}" fill="none" stroke="#5BA8A5" stroke-width="4" stroke-linecap="round" stroke-dasharray="1200" stroke-dashoffset="1200"/>
        <circle id="chDot" r="8" fill="#D0CC00" stroke="#8d8a00" stroke-width="3" cx="${X(0)}" cy="${Y(pts[0][1])}"/><text id="chTxt" x="${X(0)+12}" y="${Y(pts[0][1])-12}" font-size="14" font-weight="700" fill="#4A4A4A"></text>`;
      const line=svg.querySelector('#chLine'), dot=svg.querySelector('#chDot'), tx=svg.querySelector('#chTxt'); let t0=null;
      const step=ts=>{ if(!el.classList.contains('cur')){ t0=null; return; } if(t0===null) t0=ts; const k=Math.min(1,(ts-t0-600)/2600); if(k>=0){ line.style.strokeDashoffset=1200*(1-k); const idx=k*(pts.length-1), i=Math.floor(idx), f=idx-i, p=pts[i], q=pts[Math.min(i+1,pts.length-1)]; const h=p[0]+(q[0]-p[0])*f, c=p[1]+(q[1]-p[1])*f; dot.setAttribute('cx',X(h)); dot.setAttribute('cy',Y(c)); tx.setAttribute('x',X(h)-14); tx.setAttribute('y',Y(c)-16); tx.setAttribute('text-anchor','end'); tx.textContent=`${h.toFixed(1)} m → ${Math.round(c/10)*10} kg`; } if(k<1) requestAnimationFrame(step); };
      el.__start=()=>{ t0=null; line.style.strokeDashoffset=1200; requestAnimationFrame(step); }; } };

  /* --- garfo 75% --- */
  CUSTOM.fork75={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.4"><svg id="fkSvg" viewBox="0 0 560 300"></svg></div><div style="display:flex;flex-direction:column;justify-content:center"><p class="rv" style="--d:700">O garfo deve ter, no mínimo, <b>¾ ou 75%</b> do tamanho da carga. Garfo curto faz a carga <b>balançar, escorregar e deslocar o centro de gravidade</b>.</p><div class="ctl rv" style="--d:1000"><span>Garfo</span><input id="fkRange" type="range" min="30" max="100" step="1" value="60"><b id="fkPct" style="min-width:calc(var(--u)*6)">60%</b></div><div id="fkState" class="rv" style="--d:1200;margin-top:calc(var(--u)*.8)"></div></div></div>`,
    init(el){ const svg=el.querySelector('#fkSvg'), rg=el.querySelector('#fkRange'), pc=el.querySelector('#fkPct'), stt=el.querySelector('#fkState');
      const upd=()=>{ const p=+rg.value, ok=p>=75; pc.textContent=p+'%'; const L=300, fl=L*p/100;
        svg.innerHTML=`<text x="280" y="40" text-anchor="middle" font-size="15" fill="#7A7A7A" font-weight="600">vista lateral</text>
          <rect x="120" y="120" width="${L}" height="110" rx="8" fill="#d3ad74" stroke="#7a5a2e" stroke-width="3"/><text x="${120+L/2}" y="182" text-anchor="middle" font-size="18" font-weight="700" fill="#4A3000">carga (100%)</text>
          <rect x="60" y="232" width="60" height="22" fill="#2b3037"/><rect x="120" y="232" width="${fl}" height="12" rx="3" fill="${ok?'#2e9e6b':'#d6303a'}"/>
          <line x1="120" y1="276" x2="${120+fl}" y2="276" stroke="${ok?'#2e9e6b':'#d6303a'}" stroke-width="3"/><text x="${120+fl/2}" y="296" text-anchor="middle" font-size="15" font-weight="700" fill="${ok?'#2e9e6b':'#d6303a'}">${p}% da carga apoiada</text>
          <line x1="${120+L*0.75}" y1="106" x2="${120+L*0.75}" y2="256" stroke="#d98a00" stroke-width="2" stroke-dasharray="6 5"/><text x="${120+L*0.75}" y="98" text-anchor="middle" font-size="13" font-weight="700" fill="#d98a00">mínimo 75%</text>`;
        stt.innerHTML=ok?'<span class="pill ok">Apoio adequado</span>':'<span class="pill bad">Garfo curto: a carga pode escorregar</span>'; };
      rg.oninput=upd; upd(); } };

  /* --- base de 3 pontos --- */
  CUSTOM.base3={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.3"><svg id="b3Svg" viewBox="0 0 560 320"></svg></div><div style="display:flex;flex-direction:column;justify-content:center"><div class="lst sm" style="justify-content:center"><div class="li rv l" style="--d:900">A base da empilhadeira é feita em <b>3 pontos</b>:</div><div class="li rv l" style="--d:1250">2 pontos nas <b>rodas de tração</b></div><div class="li rv l" style="--d:1600">1 ponto no <b>centro do eixo traseiro</b> (direção)</div><div class="li rv l" style="--d:1950">O sistema de 3 pontos permite que a empilhadeira <b>acompanhe as irregularidades do terreno</b></div></div></div></div>`,
    init(el){ const svg=el.querySelector('#b3Svg'); svg.innerHTML=`<rect x="190" y="70" width="330" height="170" rx="26" fill="#EEF2F2" stroke="#cbd3d3" stroke-width="2"/>
      <polygon id="b3Tri" points="470,100 470,210 80,155" fill="rgba(183,217,216,.45)" stroke="#5BA8A5" stroke-width="4" stroke-dasharray="900" stroke-dashoffset="900"/>
      <rect x="450" y="80" width="40" height="40" rx="8" fill="#17191c"/><rect x="450" y="190" width="40" height="40" rx="8" fill="#17191c"/><rect x="62" y="136" width="36" height="38" rx="8" fill="#17191c"/>
      <circle cx="470" cy="100" r="9" fill="#D0CC00" stroke="#8d8a00" stroke-width="3"/><circle cx="470" cy="210" r="9" fill="#D0CC00" stroke="#8d8a00" stroke-width="3"/><circle cx="80" cy="155" r="9" fill="#D0CC00" stroke="#8d8a00" stroke-width="3"/>
      <text x="470" y="62" text-anchor="middle" font-size="14" font-weight="700" fill="#4A4A4A">roda de tração</text><text x="470" y="262" text-anchor="middle" font-size="14" font-weight="700" fill="#4A4A4A">roda de tração</text><text x="80" y="206" text-anchor="middle" font-size="14" font-weight="700" fill="#4A4A4A">eixo traseiro (centro)</text>
      <text x="300" y="300" text-anchor="middle" font-size="14" fill="#7A7A7A">vista superior · frente da empilhadeira → direita</text>`;
      const tri=svg.querySelector('#b3Tri'); el.__start=()=>{ tri.style.transition='none'; tri.style.strokeDashoffset=900; void tri.getBoundingClientRect(); tri.style.transition='stroke-dashoffset 2.2s ease .6s'; tri.style.strokeDashoffset=0; }; } };

  /* --- triângulo: casos de tombamento (usa a física do simulador) --- */
  const TRI_CASES=[
    {n:'Empilhadeira vazia',o:{lift:0.2,tilt:0},p:{mass:0}},
    {n:'Empilhadeira carregada (carga nominal)',o:{lift:0.2,tilt:6},p:{mass:1500,Lc:1,s:0}},
    {n:'Carga elevada, mastro inclinado para trás',o:{lift:3,tilt:6},p:{mass:1500,Lc:1,s:0}},
    {n:'Carga elevada, mastro inclinado para frente',o:{lift:3.5,tilt:-4},p:{mass:2000,Lc:1,s:0}},
    {n:'Centro de carga além do especificado',o:{lift:0.3,tilt:0},p:{mass:2500,Lc:1.6,s:0.4}},
    {n:'Giro rápido',o:{lift:2.5,tilt:3},p:{mass:1500,Lc:1,s:0,speed:11,turn:1,radius:3}},
    {n:'Carga acambarcada (descentralizada) à direita',o:{lift:2.5,tilt:0},p:{mass:2000,Lc:1,s:0,yl:-0.3,cgy:-0.25}},
    {n:'Descendo rampa de frente, freando',o:{lift:0.2,tilt:6},p:{mass:2000,Lc:1,s:0,slope:-14,speed:5,brake:2.5}}];
  CUSTOM.tri={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.35"><svg id="trSvg" viewBox="0 0 520 330"></svg></div><div style="display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*.6)"><div id="trName" class="rv" style="--d:700;font-size:calc(var(--u)*2.2);font-weight:700;color:#4A4A4A"></div><div id="trSt" class="rv" style="--d:900"></div><div id="trTxt" class="rv" style="--d:1100;font-size:calc(var(--u)*1.55);color:#6a6a6a;line-height:1.4"></div><div class="chips rv" style="--d:1300" id="trChips"></div><button class="tbtn rv" style="--d:1500" data-go="load:2">Simular no Teste de carga →</button></div></div>`,
    init(el){ const svg=el.querySelector('#trSvg'), nm=el.querySelector('#trName'), sp=el.querySelector('#trSt'), tx=el.querySelector('#trTxt'), ch=el.querySelector('#trChips'); let idx=0, timer=0;
      const res=TRI_CASES.map(c=>withTruck('2.5',()=>{ const A=analyse({p:Object.assign({},DEF,c.p),lift:c.o.lift,tilt:c.o.tilt}); return {fs:A.fs,cg:A.cg,crit:A.crit}; }));
      const X=x=>330+x*100, Y=y=>165-y*100;
      svg.innerHTML=`<rect x="${X(-2.2)}" y="${Y(.55)}" width="${2.2*100+60}" height="110" rx="16" fill="#EEF2F2" stroke="#cbd3d3" stroke-width="2"/>
        <polygon points="${X(0)},${Y(.5)} ${X(0)},${Y(-.5)} ${X(-1.65)},${Y(0)}" fill="rgba(183,217,216,.5)" stroke="#5BA8A5" stroke-width="4"/>
        <polygon points="${X(0)},${Y(.5)} ${X(0)},${Y(-.5)} ${X(-1.65)},${Y(0)}" fill="none" stroke="#d6303a" stroke-opacity=".35" stroke-width="12" stroke-linejoin="round"/>
        <rect x="${X(0)-14}" y="${Y(.5)-16}" width="28" height="32" rx="6" fill="#17191c"/><rect x="${X(0)-14}" y="${Y(-.5)-16}" width="28" height="32" rx="6" fill="#17191c"/><rect x="${X(-1.65)-12}" y="${Y(0)-16}" width="24" height="32" rx="6" fill="#17191c"/>
        <circle id="trDot" r="15" cx="${X(-.6)}" cy="${Y(0)}" fill="#2e9e6b" stroke="#fff" stroke-width="4" style="filter:drop-shadow(0 4px 8px rgba(0,0,0,.3))"/>
        <text x="${X(-1.65)}" y="${Y(0)+46}" text-anchor="middle" font-size="13" fill="#7A7A7A">eixo traseiro</text><text x="${X(0)+30}" y="${Y(-.5)+34}" text-anchor="end" font-size="13" fill="#7A7A7A">eixo dianteiro (tombamento frontal)</text>
        <text x="260" y="26" text-anchor="middle" font-size="14" fill="#7A7A7A" font-weight="600">posição do centro de gravidade projetada no piso</text>`;
      const dot=svg.querySelector('#trDot'); dot.style.transition='cx .9s cubic-bezier(.2,.8,.2,1), cy .9s cubic-bezier(.2,.8,.2,1), fill .4s';
      ch.innerHTML=TRI_CASES.map((c,i)=>`<span class="chip2" data-i="${i}" style="cursor:pointer;font-size:calc(var(--u)*1.2)"><i>${i+1}</i></span>`).join('');
      const show=i=>{ idx=i; const r=res[i], c=TRI_CASES[i], ok=r.fs>=1.2, warn=r.fs>=1.0&&r.fs<1.2;
        dot.setAttribute('cx',X(r.cg.px)); dot.setAttribute('cy',Y(r.cg.py)); dot.setAttribute('fill',ok?'#2e9e6b':warn?'#d98a00':'#d6303a');
        nm.textContent=`${i+1}. ${c.n}`; sp.innerHTML=ok?`<span class="pill ok">Estável · FS ${isFinite(r.fs)?r.fs.toFixed(2).replace('.',','):'—'}</span>`:warn?`<span class="pill warn">Atenção · FS ${r.fs.toFixed(2).replace('.',',')}</span>`:`<span class="pill bad">Risco de tombamento · FS ${r.fs.toFixed(2).replace('.',',')}</span>`;
        tx.textContent=ok?'O centro de gravidade permanece dentro do triângulo, longe das bordas.':'O centro de gravidade chega à borda ou sai do triângulo de estabilidade.';
        ch.querySelectorAll('.chip2').forEach((e,k)=>e.style.background=k===i?'#D0CC00':''); };
      ch.onclick=e=>{ const s=e.target.closest('.chip2'); if(s){ clearInterval(timer); show(+s.dataset.i); timer=setInterval(()=>show((idx+1)%TRI_CASES.length),4200); } };
      el.__start=()=>{ clearInterval(timer); show(0); timer=setInterval(()=>show((idx+1)%TRI_CASES.length),4200); }; el.__stop=()=>clearInterval(timer); } };

  /* --- cena de análise de risco --- */
  const RISKS=[
    {x:300,y:96,t:'Carga de 3,0 t acima da capacidade da máquina (placa).'},
    {x:262,y:175,t:'Garfos elevados durante o deslocamento: CG alto e instável.'},
    {x:468,y:206,t:'Pedestre na área de operação, sem barreira ou sinalização.'},
    {x:150,y:140,t:'Operador sem cinto de segurança afivelado.'},
    {x:112,y:262,t:'Piso com óleo/irregular: risco de derrapagem e tombamento.'},
    {x:380,y:150,t:'Carga alta bloqueando a visão frontal: o correto era trafegar de ré.'}];
  CUSTOM.scene={html:()=>`<div class="row2"><div class="svgbox rv fade" style="--d:400;flex:1.7"><svg id="scSvg" viewBox="0 0 560 320"></svg></div><div style="display:flex;flex-direction:column;justify-content:center"><div class="big rv" style="--d:700;font-size:calc(var(--u)*2.2)!important">Clique nos <b>pontos</b> para revelar os riscos.</div><div class="rv" style="--d:900;margin:calc(var(--u)*.8) 0"><span class="pill warn" id="scCount">0 de ${RISKS.length} riscos identificados</span></div><div id="scTxt" class="quote" style="font-size:calc(var(--u)*1.6);min-height:calc(var(--u)*6);display:none"></div></div></div>`,
    init(el){ const svg=el.querySelector('#scSvg'), cnt=el.querySelector('#scCount'), tx=el.querySelector('#scTxt'); const found=new Set();
      svg.innerHTML=`<rect x="0" y="244" width="560" height="76" fill="#E9EDED"/><path d="M60 270 q30 -10 60 0 q30 10 60 0" stroke="#8a8a8a" stroke-width="3" fill="none"/>
        <path d="M70 188 L70 150 Q70 128 100 128 L150 128 L166 100 L166 200 Z" fill="#D0CC00" stroke="#7d7a00" stroke-width="2"/>
        <rect x="76" y="92" width="6" height="40" fill="#1b1e23"/><rect x="128" y="92" width="6" height="40" fill="#1b1e23"/><rect x="66" y="88" width="76" height="8" fill="#2a2e35"/>
        <circle cx="96" cy="212" r="26" fill="#17191c"/><circle cx="96" cy="212" r="11" fill="#aeb6bf"/><circle cx="170" cy="216" r="30" fill="#17191c"/><circle cx="170" cy="216" r="12" fill="#aeb6bf"/>
        <rect x="190" y="30" width="10" height="190" fill="#3C444F"/><rect x="200" y="150" width="190" height="10" rx="3" fill="#b4bcc6"/>
        <rect x="204" y="60" width="150" height="90" fill="#d3ad74" stroke="#7a5a2e" stroke-width="2"/><text x="279" y="112" text-anchor="middle" font-size="26" font-weight="800" fill="#4A3000">3.0 T</text>
        <circle cx="450" cy="168" r="11" fill="#e2b48c"/><rect x="438" y="180" width="24" height="46" rx="8" fill="#2a5d9f"/><rect x="440" y="226" width="8" height="24" fill="#2a2e35"/><rect x="452" y="226" width="8" height="24" fill="#2a2e35"/>
        ${RISKS.map((r,i)=>`<g class="hot" data-i="${i}" transform="translate(${r.x} ${r.y})"><circle class="r" r="15"/><circle r="22" fill="none" stroke="#d6303a" stroke-opacity=".35"><animate attributeName="r" values="16;26;16" dur="2s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values=".6;0;.6" dur="2s" repeatCount="indefinite"/></circle><text y="6" text-anchor="middle" font-size="16" font-weight="800" fill="#d6303a">${i+1}</text></g>`).join('')}`;
      svg.addEventListener('click',e=>{ const g=e.target.closest('.hot'); if(!g) return; const i=+g.dataset.i; found.add(i); g.classList.add('on'); cnt.textContent=`${found.size} de ${RISKS.length} riscos identificados`; cnt.className='pill '+(found.size===RISKS.length?'ok':'warn'); tx.style.display='block'; tx.textContent=`${i+1}. ${RISKS[i].t}`; }); } };

  /* ====================== PALCO / NAVEGAÇÃO ====================== */
  let tw=0;
  function layout(){
    const v=$t('#tView'); if(!v) return; const r=v.getBoundingClientRect(); if(r.width<50) return;
    const pad=14; let w=Math.min(r.width-pad*2,(r.height-pad*2)*16/9), h=w*9/16; const fr=$t('#tFrame'); fr.style.width=w+'px'; fr.style.height=h+'px'; fr.style.setProperty('--u',(w/100)+'px'); tw=w;
  }
  function build(){
    if(built) return; built=true; const host=$t('#tSlides');
    flat.forEach((f,n)=>{ const el=document.createElement('div'); el.className='sl'; el.dataset.n=n; el.innerHTML=slideHTML(f,n); host.appendChild(el); f.el=el; if(CUSTOM[f.d.k]&&CUSTOM[f.d.k].init) CUSTOM[f.d.k].init(el); });
    const dots=$t('#tDots'); dots.innerHTML=''; SECTIONS.forEach((s,si)=>{ const sg=document.createElement('div'); sg.className='sg'; sg.style.flex=s.slides.length; sg.title=s.title; sg.dataset.si=si; sg.innerHTML='<i></i>'; sg.onclick=()=>goSection(si); dots.appendChild(sg); });
    host.addEventListener('click',e=>{ const b=e.target.closest('[data-go]'); if(b) link(b.dataset.go); const c=e.target.closest('[data-3d]'); });
    $t('#tPrev').onclick=()=>step(-1); $t('#tNext').onclick=()=>step(1);
    $t('#tAuto').onclick=()=>{ auto=!auto; autoT=0; $t('#tAuto').textContent=auto?'⏸ Pausar':'▶ Auto'; };
    $t('#tFull').onclick=()=>{ const el=$t('#tStage'); if(document.fullscreenElement) document.exitFullscreen(); else if(el.requestFullscreen) el.requestFullscreen(); };
    document.addEventListener('fullscreenchange',()=>setTimeout(layout,100));
    new ResizeObserver(layout).observe($t('#tView'));
    document.addEventListener('keydown',e=>{ if(!active) return; if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&e.key!==' ') return;
      if(e.key==='ArrowRight'||e.key==='PageDown'||(e.key===' '&&e.target.tagName!=='INPUT')){ e.preventDefault(); step(1); } else if(e.key==='ArrowLeft'||e.key==='PageUp'){ e.preventDefault(); step(-1); }
      else if(e.key==='Home') go(0); else if(e.key==='End') go(N-1); else if(e.key==='f'||e.key==='F') $t('#tFull').click(); });
    let sx=null; host.addEventListener('pointerdown',e=>{ if(e.target.closest('button,input,svg,a,.chip2,canvas')) return; sx=e.clientX; }); host.addEventListener('pointerup',e=>{ if(sx===null) return; const dx=e.clientX-sx; sx=null; if(Math.abs(dx)>60) step(dx<0?1:-1); });
    buildPanel();
  }
  function link(s){
    const [kind,arg]=s.split(':');
    if(kind==='asm'){ setTab('asm'); ASM.init(); if(arg) ASM.select(arg); }
    else if(kind==='load'){ setTab('load'); const sc=SCEN[+arg]; if(sc) applyState(sc[1]()); }
    else if(kind==='trn'){ setTab('trn'); goSection(+arg||0); }
  }
  function go(n,dir){
    n=Math.max(0,Math.min(N-1,n)); if(n===cur) return; const prev=cur; cur=n; const f=flat[n];
    const tr=(dir<0&&(f.sec.tr==='slide'))?'slideL':(dir<0&&f.sec.tr==='slideL')?'slide':f.sec.tr;
    flat.forEach((x,i)=>{ if(i!==n&&i!==prev){ x.el.classList.remove('cur','in','out','leaving'); } });
    if(prev>=0&&prev!==n){ const p=flat[prev].el; p.className='sl leaving t-'+tr+' out'; setTimeout(()=>{ if(cur!==prev) p.className='sl'; },560); const q=p; q.__stop&&q.__stop(); }
    const e=f.el; e.className='sl cur t-'+tr+' in'; setTimeout(()=>e.classList.remove('in'),700);
    // reinicia animações dos elementos
    e.querySelectorAll('.rv').forEach(x=>{ x.style.animation='none'; void x.offsetWidth; x.style.animation=''; });
    e.__start&&e.__start();
    if(f.d.k==='title'||f.d.k==='closing') mount3d(e);
    update(); autoT=0;
  }
  function update(){
    const f=flat[cur]; $t('#tSec').textContent=`${String(f.si+1).padStart(2,'0')} · ${f.sec.title}`; $t('#tSub').textContent=`slide ${f.i+1} de ${f.sec.slides.length}`;
    $t('#tCount').textContent=`${cur+1} / ${N}`; $t('#tProg').style.width=((cur+1)/N*100)+'%';
    $t('#tPrev').disabled=cur===0; $t('#tNext').disabled=cur===N-1;
    document.querySelectorAll('#tDots .sg').forEach((s,si)=>{ s.className='sg'+(si<f.si?' done':si===f.si?' cur':''); });
    markPanel();
  }
  const step=d=>go(cur+d,d);
  function goSection(si){ let n=0; for(let i=0;i<si;i++) n+=SECTIONS[i].slides.length; build(); layout(); go(n,1); closePanel(); }

  /* --- 3D da abertura/encerramento --- */
  function mount3d(slideEl){
    const host=slideEl.querySelector('[data-3d]'); if(!host) return;
    if(!st3){ const cv=document.createElement('canvas'); try{ st3=F3D.createStage(cv,{}); }catch(e){ st3=null; return; }
      st3.canvas=cv; const P=F3D.build(TRUCKS['2.5']); const g=new THREE.Group(); for(const id in P) g.add(P[id].model); st3.scene.add(g); st3.ctl.dist=7.4; st3.ctl.el=0.34; st3.ctl.target.set(-0.25,0.85,0); st3.ctl.auto=true; st3.ctl.maxD=14; }
    host.appendChild(st3.canvas); st3.ctl.auto=true;
  }

  /* --- painel lateral (menu) --- */
  function buildPanel(){
    const p=$t('#railPanel'); if(!p||p.dataset.b) return; p.dataset.b=1;
    p.innerHTML=`<h3>Simulador</h3><button class="pn" data-go="load"><span class="nb">⚖</span><span>Teste de carga<small>Estabilidade, capacidade e 3D</small></span></button><button class="pn" data-go="asm"><span class="nb">🔧</span><span>Montagem da empilhadeira<small>17 peças, 3D e projeto 2D</small></span></button>
      <h3>Treinamento NR-11</h3>${SECTIONS.map((s,i)=>`<button class="pn" data-go="trn:${i}" data-sec="${i}"><span class="nb">${i+1}</span><span>${s.short}<small>${s.slides.length} slides</small></span></button>`).join('')}`;
    p.addEventListener('click',e=>{ const b=e.target.closest('[data-go]'); if(b){ closePanel(); link(b.dataset.go); } });
  }
  function openPanel(){ buildPanel(); $t('#railPanel').hidden=false; panelOpen=true; markPanel(); }
  function closePanel(){ const p=$t('#railPanel'); if(p){ p.hidden=true; } panelOpen=false; }
  function markPanel(){ const p=$t('#railPanel'); if(!p||!p.dataset.b) return; p.querySelectorAll('.pn').forEach(b=>{ const g=b.dataset.go; let on=false; if(g==='load') on=(TAB==='load'); else if(g==='asm') on=(TAB==='asm'); else if(g.startsWith('trn')) on=(TAB==='trn'&&cur>=0&&flat[cur].si===+b.dataset.sec); b.classList.toggle('on',on); }); }

  /* --- ciclo --- */
  function enter(){ active=true; build(); layout(); if(cur<0) go(0,1); else { const e=flat[cur].el; e.querySelectorAll('.rv').forEach(x=>{x.style.animation='none'; void x.offsetWidth; x.style.animation='';}); e.__start&&e.__start(); if(flat[cur].d.k==='title'||flat[cur].d.k==='closing') mount3d(e); } setTimeout(layout,50); }
  function leave(){ active=false; if(built&&cur>=0&&flat[cur].el.__stop) flat[cur].el.__stop(); }
  let lastT=0;
  function frame(dt){
    if(!built) return;
    if(auto){ autoT+=dt; const dwell=(flat[cur].d.k==='cols'||flat[cur].d.k==='norm'||flat[cur].d.k==='two')?16:9; if(autoT>dwell){ if(cur<N-1) step(1); else { auto=false; $t('#tAuto').textContent='▶ Auto'; } } }
    if(st3&&(flat[cur].d.k==='title'||flat[cur].d.k==='closing')){ st3.step(dt); st3.render(); }
  }

  // botões do menu lateral (fora do módulo de slides)
  document.addEventListener('DOMContentLoaded',()=>{
    const t=document.querySelector('#railToggle'); if(t) t.onclick=e=>{ e.stopPropagation(); panelOpen?closePanel():openPanel(); };
    document.querySelectorAll('#rail .rb[data-go]').forEach(b=>b.onclick=()=>{ const g=b.dataset.go; if(g.startsWith('trn')) openPanel(); else { closePanel(); link(g); } });
    document.addEventListener('click',e=>{ if(panelOpen&&!e.target.closest('#railPanel,#railToggle,#rail .rb')) closePanel(); });
  });

  return {enter,leave,frame,goSection,markPanel,link,SECTIONS};
})();
