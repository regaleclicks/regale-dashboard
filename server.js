const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

const SHEET_ID       = '1mZuIj3Ss6mfcKXs_37A_Tb5zRvKd6beHe013Xd3rkFw';
const SHEET_NAME     = 'Resumo (sem custos fixos)';
const SHEET_CAIXA    = 'Caixa Total';
const SHEET_CALENDAR = 'Calendário de Pagamentos';

async function fetchSheet(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const json = text.replace(/^[\s\S]*?setResponse\(/, '').replace(/\);\s*$/, '');
  return JSON.parse(json).table.rows;
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/financeiro', async (req, res) => {
  try {
    const [rows, rowsCaixa, rowsCal] = await Promise.all([
      fetchSheet(SHEET_NAME),
      fetchSheet(SHEET_CAIXA),
      fetchSheet(SHEET_CALENDAR),
    ]);

    // Lê célula por índice: linha 0-based, coluna 0-based
    // B = coluna 1; linha 6 = índice 5, etc.
    const getVal = (rowIdx, colIdx = 1) => {
      try {
        const cell = rows[rowIdx]?.c?.[colIdx];
        return cell?.v ?? null;
      } catch {
        return null;
      }
    };

    const fmt = (rowIdx, colIdx = 1) => {
      try {
        const cell = rows[rowIdx]?.c?.[colIdx];
        return cell?.f ?? cell?.v ?? null;
      } catch {
        return null;
      }
    };

    // Índices reais retornados pelo gviz (0-based):
    // Row 0  col B → Caminhoneiro Legal
    // Row 1  col B → Clínica Epimed
    // Row 2  col B → TOTAL FATURAMENTO
    // Row 12 col B → Faturamento Bruto
    // Row 14 col B → Alíquota DAS (decimal, ex: 0.155)
    // Row 15 col B → Valor do DAS (negativo)
    // Row 16 col B → Lucro Líquido Mensal
    // Row 17 col B → Margem Líquida (decimal)
    // Row 21 col B → % Retirada dos Sócios | col C → Valor total retirada
    // Row 22 col B → % Reinvestimento       | col C → Valor reinvestimento
    // Row 23 col B → % Fluxo de Caixa       | col C → Valor fluxo de caixa
    // Row 26 col C → Valor total retirada sócios | col D → Valor por sócio

    // col C = índice 2, col D = índice 3
    const parseVal = (str) => {
      if (str == null) return null;
      if (typeof str === 'number') return str;
      // "R$ 1.003,30" → 1003.30
      return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || null;
    };

    const payload = {
      caminhoneiroLegal:    getVal(0),
      clinicaEpimed:        getVal(1),
      totalFaturamento:     getVal(2),
      faturamentoBruto:     getVal(12),
      aliquotaDAS:          getVal(14),
      valorDAS:             Math.abs(getVal(15) ?? 0),
      lucroLiquido:         getVal(16),
      margemLiquida:        getVal(17),
      // Distribuição do lucro
      pctRetiradaSocios:    getVal(21),   // % dos sócios
      pctReinvestimento:    getVal(22),   // % reinvestimento
      pctFluxoCaixa:        getVal(23),   // % fluxo de caixa
      valorRetiradaSocios:  parseVal(fmt(26, 2)),  // R$ total retirada
      valorReinvestimento:  parseVal(fmt(27, 2)),  // R$ reinvestimento
      valorFluxoCaixa:      parseVal(fmt(28, 2)),  // R$ fluxo de caixa
      lucroPorSocio:        parseVal(fmt(26, 3)),  // R$ por sócio (col D)

      // ── Caixa Total (aba separada)
      // Row 0 col1 = saldo inicial
      // Rows 2-13 = meses Jan-Dez: col0=mês, col1=fat, col2=DAS, col3=fluxoCaixa, col5=fluxoLíq, col6=saldo
      // Linha com col7="Mês atual" = mês corrente
      caixa: (() => {
        const saldoInicial = rowsCaixa[0]?.c?.[1]?.v ?? 0;
        const meses = rowsCaixa.slice(2, 14).map(r => ({
          mes:         r.c?.[0]?.v ?? '',
          faturamento: r.c?.[1]?.v ?? 0,
          das:         r.c?.[2]?.v ?? 0,
          entradaFC:   r.c?.[3]?.v ?? 0,
          saidaFC:     r.c?.[4]?.v ?? 0,
          fluxoLiq:    r.c?.[5]?.v ?? 0,
          saldo:       r.c?.[6]?.v ?? 0,
          atual:       r.c?.[7]?.v === 'Mês atual',
        }));
        const mesAtual   = meses.find(m => m.atual) ?? meses.filter(m => m.saldo > 0).pop() ?? meses[0];
        const saldoAtual = mesAtual?.saldo ?? 0;
        return { saldoInicial, saldoAtual, mesAtual: mesAtual?.mes ?? '', meses };
      })(),

      // ── Calendário de Pagamentos
      // Rows 0-3: alíquotas/percentuais (ignorar, já vêm do resumo)
      // Row 4: cabeçalho
      // Rows 5-7: pagamentos (dia, cliente, bruto, DAS, líquido, retirada, porSocio, reinvest, FC)
      // Row 8: totais do mês
      // Rows 10-12: resumo por sócio
      calendario: (() => {
        const g = (r, c) => rowsCal[r]?.c?.[c]?.v ?? null;
        const f = (r, c) => rowsCal[r]?.c?.[c]?.f ?? null;

        const pgtos = [5, 6, 7].map(i => ({
          dia:          g(i, 0),
          cliente:      g(i, 1),
          bruto:        g(i, 2),
          das:          g(i, 3),
          liquido:      g(i, 4),
          retiradaTotal:g(i, 5),
          porSocio:     g(i, 6),
          reinvestimento:g(i,7),
          fluxoCaixa:   g(i, 8),
        })).filter(p => p.dia);

        const total = {
          bruto:         g(8, 2),
          das:           g(8, 3),
          liquido:       g(8, 4),
          retiradaTotal: g(8, 5),
          porSocio:      g(8, 6),
          reinvestimento:g(8, 7),
          fluxoCaixa:    g(8, 8),
        };

        const socios = ['Diogo','Victor','Henrique'].map((nome, i) => ({
          nome,
          primeiroRecebimento: g(10 + i, 1),
          totalMes:            g(10 + i, 8),
        }));

        return { pgtos, total, socios };
      })(),

      updatedAt: new Date().toISOString(),
    };

    res.json({ ok: true, data: payload });
  } catch (err) {
    console.error('[API] Erro ao buscar planilha:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Regale Dashboard rodando em http://localhost:${PORT}`);
});
