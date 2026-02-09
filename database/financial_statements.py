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


def _ts_to_quarter(ts) -> str:
    """Convert Timestamp(2025-09-30) → 'Q3 2025'."""
    q = (ts.month - 1) // 3 + 1
    return f"Q{q} {ts.year}"


def _format_statement(ticker: str, title: str, df: pd.DataFrame, rows: list) -> str:
    """Format one financial statement DataFrame into a text table."""
    # Yahoo returns Timestamp columns; SEC returns string columns like "Q3 2025"
    if len(df.columns) > 0 and hasattr(df.columns[0], "month"):
        # Yahoo Timestamps — convert to quarter labels, keep original for .loc
        raw_cols = list(df.columns)
        q_labels = [_ts_to_quarter(c) for c in raw_cols]
    else:
        # SEC strings — filter to quarterly columns
        raw_cols = [c for c in df.columns if c[0] == "Q" or c.startswith("FY")]
        q_labels = raw_cols

    lines = []
    lines.append(f"{'=' * 80}")
    lines.append(f"  {ticker} — {title}")
    lines.append(f"{'=' * 80}")

    header = f"{'Metric':<35}"
    for ql in q_labels:
        header += f"{ql:>14}"
    lines.append(header)
    lines.append("-" * (35 + 14 * len(q_labels)))

    for xbrl_concept, label in rows:
        if xbrl_concept in df.index:
            line = f"{label:<35}"
            for rc in raw_cols:
                line += f"{_fmt(df.loc[xbrl_concept, rc]):>14}"
            lines.append(line)
        else:
            lines.append(f"{label:<35}{'(not found)':>14}")

    return "\n".join(lines)


def get_cached_financials(ticker: str, db, latest_filing) -> str:
    """
    DB-only read — used by the analysis route so it never calls the SEC.
    Returns the cached text block, or "" if not found.
    """
    from database.orm import FinancialStatements
    from sqlalchemy import and_

    cached = db.query(FinancialStatements).filter(
        and_(
            FinancialStatements.ticker == ticker,
            FinancialStatements.latest_filing_date == latest_filing,
        )
    ).first()

    return cached.financial_data if cached else ""


def get_or_fetch_financials(ticker: str, db, latest_filing) -> str:
    """
    Check DB cache first. If miss, fetch from SEC and save.
    Returns the formatted text block, or "" on failure.
    """
    from database.orm import FinancialStatements
    from sqlalchemy import and_
    from sqlalchemy.exc import IntegrityError

    # 1. Check DB cache
    cached = db.query(FinancialStatements).filter(
        and_(
            FinancialStatements.ticker == ticker,
            FinancialStatements.latest_filing_date == latest_filing,
        )
    ).first()

    if cached:
        return cached.financial_data

    # 2. Cache miss — fetch from SEC
    financial_data = get_structured_financials(ticker)

    if not financial_data:
        return ""

    # 3. Save to DB (handle race condition via unique constraint)
    try:
        new_row = FinancialStatements(
            ticker=ticker,
            financial_data=financial_data,
            latest_filing_date=latest_filing,
        )
        db.add(new_row)
        db.commit()
    except IntegrityError:
        db.rollback()
        cached = db.query(FinancialStatements).filter(
            and_(
                FinancialStatements.ticker == ticker,
                FinancialStatements.latest_filing_date == latest_filing,
            )
        ).first()
        if cached:
            return cached.financial_data

    return financial_data


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
