/* ============================================================
   PACE BAIXO - GERADOR DE PDF (planilha de treino)
   Mesmo layout de CARTOES do link (tela-plano), porem em tema
   CLARO (fundo branco) por ser melhor pra imprimir: cartoes claros,
   "SEMANA N" em laranja, frases em linguagem simples, paces em
   laranja (verde na prova). Mesma estrutura e MESMO texto do link.
   O texto vem PRONTO da pagina (frasesTreino/montarPlano), entao
   o PDF nunca diverge do que o aluno ve no link. Precisa de jsPDF.
   ============================================================ */
(function (root) {
  'use strict';

  /* paleta CLARA (impressao). Mantem o laranja da marca; o verde
     vira um tom mais escuro pra ter contraste no branco (o #00E676
     da tela some no fundo claro). */
  var COR = {
    bg:     [255, 255, 255], // fundo branco
    card:   [247, 248, 250], // cartao cinza bem claro
    linha:  [224, 227, 232], // borda do cartao
    txt:    [17, 18, 20],     // texto quase preto
    fraco:  [108, 112, 120], // texto secundario (DIA, subtitulo, descanso)
    laranja:[230, 92, 0],     // laranja da marca, levemente escurecido p/ legibilidade
    verde:  [0, 150, 72]      // verde escuro (prova/previsao) legivel no branco
  };

  /* ---------- parser de HTML inline -> runs {text,bold,cor} ----------
     Entende <b>..</b> (branco forte), <b class="pc">..</b> (pace),
     <b class="prev">..</b> (previsao, verde) e texto solto. */
  function decode(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  }
  function parseRuns(html, corBase, corPc) {
    var runs = [], re = /<b(?:\s+class="(pc|prev)")?>([\s\S]*?)<\/b>|([^<]+)/g, m;
    while ((m = re.exec(html)) !== null) {
      if (m[2] !== undefined && m[0].charAt(0) === '<') {
        var cor = COR.txt;                       // <b> simples
        if (m[1] === 'pc') cor = corPc;
        else if (m[1] === 'prev') cor = COR.verde;
        runs.push({ text: decode(m[2]), bold: true, cor: cor });
      } else if (m[3] !== undefined) {
        runs.push({ text: decode(m[3]), bold: false, cor: corBase });
      }
    }
    return runs;
  }

  function setFont(doc, bold, size) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
  }

  /* quebra os runs em palavras e monta linhas que cabem em maxW */
  function layoutRich(doc, runs, maxW, size) {
    var tokens = [];
    runs.forEach(function (r) {
      r.text.split(/(\s+)/).forEach(function (p) {
        if (p === '') return;
        if (/^\s+$/.test(p)) tokens.push({ space: true });
        else tokens.push({ text: p, bold: r.bold, cor: r.cor });
      });
    });
    var lines = [[]], x = 0, pending = false;
    var lineH = size * 0.3528 * 1.42;
    setFont(doc, false, size);
    var spaceW = doc.getTextWidth(' ');
    tokens.forEach(function (tk) {
      if (tk.space) { pending = true; return; }
      setFont(doc, tk.bold, size);
      var w = doc.getTextWidth(tk.text);
      var withSpace = pending && x > 0;
      var sw = withSpace ? spaceW : 0;
      if (x + sw + w > maxW && x > 0) { lines.push([]); x = 0; withSpace = false; sw = 0; }
      lines[lines.length - 1].push({ text: tk.text, bold: tk.bold, cor: tk.cor, space: withSpace });
      x += sw + w; pending = false;
    });
    return { lines: lines, lineH: lineH, size: size };
  }

  /* desenha as linhas ja calculadas; y0 = baseline da 1a linha */
  function drawLines(doc, lay, x0, y0) {
    setFont(doc, false, lay.size);
    var spaceW = doc.getTextWidth(' '), y = y0;
    lay.lines.forEach(function (line) {
      var x = x0;
      line.forEach(function (wd) {
        if (wd.space) x += spaceW;
        setFont(doc, wd.bold, lay.size);
        doc.setTextColor(wd.cor[0], wd.cor[1], wd.cor[2]);
        doc.text(wd.text, x, y);
        x += doc.getTextWidth(wd.text);
      });
      y += lay.lineH;
    });
    return y;
  }

  /* ---------------- construcao do PDF ---------------- */
  function construir(opts) {
    var doc = new opts.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pw = doc.internal.pageSize.getWidth();   // 210
    var ph = doc.internal.pageSize.getHeight();  // 297
    var mx = 14, maxW = pw - mx * 2, y = 20;

    function fundo() { doc.setFillColor(COR.bg[0], COR.bg[1], COR.bg[2]); doc.rect(0, 0, pw, ph, 'F'); }
    function quebra(needed) {
      if (y + needed > ph - 14) { doc.addPage(); fundo(); y = 20; return true; }
      return false;
    }
    fundo();

    /* titulo, com a logomarca grande ao lado (some sem quebrar se nao carregou) */
    var titX = mx, logoBottom = 0;
    if (opts.logo) {
      try {
        var lgH = 22, lgW = lgH * 659 / 383;   // proporcao do PNG (659x383), grande e centrada no titulo (pedido do Paulo 18/07)
        var logoTop = y - 13.5;                 // centra a logo no texto do titulo (baseline em y)
        doc.addImage(opts.logo, 'PNG', mx, logoTop, lgW, lgH);
        logoBottom = logoTop + lgH;
        titX = mx + lgW + 4;
      } catch (e) { titX = mx; }
    }
    setFont(doc, true, 20); doc.setTextColor(COR.txt[0], COR.txt[1], COR.txt[2]);
    doc.text('Sua planilha completa', titX, y);
    y = Math.max(y + 7, logoBottom + 5);   // desce o subtitulo pra baixo da logo grande

    /* subtitulo (mesma frase da tela) */
    var subHtml = opts.distancia + ' km. Seu tempo hoje: <b>' + opts.tempoHoje +
      '</b>. Previsão em 4 semanas: <b class="prev">' + opts.tempoNovo +
      '</b>. ' + (opts.subtitulo || 'São 4 treinos por semana, o resto é descanso, que faz parte do método.');
    var subLay = layoutRich(doc, parseRuns(subHtml, COR.fraco, COR.laranja), maxW, 10.5);
    y = drawLines(doc, subLay, mx, y + 3.5) + 5;

    /* aviso dos dias colados (trava mole). Vem junto pro PDF por ordem do
       Paulo 30/07: na tela ele some ao avancar, no papel a pessoa relê. */
    if (opts.observacao) {
      var obLay = layoutRich(doc, parseRuns(opts.observacao, COR.txt, COR.laranja), maxW - 12, 9.5);
      var obH = 5 + obLay.lines.length * obLay.lineH + 5;
      quebra(obH + 3);
      doc.setFillColor(255, 244, 235);
      doc.setDrawColor(COR.laranja[0], COR.laranja[1], COR.laranja[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(mx, y, maxW, obH, 3, 3, 'FD');
      drawLines(doc, obLay, mx + 6, y + 5 + obLay.size * 0.3528);
      y += obH + 5;
    }

    /* semanas */
    var utilH = (ph - 14) - 20;   // altura util de uma pagina (mesmo topo e rodape do quebra())

    (opts.semanas || []).forEach(function (s) {
      /* Ordem do Paulo 30/07: a semana nunca sai partida entre duas paginas.
         Por isso a altura do bloco inteiro (titulo + aquecimento + todos os
         cards) e medida ANTES de desenhar qualquer coisa, e a semana inteira
         desce pra proxima pagina se nao couber no que sobrou.
         Se a semana for mais alta que a pagina util ela quebra como antes,
         senao o quebra() empurraria pra sempre e o PDF nunca fecharia. */
      var aqPadTop = 5, aqPadBot = 5;
      var aqLays = null, aqCardH = 0;
      if ((s.aquecimento || []).length) {
        aqLays = s.aquecimento.map(function (h) {
          return layoutRich(doc, parseRuns(h, COR.txt, COR.laranja), maxW - 12, 9.5);
        });
        var aqBodyH = aqLays.reduce(function (a, l) { return a + l.lines.length * l.lineH; }, 0);
        aqCardH = aqPadTop + aqBodyH + aqPadBot;
      }

      var cards = (s.treinos || []).map(function (t) {
        var lay = layoutRich(doc, parseRuns(t.html, COR.txt, t.comp ? COR.verde : COR.laranja), maxW - 12, 10.5);
        var padTop = 5, diaH = 3, gap = 3.5, padBot = 5;
        return {
          t: t, lay: lay, padTop: padTop, diaH: diaH, gap: gap,
          h: padTop + diaH + gap + lay.lines.length * lay.lineH + padBot
        };
      });

      var blocoH = 5.5 + (aqLays ? aqCardH + 3 : 0) +
        cards.reduce(function (a, c) { return a + c.h + 2.5; }, 0);

      quebra(blocoH <= utilH ? blocoH : 16);

      setFont(doc, true, 11); doc.setTextColor(COR.laranja[0], COR.laranja[1], COR.laranja[2]);
      doc.text(('Semana ' + s.n).toUpperCase(), mx, y); y += 5.5;

      /* card de aquecimento (borda laranja) no topo da semana */
      if (aqLays) {
        quebra(aqCardH + 3);
        doc.setFillColor(255, 244, 235);
        doc.setDrawColor(COR.laranja[0], COR.laranja[1], COR.laranja[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(mx, y, maxW, aqCardH, 3, 3, 'FD');
        var aqY = y + aqPadTop + aqLays[0].size * 0.3528;
        aqLays.forEach(function (l) { aqY = drawLines(doc, l, mx + 6, aqY); });
        y += aqCardH + 3;
      }

      cards.forEach(function (c) {
        var t = c.t;
        var corDia = t.comp ? COR.verde : COR.fraco;
        quebra(c.h + 3);

        doc.setFillColor(COR.card[0], COR.card[1], COR.card[2]);
        doc.setDrawColor.apply(doc, t.comp ? COR.verde : COR.linha);
        doc.setLineWidth(0.3);
        doc.roundedRect(mx, y, maxW, c.h, 3, 3, 'FD');

        setFont(doc, true, 8.5); doc.setTextColor(corDia[0], corDia[1], corDia[2]);
        /* rotulo do card: o nome do dia da semana que a pessoa escolheu.
           Cai no "DIA XX" antigo se o plano vier sem os dias marcados. */
        doc.text((t.rotulo || ('DIA ' + t.dia)).toUpperCase(), mx + 6, y + c.padTop + c.diaH);
        drawLines(doc, c.lay, mx + 6, y + c.padTop + c.diaH + c.gap + c.lay.size * 0.3528);
        y += c.h + 2.5;
      });

      y += 4;
    });

    return doc;
  }

  var API = { construir: construir, _parseRuns: parseRuns };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PaceBaixoPDF = API;
})(typeof window !== 'undefined' ? window : globalThis);
