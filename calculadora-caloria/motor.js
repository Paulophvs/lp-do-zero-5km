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
  ocupacao:null, domestico:null, domesticoFreq:null,
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
  // "fora da rotina": alcool e comida de fim de semana/dia livre, calculados
  // por MEDIA SEMANAL (freq x total do bucket / 7), somados ao consumo diario
  // normal. Ficam em objetos separados de estado.itens de proposito, pra nao
  // entrar duas vezes na soma das refeicoes normais (ver calcularConsumoTotal).
  foraRotina:{ alcoolOn:false, alcoolFreq:0, extraFreq:0 },
  itensAlcool:{},
  itensExtra:{},
  contextoBusca:'refeicao', // 'refeicao' | 'alcool' | 'extra'
  buscaQuery:'',
  tamanhoAberto:null,
  cintura:null,
};

const DOM_BUSCA = {
  refeicao:{input:'input-busca', sugestoes:'sugestoes-busca', itens:'itens-refeicao'},
  alcool:{input:'input-busca-alcool', sugestoes:'sugestoes-busca-alcool', itens:'itens-alcool'},
  extra:{input:'input-busca-extra', sugestoes:'sugestoes-busca-extra', itens:'itens-extra'},
};
function bucketAtivo(){
  if(estado.contextoBusca==='alcool') return 'alcool';
  if(estado.contextoBusca==='extra') return 'extra';
  return estado.refeicaoAtiva;
}
function getItensBucket(bucket){
  if(bucket==='alcool') return estado.itensAlcool;
  if(bucket==='extra') return estado.itensExtra;
  if(!estado.itens[bucket]) estado.itens[bucket]={};
  return estado.itens[bucket];
}

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
function atualizarDomesticoFreq(v){
  estado.domesticoFreq = parseInt(v,10) || 0;
}
function validarOcupacao(){
  const erro = document.getElementById('erro-ocupacao');
  if(!estado.ocupacao || !estado.domestico){ erro.textContent='Escolhe as duas opções pra continuar.'; return; }
  const freqEl = document.getElementById('input-domestico-freq');
  const freq = parseInt(freqEl.value,10);
  if(isNaN(freq) || freq<0 || freq>7){ erro.textContent='Quantos dias por semana? (0 a 7)'; return; }
  estado.domesticoFreq = freq;
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
  irParaForaRotina();
}

// ---------- TELA: fora da rotina (álcool + comida de fim de semana) ----------
function irParaForaRotina(){
  estado.contextoBusca='alcool'; estado.buscaQuery=''; estado.tamanhoAberto=null;
  renderSugestoes(); renderItensRefeicao(); renderTotaisForaRotina('alcool');
  estado.contextoBusca='extra'; estado.buscaQuery=''; estado.tamanhoAberto=null;
  renderSugestoes(); renderItensRefeicao(); renderTotaisForaRotina('extra');
  estado.contextoBusca='alcool';
  irPara('tela-fora-rotina');
}
function toggleAlcool(on, el){
  estado.foraRotina.alcoolOn = on;
  marcarOpcao(document.getElementById('opcoes-alcool'), el, 'opcao');
  document.getElementById('bloco-alcool-detalhe').style.display = on ? '' : 'none';
}
function atualizarFreqAlcool(v){ estado.foraRotina.alcoolFreq = parseFloat(v)||0; }
function atualizarFreqExtra(v){ estado.foraRotina.extraFreq = parseFloat(v)||0; }
function onBuscaAlcoolInput(v){ estado.contextoBusca='alcool'; onBuscaInput(v); }
function onBuscaExtraInput(v){ estado.contextoBusca='extra'; onBuscaInput(v); }
function continuarForaRotina(){
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
  estado.contextoBusca='refeicao';
  estado.refeicaoAtiva = 1;
  estado.buscaQuery=''; estado.tamanhoAberto=null;
  for(let i=1;i<=estado.numRefeicoes;i++){ if(!estado.itens[i]) estado.itens[i]={}; }
  renderRefeicaoTabs();
  renderSugestoes();
  renderItensRefeicao();
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
    btn.onclick=()=>{
      estado.refeicaoAtiva=i;
      estado.buscaQuery=''; estado.tamanhoAberto=null;
      const input = document.getElementById('input-busca');
      if(input) input.value='';
      renderRefeicaoTabs(); renderSugestoes(); renderItensRefeicao();
    };
    box.appendChild(btn);
  }
}

