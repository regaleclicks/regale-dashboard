// ── Config ──────────────────────────────────────────────
const REFRESH_INTERVAL = 30_000;
let refreshTimer = null;
let countdown = 30;
let countdownTimer = null;
let charts = {};

// ── Chart.js defaults ──────────────────────────────────
Chart.register(ChartDataLabels);
Chart.defaults.color = '#6B7280';
Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

// ── Formatters ─────────────────────────────────────────
const BRL = v => (v == null || isNaN(v)) ? '—'
  : new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:2 }).format(v);

const BRL0 = v => (v == null || isNaN(v)) ? '—'
  : new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL', minimumFractionDigits:0, maximumFractionDigits:0 }).format(v);

const PCT = v => (v == null || isNaN(v)) ? '—'
  : ((v > 1 ? v : v * 100).toFixed(1) + '%');

const normalPct = v => v == null ? 0 : (v > 1 ? v : v * 100);

// ── DOM helper ─────────────────────────────────────────
const $ = id => document.getElementById(id);
const set = (id, val) => { const e=$(id); if(e) e.textContent = val; };

// ── Tab navigation ────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ── Status ─────────────────────────────────────────────
function setStatus(ok) {
  const dot = $('status-dot'), lbl = $('status-label');
  dot.className = 'status-dot ' + (ok ? 'ok' : 'err');
  lbl.textContent = ok ? 'Conectado' : 'Erro de conexão';
}

// ── Destroy helpers ────────────────────────────────────
function destroyChart(key) {
  if (charts[key]) { charts[key].destroy(); charts[key] = null; }
}

// ═══════════════════════════════════════════════════════
// ── CHARTS ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════

function buildPizza(canvasId, labels, values, colors, legendId) {
  destroyChart(canvasId);
  const total = values.reduce((a,b)=>a+b,0);
  const ctx = $(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }]
    },
    options: {
      cutout: '0%',
      plugins: {
        legend: { display: false },
        datalabels: {
          color: '#fff',
          font: { weight: 'bold', size: 12 },
          formatter: (val) => val > 0 ? ((val/total*100).toFixed(0)+'%') : '',
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${BRL(ctx.raw)}  (${(ctx.raw/total*100).toFixed(1)}%)`
          }
        }
      },
      animation: { duration: 800, easing: 'easeInOutQuart' }
    }
  });
  if (legendId) {
    const el = $(legendId);
    el.innerHTML = labels.map((l,i) =>
      `<div class="legend-item">
        <div class="legend-left">
          <div class="legend-dot" style="background:${colors[i]}"></div>
          <span class="legend-name">${l}</span>
        </div>
        <span><span class="legend-val">${BRL0(values[i])}</span>
          <span class="legend-pct">(${(values[i]/total*100).toFixed(0)}%)</span></span>
      </div>`
    ).join('');
  }
}

function buildCaixa(data) {
  destroyChart('chartCaixa');
  if (!data.caixa) return;
  const { meses, saldoInicial, saldoAtual, mesAtual } = data.caixa;

  const labels  = meses.map(m => m.mes.replace('/2026',''));
  const saldos  = meses.map(m => m.saldo);
  const idxAtual = meses.findIndex(m => m.atual);

  // Cores: meses passados/atual = primário, futuros = pontilhado/cinza
  const pontColors = meses.map((m, i) =>
    i <= idxAtual ? '#10B981' : 'rgba(16,185,129,.25)'
  );

  const ctx = $('chartCaixa').getContext('2d');

  // Gradiente
  const grad = ctx.createLinearGradient(0, 0, 0, 240);
  grad.addColorStop(0, 'rgba(16,185,129,.25)');
  grad.addColorStop(1, 'rgba(16,185,129,.01)');

  charts['chartCaixa'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Saldo (R$)',
        data: saldos,
        borderColor: '#10B981',
        backgroundColor: grad,
        pointBackgroundColor: pontColors,
        pointBorderColor: pontColors,
        pointRadius: meses.map((m, i) => m.atual ? 7 : 4),
        pointHoverRadius: 7,
        borderWidth: 2.5,
        fill: true,
        tension: .35,
        segment: {
          borderDash: ctx => ctx.p1DataIndex > idxAtual ? [5, 4] : undefined,
          borderColor: ctx => ctx.p1DataIndex > idxAtual ? 'rgba(16,185,129,.35)' : '#10B981',
        },
        datalabels: { display: false },
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Saldo: ${BRL(ctx.raw)}`,
            afterLabel: ctx => meses[ctx.dataIndex].atual ? '← Mês atual' : '',
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6B7280', font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#6B7280', callback: v => 'R$' + (v/1000).toFixed(1) + 'k' }
        }
      },
      animation: { duration: 900 }
    }
  });

  // KPI + labels
  set('kpi-caixa', BRL(saldoAtual));
  set('kpi-caixa-sub', mesAtual ? `saldo em ${mesAtual}` : 'saldo atual');
  set('caixa-inicial', BRL(saldoInicial));
  set('caixa-atual-label', BRL(saldoAtual));
  set('badge-caixa-mes', mesAtual || '2026');
}

