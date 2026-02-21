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

- **`MonteCarlo.py`** — Main page. Runs 1,000,000 Monte Carlo simulations to calculate the probability of a price being above/below a threshold within a given number of days. Supports three assets: Açúcar, Dólar, SBV24.
- **`pages/Opções.py`** — Second page. Prices call options via Monte Carlo (100,000 simulations per strike price) across a range of strikes, outputting a pricing table. Currently only supports Açúcar.

### Data Loading

CSV files use European number formatting (comma as decimal separator, `DD.MM.YYYY` dates). `carregar_dados()` handles the normalization. Asset configs (CSV filename, default price, bounds) are defined in the `valores_padrao` dict in `MonteCarlo.py`. `Opções.py` has its own inline config and does not share `valores_padrao`.

### Simulation Design

Prices are clipped to `[limite_inferior, limite_superior]` each day during simulation to prevent extreme outliers. Returns are drawn from a normal distribution parameterized by historical daily mean and std. The `data` variable used in `simulacao_monte_carlo()` is accessed from the enclosing scope (module-level), not passed as a parameter.

### CSV Data Files

| File | Asset |
|------|-------|
| `Dados Históricos - Açúcar NY nº11 Futuros (6).csv` | Sugar NY #11 futures |
| `USD_BRL Dados Históricos (2).csv` | USD/BRL exchange rate |
| `sbv24.csv` | SBV24 sugar futures contract |
