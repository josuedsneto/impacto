# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Impacto** is a Streamlit web application for Monte Carlo price simulations and options pricing on Brazilian financial assets (sugar futures, USD/BRL exchange rate). The UI and variables are in Portuguese.

## Running the Application

```bash
pip install -r requirements.txt
streamlit run MonteCarlo.py
```

The app runs on `http://localhost:8501`. There are no tests or linting configurations.

## Architecture

This is a multi-page Streamlit app:

- **`config.py`** — Single source of truth for all asset configs (CSV filename, default price, bounds). Both pages import `ATIVOS` from here.
- **`MonteCarlo.py`** — Main page. Runs 100,000 Monte Carlo simulations to calculate the probability of a price being above/below a threshold within a given number of days. Supports three assets: Açúcar, Dólar, SBV24. Displays results as a percentile fan chart (P5/P25/P50/P75/P95).
- **`pages/Opções.py`** — Second page. Prices European call options via Monte Carlo (100,000 simulations per strike) across a range of strikes, outputting a pricing table and bar chart. Supports all three assets.

### Data Loading

CSV files use European number formatting (comma as decimal separator, `DD.MM.YYYY` dates). `carregar_dados()` handles the normalization and is decorated with `@st.cache_data` to avoid re-reading CSVs on every interaction.

### Simulation Design

Prices are clipped to `[limite_inferior, limite_superior]` each day during simulation. Returns are drawn from a normal distribution parameterized by historical daily mean and std. `preco_inicial` is passed explicitly as a function parameter to `simulacao_monte_carlo()`. The Opções.py formula prices European calls: `np.mean(np.maximum(precos[-1, :] - strike, 0))` — payoff is evaluated only at the final day.

### CSV Data Files

| File | Asset |
|------|-------|
| `Dados Históricos - Açúcar NY nº11 Futuros (6).csv` | Sugar NY #11 futures |
| `USD_BRL Dados Históricos (2).csv` | USD/BRL exchange rate |
| `sbv24.csv` | SBV24 sugar futures contract |