function buildAlocacao(data) {
  destroyChart('chartAlocacao');
  const retirada  = data.valorRetiradaSocios ?? 0;
  const reinvest  = data.valorReinvestimento  ?? 0;
  const fluxo     = data.valorFluxoCaixa      ?? 0;
  const total     = data.lucroLiquido         ?? (retirada + reinvest + fluxo);
  const ctx = $('chartAlocacao').getContext('2d');
  charts['chartAlocacao'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Retirada Sócios', 'Reinvestimento', 'Fluxo de Caixa'],
      datasets: [{
        data: [retirada, reinvest, fluxo],
        backgroundColor: ['#7C3AED', '#06B6D4', '#F59E0B'],
        borderWidth: 0, hoverOffset: 8
      }]
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${BRL(ctx.raw)}  (${(ctx.raw/total*100).toFixed(1)}%)` }
        }
      },
      animation: { duration: 800 }
    }
  });
  set('donut-aloc-val', BRL0(total));

  // Legend
  const items = [
    { l:'Retirada Sócios', v:retirada,  c:'#7C3AED' },
    { l:'Reinvestimento',  v:reinvest,  c:'#06B6D4' },
    { l:'Fluxo de Caixa',  v:fluxo,     c:'#F59E0B' },
  ];
  $('legend-alocacao').innerHTML = items.map(i =>
    `<div class="legend-item">
      <div class="legend-left">
        <div class="legend-dot" style="background:${i.c}"></div>
        <span class="legend-name">${i.l}</span>
      </div>
      <span><span class="legend-val">${BRL0(i.v)}</span>
        <span class="legend-pct">(${total > 0 ? (i.v/total*100).toFixed(0) : 0}%)</span></span>
    </div>`
  ).join('');

  // Cards
  set('aloc-retirada',     BRL(retirada));
  set('aloc-reinvest',     BRL(reinvest));
  set('aloc-fluxo',        BRL(fluxo));
  set('aloc-pct-retirada', PCT(data.pctRetiradaSocios));
  set('aloc-pct-reinvest', PCT(data.pctReinvestimento));
  set('aloc-pct-fluxo',    PCT(data.pctFluxoCaixa));
  set('aloc-por-socio',    BRL(data.lucroPorSocio));
}

function buildDonut(data) {
  destroyChart('chartDonut');
  const lucro = data.lucroLiquido ?? 0;
  const das   = data.valorDAS ?? 0;
  const total = data.faturamentoBruto ?? 0;
  const ctx   = $('chartDonut').getContext('2d');
  charts['chartDonut'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Lucro Líquido', 'DAS'],
      datasets: [{
        data: [lucro, das],
        backgroundColor: ['#10B981','#EF4444'],
        borderWidth: 0, hoverOffset: 6
      }]
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${BRL(ctx.raw)}  (${(ctx.raw/total*100).toFixed(1)}%)` }
        }
      },
      animation: { duration: 800 }
    }
  });
  set('donut-center-val', BRL0(lucro));
  $('legend-donut').innerHTML = [
    { l:'Lucro Líquido', v:lucro, c:'#10B981' },
    { l:'DAS', v:das, c:'#EF4444' }
  ].map(i => `<div class="legend-item">
    <div class="legend-left">
      <div class="legend-dot" style="background:${i.c}"></div>
      <span class="legend-name">${i.l}</span>
    </div>
    <span class="legend-val">${BRL0(i.v)}</span>
  </div>`).join('');
}

