from sqlalchemy import DateTime, ForeignKey, String, Text, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
import datetime
from typing import TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .room import Room

class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(
        ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    
    # received = "đã tiếp nhận", in_progress = "đang xử lý", completed = "đã hoàn thành"
    status: Mapped[str] = mapped_column(String(20), default="received")

    handler_info: Mapped[str | None] = mapped_column(String(255), nullable=True)

    repair_cost: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    completed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    room: Mapped["Room"] = relationship(back_populates="incidents")