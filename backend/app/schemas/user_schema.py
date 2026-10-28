from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator


VN_PHONE_PATTERN = r"^(0|\+84)(3|5|7|8|9)[0-9]{8}$"


def normalize_phone(phone: str) -> str:
    if phone.startswith("+84"):
        return "0" + phone[3:]
    return phone


def validate_bcrypt_password(value: str) -> str:
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")
    return value


class UserBase(BaseModel):
    full_name: str = Field(max_length=100)
    phone: str = Field(pattern=VN_PHONE_PATTERN)

    @field_validator("phone", mode="after")
    @classmethod
    def normalize_phone_number(cls, v: str) -> str:
        return normalize_phone(v)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=72)
    role: Literal["owner", "staff"] = "staff"

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return validate_bcrypt_password(v)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, pattern=VN_PHONE_PATTERN)
    password: str | None = Field(default=None, min_length=8, max_length=72)

    @field_validator("phone", mode="after")
    @classmethod
    def normalize_phone_number(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v is not None else None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str | None) -> str | None:
        return validate_bcrypt_password(v) if v is not None else None


class UserResponse(UserBase):
    id: int
    role: str
    full_name: str
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    phone: str = Field(pattern=VN_PHONE_PATTERN)
    password: str = Field(max_length=1024)

    @field_validator("phone", mode="after")
    @classmethod
    def normalize_phone_number(cls, v: str) -> str:
        return normalize_phone(v)
