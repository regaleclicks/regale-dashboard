const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

const SHEET_ID = '1mZuIj3Ss6mfcKXs_37A_Tb5zRvKd6beHe013Xd3rkFw';
const SHEET_NAME = 'Resumo (sem custos fixos)';

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/financeiro', async (req, res) => {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    // gviz retorna: google.visualization.Query.setResponse({...});
    const jsonStr = text.replace(/^[^(]+\(/, '').replace(/\);?\s*$/, '');
    const data = JSON.parse(jsonStr);

    const rows = data.table.rows;

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
    // Row 0  → Caminhoneiro Legal
    // Row 1  → Clínica Epimed
    // Row 2  → TOTAL FATURAMENTO
    // Row 12 → Faturamento Bruto
    // Row 14 → Alíquota DAS (decimal, ex: 0.15)
    // Row 15 → Valor do DAS (negativo, ex: -780)
    // Row 16 → Lucro Líquido Mensal
    // Row 17 → Margem Líquida (decimal, ex: 0.85)
    // Row 18 → Lucro por Sócio
    const payload = {
      caminhoneiroLegal: getVal(0),
      clinicaEpimed:     getVal(1),
      totalFaturamento:  getVal(2),
      faturamentoBruto:  getVal(12),
      aliquotaDAS:       getVal(14),
      valorDAS:          Math.abs(getVal(15) ?? 0),
      lucroLiquido:      getVal(16),
      margemLiquida:     getVal(17),
      lucroPorSocio:     getVal(18),
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
