/* Base de alimentos: valores por porção em medida caseira (referência de MÃO).
   Fonte: Tabela Brasileira de Composição de Alimentos (TACO, 4a ed., NEPA/UNICAMP)
   e USDA FoodData Central pra itens sem entrada direta na TACO.
   Alimento denso em caloria (queijo, gordura, doce, frito, oleaginosa) usa
   "tamanhos" (2-3 porções) em vez de 1 clique só de mão, porque a mão
   subestima esses itens (ver pesquisa-nutricao-esportiva-calculadora.md).
   kcal e proteina(g) já são o TOTAL da porção, não por 100g.
   Nome com "(sinônimo)" no final ajuda a busca por termo popular (ex: "boi"
   acha "Carne bovina (boi)" mesmo não sendo a 1a palavra do nome), porque
   a busca já é substring no nome inteiro, não só prefixo (ver buscarAlimentos
   em motor.js). Itens marcados com "// ESTIMATIVA" no comentário não têm
   entrada direta na TACO pra aquela forma de preparo específica (ex: frito),
   foram extrapolados a partir do valor cru/cozido/assado mais próximo da
   própria TACO + acréscimo típico de absorção de óleo — não são tabela
   oficial ponto a ponto, documentado aqui pra transparência. */

const CATEGORIAS = [
  { id: 'paes',    nome: 'Arroz, macarrão, pães e raízes' },
  { id: 'ovos',    nome: 'Ovos e laticínios' },
  { id: 'carnes',  nome: 'Carnes, aves, peixes e ovos' },
  { id: 'leg',     nome: 'Feijões e leguminosas' },
  { id: 'veg',     nome: 'Vegetais e legumes' },
  { id: 'frutas',  nome: 'Frutas' },
  { id: 'gordura', nome: 'Gordura, doce e frito' },
  { id: 'bebida',  nome: 'Bebidas' },
];

