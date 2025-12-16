import express from "express";
import * as cheerio from "cheerio";

const app = express();
const PORT = 8787;

// ===== 友善節流：避免短時間大量請求 =====
const SLEEP_MS_BETWEEN_REQ = 600;
let lastReqTs = 0;
async function politeDelay() {
  const now = Date.now();
  const wait = Math.max(0, SLEEP_MS_BETWEEN_REQ - (now - lastReqTs));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastReqTs = Date.now();
}

function normalizeNumber(x) {
  const s = String(x ?? "").replace(/,/g, "").trim();
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function isYearToken(s) {
  return /^\d{4}$/.test(String(s).trim());
}

function extractDividendRowsFromHtml(html, debug = false) {
  const $ = cheerio.load(html);

  const candidates = [];
  $("tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 10) return;

    const cells = [];
    tds.each((__, td) => {
      const txt = $(td).text().replace(/\s+/g, " ").trim();
      if (txt !== "") cells.push(txt);
    });

    if (!cells.length || !isYearToken(cells[0])) return;
    candidates.push(cells);
  });

  const items = [];
  for (const cells of candidates) {
    const year = Number(cells[0]);
    if (!year) continue;

    // 依 Goodinfo 常見欄位排列：現金合計在第 5 欄、股票合計在第 8 欄（可能會隨版面變動）
    const cashDiv  = normalizeNumber(cells[4]);
    const stockDiv = normalizeNumber(cells[7]);

    // 年均價通常在 "--" 後的第 3 個欄位： [--, 股價年度, 年均價, ...]
    let dashIdx = cells.findIndex(t => /--/.test(t));
    if (dashIdx === -1) {
      // 備援：在後半段找一個年度 token，推回 dashIdx
      for (let i = Math.floor(cells.length / 2); i < cells.length; i++) {
        if (isYearToken(cells[i])) { dashIdx = i - 1; break; }
      }
    }

    let avgPrice = null;
    if (dashIdx >= 0 && cells[dashIdx + 2] != null) {
      avgPrice = normalizeNumber(cells[dashIdx + 2]);
    } else {
      // 最後備援：直接在後半段找第一個像價格的數字
      for (let i = Math.floor(cells.length / 2); i < cells.length; i++) {
        const v = normalizeNumber(cells[i]);
        if (typeof v === "number" && v > 0) { avgPrice = v; break; }
      }
    }

    if (debug && items.length < 3) console.log("[DEBUG row cells]", cells);

    if (cashDiv !== null || stockDiv !== null || avgPrice !== null) {
      items.push({
        year,
        cash_div: cashDiv ?? 0,
        stock_div: stockDiv ?? 0,
        avg_price: avgPrice ?? 0
      });
    }
  }

  items.sort((a, b) => b.year - a.year);
  return items;
}

app.get("/api/dividend", async (req, res) => {
  const stockId = String(req.query.stock_id || "").trim();
  const debug = String(req.query.debug || "") === "1";

  if (!stockId) return res.status(400).json({ error: "missing stock_id" });

  const url = `https://goodinfo.tw/tw/StockDividendPolicy.asp?STOCK_ID=${encodeURIComponent(stockId)}`;

  try {
    await politeDelay();

    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "accept-language": "zh-TW,zh;q=0.9,en;q=0.8",
        "accept": "text/html,application/xhtml+xml"
      }
    });

    const html = await r.text();

    if (!html || html.length < 5000) {
      return res.status(502).json({
        error: "upstream returned too-short html（可能被擋或需要驗證）",
        stock_id: stockId
      });
    }

    const items = extractDividendRowsFromHtml(html, debug);

    if (!items.length) {
      return res.status(502).json({
        error: "parsed 0 rows（可能表格結構改了或被擋）",
        stock_id: stockId,
        hint: "加上 &debug=1 讓後端印出前幾列 cells，方便你調整欄位索引"
      });
    }

    return res.json({ stock_id: stockId, source: url, items });
  } catch (e) {
    return res.status(500).json({ error: "fetch/parse failed", stock_id: stockId });
  }
});

app.listen(PORT, () => {
  console.log(`Goodinfo proxy running: http://localhost:${PORT}`);
  console.log(`Test: http://localhost:${PORT}/api/dividend?stock_id=2330`);
});
