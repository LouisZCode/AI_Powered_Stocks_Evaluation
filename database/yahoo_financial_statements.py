"""
Fetch structured financial statements from Yahoo Finance via yfinance
for non-US companies. Fallback when SEC EDGAR has no data.
"""

from database.financial_statements import _fmt, _format_statement

# ── Yahoo Finance row definitions (camelCase keys, pretty=False) ─────

YAHOO_INCOME_ROWS = [
    ("TotalRevenue", "Revenue"),
    ("CostOfRevenue", "Cost of Revenue"),
    ("GrossProfit", "Gross Profit"),
    ("ResearchAndDevelopment", "R&D Expense"),
    ("SellingGeneralAndAdministration", "SG&A Expense"),
    ("OperatingExpense", "Total Operating Expenses"),
    ("OperatingIncome", "Operating Income"),
    ("TaxProvision", "Income Tax"),
    ("NetIncome", "Net Income"),
]

YAHOO_BALANCE_ROWS = [
    ("TotalAssets", "Total Assets"),
    ("CurrentAssets", "Current Assets"),
    ("CashAndCashEquivalents", "Cash & Equivalents"),
    ("AccountsReceivable", "Accounts Receivable"),
    ("Inventory", "Inventory"),
    ("NetPPE", "Property & Equipment"),
    ("OtherNonCurrentAssets", "Other Noncurrent Assets"),
    ("TotalLiabilitiesNetMinorityInterest", "Total Liabilities"),
    ("LongTermDebt", "Long-Term Debt"),
    ("CurrentDebt", "Current Portion of Debt"),
    ("StockholdersEquity", "Shareholders' Equity"),
    ("RetainedEarnings", "Retained Earnings"),
]

YAHOO_CASHFLOW_ROWS = [
    ("OperatingCashFlow", "Operating Cash Flow"),
    ("InvestingCashFlow", "Investing Cash Flow"),
    ("FinancingCashFlow", "Financing Cash Flow"),
    ("CapitalExpenditure", "Capital Expenditures"),
    ("DepreciationAmortizationDepletion", "Depreciation & Amortization"),
    ("LongTermDebtPayments", "Debt Repayment"),
]


def get_yahoo_financials(ticker: str) -> str:
    """
    Fetch quarterly financials from Yahoo Finance.
    Returns formatted text block, or "" on failure/empty data.
    """
    import yfinance as yf

    try:
        t = yf.Ticker(ticker)
        income_df = t.get_income_stmt(pretty=False, freq="quarterly")
        balance_df = t.get_balance_sheet(pretty=False, freq="quarterly")
        cashflow_df = t.get_cash_flow(pretty=False, freq="quarterly")

        # Need at least income or balance sheet to be useful
        if income_df.empty and balance_df.empty:
            return ""

        sections = []
        if not income_df.empty:
            sections.append(_format_statement(ticker, "INCOME STATEMENT (Quarterly)", income_df, YAHOO_INCOME_ROWS))
        if not balance_df.empty:
            sections.append(_format_statement(ticker, "BALANCE SHEET (Quarterly)", balance_df, YAHOO_BALANCE_ROWS))
        if not cashflow_df.empty:
            sections.append(_format_statement(ticker, "CASH FLOW (Quarterly)", cashflow_df, YAHOO_CASHFLOW_ROWS))

        return "\n\n".join(sections) if sections else ""

    except Exception:
        return ""
