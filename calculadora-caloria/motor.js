/* Motor de cálculo da Calculadora de Caloria e Proteína.
   3 blocos, sem veredito nenhum (nunca comparar e dizer "bom/pouco/muito"):
   1) TDEE por método fatorial: TMB (Mifflin-St Jeor) x PAL ocupacional
      (FAO/WHO/UNU 2001, "Human Energy Requirements") + gasto de treino
      estruturado via MET (Compendium of Physical Activities, atualização 2024).
   2) Consumo calórico/proteico via anamnese em medida de mão (base TACO/USDA).
   3) Faixa de referência de proteína do ACSM (1,2 a 2,0 g/kg), só exibida
      ao lado do total consumido, nunca comparada com veredito.
   Ver pesquisa-nutricao-esportiva-calculadora.md na raiz do repo (workspace)
   pra fontes e limitações documentadas. */

const estado = {
  sexo:null, idade:null, altura:null, peso:null,
  ocupacao:null, domestico:null,
  atividades:{
    corrida:{on:false, intensidade:'moderada', freq:0, duracao:0},
    musculacao:{on:false, intensidade:'moderada', freq:0, duracao:0},
    natacao:{on:false, intensidade:'moderada', freq:0, duracao:0},
    futebol:{on:false, intensidade:'casual', freq:0, duracao:0},
    crossfit:{on:false, intensidade:'padrao', freq:0, duracao:0},
    outro:{on:false, intensidade:'padrao', freq:0, duracao:0},
  },
  numRefeicoes:3,
  refeicaoAtiva:1,
  itens:{},
  categoriasAbertas:new Set(),
};

function irPara(id){
  document.querySelectorAll('.tela').forEach(t=>t.classList.remove('ativa'));
  document.getElementById(id).classList.add('ativa');
  window.scrollTo(0,0);
}

function marcarOpcao(container, el, classe){
  container.querySelectorAll('.'+classe).forEach(o=>o.classList.remove('marcada'));
  el.classList.add('marcada');
}

// ---------- TELA: dados pessoais ----------
function escolherSexo(sexo, el){
  estado.sexo = sexo;
  marcarOpcao(document.getElementById('opcoes-sexo'), el, 'opcao');
}
function validarDados(){
  const idade = parseInt(document.getElementById('idade').value, 10);
  const altura = parseInt(document.getElementById('altura').value, 10);
  const peso = parseFloat(document.getElementById('peso').value);
  const erro = document.getElementById('erro-dados');
  if(!estado.sexo){ erro.textContent='Escolhe uma opção de sexo biológico (é só pra fórmula de gasto calórico).'; return; }
  if(!idade || idade<10 || idade>99){ erro.textContent='Idade inválida.'; return; }
  if(!altura || altura<120 || altura>230){ erro.textContent='Altura inválida.'; return; }
  if(!peso || peso<30 || peso>250){ erro.textContent='Peso inválido.'; return; }
  erro.textContent='';
  estado.idade=idade; estado.altura=altura; estado.peso=peso;
  irPara('tela-ocupacao');
}

// ---------- TELA: ocupação ----------
function escolherOcupacao(v, el){
  estado.ocupacao=v;
  marcarOpcao(document.getElementById('opcoes-ocupacao'), el, 'opcao');
}
function escolherDomestico(v, el){
  estado.domestico=v;
  marcarOpcao(document.getElementById('opcoes-domestico'), el, 'opcao');
}
function validarOcupacao(){
  const erro = document.getElementById('erro-ocupacao');
  if(!estado.ocupacao || !estado.domestico){ erro.textContent='Escolhe as duas opções pra continuar.'; return; }
  erro.textContent='';
  irPara('tela-atividades');
}

// ---------- TELA: atividades estruturadas ----------
const NOMES_ATIVIDADE = {
  corrida:'Corrida', musculacao:'Musculação', natacao:'Natação',
  futebol:'Futebol', crossfit:'Crossfit / treino funcional', outro:'Outro esporte',
};
function toggleAtividade(nome){
  const a = estado.atividades[nome];
  a.on = !a.on;
  document.getElementById('ativ-'+nome).classList.toggle('on', a.on);
}
function atualizarAtividade(nome, campo, valor){
  estado.atividades[nome][campo] = campo==='intensidade' ? valor : (parseFloat(valor)||0);
}
function continuarAtividades(){
  irPara('tela-refeicoes-num');
}

// ---------- TELA: número de refeições ----------
function escolherNumRefeicoes(n, el){
  estado.numRefeicoes = n;
  document.querySelectorAll('#opcoes-refeicoes .num-btn').forEach(b=>b.classList.remove('marcada'));
  el.classList.add('marcada');
}
function irParaAnamnese(){
  if(!estado.numRefeicoes){ document.getElementById('erro-refeicoes').textContent='Escolhe quantas refeições.'; return; }
  document.getElementById('erro-refeicoes').textContent='';
  estado.refeicaoAtiva = 1;
  for(let i=1;i<=estado.numRefeicoes;i++){ if(!estado.itens[i]) estado.itens[i]={}; }
  renderRefeicaoTabs();
  renderAlimentos();
  renderResumoFixo();
  irPara('tela-anamnese');
}

