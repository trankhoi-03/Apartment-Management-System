from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner, verify_house_access, verify_house_owner
from app.models.user import User
from app.models.room import Room
from app.models.utility_rate import UtilityRate
from app.schemas.utilityrate_schema import UtilityRateCreate, UtilityRateResponse

router = APIRouter(prefix="/utility-rates", tags=["utility-rates"])


def _room_permission(db: Session, room_id: int, user: User, owner_only: bool = False):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng.")
    checker = verify_house_owner if owner_only else verify_house_access
    checker(house_id=room.house_id, db=db, current_user=user)
    return room



@router.post("", response_model=UtilityRateResponse, status_code=status.HTTP_201_CREATED)
def create_utility_rate(payload: UtilityRateCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    room = db.query(Room).filter(Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={payload.room_id}",
        )

    _room_permission(db, payload.room_id, current_user, owner_only=True)

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
def list_utility_rates(room_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if room_id is not None:
        _room_permission(db, room_id, current_user)
        return db.query(UtilityRate).filter(UtilityRate.room_id == room_id).order_by(UtilityRate.effective_from.desc()).all()
    if not allowed_house_ids:
        return []
    query = db.query(UtilityRate).join(Room, UtilityRate.room_id == Room.id).filter(Room.house_id.in_(allowed_house_ids))
    return query.order_by(UtilityRate.effective_from.desc()).all()


@router.get("/{rate_id}", response_model=UtilityRateResponse)
def get_utility_rate(rate_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rate = db.query(UtilityRate).filter(UtilityRate.id == rate_id).first()
    if rate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn giá có id={rate_id}",
        )
    _room_permission(db, rate.room_id, current_user)
    return rate


@router.delete("/{rate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utility_rate(rate_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    rate = db.query(UtilityRate).filter(UtilityRate.id == rate_id).first()
    if rate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy đơn giá có id={rate_id}",
        )

    _room_permission(db, rate.room_id, current_user, owner_only=True)
    db.delete(rate)
    db.commit()
    return None