// ---------- anamnese: busca de alimento por nome/categoria ----------
function normalizarTexto(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function buscarAlimentos(query, soAlcoolica){
  const q = normalizarTexto(query.trim());
  if(!q) return [];
  // nome do item bate primeiro (score 2), categoria só desempata (score 1).
  // sem isso, categoria "Arroz, macarrão, pães e raízes" faz busca por "arroz"
  // trazer pão/tapioca/aveia antes do arroz de verdade, porque a palavra
  // "arroz" está no NOME da categoria inteira, não só no item certo.
  const base = soAlcoolica ? ALIMENTOS.filter(a=>a.alcoolica) : ALIMENTOS;
  const pontuados = base.map(a=>{
    const nome = normalizarTexto(a.nome);
    const catNome = normalizarTexto((CATEGORIAS.find(c=>c.id===a.cat)||{}).nome||'');
    let score = 0;
    if(nome.indexOf(q)>-1) score = 2;
    else if(catNome.indexOf(q)>-1) score = 1;
    return {a, score};
  }).filter(p=>p.score>0);
  pontuados.sort((x,y)=>y.score-x.score);
  return pontuados.slice(0,8).map(p=>p.a);
}
function chaveAlimento(id, idxTamanho){ return idxTamanho===undefined ? id : id+'#'+idxTamanho; }
function getQtd(bucket, chave){ const b=getItensBucket(bucket); return b[chave]||0; }
// bucket é passado EXPLÍCITO (não lido de estado.contextoBusca no momento do
// clique) porque na tela "fora da rotina" as listas de álcool e de comida
// extra ficam as DUAS visíveis ao mesmo tempo; se o botão +/- de uma lista
// dependesse do contexto global, clicar numa lista depois de ter digitado
// na busca da outra alteraria o bucket errado.
function setQtd(bucket, chave, val){
  const b = getItensBucket(bucket);
  b[chave] = Math.max(0, val);
  renderItensRefeicao(bucket);
  if(bucket==='alcool') renderTotaisForaRotina('alcool');
  else if(bucket==='extra') renderTotaisForaRotina('extra');
  else { renderResumoFixo(); renderRefeicaoTabs(); }
}

function onBuscaInput(valor){
  estado.buscaQuery = valor;
  estado.tamanhoAberto = null;
  renderSugestoes();
}

function renderSugestoes(){
  const ids = DOM_BUSCA[estado.contextoBusca];
  const box = document.getElementById(ids.sugestoes);
  if(!box) return;
  box.innerHTML='';
  if(estado.tamanhoAberto){
    renderSeletorTamanho(box);
    return;
  }
  const soAlcoolica = estado.contextoBusca==='alcool';
  const resultados = buscarAlimentos(estado.buscaQuery, soAlcoolica);
  if(!resultados.length){
    if(estado.buscaQuery.trim()) box.innerHTML='<p class="sem-resultado">Nenhum alimento encontrado'+(soAlcoolica?'.':'. Procura "Outro alimento" da categoria mais parecida (ex: digita "outro").')+'</p>';
    return;
  }
  resultados.forEach(a=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='sugestao-item';
    btn.innerHTML='<span>'+a.nome+'</span><span class="sugestao-porcao">'+(a.tamanhos? 'escolher porção' : a.porcao)+'</span>';
    btn.onclick=()=>selecionarAlimento(a.id);
    box.appendChild(btn);
  });
}

