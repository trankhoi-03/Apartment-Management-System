from pydantic import BaseModel
from typing import List

class MonthlyCostUpdate(BaseModel):
    total_electric_kwh: float
    total_electric_bill: float
    total_water_cube: float
    total_water_bill: float

class UtilityBillInput(BaseModel):
    total_electric_kwh: float
    total_electric_bill: float
    total_water_cube: float
    total_water_bill: float

class OtherCostUpdate(BaseModel):
    other_house_cost: float
    other_house_cost_reason: str | None = None

class OtherCostInput(BaseModel):
    other_house_cost: float
    other_house_cost_reason: str | None = None

class ReportCategory(BaseModel):
    total: float
    details: list

class HouseFinancialReport(BaseModel):
    house_id: int
    house_name: str
    month: str
    total_revenue: float
    total_cost: float
    net_profit: float
    
    rent_tab: ReportCategory      
    other_revenue_tab: ReportCategory
    utilities_tab: ReportCategory 
    maintenance_tab: ReportCategory 
    management_tab: ReportCategory 
    base_cost_tab: ReportCategory  
    other_costs_tab: ReportCategory 
    utility_bill_input: UtilityBillInput
    other_cost_input: OtherCostInput