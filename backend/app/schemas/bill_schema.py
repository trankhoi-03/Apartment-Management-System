from pydantic import BaseModel, Field, ConfigDict
from datetime import date


class BillGenerateRequest(BaseModel):
    contract_id: int
    billing_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$") 
    due_date: date | None = None
    rent_amount: float | None = Field(default=None, ge=0)
    service_fee: float = Field(ge=0, default=0)
    # service_fee (phí dịch vụ/vệ sinh...) cho phép chủ trọ nhập tay ở đây,
    # vì đây không phải số tính từ công thức cố định như tiền điện/nước
    cleaning_fee: float = Field(ge=0, default=0)
    internet_fee: float = Field(ge=0, default=0)
    additional_fee: float = 0.0
    additional_fee_reason: str | None = None
    discount_amount: float = Field(ge=0, default=0)
    discount_reason: str | None = None

    electric_calc_method: str = Field(default="fixed_price") # "fixed_price" | "split_ratio"
    electric_total_consumed: float | None = Field(default=None, ge=0) 
    electric_total_cost: float | None = Field(default=None, ge=0)


class BillUpdate(BaseModel):
    status: str | None = None


class BillEditRequest(BaseModel):
    billing_month: str | None = None
    due_date: date | None = None
    rent_amount: float | None = Field(default=None, ge=0)
    electric_new: float | None = None
    water_new: float | None = None
    default_water_amount: float | None = None
    service_fee: float | None = None
    cleaning_fee: float | None = None
    internet_fee: float | None = None
    additional_fee: float | None = None
    additional_fee_reason: str | None = None
    discount_amount: float | None = None
    discount_reason: str | None = None

    electric_calc_method: str | None = None
    electric_total_consumed: float | None = None
    electric_total_cost: float | None = None


class BillResponse(BaseModel):
    id: int
    contract_id: int
    billing_month: str
    due_date: date | None = None
    rent_amount: float
    discount_amount: float = 0.0
    discount_reason: str | None = None
    electric_amount: float
    electric_consumed: float       # kWh tiêu thụ tháng này
    water_amount: float
    water_consumed: float          # m³ tiêu thụ tháng này
    service_fee: float
    cleaning_fee: float
    internet_fee: float
    additional_fee: float = 0.0
    additional_fee_reason: str | None = None
    total_amount: float
    status: str
    pdf_url: str | None = None

    electric_calc_method: str = "fixed_price"
    electric_total_consumed: float | None = None
    electric_total_cost: float | None = None
 
    model_config = ConfigDict(from_attributes=True)