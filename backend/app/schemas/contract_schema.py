from datetime import date
from pydantic import BaseModel, Field, ConfigDict, model_validator
from .room_schema import RoomResponse
from .tenant_schema import TenantResponse

class ContractBase(BaseModel):
    room_id: int | None = None
    tenant_id: int
    start_date: date
    end_date: date | None = None
    monthly_rent: float = Field(gt=0)
    service_fee: float = Field(ge=0, default=0)
    deposit: float = Field(ge=0, default=0)
    num_tenants: int = Field(default=1, ge=1)
    num_vehicles: int = Field(default=0, ge=0)
    temp_residence_reg: bool = False
    notes: str | None = None

    @model_validator(mode="after")
    def check_end_date_after_start_date(self) -> "ContractBase":
        if self.end_date is not None and self.end_date <= self.start_date:
            raise ValueError("end_date phải sau start_date")
        return self
    

class ContractCreate(ContractBase):
    # Khi tạo mới hợp đồng, bắt buộc phải có room_id (không được để trống)
    room_id: int


class ContractUpdate(BaseModel):
    end_date: date | None = None
    monthly_rent: float | None = Field(default=None, gt=0)
    service_fee: float | None = Field(default=None, ge=0)
    deposit: float | None = Field(default=None, ge=0)
    status: str | None = None
    end_reason: str | None = None
    notes: str | None = None


class ContractResponse(ContractBase):
    id: int
    status: str
    room: RoomResponse | None = None  # Cho phép None nếu phòng gắn liền đã bị xóa
    tenant: TenantResponse
    num_tenants: int
    num_vehicles: int
    temp_residence_reg: bool
    end_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)