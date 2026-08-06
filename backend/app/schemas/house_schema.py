from pydantic import BaseModel, Field, ConfigDict


class HouseBase(BaseModel):
    name: str = Field(max_length=100)
    address: str | None = None
    theme_color: str = "#3B82F6"


class HouseCreate(HouseBase):
    pass


class HouseUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    address: str | None = None


class HouseResponse(HouseBase):
    id: int
    model_config = ConfigDict(from_attributes=True)