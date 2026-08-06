from pydantic import BaseModel, Field, ConfigDict, field_validator


VN_PHONE_PATTERN = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"


def normalize_phone(phone: str) -> str:
    if phone.startswith("+84"):
        return "0" + phone[3:]
    return phone


class UserBase(BaseModel):
    full_name: str = Field(max_length=100)
    phone: str = Field(pattern=VN_PHONE_PATTERN)

    @field_validator("phone", mode="after")
    @classmethod
    def normalize_phone_number(cls, v: str) -> str:
        return normalize_phone(v)



class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)
    role: str = Field(default="staff", description="owner hoặc staff")




class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, pattern=VN_PHONE_PATTERN)
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("phone", mode="after")
    @classmethod
    def normalize_phone_number(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return normalize_phone(v)


class UserResponse(UserBase):
    id: int
    role: str
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    phone: str = Field(pattern=VN_PHONE_PATTERN)
    password: str

    @field_validator("phone", mode="after")
    @classmethod
    def normalize_phone_number(cls, v: str) -> str:
        return normalize_phone(v)