const ALIMENTOS = [
  // ---- PÃES, CEREAIS E RAÍZES (medida: punho fechado ou unidade) ----
  { id:'pao-frances', nome:'Pão francês', cat:'paes', porcao:'1 unidade', kcal:135, prot:4.0 },
  { id:'pao-forma', nome:'Pão de forma', cat:'paes', porcao:'1 fatia', kcal:65, prot:2.0 },
  { id:'pao-integral', nome:'Pão integral', cat:'paes', porcao:'1 fatia', kcal:60, prot:2.5 },
  { id:'tapioca', nome:'Tapioca (goma)', cat:'paes', porcao:'1 unidade média', kcal:130, prot:0.2 },
  { id:'aveia', nome:'Aveia em flocos', cat:'paes', porcao:'1 punho fechado', kcal:150, prot:5.5 },
  { id:'granola', nome:'Granola', cat:'paes', porcao:'1 punho fechado', kcal:180, prot:4.0 },
  { id:'cuscuz', nome:'Cuscuz cozido', cat:'paes', porcao:'1 punho fechado', kcal:112, prot:2.5 },
  { id:'arroz-branco', nome:'Arroz branco cozido', cat:'paes', porcao:'1 punho fechado', kcal:128, prot:2.5 },
  { id:'arroz-integral', nome:'Arroz integral cozido', cat:'paes', porcao:'1 punho fechado', kcal:124, prot:2.6 },
  { id:'macarrao', nome:'Macarrão cozido', cat:'paes', porcao:'1 punho fechado', kcal:158, prot:5.8 },
  { id:'batata-inglesa', nome:'Batata inglesa cozida', cat:'paes', porcao:'1 punho fechado', kcal:52, prot:1.2 },
  { id:'batata-doce', nome:'Batata doce cozida', cat:'paes', porcao:'1 punho fechado', kcal:77, prot:0.6 },
  { id:'mandioca', nome:'Mandioca/aipim cozida', cat:'paes', porcao:'1 punho fechado', kcal:125, prot:0.6 },

  // ---- OVOS E LATICÍNIOS ----
  { id:'ovo', nome:'Ovo cozido', cat:'ovos', porcao:'1 unidade', kcal:74, prot:6.5 },
  { id:'ovo-frito', nome:'Ovo frito', cat:'ovos', porcao:'1 unidade', kcal:100, prot:6.3 }, // AUDITORIA 19/08: cozido e frito estavam com o MESMO valor (74kcal), errado, frito ganha caloria do oleo. TACO frito 240kcal/15,6g por 100g; unidade de ~65g (ovo + oleo absorvido) e faixa de consenso (Vitat/FatSecret/Yazio, 90-107kcal por unidade) confirmam ~100kcal, nao 74
  { id:'iogurte', nome:'Iogurte natural', cat:'ovos', porcao:'1 copo (170g)', kcal:100, prot:6.0 },
  { id:'leite', nome:'Leite integral', cat:'ovos', porcao:'1 copo (200ml)', kcal:122, prot:6.4 },
  { id:'queijo', nome:'Queijo (minas, muçarela)', cat:'ovos', tamanhos:[
      {label:'1 fatia fina', kcal:45, prot:3.5},
      {label:'2 fatias', kcal:90, prot:7.0},
      {label:'3 fatias', kcal:135, prot:10.5},
  ]},
  { id:'requeijao', nome:'Requeijão / cream cheese', cat:'ovos', tamanhos:[
      {label:'1 colher de chá', kcal:30, prot:0.7},
      {label:'1 colher de sopa', kcal:60, prot:1.4},
      {label:'2 colheres de sopa', kcal:120, prot:2.8},
  ]},

  // ---- CARNES, AVES, PEIXES ----
  { id:'frango-peito', nome:'Peito de frango grelhado (frango)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:191, prot:38.0 },
  { id:'frango-peito-cozido', nome:'Peito de frango cozido (frango)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:196, prot:37.8 }, // TACO: frango peito s/pele cozido 163kcal/31,5g por 100g
  { id:'frango-frito', nome:'Filé de frango frito à milanesa (frango)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:288, prot:24.0 }, // ESTIMATIVA: grelhado + empanado/óleo, TACO não tem entrada direta de filé frito
  { id:'frango-coxa', nome:'Coxa/sobrecoxa assada (frango)', cat:'carnes', porcao:'1 unidade', kcal:215, prot:26.0 },
  { id:'carne-bife', nome:'Bife bovino magro grelhado (boi, carne bovina)', cat:'carnes', porcao:'1 bife (palma da mão)', kcal:233, prot:43.1 }, // AUDITORIA 19/08: recalibrado, TACO contra-file sem gordura grelhado real e 194kcal/35,9g por 100g (nao 194/31,2 que era o valor de "musculo cozido" usado antes por engano), em porcao de 120g da 233/43,1
  { id:'carne-bovina-cozida', nome:'Carne bovina cozida (boi)', cat:'carnes', porcao:'1 porção (palma da mão)', kcal:233, prot:37.4 }, // TACO: musculo s/gordura cozido 194kcal/31,2g por 100g
  { id:'carne-bovina-frita', nome:'Carne bovina frita (boi)', cat:'carnes', porcao:'1 bife (palma da mão)', kcal:270, prot:36.0 }, // ESTIMATIVA: grelhado + acrescimo de oleo da fritura, TACO nao tem "bovina frita" direto
  { id:'carne-bovina-assada', nome:'Carne bovina assada (boi)', cat:'carnes', porcao:'1 porção (palma da mão)', kcal:245, prot:36.0 }, // TACO: paleta s/gordura cozida como referencia mais proxima
  { id:'carne-moida', nome:'Carne moída refogada (boi)', cat:'carnes', porcao:'1 punho fechado', kcal:212, prot:26.0 },
  { id:'carne-suina-assada', nome:'Carne suína assada (porco, lombo)', cat:'carnes', porcao:'1 porção (palma da mão)', kcal:252, prot:42.8 }, // TACO: porco lombo assado 210kcal/35,7g por 100g
  { id:'carne-suina-cozida', nome:'Carne suína cozida (porco)', cat:'carnes', porcao:'1 porção (palma da mão)', kcal:240, prot:33.6 }, // ESTIMATIVA a partir do lombo cru TACO (176kcal/22,6g/100g) ajustado pra cozimento
  { id:'carne-suina-frita', nome:'Carne suína frita (porco)', cat:'carnes', porcao:'1 porção (palma da mão)', kcal:372, prot:38.0 }, // ESTIMATIVA: pernil assado TACO (262kcal/32,1g/100g) + oleo da fritura
  { id:'peixe', nome:'Peixe grelhado (tilápia/filé)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:130, prot:26.0 },
  { id:'peixe-cozido', nome:'Peixe cozido (tilápia/filé)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:108, prot:24.0 }, // baseado em TACO tilapia grelhada 96kcal/20,1g/100g, cozido similar
  { id:'peixe-frito', nome:'Peixe frito à milanesa (tilápia/filé)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:216, prot:21.6 }, // ESTIMATIVA: grelhado + empanado/oleo, TACO nao tem filé frito direto
  { id:'atum', nome:'Atum em lata', cat:'carnes', porcao:'1 lata escorrida', kcal:100, prot:22.0 },
  { id:'camarao', nome:'Camarão refogado', cat:'carnes', porcao:'1 punho fechado', kcal:99, prot:20.0 },
  { id:'linguica', nome:'Linguiça (calabresa)', cat:'carnes', tamanhos:[
      {label:'1 gito', kcal:150, prot:6.5},
      {label:'2 gitos', kcal:300, prot:13.0},
  ]},
  { id:'salsicha', nome:'Salsicha (hot dog)', cat:'carnes', porcao:'1 unidade', kcal:90, prot:3.5 },
  { id:'bacon', nome:'Bacon / torresmo', cat:'carnes', tamanhos:[
      {label:'2 fatias', kcal:75, prot:4.0},
      {label:'4 fatias', kcal:150, prot:8.0},
  ]},

  // ---- FEIJÕES E LEGUMINOSAS ----
  { id:'feijao', nome:'Feijão cozido (com caldo)', cat:'leg', porcao:'1 concha (punho fechado)', kcal:76, prot:4.8 },
  { id:'lentilha', nome:'Lentilha cozida', cat:'leg', porcao:'1 punho fechado', kcal:93, prot:6.3 },
  { id:'grao-bico', nome:'Grão de bico cozido', cat:'leg', porcao:'1 punho fechado', kcal:121, prot:7.0 },

  // ---- VEGETAIS E LEGUMES ----
  { id:'alface', nome:'Alface', cat:'veg', porcao:'1 punho fechado', kcal:6, prot:0.6 },
  { id:'rucula', nome:'Rúcula', cat:'veg', porcao:'1 punho fechado', kcal:10, prot:1.0 },
  { id:'tomate', nome:'Tomate', cat:'veg', porcao:'1 unidade média', kcal:18, prot:0.9 },
  { id:'cenoura', nome:'Cenoura crua ou cozida', cat:'veg', porcao:'1 punho fechado', kcal:27, prot:0.6 },
  { id:'brocolis', nome:'Brócolis cozido', cat:'veg', porcao:'1 punho fechado', kcal:22, prot:2.0 },
  { id:'legumes', nome:'Legumes refogados (mix)', cat:'veg', porcao:'1 punho fechado', kcal:40, prot:1.5 },
  { id:'couve', nome:'Couve refogada', cat:'veg', porcao:'1 punho fechado', kcal:90, prot:3.0 }, // TACO: couve manteiga refogada 90kcal/100g
  { id:'quiabo', nome:'Quiabo cozido', cat:'veg', porcao:'1 punho fechado', kcal:33, prot:1.9 },
  { id:'jilo', nome:'Jiló refogado', cat:'veg', porcao:'1 punho fechado', kcal:30, prot:1.3 }, // ESTIMATIVA, TACO nao retornou valor direto de jilo na busca

  // ---- FRUTAS ----
  { id:'banana', nome:'Banana', cat:'frutas', porcao:'1 unidade', kcal:92, prot:1.4 },
  { id:'maca', nome:'Maçã', cat:'frutas', porcao:'1 unidade', kcal:68, prot:0.3 },
  { id:'laranja', nome:'Laranja', cat:'frutas', porcao:'1 unidade', kcal:71, prot:1.4 },
  { id:'mamao', nome:'Mamão', cat:'frutas', porcao:'1 punho fechado', kcal:68, prot:1.0 },
  { id:'uva', nome:'Uva', cat:'frutas', porcao:'1 punho fechado', kcal:69, prot:0.7 },
  { id:'abacaxi', nome:'Abacaxi', cat:'frutas', porcao:'1 punho fechado', kcal:62, prot:1.2 }, // TACO: abacaxi cru 48kcal/0,9g por 100g
  { id:'manga', nome:'Manga', cat:'frutas', porcao:'1 unidade média', kcal:96, prot:0.6 }, // ESTIMATIVA (referencia geral, TACO nao retornou na busca)
  { id:'goiaba', nome:'Goiaba', cat:'frutas', porcao:'1 unidade', kcal:54, prot:1.1 },
  { id:'melancia', nome:'Melancia', cat:'frutas', porcao:'1 punho fechado (fatia)', kcal:50, prot:1.4 },
  { id:'abacate', nome:'Abacate', cat:'frutas', tamanhos:[
      {label:'1/4 de unidade', kcal:80, prot:1.0},
      {label:'1/2 unidade', kcal:160, prot:2.0},
  ]},

  // ---- GORDURA, DOCE E FRITO (sempre em tamanhos, mão subestima) ----
  { id:'oleo', nome:'Óleo / azeite', cat:'gordura', tamanhos:[
      {label:'1 colher de chá', kcal:44, prot:0},
      {label:'1 colher de sopa', kcal:133, prot:0},
  ]},
  { id:'manteiga', nome:'Manteiga / margarina', cat:'gordura', tamanhos:[
      {label:'1 colher de chá', kcal:36, prot:0.1},
      {label:'1 colher de sopa', kcal:108, prot:0.2},
  ]},
  { id:'acucar', nome:'Açúcar', cat:'gordura', tamanhos:[
      {label:'1 colher de chá', kcal:19, prot:0},
      {label:'1 colher de sopa', kcal:58, prot:0},
  ]},
  { id:'mel', nome:'Mel', cat:'gordura', tamanhos:[
      {label:'1 colher de chá', kcal:22, prot:0},
      {label:'1 colher de sopa', kcal:62, prot:0},
  ]}, // TACO: mel de abelha 309kcal/100g, 0g proteina
  { id:'farofa', nome:'Farofa', cat:'gordura', tamanhos:[
      {label:'1 colher de sopa', kcal:60, prot:0.5},
      {label:'1 punho fechado', kcal:200, prot:1.5},
  ]}, // ESTIMATIVA (mandioca torrada + manteiga/bacon, receita caseira varia bastante)
  { id:'pao-de-queijo', nome:'Pão de queijo', cat:'gordura', tamanhos:[
      {label:'1 unidade pequena', kcal:100, prot:2.0},
      {label:'2 unidades', kcal:200, prot:4.0},
  ]}, // ESTIMATIVA (referencia geral, receita/tamanho varia bastante)
  { id:'doce', nome:'Doce / brigadeiro / chocolate', cat:'gordura', tamanhos:[
      {label:'1 unidade pequena', kcal:100, prot:1.0},
      {label:'1 unidade média', kcal:200, prot:2.0},
      {label:'1 fatia de bolo', kcal:280, prot:4.0},
  ]},
  { id:'batata-frita', nome:'Batata frita', cat:'gordura', tamanhos:[
      {label:'porção pequena', kcal:220, prot:3.0},
      {label:'porção média', kcal:440, prot:6.0},
  ]},
  { id:'salgado', nome:'Salgado frito (coxinha, pastel)', cat:'gordura', tamanhos:[
      {label:'1 unidade pequena', kcal:120, prot:4.0},
      {label:'1 unidade média', kcal:240, prot:8.0},
  ]},
  { id:'pizza', nome:'Pizza', cat:'gordura', tamanhos:[
      {label:'1 fatia média', kcal:266, prot:11.0},
      {label:'2 fatias', kcal:532, prot:22.0},
  ]},
  { id:'oleaginosa', nome:'Castanha / amendoim', cat:'gordura', tamanhos:[
      {label:'1 punhado pequeno', kcal:90, prot:3.0},
      {label:'1 punhado médio', kcal:180, prot:6.0},
  ]},
  { id:'sorvete', nome:'Sorvete', cat:'gordura', tamanhos:[
      {label:'2 bolas (~100g)', kcal:206, prot:3.6},
      {label:'4 bolas (~200g)', kcal:412, prot:7.2},
  ]}, // TACO/NuTrilho: sorvete industrializado media 206kcal/3,6g por 100g
  { id:'acai', nome:'Açaí na tigela', cat:'gordura', tamanhos:[
      {label:'tigela pequena (200ml)', kcal:250, prot:3.0},
      {label:'tigela média (300ml, c/ granola)', kcal:330, prot:4.0},
      {label:'tigela grande (500ml)', kcal:550, prot:6.0},
  ]}, // ESTIMATIVA: creme de açaí batido + granola/xarope, varia muito por casa/franquia, faixa observada 250-600kcal
  { id:'cachorro-quente', nome:'Cachorro-quente completo (pão, salsicha, molhos)', cat:'gordura', porcao:'1 unidade', kcal:340, prot:13.0 }, // baseado em TBCA ~215kcal/8,7g por 100g, porcao tipica ~160g
  { id:'hamburguer', nome:'Hambúrguer completo (pão, carne, queijo, salada)', cat:'gordura', porcao:'1 unidade', kcal:480, prot:21.0 }, // baseado em TACO hamburguer bovino c/pao ~209kcal/9,3g por 100g, porcao tipica ~230g
  { id:'biscoito-recheado', nome:'Biscoito recheado (passatempo)', cat:'gordura', tamanhos:[
      {label:'3 unidades (~30g)', kcal:142, prot:1.9},
      {label:'6 unidades (~60g)', kcal:283, prot:3.8},
  ]}, // TACO: biscoito doce recheado com chocolate 472kcal/6,4g por 100g
  { id:'biscoito-agua-sal', nome:'Biscoito água e sal / cream cracker', cat:'gordura', tamanhos:[
      {label:'4 unidades (~20g)', kcal:86, prot:2.0},
      {label:'8 unidades (~40g)', kcal:172, prot:4.0},
  ]}, // ESTIMATIVA a partir de referencia geral (~430kcal/10g por 100g), TACO nao retornou entrada direta
  { id:'salgadinho-pacote', nome:'Salgadinho de pacote (Doritos, Cheetos)', cat:'gordura', tamanhos:[
      {label:'pacote pequeno (25g)', kcal:125, prot:1.9},
      {label:'pacote médio (50g)', kcal:250, prot:3.8},
  ]}, // fabricante (OpenFoodFacts/tabela do produto): ~125kcal/1,9g por porcao de 25g
  { id:'feijoada', nome:'Feijoada completa (com acompanhamentos)', cat:'leg', porcao:'1 prato médio', kcal:650, prot:35.0 }, // ESTIMATIVA: feijao+carnes+arroz+farofa+couve, varia muito por receita, faixa observada 526-940kcal por prato

  // ---- BEBIDAS ----
  { id:'suco', nome:'Suco natural', cat:'bebida', porcao:'1 copo (200ml)', kcal:90, prot:0.5 },
  { id:'refri', nome:'Refrigerante', cat:'bebida', porcao:'1 copo (200ml)', kcal:85, prot:0 },
  { id:'cafe-puro', nome:'Café puro (sem leite, sem açúcar)', cat:'bebida', porcao:'1 xícara (150ml)', kcal:2, prot:0.2 },
  { id:'cafe', nome:'Café com leite e açúcar', cat:'bebida', porcao:'1 xícara (150ml)', kcal:60, prot:2.0 },
  { id:'whey', nome:'Whey protein', cat:'bebida', porcao:'1 dose (30g)', kcal:120, prot:24.0 },
  // Bebidas alcoolicas: marcadas com alcoolica:true, aparecem tambem na
  // busca restrita da secao "fora da rotina" (ver motor.js, bucket alcool).
  { id:'cerveja', nome:'Cerveja', cat:'bebida', alcoolica:true, tamanhos:[
      {label:'1 lata (350ml)', kcal:150, prot:1.6},
      {label:'1 garrafa (600ml)', kcal:257, prot:2.7},
  ]},
  { id:'vinho', nome:'Vinho (taça)', cat:'bebida', alcoolica:true, porcao:'1 taça (150ml)', kcal:120, prot:0.1 }, // media vinho tinto/branco seco, 110-125kcal por taca de 150ml
  { id:'destilada', nome:'Destilada (uísque, vodka, cachaça, conhaque)', cat:'bebida', alcoolica:true, porcao:'1 dose (40ml)', kcal:96, prot:0 }, // uisque ~240kcal/100ml, dose padrao 40ml
];

/* "Outros" por categoria: item de resgate pra quem não achar o alimento
   específico na lista. NÃO é dado de tabela, é a MÉDIA calculada em runtime
   dos itens já cadastrados na mesma categoria (pra item com "tamanhos", usa
   o tamanho do meio como representativo). Existe pra nunca contar 0 caloria
   quando a pessoa realmente comeu algo que não está na lista. */
CATEGORIAS.forEach(function(cat){
  const itensCat = ALIMENTOS.filter(function(a){ return a.cat===cat.id; });
  let somaKcal=0, somaProt=0, n=0;
  itensCat.forEach(function(a){
    if(a.tamanhos){
      const meio = a.tamanhos[Math.floor(a.tamanhos.length/2)];
      somaKcal+=meio.kcal; somaProt+=meio.prot;
    } else {
      somaKcal+=a.kcal; somaProt+=a.prot;
    }
    n++;
  });
  if(n===0) return;
  ALIMENTOS.push({
    id:'outros-'+cat.id, nome:'Outro alimento (não listado aqui)', cat:cat.id,
    porcao:'1 porção média (estimativa)',
    kcal:Math.round(somaKcal/n), prot:Math.round((somaProt/n)*10)/10,
  });
});
