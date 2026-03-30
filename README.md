# Brookfield_Sustainable_Energy_Prototype

## Campus electricity web visualizer (MVP)

The React app lives in [`web/`](web/).

```bash
cd web
npm install
npm run build:data
npm run dev
```

- **`build:data`** — reads `Prediction Visualizer/Electricity Consumption Monthly.csv` and writes `web/public/data/buildingMonthly.json`.
- **`npm run build`** — runs `build:data`, then typecheck + production bundle.

Open the URL printed by Vite (usually `http://localhost:5173`).