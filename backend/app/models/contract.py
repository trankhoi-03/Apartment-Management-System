from datetime import date
from sqlalchemy import ForeignKey, String, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .room import Room
    from .tenant import Tenant
    from .bill import Bill


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True)

    room_id: Mapped[int | None] = mapped_column(
        ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True
    )
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False
    )

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # end_date nullable vì hợp đồng có thể chưa xác định ngày kết thúc (thuê tự do)

    monthly_rent: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # Giá thuê THỰC TẾ đã ký trong hợp đồng này 

    service_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)

    deposit: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    payment_day: Mapped[int] = mapped_column(default=1, nullable=False)
    # Hạn thanh toán tiền nhà
    status: Mapped[str] = mapped_column(String(20), default="active")
    # active = đang hiệu lực, ended = đã kết thúc, terminated = chấm dứt sớm

    end_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    num_tenants: Mapped[int] = mapped_column(default=1, nullable=False)
    num_vehicles: Mapped[int] = mapped_column(default=0, nullable=False)
    temp_residence_reg: Mapped[bool] = mapped_column(default=False, nullable=False)

    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    room: Mapped["Room | None"] = relationship(back_populates="contracts")
    tenant: Mapped["Tenant"] = relationship(back_populates="contracts")
    bills: Mapped[list["Bill"]] = relationship(back_populates="contract")