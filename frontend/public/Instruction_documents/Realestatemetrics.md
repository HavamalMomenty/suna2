# Real Estate Investment Metrics – Equations & Explanations

> **Purpose:**  
> Concise reference for calculating rental, acquisition, disposition, performance, and financing metrics in property underwriting and asset-management models.

---

## 1. Key Rent & Operating Metrics

### • Average Rent at Takeover
**Formula:**  
Average Rent₀ = Contracted Annual Rent₀ / Lettable Area (m²)

**Explanation:**  
Current contracted rent per square metre at acquisition date.

---

### • Average Annual Rent Growth
**Formula:**  
g = (Rentₙ / Rent₀)^(1/n) - 1

Where:  
- `g` = annual rent growth rate  
- `Rent₀` = rent in year 0 (takeover)  
- `Rentₙ` = rent in year n  

**Explanation:**  
Compound annual growth rate (CAGR) of gross rent over n years.

---

### • Operating Expenses at Takeover per m²
**Formula:**  
OpEx₀ per m² = Operating Expenses₀ / Lettable Area (m²)

**Explanation:**  
Annual operating expenses per square metre at acquisition.

---

## 2. Performance Metrics

| Metric              | Formula                                                                                   | Explanation                                 |
|---------------------|------------------------------------------------------------------------------------------|---------------------------------------------|
| **IRR (unlevered)** | Find r such that: ∑ [CF_propₜ / (1 + r)^t] from t=0 to n = 0                             | Property cash flows before any financing.   |
| **IRR (levered)**   | Find r such that: ∑ [CF_equityₜ / (1 + r)^t] from t=0 to n = 0                           | Cash flows to equity after debt service.    |
| **MOIC (unlevered)**| Total cash received / Total equity invested                                              | Multiple on total cash invested at asset.   |
| **MOIC (levered)**  | Total equity cash received / Total equity invested                                       | Use equity flows after financing.           |

*Where:*  
- CF_propₜ = property-level cash flow in year t  
- CF_equityₜ = equity cash flow (after financing) in year t  
- n = final year  

---

## 3. Acquisition Metrics

| Metric                        | Formula / Definition                                       |
|-------------------------------|-----------------------------------------------------------|
| Acquisition price             | Contract price including transaction costs                |
| Acquisition price / m²        | Price / lettable area                                    |
| **Net Initial Yield (NIY)**   | NIY = NOI₁ / (Purchase Price + Acquisition Costs)         |
| NIY / m²                      | NIY numerator and denominator each ÷ area                |
| Cap rate                      | Cap rate = NOI / Market Value                            |
| Cap rate (fully let)          | Cap rate = Stabilised NOI (0% vacancy) / Market Value    |
| Gross Initial Yield           | Gross Initial Yield = Gross Annual Rent / Purchase Price |
| Gross Initial Yield (fully let)| Fully-let rent roll / Purchase Price                    |
| Effective Gross Income (EGI)  | Potential rent + other income − vacancy & credit loss     |
| EGI / m²                      | EGI / lettable area                                      |
| Operating expenses            | Property-level running costs                             |
| OpEx / m²                     | OpEx / lettable area                                     |
| Net Operating Income (NOI)    | NOI = EGI − OpEx                                         |

---

## 4. Disposition Metrics

| Metric              | Formula / Definition                            |
|---------------------|-------------------------------------------------|
| Exit price          | Contracted sale consideration                   |
| Exit price / m²     | Exit price / lettable area                      |
| Exit cap rate       | Exit cap rate = NOI in exit year / Exit Price   |

---

## 5. Capital Structure & Equity Investment

| Line Item                   | Treatment                                             |
|-----------------------------|------------------------------------------------------|
| Acquisition price           | See Section 3.                                       |
| Cash refunds / WC adj.      | (+/-) Include in equity bridge                       |
| Deferred tax liability      | If assumed, treat as non‑cash liability (adjust equity)|
| Loan drawdown               | Reduces equity need                                  |
| Arrangement fees            | Add to equity if paid out of pocket                  |
| Additional equity injections| Add as they occur (e.g., CapEx)                      |
| **Total Equity Investment** | **Sum of above equity components**                   |

> **Note:** `Total Equity Investment` is the figure used in IRR/MOIC‑to‑equity calculations.

---

## 6. Loan Highlights

| Field                      | Definition / Formula                                                     |
|----------------------------|--------------------------------------------------------------------------|
| Interest rate              | Fixed or floating base rate                                              |
| Margin                     | Credit spread over base                                                  |
| LTV                        | LTV = Loan amount / property value (on draw date)                        |
| Loan amount                | Principal at drawdown                                                    |
| Start date                 | First draw                                                               |
| Loan period                | Contract tenor                                                           |
| Interest‑only period       | Months/years with no amortisation                                        |
| End date                   | Maturity (start date + period)                                           |
| Stamp duty                 | Transaction tax on mortgage registration                                 |
| Arrangement fee            | Up-front lender fee                                                      |
| **Monthly payment (amortising)** | M = [P × i] / [1 - (1 + i)^(-n)]                                 |
|                            | Where:<br> M = monthly payment<br> P = principal (loan amount)<br> i = monthly interest rate (annual rate / 12)<br> n = total number of payments |
| **Monthly payment (interest only)** | M = P × i                                                    |

---

## Abbreviations

- **CAGR:** Compound Annual Growth Rate  
- **NOI:** Net Operating Income  
- **NIY:** Net Initial Yield  
- **MOIC:** Multiple on Invested Capital  
- **EGI:** Effective Gross Income  
- **OpEx:** Operating Expenses  

---

*Prepared June 2025; formulas follow INREV & standard investment‑banking practice.*
