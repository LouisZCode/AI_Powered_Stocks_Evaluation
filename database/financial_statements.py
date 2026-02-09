"""
Fetch structured financial statements (income, balance sheet, cash flow)
from the SEC via the edgar library and format them as clean text tables
for LLM consumption.
"""

import io
import sys
import logging
import pandas as pd
from edgar import Company


# ── Row definitions (XBRL concept → human label) ────────────────────────

INCOME_ROWS = [
    ("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenue"),
    ("CostOfGoodsAndServicesSold", "Cost of Revenue"),
    ("GrossProfit", "Gross Profit"),
    ("ResearchAndDevelopmentExpense", "R&D Expense"),
    ("SellingGeneralAndAdministrativeExpense", "SG&A Expense"),
    ("OperatingExpenses", "Total Operating Expenses"),
    ("OperatingIncomeLoss", "Operating Income"),
    ("IncomeTaxExpenseBenefit", "Income Tax"),
    ("NetIncomeLoss", "Net Income"),
    ("EarningsPerShareDiluted", "EPS (Diluted)"),
]

BALANCE_ROWS = [
    ("Assets", "Total Assets"),
    ("AssetsCurrent", "Current Assets"),
    ("CashAndCashEquivalentsAtCarryingValue", "Cash & Equivalents"),
    ("AccountsReceivableNetCurrent", "Accounts Receivable"),
    ("InventoryNet", "Inventory"),
    ("PropertyPlantAndEquipmentNet", "Property & Equipment"),
    ("OtherAssetsNoncurrent", "Other Noncurrent Assets"),
    ("Liabilities", "Total Liabilities"),
    ("LongTermDebt", "Long-Term Debt"),
    ("LongTermDebtCurrent", "Current Portion of Debt"),
    ("StockholdersEquity", "Shareholders' Equity"),
    ("RetainedEarningsAccumulatedDeficit", "Retained Earnings"),
]

CASHFLOW_ROWS = [
    ("NetCashProvidedByUsedInOperatingActivities", "Operating Cash Flow"),
    ("NetCashProvidedByUsedInInvestingActivities", "Investing Cash Flow"),
    ("NetCashProvidedByUsedInFinancingActivities", "Financing Cash Flow"),
    ("PaymentsToAcquirePropertyPlantAndEquipment", "Capital Expenditures"),
    ("DepreciationDepletionAndAmortization", "Depreciation & Amortization"),
    ("PaymentsForRepurchaseOfCommonStock", "Stock Buybacks"),
    ("PaymentsOfDividendsCommonStock", "Dividends Paid"),
    ("RepaymentsOfLongTermDebt", "Debt Repayment"),
]


def _fmt(value) -> str:
    """Format a number into human-readable dollars (B/M) or return N/A."""
    if pd.isna(value):
        return "N/A"
    v = float(value)
    if abs(v) >= 1e9:
        return f"${v / 1e9:,.2f}B"
    if abs(v) >= 1e6:
        return f"${v / 1e6:,.1f}M"
    if abs(v) < 100:
        return f"${v:,.2f}"
    return f"${v:,.0f}"


def _format_statement(ticker: str, title: str, df: pd.DataFrame, rows: list) -> str:
    """Format one financial statement DataFrame into a text table."""
    q_cols = [c for c in df.columns if c[0] == "Q" or c.startswith("FY")]

    lines = []
    lines.append(f"{'=' * 80}")
    lines.append(f"  {ticker} — {title}")
    lines.append(f"{'=' * 80}")

    header = f"{'Metric':<35}"
    for q in q_cols:
        header += f"{q:>14}"
    lines.append(header)
    lines.append("-" * (35 + 14 * len(q_cols)))

    for xbrl_concept, label in rows:
        if xbrl_concept in df.index:
            line = f"{label:<35}"
            for q in q_cols:
                line += f"{_fmt(df.loc[xbrl_concept, q]):>14}"
            lines.append(line)
        else:
            lines.append(f"{label:<35}{'(not found)':>14}")

    return "\n".join(lines)


def get_structured_financials(ticker: str, periods: int = 8) -> str:
    """
    Fetch income statement, balance sheet, and cash flow from the SEC
    and return them as a single formatted text block.

    Returns empty string on failure (non-blocking — the LLM can still
    use the retrieval tool as a fallback).
    """
    try:
        company = Company(ticker)

        # Suppress edgar stdout noise (it prints "Data quality issue" messages)
        real_stdout = sys.stdout
        sys.stdout = io.StringIO()
        prev_level = logging.root.manager.disable
        logging.disable(logging.CRITICAL)

        try:
            income_df = company.income_statement(periods=periods, period="quarterly", as_dataframe=True)
            balance_df = company.balance_sheet(periods=periods, period="quarterly", as_dataframe=True)
            cashflow_df = company.cash_flow(periods=periods, period="quarterly", as_dataframe=True)
        finally:
            sys.stdout = real_stdout
            logging.disable(prev_level)

        sections = [
            _format_statement(ticker, "INCOME STATEMENT (Quarterly)", income_df, INCOME_ROWS),
            _format_statement(ticker, "BALANCE SHEET (Quarterly)", balance_df, BALANCE_ROWS),
            _format_statement(ticker, "CASH FLOW (Quarterly)", cashflow_df, CASHFLOW_ROWS),
        ]

        return "\n\n".join(sections)

    except Exception:
        return ""
