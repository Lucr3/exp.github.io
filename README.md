# Yemen: The Silent Crisis - Data Visualization Project

![Project Status](https://img.shields.io/badge/status-active-brightgreen)
![Course](https://img.shields.io/badge/course-Data_Visualization-blue)
![University](https://img.shields.io/badge/uni-UniGe-red)

## Project Description

This project is an **interactive visual narrative** dedicated to the humanitarian crisis in Yemen (2014-present). The goal is not only to visualize conflict data, but to explore the correlations between armed violence and the systemic collapse of social and economic infrastructure (education, healthcare, food prices), contrasting all this with global media attention.

The project was developed as part of the **Data Visualization** course at the University of Genoa.

🔗 **[View Live Demo](https://lucr3.github.io/exp.github.io/)**

---

## Analytical Objectives

The dashboard answers critical questions through data analysis:
1.  **Demographic Impact:** How does war affect birth and mortality projections until 2030?
2.  **Economic Crisis:** What is the relationship between political instability and inflation of essential goods?
3.  **Social Deterioration:** How have enrollment rates and child mortality changed since the conflict began?
4.  **Media Bias:** Does global interest (Google Trends) reflect the actual severity of field events (ACLED)?

---

## Data Pipeline

The project follows a simple pipeline to ensure clean and consistent data.

### 1. Data Ingestion & Cleaning (Python)
The notebook in the `Code/` folder (`Cleaner.ipynb`) handles:
* **Filtering:** Extraction of Yemen-specific data from global datasets.
* **Output:** Generation of optimized CSV/JSON files in the `datasets/` folder.

### 2. Frontend & Visualization (D3.js)
The frontend loads processed data via `dataLoader.js` and renders it using D3.js. The architecture is modular: each chart is an independent JavaScript component.

---

## Visualizations

The project includes various advanced visualization techniques:

| Component | Chart Type | Visualization Purpose | Data Source |
|:---|:---|:---|:---|
| **Conflict Map** | *Symbol Map* | Geographic distribution of violent events (battles, explosions). | ACLED |
| **Food Crisis** | *Choropleth Map* | Evolution of food prices by governorate. | WFP |
| **Media Attention**| *Spiral Chart* | Cyclicity and peaks of global interest (Google Trends) over time. | Google Trends |
| **Demographics** | *Stacked Area Chart* | Historical and future projections of births vs deaths. | OWID |
| **Education Lost** | *Grouped/Stacked Bar*| Collapse of enrollment and completion rates. | OWID |
| **Youth Health** | *Dumbbell Plot* | *Before/After* comparison of youth mortality. | OWID |

---

## Repository Structure

```plaintext
.
├── Code/                   # Python Notebooks for Data Cleaning
│   ├── Cleaner.ipynb       # General cleaning and filtering
│   └── FoundEvent.ipynb    # Semantic analysis of ACLED events
├── datasets/               # Raw and processed data (CSV, JSON, GeoJSON)
├── html/                   # Pages and HTML components
├── js/                     # Frontend logic
│   ├── charts/             # D3.js components (BarChart, Map, Spiral, etc.)
│   ├── utils/              # Data loader and utilities
│   └── main.js             # Entry point
├── css/                    # Style sheets
└── README.md               # Documentation
