# Finance Game + Goodinfo 股利政策爬蟲（本機代理）

## 你得到什麼
- `index.html`：已加入「30+ 股票可搜尋」與「股利政策（股票股利/現金股利/年均價）」更新卡片
- `goodinfo-proxy/`：Node.js 本機代理 API，用來爬 Goodinfo（解決 GitHub Pages CORS）

---

## 1) 啟動代理 API（必做）
進到 `goodinfo-proxy/` 目錄：

```bash
npm install
npm run start
```

看到：
- Goodinfo proxy running: http://localhost:8787

代表成功。

---

## 2) 打開前端
用瀏覽器直接開 `index.html` 即可。

到「股利政策資料（Goodinfo）」卡片：
- 選股票
- 點「從 Goodinfo 更新」
- 會把最新年度資料填入，並保存到瀏覽器（localStorage）

---

## 3) 若解析不到（被擋/改版）
你可以用下面網址測試，並開啟 debug：
- http://localhost:8787/api/dividend?stock_id=2330&debug=1

終端機會印出前幾列表格 cells，你就能調整 server.js 內：
- cash_div 欄位索引（預設 cells[4]）
- stock_div 欄位索引（預設 cells[7]）
- avg_price（預設在 "--" 後的 dashIdx+2）

---

## 4) 手動更新（不靠爬蟲）
在前端卡片內直接輸入數值，點「手動保存（本機）」即可。
也可以點「匯出資料（JSON）」做備份或版本控管。
