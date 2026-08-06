from pydantic import BaseModel, Field, ConfigDict, model_validator


class UtilityReadingBase(BaseModel):
    room_id: int
    billing_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    electric_old: float = Field(ge=0)
    electric_new: float = Field(ge=0)
    water_old: float = Field(ge=0)
    water_new: float = Field(ge=0)


    @model_validator(mode="after")
    def check_readings_increase(self) -> "UtilityReadingBase":
        if self.electric_new < self.electric_old:
            raise ValueError("electric_new không được nhỏ hơn electric_old")

        if not (self.water_old == 0 and self.water_new == 0):
            if self.water_new < self.water_old:
                raise ValueError("water_new không được nhỏ hơn water_old")
        return self
    

class UtilityReadingCreate(UtilityReadingBase):
    pass


class UtilityReadingResponse(UtilityReadingBase):
    id: int
    
    model_config = ConfigDict(from_attributes=True)

