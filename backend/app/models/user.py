from datetime import datetime
from sqlalchemy import Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .houses import House  

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="owner")
    
    subscription_plan: Mapped[str] = mapped_column(String(50), default="free")
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_rooms: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Thêm quan hệ ngược lại với House
    managed_houses: Mapped[list["House"]] = relationship(
        secondary="user_house", 
        back_populates="managers"
    )