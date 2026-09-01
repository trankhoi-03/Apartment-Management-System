from datetime import datetime

from pydantic import BaseModel, Field

class IncidentBase(BaseModel):
    description: str = Field(..., description="Mô tả chi tiết sự cố")
    status: str = Field(default="received", description="Trạng thái (received/processing/completed)")
    handler_info: str | None = Field(default=None, description="Thông tin bên xử lý (Tùy chọn)")
    repair_cost: float | None = Field(default=None, description="Chi phí sửa chữa")

class IncidentCreate(IncidentBase):
    room_id: int

class IncidentUpdate(BaseModel):
    description: str | None = None
    status: str | None = None
    handler_info: str | None = None
    repair_cost: float | None = None
    completed_at: datetime | None = None

class IncidentResponse(IncidentBase):
    id: int
    room_id: int
    created_at: datetime | None = None
    completed_at: datetime | None = None

    class Config:
        from_attributes = True