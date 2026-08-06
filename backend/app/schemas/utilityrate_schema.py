from datetime import date
from pydantic import BaseModel, Field, ConfigDict


class UtilityRateBase(BaseModel):
    room_id: int
    electric_price: float = Field(gt=0)
    water_price: float = Field(ge=0, default=0)
    default_water_amount: float | None = Field(default=None, ge=0)
    effective_from: date


class UtilityRateCreate(UtilityRateBase):
    pass


class UtilityRateResponse(UtilityRateBase):
    id: int

    model_config = ConfigDict(from_attributes=True)