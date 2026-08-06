from pydantic import BaseModel, Field, EmailStr, ConfigDict

VN_PHONE_PATTERN = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"


class TenantBase(BaseModel):
    full_name: str = Field(max_length=100)
    email: EmailStr | None = None
    phone: str = Field(pattern=VN_PHONE_PATTERN)
    id_card_number: str | None = Field(default=None, max_length=20)


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=VN_PHONE_PATTERN)
    id_card_number: str | None = Field(default=None, max_length=20)


class TenantResponse(TenantBase):
    id: int

    model_config = ConfigDict(from_attributes=True)