function selecionarAlimento(id){
  const a = ALIMENTOS.find(x=>x.id===id);
  if(!a) return;
  if(a.tamanhos){
    estado.tamanhoAberto = id;
    renderSugestoes();
    return;
  }
  const bucket = bucketAtivo();
  setQtd(bucket, a.id, getQtd(bucket, a.id)+1);
  limparBusca();
}

function renderSeletorTamanho(box){
  const a = ALIMENTOS.find(x=>x.id===estado.tamanhoAberto);
  if(!a) return;
  const wrap = document.createElement('div');
  wrap.className='seletor-tamanho';
  const titulo = document.createElement('p');
  titulo.className='seletor-tamanho-titulo';
  titulo.textContent = a.nome+' — escolhe a porção:';
  wrap.appendChild(titulo);
  a.tamanhos.forEach((t, idx)=>{
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='sugestao-item';
    btn.innerHTML='<span>'+t.label+'</span><span class="sugestao-porcao">'+t.kcal+' kcal, '+t.prot+'g prot</span>';
    btn.onclick=()=>{
      const chave = chaveAlimento(a.id, idx);
      const bucket = bucketAtivo();
      setQtd(bucket, chave, getQtd(bucket, chave)+1);
      limparBusca();
    };
    wrap.appendChild(btn);
  });
  const cancelar = document.createElement('button');
  cancelar.type='button';
  cancelar.className='voltar-tamanho';
  cancelar.textContent='Voltar pra busca';
  cancelar.onclick=()=>{ estado.tamanhoAberto=null; renderSugestoes(); };
  wrap.appendChild(cancelar);
  box.appendChild(wrap);
}

function limparBusca(){
  estado.buscaQuery=''; estado.tamanhoAberto=null;
  const ids = DOM_BUSCA[estado.contextoBusca];
  const input = document.getElementById(ids.input);
  if(input) input.value='';
  renderSugestoes();
}

/* Plural das unidades de medida caseira, pra mostrar "2 punhos fechados"
   em vez de só o número. Cobre as frases distintas usadas em "porcao" na
   base de alimentos; o que não estiver aqui cai no fallback (+"s"). */
const PLURAL_UNIDADE = {
  'unidade':'unidades', 'unidade média':'unidades médias', 'unidade pequena':'unidades pequenas',
  'fatia':'fatias', 'fatia fina':'fatias finas', 'fatia de bolo':'fatias de bolo',
  'punho fechado':'punhos fechados', 'punho fechado (fatia)':'punhos fechados (fatias)',
  'filé (palma da mão)':'filés (palma da mão)',
  'bife (palma da mão)':'bifes (palma da mão)',
  'porção (palma da mão)':'porções (palma da mão)',
  'concha (punho fechado)':'conchas (punho fechado)',
  'copo (200ml)':'copos (200ml)',
  'xícara (150ml)':'xícaras (150ml)',
  'lata escorrida':'latas escorridas', 'lata (350ml)':'latas (350ml)',
  'dose (30g)':'doses (30g)',
};
function unidadeBase(porcaoStr){
  const m = porcaoStr.match(/^\d+\s*(.*)$/);
  return m ? m[1] : porcaoStr;
}
function formatQtdComUnidade(porcaoStr, qtd){
  const singular = unidadeBase(porcaoStr);
  const plural = PLURAL_UNIDADE[singular] || (singular+'s');
  const inteiro = Math.floor(qtd);
  const temMeio = Math.abs(qtd - inteiro - 0.5) < 0.001;
  if(qtd===0.5) return 'meio '+singular;
  if(temMeio) return inteiro+' e meio '+singular;
  if(inteiro===1) return '1 '+singular;
  return inteiro+' '+plural;
}

