from datetime import datetime
from sqlalchemy import Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="owner")
    # owner = chủ trọ chính, staff = người phụ 


    subscription_plan: Mapped[str] = mapped_column(String(50), default="free")  # "free", "premium_monthly", "premium_yearly"
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_rooms: Mapped[int] = mapped_column(Integer, default=5)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )