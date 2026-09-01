from pydantic import BaseModel, Field, ConfigDict


class BillGenerateRequest(BaseModel):
    """Dùng khi chủ trọ bấm 'xuất bill' cho 1 hợp đồng, 1 tháng cụ thể.
    CHỈ gửi tham chiếu (contract_id, billing_month) - KHÔNG gửi số tiền.
    Server sẽ tự tính rent_amount/electric_amount/water_amount dựa trên
    Contract.monthly_rent + UtilityReading tương ứng + đơn giá điện nước,
    không bao giờ tin số tiền do client tự gửi lên."""

    contract_id: int
    billing_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$") 
    service_fee: float = Field(ge=0, default=0)
    # service_fee (phí dịch vụ/vệ sinh...) cho phép chủ trọ nhập tay ở đây,
    # vì đây không phải số tính từ công thức cố định như tiền điện/nước
    additional_fee: float = 0.0
    additional_fee_reason: str | None = None


class BillUpdate(BaseModel):
    status: str | None = None


class BillEditRequest(BaseModel):
    electric_new: float
    water_new: float
    default_water_amount: float
    service_fee: float
    additional_fee: float = 0.0
    additional_fee_reason: str | None = None


class BillResponse(BaseModel):
    id: int
    contract_id: int
    billing_month: str
    rent_amount: float
    electric_amount: float
    electric_consumed: float       # kWh tiêu thụ tháng này
    water_amount: float
    water_consumed: float          # m³ tiêu thụ tháng này
    service_fee: float
    additional_fee: float = 0.0
    additional_fee_reason: str | None = None
    total_amount: float
    status: str
    pdf_url: str | None = None
 
    model_config = ConfigDict(from_attributes=True)