# Investment Valuation Dashboard — Design Brief

## Overview
A dark-themed investment valuation dashboard that aggregates cryptocurrency and stock/ETF data to provide real-time valuation signals. Users track multiple assets and receive composite valuation scores (0-10 scale) to determine if an asset is undervalued or overvalued.

**Target users:** Crypto/stock traders and investors who want to monitor multiple assets with a consistent valuation methodology.

---

## Core Functionality

### 1. **Asset Tracking**
Users manually add assets (crypto, stocks, ETFs) to their watchlist via the "Add" modal. Each asset has:
- **Symbol** (e.g., BTC, AAPL, VOO)
- **Type** (Crypto, Stock, ETF)
- **Name** (e.g., "Bitcoin", "Apple Inc.", "Vanguard S&P 500")
- **Image/Logo** (fetched from APIs or custom)

Assets are stored in `localStorage` and persist across sessions.

### 2. **Valuation Scoring System**
For each asset, a **composite score (0-10)** is calculated:
- **0-3** = "Very Cheap" (light green)
- **3-5** = "Cheap" (green)
- **5-7** = "Fair" (yellow)
- **7-9** = "Expensive" (orange)
- **9-10** = "Very Expensive" (red)

The score uses 6 weighted metrics:
| Metric | Default Weight | Source | Meaning |
|--------|---|--------|---------|
| **FNG** (Fear & Greed Index) | 25% | Alternative.me API | Market sentiment (0-100 scale) |
| **RSI** (14-day) | 25% | Yahoo Finance | Momentum (0-100 scale) |
| **vs200** (Price vs 200d MA) | 20% | Yahoo Finance | Long-term trend positioning |
| **vs50** (Price vs 50d MA) | 15% | Yahoo Finance | Medium-term trend positioning |
| **Chg30** (30-day % change) | 10% | Yahoo Finance | Short-term momentum |
| **DOM** (BTC Dominance) | 5% | CoinGecko API | *Crypto only*; market dominance |

**Informational metrics** (shown but not in score):
- **MACD** (Moving Avg Convergence Divergence)
- **Bollinger %B** (position within Bollinger Bands)

### 3. **Data Sources**
- **CoinGecko API** — crypto data (current price, market cap, charts)
- **Yahoo Finance API** — stock/ETF data (OHLC, moving averages)
- **Alternative.me API** — Fear & Greed Index
- **Parqet API** — asset logos as fallback
- **CORS Proxy** — fallback for cross-origin requests

**Caching:** 5-minute TTL per asset. Stale data (>5min old) is shown but labeled as "Cached" with timestamp.

---

## User Interface Components

### **Header**
- **Logo** — orange gradient asset bars icon + "Asset Valuation" title with gradient text
- **Live dot** — indicates real-time data availability
- **Buttons:**
  - **Alerts** — Opens alerts manager (view/edit price alerts)
  - **Weights** — Opens settings modal to adjust scoring weights
  - **Refresh** — Forces data reload (disabled during fetch)

### **Main View: Cards**
Default view. Each asset displays as a card:

```
┌─────────────────────────────────┐
│ [Logo] BTC      [Very Cheap]    │
│                                 │
│ Price: $98,234  24h: +2.3%      │
│ RSI: 28         FNG: 45         │
│ vs200: 1.12     vs50: 1.05      │
│                                 │
│ [Zone bar: Very Cheap|Cheap...] │
│                                 │
│ Score sparkline (8-day trend)   │
│                                 │
│ [⊕ Add Alert] [⋯ Details] [×]   │
└─────────────────────────────────┘
```

**Card Elements:**
1. **Header**: Logo + symbol + valuation badge + remove button
2. **Price info**: Current price, 24h change %
3. **Key metrics**: RSI, FNG, vs200, vs50 (first 4 metrics at a glance)
4. **Zone bar**: Visual representation of where the score falls (6 colored zones)
5. **Sparkline**: 8-day score history (trend visualization)
6. **Actions**: Add alert, Details (expand), Remove

### **Filter Bar**
Segmented control buttons: **All | Crypto | Stocks | ETFs**
Also includes **View toggle**: Cards (⊞) vs. Table (≡)

