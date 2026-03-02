    // ── Config ──────────────────────────────────────────────────────────
    const CACHE_TTL       = 5 * 60 * 1000;
    const CG              = 'https://api.coingecko.com/api/v3';
    const FNG_URL         = 'https://api.alternative.me/fng/?limit=1';
    const PROXY           = 'https://corsproxy.io/?url=';
    const ASSETS_KEY           = 'tracked_assets_v1';
    const SETTINGS_KEY         = 'valuation_settings_v1';
    const CUSTOM_PRESETS_KEY   = 'custom_weight_presets_v1';
    const WEIGHT_PRESETS  = {
      standard:  { fng: 25, rsi: 25, vs200: 20, vs50: 15, chg30: 10, dom: 5 },
      technical: { fng:  0, rsi: 30, vs200: 35, vs50: 25, chg30: 10, dom: 0 },
      sentiment: { fng: 40, rsi: 20, vs200: 20, vs50: 10, chg30: 10, dom: 0 },
    };
    const DEFAULT_WEIGHTS = WEIGHT_PRESETS.standard;

    let chart         = null;
    let currentTF     = '1M';
    let tfCache       = {};
    let currentFilter = 'ALL';
    let expandedAssetId = null;
    let searchTimer   = null;
    let _searchResults = [];
    let activePreset  = null;

    // ── Timeframe config ─────────────────────────────────────────────────
    const TF_CONFIG = {
      '1M':  { useExisting: true, slice: 30 },
      '6M':  { useExisting: true, slice: 180 },
      '1D':  { days: '1' },
      '1W':  { days: '7' },
      '1Y':  { days: '365', interval: 'daily' },
      'MAX': { days: 'max', interval: 'weekly' },
    };

    // ── Zone config ──────────────────────────────────────────────────────
    const ZONE_COLORS    = ['#10b981', '#84cc16', '#eab308', '#f97316', '#ef4444'];
    const ZONE_LABELS    = ['VERY CHEAP', 'CHEAP', 'FAIR', 'EXPENSIVE', 'VERY EXP'];
    const ZONE_BAR_CONFIG = {
      'zones-fng':       ['0–15', '15–45', '45–55', '55–85', '85–100'],
      'zones-rsi':       ['0–25', '25–45', '45–55', '55–75', '75–100'],
      'zones-ma200':     ['<0.7×', '0.7–1.0×', '1.0–1.2×', '1.2–2.5×', '>2.5×'],
      'zones-ma50':      ['<0.85×', '0.85–0.95×', '0.95–1.05×', '1.05–1.5×', '>1.5×'],
      'zones-chg30':     ['<−30%', '−30–−5%', '−5–+5%', '+5–+60%', '>+60%'],
      'zones-dom':       ['>60%', '55–60%', '50–55%', '40–50%', '<40%'],
      'zones-bollinger': ['<0', '0–0.2', '0.2–0.8', '0.8–1.0', '>1.0'],
    };

    // ── Info content ──────────────────────────────────────────────────────
    const INFO = {
      fng: {
        title: 'Fear & Greed Index',
        desc: 'A composite sentiment index from 0 (Extreme Fear) to 100 (Extreme Greed), sourced from Alternative.me. Combines price volatility, momentum, social sentiment, and Bitcoin dominance.',
        zones: [
          { label: 'Very Cheap',     range: '0–15',   meaning: 'Extreme Fear — historically correlated with discounted prices' },
          { label: 'Cheap',          range: '15–45',  meaning: 'Fear — market is pessimistic, prices often below average' },
          { label: 'Fair Value',     range: '45–55',  meaning: 'Neutral — no strong emotional bias in either direction' },
          { label: 'Expensive',      range: '55–85',  meaning: 'Greed — optimism rising, prices often above average' },
          { label: 'Very Expensive', range: '85–100', meaning: 'Extreme Greed — historically correlated with elevated prices near peaks' },
        ],
        weight: '25% of composite score (default)',
      },
      rsi: {
        title: 'RSI (14-Day)',
        desc: 'Relative Strength Index calculated from 14 daily closes. Measures speed and magnitude of price changes to evaluate overbought or oversold conditions.',
        zones: [
          { label: 'Very Cheap',     range: '0–25',   meaning: 'Deeply oversold — historically associated with price bottoms' },
          { label: 'Cheap',          range: '25–45',  meaning: 'Oversold — weak momentum, potential reversal zone' },
          { label: 'Fair Value',     range: '45–55',  meaning: 'Neutral momentum — no strong directional bias' },
          { label: 'Expensive',      range: '55–75',  meaning: 'Overbought — strong upward momentum, watch for exhaustion' },
          { label: 'Very Expensive', range: '75–100', meaning: 'Deeply overbought — historically associated with short-term peaks' },
        ],
        weight: '25% of composite score (default)',
      },
      ma200: {
        title: 'Price vs 200-Day MA',
        desc: 'Ratio of the current price to the 200-day moving average. Trading far below it is historically cheap; far above is historically elevated.',
        zones: [
          { label: 'Very Cheap',     range: '<0.7×',    meaning: 'More than 30% below the 200d MA — deep discount, rare occurrence' },
          { label: 'Cheap',          range: '0.7–1.0×', meaning: 'Below the 200d MA — price is under its long-term average' },
          { label: 'Fair Value',     range: '1.0–1.2×', meaning: 'Near the 200d MA — price is around long-term average' },
          { label: 'Expensive',      range: '1.2–2.5×', meaning: 'Above the 200d MA — price elevated vs long-term average' },
          { label: 'Very Expensive', range: '>2.5×',    meaning: 'More than 2.5× the 200d MA — historically seen near cycle tops' },
        ],
        weight: '20% of composite score (default)',
      },
      ma50: {
        title: 'Price vs 50-Day MA',
        desc: 'Ratio of the current price to the 50-day moving average. Being far below signals short-term weakness; far above signals short-term overextension.',
        zones: [
          { label: 'Very Cheap',     range: '<0.85×',     meaning: 'More than 15% below the 50d MA — sharp short-term drop' },
          { label: 'Cheap',          range: '0.85–0.95×', meaning: 'Mildly below the 50d MA — short-term weakness' },
          { label: 'Fair Value',     range: '0.95–1.05×', meaning: 'Near the 50d MA — price in short-term equilibrium' },
          { label: 'Expensive',      range: '1.05–1.5×',  meaning: 'Above the 50d MA — short-term extension upward' },
          { label: 'Very Expensive', range: '>1.5×',      meaning: 'More than 50% above the 50d MA — overextended short-term' },
        ],
        weight: '15% of composite score (default)',
      },
      chg30: {
        title: '30-Day Price Change',
        desc: 'The percentage change in price over the last 30 days. Sharp monthly drops have historically marked discounted entry points; rapid gains signal elevated prices.',
        zones: [
          { label: 'Very Cheap',     range: '<−30%',       meaning: 'Dropped more than 30% in a month — historically deep discount' },
          { label: 'Cheap',          range: '−30% to −5%', meaning: 'Moderate monthly decline — below recent trend' },
          { label: 'Fair Value',     range: '−5% to +5%',  meaning: 'Roughly flat over 30 days — consolidation zone' },
          { label: 'Expensive',      range: '+5% to +60%', meaning: 'Moderate-to-strong monthly gain — above recent trend' },
          { label: 'Very Expensive', range: '>+60%',       meaning: 'Gained more than 60% in a month — historically elevated, parabolic move' },
        ],
        weight: '10% of composite score (default)',
      },
      dom: {
        title: 'BTC Market Dominance',
        desc: "Bitcoin's share of total cryptocurrency market cap. High dominance signals an earlier-stage bull market; low dominance signals altcoin season.",
        zones: [
          { label: 'Very Cheap',     range: '>60%',   meaning: 'BTC-led market — capital concentrated in Bitcoin, historically earlier cycle' },
          { label: 'Cheap',          range: '55–60%', meaning: 'Mildly BTC-dominant — transitioning market' },
          { label: 'Fair Value',     range: '50–55%', meaning: 'Balanced between BTC and altcoins' },
          { label: 'Expensive',      range: '40–50%', meaning: 'Altcoin market gaining ground — later cycle signal' },
          { label: 'Very Expensive', range: '<40%',   meaning: 'Altcoin season — capital rotating out of BTC, historically late-cycle' },
        ],
        weight: '5% of composite score (default)',
      },
      composite: {
        title: 'Composite Valuation Score',
        desc: 'A weighted average of all active metrics producing a single score from 0 (Very Cheap) to 10 (Very Expensive). Weights can be customised in Settings.',
        zones: [
          { label: 'Very Cheap (0–2)',      range: '0–2',  meaning: 'Multiple signals align toward deep discount — extreme fear conditions' },
          { label: 'Cheap (2–4)',           range: '2–4',  meaning: 'Most signals lean toward below-average valuation' },
          { label: 'Fair Value (4–6)',      range: '4–6',  meaning: 'No strong directional signal — market near historical average' },
          { label: 'Expensive (6–8)',       range: '6–8',  meaning: 'Most signals lean toward above-average valuation' },
          { label: 'Very Expensive (8–10)', range: '8–10', meaning: 'Multiple signals align toward euphoria — historically elevated conditions' },
        ],
        weight: 'Fear & Greed 25% · RSI 25% · 200d MA 20% · 50d MA 15% · 30d Change 10% · Dominance 5% (default)',
      },
      macd: {
        title: 'MACD (12/26/9)',
        desc: 'Moving Average Convergence Divergence. The MACD line = 12-period EMA minus 26-period EMA. The signal line = 9-period EMA of MACD. A positive histogram (MACD above signal) indicates bullish momentum; negative indicates bearish. Computed entirely from the existing daily close array.',
        zones: [
          { label: 'Very Cheap',     range: 'Strong negative', meaning: 'Bearish momentum — price declining faster than its recent average' },
          { label: 'Cheap',         range: 'Mild negative',    meaning: 'Weakening momentum — downside pressure building' },
          { label: 'Fair Value',    range: 'Near zero',         meaning: 'No strong directional momentum in either direction' },
          { label: 'Expensive',     range: 'Mild positive',     meaning: 'Strengthening momentum — upside pressure building' },
          { label: 'Very Expensive', range: 'Strong positive',  meaning: 'Strong bullish momentum — price rising well above recent average' },
        ],
        weight: 'Informational only — not included in composite score',
      },
      bollinger: {
        title: 'Bollinger %B (20-Day)',
        desc: 'Measures where price sits within the Bollinger Bands (20-day MA ± 2 standard deviations). %B = (price − lower band) / (upper − lower). Below 0 = price is below the lower band (oversold). Above 1 = price is above the upper band (overbought). Computed from the existing daily close array.',
        zones: [
          { label: 'Very Cheap',     range: '<0',     meaning: 'Below lower band — price more than 2σ below the 20-day mean' },
          { label: 'Cheap',         range: '0–0.2',   meaning: 'Near lower band — mild oversold conditions' },
          { label: 'Fair Value',    range: '0.2–0.8', meaning: 'Within normal band range — no extreme signal' },
          { label: 'Expensive',     range: '0.8–1.0', meaning: 'Near upper band — mild overbought conditions' },
          { label: 'Very Expensive', range: '>1.0',   meaning: 'Above upper band — price more than 2σ above the 20-day mean' },
        ],
        weight: '0% of composite score (informational metric)',
      },
    };

    // ── Tier definitions ─────────────────────────────────────────────────
    const TIERS = [
      { max: 2,  label: 'VERY CHEAP',     color: '#10b981', bg: 'rgba(2,44,34,0.8)',   border: '#064e3b', badge: 'bg-emerald-900/80 text-emerald-300', context: 'Historically discounted — market in extreme fear' },
      { max: 4,  label: 'CHEAP',          color: '#84cc16', bg: 'rgba(26,46,5,0.8)',   border: '#3f6212', badge: 'bg-lime-900/80 text-lime-300',       context: 'Below long-term average — cautious market sentiment' },
      { max: 6,  label: 'FAIR VALUE',     color: '#eab308', bg: 'rgba(41,37,6,0.8)',   border: '#713f12', badge: 'bg-yellow-900/80 text-yellow-300',   context: 'Priced near long-term average — no strong signal in either direction' },
      { max: 8,  label: 'EXPENSIVE',      color: '#f97316', bg: 'rgba(28,10,0,0.8)',   border: '#7c2d12', badge: 'bg-orange-900/80 text-orange-300',   context: 'Above historical average — elevated optimism in the market' },
      { max: 10, label: 'VERY EXPENSIVE', color: '#ef4444', bg: 'rgba(28,5,5,0.8)',    border: '#7f1d1d', badge: 'bg-red-900/80 text-red-400',         context: 'Historically elevated — market conditions resemble past euphoria peaks' },
    ];
    function tier(score) { return TIERS.find(t => score <= t.max) ?? TIERS[TIERS.length - 1]; }
