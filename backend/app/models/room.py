from sqlalchemy import String, Numeric, Float, ForeignKey, UniqueConstraint, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from .incident import Incident
from .base import Base
from .houses import House

if TYPE_CHECKING:
    from .contract import Contract
    from .utility_reading import UtilityReading
    from .utility_rate import UtilityRate


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint('house_id', 'room_number', name='uix_house_room'),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    area_sqm: Mapped[float | None] = mapped_column(Float, nullable=True)
    base_rent: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # base_rent: giá thuê niêm yết hiện tại, KHÔNG phải giá đã ký trong hợp đồng cụ thể
    is_water_meter: Mapped[bool] = mapped_column(default=True, nullable=False)
    # True: có đồng hồ nước, tính theo số đọc thực tế
    # False: tính theo default_water_amount trong UtilityRate
    status: Mapped[str] = mapped_column(String(20), default="vacant")
    # vacant = trống, occupied = đang có người thuê, inactive = ngừng cho thuê 

    house_id: Mapped[int] = mapped_column(
        ForeignKey("houses.id", ondelete="RESTRICT"), nullable=False
    )

    furnitures: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True, default=list)

    contracts: Mapped[list["Contract"]] = relationship(back_populates="room")
    utility_readings: Mapped[list["UtilityReading"]] = relationship(back_populates="room")
    utility_rates: Mapped[list["UtilityRate"]] = relationship(back_populates="room")
    house: Mapped["House"] = relationship(back_populates="rooms")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="room", cascade="all, delete-orphan")
