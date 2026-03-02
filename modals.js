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
    function openAddModal() {
      document.getElementById('addModal').classList.remove('hidden');
      document.getElementById('assetSearchInput').value = '';
      document.getElementById('searchResults').innerHTML = '';
      document.getElementById('searchStatus').classList.add('hidden');
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
        document.getElementById('searchResults').innerHTML = '';
        document.getElementById('searchStatus').classList.add('hidden');
        return;
      }
      document.getElementById('searchStatus').textContent = 'Searching…';
      document.getElementById('searchStatus').classList.remove('hidden');
      document.getElementById('searchResults').innerHTML = '';
      searchTimer = setTimeout(() => searchAssets(q), 400);
    }

    async function searchAssets(query) {
      try {
        const [cgRes, yfRes] = await Promise.allSettled([
          cgFetch(`/search?query=${encodeURIComponent(query)}`),
          yahooFetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&lang=en-US`),
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
            const id = 'yf_' + q.symbol.toLowerCase();
            results.push({ id, symbol: q.symbol, name: q.shortname ?? q.symbol, type: t, coingeckoId: null, yahooSymbol: q.symbol, alreadyAdded: trackedIds.has(id) });
          });
        }

        const statusEl = document.getElementById('searchStatus');
        const resEl    = document.getElementById('searchResults');

        if (results.length === 0) {
          statusEl.textContent = 'No results found.';
          statusEl.classList.remove('hidden');
          return;
        }

        _searchResults = results;
        statusEl.classList.add('hidden');
        resEl.innerHTML = results.map((r, idx) => {
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
      } catch (err) {
        console.error('Search error:', err);
        document.getElementById('searchStatus').textContent = 'Search failed. Try again.';
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
        isActive
          ? 'bg-gray-700 border-orange-500 text-orange-400'
          : 'bg-gray-800 hover:bg-gray-700 border-gray-700 hover:border-orange-500 text-gray-300'
      );
    }

    function renderAllPresetButtons() {
      const row = document.getElementById('allPresetsRow');
      const customPresets = loadCustomPresets();
      const builtIns = ['standard', 'technical', 'sentiment'];
      const customs  = Object.keys(customPresets);

      row.innerHTML = [
        ...builtIns.map(name => `
          <button onclick="applyWeightPreset(${JSON.stringify(name)})" class="${_presetBtnClass(name)}">
            ${name.charAt(0).toUpperCase() + name.slice(1)}
          </button>`),
        ...customs.map(name => `
          <button onclick="selectCustomPreset(${JSON.stringify(name)})" class="${_presetBtnClass(name)}">
            ${name}
          </button>`),
      ].join('');
    }

    // Built-in preset click — apply weights, mark active, exit edit mode
    function applyWeightPreset(name) {
      const p = WEIGHT_PRESETS[name];
      if (!p) return;
      setWeightSliders(p);
      activePreset = name;
      renderAllPresetButtons();
      document.getElementById('customPresetName').value = '';
      document.getElementById('deletePresetBtn').classList.add('hidden');
    }

    // Custom preset click — apply weights, mark active, enter edit mode
    function selectCustomPreset(name) {
      const p = loadCustomPresets()[name];
      if (!p) return;
      setWeightSliders(p);
      activePreset = name;
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
      activePreset = name;
      nameInput.value = '';
      document.getElementById('deletePresetBtn').classList.add('hidden');
      renderAllPresetButtons();
      nameInput.placeholder = 'Saved!';
      setTimeout(() => { nameInput.placeholder = 'Name your preset…'; }, 1200);
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
      activePreset = null;
      for (const [name, weights] of Object.entries(all)) {
        if (JSON.stringify(weights) === JSON.stringify(current)) {
          activePreset = name;
          break;
        }
      }
      setWeightSliders(current);
      document.getElementById('customPresetName').value = '';
      document.getElementById('deletePresetBtn').classList.add('hidden');
      renderAllPresetButtons();
      document.getElementById('settingsModal').classList.remove('hidden');
    }
    function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }

    function updateWeightTotal() {
      const ids = ['wFng','wRsi','wVs200','wVs50','wChg30','wDom'];
      const displayIds = ['wFngDisplay','wRsiDisplay','wVs200Display','wVs50Display','wChg30Display','wDomDisplay'];
      let total = 0;
      ids.forEach((id, i) => {
        const val = parseInt(document.getElementById(id).value);
        total += val;
        document.getElementById(displayIds[i]).textContent = val + '%';
      });
      const totalEl = document.getElementById('weightTotal');
      const saveBtn = document.getElementById('saveWeightsBtn');
      totalEl.textContent = total + '%';
      totalEl.style.color = total === 100 ? '#10b981' : '#ef4444';
      saveBtn.disabled    = total !== 100;
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