// ---------- anamnese: abas de refeição ----------
function renderRefeicaoTabs(){
  const box = document.getElementById('refeicoes-tabs');
  box.innerHTML='';
  for(let i=1;i<=estado.numRefeicoes;i++){
    const qtdItens = Object.values(estado.itens[i]||{}).filter(q=>q>0).length;
    const btn = document.createElement('button');
    btn.className='refeicao-tab'+(estado.refeicaoAtiva===i?' ativa':'');
    btn.innerHTML='Refeição '+i+(qtdItens>0?'<span class="qtd">'+qtdItens+'</span>':'');
    btn.onclick=()=>{ estado.refeicaoAtiva=i; renderRefeicaoTabs(); renderAlimentos(); };
    box.appendChild(btn);
  }
}

// ---------- anamnese: lista de alimentos por categoria ----------
function toggleCategoria(catId){
  if(estado.categoriasAbertas.has(catId)) estado.categoriasAbertas.delete(catId);
  else estado.categoriasAbertas.add(catId);
  renderAlimentos();
}
function chaveAlimento(id, idxTamanho){ return idxTamanho===undefined ? id : id+'#'+idxTamanho; }
function getQtd(chave){ return (estado.itens[estado.refeicaoAtiva] && estado.itens[estado.refeicaoAtiva][chave]) || 0; }
function setQtd(chave, val){
  if(!estado.itens[estado.refeicaoAtiva]) estado.itens[estado.refeicaoAtiva]={};
  estado.itens[estado.refeicaoAtiva][chave] = Math.max(0, val);
  renderAlimentos();
  renderResumoFixo();
  renderRefeicaoTabs();
}

function renderAlimentos(){
  const box = document.getElementById('lista-categorias');
  box.innerHTML='';
  CATEGORIAS.forEach(cat=>{
    const itensCat = ALIMENTOS.filter(a=>a.cat===cat.id);
    const aberta = estado.categoriasAbertas.has(cat.id);
    const div = document.createElement('div');
    div.className='categoria'+(aberta?' aberta':'');

    const head = document.createElement('div');
    head.className='categoria-head';
    head.innerHTML='<span>'+cat.nome+'</span><span class="seta">▾</span>';
    head.onclick=()=>toggleCategoria(cat.id);
    div.appendChild(head);

    const lista = document.createElement('div');
    lista.className='categoria-lista';
    itensCat.forEach(a=>{
      const row = document.createElement('div');
      row.className='alimento';
      if(a.tamanhos){
        const wrap = document.createElement('div');
        wrap.style.width='100%';
        wrap.innerHTML='<div class="alimento-nome" style="margin-bottom:8px">'+a.nome+'</div>';
        const lista2 = document.createElement('div');
        lista2.className='tamanhos-lista';
        a.tamanhos.forEach((t, idx)=>{
          const chave = chaveAlimento(a.id, idx);
          const qtd = getQtd(chave);
          const b = document.createElement('div');
          b.className='tamanho-btn';
          b.innerHTML='<span>'+t.label+' <span style="color:var(--texto-fraco)">('+t.kcal+' kcal, '+t.prot+'g prot)</span></span>'+
            '<span class="stepper"><button type="button">-</button><span class="qtd-val">'+qtd+'</span><button type="button">+</button></span>';
          const btns = b.querySelectorAll('button');
          btns[0].onclick=()=>setQtd(chave, getQtd(chave)-1);
          btns[1].onclick=()=>setQtd(chave, getQtd(chave)+1);
          lista2.appendChild(b);
        });
        wrap.appendChild(lista2);
        row.appendChild(wrap);
      } else {
        const qtd = getQtd(a.id);
        row.innerHTML='<div class="alimento-nome">'+a.nome+'<span class="alimento-porcao">'+a.porcao+' · '+a.kcal+' kcal, '+a.prot+'g prot</span></div>'+
          '<span class="stepper"><button type="button">-</button><span class="qtd-val">'+qtd+'</span><button type="button">+</button></span>';
        const btns = row.querySelectorAll('button');
        btns[0].onclick=()=>setQtd(a.id, getQtd(a.id)-1);
        btns[1].onclick=()=>setQtd(a.id, getQtd(a.id)+1);
      }
      lista.appendChild(row);
    });
    div.appendChild(lista);
    box.appendChild(div);
  });
}

