from datetime import datetime

from pydantic import BaseModel, Field

class IncidentBase(BaseModel):
    description: str = Field(..., description="Mô tả chi tiết sự cố")
    status: str = Field(default="received", description="Trạng thái (received/processing/completed)")

class IncidentCreate(IncidentBase):
    room_id: int

class IncidentUpdate(BaseModel):
    description: str | None = None
    status: str | None = None

class IncidentResponse(IncidentBase):
    id: int
    room_id: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True