from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.room import Room
from app.models.utility_reading import UtilityReading
from app.schemas.utility_schema import UtilityReadingCreate, UtilityUpdate, UtilityReadingResponse


router = APIRouter(prefix="/utility", tags=["utility"])

@router.post("", response_model=UtilityReadingResponse, status_code=status.HTTP_201_CREATED)
def create_utility(payload: UtilityReadingCreate, db: Session = Depends(get_db)):
    """Tạo record số điện/nước cho 1 phòng, 1 tháng
    2 bước validate:
    1. room_id tồn tại
    2. (room_id, billing_month) chưa tồn tại - bắt qua IntegrityError

    Lưu ý: electric_old/water_old của tháng này KHÔNG bắt buộc phải bằng
    electric_new/water_new của tháng trước. Đồng hồ vẫn có thể chạy giữa 2 kỳ
    (vd: bên sale bật điện/nước demo phòng cho khách) nên 2 số này có thể lệch nhau."""
    room = db.query(Room).filter(Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={payload.room_id}"
        )

    new_reading = UtilityReading(**payload.model_dump())
    db.add(new_reading)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Phòng id={payload.room_id} đã có số điện/nước "
                f"cho tháng {payload.billing_month}"
            )
        )
    db.refresh(new_reading)
    return new_reading


@router.get("", response_model=list[UtilityReadingResponse])
def list_utility_readings(room_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(UtilityReading)
    if room_id is not None:
        query = query.filter(UtilityReading.room_id == room_id)
    return query.order_by(UtilityReading.billing_month.desc()).all()


@router.get("/{reading_id}", response_model=UtilityReadingResponse)
def get_utility_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = (
        db.query(UtilityReading).filter(UtilityReading.id == reading_id).first()
    )
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy record có id={reading_id}"
        )
    return reading


@router.put("/{utility_id}", response_model=UtilityReadingResponse)
def update_utility_reading(utility_id: int, payload: UtilityUpdate, db: Session = Depends(get_db)):
    # 1. Tìm bản ghi trong Database
    db_utility = db.query(UtilityReading).filter(UtilityReading.id == utility_id).first()
    
    if not db_utility:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi điện nước")

    # 2. Cập nhật các trường dữ liệu
    db_utility.electric_old = payload.electric_old
    db_utility.electric_new = payload.electric_new
    db_utility.water_old = payload.water_old
    db_utility.water_new = payload.water_new
    # Có thể bỏ qua billing_month và room_id vì chúng không thay đổi
    
    # 3. Lưu vào Database
    db.commit()
    db.refresh(db_utility)
    
    return db_utility

@router.delete("/{reading_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_utility_reading(reading_id: int, db: Session = Depends(get_db)):
    reading = (
        db.query(UtilityReading).filter(UtilityReading.id == reading_id).first()
    )
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy record có id={reading_id}"
        )
    
    try: 
        db.delete(reading)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể xóa vì đã có bill được tạo từ số liệu này"
        )
    return None