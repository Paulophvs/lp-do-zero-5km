/* ============================================================
   PACE BAIXO - GERADOR DE PDF (planilha de treino, aba P3)
   Roda igual no navegador e no Node. Reproduz a grade da
   planilha do Paulo: logo + "X KM" + 4 semanas x 6 dias.
   Motor identico ao do index.html (validado contra os .xlsx).
   Precisa de jsPDF 2.5.x + jspdf-autotable.
   ============================================================ */
(function (root) {
  'use strict';

  var MODALIDADES = {
    5:  { boost: 0.170, pctCompeticao: 0.88 },
    10: { boost: 0.165, pctCompeticao: 0.87 }
  };

  /* pct de recuperacao (coluna DESC) dos dias intervalados (01 e 04).
     Igual nas duas modalidades. Extraido do cellmap (P2). */
  var PCT_DESC = {
    1: { '01': 0.65, '04': 0.65 },
    2: { '01': 0.60, '04': 0.60 },
    3: { '01': 0.65, '04': 0.60 },
    4: { '01': 0.65 }
  };

  /* Parametros dos 4 treinos de cada semana, por modalidade (aba P2).
     Dias 02 e 05 = descanso; na semana 4 o dia 04 tambem, e o 06 e a prova. */
  var PLANO = {"5": [[{"dia": "01", "tipo": "intervalado", "min": 24, "pctForte": 0.91, "durForte": "2min", "durLeve": "2min"}, {"dia": "03", "tipo": "distancia", "km": 7, "pctA": 0.8, "pctB": 0.9}, {"dia": "04", "tipo": "intervalado", "min": 28, "pctForte": 0.93, "durForte": "1min", "durLeve": "3min"}, {"dia": "06", "tipo": "distancia", "km": 5, "pctA": 0.82, "pctB": 0.87}], [{"dia": "01", "tipo": "intervalado", "min": 32, "pctForte": 0.96, "durForte": "4min", "durLeve": "4min"}, {"dia": "03", "tipo": "distancia", "km": 5, "pctA": 0.84, "pctB": 0.94}, {"dia": "04", "tipo": "intervalado", "min": 30, "pctForte": 1.03, "durForte": "2min", "durLeve": "3min"}, {"dia": "06", "tipo": "distancia", "km": 8, "pctA": 0.83, "pctB": 0.83}], [{"dia": "01", "tipo": "intervalado", "min": 27, "pctForte": 1.07, "durForte": "1min", "durLeve": "2min"}, {"dia": "03", "tipo": "distancia", "km": 3, "pctA": 0.88, "pctB": 0.98}, {"dia": "04", "tipo": "intervalado", "min": 36, "pctForte": 1.04, "durForte": "3min", "durLeve": "3min"}, {"dia": "06", "tipo": "distancia", "km": 7, "pctA": 0.86, "pctB": 0.91}], [{"dia": "01", "tipo": "intervalado", "min": 25, "pctForte": 0.95, "durForte": "2min", "durLeve": "3min"}, {"dia": "03", "tipo": "distancia", "km": 4, "pctA": 0.8, "pctB": 0.9, "leve": true}, {"dia": "04", "tipo": "descanso"}, {"dia": "06", "tipo": "competicao", "km": 5, "pctA": 0.88, "pctB": 0.93}]], "10": [[{"dia": "01", "tipo": "intervalado", "min": 27, "pctForte": 0.92, "durForte": "1min", "durLeve": "2min"}, {"dia": "03", "tipo": "distancia", "km": 8, "pctA": 0.8, "pctB": 0.9}, {"dia": "04", "tipo": "intervalado", "min": 32, "pctForte": 0.94, "durForte": "2min", "durLeve": "2min"}, {"dia": "06", "tipo": "distancia", "km": 12, "pctA": 0.82, "pctB": 0.87}], [{"dia": "01", "tipo": "intervalado", "min": 32, "pctForte": 0.96, "durForte": "4min", "durLeve": "4min"}, {"dia": "03", "tipo": "distancia", "km": 7, "pctA": 0.84, "pctB": 0.94}, {"dia": "04", "tipo": "intervalado", "min": 42, "pctForte": 1, "durForte": "3min", "durLeve": "3min"}, {"dia": "06", "tipo": "distancia", "km": 14, "pctA": 0.83, "pctB": 0.83}], [{"dia": "01", "tipo": "intervalado", "min": 35, "pctForte": 1.04, "durForte": "2min", "durLeve": "3min"}, {"dia": "03", "tipo": "distancia", "km": 5, "pctA": 0.88, "pctB": 0.98}, {"dia": "04", "tipo": "intervalado", "min": 40, "pctForte": 0.97, "durForte": "5min", "durLeve": "5min"}, {"dia": "06", "tipo": "distancia", "km": 11, "pctA": 0.86, "pctB": 0.91}], [{"dia": "01", "tipo": "intervalado", "min": 30, "pctForte": 0.95, "durForte": "2min", "durLeve": "3min"}, {"dia": "03", "tipo": "distancia", "km": 5, "pctA": 0.8, "pctB": 0.9, "leve": true}, {"dia": "04", "tipo": "descanso"}, {"dia": "06", "tipo": "competicao", "km": 10, "pctA": 0.87, "pctB": 0.97}]]};

  /* ---------------- motor (identico ao index.html) ---------------- */
  function vo2maxDoPace(paceDec, boost) {
    var kmh = 60 / paceDec;
    var vmax = kmh + kmh * boost;
    return (vmax * 3.3) + 3.8;
  }
  function kmhDoPct(pct, vo2max) {
    var vo2t = pct * (vo2max - 3.5) + 3.5;
    if (vo2t <= 27.5) return (1.8182 + 0.2266 * vo2t) - 0.3;
    return (vo2t - 3.5) / 3.3;
  }
  function paceDoKmh(kmh) {
    var tot = 60 / kmh, m = Math.floor(tot), s = Math.round((tot - m) * 60);
    if (s === 60) { m += 1; s = 0; }
    return [m, s];
  }
  function pace2(pct, vo2max) {
    var p = paceDoKmh(kmhDoPct(pct, vo2max));
    return String(p[0]).padStart(2, '0') + ':' + String(p[1]).padStart(2, '0');
  }
  function kmh1(pct, vo2max) {
    var v = kmhDoPct(pct, vo2max);
    return v.toFixed(1).replace('.', ',');
  }
  function mmss(seg) {
    var m = Math.floor(seg / 60), s = Math.round(seg % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  /* ---------------- cores (paleta da planilha) ---------------- */
  var VERDE = [0, 176, 80], BRANCO = [255, 255, 255], PRETO = [0, 0, 0];
  var COR_SEMANA = { 1: [219, 229, 241], 2: [255, 255, 0], 3: [255, 0, 0], 4: [198, 239, 206] };
  var TXT_SEMANA = { 1: PRETO, 2: PRETO, 3: BRANCO, 4: PRETO };

  var XXX = 'xxxxxxxxxxx';
  var ROTULOS = ['TEMPO TOTAL', 'DISTÂNCIA', 'VELOCIDADE km/h', 'PACE', 'ZONA/INTERVALADO'];

  /* monta os valores de um dia (5 linhas de exibicao) */
  function celulasDoDia(d, semana, vo2) {
    // retorna { tempo, dist, vel, pace, zona } cada um = array de 1 (span2) ou 2 celulas
    if (d.tipo === 'intervalado') {
      var pctDesc = (PCT_DESC[semana] && PCT_DESC[semana][d.dia]) || 0.65;
      return {
        tempo: [{ t: d.min + ' MINUTOS', span: 2 }],
        dist:  [{ t: XXX, span: 2, x: true }],
        vel:   [{ t: kmh1(pctDesc, vo2) }, { t: kmh1(d.pctForte, vo2) }],
        pace:  [{ t: 'DESC.', desc: true }, { t: pace2(d.pctForte, vo2) }],
        zona:  [{ t: d.durLeve + '.' }, { t: d.durForte + '.' }]
      };
    }
    if (d.tipo === 'distancia' || d.tipo === 'competicao') {
      return {
        tempo: [{ t: XXX, span: 2, x: true }],
        dist:  [{ t: String(d.km) }, { t: 'km' }],
        vel:   [{ t: kmh1(d.pctA, vo2) }, { t: kmh1(d.pctB, vo2) }],
        pace:  [{ t: pace2(d.pctA, vo2) }, { t: pace2(d.pctB, vo2) }],
        zona:  [{ t: 'ZONA TREINO', span: 2 }]
      };
    }
    // descanso (dia 04 da semana 4)
    return {
      tempo: [{ t: 'DESCANSO', desc: true }, { t: 'DESCANSO', desc: true }],
      dist:  [{ t: 'DESCANSO', desc: true }, { t: 'DESCANSO', desc: true }],
      vel:   [{ t: 'DESCANSO', desc: true }, { t: 'DESCANSO', desc: true }],
      pace:  [{ t: 'DESCANSO', desc: true }, { t: 'DESCANSO', desc: true }],
      zona:  [{ t: 'DESCANSO', desc: true }, { t: 'DESCANSO', desc: true }]
    };
  }
  function diaLivre() {
    var l = function () { return [{ t: 'LIVRE', livre: true }, { t: 'LIVRE', livre: true }]; };
    return { tempo: l(), dist: l(), vel: l(), pace: l(), zona: l() };
  }

  /* ordem visual dos 6 dias: 01, 02(livre), 03, 04, 05(livre), 06 */
  function diasDaSemana(semanaArr, semana, vo2) {
    var byDia = {};
    semanaArr.forEach(function (d) { byDia[d.dia] = d; });
    var ordem = ['01', '02', '03', '04', '05', '06'];
    return ordem.map(function (num) {
      if (num === '02' || num === '05') return { dia: num, livre: true, cel: diaLivre() };
      var d = byDia[num];
      return { dia: num, d: d, cel: celulasDoDia(d, semana, vo2) };
    });
  }

  /* ---------------- construcao do PDF ---------------- */
  function construir(opts) {
    var jsPDFCtor = opts.jsPDF;
    var distancia = Number(opts.distancia);
    var minutos = Number(opts.min), segundos = Number(opts.seg || 0);
    var logo = opts.logoDataUri || null;

    var mod = MODALIDADES[distancia];
    var paceDec = (minutos + segundos / 60) / distancia;
    var vo2 = vo2maxDoPace(paceDec, mod.boost);

    // previsao de prova (mesmo calculo do site)
    var pf = paceDoKmh(kmhDoPct(mod.pctCompeticao, vo2));
    var segNovo = Math.round((pf[0] + pf[1] / 60) * distancia * 60);

    var doc = new jsPDFCtor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    var pw = doc.internal.pageSize.getWidth();
    var margem = 8;

    // cabecalho: logo + "X KM"
    var topo = 10;
    if (logo) {
      try { doc.addImage(logo, 'PNG', margem, topo, 46, 20); } catch (e) {}
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(30);
    doc.text(distancia + ' KM', pw - margem, topo + 15, { align: 'right' });
    doc.setFontSize(12);
    doc.setTextColor(90, 90, 90);
    doc.text('TREINAMENTO MÊS - 1', pw - margem, topo + 22, { align: 'right' });

    // grade das 4 semanas
    var nCols = 13; // 1 rotulo + 12 (6 dias x 2)
    var startY = topo + 28;

    for (var w = 0; w < 4; w++) {
      var semana = w + 1;
      var dias = diasDaSemana(PLANO[distancia][w], semana, vo2);

      var head = [{ content: 'SEMANA ' + semana, styles: { fillColor: COR_SEMANA[semana], textColor: TXT_SEMANA[semana], fontStyle: 'bold' } }];
      dias.forEach(function (dd) {
        var rot = 'DIA ' + dd.dia + (dd.dia === '03' && semana !== 4 ? ' OP.' : '');
        head.push({ content: rot, colSpan: 2, styles: { fillColor: [235, 235, 235], textColor: PRETO, fontStyle: 'bold', halign: 'left' } });
      });

      var body = ROTULOS.map(function (rot, ri) {
        var chave = ['tempo', 'dist', 'vel', 'pace', 'zona'][ri];
        var row = [{ content: rot, styles: { fillColor: COR_SEMANA[semana], textColor: TXT_SEMANA[semana], fontStyle: 'bold', halign: 'left' } }];
        dias.forEach(function (dd) {
          dd.cel[chave].forEach(function (c) {
            var st = {};
            if (c.livre) { st.fillColor = VERDE; st.textColor = BRANCO; st.fontStyle = 'bold'; }
            else if (c.desc) { st.fillColor = VERDE; st.textColor = BRANCO; st.fontStyle = 'bold'; }
            else if (c.x) { st.textColor = [140, 140, 140]; }
            var cell = { content: c.t, styles: st };
            if (c.span === 2) cell.colSpan = 2;
            row.push(cell);
          });
        });
        return row;
      });

      doc.autoTable({
        head: [head],
        body: body,
        startY: startY,
        margin: { left: margem, right: margem },
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1, halign: 'center', valign: 'middle', lineColor: [0, 0, 0], lineWidth: 0.1, textColor: PRETO, overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 30, halign: 'left' } },
        tableWidth: pw - margem * 2,
        didParseCell: function (data) {
          // colunas de dados com largura uniforme
          if (data.column.index > 0) data.cell.styles.cellWidth = (pw - margem * 2 - 30) / 12;
        }
      });
      startY = doc.lastAutoTable.finalY + 4;
    }

    // rodape com a previsao
    doc.setFontSize(9);
    doc.setTextColor(0, 130, 60);
    doc.text('Previsão ao fim do mês 1: ' + distancia + ' km em ' + mmss(segNovo), margem, doc.internal.pageSize.getHeight() - 6);

    return doc;
  }

  var API = { construir: construir, _motor: { vo2maxDoPace: vo2maxDoPace, kmhDoPct: kmhDoPct, pace2: pace2, mmss: mmss } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PaceBaixoPDF = API;
})(typeof window !== 'undefined' ? window : globalThis);
