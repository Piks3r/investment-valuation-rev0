    // ── Math helpers ──────────────────────────────────────────────────────
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    function lerp(v, a, b, c, d) { return c + clamp((v - a) / (b - a), 0, 1) * (d - c); }

    // ── Scoring functions ─────────────────────────────────────────────────
    function scoreFng(v) {
      if (v <= 15)  return lerp(v,  0,  15, 0,   1);
      if (v <= 45)  return lerp(v, 15,  45, 1,   4.5);
      if (v <= 55)  return lerp(v, 45,  55, 4.5, 5.5);
      if (v <= 85)  return lerp(v, 55,  85, 5.5, 9);
      return             lerp(v, 85, 100, 9,   10);
    }
    function scoreRsi(rsi) {
      if (rsi <= 25)  return lerp(rsi,  0,  25, 0,   1);
      if (rsi <= 45)  return lerp(rsi, 25,  45, 1,   4.5);
      if (rsi <= 55)  return lerp(rsi, 45,  55, 4.5, 5.5);
      if (rsi <= 75)  return lerp(rsi, 55,  75, 5.5, 9);
      return              lerp(rsi, 75, 100, 9,   10);
    }
    function scoreVs200(ratio) {
      if (ratio <= 0.7)  return lerp(ratio, 0,   0.7, 0,   1);
      if (ratio <= 1.0)  return lerp(ratio, 0.7, 1.0, 1,   4.5);
      if (ratio <= 1.2)  return lerp(ratio, 1.0, 1.2, 4.5, 5.5);
      if (ratio <= 2.5)  return lerp(ratio, 1.2, 2.5, 5.5, 9);
      return                 lerp(ratio, 2.5, 4.0, 9,   10);
    }
    function scoreVs50(ratio) {
      if (ratio <= 0.85) return lerp(ratio, 0,    0.85, 0,   1);
      if (ratio <= 0.95) return lerp(ratio, 0.85, 0.95, 1,   4.5);
      if (ratio <= 1.05) return lerp(ratio, 0.95, 1.05, 4.5, 5.5);
      if (ratio <= 1.5)  return lerp(ratio, 1.05, 1.5,  5.5, 9);
      return                 lerp(ratio, 1.5,  2.5,  9,   10);
    }
    function scoreChg30(pct) {
      if (pct <= -30) return lerp(pct, -60, -30, 0,   1);
      if (pct <= -5)  return lerp(pct, -30,  -5, 1,   4.5);
      if (pct <=  5)  return lerp(pct,  -5,   5, 4.5, 5.5);
      if (pct <= 60)  return lerp(pct,   5,  60, 5.5, 9);
      return              lerp(pct,  60, 100, 9,   10);
    }
    function scoreDom(dom) {
      if (dom >= 60)  return lerp(dom, 60, 75,  1,   0);
      if (dom >= 55)  return lerp(dom, 55, 60,  5.5, 1);
      if (dom >= 50)  return lerp(dom, 50, 55,  4.5, 5.5);
      if (dom >= 40)  return lerp(dom, 40, 50,  9,   4.5);
      return              lerp(dom, 25, 40, 10,  9);
    }

    // Composite with custom weights (percentages summing to 100)
    function composite(scores, weights) {
      const W = weights || loadSettings();
      let sum = 0, wt = 0;
      const map = { fng: W.fng/100, rsi: W.rsi/100, vs200: W.vs200/100, vs50: W.vs50/100, chg30: W.chg30/100, dom: W.dom/100 };
      for (const [k, w] of Object.entries(map)) {
        if (scores[k] != null) { sum += scores[k] * w; wt += w; }
      }
      return wt > 0 ? sum / wt : 5;
    }

    // ── Moving average & RSI ──────────────────────────────────────────────
    function ma(arr, n) {
      if (arr.length < n) return null;
      return arr.slice(-n).reduce((a, b) => a + b, 0) / n;
    }
    function rsi14(prices) {
      if (prices.length < 15) return null;
      const slice = prices.slice(-15);
      let gains = 0, losses = 0;
      for (let i = 1; i < slice.length; i++) {
        const d = slice[i] - slice[i - 1];
        if (d >= 0) gains += d; else losses -= d;
      }
      const avgG = gains / 14, avgL = losses / 14;
      if (avgL === 0) return 100;
      return 100 - 100 / (1 + avgG / avgL);
    }

    // ── MACD, Bollinger, Sparkline ────────────────────────────────────────
    function computeMACD(prices) {
      if (prices.length < 35) return null;
      const k12 = 2 / 13, k26 = 2 / 27;
      let e12 = prices.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
      let e26 = prices.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
      const macdArr = [];
      for (let i = 12; i < prices.length; i++) {
        e12 = prices[i] * k12 + e12 * (1 - k12);
        if (i >= 26) {
          e26 = prices[i] * k26 + e26 * (1 - k26);
          macdArr.push(e12 - e26);
        }
      }
      if (macdArr.length < 9) return null;
      const k9 = 2 / 10;
      let signal = macdArr.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
      for (let i = 9; i < macdArr.length; i++) signal = macdArr[i] * k9 + signal * (1 - k9);
      const macdLine = macdArr[macdArr.length - 1];
      return { macdLine, signal, histogram: macdLine - signal };
    }
    function computeBollinger(prices, period = 20) {
      if (prices.length < period) return null;
      const slice = prices.slice(-period);
      const mean  = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
      const std   = Math.sqrt(variance);
      const upper = mean + 2 * std;
      const lower = mean - 2 * std;
      const price = prices[prices.length - 1];
      const pctB  = std === 0 ? 0.5 : (price - lower) / (upper - lower);
      return { pctB, upper, lower, mean };
    }
    function rollingBollinger(prices, period = 20) {
      return prices.map((_, i) => {
        if (i < period - 1) return null;
        const slice = prices.slice(i - period + 1, i + 1);
        const mean  = slice.reduce((a, b) => a + b, 0) / period;
        const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
        return { upper: mean + 2 * std, lower: mean - 2 * std };
      });
    }

    function scoreBollinger(pctB) {
      if (pctB <= 0)   return lerp(pctB, -0.5, 0,   0,   1);
      if (pctB <= 0.2) return lerp(pctB,  0,   0.2, 1,   4);
      if (pctB <= 0.8) return lerp(pctB,  0.2, 0.8, 4,   6);
      if (pctB <= 1.0) return lerp(pctB,  0.8, 1.0, 6,   9);
      return               lerp(pctB,  1.0, 1.5, 9,  10);
    }
    function fmtMacd(v) {
      if (v == null) return '—';
      const sign = v >= 0 ? '+' : '';
      const abs  = Math.abs(v);
      if (abs >= 1000) return sign + v.toFixed(0);
      if (abs >= 10)   return sign + v.toFixed(1);
      if (abs >= 1)    return sign + v.toFixed(2);
      return sign + v.toFixed(4);
    }
    function sparklineSVG(prices, color) {
      const pts = prices.slice(-30);
      if (pts.length < 2) return '';
      const min   = Math.min(...pts), max = Math.max(...pts);
      const range = max - min || 1;
      const W = 100, H = 20;
      const points = pts.map((p, i) =>
        `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - ((p - min) / range) * H).toFixed(1)}`
      ).join(' ');
      return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:20px;" preserveAspectRatio="none">` +
        `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" ` +
        `stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/></svg>`;
    }

    // ── Formatting ────────────────────────────────────────────────────────
    function fmtPrice(n) {
      if (n == null) return '—';
      if (n < 1) return '$' + Number(n).toFixed(4);
      if (n < 10) return '$' + Number(n).toFixed(2);
      return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    function fmtBig(n) {
      if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
      if (n >= 1e9)  return '$' + (n / 1e9).toFixed(1) + 'B';
      if (n >= 1e6)  return '$' + (n / 1e6).toFixed(1) + 'M';
      return '$' + Number(n).toLocaleString('en-US');
    }
    function fmtPct(n, dec = 1) {
      if (n == null) return '—';
      return (n >= 0 ? '+' : '') + Number(n).toFixed(dec) + '%';
    }
    function colorPct(n) {
      if (n == null) return '<span class="text-gray-500">—</span>';
      const cls = n >= 0 ? 'text-emerald-400' : 'text-red-400';
      return `<span class="${cls}">${fmtPct(n)}</span>`;
    }

    // ── localStorage helpers ──────────────────────────────────────────────
    function loadTrackedAssets() {
      try {
        const raw = localStorage.getItem(ASSETS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return [{
        id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin',
        type: 'crypto', coingeckoId: 'bitcoin', yahooSymbol: null,
      }];
    }
    function saveTrackedAssets(assets) {
      try { localStorage.setItem(ASSETS_KEY, JSON.stringify(assets)); } catch {}
    }
    function loadSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return { ...DEFAULT_WEIGHTS };
    }
    function saveSettings() {
      const w = {
        fng:   parseInt(document.getElementById('wFng').value),
        rsi:   parseInt(document.getElementById('wRsi').value),
        vs200: parseInt(document.getElementById('wVs200').value),
        vs50:  parseInt(document.getElementById('wVs50').value),
        chg30: parseInt(document.getElementById('wChg30').value),
        dom:   parseInt(document.getElementById('wDom').value),
      };
      const total = Object.values(w).reduce((a, b) => a + b, 0);
      if (total !== 100) return;
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(w)); } catch {}

      // Brief "Saved ✓" feedback before closing
      const btn = document.getElementById('saveWeightsBtn');
      btn.textContent = 'Saved ✓';
      btn.classList.remove('bg-orange-500', 'hover:bg-orange-600');
      btn.classList.add('bg-emerald-500');

      setTimeout(() => {
        closeSettings();
        btn.textContent = 'Save';
        btn.classList.remove('bg-emerald-500');
        btn.classList.add('bg-orange-500', 'hover:bg-orange-600');

        // Re-render all visible cards
        renderCardsView(currentFilter);
        // If expanded, re-render that too (fetch fresh if cache expired)
        if (expandedAssetId) {
          const assets = loadTrackedAssets();
          const asset = assets.find(a => a.id === expandedAssetId);
          if (asset) {
            const cached = getAssetCache(expandedAssetId);
            if (cached) {
              renderExpandedView(asset, cached);
            } else {
              fetchAssetData(asset).then(data => renderExpandedView(asset, data)).catch(() => {});
            }
          }
        }
      }, 600);
    }

    function getAssetCache(id) {
      try {
        const raw = localStorage.getItem('asset_cache_' + id);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return data;
      } catch {}
      return null;
    }
    function getAssetCacheStale(id) {
      try {
        const raw = localStorage.getItem('asset_cache_' + id);
        if (!raw) return null;
        const { ts, data } = JSON.parse(raw);
        return data ? { data, ts } : null;
      } catch {}
      return null;
    }
    function setAssetCache(id, data) {
      try { localStorage.setItem('asset_cache_' + id, JSON.stringify({ ts: Date.now(), data })); } catch {}
    }
    function appendScoreHistory(id, score) {
      const key = 'score_history_' + id;
      try {
        let hist = JSON.parse(localStorage.getItem(key) || '[]');
        const now = Date.now();
        // At most one entry per 30 minutes to avoid clustering
        if (hist.length > 0 && now - hist[hist.length - 1].ts < 30 * 60 * 1000) return;
        hist.push({ ts: now, score });
        if (hist.length > 90) hist = hist.slice(-90);
        localStorage.setItem(key, JSON.stringify(hist));
      } catch {}
    }
    function getScoreTrend(id) {
      try {
        const hist = JSON.parse(localStorage.getItem('score_history_' + id) || '[]');
        if (hist.length < 2) return null;
        const now = Date.now();
        const cur  = hist[hist.length - 1].score;
        const ms7  =  7 * 24 * 60 * 60 * 1000;
        const ms30 = 30 * 24 * 60 * 60 * 1000;
        const in7  = hist.filter(h => now - h.ts <= ms7);
        const in30 = hist.filter(h => now - h.ts <= ms30);
        return {
          delta7d:  in7.length  >= 2 ? cur - in7[0].score  : null,
          delta30d: in30.length >= 2 ? cur - in30[0].score : null,
        };
      } catch {}
      return null;
    }

    // ── Notification helpers ───────────────────────────────────────────────
    function getNotifEnabled() {
      return localStorage.getItem('notif_enabled_v1') === 'true';
    }
    function setNotifEnabled(val) {
      try { localStorage.setItem('notif_enabled_v1', val ? 'true' : 'false'); } catch {}
    }
    function getLastNotifTier(id) {
      try {
        const raw = localStorage.getItem('notif_last_tiers_v1');
        if (!raw) return null;
        return JSON.parse(raw)[id] ?? null;
      } catch { return null; }
    }
    function setLastNotifTier(id, label) {
      try {
        const raw = localStorage.getItem('notif_last_tiers_v1');
        const map = raw ? JSON.parse(raw) : {};
        map[id] = label;
        localStorage.setItem('notif_last_tiers_v1', JSON.stringify(map));
      } catch {}
    }
    function checkTierChange(asset, newTierLabel, score, price) {
      const prev = getLastNotifTier(asset.id);
      setLastNotifTier(asset.id, newTierLabel);
      if (!prev || prev === newTierLabel) return;           // first load or no change
      if (!getNotifEnabled()) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      new Notification(`${asset.name} moved to ${newTierLabel}`, {
        body: `${prev} → ${newTierLabel}  ·  ${fmtPrice(price)}  ·  Score ${score.toFixed(1)}/10`,
        icon: asset.image || undefined,
        tag: 'tier-' + asset.id,
      });
    }

    function loadAlerts() {
      try { return JSON.parse(localStorage.getItem('asset_alerts_v1') || '{}'); } catch { return {}; }
    }
    function getAlertForAsset(id) {
      return loadAlerts()[id] || { priceBelow: null, scoreBelow: null };
    }
    function setAlertForAsset(id, cfg) {
      const a = loadAlerts(); a[id] = cfg;
      try { localStorage.setItem('asset_alerts_v1', JSON.stringify(a)); } catch {}
    }
    function checkPriceAlerts(asset, comp, price) {
      if (!getNotifEnabled()) return;
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const cfg = getAlertForAsset(asset.id);
      const COOLDOWN = 60 * 60 * 1000; // 1 hr per alert type
      let fired = {};
      try { fired = JSON.parse(localStorage.getItem('notif_alert_fired_v1') || '{}'); } catch {}
      const now = Date.now();
      if (cfg.priceBelow != null && price <= cfg.priceBelow) {
        if (now - (fired[asset.id + '_price'] || 0) > COOLDOWN) {
          new Notification(`${asset.name} price alert`, {
            body: `Price ${fmtPrice(price)} dropped below your alert of ${fmtPrice(cfg.priceBelow)}`,
            icon: asset.image || undefined, tag: 'price-' + asset.id,
          });
          fired[asset.id + '_price'] = now;
        }
      }
      if (cfg.scoreBelow != null && comp <= cfg.scoreBelow) {
        if (now - (fired[asset.id + '_score'] || 0) > COOLDOWN) {
          new Notification(`${asset.name} valuation alert`, {
            body: `Score ${comp.toFixed(1)}/10 (${tier(comp).label}) dropped below your alert of ${cfg.scoreBelow}`,
            icon: asset.image || undefined, tag: 'score-' + asset.id,
          });
          fired[asset.id + '_score'] = now;
        }
      }
      try { localStorage.setItem('notif_alert_fired_v1', JSON.stringify(fired)); } catch {}
    }

    function getScoreStats(id) {
      try {
        const hist = JSON.parse(localStorage.getItem('score_history_' + id) || '[]');
        if (hist.length < 3) return null;
        const scores = hist.map(h => h.score);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return { avg, min: Math.min(...scores), max: Math.max(...scores), count: scores.length };
      } catch { return null; }
    }

    // ── API helpers ───────────────────────────────────────────────────────
    async function fetchWithProxy(url) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.status === 429) { const e = new Error('rate_limited'); e.type = 'rate_limited'; throw e; }
        if (!res.ok) throw new Error(res.status);
        return res.json();
      } catch (e) {
        if (e.type === 'rate_limited') throw e; // don't retry — proxy won't help
      }
      try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        if (res.status === 429) { const e = new Error('rate_limited'); e.type = 'rate_limited'; throw e; }
        if (!res.ok) { const e = new Error('proxy ' + res.status); e.type = 'api_error'; throw e; }
        return res.json();
      } catch (e) {
        if (e.type) throw e; // already typed — rethrow
        const e2 = new Error('network'); e2.type = 'network'; throw e2;
      }
    }
    const cgFetch = path => fetchWithProxy(CG + path);
    async function yahooFetch(url) {
      // Try Vercel serverless proxy first (works in production, 404s locally)
      try {
        const res = await fetch('/api/yahoo?url=' + encodeURIComponent(url));
        if (res.ok) return res.json();
        if (res.status === 429) { const e = new Error('rate_limited'); e.type = 'rate_limited'; throw e; }
      } catch (e) {
        if (e.type === 'rate_limited') throw e;
      }
      // Fallback: direct then corsproxy
      return fetchWithProxy(url);
    }

    // ── Data fetchers ─────────────────────────────────────────────────────
    async function fetchCryptoData(asset) {
      const isBtc = asset.id === 'bitcoin';
      const [coin, hist, fng, globalData] = await Promise.all([
        cgFetch(`/coins/${asset.coingeckoId}?localization=false&tickers=false&community_data=false&developer_data=false`),
        cgFetch(`/coins/${asset.coingeckoId}/market_chart?vs_currency=usd&days=200&interval=daily`),
        fetch(FNG_URL).then(r => r.ok ? r.json() : null).catch(() => null),
        isBtc ? cgFetch('/global') : Promise.resolve(null),
      ]);

      const mkt    = coin.market_data;
      const price  = mkt.current_price.usd;
      const prices = hist.prices.map(p => p[1]);
      const tss    = hist.prices.map(p => p[0]);

      const ma50val  = ma(prices, 50);
      const ma200val = ma(prices, 200);
      const rsiVal   = rsi14(prices);
      const fngVal   = fng ? parseInt(fng.data[0].value, 10) : null;
      const fngTxt   = fng ? fng.data[0].value_classification : null;
      const dom      = isBtc && globalData ? globalData.data.market_cap_percentage.btc : null;
      const c30      = mkt.price_change_percentage_30d;
      const c7       = mkt.price_change_percentage_7d;
      const c1h      = mkt.price_change_percentage_1h_in_currency?.usd;
      const c1y      = mkt.price_change_percentage_1y;
      const c24h     = mkt.price_change_percentage_24h;
      const athPct   = mkt.ath_change_percentage.usd;
      const marketCap = mkt.market_cap.usd;
      const volume   = mkt.total_volume.usd;
      const circSupply = mkt.circulating_supply;

      return {
        type: 'crypto', price, prices, tss,
        ma50val, ma200val, rsiVal, fngVal, fngTxt,
        dom, c30, c7, c1h, c1y, c24h, athPct,
        marketCap, volume, circSupply,
        coinId: asset.coingeckoId,
        image: coin.image?.small || null,
      };
    }

    async function fetchStockData(asset) {
      const sym = asset.yahooSymbol;
      const path = `/v8/finance/chart/${sym}?range=200d&interval=1d`;
      let json;
      try {
        json = await yahooFetch(`https://query1.finance.yahoo.com${path}`);
      } catch (e) {
        if (e.type === 'rate_limited') throw e;
        json = await yahooFetch(`https://query2.finance.yahoo.com${path}`);
      }
      const result = json.chart?.result?.[0];
      if (!result) throw new Error('No Yahoo data for ' + sym);

      const meta    = result.meta;
      const price   = meta.regularMarketPrice;
      const c24h    = meta.regularMarketChangePercent ?? null;
      const rawClose = result.indicators?.quote?.[0]?.close ?? [];
      const rawTs   = result.timestamp ?? [];

      // Filter out null closes
      const pairs = rawTs.map((t, i) => ({ t: t * 1000, p: rawClose[i] })).filter(x => x.p != null);
      const tss    = pairs.map(x => x.t);
      const prices = pairs.map(x => x.p);

      const ma50val  = ma(prices, 50);
      const ma200val = ma(prices, 200);
      const rsiVal   = rsi14(prices);

      // 30d change from close array
      const c30 = prices.length >= 30
        ? ((prices[prices.length - 1] - prices[prices.length - 31]) / prices[prices.length - 31]) * 100
        : null;

      return {
        type: asset.type, price, prices, tss,
        ma50val, ma200val, rsiVal,
        fngVal: null, fngTxt: null, dom: null,
        c30, c7: null, c1h: null, c1y: null, c24h,
        athPct: null, marketCap: null, volume: null, circSupply: null,
      };
    }

    async function fetchAssetData(asset, force = false) {
      if (!force) {
        const cached = getAssetCache(asset.id);
        if (cached) return cached;
      }
      const data = asset.type === 'crypto'
        ? await fetchCryptoData(asset)
        : await fetchStockData(asset);

      // Persist higher-quality image URL back to stored asset
      if (data.image && !asset.image) {
        const tracked = loadTrackedAssets();
        const idx = tracked.findIndex(a => a.id === asset.id);
        if (idx !== -1) {
          tracked[idx].image = data.image;
          saveTrackedAssets(tracked);
          asset.image = data.image;
        }
      }

      setAssetCache(asset.id, data);
      return data;
    }

    // ── Compute scores ────────────────────────────────────────────────────
    function computeScores(assetData) {
      const { fngVal, rsiVal, ma50val, ma200val, c30, dom, price, prices } = assetData;
      const boll = prices && prices.length >= 20 ? computeBollinger(prices) : null;
      return {
        fng:       fngVal   != null ? scoreFng(fngVal)                 : null,
        rsi:       rsiVal   != null ? scoreRsi(rsiVal)                 : null,
        vs200:     ma200val          ? scoreVs200(price / ma200val)    : null,
        vs50:      ma50val           ? scoreVs50(price / ma50val)      : null,
        chg30:     c30      != null  ? scoreChg30(c30)                 : null,
        dom:       dom      != null  ? scoreDom(dom)                   : null,
        bollinger: boll              ? scoreBollinger(boll.pctB)       : null,
      };
    }

    function computeDcaSignal(comp) {
      if (comp <= 2) return { action: 'DOUBLE DOWN', multiplier: '2×',   color: '#10b981', context: 'Multiple metrics align toward deep discount — historically ideal DCA conditions' };
      if (comp <= 4) return { action: 'BUY MORE',    multiplier: '1.5×', color: '#84cc16', context: 'Conditions lean cheap — consider increasing your DCA amount this period' };
      if (comp <= 6) return { action: 'DCA NORMAL',  multiplier: '1×',   color: '#eab308', context: 'Market near fair value — maintain your regular DCA schedule and amount' };
      if (comp <= 8) return { action: 'REDUCE',      multiplier: '0.5×', color: '#f97316', context: 'Conditions lean expensive — consider reducing your DCA amount this period' };
      return           { action: 'PAUSE DCA',  multiplier: '0×',   color: '#ef4444', context: 'Multiple metrics indicate historically elevated levels — consider pausing DCA' };
    }
