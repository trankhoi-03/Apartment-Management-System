from pydantic import BaseModel, Field, ConfigDict


class RoomBase(BaseModel):
    room_number: str = Field(max_length=20)
    area_sqm: float | None = None
    cost_price: float = Field(gt=0)
    is_water_meter: bool = True
    furnitures: list[str] = Field(default_factory=list)



class RoomCreate(RoomBase):
    house_id: int


class RoomUpdate(BaseModel):
    room_number: str | None = Field(default=None, max_length=20)
    area_sqm: float | None = None
    cost_price: float | None = Field(default=None, gt=0)
    status: str | None = None
    is_water_meter: bool | None = None
    furnitures: list[str] | None = None


class RoomResponse(RoomBase):
    id: int
    status: str
    is_water_meter: bool
    house_id: int

    model_config = ConfigDict(from_attributes=True)