function buildGauge(canvasId, pctVal, statusId) {
  destroyChart(canvasId);
  const pct    = normalPct(pctVal);
  const filled = pct / 100;
  const empty  = 1 - filled;
  const ctx = $(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [filled, empty],
        backgroundColor: [
          pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#EF4444',
          '#1F2937'
        ],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }]
    },
    options: {
      cutout: '72%',
      plugins: { legend:{display:false}, datalabels:{display:false}, tooltip:{enabled:false} },
      animation: { duration: 900 }
    }
  });

  const gaugePctEl  = $(canvasId.replace('chartGauge','gauge-pct').replace('chartGauge2','gauge-pct2'));
  const gaugeStEl   = $(statusId);
  if (gaugePctEl) gaugePctEl.textContent = pct.toFixed(1) + '%';
  if (gaugeStEl) {
    let cls, txt;
    if (pct >= 70) { cls='excelente'; txt='✦ Margem excelente'; }
    else if (pct >= 40) { cls='boa'; txt='◆ Margem boa'; }
    else { cls='baixa'; txt='▼ Margem baixa'; }
    gaugeStEl.className = 'gauge-status ' + cls;
    gaugeStEl.textContent = txt;
  }
}

function buildBarClientes(data) {
  destroyChart('chartBarClientes');
  const ctx = $('chartBarClientes').getContext('2d');
  charts['chartBarClientes'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Caminhoneiro Legal', 'Clínica Epimed'],
      datasets: [{
        label: 'Mensalidade (R$)',
        data: [data.caminhoneiroLegal ?? 0, data.clinicaEpimed ?? 0],
        backgroundColor: ['rgba(245,158,11,.8)', 'rgba(6,182,212,.8)'],
        borderRadius: 8, borderSkipped: false,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end', align: 'top',
          color: '#F5F7FA', font: { weight: 'bold', size: 11 },
          formatter: v => BRL0(v)
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6B7280' } },
        y: {
          grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6B7280',
            callback: v => 'R$' + (v/1000).toFixed(0) + 'k'
          }
        }
      },
      animation: { duration: 800 }
    }
  });
}

function buildWaterfall(data) {
  destroyChart('chartWaterfall');
  const fat   = data.faturamentoBruto ?? 0;
  const das   = data.valorDAS ?? 0;
  const lucro = data.lucroLiquido ?? 0;
  const ctx   = $('chartWaterfall').getContext('2d');
  charts['chartWaterfall'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Faturamento Bruto', 'DAS', 'Lucro Líquido'],
      datasets: [{
        label: 'Valor',
        data: [fat, das, lucro],
        backgroundColor: [
          'rgba(91,33,182,.85)',
          'rgba(239,68,68,.8)',
          'rgba(16,185,129,.85)'
        ],
        borderRadius: 8, borderSkipped: false,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end', align: 'top',
          color: '#F5F7FA', font: { weight: 'bold', size: 11 },
          formatter: v => BRL0(v)
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6B7280' } },
        y: {
          grid: { color: 'rgba(255,255,255,.04)' }, ticks: { color: '#6B7280',
            callback: v => 'R$' + (v/1000).toFixed(0) + 'k'
          }
        }
      },
      animation: { duration: 800 }
    }
  });
}

