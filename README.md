# VisLit Explorer (still a prototype)

**Live Demo:** [https://micyn.github.io/VisLit-Explorer/](https://micyn.github.io/VisLit-Explorer/)

VisLit Explorer is an interactive visual analytics system for exploring IEEE VIS academic literature (1990–2024) across **Field Overview**, **Topic Network**, **Author Analytics**, and **Paper Profile** views.

## Features

- **Field Overview:** Explore 8 LDA-derived visualization subfields, historical publication trajectories (1990–2024), and cross-topic co-occurrence correlations via an interactive network or heatmap matrix.
- **Topic Network:** Inspect internal and external citation networks for each subfield using Force-Directed or Timeline layouts, with landmark paper indicators and full paper directories.
- **Author Analytics:** Analyze prolific researchers, publication vs. citation timelines, research topic DNA radar profiles, and co-authorship ego networks.
- **Paper Profile:** Examine individual paper metadata, topic distributions, ego citation graphs (references and citing papers), and related literature recommendations.

## Local Development

```bash
npm install --legacy-peer-deps
npm run dev
```

## Build for Production

```bash
npm run build
```
