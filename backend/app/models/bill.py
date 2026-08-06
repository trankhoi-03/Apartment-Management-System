from sqlalchemy import ForeignKey, String, Numeric, UniqueConstraint, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from .base import Base

if TYPE_CHECKING:
    from .contract import Contract


class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (
        UniqueConstraint("contract_id", "billing_month", name="uq_contract_month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    contract_id: Mapped[int] = mapped_column(
        ForeignKey("contracts.id", ondelete="RESTRICT"), nullable=False
    )

    billing_month: Mapped[str] = mapped_column(String(7), nullable=False)

    rent_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    electric_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    water_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    service_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    additional_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    additional_fee_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    electric_consumed: Mapped[float] = mapped_column(Float, nullable=False)
    water_consumed: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending = chưa gửi, sent = đã gửi mail, paid = đã thanh toán

    pdf_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    contract: Mapped["Contract"] = relationship(back_populates="bills")