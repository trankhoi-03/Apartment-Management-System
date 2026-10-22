from pydantic import BaseModel, Field, EmailStr, ConfigDict, field_validator

VN_PHONE_PATTERN = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"


class TenantBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str = Field(pattern=VN_PHONE_PATTERN)

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Họ tên không được để trống")
        return value


class TenantCreate(TenantBase):
    id_card_number: str | None = None


class TenantUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=VN_PHONE_PATTERN)
    force_update_phone: bool = False


class TenantResponse(TenantBase):
    id: int
    matched_name: str | None = None

    model_config = ConfigDict(from_attributes=True)