function buildSimulacao(data) {
  destroyChart('chartSimulacao');
  const ticketMedio = (data.totalFaturamento ?? 0) / 2;
  const dasRate     = data.aliquotaDAS ?? 0.15;
  const labels = ['Atual (2)', '3 clientes', '4 clientes', '5 clientes'];
  const fats = [0,1,2,3].map(i => (data.totalFaturamento ?? 0) + i * ticketMedio);
  const lucros = fats.map(f => f * (1 - dasRate));
  const socios = lucros.map(l => l / 3);
  const ctx = $('chartSimulacao').getContext('2d');
  charts['chartSimulacao'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Faturamento',
          data: fats,
          backgroundColor: 'rgba(91,33,182,.7)',
          borderRadius: 6, borderSkipped: false,
          yAxisID: 'y',
        },
        {
          label: 'Lucro Líquido',
          data: lucros,
          backgroundColor: 'rgba(16,185,129,.75)',
          borderRadius: 6, borderSkipped: false,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Por Sócio',
          data: socios,
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245,158,11,.15)',
          pointBackgroundColor: '#F59E0B',
          tension: .35,
          fill: false,
          yAxisID: 'y',
          datalabels: { display: false }
        }
      ]
    },
    options: {
      plugins: {
        legend: { labels: { color:'#9CA3AF', boxWidth:10, font:{size:10} } },
        datalabels: {
          anchor:'end', align:'top',
          color:'#F5F7FA', font:{weight:'bold',size:9},
          formatter: v => 'R$'+(v/1000).toFixed(1)+'k'
        }
      },
      scales: {
        x: { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#6B7280',font:{size:10}} },
        y: { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#6B7280', callback:v=>'R$'+(v/1000).toFixed(0)+'k'} }
      },
      animation: { duration: 800 }
    }
  });
}

function buildMetas(data) {
  destroyChart('chartMetas');
  const dasRate = data.aliquotaDAS ?? 0.15;
  const metas = [
    { label: 'R$10k/sócio', fat: (10000*3)/(1-dasRate) },
    { label: 'R$8k/sócio',  fat: (8000*3)/(1-dasRate) },
    { label: 'R$5k/sócio',  fat: (5000*3)/(1-dasRate) },
    { label: 'Atual',        fat: data.faturamentoBruto ?? 0 },
  ];
  const ctx = $('chartMetas').getContext('2d');
  charts['chartMetas'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: metas.map(m=>m.label),
      datasets: [{
        label: 'Faturamento necessário',
        data: metas.map(m=>m.fat),
        backgroundColor: metas.map((m,i)=> i===3 ? 'rgba(91,33,182,.85)' : 'rgba(16,185,129,.6)'),
        borderRadius: 8, borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor:'end', align:'right',
          color:'#F5F7FA', font:{weight:'bold',size:10},
          formatter: v => BRL0(v)
        }
      },
      scales: {
        x: { grid:{color:'rgba(255,255,255,.04)'}, ticks:{color:'#6B7280', callback:v=>'R$'+(v/1000).toFixed(0)+'k'} },
        y: { grid:{display:false}, ticks:{color:'#9CA3AF'} }
      },
      animation: { duration: 800 }
    }
  });
}

// ═══════════════════════════════════════════════════════
// ── RENDER ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════