### **Main View: Table**
Alternative view showing all assets in a table with columns:
- Symbol, Type, Price, 24h Change
- FNG, RSI, vs200, vs50, Composite Score
- Last updated timestamp
- Delete button

### **Expanded Asset View**
Opened by clicking "Details" on a card or clicking the card itself. Full-screen overlay showing:

**Top section:**
- Large logo, symbol, full name, current price
- Large composite score badge + description
- Zone bar (larger)
- 8-day sparkline chart with score points
- FNG, RSI badges

**Metrics section:**
- **Technical Indicators**: FNG, RSI, MACD, Bollinger %B (with descriptions)
- **Moving Averages**: vs200, vs50, current vs historical values
- **30-day % change**: Visual representation
- **BTC Dominance** (crypto only)

**Chart section:**
- Candlestick/line chart (4H, 1D, 1W, 1M buttons to switch timeframe)
- Score overlay on top showing historical score on same timeframe
- Prices marked on chart

**Alert section:**
- Current alert status (if set)
- Price alert input: "Alert me when price goes above/below $X"
- Save/Clear alert buttons

**DCA Calculator section:**
- Suggests dollar-cost-averaging entry points based on score
- Shows recommended allocation % if score < 5 (cheap territory)

**Action buttons:**
- Back to cards
- Remove asset
- Refresh data

### **Modals**

#### **Add Asset Modal**
- Search bar to find crypto/stocks/ETFs
- Category tabs: **Popular | Crypto | Stocks | ETFs**
- Search results showing:
  - Logo + name + symbol
  - Type badge
  - Click to add
- **Popular** tab shows pre-selected popular assets (BTC, ETH, AAPL, etc.)

#### **Settings Modal (Weight Adjustments)**
- **Preset buttons**: Standard, Aggressive, Conservative, Custom
- **Sliders** for each metric (FNG, RSI, vs200, vs50, Chg30, DOM):
  - Drag to adjust weight (0-100%)
  - Must sum to 100%
  - Live preview of composite score effect
- **Save Custom Preset** option
- Shows presets with descriptions:
  - Standard: Balanced weighting
  - Aggressive: Heavy on momentum (RSI, Chg30)
  - Conservative: Heavy on long-term trends (vs200, vs50)
  - Custom: User-defined

#### **Alerts Manager Modal**
- List of all assets with alerts set
- For each: Symbol, current price, alert condition (e.g., "Alert when < $50,000")
- Enable/disable toggle per alert
- Clear/edit alert options
- Shows notification count

#### **Info Modal**
- Glossary of terms (FNG, RSI, Zone, MACD, Bollinger Bands, etc.)
- Accessible from question marks throughout the UI

---

## User Flows

### **Flow 1: New User Setup**
1. Open app → see empty state
2. Click "Add Asset" button
3. Search for or select from Popular list (e.g., BTC)
4. Asset added → card appears with data loading
5. Data loads → scores appear, zone bar updates
6. User can immediately see if asset is cheap/expensive
7. Optional: adjust weights in Settings to match strategy

### **Flow 2: Monitor Assets (Primary Use)**
1. User opens app (bookmarked)
2. Sees all tracked assets with current scores
3. Quickly scans cards for which are "Cheap" (highlight cheap opportunities)
4. Click on an asset to see full details + chart
5. Set price alerts on assets of interest
6. Refresh data manually or wait for auto-cache (5 min)

### **Flow 3: Adjust Strategy**
1. Click "Weights" button
2. Select preset (Aggressive/Conservative) or adjust sliders
3. See live preview of how composite score changes
4. All card scores update instantly
5. Close settings → continue monitoring

### **Flow 4: Set Price Alert**
1. Click "Details" on a card
2. Scroll to alert section
3. Enter price threshold (e.g., "Alert if BTC < $95,000")
4. Click "Save Alert"
5. Confirmation message
6. Browser notification when alert triggers (or Alerts modal shows count)

---

## Data Flow & State Management