function domContextoDoBucket(bucket){
  if(bucket==='alcool') return 'alcool';
  if(bucket==='extra') return 'extra';
  return 'refeicao';
}
function renderItensRefeicao(bucket){
  if(bucket===undefined) bucket = bucketAtivo();
  const domCtx = domContextoDoBucket(bucket);
  const ids = DOM_BUSCA[domCtx];
  const box = document.getElementById(ids.itens);
  if(!box) return;
  box.innerHTML='';
  const refeicao = getItensBucket(bucket);
  // reverte a ordem de insercao: item adicionado por ultimo aparece no TOPO
  // da lista, porque a pessoa adiciona um item, ajusta a porcao, e ja parte
  // pro proximo — se o mais recente ficar no topo ela nao precisa procurar.
  const chaves = Object.keys(refeicao).filter(c=>refeicao[c]>0).reverse();
  if(!chaves.length){
    box.innerHTML='<p class="sem-item">'+(domCtx==='refeicao'?'Nenhum alimento adicionado nessa refeição ainda.':'Nada adicionado ainda.')+' Usa a busca acima.</p>';
    return;
  }
  chaves.forEach(chave=>{
    const info = resolverAlimento(chave); if(!info) return;
    const partes = chave.split('#');
    const alimento = ALIMENTOS.find(a=>a.id===partes[0]); if(!alimento) return;
    const ehTamanho = partes.length>1;
    const qtd = refeicao[chave];
    const label = ehTamanho ? alimento.nome+' ('+alimento.tamanhos[parseInt(partes[1],10)].label+')' : alimento.nome;
    const valTexto = ehTamanho ? String(qtd)+'x' : formatQtdComUnidade(alimento.porcao, qtd);
    const passo = ehTamanho ? 1 : 0.5;
    const row = document.createElement('div');
    row.className='alimento';
    row.innerHTML='<div class="alimento-nome">'+label+'<span class="alimento-porcao">'+Math.round(info.kcal*qtd)+' kcal, '+(info.prot*qtd).toFixed(1)+'g prot</span></div>'+
      '<span class="stepper"><button type="button">-</button><span class="qtd-val">'+valTexto+'</span><button type="button">+</button></span>';
    const btns = row.querySelectorAll('button');
    btns[0].onclick=()=>setQtd(bucket, chave, qtd-passo);
    btns[1].onclick=()=>setQtd(bucket, chave, qtd+passo);
    box.appendChild(row);
  });
}