function renderInsights(d) {
  const grid = $('insights-grid');
  const pct  = normalPct(d.margemLiquida);
  const conc = d.totalFaturamento > 0
    ? (Math.max(d.caminhoneiroLegal, d.clinicaEpimed) / d.totalFaturamento * 100)
    : 0;
  const ticketMedio = (d.totalFaturamento ?? 0) / 2;

  const cards = [
    {
      cls: pct >= 70 ? 'green' : pct >= 40 ? 'warn' : 'red',
      title: '📊 Análise de Margem',
      body: `Sua margem líquida atual é <strong>${pct.toFixed(1)}%</strong>. ${
        pct >= 70 ? 'Excelente eficiência! A maior parte do faturamento vira lucro.'
        : pct >= 40 ? 'Margem razoável, mas há espaço para otimização.'
        : 'Margem baixa — revise custos ou aumente preços.'
      }`
    },
    {
      cls: conc > 60 ? 'red' : conc > 40 ? 'warn' : 'green',
      title: '⚠️ Concentração de Clientes',
      body: `O maior cliente representa <strong>${conc.toFixed(0)}%</strong> do faturamento. ${
        conc > 60 ? 'Risco alto! Perder este cliente impacta severamente o resultado.'
        : conc > 40 ? 'Concentração moderada. Busque diversificar a carteira.'
        : 'Boa diversificação entre os clientes ativos.'
      }`
    },
    {
      cls: 'info',
      title: '🎯 Próximo Marco',
      body: `Para cada sócio ganhar <strong>R$ 2.000/mês</strong>, o faturamento precisa chegar em <strong>${BRL0((6000)/(1-(d.aliquotaDAS??0.15)))}</strong>. Faltam apenas <strong>${BRL0(Math.max(0,(6000/(1-(d.aliquotaDAS??0.15))) - (d.faturamentoBruto??0)))}</strong>.`
    },
    {
      cls: 'info',
      title: '📈 Ticket Médio',
      body: `Ticket médio atual: <strong>${BRL0(ticketMedio)}/cliente</strong>. Com +1 cliente no mesmo ticket, o faturamento iria para <strong>${BRL0((d.totalFaturamento??0)+ticketMedio)}</strong> e o lucro por sócio subiria para <strong>${BRL0(((d.totalFaturamento??0)+ticketMedio)*(1-(d.aliquotaDAS??0.15))/3)}</strong>.`
    },
    {
      cls: 'green',
      title: '💸 Eficiência Tributária',
      body: `Você paga <strong>${BRL(d.valorDAS)}</strong> de DAS (${PCT(d.aliquotaDAS)}) e retém <strong>${PCT(d.margemLiquida)}</strong> do faturamento. O Simples Nacional está protegendo bem a margem.`
    },
    {
      cls: (d.lucroPorSocio ?? 0) > 1500 ? 'green' : 'warn',
      title: '👥 Remuneração dos Sócios',
      body: `Cada sócio recebe <strong>${BRL(d.lucroPorSocio)}/mês</strong>. ${
        (d.lucroPorSocio??0) >= 2000 ? 'Remuneração acima de R$2k — ótimo!'
        : (d.lucroPorSocio??0) >= 1000 ? 'Remuneração em crescimento. Meta: R$2k+/sócio.'
        : 'Ainda abaixo do ideal. Foco em aquisição de clientes.'
      }`
    }
  ];

  grid.innerHTML = cards.map(c =>
    `<div class="insight-card ${c.cls}">
      <div class="insight-card-title">${c.title}</div>
      <div class="insight-card-body">${c.body}</div>
    </div>`
  ).join('');
}