function totaisRefeicaoAtiva(){
  let kcal=0, prot=0;
  const refeicao = estado.itens[estado.refeicaoAtiva]||{};
  Object.keys(refeicao).forEach(chave=>{
    const qtd = refeicao[chave]; if(!qtd) return;
    const info = resolverAlimento(chave); if(!info) return;
    kcal += info.kcal*qtd; prot += info.prot*qtd;
  });
  return {kcal,prot};
}
function refeicoesPreenchidas(){
  let n=0;
  for(let i=1;i<=estado.numRefeicoes;i++){
    const itens = estado.itens[i]||{};
    if(Object.values(itens).some(q=>q>0)) n++;
  }
  return n;
}
function renderResumoFixo(){
  const t = totaisRefeicaoAtiva();
  document.getElementById('resumo-fixo-txt').innerHTML =
    'Refeição '+estado.refeicaoAtiva+': <b>'+Math.round(t.kcal)+' kcal</b> · <b>'+t.prot.toFixed(1)+'g proteína</b>';

  const feitas = refeicoesPreenchidas();
  const completo = feitas>=estado.numRefeicoes;
  const btn = document.getElementById('btn-ver-resultado');
  const aviso = document.getElementById('aviso-refeicoes-pendentes');
  btn.disabled = !completo;
  aviso.textContent = completo ? '' :
    'Preenche pelo menos 1 alimento em cada refeição pra liberar o resultado ('+feitas+' de '+estado.numRefeicoes+' feitas).';
}

// ---------- cálculo final ----------
function resolverAlimento(chave){
  if(chave.indexOf('#')>-1){
    const partes = chave.split('#');
    const alimento = ALIMENTOS.find(a=>a.id===partes[0]);
    if(!alimento || !alimento.tamanhos) return null;
    const t = alimento.tamanhos[parseInt(partes[1],10)];
    return t ? {kcal:t.kcal, prot:t.prot} : null;
  }
  const alimento = ALIMENTOS.find(a=>a.id===chave);
  return alimento ? {kcal:alimento.kcal, prot:alimento.prot} : null;
}

function calcularTMB(){
  const {sexo,peso,altura,idade} = estado;
  return sexo==='homem'
    ? 10*peso + 6.25*altura - 5*idade + 5
    : 10*peso + 6.25*altura - 5*idade - 161;
}

// FAO/WHO/UNU 2001 "Human Energy Requirements": faixas de PAL por
// ocupação, ponto médio de cada faixa, homem e mulher.
const PAL_OCUPACAO = {
  homem:  {sentado:1.55, pe_moderado:1.85, pesado:2.20},
  mulher: {sentado:1.50, pe_moderado:1.73, pesado:1.98},
};
// Ajuste de tarefa doméstica: estimativa própria (não é linha direta de
// tabela FAO/WHO/UNU), soma pequena ao PAL ocupacional. Documentado
// como aproximação no aviso final, não fingir precisão de tabela.
const AJUSTE_DOMESTICO = {pouca:0.03, moderada:0.07, puxada:0.12};

function calcularPAL(){
  return PAL_OCUPACAO[estado.sexo][estado.ocupacao] + AJUSTE_DOMESTICO[estado.domestico];
}

// MET do Compendium of Physical Activities (Ainsworth et al., atualização
// 2024). Corrida: jogging leve 7.0, ritmo ~6mph 9.8, mais rápido que
// 10min/milha 12.0. Musculação: esforço leve/moderado/vigoroso 3.5/5.0/6.0.
// Natação: laps moderado 7.0, vigoroso 10.0. Futebol: casual 7.0, competitivo
// 10.0. Circuit training vigoroso (proxy pra crossfit/funcional): 8.0.
// "Outro esporte" sem MET específico: aproximação de atividade moderada 6.0.
const MET = {
  corrida:{leve:7.0, moderada:9.8, forte:12.0},
  musculacao:{leve:3.5, moderada:5.0, forte:6.0},
  natacao:{moderada:7.0, forte:10.0},
  futebol:{casual:7.0, competitivo:10.0},
  crossfit:{padrao:8.0},
  outro:{padrao:6.0},
};

function calcularGastoTreinoDiario(){
  let semanal = 0;
  Object.keys(estado.atividades).forEach(nome=>{
    const a = estado.atividades[nome];
    if(!a.on || !a.freq || !a.duracao) return;
    const met = MET[nome][a.intensidade] || MET[nome].padrao;
    const kcalSessao = met * estado.peso * (a.duracao/60) * 1.05;
    semanal += kcalSessao * a.freq;
  });
  return semanal/7;
}

function calcularTDEE(){ return calcularTMB()*calcularPAL() + calcularGastoTreinoDiario(); }

function calcularConsumoTotal(){
  let kcal=0, prot=0;
  Object.values(estado.itens).forEach(refeicao=>{
    Object.keys(refeicao).forEach(chave=>{
      const qtd = refeicao[chave]; if(!qtd) return;
      const info = resolverAlimento(chave); if(!info) return;
      kcal += info.kcal*qtd; prot += info.prot*qtd;
    });
  });
  return {kcal,prot};
}

function verResultado(){
  const tdee = calcularTDEE();
  const consumo = calcularConsumoTotal();
  const faixaMin = estado.peso*1.2, faixaMax = estado.peso*2.0;

  document.getElementById('r-tdee').textContent = Math.round(tdee).toLocaleString('pt-BR');
  document.getElementById('r-consumo').textContent = Math.round(consumo.kcal).toLocaleString('pt-BR');
  document.getElementById('r-proteina').textContent = consumo.prot.toFixed(0);
  document.getElementById('r-faixa').textContent = Math.round(faixaMin)+'g a '+Math.round(faixaMax)+'g';

  irPara('tela-resultado');
}

function recomecar(){
  location.reload();
}
