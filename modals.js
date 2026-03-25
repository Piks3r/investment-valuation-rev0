    // ── Popular asset lists ───────────────────────────────────────────────
    const POPULAR = {
      crypto: [
        { id:'bitcoin',     symbol:'BTC',  name:'Bitcoin',      coingeckoId:'bitcoin',     yahooSymbol:null },
        { id:'ethereum',    symbol:'ETH',  name:'Ethereum',     coingeckoId:'ethereum',    yahooSymbol:null },
        { id:'solana',      symbol:'SOL',  name:'Solana',       coingeckoId:'solana',      yahooSymbol:null },
        { id:'binancecoin', symbol:'BNB',  name:'BNB',          coingeckoId:'binancecoin', yahooSymbol:null },
        { id:'ripple',      symbol:'XRP',  name:'XRP',          coingeckoId:'ripple',      yahooSymbol:null },
        { id:'cardano',     symbol:'ADA',  name:'Cardano',      coingeckoId:'cardano',     yahooSymbol:null },
        { id:'dogecoin',    symbol:'DOGE', name:'Dogecoin',     coingeckoId:'dogecoin',    yahooSymbol:null },
        { id:'avalanche-2', symbol:'AVAX', name:'Avalanche',    coingeckoId:'avalanche-2', yahooSymbol:null },
      ],
      stock: [
        { id:'yf_nvda',  symbol:'NVDA',  name:'NVIDIA',        coingeckoId:null, yahooSymbol:'NVDA'  },
        { id:'yf_aapl',  symbol:'AAPL',  name:'Apple',         coingeckoId:null, yahooSymbol:'AAPL'  },
        { id:'yf_msft',  symbol:'MSFT',  name:'Microsoft',     coingeckoId:null, yahooSymbol:'MSFT'  },
        { id:'yf_tsla',  symbol:'TSLA',  name:'Tesla',         coingeckoId:null, yahooSymbol:'TSLA'  },
        { id:'yf_googl', symbol:'GOOGL', name:'Alphabet',      coingeckoId:null, yahooSymbol:'GOOGL' },
        { id:'yf_amzn',  symbol:'AMZN',  name:'Amazon',        coingeckoId:null, yahooSymbol:'AMZN'  },
        { id:'yf_meta',  symbol:'META',  name:'Meta',          coingeckoId:null, yahooSymbol:'META'  },
        { id:'yf_nflx',  symbol:'NFLX',  name:'Netflix',       coingeckoId:null, yahooSymbol:'NFLX'  },
      ],
      etf: [
        { id:'yf_spy',   symbol:'SPY',   name:'S&P 500 ETF',    coingeckoId:null, yahooSymbol:'SPY'  },
        { id:'yf_qqq',   symbol:'QQQ',   name:'Nasdaq 100 ETF', coingeckoId:null, yahooSymbol:'QQQ'  },
        { id:'yf_vti',   symbol:'VTI',   name:'Total Market',   coingeckoId:null, yahooSymbol:'VTI'  },
        { id:'yf_voo',   symbol:'VOO',   name:'Vanguard S&P',   coingeckoId:null, yahooSymbol:'VOO'  },
        { id:'yf_iwm',   symbol:'IWM',   name:'Russell 2000',   coingeckoId:null, yahooSymbol:'IWM'  },
        { id:'yf_gld',   symbol:'GLD',   name:'Gold ETF',       coingeckoId:null, yahooSymbol:'GLD'  },
        { id:'yf_arkk',  symbol:'ARKK',  name:'ARK Innovation', coingeckoId:null, yahooSymbol:'ARKK' },
        { id:'yf_xlk',   symbol:'XLK',   name:'Tech Sector',    coingeckoId:null, yahooSymbol:'XLK'  },
      ],
    };

    // ── Info modal ────────────────────────────────────────────────────────
    function openInfo(key) {
      const info = INFO[key];
      if (!info) return;
      document.getElementById('infoTitle').textContent = info.title;
      document.getElementById('infoDesc').textContent  = info.desc;
      document.getElementById('infoTable').innerHTML = `
        <thead>
          <tr style="border-bottom:1px solid #1f2937">
            <th style="padding:0 12px 8px 0;text-align:left;font-size:11px;font-weight:500;color:#6b7280;white-space:nowrap">Zone</th>
            <th style="padding:0 12px 8px 0;text-align:left;font-size:11px;font-weight:500;color:#6b7280;white-space:nowrap">Range</th>
            <th style="padding:0 0 8px;text-align:left;font-size:11px;font-weight:500;color:#6b7280">What it means</th>
          </tr>
        </thead>
        <tbody>
          ${info.zones.map((z, i) => `
            <tr style="border-bottom:1px solid #111827">
              <td style="padding:8px 12px 8px 0;font-size:12px;font-weight:600;color:${ZONE_COLORS[i]};white-space:nowrap">${z.label}</td>
              <td style="padding:8px 12px 8px 0;font-size:11px;color:#9ca3af;white-space:nowrap;font-family:monospace">${z.range}</td>
              <td style="padding:8px 0;font-size:12px;color:#9ca3af;line-height:1.4">${z.meaning}</td>
            </tr>`).join('')}
        </tbody>`;
      document.getElementById('infoWeight').textContent = 'Weight: ' + info.weight;
      document.getElementById('infoModal').classList.remove('hidden');
    }
    function closeInfo() { document.getElementById('infoModal').classList.add('hidden'); }

    // ── Add asset modal ───────────────────────────────────────────────────
    let activeCategory = 'all';

    function _updateCategoryTabs() {
      ['all','crypto','stock','etf'].forEach(cat => {
        const btn = document.getElementById('catTab-' + cat);
        if (!btn) return;
        if (cat === activeCategory) {
          btn.className = 'add-cat-tab flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors bg-gray-700 text-white';
        } else {
          btn.className = 'add-cat-tab flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors text-gray-400 hover:text-white';
        }
      });
    }

    function setCategory(cat) {
      activeCategory = cat;
      _updateCategoryTabs();
      document.getElementById('assetSearchInput').value = '';
      document.getElementById('searchStatus').classList.add('hidden');
      _showPopular();
    }

    function _showPopular() {
      const tracked  = loadTrackedAssets();
      const trackedIds = new Set(tracked.map(a => a.id));
      let items;
      if (activeCategory === 'all') {
        items = [...POPULAR.crypto, ...POPULAR.stock, ...POPULAR.etf];
      } else {
        items = POPULAR[activeCategory] || [];
      }
      const enriched = items.map(r => ({
        ...r,
        type: r.coingeckoId ? 'crypto' : (r.yahooSymbol && POPULAR.etf.find(e => e.id === r.id) ? 'etf' : 'stock'),
        alreadyAdded: trackedIds.has(r.id),
      }));
      _renderAddResults(enriched, true);
    }

    function _renderAddResults(results, showHeader) {
      const statusEl = document.getElementById('searchStatus');
      const resEl    = document.getElementById('searchResults');
      statusEl.classList.add('hidden');

      if (results.length === 0) {
        resEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No results found.</p>';
        return;
      }

      _searchResults = results;
      const header = showHeader ? '<p class="text-xs text-gray-500 font-medium uppercase tracking-wide px-1 pb-1">Popular</p>' : '';
      resEl.innerHTML = header + results.map((r, idx) => {
        const typeBadge  = r.type === 'crypto' ? 'text-blue-400 bg-blue-900/30' : r.type === 'etf' ? 'text-purple-400 bg-purple-900/30' : 'text-green-400 bg-green-900/30';
        const addedBadge = r.alreadyAdded ? '<span class="text-xs text-gray-500 ml-auto">Added</span>' : '';
        const clickAttr  = r.alreadyAdded ? '' : `onclick="_addFromSearchIdx(${idx})"`;
        const imgOrIcon  = r.thumb
          ? `<img src="${r.thumb}" class="w-8 h-8 rounded-full" onerror="this.style.display='none'" />`
          : `<div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-400">${r.symbol.slice(0,2)}</div>`;
        return `
          <div class="search-result ${r.alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''}" ${clickAttr}>
            ${imgOrIcon}
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm truncate">${r.name}</div>
              <div class="text-xs text-gray-500">${r.symbol}</div>
            </div>
            <span class="text-xs font-bold px-2 py-0.5 rounded-md ${typeBadge} shrink-0">${r.type.toUpperCase()}</span>
            ${addedBadge}
          </div>`;
      }).join('');
    }

    function openAddModal() {
      activeCategory = (currentFilter || 'all').toLowerCase();
      document.getElementById('addModal').classList.remove('hidden');
      document.getElementById('assetSearchInput').value = '';
      document.getElementById('searchStatus').classList.add('hidden');
      _updateCategoryTabs();
      _showPopular();
      setTimeout(() => document.getElementById('assetSearchInput').focus(), 50);
    }
    function closeAddModal() {
      document.getElementById('addModal').classList.add('hidden');
      if (searchTimer) clearTimeout(searchTimer);
    }

    function onSearchInput(val) {
      if (searchTimer) clearTimeout(searchTimer);
      const q = val.trim();
      if (!q) {
        _showPopular();
        return;
      }
      document.getElementById('searchStatus').textContent = 'Searching…';
      document.getElementById('searchStatus').classList.remove('hidden');
      document.getElementById('searchResults').innerHTML = '';
      searchTimer = setTimeout(() => searchAssets(q), 400);
    }

    async function searchAssets(query) {
      try {
        const cat = activeCategory;
        const skipCg  = cat === 'stock' || cat === 'etf';
        const skipYf  = cat === 'crypto';

        const [cgRes, yfRes] = await Promise.allSettled([
          skipCg ? Promise.resolve(null) : cgFetch(`/search?query=${encodeURIComponent(query)}`),
          skipYf ? Promise.resolve(null) : yahooFetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&lang=en-US`),
        ]);

        const results = [];
        const tracked = loadTrackedAssets();
        const trackedIds = new Set(tracked.map(a => a.id));

        // CoinGecko results
        if (cgRes.status === 'fulfilled' && cgRes.value?.coins) {
          cgRes.value.coins.slice(0, 5).forEach(c => {
            const id = c.id;
            results.push({
              id,
              symbol: c.symbol?.toUpperCase() ?? '',
              name: c.name,
              type: 'crypto',
              thumb: c.thumb,
              coingeckoId: id,
              yahooSymbol: null,
              alreadyAdded: trackedIds.has(id),
            });
          });
        }

        // Yahoo Finance results
        if (yfRes.status === 'fulfilled' && yfRes.value?.quotes) {
          yfRes.value.quotes.slice(0, 6).forEach(q => {
            if (!q.symbol || !q.quoteType) return;
            const t = q.quoteType === 'ETF' ? 'etf' : q.quoteType === 'EQUITY' ? 'stock' : null;
            if (!t) return;
            if (cat !== 'all' && t !== cat) return; // filter by active category
            const id = 'yf_' + q.symbol.toLowerCase();
            results.push({ id, symbol: q.symbol, name: q.shortname ?? q.symbol, type: t, coingeckoId: null, yahooSymbol: q.symbol, alreadyAdded: trackedIds.has(id) });
          });
        }

        _renderAddResults(results, false);
      } catch (err) {
        console.error('Search error:', err);
        document.getElementById('searchStatus').textContent = 'Search failed. Try again.';
        document.getElementById('searchStatus').classList.remove('hidden');
      }
    }

    // Called from inline onclick in search results (by index into _searchResults)
    function _addFromSearchIdx(idx) {
      const r = _searchResults[idx];
      if (r) addAsset(r);
    }

    function addAsset(def) {
      const assets = loadTrackedAssets();
      if (assets.find(a => a.id === def.id)) return; // duplicate prevention
      const asset = {
        id:           def.id,
        symbol:       def.symbol,
        name:         def.name,
        type:         def.type,
        coingeckoId:  def.coingeckoId || null,
        yahooSymbol:  def.yahooSymbol || null,
        image:        def.thumb || null,
      };
      assets.push(asset);
      saveTrackedAssets(assets);
      closeAddModal();
      renderCardsView(currentFilter);
    }

    function removeAsset(id) {
      const assets = loadTrackedAssets().filter(a => a.id !== id);
      saveTrackedAssets(assets);
      try { localStorage.removeItem('asset_cache_' + id); } catch {}
      try { localStorage.removeItem('score_history_' + id); } catch {}
      collapseToCards();
      renderCardsView(currentFilter);
    }

    // ── Settings modal ────────────────────────────────────────────────────
    function setWeightSliders(w) {
      document.getElementById('wFng').value   = w.fng;
      document.getElementById('wRsi').value   = w.rsi;
      document.getElementById('wVs200').value = w.vs200;
      document.getElementById('wVs50').value  = w.vs50;
      document.getElementById('wChg30').value = w.chg30;
      document.getElementById('wDom').value   = w.dom;
      updateWeightTotal();
    }
    function loadCustomPresets() {
      try {
        const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
      return {};
    }
    function saveCustomPresets(presets) {
      try { localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets)); } catch {}
    }

    function _presetBtnClass(name) {
      const isActive = name === activePreset;
      return 'py-2 px-4 rounded-lg text-sm font-semibold border transition-all ' + (
        !isActive
          ? 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-orange-500 text-gray-300'
          : name === '__custom__'
          ? 'bg-gray-700 border-amber-400 text-amber-300'
          : 'bg-gray-700 border-orange-500 text-orange-400'
      );
    }

    function renderAllPresetButtons() {
      const row = document.getElementById('allPresetsRow');
      const customPresets = loadCustomPresets();
      const builtIns = ['standard', 'technical', 'sentiment'];
      const customs  = Object.keys(customPresets);

      const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
      const driftBtn = (activePreset === '__custom__' && basedOnPreset)
        ? `<button class="${_presetBtnClass('__custom__')} cursor-default">✏ Custom (${cap(basedOnPreset)})</button>`
        : '';

      row.innerHTML = [
        driftBtn,
        ...builtIns.map(name =>
          `<button onclick="applyWeightPreset('${name}')" class="${_presetBtnClass(name)}">${cap(name)}</button>`),
        ...customs.map(name =>
          `<button onclick="selectCustomPreset('${name.replace(/'/g, "&#39;")}')" class="${_presetBtnClass(name)}">${name}</button>`),
      ].join('');
    }

    function _updatePresetDescription(name) {
      const box = document.getElementById('presetDescBox');
      if (!box) return;
      const info = name && PRESET_INFO[name];
      if (!info) { box.classList.add('hidden'); return; }
      document.getElementById('presetDescTagline').textContent = info.tagline;
      document.getElementById('presetDescText').textContent    = info.desc;
      document.getElementById('presetDescBestFor').textContent = info.bestFor;
      box.classList.remove('hidden');
    }

    // Built-in preset click — apply weights, mark active, exit edit mode
    function applyWeightPreset(name) {
      const p = WEIGHT_PRESETS[name];
      if (!p) return;
      // Set state BEFORE setWeightSliders so updateWeightTotal doesn't false-detect drift
      activePreset  = name;
      basedOnPreset = null;
      setWeightSliders(p);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(p)); } catch {}
      renderCardsView(currentFilter);
      renderAllPresetButtons();
      document.getElementById('customPresetName').value = '';
      document.getElementById('deletePresetBtn').classList.add('hidden');
    }

    // Custom preset click — apply weights, mark active, enter edit mode
    function selectCustomPreset(name) {
      const p = loadCustomPresets()[name];
      if (!p) return;
      // Set state BEFORE setWeightSliders so updateWeightTotal doesn't false-detect drift
      activePreset  = name;
      basedOnPreset = null;
      setWeightSliders(p);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(p)); } catch {}
      renderCardsView(currentFilter);
      renderAllPresetButtons();
      document.getElementById('customPresetName').value = name;
      document.getElementById('deletePresetBtn').classList.remove('hidden');
    }

    function saveCustomPreset() {
      const nameInput = document.getElementById('customPresetName');
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      const ids = ['wFng','wRsi','wVs200','wVs50','wChg30','wDom'];
      const total = ids.reduce((s, id) => s + parseInt(document.getElementById(id).value), 0);
      if (total !== 100) return;
      const w = {
        fng:   parseInt(document.getElementById('wFng').value),
        rsi:   parseInt(document.getElementById('wRsi').value),
        vs200: parseInt(document.getElementById('wVs200').value),
        vs50:  parseInt(document.getElementById('wVs50').value),
        chg30: parseInt(document.getElementById('wChg30').value),
        dom:   parseInt(document.getElementById('wDom').value),
      };
      const presets = loadCustomPresets();
      presets[name] = w;
      saveCustomPresets(presets);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(w)); } catch {}
      basedOnPreset = null;
      activePreset  = name;
      nameInput.value = '';
      document.getElementById('deletePresetBtn').classList.add('hidden');
      renderAllPresetButtons();
      nameInput.placeholder = 'Saved!';
      setTimeout(() => { nameInput.placeholder = 'Name your preset…'; }, 1200);
    }

    // Unified bottom-Save handler: saves as named custom preset if name is set, then applies
    function saveWeights() {
      const nameInput = document.getElementById('customPresetName');
      const name = nameInput.value.trim();
      const builtIns = ['standard', 'technical', 'sentiment'];

      if (name) {
        // Save (or update) as named custom preset
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
        const presets = loadCustomPresets();
        presets[name] = w;
        saveCustomPresets(presets);
        activePreset  = name;
        basedOnPreset = null;
      }

      saveSettings(); // handles weight save + feedback + close + re-render
    }

    function deleteCustomPreset(name) {
      const presets = loadCustomPresets();
      delete presets[name];
      saveCustomPresets(presets);
      if (activePreset === name) activePreset = null;
      document.getElementById('customPresetName').value = '';
      document.getElementById('deletePresetBtn').classList.add('hidden');
      renderAllPresetButtons();
    }

    function deleteActiveCustomPreset() {
      const name = document.getElementById('customPresetName').value.trim();
      if (name) deleteCustomPreset(name);
    }

    function openSettings() {
      // Detect which preset (if any) matches current saved settings
      const current = loadSettings();
      const all = { ...WEIGHT_PRESETS, ...loadCustomPresets() };
      activePreset  = null;
      basedOnPreset = null;
      for (const [name, weights] of Object.entries(all)) {
        if (JSON.stringify(weights) === JSON.stringify(current)) {
          activePreset = name;
          break;
        }
      }
      setWeightSliders(current);
      const builtIns = ['standard', 'technical', 'sentiment'];
      if (activePreset && !builtIns.includes(activePreset)) {
        document.getElementById('customPresetName').value = activePreset;
        document.getElementById('deletePresetBtn').classList.remove('hidden');
      } else {
        document.getElementById('customPresetName').value = '';
        document.getElementById('deletePresetBtn').classList.add('hidden');
      }
      renderAllPresetButtons();
      const hasCrypto = loadTrackedAssets().some(a => a.type === 'crypto');
      ['wFngRow', 'wDomRow'].forEach(id => {
        const row = document.getElementById(id);
        if (row) row.classList.toggle('opacity-40', !hasCrypto);
      });
      const cryptoNote = document.getElementById('cryptoOnlyNote');
      if (cryptoNote) cryptoNote.classList.toggle('hidden', hasCrypto);
      document.getElementById('settingsModal').classList.remove('hidden');
    }
    function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }

    function openAlertsModal() {
      renderAlertsModal();
      updateNotifUI();
      document.getElementById('alertsModal').classList.remove('hidden');
    }
    function closeAlertsModal() { document.getElementById('alertsModal').classList.add('hidden'); }
    function renderAlertsModal() {
      const assets = loadTrackedAssets();
      const all = loadAlerts();
      const active = assets.filter(a => {
        const cfg = all[a.id];
        return cfg && (cfg.priceBelow != null || cfg.scoreBelow != null);
      });
      const body = document.getElementById('alertsModalBody');
      if (!active.length) {
        body.innerHTML = '<p class="text-gray-500 text-sm text-center py-6">No alerts saved yet.<br><span class="text-gray-600 text-xs">Open any asset and set a price or score alert.</span></p>';
        return;
      }
      body.innerHTML = `
        <div class="space-y-2 mb-4">
          ${active.map(a => {
            const cfg = all[a.id];
            const priceTag = cfg.priceBelow != null
              ? `<span class="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300">Price &lt; ${fmtPrice(cfg.priceBelow)}</span>`
              : '';
            const scoreTag = cfg.scoreBelow != null
              ? `<span class="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-xs text-gray-300">Score &lt; ${cfg.scoreBelow}</span>`
              : '';
            return `
              <div class="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
                <div class="min-w-0">
                  <div class="text-sm font-semibold truncate">${a.name} <span class="text-gray-500 font-normal text-xs">${a.symbol}</span></div>
                  <div class="flex flex-wrap gap-1.5 mt-1.5">${priceTag}${scoreTag}</div>
                </div>
                <button onclick="clearAlertFromModal('${a.id}')"
                  class="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 transition-colors">
                  Clear
                </button>
              </div>`;
          }).join('')}
        </div>
        <button onclick="clearAllAlerts()"
          class="w-full py-2 rounded-lg text-xs font-semibold bg-gray-800 hover:bg-red-900/30 border border-gray-700 hover:border-red-700/50 text-gray-500 hover:text-red-400 transition-colors">
          Clear All Alerts
        </button>`;
    }
    function clearAlertFromModal(id) {
      setAlertForAsset(id, { priceBelow: null, scoreBelow: null });
      renderAlertsModal();
    }
    function clearAllAlerts() {
      try { localStorage.removeItem('asset_alerts_v1'); } catch {}
      renderAlertsModal();
    }

    function updateWeightTotal() {
      const ids        = ['wFng','wRsi','wVs200','wVs50','wChg30','wDom'];
      const keys       = ['fng','rsi','vs200','vs50','chg30','dom'];
      const displayIds = ['wFngDisplay','wRsiDisplay','wVs200Display','wVs50Display','wChg30Display','wDomDisplay'];
      let total = 0;
      const current = {};
      ids.forEach((id, i) => {
        const val = parseInt(document.getElementById(id).value);
        total += val;
        current[keys[i]] = val;
        document.getElementById(displayIds[i]).textContent = val + '%';
      });
      const totalEl = document.getElementById('weightTotal');
      const saveBtn = document.getElementById('saveWeightsBtn');
      totalEl.textContent = total + '%';
      totalEl.style.color = total === 100 ? '#10b981' : '#ef4444';
      saveBtn.disabled    = total !== 100;

      // Auto-deselect preset if sliders no longer match it
      if (activePreset && activePreset !== '__custom__') {
        const builtIns = ['standard', 'technical', 'sentiment'];
        const all    = { ...WEIGHT_PRESETS, ...loadCustomPresets() };
        const preset = all[activePreset];
        if (!preset || JSON.stringify(preset) !== JSON.stringify(current)) {
          if (builtIns.includes(activePreset)) {
            basedOnPreset = activePreset;
            activePreset  = '__custom__';
            const nameInput = document.getElementById('customPresetName');
            if (!nameInput.value.trim()) {
              nameInput.value = 'My ' + basedOnPreset.charAt(0).toUpperCase() + basedOnPreset.slice(1);
            }
            nameInput.focus();
            nameInput.select();
          } else {
            // Custom preset — keep it highlighted, user is editing it in-place
          }
          renderAllPresetButtons();
        }
      }
    }

    // ── Notifications ─────────────────────────────────────────────────────
    function updateNotifUI() {
      const btn  = document.getElementById('notifToggleBtn');
      const note = document.getElementById('notifPermissionNote');
      if (!btn) return;
      const supported = 'Notification' in window;
      const perm    = supported ? Notification.permission : 'denied';
      const enabled = getNotifEnabled();
      note.classList.add('hidden');
      if (!supported) {
        btn.textContent = 'Not supported';
        btn.className   = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 text-gray-500 cursor-not-allowed';
        btn.disabled    = true;
        return;
      }
      if (perm === 'denied') {
        btn.textContent = 'Blocked';
        btn.className   = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 text-red-400 cursor-not-allowed';
        btn.disabled    = true;
        note.classList.remove('hidden');
        return;
      }
      btn.disabled = false;
      if (perm === 'granted' && enabled) {
        btn.textContent = 'Alerts On';
        btn.className   = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-emerald-100 transition-colors';
      } else {
        btn.textContent = perm === 'default' ? 'Enable Alerts' : 'Alerts Off';
        btn.className   = 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors';
      }
    }
    async function toggleNotifications() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result === 'granted') setNotifEnabled(true);
      } else if (Notification.permission === 'granted') {
        setNotifEnabled(!getNotifEnabled());
      }
      updateNotifUI();
    }

    // ── Filter ────────────────────────────────────────────────────────────
    function setFilter(f) {
      currentFilter = f;
      document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === f);
      });
      renderCardsView(f);
    }

    // ── Main load ─────────────────────────────────────────────────────────
    async function loadData(force = false) {
      if (expandedAssetId) return; // expanded view has its own refresh button
      const btn  = document.getElementById('refreshBtn');
      const icon = document.getElementById('refreshIcon');
      btn.disabled = true;
      icon.classList.add('spin');

      if (force) {
        // Clear all asset caches
        loadTrackedAssets().forEach(a => {
          try { localStorage.removeItem('asset_cache_' + a.id); } catch {}
        });
        tfCache = {};
      }

      await renderCardsView(currentFilter);

      btn.disabled = false;
      icon.classList.remove('spin');
    }

    // ── Keyboard ──────────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeInfo();
        closeAddModal();
        closeSettings();
        closeAlertsModal();
        closeColPicker();
      }
    });

    document.addEventListener('click', e => {
      const picker = document.getElementById('colPicker');
      const btn    = document.getElementById('colPickerBtn');
      if (picker && !picker.classList.contains('hidden') &&
          !picker.contains(e.target) && e.target !== btn && !btn?.contains(e.target)) {
        closeColPicker();
      }
    });

    // ── Hash routing (back/forward button) ────────────────────────────────
    window.addEventListener('popstate', () => {
      const hash = location.hash.slice(1);
      if (hash) {
        const assets = loadTrackedAssets();
        const asset  = assets.find(a => a.id === hash);
        if (!asset) { _doCollapse(); return; }
        expandedAssetId = hash;
        document.getElementById('cardsView').classList.add('hidden');
        document.getElementById('expandedView').classList.remove('hidden');
        document.getElementById('expandedView').classList.add('fade-in');
        document.getElementById('mainLabel').textContent = '…';
        document.getElementById('scoreNum').textContent  = '…';
        fetchAssetData(asset)
          .then(data => renderExpandedView(asset, data))
          .catch(() => { document.getElementById('mainLabel').textContent = 'Error'; });
      } else {
        _doCollapse();
      }
    });

    // ── Boot ──────────────────────────────────────────────────────────────
    setInterval(() => loadData(), CACHE_TTL);
    const _initHash = location.hash.slice(1);
    if (_initHash) {
      // Load cards silently, then expand the hashed asset without pushing new history
      loadData().then(() => {
        const _initAsset = loadTrackedAssets().find(a => a.id === _initHash);
        if (_initAsset) {
          expandedAssetId = _initHash;
          document.getElementById('cardsView').classList.add('hidden');
          document.getElementById('expandedView').classList.remove('hidden');
          document.getElementById('mainLabel').textContent = '…';
          document.getElementById('scoreNum').textContent  = '…';
          fetchAssetData(_initAsset)
            .then(d => renderExpandedView(_initAsset, d))
            .catch(console.error);
        }
      });
    } else {
      loadData();
    }
