from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING

from .base import Base

if TYPE_CHECKING:
    from .contract import Contract

class CoTenant(Base):
    __tablename__ = "co_tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False)
    
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    id_card_number: Mapped[str | None] = mapped_column(String(255), nullable=True) 

    contract: Mapped["Contract"] = relationship(back_populates="co_tenants")