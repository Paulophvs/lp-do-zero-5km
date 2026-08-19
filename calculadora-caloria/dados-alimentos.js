/* Base de alimentos: valores por porção em medida caseira (referência de MÃO).
   Fonte: Tabela Brasileira de Composição de Alimentos (TACO, 4a ed., NEPA/UNICAMP)
   e USDA FoodData Central pra itens sem entrada direta na TACO.
   Alimento denso em caloria (queijo, gordura, doce, frito, oleaginosa) usa
   "tamanhos" (2-3 porções) em vez de 1 clique só de mão, porque a mão
   subestima esses itens (ver pesquisa-nutricao-esportiva-calculadora.md).
   kcal e proteina(g) já são o TOTAL da porção, não por 100g. */

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
  { id:'ovo', nome:'Ovo cozido ou frito', cat:'ovos', porcao:'1 unidade', kcal:74, prot:6.5 },
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
  { id:'frango-peito', nome:'Peito de frango grelhado', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:191, prot:38.0 },
  { id:'frango-coxa', nome:'Coxa/sobrecoxa assada', cat:'carnes', porcao:'1 unidade', kcal:215, prot:26.0 },
  { id:'carne-bife', nome:'Bife bovino magro grelhado', cat:'carnes', porcao:'1 bife (palma da mão)', kcal:218, prot:38.0 },
  { id:'carne-moida', nome:'Carne moída refogada', cat:'carnes', porcao:'1 punho fechado', kcal:212, prot:26.0 },
  { id:'peixe', nome:'Peixe grelhado (tilápia/filé)', cat:'carnes', porcao:'1 filé (palma da mão)', kcal:130, prot:26.0 },
  { id:'atum', nome:'Atum em lata', cat:'carnes', porcao:'1 lata escorrida', kcal:100, prot:22.0 },
  { id:'camarao', nome:'Camarão refogado', cat:'carnes', porcao:'1 punho fechado', kcal:99, prot:20.0 },
  { id:'linguica', nome:'Linguiça / salsicha', cat:'carnes', tamanhos:[
      {label:'1 gito', kcal:150, prot:6.0},
      {label:'2 gitos', kcal:300, prot:12.0},
  ]},
  { id:'bacon', nome:'Bacon / torresmo', cat:'carnes', tamanhos:[
      {label:'2 fatias', kcal:75, prot:4.0},
      {label:'4 fatias', kcal:150, prot:8.0},
  ]},

  // ---- FEIJÕES E LEGUMINOSAS ----
  { id:'feijao', nome:'Feijão cozido (com caldo)', cat:'leg', porcao:'1 concha (punho fechado)', kcal:76, prot:4.8 },
  { id:'lentilha', nome:'Lentilha cozida', cat:'leg', porcao:'1 punho fechado', kcal:93, prot:6.3 },
  { id:'grao-bico', nome:'Grão de bico cozido', cat:'leg', porcao:'1 punho fechado', kcal:121, prot:7.0 },

  // ---- VEGETAIS E LEGUMES ----
  { id:'salada-verde', nome:'Salada verde (alface/rúcula)', cat:'veg', porcao:'1 punho fechado', kcal:8, prot:0.5 },
  { id:'tomate', nome:'Tomate', cat:'veg', porcao:'1 unidade média', kcal:18, prot:0.9 },
  { id:'cenoura', nome:'Cenoura crua ou cozida', cat:'veg', porcao:'1 punho fechado', kcal:27, prot:0.6 },
  { id:'brocolis', nome:'Brócolis cozido', cat:'veg', porcao:'1 punho fechado', kcal:22, prot:2.0 },
  { id:'legumes', nome:'Legumes refogados (mix)', cat:'veg', porcao:'1 punho fechado', kcal:40, prot:1.5 },

  // ---- FRUTAS ----
  { id:'banana', nome:'Banana', cat:'frutas', porcao:'1 unidade', kcal:92, prot:1.4 },
  { id:'maca', nome:'Maçã', cat:'frutas', porcao:'1 unidade', kcal:68, prot:0.3 },
  { id:'laranja', nome:'Laranja', cat:'frutas', porcao:'1 unidade', kcal:71, prot:1.4 },
  { id:'mamao', nome:'Mamão', cat:'frutas', porcao:'1 punho fechado', kcal:68, prot:1.0 },
  { id:'uva', nome:'Uva', cat:'frutas', porcao:'1 punho fechado', kcal:69, prot:0.7 },
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

  // ---- BEBIDAS ----
  { id:'suco', nome:'Suco natural', cat:'bebida', porcao:'1 copo (200ml)', kcal:90, prot:0.5 },
  { id:'refri', nome:'Refrigerante', cat:'bebida', porcao:'1 copo (200ml)', kcal:85, prot:0 },
  { id:'cafe-puro', nome:'Café puro (sem leite, sem açúcar)', cat:'bebida', porcao:'1 xícara (150ml)', kcal:2, prot:0.2 },
  { id:'cafe', nome:'Café com leite e açúcar', cat:'bebida', porcao:'1 xícara (150ml)', kcal:60, prot:2.0 },
  { id:'cerveja', nome:'Cerveja', cat:'bebida', porcao:'1 lata (350ml)', kcal:150, prot:1.6 },
  { id:'whey', nome:'Whey protein', cat:'bebida', porcao:'1 dose (30g)', kcal:120, prot:24.0 },
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
