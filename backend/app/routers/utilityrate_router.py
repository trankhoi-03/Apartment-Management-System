from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.room import Room
from app.models.utility_rate import UtilityRate
from app.schemas.utilityrate_schema import UtilityRateCreate, UtilityRateResponse

router = APIRouter(prefix="/utility-rates", tags=["utility-rates"])


@router.post("", response_model=UtilityRateResponse, status_code=status.HTTP_201_CREATED)
def create_utility_rate(payload: UtilityRateCreate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={payload.room_id}",
        )

    if not room.is_water_meter and payload.default_water_amount is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Phòng id={payload.room_id} không có đồng hồ nước "
                "(is_water_meter=False). Bắt buộc phải có default_water_amount."
            ),
        )

    new_rate = UtilityRate(**payload.model_dump())
    db.add(new_rate)
    db.commit()
    db.refresh(new_rate)
    return new_rate


@router.get("", response_model=list[UtilityRateResponse])
def list_utility_rates(room_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(UtilityRate)
    if room_id is not None:
        query = query.filter(UtilityRate.room_id == room_id)
    return query.order_by(UtilityRate.effective_from.desc()).all()


@router.get("/{rate_id}", response_model=UtilityRateResponse)
def get_utility_rate(rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(UtilityRate).filter(UtilityRate.id == rate_id).first()
    if rate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn giá có id={rate_id}",
        )
    return rate


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utility_rate(rate_id: int, db: Session = Depends(get_db)):
    rate = db.query(UtilityRate).filter(UtilityRate.id == rate_id).first()
    if rate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn giá có id={rate_id}",
        )

    db.delete(rate)
    db.commit()
    return None