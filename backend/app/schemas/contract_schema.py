from datetime import date
from pydantic import BaseModel, Field, ConfigDict, model_validator
from .room_schema import RoomResponse
from .tenant_schema import TenantResponse


class CoTenantCreate(BaseModel):
    full_name: str
    id_card_number: str | None = None

class CoTenantResponse(BaseModel):
    id: int
    full_name: str
    model_config = ConfigDict(from_attributes=True)

class ContractBase(BaseModel):
    room_id: int | None = None
    tenant_id: int
    start_date: date
    end_date: date | None = None
    monthly_rent: float = Field(gt=0)
    service_fee: float = Field(ge=0, default=0)
    cleaning_fee: float = Field(ge=0, default=0)
    internet_fee: float = Field(ge=0, default=0)
    payment_day: int = Field(default=1, ge=1, le=31)
    deposit: float = Field(ge=0, default=0)
    num_tenants: int = Field(default=1, ge=1)
    num_vehicles: int = Field(default=0, ge=0)
    temp_residence_reg: bool = False
    temp_residence_dec: bool = False
    notes: str | None = None

    @model_validator(mode="after")
    def check_end_date_after_start_date(self) -> "ContractBase":
        if self.end_date is not None and self.end_date <= self.start_date:
            raise ValueError("end_date phải sau start_date")
        return self
    

class ContractCreate(ContractBase):
    # Khi tạo mới hợp đồng, bắt buộc phải có room_id (không được để trống)
    room_id: int
    co_tenants: list[CoTenantCreate] | None = Field(default_factory=list)


class ContractUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    monthly_rent: float | None = Field(default=None, gt=0)
    service_fee: float | None = Field(default=None, ge=0)
    cleaning_fee: float | None = Field(default=None, ge=0)
    internet_fee: float | None = Field(default=None, ge=0)
    payment_day: int | None = Field(default=None, ge=1, le=31)
    deposit: float | None = Field(default=None, ge=0)
    num_tenants: int | None = Field(default=None, ge=1)       
    num_vehicles: int | None = Field(default=None, ge=0)      
    temp_residence_reg: bool | None = None
    temp_residence_dec: bool | None = None
    co_tenants: list[CoTenantCreate] | None = Field(default=None)
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
    temp_residence_dec: bool
    end_reason: str | None = None
    notes: str | None = None
    co_tenants: list[CoTenantResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)