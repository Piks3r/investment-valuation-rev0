    // ── Asset avatar helper ───────────────────────────────────────────────
    function assetAvatar(asset, t) {
      const sym3 = asset.symbol.slice(0, 3);
      const fallbackStyle = `background:${t.bg};border:1px solid ${t.border};color:${t.color}`;
      const imgSrc = asset.image || `https://assets.parqet.com/logos/symbol/${encodeURIComponent(asset.symbol)}?format=png`;

      return `<div class="shrink-0 w-9 h-9 relative flex items-center justify-center font-bold text-sm">
        <span class="absolute inset-0 rounded-xl flex items-center justify-center"
              style="display:none;${fallbackStyle}">${sym3}</span>
        <img src="${imgSrc}" class="w-full h-full object-contain"
             onerror="this.style.display=&#39;none&#39;;this.previousElementSibling.style.display=&#39;flex&#39;" alt="">
      </div>`;
    }

    // ── Badge helper ──────────────────────────────────────────────────────
    function setBadge(id, score) {
      const t  = tier(score);
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = t.label;
      el.className   = `text-xs font-bold px-2 py-0.5 rounded-md ${t.badge}`;
    }

    // ── Zone bar renderer ─────────────────────────────────────────────────
    function renderZoneBar(containerId, activeIdx) {
      const container = document.getElementById(containerId);
      if (!container) return;
      const segs = ZONE_BAR_CONFIG[containerId];
      if (!segs) return;
      container.innerHTML = '';
      container.style.cssText = 'display:flex;border-radius:8px;overflow:hidden;margin-top:10px;';
      segs.forEach((rangeLabel, i) => {
        const div = document.createElement('div');
        div.className = 'zone-seg' + (i === activeIdx ? ' active' : '');
        div.style.flex            = '1';
        div.style.backgroundColor = ZONE_COLORS[i] + '1e';
        div.style.borderTop       = `2px solid ${ZONE_COLORS[i]}`;
        div.style.opacity         = i === activeIdx ? '1' : '0.32';
        if (i === activeIdx) div.style.borderBottom = '2px solid rgba(255,255,255,0.5)';
        div.innerHTML =
          `<div style="color:${ZONE_COLORS[i]};font-size:8.5px;font-weight:700;text-align:center;padding:4px 2px 1px;line-height:1.1;">${ZONE_LABELS[i]}</div>` +
          `<div style="color:#6b7280;font-size:7.5px;text-align:center;padding:1px 2px 4px;line-height:1.2;">${rangeLabel}</div>`;
        container.appendChild(div);
      });
    }

    // ── Card grid renderer ────────────────────────────────────────────────
    async function renderCardsView(filter) {
      currentFilter = filter || 'ALL';
      _tableRows = [];
      const assets = loadTrackedAssets();
      const grid      = document.getElementById('assetGrid');
      const tableView = document.getElementById('tableView');
      const loadEl    = document.getElementById('loadingCards');

      // Update filter tabs
      document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentFilter);
      });

      const filtered = currentFilter === 'ALL'
        ? assets
        : assets.filter(a => a.type.toUpperCase() === currentFilter);

      if (filtered.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 text-sm text-center col-span-3 py-10">No assets in this category.</p>';
        grid.style.display = currentView === 'cards' ? 'grid' : 'none';
        tableView.classList.toggle('hidden', currentView !== 'table');
        if (currentView === 'table') {
          document.getElementById('tableBody').innerHTML =
            '<tr><td colspan="7" class="text-center text-gray-500 text-sm py-10">No assets in this category.</td></tr>';
        }
        loadEl.classList.add('hidden');
        return;
      }

      // Show/hide grid vs table
      if (currentView === 'cards') {
        grid.style.display = 'none';
        tableView.classList.add('hidden');
      } else {
        grid.style.display = 'none';
        tableView.classList.remove('hidden');
      }

      // Show loading initially if no cache at all
      const anyUncached = filtered.some(a => !getAssetCache(a.id));
      if (anyUncached) {
        loadEl.classList.remove('hidden');
        if (currentView === 'cards') grid.style.display = 'none';
      }

      // Fetch all in parallel
      const results = await Promise.allSettled(filtered.map(a => fetchAssetData(a)));

      loadEl.classList.add('hidden');
      if (currentView === 'cards') {
        grid.style.display = 'grid';
        grid.innerHTML = '';
      }

      _updateDataBanner(new Set(), false);

      const weights = loadSettings();
      const errorTypes = new Set();
      let anyData = false;
      let anyCached = false;

      results.forEach((res, i) => {
        const asset = filtered[i];
        if (res.status === 'rejected') {
          errorTypes.add(res.reason?.type || 'api_error');
          const staleResult = getAssetCacheStale(asset.id);
          if (staleResult) {
            const { data: stale, ts: staleTs } = staleResult;
            anyCached = true;
            anyData = true;
            const scores = computeScores(stale);
            const comp   = composite(scores, weights);
            const t      = tier(comp);
            if (currentView === 'table') {
              _tableRows.push({ asset, assetData: stale, scores, comp, t, staleTs, error: false });
            } else {
              grid.insertAdjacentHTML('beforeend', renderAssetCard(asset, stale, scores, comp, t, staleTs));
            }
          } else {
            if (currentView === 'table') {
              _tableRows.push({ asset, assetData: null, scores: null, comp: null, t: null, error: true });
            } else {
              grid.insertAdjacentHTML('beforeend', renderErrorCard(asset));
            }
          }
          return;
        }
        anyData = true;
        const assetData = res.value;
        const scores = computeScores(assetData);
        const comp   = composite(scores, weights);
        const t      = tier(comp);
        checkTierChange(asset, t.label, comp, assetData.price);
        checkPriceAlerts(asset, comp, assetData.price);
        appendScoreHistory(asset.id, comp);
        if (currentView === 'table') {
          _tableRows.push({ asset, assetData, scores, comp, t, error: false });
        } else {
          grid.insertAdjacentHTML('beforeend', renderAssetCard(asset, assetData, scores, comp, t));
        }
      });

      _updateDataBanner(errorTypes, anyCached);
      if (currentView === 'table') renderTableView();
    }

    function fmtAge(ts) {
      const m = Math.round((Date.now() - ts) / 60000);
      if (m < 1) return '<1 min';
      if (m < 60) return `${m} min`;
      const h = Math.round(m / 60);
      return `${h} hr`;
    }

    function _updateDataBanner(errorTypes, anyCached) {
      const banner = document.getElementById('dataBanner');
      if (!banner) return;
      if (errorTypes.size === 0) { banner.classList.add('hidden'); return; }

      const isRateLimited = errorTypes.has('rate_limited');
      const isNetwork     = !isRateLimited && errorTypes.has('network');
      const textEl        = document.getElementById('dataBannerText');
      const iconEl        = document.getElementById('dataBannerIcon');

      banner.className = 'mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 border ' +
        (isRateLimited ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-gray-800/60 border-gray-700/60');

      if (isRateLimited) {
        iconEl.textContent = '⏱';
        textEl.textContent = anyCached
          ? 'CoinGecko rate limit reached (~30 req/min) — showing cached data. Usually clears within 1 minute.'
          : 'CoinGecko rate limit reached (~30 req/min) — wait about 1 minute then retry.';
      } else if (isNetwork) {
        iconEl.textContent = '📡';
        textEl.textContent = anyCached
          ? 'No internet connection — showing cached data.'
          : 'No internet connection.';
      } else {
        iconEl.textContent = '⚠️';
        textEl.textContent = anyCached
          ? 'Data sources temporarily unavailable — showing cached data.'
          : 'Data sources temporarily unavailable.';
      }

      banner.classList.remove('hidden');
    }

    function scoreSparklineSVG(id, color) {
      try {
        const hist = JSON.parse(localStorage.getItem('score_history_' + id) || '[]');
        if (hist.length < 3) return '';
        return sparklineSVG(hist.slice(-30).map(h => h.score), color);
      } catch { return ''; }
    }

    function renderAssetCard(asset, assetData, scores, comp, t, staleTs) {
      const { price, c24h } = assetData;
      const typeBadgeColor = asset.type === 'crypto' ? 'text-blue-400' : asset.type === 'etf' ? 'text-purple-400' : 'text-green-400';
      const typeLabel = asset.type.toUpperCase();

      const sparkline = sparklineSVG(assetData.prices || [], t.color);
      const scoreSpark = scoreSparklineSVG(asset.id, t.color);

      return `
      <div class="asset-card" onclick="expandAsset('${asset.id}')" style="border-color:${t.border}; border-top-color:${t.color}; border-top-width:2px;">
        <button class="asset-card-remove" onclick="event.stopPropagation();removeAsset('${asset.id}')" title="Remove">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2.5 min-w-0 ml-4">
            ${assetAvatar(asset, t)}
            <div class="min-w-0">
              <div class="font-bold text-sm truncate">${asset.name}</div>
              <div class="text-xs text-gray-500">${asset.symbol} · <span class="${typeBadgeColor}">${typeLabel}</span></div>
            </div>
          </div>
          <div class="text-right shrink-0 ml-2">
            <div class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold" style="background:${t.bg};color:${t.color};border:1px solid ${t.border};">${t.label}</div>
            <div class="text-gray-400 text-xs mt-0.5">${comp.toFixed(1)} <span class="text-gray-600">/ 10</span></div>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2.5 border-t border-white/5 text-sm">
          <span class="font-semibold tabular-nums">${fmtPrice(price)}</span>
          <span>${colorPct(c24h)} <span class="text-gray-600 text-xs">(24h)</span></span>
        </div>
        <div class="mt-2.5" style="opacity:0.9">${sparkline}</div>
        ${scoreSpark ? `<div class="mt-1" style="opacity:0.75">${scoreSpark}</div><div class="text-gray-600 text-[10px] mt-0.5">score trend</div>` : ''}
        ${staleTs ? `<div class="mt-1.5 text-[10px] text-amber-500/70 tabular-nums">Cached · ${fmtAge(staleTs)} ago</div>` : ''}
      </div>`;
    }

    function renderErrorCard(asset) {
      return `
      <div class="asset-card opacity-50 cursor-default" style="border-color:#374151">
        <div class="flex items-center gap-2.5 mb-2">
          <div class="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-xs text-gray-500 font-bold">${asset.symbol.slice(0,3)}</div>
          <div><div class="font-bold text-sm">${asset.name}</div><div class="text-xs text-gray-500">${asset.symbol}</div></div>
        </div>
        <p class="text-red-400 text-xs flex items-center gap-1"><svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M12 8v4m0 4h.01"/></svg>Failed to load data</p>
      </div>`;
    }

    // ── Expand / collapse ─────────────────────────────────────────────────
    async function expandAsset(id) {
      expandedAssetId = id;
      const assets = loadTrackedAssets();
      const asset  = assets.find(a => a.id === id);
      if (!asset) return;

      history.pushState({ assetId: id }, '', '#' + id);

      // Switch views
      document.getElementById('cardsView').classList.add('hidden');
      document.getElementById('expandedView').classList.remove('hidden');
      document.getElementById('expandedView').classList.add('fade-in');

      // Show loading state in main card area
      document.getElementById('mainLabel').textContent = '…';
      document.getElementById('scoreNum').textContent  = '…';

      try {
        const assetData = await fetchAssetData(asset);
        renderExpandedView(asset, assetData);
      } catch (err) {
        console.error('Expand error:', err);
        document.getElementById('mainLabel').textContent = 'Error';
      }
    }

    function _doCollapse() {
      expandedAssetId = null;
      tfCache = {};
      if (chart) { chart.destroy(); chart = null; }
      if (scoreChart) { scoreChart.destroy(); scoreChart = null; }
      document.getElementById('expandedView').classList.add('hidden');
      document.getElementById('cardsView').classList.remove('hidden');
    }
    function collapseToCards() {
      if (location.hash) history.pushState(null, '', location.pathname + location.search);
      _doCollapse();
    }

    async function refreshExpanded() {
      if (!expandedAssetId) return;
      const btn  = document.getElementById('expandedRefreshBtn');
      const icon = document.getElementById('expandedRefreshIcon');
      btn.disabled = true;
      icon.classList.add('spin');
      const assets = loadTrackedAssets();
      const asset  = assets.find(a => a.id === expandedAssetId);
      if (asset) {
        try {
          tfCache = {};
          const data = await fetchAssetData(asset, true);
          renderExpandedView(asset, data);
        } catch(e) { console.error(e); }
      }
      btn.disabled = false;
      icon.classList.remove('spin');
    }

    function removeCurrentAsset() {
      if (!expandedAssetId) return;
      if (!confirm('Remove this asset from your dashboard?')) return;
      removeAsset(expandedAssetId);
    }

    // ── Expanded view renderer ────────────────────────────────────────────
    function renderExpandedView(asset, assetData) {
      const { price, c24h, fngVal, fngTxt, rsiVal, ma50val, ma200val,
              c30, c7, c1h, c1y, dom, athPct, marketCap, volume, circSupply,
              prices, tss, type } = assetData;

      const isCrypto = type === 'crypto';
      const isBtc    = asset.id === 'bitcoin';
      const weights  = loadSettings();
      const scores   = computeScores(assetData);
      const comp     = composite(scores, weights);
      const t        = tier(comp);

      // Conviction count (6 standard composite metrics only)
      const stdKeys    = ['fng', 'rsi', 'vs200', 'vs50', 'chg30', 'dom'];
      const activeStd  = stdKeys.map(k => scores[k]).filter(s => s != null);
      const cheapCount = activeStd.filter(s => s < 4).length;
      const expCount   = activeStd.filter(s => s > 6).length;

      // Header
      document.getElementById('expandedTitle').textContent = `${asset.name} (${asset.symbol})`;
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      document.getElementById('expandedHeaderPrice').textContent = fmtPrice(price);
      document.getElementById('expandedHeaderChange').innerHTML  = colorPct(c24h) + ' (24h)';
      document.getElementById('mobilePriceVal').textContent = fmtPrice(price);
      document.getElementById('mobileChangeVal').innerHTML  = colorPct(c24h) + ' (24h)';
      document.getElementById('mobileUpdated').textContent  = now;
      document.getElementById('desktopUpdated').textContent = 'Updated ' + now;

      // Data source line
      document.getElementById('dataSourceLine').innerHTML = isCrypto
        ? 'Data: <span class="text-gray-500">CoinGecko</span> &amp; <span class="text-gray-500">Alternative.me</span>&nbsp;·&nbsp; Cache refreshes every 5 minutes&nbsp;·&nbsp; <strong class="text-gray-400">Not financial advice</strong> — for informational purposes only'
        : 'Data: <span class="text-gray-500">Yahoo Finance</span>&nbsp;·&nbsp; Cache refreshes every 5 minutes&nbsp;·&nbsp; <strong class="text-gray-400">Not financial advice</strong> — for informational purposes only';

      // Main card
      const card = document.getElementById('mainCard');
      card.style.backgroundColor = t.bg;
      card.style.borderColor     = t.border;
      document.getElementById('mainLabel').textContent = t.label;
      document.getElementById('mainLabel').style.color = t.color;
      document.getElementById('scoreNum').innerHTML =
        `<span style="color:${t.color}">${comp.toFixed(1)}</span><span class="text-gray-600 text-lg font-normal"> / 10</span>`;
      document.getElementById('mainContext').textContent = t.context;
      setTimeout(() => {
        document.getElementById('scoreDot').style.left = clamp((comp / 10) * 100, 2, 98) + '%';
      }, 80);

      // Conviction pill
      const convEl = document.getElementById('convictionPill');
      if (activeStd.length > 0) {
        convEl.classList.remove('hidden');
        const leanCheap = cheapCount >= expCount;
        const dotColor  = leanCheap ? '#10b981' : '#ef4444';
        const count     = leanCheap ? cheapCount : expCount;
        const label     = leanCheap ? 'lean cheap' : 'lean expensive';
        convEl.innerHTML = `<span style="color:${dotColor}">●</span> ${count}/${activeStd.length} ${label}`;
      } else {
        convEl.classList.add('hidden');
      }

      // Action line
      const sig = computeDcaSignal(comp);
      const actionEl = document.getElementById('scoreAction');
      if (actionEl) {
        actionEl.classList.remove('hidden');
        actionEl.innerHTML = `<span style="color:${sig.color}">${sig.action}</span> <span class="text-gray-400 font-normal">— ${sig.context}</span>`;
      }

      // Score trend
      appendScoreHistory(asset.id, comp);
      const trend   = getScoreTrend(asset.id);
      const trendEl = document.getElementById('scoreTrendLine');
      if (trend && (trend.delta30d != null || trend.delta7d != null)) {
        trendEl.classList.remove('hidden');
        const d       = trend.delta30d ?? trend.delta7d;
        const period  = trend.delta30d != null ? '30d' : '7d';
        const arrow   = d < 0 ? '↓' : '↑';
        const meaning = d < 0 ? 'getting cheaper' : 'getting pricier';
        trendEl.textContent = `${arrow} ${Math.abs(d).toFixed(1)} pts in ${period} — ${meaning}`;
      } else {
        trendEl.classList.add('hidden');
      }

      // Historical score context
      const stats = getScoreStats(asset.id);
      const statsEl = document.getElementById('scoreHistoryStats');
      if (stats) {
        statsEl.classList.remove('hidden');
        const rel = comp < stats.avg - 0.5 ? ' · below your avg' : comp > stats.avg + 0.5 ? ' · above your avg' : ' · near your avg';
        statsEl.textContent = `Recorded history (${stats.count}): avg ${stats.avg.toFixed(1)} · min ${stats.min.toFixed(1)} · max ${stats.max.toFixed(1)}${rel}`;
      } else {
        statsEl.classList.add('hidden');
      }

      // Price alert inputs
      const savedAlert = getAlertForAsset(asset.id);
      document.getElementById('alertPriceInput').value = savedAlert.priceBelow != null ? savedAlert.priceBelow : '';
      document.getElementById('alertScoreInput').value = savedAlert.scoreBelow != null ? savedAlert.scoreBelow : '';

      // DCA Signal
      renderDcaSection(comp);

      // Metrics table
      renderMetricsTable(scores, assetData, isBtc);

      // F&G card (crypto only)
      const fngCard = document.getElementById('fngCard');
      if (isCrypto && fngVal != null) {
        fngCard.classList.remove('hidden');
        const fs = scoreFng(fngVal);
        document.getElementById('fngValue').textContent = fngVal;
        document.getElementById('fngValue').style.color = tier(fs).color;
        document.getElementById('fngLabel').textContent = fngTxt ?? '';
        setBadge('fngBadge', fs);
        const arcLen = 176, filled = (fngVal / 100) * arcLen;
        const arcColor = fngVal < 25 ? '#10b981' : fngVal < 45 ? '#84cc16' :
                         fngVal < 55 ? '#eab308' : fngVal < 75 ? '#f97316' : '#ef4444';
        const arcEl = document.getElementById('fngArc');
        arcEl.setAttribute('stroke', arcColor);
        const angle = (fngVal / 100) * 180 - 90;
        setTimeout(() => {
          arcEl.setAttribute('stroke-dasharray', `${filled} ${arcLen}`);
          document.getElementById('fngNeedle').style.transform = `rotate(${angle}deg)`;
        }, 100);
        renderZoneBar('zones-fng', fngVal < 15 ? 0 : fngVal < 45 ? 1 : fngVal < 55 ? 2 : fngVal < 85 ? 3 : 4);
      } else {
        fngCard.classList.add('hidden');
      }

      // RSI
      if (rsiVal != null) {
        const rs = scoreRsi(rsiVal);
        document.getElementById('rsiValue').textContent = rsiVal.toFixed(1);
        document.getElementById('rsiValue').style.color = tier(rs).color;
        document.getElementById('rsiLabel').textContent =
          rsiVal < 25 ? 'Deeply Oversold' : rsiVal < 45 ? 'Oversold' :
          rsiVal < 55 ? 'Neutral' : rsiVal < 75 ? 'Overbought' : 'Deeply Overbought';
        setBadge('rsiBadge', rs);
        setTimeout(() => {
          document.getElementById('rsiNeedle').style.left = clamp(rsiVal, 0, 100) + '%';
        }, 100);
        renderZoneBar('zones-rsi', rsiVal < 25 ? 0 : rsiVal < 45 ? 1 : rsiVal < 55 ? 2 : rsiVal < 75 ? 3 : 4);
      } else {
        document.getElementById('rsiValue').textContent = 'N/A';
        document.getElementById('rsiBadge').textContent = '—';
      }

      // 200d MA
      if (ma200val) {
        const ratio200 = price / ma200val;
        const pct200   = (ratio200 - 1) * 100;
        const ms200    = scoreVs200(ratio200);
        document.getElementById('ma200Pct').textContent = fmtPct(pct200);
        document.getElementById('ma200Pct').style.color = tier(ms200).color;
        document.getElementById('ma200Dir').textContent = pct200 >= 0 ? 'above 200d MA' : 'below 200d MA';
        document.getElementById('ma200Val').textContent = fmtPrice(ma200val);
        document.getElementById('ma200Cur').textContent = fmtPrice(price);
        setBadge('ma200Badge', ms200);
        renderZoneBar('zones-ma200', ratio200 < 0.7 ? 0 : ratio200 < 1.0 ? 1 : ratio200 < 1.2 ? 2 : ratio200 < 2.5 ? 3 : 4);
      }

      // 50d MA
      if (ma50val) {
        const ratio50 = price / ma50val;
        const pct50   = (ratio50 - 1) * 100;
        const ms50    = scoreVs50(ratio50);
        document.getElementById('ma50Pct').textContent = fmtPct(pct50);
        document.getElementById('ma50Pct').style.color = tier(ms50).color;
        document.getElementById('ma50Dir').textContent = pct50 >= 0 ? 'above 50d MA' : 'below 50d MA';
        document.getElementById('ma50Val').textContent = fmtPrice(ma50val);
        document.getElementById('ma50Cur').textContent = fmtPrice(price);
        setBadge('ma50Badge', ms50);
        renderZoneBar('zones-ma50', ratio50 < 0.85 ? 0 : ratio50 < 0.95 ? 1 : ratio50 < 1.05 ? 2 : ratio50 < 1.5 ? 3 : 4);
      }

      // 30d Change
      if (c30 != null) {
        const cs = scoreChg30(c30);
        document.getElementById('chg30Value').textContent = fmtPct(c30);
        document.getElementById('chg30Value').style.color = tier(cs).color;
        setBadge('chg30Badge', cs);
        renderZoneBar('zones-chg30', c30 < -30 ? 0 : c30 < -5 ? 1 : c30 < 5 ? 2 : c30 < 60 ? 3 : 4);
      }

      // Extra changes (crypto only)
      const extraEl = document.getElementById('extraChanges');
      if (isCrypto) {
        extraEl.classList.remove('hidden');
        document.getElementById('chg1h').innerHTML = colorPct(c1h);
        document.getElementById('chg7d').innerHTML = colorPct(c7);
        document.getElementById('chg1y').innerHTML = colorPct(c1y);
      } else {
        extraEl.classList.add('hidden');
      }

      // BTC Dominance (BTC only)
      const domCard = document.getElementById('domCard');
      if (isBtc && dom != null) {
        domCard.classList.remove('hidden');
        const ds = scoreDom(dom);
        document.getElementById('domValue').textContent = dom.toFixed(1) + '%';
        document.getElementById('domValue').style.color = tier(ds).color;
        document.getElementById('domLabel').textContent =
          dom > 58 ? 'BTC-led market' : dom > 48 ? 'Balanced market' : 'Altcoin season';
        setBadge('domBadge', ds);
        setTimeout(() => {
          document.getElementById('domBar').style.width = clamp(((dom - 30) / 40) * 100, 0, 100) + '%';
          document.getElementById('domBar').style.background = tier(ds).color;
        }, 100);
        renderZoneBar('zones-dom', dom > 60 ? 0 : dom > 55 ? 1 : dom > 50 ? 2 : dom > 40 ? 3 : 4);
      } else {
        domCard.classList.add('hidden');
      }

      // Stats row (crypto only)
      const statsRow = document.getElementById('statsRow');
      if (isCrypto && marketCap) {
        statsRow.classList.remove('hidden');
        document.getElementById('statMarketCap').textContent = fmtBig(marketCap);
        document.getElementById('statVolume').textContent    = fmtBig(volume);
        document.getElementById('statATH').innerHTML         = colorPct(athPct);
        document.getElementById('statSupply').textContent    =
          circSupply ? (circSupply / 1e6).toFixed(2) + 'M ' + asset.symbol : '—';
      } else {
        statsRow.classList.add('hidden');
      }

      // MACD card
      const macdCardEl = document.getElementById('macdCard');
      const macdData   = computeMACD(prices);
      if (macdData) {
        macdCardEl.classList.remove('hidden');
        const { macdLine: ml, signal: sig, histogram: hist } = macdData;
        const isBull    = hist > 0;
        const macdColor = isBull ? '#10b981' : '#ef4444';
        document.getElementById('macdHistValue').textContent = fmtMacd(hist);
        document.getElementById('macdHistValue').style.color = macdColor;
        document.getElementById('macdDir').textContent       = isBull ? 'Bullish' : 'Bearish';
        document.getElementById('macdLine').textContent      = fmtMacd(ml);
        document.getElementById('macdLine').style.color      = macdColor;
        document.getElementById('macdSignal').textContent    = fmtMacd(sig);
        const macdBadgeEl    = document.getElementById('macdBadge');
        macdBadgeEl.textContent = isBull ? 'BULLISH' : 'BEARISH';
        macdBadgeEl.className   = `text-xs font-bold px-2 py-0.5 rounded-md ${isBull ? 'bg-emerald-900/80 text-emerald-300' : 'bg-red-900/80 text-red-400'}`;
      } else {
        macdCardEl.classList.add('hidden');
      }

      // Bollinger card
      const bollCardEl = document.getElementById('bollingerCard');
      const bollData   = computeBollinger(prices);
      if (bollData) {
        bollCardEl.classList.remove('hidden');
        const { pctB } = bollData;
        const bs = scoreBollinger(pctB);
        const bt = tier(bs);
        document.getElementById('bollingerValue').textContent = pctB.toFixed(2);
        document.getElementById('bollingerValue').style.color = bt.color;
        document.getElementById('bollingerLabel').textContent =
          pctB < 0 ? 'Below Lower Band' : pctB < 0.2 ? 'Near Lower Band' :
          pctB < 0.8 ? 'Within Bands' : pctB < 1.0 ? 'Near Upper Band' : 'Above Upper Band';
        setBadge('bollingerBadge', bs);
        setTimeout(() => {
          document.getElementById('bollingerNeedle').style.left = clamp((pctB / 1.5) * 100, 0, 100) + '%';
        }, 100);
        renderZoneBar('zones-bollinger', pctB < 0 ? 0 : pctB < 0.2 ? 1 : pctB < 0.8 ? 2 : pctB < 1.0 ? 3 : 4);
      } else {
        bollCardEl.classList.add('hidden');
      }

      // Chart
      currentTF = '1M';
      document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === '1M');
      });
      renderChart(tss.slice(-30), prices.slice(-30), ma50val, ma200val, '1M', asset);
      _syncOverlayBtns();

      // Score history chart
      currentScoreTF = '90d';
      renderScoreHistoryChart(asset, '90d');
    }

    // ── Price alert helpers ───────────────────────────────────────────────
    function saveAssetAlert() {
      if (!expandedAssetId) return;
      const rawPrice = document.getElementById('alertPriceInput').value.trim();
      const rawScore = document.getElementById('alertScoreInput').value.trim();
      const cfg = {
        priceBelow: rawPrice ? parseFloat(rawPrice) : null,
        scoreBelow: rawScore ? parseFloat(rawScore) : null,
      };
      setAlertForAsset(expandedAssetId, cfg);
      const btn = document.getElementById('alertSaveBtn');
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save Alert'; }, 1500);
      if (cfg.priceBelow != null || cfg.scoreBelow != null) {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(r => { if (r === 'granted') setNotifEnabled(true); });
        }
      }
    }
    function clearAssetAlert() {
      if (!expandedAssetId) return;
      setAlertForAsset(expandedAssetId, { priceBelow: null, scoreBelow: null });
      document.getElementById('alertPriceInput').value = '';
      document.getElementById('alertScoreInput').value = '';
    }

    // ── Metrics summary table ─────────────────────────────────────────────
    function renderMetricsTable(scores, assetData, isBtc) {
      const { fngVal, rsiVal, ma50val, ma200val, c30, dom, price } = assetData;
      const rows = [];

      const addRow = (label, value, scoreVal, zoneIdx, zonesKey) => {
        if (scoreVal == null) return;
        const t = tier(scoreVal);
        const segs = ZONE_BAR_CONFIG[zonesKey];
        const miniBar = ZONE_COLORS.map((c, i) =>
          `<span style="display:inline-block;width:${100/5}%;height:10px;background:${c};opacity:${i===zoneIdx?1:0.22};"></span>`
        ).join('');
        rows.push(`
          <tr class="border-b border-gray-800/60">
            <td class="px-5 py-3 text-sm text-gray-300">${label}</td>
            <td class="px-4 py-3 text-sm font-semibold tabular-nums text-right" style="color:${t.color}">${value}</td>
            <td class="px-4 py-3">
              <div style="display:flex;border-radius:3px;overflow:hidden;width:100%;height:10px;">${miniBar}</div>
              <div class="text-xs mt-1" style="color:${t.color}">${t.label}</div>
            </td>
          </tr>`);
      };

      if (fngVal != null) addRow('Fear & Greed', fngVal, scores.fng, fngVal < 15 ? 0 : fngVal < 45 ? 1 : fngVal < 55 ? 2 : fngVal < 85 ? 3 : 4, 'zones-fng');
      if (rsiVal != null) addRow('RSI (14-Day)', rsiVal.toFixed(1), scores.rsi, rsiVal < 25 ? 0 : rsiVal < 45 ? 1 : rsiVal < 55 ? 2 : rsiVal < 75 ? 3 : 4, 'zones-rsi');
      if (ma200val) {
        const r = price / ma200val;
        addRow('vs 200d MA', fmtPct((r-1)*100), scores.vs200, r < 0.7 ? 0 : r < 1.0 ? 1 : r < 1.2 ? 2 : r < 2.5 ? 3 : 4, 'zones-ma200');
      }
      if (ma50val) {
        const r = price / ma50val;
        addRow('vs 50d MA', fmtPct((r-1)*100), scores.vs50, r < 0.85 ? 0 : r < 0.95 ? 1 : r < 1.05 ? 2 : r < 1.5 ? 3 : 4, 'zones-ma50');
      }
      if (c30 != null) addRow('30-Day Change', fmtPct(c30), scores.chg30, c30 < -30 ? 0 : c30 < -5 ? 1 : c30 < 5 ? 2 : c30 < 60 ? 3 : 4, 'zones-chg30');
      if (isBtc && dom != null) addRow('BTC Dominance', dom.toFixed(1) + '%', scores.dom, dom > 60 ? 0 : dom > 55 ? 1 : dom > 50 ? 2 : dom > 40 ? 3 : 4, 'zones-dom');
      if (scores.bollinger != null) {
        const boll = computeBollinger(assetData.prices);
        if (boll) {
          const pctB = boll.pctB;
          addRow('Bollinger %B', pctB.toFixed(2), scores.bollinger,
            pctB < 0 ? 0 : pctB < 0.2 ? 1 : pctB < 0.8 ? 2 : pctB < 1.0 ? 3 : 4, 'zones-bollinger');
        }
      }

      document.getElementById('metricsTableBody').innerHTML = rows.join('') ||
        '<tr><td colspan="3" class="px-5 py-4 text-gray-500 text-sm">No metrics available</td></tr>';
    }

    // ── DCA Signal section ────────────────────────────────────────────────
    function renderDcaSection(comp) {
      document.getElementById('dcaSection')?.classList.remove('hidden');
      const el = document.getElementById('dcaContent');
      if (!el) return;
      const sig = computeDcaSignal(comp);
      const dotPct = clamp((comp / 10) * 100, 2, 98);
      el.innerHTML = `
        <div class="flex items-center justify-between gap-4 mb-4">
          <div class="min-w-0">
            <div class="text-2xl font-black leading-tight" style="color:${sig.color}">${sig.action}</div>
            <p class="text-gray-400 text-sm mt-1 leading-snug">${sig.context}</p>
          </div>
          <div class="text-center shrink-0">
            <div class="text-4xl font-black tabular-nums" style="color:${sig.color}">${sig.multiplier}</div>
            <div class="text-gray-500 text-xs mt-0.5">of normal DCA</div>
          </div>
        </div>
        <div class="h-3 score-gradient rounded-full relative mb-1.5">
          <div class="meter-dot absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg ring-2 ring-gray-950" style="left:${dotPct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-gray-600 px-0.5">
          <span>Double Down</span><span>Buy More</span><span>Normal</span><span>Reduce</span><span>Pause</span>
        </div>`;
    }

    // ── Chart ─────────────────────────────────────────────────────────────
    function _tsToChartPx(tss, ts, xScale) {
      if (!tss || tss.length === 0) return null;
      let closest = 0, minDiff = Infinity;
      for (let i = 0; i < tss.length; i++) {
        const d = Math.abs(tss[i] - ts);
        if (d < minDiff) { minDiff = d; closest = i; }
      }
      if (minDiff > 7 * 864e5) return null;
      return xScale.getPixelForValue(closest);
    }

    function renderChart(tss, prices, ma50val, ma200val, tf = '1M', asset = null) {
      // Cache chart state for overlay toggles
      _chartTss = tss; _chartPrices = prices; _chartMa50 = ma50val; _chartMa200 = ma200val; _chartAsset = asset;

      const maxTicks = { '1D': 8, '1W': 7, '1M': 7, '6M': 7, '1Y': 8, 'MAX': 8 }[tf] ?? 7;
      const labels = tss.map(ts => {
        const d = new Date(ts);
        if (tf === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (tf === 'MAX') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });

      if (chart) { chart.destroy(); chart = null; }

      const ctx = document.getElementById('priceChart').getContext('2d');
      const datasets = [{
        label: 'Price',
        data: prices,
        borderColor: '#60a5fa',
        backgroundColor: 'rgba(96,165,250,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }];
      if (ma50val != null && chartOverlays.ma50) datasets.push({
        label: '50d MA', data: prices.map(() => ma50val),
        borderColor: '#fbbf24', borderWidth: 1.5, borderDash: [6, 4],
        pointRadius: 0, fill: false, tension: 0,
      });
      if (ma200val != null && chartOverlays.ma200) datasets.push({
        label: '200d MA', data: prices.map(() => ma200val),
        borderColor: '#fb923c', borderWidth: 1.5, borderDash: [6, 4],
        pointRadius: 0, fill: false, tension: 0,
      });

      // Bollinger band envelope
      if (chartOverlays.bb) {
        const boll = rollingBollinger(prices);
        if (boll.some(b => b !== null)) {
          datasets.push({
            label: 'BB Upper',
            data: boll.map(b => b?.upper ?? null),
            borderColor: 'rgba(148,163,184,0.3)',
            backgroundColor: 'rgba(148,163,184,0.07)',
            borderWidth: 1,
            fill: { target: '+1' },
            pointRadius: 0,
            tension: 0.2,
            spanGaps: false,
          });
          datasets.push({
            label: 'BB Lower',
            data: boll.map(b => b?.lower ?? null),
            borderColor: 'rgba(148,163,184,0.3)',
            borderWidth: 1,
            fill: false,
            pointRadius: 0,
            tension: 0.2,
            spanGaps: false,
          });
        }
      }

      // Score zone background plugin — horizontal price bands anchored to 200d MA thresholds
      const scoreZoneBgPlugin = {
        id: 'scoreZoneBg',
        beforeDraw(ch) {
          if (!chartOverlays.zones || !ma200val) return;
          const { ctx: c, chartArea, scales: { y } } = ch;
          if (!chartArea) return;
          const bands = [
            { lo: 0,              hi: ma200val * 0.7,  color: 'rgba(16,185,129,0.18)'  },
            { lo: ma200val * 0.7, hi: ma200val * 1.0,  color: 'rgba(132,204,22,0.15)'  },
            { lo: ma200val * 1.0, hi: ma200val * 1.2,  color: 'rgba(234,179,8,0.14)'   },
            { lo: ma200val * 1.2, hi: ma200val * 2.5,  color: 'rgba(249,115,22,0.15)'  },
            { lo: ma200val * 2.5, hi: Infinity,         color: 'rgba(239,68,68,0.18)'   },
          ];
          const visLo = y.getValueForPixel(chartArea.bottom);
          const visHi = y.getValueForPixel(chartArea.top);
          for (const band of bands) {
            const lo = Math.max(band.lo, visLo);
            const hi = Math.min(band.hi === Infinity ? visHi : band.hi, visHi);
            if (lo >= hi) continue;
            const py1 = y.getPixelForValue(hi);
            const py2 = y.getPixelForValue(lo);
            c.fillStyle = band.color;
            c.fillRect(chartArea.left, py1, chartArea.right - chartArea.left, py2 - py1);
          }
        }
      };

      chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              filter: item => !item.dataset.label.startsWith('BB'),
              backgroundColor: '#111827',
              titleColor: '#9ca3af',
              bodyColor: '#f9fafb',
              borderColor: '#374151',
              borderWidth: 1,
              callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtPrice(ctx.raw)}` },
            },
          },
          scales: {
            x: { grid: { color: '#1f2937' }, ticks: { color: '#6b7280', maxTicksLimit: maxTicks, font: { size: 11 } } },
            y: {
              grid: { color: '#1f2937' },
              ticks: { color: '#6b7280', font: { size: 11 }, callback: v => {
                if (v >= 1000) return '$' + (v/1000).toFixed(0) + 'k';
                if (v >= 1) return '$' + v.toFixed(0);
                return '$' + v.toFixed(2);
              }},
            },
          },
        },
        plugins: [scoreZoneBgPlugin],
      });
    }

    function toggleOverlay(key) {
      if (!(key in chartOverlays)) return;
      chartOverlays[key] = !chartOverlays[key];
      const btn = document.querySelector(`[data-overlay="${key}"]`);
      if (btn) btn.classList.toggle('opacity-30', !chartOverlays[key]);
      if (_chartTss) renderChart(_chartTss, _chartPrices, _chartMa50, _chartMa200, currentTF, _chartAsset);
    }

    function _syncOverlayBtns() {
      Object.keys(chartOverlays).forEach(key => {
        const btn = document.querySelector(`[data-overlay="${key}"]`);
        if (btn) btn.classList.toggle('opacity-30', !chartOverlays[key]);
      });
    }

    // ── TF switcher ───────────────────────────────────────────────────────
    async function switchTF(tf) {
      if (tf === currentTF) return;
      currentTF = tf;
      document.querySelectorAll('.tf-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tf === tf);
      });
      const spinner = document.getElementById('chartSpinner');
      spinner.classList.remove('hidden');
      try {
        const cfg = TF_CONFIG[tf];
        let tss, prices;
        if (cfg.useExisting) {
          const cached = expandedAssetId ? getAssetCache(expandedAssetId) : null;
          if (!cached) { spinner.classList.add('hidden'); return; }
          const sliced = cached.tss.map((t, i) => ({ t, p: cached.prices[i] })).slice(-cfg.slice);
          tss    = sliced.map(x => x.t);
          prices = sliced.map(x => x.p);
        } else {
          const cacheKey = expandedAssetId + '_' + tf;
          if (!tfCache[cacheKey]) {
            const assets = loadTrackedAssets();
            const asset  = assets.find(a => a.id === expandedAssetId);
            if (asset?.type === 'crypto') {
              let path = `/coins/${asset.coingeckoId}/market_chart?vs_currency=usd&days=${cfg.days}`;
              if (cfg.interval) path += `&interval=${cfg.interval}`;
              const data = await cgFetch(path);
              tfCache[cacheKey] = { tss: data.prices.map(p => p[0]), prices: data.prices.map(p => p[1]) };
            } else if (asset) {
              const rangeMap = { '1D': '1d', '1W': '5d', '1Y': '1y', 'MAX': 'max' };
              const intervalMap = { '1D': '5m', '1W': '1h', '1Y': '1d', 'MAX': '1wk' };
              const range = rangeMap[tf] || '1mo';
              const interval = intervalMap[tf] || '1d';
              const url = `https://query1.finance.yahoo.com/v8/finance/chart/${asset.yahooSymbol}?range=${range}&interval=${interval}`;
              const json = await yahooFetch(url);
              const result = json.chart?.result?.[0];
              if (result) {
                const rawTs = result.timestamp ?? [];
                const rawP  = result.indicators?.quote?.[0]?.close ?? [];
                const pairs = rawTs.map((t, i) => ({ t: t*1000, p: rawP[i] })).filter(x => x.p != null);
                tfCache[cacheKey] = { tss: pairs.map(x=>x.t), prices: pairs.map(x=>x.p) };
              }
            }
          }
          if (!tfCache[cacheKey]) { spinner.classList.add('hidden'); return; }
          tss    = tfCache[cacheKey].tss;
          prices = tfCache[cacheKey].prices;
        }
        const c = getAssetCache(expandedAssetId);
        const assetForChart = loadTrackedAssets().find(a => a.id === expandedAssetId) ?? null;
        renderChart(tss, prices, c?.ma50val ?? null, c?.ma200val ?? null, tf, assetForChart);
      } catch (err) {
        console.error('TF switch error:', err);
      } finally {
        spinner.classList.add('hidden');
      }
    }

    // ── Table column helpers ──────────────────────────────────────────────
    function getTableCols() {
      try {
        const s = JSON.parse(localStorage.getItem(TABLE_COLS_KEY));
        if (Array.isArray(s) && s.length) return s;
      } catch {}
      return TABLE_COLS_DEFAULT.map(c => ({ ...c }));
    }
    function saveTableCols(cols) { localStorage.setItem(TABLE_COLS_KEY, JSON.stringify(cols)); }

    function _tableColCell(key, r) {
      const { assetData, comp, t } = r;
      const gray = '<span class="text-gray-600">—</span>';
      switch (key) {
        case 'score': return `<td class="text-right px-3 font-bold tabular-nums" style="color:${t.color}">${comp.toFixed(1)}</td>`;
        case 'zone':  return `<td class="px-3 text-xs font-semibold" style="color:${t.color}">${t.label}</td>`;
        case 'rsi':   return `<td class="text-right px-3 tabular-nums text-gray-300">${assetData.rsiVal != null ? assetData.rsiVal.toFixed(0) : gray}</td>`;
        case 'vs200': { const v = assetData.price && assetData.ma200val ? (assetData.price / assetData.ma200val - 1) * 100 : null;
                        return `<td class="text-right px-3 tabular-nums">${v != null ? colorPct(v) : gray}</td>`; }
        case 'chg30': return `<td class="text-right px-3 tabular-nums">${assetData.c30 != null ? colorPct(assetData.c30) : gray}</td>`;
        case 'price': return `<td class="text-right pl-3 tabular-nums text-gray-300">${fmtPrice(assetData.price)}</td>`;
        case 'dca':   { const sig = computeDcaSignal(comp);
                        return `<td class="text-right px-3 tabular-nums text-xs font-semibold"><span style="color:${sig.color}">${sig.action} ${sig.multiplier}×</span></td>`; }
      }
      return '<td></td>';
    }

    function _tableColHeader(col) {
      const ind = `<span class="sort-ind" data-col="${col.sortKey ?? col.key}"></span>`;
      if (col.sortKey) return `<th class="text-right py-2.5 px-3 font-medium cursor-pointer hover:text-gray-300" onclick="sortTable('${col.sortKey}')">${col.label} ${ind}</th>`;
      if (col.key === 'zone') return `<th class="text-left py-2.5 px-3 font-medium">${col.label}</th>`;
      return `<th class="text-right py-2.5 px-3 font-medium">${col.label}</th>`;
    }

    // ── Table view ────────────────────────────────────────────────────────
    function renderTableView() {
      const head = document.getElementById('tableHead');
      const body = document.getElementById('tableBody');
      if (!body) return;

      const cols = getTableCols().filter(c => c.visible);

      // Build header
      if (head) {
        head.innerHTML = `<tr class="text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-800 select-none">
          <th class="text-left py-2.5 pr-4 font-medium cursor-pointer hover:text-gray-300" onclick="sortTable('name')">Asset <span class="sort-ind" data-col="name"></span></th>
          ${cols.map(_tableColHeader).join('')}
          <th class="py-2.5 pl-3 w-8"></th>
        </tr>`;
      }

      const rows = [..._tableRows].sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        const col = tableSort.col;
        let av, bv;
        if (col === 'name')  { av = a.asset.name.toLowerCase(); bv = b.asset.name.toLowerCase(); }
        if (col === 'score') { av = a.comp ?? -1; bv = b.comp ?? -1; }
        if (col === 'rsi')   { av = a.assetData?.rsiVal ?? -1; bv = b.assetData?.rsiVal ?? -1; }
        if (col === 'vs200') {
          av = a.assetData?.price && a.assetData?.ma200val ? (a.assetData.price / a.assetData.ma200val - 1) * 100 : -Infinity;
          bv = b.assetData?.price && b.assetData?.ma200val ? (b.assetData.price / b.assetData.ma200val - 1) * 100 : -Infinity;
        }
        if (col === 'chg30') { av = a.assetData?.c30 ?? -Infinity; bv = b.assetData?.c30 ?? -Infinity; }
        if (av < bv) return tableSort.asc ? -1 : 1;
        if (av > bv) return tableSort.asc ? 1 : -1;
        return 0;
      });

      document.querySelectorAll('.sort-ind').forEach(el => {
        el.textContent = el.dataset.col === tableSort.col ? (tableSort.asc ? '↑' : '↓') : '';
      });

      const trashIcon = `<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;

      body.innerHTML = rows.map(r => {
        if (r.error) {
          return `<tr class="border-b border-gray-800/50">
            <td class="py-3 pr-4">
              <div class="flex items-center gap-2.5">
                ${assetAvatar(r.asset, { bg: '#1f2937', border: '#374151', color: '#6b7280' })}
                <div><div class="font-medium text-gray-500">${r.asset.name}</div><div class="text-[11px] text-gray-600">${r.asset.symbol}</div></div>
              </div>
            </td>
            <td colspan="${cols.length}" class="text-xs text-gray-600 px-3">Unable to load</td>
            <td class="pl-3"><button onclick="event.stopPropagation();removeAsset('${r.asset.id}')" class="text-gray-600 hover:text-red-400 transition-colors" title="Remove">${trashIcon}</button></td>
          </tr>`;
        }
        const { asset } = r;
        return `<tr class="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors" onclick="expandAsset('${asset.id}')">
          <td class="py-3 pr-4">
            <div class="flex items-center gap-2.5">
              ${assetAvatar(asset, r.t)}
              <div><div class="font-medium text-white">${asset.name}</div><div class="text-[11px] text-gray-500">${asset.symbol}</div></div>
            </div>
          </td>
          ${cols.map(c => _tableColCell(c.key, r)).join('')}
          <td class="pl-3"><button onclick="event.stopPropagation();removeAsset('${asset.id}')" class="text-gray-600 hover:text-red-400 transition-colors" title="Remove">${trashIcon}</button></td>
        </tr>`;
      }).join('');
    }

    function switchView(view) {
      currentView = view;
      document.querySelectorAll('.view-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.view === view)
      );
      document.getElementById('colPickerBtn')?.classList.toggle('hidden', view !== 'table');
      if (view !== 'table') closeColPicker();
      renderCardsView(currentFilter);
    }

    // ── Column picker ─────────────────────────────────────────────────────
    function openColPicker() {
      const panel = document.getElementById('colPicker');
      if (!panel) return;
      _renderColPickerList();
      panel.classList.toggle('hidden');
    }
    function closeColPicker() {
      document.getElementById('colPicker')?.classList.add('hidden');
    }
    function _renderColPickerList() {
      const cols = getTableCols();
      document.getElementById('colPickerList').innerHTML = cols.map((col, i) => `
        <div class="flex items-center gap-2 py-1 px-1 rounded" style="transition:background 0.1s" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
          <div class="flex flex-col gap-px">
            <button onclick="moveTableCol('${col.key}',-1)" ${i === 0 ? 'disabled' : ''} class="text-gray-500 hover:text-white text-[10px] leading-none disabled:opacity-20">▲</button>
            <button onclick="moveTableCol('${col.key}',1)"  ${i === cols.length - 1 ? 'disabled' : ''} class="text-gray-500 hover:text-white text-[10px] leading-none disabled:opacity-20">▼</button>
          </div>
          <label class="flex items-center gap-2 flex-1 cursor-pointer select-none">
            <input type="checkbox" ${col.visible ? 'checked' : ''} onchange="toggleTableCol('${col.key}')"
              class="w-3.5 h-3.5 accent-orange-500 cursor-pointer">
            <span class="text-sm text-gray-300">${col.label}</span>
          </label>
        </div>`).join('');
    }
    function toggleTableCol(key) {
      const cols = getTableCols();
      const col = cols.find(c => c.key === key);
      if (col) col.visible = !col.visible;
      saveTableCols(cols);
      _renderColPickerList();
      renderTableView();
    }
    function moveTableCol(key, dir) {
      const cols = getTableCols();
      const idx = cols.findIndex(c => c.key === key);
      const swap = idx + dir;
      if (swap < 0 || swap >= cols.length) return;
      [cols[idx], cols[swap]] = [cols[swap], cols[idx]];
      saveTableCols(cols);
      _renderColPickerList();
      renderTableView();
    }

    function sortTable(col) {
      if (tableSort.col === col) {
        tableSort.asc = !tableSort.asc;
      } else {
        tableSort = { col, asc: col === 'name' };
      }
      renderTableView();
    }

    // ── Score history chart ───────────────────────────────────────────────
    function renderScoreHistoryChart(asset, tf) {
      const section = document.getElementById('scoreHistorySection');
      const raw = JSON.parse(localStorage.getItem('score_history_' + asset.id) || '[]');
      const cutoff = tf === 'all' ? 0 : Date.now() - (tf === '30d' ? 30 : 90) * 864e5;
      const hist = raw.filter(h => h.ts >= cutoff);
      if (hist.length < 3) { section.classList.add('hidden'); return; }
      section.classList.remove('hidden');

      document.querySelectorAll('.score-tf-btn').forEach(btn =>
        btn.classList.toggle('text-white', btn.dataset.stf === tf)
      );

      const labels = hist.map(h => {
        const d = new Date(h.ts);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      const scores = hist.map(h => h.score);

      if (scoreChart) { scoreChart.destroy(); scoreChart = null; }

      const zonesPlugin = {
        id: 'scoreZones',
        beforeDraw(chart) {
          const { ctx, chartArea, scales: { y } } = chart;
          if (!chartArea) return;
          [{ from: 0, to: 3, color: 'rgba(16,185,129,0.07)' },
           { from: 3, to: 6, color: 'rgba(234,179,8,0.07)' },
           { from: 6, to: 10, color: 'rgba(239,68,68,0.07)' }]
          .forEach(z => {
            ctx.fillStyle = z.color;
            ctx.fillRect(chartArea.left, y.getPixelForValue(z.to),
                         chartArea.width, y.getPixelForValue(z.from) - y.getPixelForValue(z.to));
          });
        }
      };

      const ctx = document.getElementById('scoreChart').getContext('2d');
      scoreChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: scores,
            borderColor: '#fb923c',
            backgroundColor: 'rgba(251,146,60,0.08)',
            fill: true,
            tension: 0.3,
            pointRadius: hist.length > 20 ? 0 : 3,
            borderWidth: 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#111827',
              titleColor: '#9ca3af',
              bodyColor: '#f9fafb',
              borderColor: '#374151',
              borderWidth: 1,
              callbacks: { label: ctx => ` Score: ${ctx.raw.toFixed(1)}` },
            },
          },
          scales: {
            x: { grid: { color: '#1f2937' }, ticks: { color: '#6b7280', maxTicksLimit: 6, font: { size: 11 } } },
            y: {
              min: 0, max: 10,
              grid: { color: '#1f2937' },
              ticks: { color: '#6b7280', font: { size: 11 }, stepSize: 2 },
            },
          },
        },
        plugins: [zonesPlugin],
      });
    }

    function switchScoreTF(tf) {
      currentScoreTF = tf;
      if (expandedAssetId) {
        const asset = loadTrackedAssets().find(a => a.id === expandedAssetId);
        if (asset) renderScoreHistoryChart(asset, tf);
      }
    }