```
User Action (click/refresh)
    ↓
loadData(forceRefresh) in modals.js
    ↓
For each tracked asset:
  ├─ Check localStorage cache (5 min TTL)
  ├─ If stale/missing, fetch from APIs
  │   ├─ CoinGecko (crypto)
  │   ├─ Yahoo Finance (stocks/ETFs)
  │   └─ Alternative.me (FNG)
  └─ Store in localStorage with timestamp
    ↓
computeScores() in data.js
  ├─ Extract metrics from asset data
  ├─ Normalize to 0-10 scale
  └─ Return scores object
    ↓
composite() in data.js
  ├─ Load user weights from localStorage
  ├─ Apply weights to scores
  └─ Return composite score (0-10)
    ↓
renderCardsView() / renderTableView()
  ├─ Build HTML for each asset
  ├─ Assign color/badge based on tier
  └─ Insert into DOM
```

---

## Current UX/UI Challenges & Opportunities

### **Issues:**
1. **Information overload** — Cards show 4 metrics at once; new users don't know what they mean
2. **Zone bar clarity** — Small text on zone bar, hard to read
3. **No onboarding** — No tooltips/guidance for first-time users
4. **Limited mobile optimization** — Buttons/text hide on small screens
5. **Chart is hidden** — Chart section only visible in expanded view; hard to get quick visual
6. **No trending alerts** — No way to see which assets just changed tiers (good/bad signals)
7. **Settings weights are not intuitive** — Users can set invalid combinations (weights < 100%)
8. **Stale data label is subtle** — Users may not notice they're looking at cached data

### **Design Opportunities:**
1. **Smart defaults** — Show only the 2-3 most important metrics on card; others in expanded view
2. **Better zone bar** — Larger, clearer visual; show score number prominently
3. **Sparkline as primary visual** — Make the score trend the most prominent element
4. **Onboarding flow** — First-visit modal explaining the scoring system + key terms
5. **Mobile-first layout** — Stack cards vertically; hide button labels; use icons
6. **Quick chart toggle** — Show/hide 1D or 1W mini chart on card without expanding
7. **Tier change notifications** — Highlight assets that just moved from "Cheap" to "Fair" (opportunities closing)
8. **Preset badges** — Show which preset is active; make switching obvious
9. **Comparison view** — Side-by-side comparison of 2-3 assets (useful for portfolio decisions)
10. **Dark mode indicators** — Stronger visual separation between zones (contrast)
11. **Score animation** — Animate score changes so users notice updates
12. **Quick actions menu** — Long-press or right-click card for: Alert, Compare, Remove (faster mobile experience)

---

## Technical Notes for Design

- **Responsive** — Uses Tailwind CSS; max-width 5xl container
- **Dark theme** — bg-gray-950 (nearly black); text-white
- **Color scheme:**
  - Primary accent: Orange (#f97316, #fb923c)
  - Success/bullish: Emerald green
  - Neutral: Gray-500 to gray-800
  - Zone colors: Green (cheap) → Yellow (fair) → Orange → Red (expensive)
- **Typography** — System fonts (no custom)
- **Icons** — Inline SVGs (refresh, settings, alerts, etc.)

---

## Key Metrics for Design Success

1. **Time to insight** — How quickly can user see if an asset is cheap/expensive?
2. **Action clarity** — How obvious is it to add an asset, set an alert, or adjust weights?
3. **Learnability** — Can a new user understand the score without reading docs?
4. **Visual hierarchy** — What draws the eye first? (Score should be primary)
5. **Mobile experience** — Can all actions be done on phone without scrolling excessively?

---

## Next Steps for Design

1. **Map user personas** — Day trader vs. long-term investor vs. portfolio manager
2. **Conduct user testing** — Test current UX with target users; identify pain points
3. **Wireframe improvements** — Based on opportunities above, sketch new layouts
4. **Design system** — Expand Tailwind tokens for consistent spacing/typography
5. **Animation specs** — Define transitions for score updates, tier changes, modal open/close
6. **Mobile mockups** — Ensure all flows work on phones/tablets
7. **Accessibility audit** — Contrast, keyboard navigation, screen reader support
