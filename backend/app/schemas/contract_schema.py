from datetime import date
from pydantic import BaseModel, Field, ConfigDict, model_validator
from .room_schema import RoomResponse
from .tenant_schema import TenantResponse

class ContractBase(BaseModel):
    room_id: int
    tenant_id: int
    start_date: date
    end_date: date | None = None
    monthly_rent: float = Field(gt=0)
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
    pass


class ContractUpdate(BaseModel):
    end_date: date | None = None
    monthly_rent: float | None = Field(default=None, gt=0)
    deposit: float | None = Field(default=None, ge=0)
    status: str | None = None
    end_reason: str | None = None
    notes: str | None = None

class ContractResponse(ContractBase):
    id: int
    status: str
    room: RoomResponse
    tenant: TenantResponse
    num_tenants: int
    num_vehicles: int
    temp_residence_reg: bool
    end_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)
