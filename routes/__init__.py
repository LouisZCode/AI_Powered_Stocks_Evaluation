from .financial_analisys import router as financial_analisys_router
from .financial_harmonization import router as financial_harmonization_router
from .financial_debate import router as financial_debate_router
from .financial_report import router as financial_report_router

all_routes = [financial_analisys_router, financial_harmonization_router, financial_debate_router, financial_report_router]