function renderData(d) {
  // ── KPIs
  set('kpi-fat',     BRL(d.faturamentoBruto));
  set('kpi-das',     BRL(d.valorDAS));
  set('kpi-lucro',   BRL(d.lucroLiquido));
  set('kpi-socio',   BRL(d.lucroPorSocio));
  set('kpi-reinvest', BRL(d.valorReinvestimento));
  set('kpi-fluxo',    BRL(d.valorFluxoCaixa));
  set('kpi-aliq',  d.aliquotaDAS ? `Alíquota: ${PCT(d.aliquotaDAS)}` : 'Simples Nacional');
  set('kpi-margem-sub', d.margemLiquida ? `Margem: ${PCT(d.margemLiquida)}` : 'após impostos');
  set('kpi-reinvest-sub', d.pctReinvestimento ? `${PCT(d.pctReinvestimento)} do lucro` : 'na agência');
  set('kpi-fluxo-sub',    d.pctFluxoCaixa     ? `${PCT(d.pctFluxoCaixa)} do lucro`     : 'reserva operacional');

  // ── Sócios
  set('s-diogo',   BRL(d.lucroPorSocio));
  set('s-victor',  BRL(d.lucroPorSocio));
  set('s-henrique', BRL(d.lucroPorSocio));

  // ── Clientes tab
  set('cc-caminhoneiro', BRL(d.caminhoneiroLegal));
  set('cc-epimed',       BRL(d.clinicaEpimed));
  const total = d.totalFaturamento || 1;
  const pCam = ((d.caminhoneiroLegal||0)/total*100);
  const pEpi = ((d.clinicaEpimed||0)/total*100);
  set('pct-caminhoneiro', pCam.toFixed(0)+'%');
  set('pct-epimed',       pEpi.toFixed(0)+'%');
  const bCam = $('bar-caminhoneiro'); if(bCam) bCam.style.width = pCam+'%';
  const bEpi = $('bar-epimed');       if(bEpi) bEpi.style.width = pEpi+'%';

  // ── DRE tab
  set('dr-fat',    BRL(d.faturamentoBruto));
  set('dr-das',    '– ' + BRL(d.valorDAS));
  set('dr-lucro',  BRL(d.lucroLiquido));
  set('dr-aliq',   d.aliquotaDAS ? `${PCT(d.aliquotaDAS)} sobre faturamento` : 'alíquota sobre faturamento');
  set('dr-socio',  BRL(d.lucroPorSocio));
  set('dr-margem', PCT(d.margemLiquida));

  // ── Charts
  const colors = ['#F59E0B','#06B6D4'];
  buildPizza('chartPizza',
    ['Caminhoneiro Legal', 'Clínica Epimed'],
    [d.caminhoneiroLegal||0, d.clinicaEpimed||0],
    colors, 'legend-pizza'
  );
  buildPizza('chartPizza2',
    ['Caminhoneiro Legal', 'Clínica Epimed'],
    [d.caminhoneiroLegal||0, d.clinicaEpimed||0],
    colors, null
  );
  buildDonut(d);
  buildGauge('chartGauge',  d.margemLiquida, 'gauge-status');
  buildGauge('chartGauge2', d.margemLiquida, 'gauge-status2');
  set('gauge-pct',  PCT(d.margemLiquida));
  set('gauge-pct2', PCT(d.margemLiquida));
  buildCaixa(d);
  buildAlocacao(d);
  buildBarClientes(d);
  buildWaterfall(d);
  buildSimulacao(d);
  buildMetas(d);
  renderInsights(d);

  // ── Insight concentração
  const conc = ((Math.max(d.caminhoneiroLegal||0, d.clinicaEpimed||0) / (d.totalFaturamento||1)) * 100).toFixed(0);
  $('insight-concentracao').innerHTML =
    `💡 <strong>Insight:</strong> ${
      conc > 60
        ? `Clínica Epimed representa <strong>${conc}%</strong> do seu faturamento — considere expandir a carteira para reduzir risco.`
        : `Seus dois clientes têm boa distribuição de receita (${conc}% / ${100-parseInt(conc)}%). Continue assim!`
    }`;

  // ── Timestamp
  const ts = new Date(d.updatedAt).toLocaleTimeString('pt-BR');
  set('last-update', `Última atualização: ${ts}`);
}

// ═══════════════════════════════════════════════════════
// ── LOAD DATA ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════

async function loadData() {
  const btn  = $('btn-refresh');
  btn.classList.add('loading');
  btn.disabled = true;
  resetCountdown();
  try {
    const res  = await fetch('/api/financeiro');
    const json = await res.json();
    if (json.ok) { renderData(json.data); setStatus(true); }
    else throw new Error(json.error);
  } catch (err) {
    console.error(err);
    setStatus(false);
    set('last-update', 'Erro ao buscar dados');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ── Countdown ──────────────────────────────────────────
function resetCountdown() {
  countdown = 30;
  set('countdown', 30);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    countdown--;
    set('countdown', countdown);
    if (countdown <= 0) clearInterval(countdownTimer);
  }, 1000);
}

function startPolling() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, REFRESH_INTERVAL);
}

// ── Boot ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  startPolling();
});
