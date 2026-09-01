from sqlalchemy import ForeignKey, String, Numeric, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class MonthlyHouseCost(Base):
    __tablename__ = "monthly_house_costs"
    __table_args__ = (
        UniqueConstraint("house_id", "month", name="uq_house_month_cost"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[str] = mapped_column(String(7), nullable=False) # Định dạng YYYY-MM

    # Tiền điện nước tổng 
    total_electric_kwh: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_electric_bill: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    
    total_water_cube: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    total_water_bill: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    # Các chi phí vận hành chung
    manager_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    other_house_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    other_house_cost_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)