function totaisBucket(bucket){
  let kcal=0, prot=0;
  const itens = getItensBucket(bucket);
  Object.keys(itens).forEach(chave=>{
    const qtd = itens[chave]; if(!qtd) return;
    const info = resolverAlimento(chave); if(!info) return;
    kcal += info.kcal*qtd; prot += info.prot*qtd;
  });
  return {kcal,prot};
}
function totaisRefeicaoAtiva(){ return totaisBucket(estado.refeicaoAtiva); }
function renderTotaisForaRotina(bucket){
  const t = totaisBucket(bucket);
  const el = document.getElementById('totais-'+bucket);
  if(el) el.innerHTML = 'Nessa lista: <b>'+Math.round(t.kcal)+' kcal</b> · <b>'+t.prot.toFixed(1)+'g proteína</b> (valor de 1 vez, a média semanal entra automático no resultado final)';
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
// Valor abaixo é o ajuste de um DIA CHEIO de tarefa doméstica naquela
// intensidade; como nem todo mundo faz tarefa doméstica todo dia (ex:
// faxina pesada 1x/semana), a média diária real é (ajuste_cheio x
// dias_por_semana)/7, mesmo método de média semanal já usado no treino
// estruturado e na seção "fora da rotina".
const AJUSTE_DOMESTICO = {pouca:0.03, moderada:0.07, puxada:0.12};

function calcularPAL(){
  const ajusteCheio = AJUSTE_DOMESTICO[estado.domestico] || 0;
  const freq = estado.domesticoFreq || 0;
  const ajusteMedio = (ajusteCheio * freq) / 7;
  return PAL_OCUPACAO[estado.sexo][estado.ocupacao] + ajusteMedio;
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
  const fora = calcularForaRotina();
  kcal += fora.kcal; prot += fora.prot;
  return {kcal,prot};
}

// "Fora da rotina" (álcool + comida de fim de semana/dia livre): a pessoa
// monta a lista do que costuma consumir numa ocasião típica, e informa a
// frequência por semana; o total do bucket é multiplicado pela frequência
// e dividido por 7 pra virar média diária, mesmo método já usado no gasto
// de treino estruturado (ver calcularGastoTreinoDiario).
function calcularForaRotina(){
  const freqAlcool = estado.foraRotina.alcoolOn ? (estado.foraRotina.alcoolFreq||0) : 0;
  const freqExtra = estado.foraRotina.extraFreq||0;
  const alc = totaisBucket('alcool');
  const ext = totaisBucket('extra');
  return {
    kcal: (alc.kcal*freqAlcool + ext.kcal*freqExtra)/7,
    prot: (alc.prot*freqAlcool + ext.prot*freqExtra)/7,
  };
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

// ---------- composição corporal (RFM, opcional) ----------
// RFM (Relative Fat Mass), Woolcott & Bergman 2018: mais recente e mais
// validada que o BAI (Body Adiposity Index, Bergman 2011, quadril+altura,
// hoje considerado defasado). Altura e cintura na mesma unidade (cm).
function calcularRFM(sexo, altura, cintura){
  const base = sexo==='homem' ? 64 : 76;
  return base - 20*(altura/cintura);
}

// Tabela de referência do American Council on Exercise (ACE). Faixa de
// obesidade é aberta pra cima (25%+ homem, 32%+ mulher), por isso o "max"
// usa Infinity só pra lógica de destaque, o texto mostrado é "X%+".
const TABELA_ACE = [
  {nome:'Gordura essencial', min:{homem:2,  mulher:10}, max:{homem:5,  mulher:13}},
  {nome:'Atletas',           min:{homem:6,  mulher:14}, max:{homem:13, mulher:20}},
  {nome:'Boa forma',         min:{homem:14, mulher:21}, max:{homem:17, mulher:24}},
  {nome:'Aceitável',         min:{homem:18, mulher:25}, max:{homem:24, mulher:31}},
  {nome:'Obesidade',         min:{homem:25, mulher:32}, max:{homem:Infinity, mulher:Infinity}},
];

function abrirFormRFM(){
  document.getElementById('rfm-convite').style.display='none';
  document.getElementById('rfm-form').style.display='block';
}

function renderTabelaRFM(percentual){
  const sexo = estado.sexo;
  const box = document.getElementById('tabela-rfm');
  let html = '<table class="tabela-rfm-tb"><thead><tr><th>Categoria</th><th>Faixa de referência</th></tr></thead><tbody>';
  TABELA_ACE.forEach(row=>{
    const min = row.min[sexo], max = row.max[sexo];
    const destaque = percentual>=min && percentual<=max;
    const faixaTxt = max===Infinity ? min+'%+' : min+'% a '+max+'%';
    html += '<tr'+(destaque?' class="linha-destaque"':'')+'><td>'+row.nome+'</td><td>'+faixaTxt+'</td></tr>';
  });
  html += '</tbody></table>';
  box.innerHTML = html;
}

function calcularRFMevento(){
  const cintura = parseFloat(document.getElementById('cintura').value);
  const erro = document.getElementById('erro-rfm');
  if(!cintura || cintura<40 || cintura>200){ erro.textContent='Circunferência de cintura inválida.'; return; }
  erro.textContent='';
  estado.cintura = cintura;

  const rfm = calcularRFM(estado.sexo, estado.altura, cintura);
  document.getElementById('r-rfm').textContent = rfm.toFixed(1).replace('.', ',');
  renderTabelaRFM(rfm);

  document.getElementById('rfm-form').style.display='none';
  document.getElementById('rfm-resultado').style.display='block';
}

function recomecar(){
  location.reload();
}
