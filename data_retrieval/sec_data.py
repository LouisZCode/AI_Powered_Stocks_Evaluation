"""
Script to retrieve data from the SEC and get it into the RAG Database
"""

from edgar import Company, set_identity
from edgar.xbrl import XBRLS
#from config import SEC_IDENTITY

set_identity("Juan Perez juan.perezzgz@hotmail.com")


def get_financials_for_llm(ticker: str) -> str:
    """
    Extract 8 quarters of financial data and format for LLM.
    Returns a clean string ready to paste into a prompt.
    """
    company = Company(ticker)
    filings = company.get_filings(form="10-Q").latest(8)

    xbrls = XBRLS.from_filings(filings)
    statements = xbrls.statements

    # Get DataFrames
    income_df = statements.income_statement().to_dataframe()
    balance_df = statements.balance_sheet().to_dataframe()
    cashflow_df = statements.cashflow_statement().to_dataframe()

    # Get period columns (dates)
    exclude_cols = ['label', 'concept', 'level', 'abstract', 'units', 'decimals', 'negated', 'parent_abstract_concept',
                    'dimension', 'dimension_label', 'balance', 'weight', 'preferred_sign', 'parent_concept']
    periods = [c for c in income_df.columns if c not in exclude_cols and '20' in str(c)]

    # Sort periods from newest to oldest
    periods = sorted(periods, reverse=True)

    def convert_ytd_to_quarterly(ytd_values, periods):
        """
        Convert YTD cumulative values to standalone quarterly values.
        Works with any fiscal year by finding the previous period ~3 months earlier.

        Logic: Find the next period in the list (older) that's about 80-100 days before.
        If the gap is larger (e.g., 270+ days), this is Q1 and YTD = standalone.
        """
        from datetime import datetime

        quarterly = {}

        def parse_to_num(val):
            """Parse formatted value to number."""
            if val == "N/A" or val is None:
                return None
            try:
                s = str(val).replace("$", "").replace(",", "")
                if "B" in s:
                    return float(s.replace("B", "")) * 1e9
                elif "M" in s:
                    return float(s.replace("M", "")) * 1e6
                return float(s)
            except:
                return None

        def parse_date(date_str):
            return datetime.strptime(date_str, "%Y-%m-%d")

        for i, period in enumerate(periods):
            ytd_val = ytd_values.get(period, "N/A")
            curr_num = parse_to_num(ytd_val)

            if curr_num is None:
                quarterly[period] = "N/A"
                continue

            curr_date = parse_date(period)

            # Look for previous period (next in list since sorted newest first)
            prev_ytd_num = None
            is_q1 = True  # Assume Q1 unless we find a previous quarter
            is_oldest = (i == len(periods) - 1)  # Last in list = oldest data

            if i + 1 < len(periods):
                prev_period = periods[i + 1]
                prev_date = parse_date(prev_period)
                days_diff = (curr_date - prev_date).days

                # If gap is ~90 days (60-120), it's same fiscal year
                # If gap is ~365 days or no previous, it's Q1
                if 60 <= days_diff <= 120:
                    is_q1 = False
                    prev_ytd_num = parse_to_num(ytd_values.get(prev_period, "N/A"))

            # For oldest period, check if it looks like Q1 based on month
            # Q1 typically ends in Jan-Apr, Q2 in May-Jul, Q3 in Aug-Oct, Q4 in Nov-Dec
            curr_month = curr_date.month
            looks_like_q1 = curr_month in [1, 2, 3, 4]  # Jan-Apr = likely Q1

            # Calculate standalone quarter
            if is_q1 and not is_oldest:
                # Q1: YTD = standalone
                quarterly[period] = format_value(curr_num)
            elif is_q1 and is_oldest and looks_like_q1:
                # Oldest period and looks like Q1 - show value
                quarterly[period] = format_value(curr_num)
            elif is_q1 and is_oldest and not looks_like_q1:
                # Oldest period but NOT Q1 (e.g., June) - can't calculate
                quarterly[period] = "N/A*"
            elif prev_ytd_num is not None:
                # Q2/Q3/Q4: subtract previous YTD
                standalone = curr_num - prev_ytd_num
                quarterly[period] = format_value(standalone)
            else:
                # Can't calculate
                quarterly[period] = "N/A*"

        return quarterly

    def find_row(df, keywords, exclude_keywords=None, prefer_total=False):
        """Find first matching row by keywords in label, with optional exclusions."""
        exclude_keywords = exclude_keywords or []
        for kw in keywords:
            mask = df['label'].str.lower().str.contains(kw.lower(), na=False)
            # Apply exclusions
            for excl in exclude_keywords:
                mask = mask & ~df['label'].str.lower().str.contains(excl.lower(), na=False)
            if mask.any():
                matches = df[mask]
                # If prefer_total, look for "total" in label first
                if prefer_total and len(matches) > 1:
                    total_mask = matches['label'].str.lower().str.contains('total', na=False)
                    if total_mask.any():
                        return matches[total_mask].iloc[0]
                return matches.iloc[0]
        return None

    def find_row_by_concept(df, concepts, prefer_total=False):
        """Find row by XBRL concept name (more reliable than label)."""
        for concept in concepts:
            mask = df['concept'].str.contains(concept, case=False, na=False)
            if mask.any():
                matches = df[mask]
                # If prefer_total, look for "total" in label first
                if prefer_total and len(matches) > 1:
                    total_mask = matches['label'].str.lower().str.contains('total', na=False)
                    if total_mask.any():
                        return matches[total_mask].iloc[0]
                # Also prefer rows without segment/geographic breakdowns
                non_segment = matches[~matches['label'].str.contains('Segment|Region|Country|US|Europe|Asia', case=False, na=False)]
                if len(non_segment) > 0:
                    return non_segment.iloc[0]
                return matches.iloc[0]
        return None

    def format_value(val):
        """Format number as $XB or $XM."""
        if val is None or (isinstance(val, float) and str(val) == 'nan'):
            return "N/A"
        try:
            val = float(val)
            if abs(val) >= 1e9:
                return f"${val/1e9:.1f}B"
            elif abs(val) >= 1e6:
                return f"${val/1e6:.0f}M"
            else:
                return f"${val:,.0f}"
        except:
            return str(val)

    def parse_val(s):
        """Parse $1.5B or $500M back to number."""
        if s == "N/A" or s == "N/A*" or s is None:
            return None
        try:
            s = str(s).replace("$", "").replace(",", "")
            if "B" in s:
                return float(s.replace("B", "")) * 1e9
            elif "M" in s:
                return float(s.replace("M", "")) * 1e6
            elif "%" in s:
                return None  # Don't parse percentages
            return float(s)
        except:
            return None

    def calc_growth(val1, val2):
        """Calculate % change from val2 to val1."""
        if val1 is None or val2 is None or val2 == 0:
            return None
        return ((val1 - val2) / abs(val2)) * 100

    def extract_metric(df, keywords, periods, exclude_keywords=None, concepts=None, prefer_total=False):
        """Extract a metric across all periods. Try label match first, then concept."""
        row = find_row(df, keywords, exclude_keywords, prefer_total)
        if row is None and concepts:
            row = find_row_by_concept(df, concepts, prefer_total)
        if row is None:
            return {p: "N/A" for p in periods}
        return {p: format_value(row.get(p)) for p in periods}

    # Extract exactly the 8 metrics needed for Financial Strength evaluation

    # 1. REVENUE - try concept-based first (most reliable)
    # Check both revenue concepts and pick the one with actual data
    revenue = extract_metric(income_df, [
        "total revenue", "total revenues", "contract revenue"
    ], periods, concepts=[
        "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",  # Most common
        "us-gaap_Revenues",
        "us-gaap_RevenuesNetOfInterestExpense",  # Banks
    ], prefer_total=True)

    # If still all N/A, the concept might have NaN - try by label only
    if all(v == "N/A" for v in revenue.values()):
        revenue = extract_metric(income_df, [
            "total revenue", "total revenues", "contract revenue", "net revenue"
        ], periods, prefer_total=True)

    # 2. NET INCOME
    net_income = extract_metric(income_df, [
        "net income"
    ], periods, concepts=[
        "us-gaap_NetIncomeLoss"
    ])

    # 3. GROSS PROFIT (for Gross Margin calculation)
    gross_profit = extract_metric(income_df, [
        "gross profit"
    ], periods, concepts=[
        "us-gaap_GrossProfit"
    ])

    # If no Gross Profit, try to calculate from Revenue - Cost of Revenue
    if all(v == "N/A" for v in gross_profit.values()):
        cost_of_revenue = extract_metric(income_df, [
            "total cost of revenue", "cost of revenue"
        ], periods, concepts=[
            "us-gaap_CostOfRevenue",
            "us-gaap_CostOfGoodsAndServicesSold"
        ], prefer_total=True)

        # Calculate Gross Profit = Revenue - Cost of Revenue
        calculated_gp = {}
        for p in periods:
            rev_val = revenue.get(p, "N/A")
            cost_val = cost_of_revenue.get(p, "N/A")
            if rev_val != "N/A" and cost_val != "N/A":
                try:
                    rev_num = float(str(rev_val).replace("$", "").replace("B", "e9").replace("M", "e6").replace(",", ""))
                    cost_num = float(str(cost_val).replace("$", "").replace("B", "e9").replace("M", "e6").replace(",", ""))
                    calculated_gp[p] = format_value(rev_num - cost_num)
                except:
                    calculated_gp[p] = "N/A"
            else:
                calculated_gp[p] = "N/A"
        gross_profit = calculated_gp

    # 4. OPERATIONAL COSTS - try multiple options
    op_expenses = extract_metric(income_df, [
        "operating expenses", "total operating expenses"
    ], periods, concepts=[
        "us-gaap_OperatingExpenses"
    ])

    # Fallback: try "Costs and Expenses" (META uses this)
    if all(v == "N/A" for v in op_expenses.values()):
        op_expenses = extract_metric(income_df, [
            "costs and expenses"
        ], periods, concepts=[
            "us-gaap_CostsAndExpenses"
        ])

    # 5. CASH FLOW (Operating)
    cash_flow = extract_metric(cashflow_df, [
        "net cash from operating", "net cash provided by operating"
    ], periods, concepts=[
        "us-gaap_NetCashProvidedByUsedInOperatingActivities"
    ])

    # 7. TOTAL ASSETS
    total_assets = extract_metric(balance_df, ["total assets"], periods,
        exclude_keywords=["current"],
        concepts=["us-gaap_Assets"])

    # 8. TOTAL DEBT (Total Liabilities)
    total_debt = extract_metric(balance_df, [
        "total liabilities"
    ], periods,
        exclude_keywords=["stockholders", "equity", "and stockholders"],
        concepts=["us-gaap_Liabilities"])

    # Convert income statement & cash flow from YTD to standalone quarterly
    revenue_quarterly = convert_ytd_to_quarterly(revenue, periods)
    net_income_quarterly = convert_ytd_to_quarterly(net_income, periods)
    gross_profit_quarterly = convert_ytd_to_quarterly(gross_profit, periods)
    op_expenses_quarterly = convert_ytd_to_quarterly(op_expenses, periods)
    cash_flow_quarterly = convert_ytd_to_quarterly(cash_flow, periods)

    # Balance sheet metrics are point-in-time (not cumulative), keep as-is
    # Calculate Gross Margin % for each period
    gross_margin_pct = {}
    for p in periods:
        gp = parse_val(gross_profit_quarterly.get(p, "N/A"))
        rev = parse_val(revenue_quarterly.get(p, "N/A"))
        if gp and rev and rev > 0:
            margin = (gp / rev) * 100
            gross_margin_pct[p] = f"{margin:.0f}%"
        else:
            gross_margin_pct[p] = "N/A"

    # Calculate QoQ Growth for Revenue
    qoq_growth = {}
    for i, p in enumerate(periods):
        if i < len(periods) - 1:
            curr = parse_val(revenue_quarterly.get(periods[i], "N/A"))
            prev = parse_val(revenue_quarterly.get(periods[i + 1], "N/A"))
            growth = calc_growth(curr, prev)
            if growth is not None:
                qoq_growth[p] = f"{growth:+.0f}%"
            else:
                qoq_growth[p] = "N/A"
        else:
            qoq_growth[p] = "--"

    metrics = {
        "Revenue": revenue_quarterly,
        "Net Income": net_income_quarterly,
        "Gross Profit": gross_profit_quarterly,
        "Gross Margin %": gross_margin_pct,
        "Operational Costs": op_expenses_quarterly,
        "Cash Flow": cash_flow_quarterly,
        "QoQ Growth": qoq_growth,
        "Total Assets": total_assets,  # Point-in-time, no conversion
        "Total Debt": total_debt,       # Point-in-time, no conversion
    }

    # Remove metrics that are all N/A
    metrics = {k: v for k, v in metrics.items() if not all(val == "N/A" for val in v.values())}

    # Format output
    output = []
    output.append(f"FINANCIAL DATA: {ticker} ({company.name})")
    output.append(f"Period Coverage: {periods[-1]} to {periods[0]} (8 quarters)")
    output.append("=" * 100)
    output.append("")

    # Create table header
    header = f"{'Metric':<25}" + "".join([f"{p:>12}" for p in periods])
    output.append(header)
    output.append("-" * len(header))

    # Add each metric row
    for metric_name, values in metrics.items():
        row = f"{metric_name:<25}" + "".join([f"{values[p]:>12}" for p in periods])
        output.append(row)

    output.append("")
    output.append("=" * 100)

    # Add calculated trends (YoY for latest quarter)
    # YoY Trends
    output.append("")
    output.append("YEAR-OVER-YEAR TRENDS (Latest Quarter vs Same Quarter Last Year):")
    output.append("-" * 60)

    def calc_yoy(metric_values, periods):
        """Calculate YoY change between latest and same quarter last year."""
        latest = parse_val(metric_values.get(periods[0], "N/A"))
        year_ago = parse_val(metric_values.get(periods[4], "N/A")) if len(periods) > 4 else None

        growth = calc_growth(latest, year_ago)
        if growth is not None:
            return f"{growth:+.1f}%"
        return "N/A"

    for metric_name, values in metrics.items():
        yoy = calc_yoy(values, periods)
        output.append(f"  {metric_name}: {yoy}")

    return "\n".join(output)


# Test it
if __name__ == "__main__":
    
    ticker = input("name your ticker:\n")

    print("=" * 100)
    print(f"LLM-READY FINANCIAL DATA FOR {ticker}")
    print("=" * 100)
    print()

    result = get_financials_for_llm(ticker)
    print(result)

    print("\n" + "=" * 100)
    print(f"Character count: {len(result)}")
    print("=" * 100)