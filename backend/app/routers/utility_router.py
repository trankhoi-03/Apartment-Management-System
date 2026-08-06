from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.room import Room
from app.models.utility_reading import UtilityReading
from app.schemas.utility_schema import UtilityReadingCreate, UtilityReadingResponse


router = APIRouter(prefix="/utility", tags=["utility"])

@router.post("", response_model=UtilityReadingResponse, status_code=status.HTTP_201_CREATED)
def create_utility(payload: UtilityReadingCreate, db: Session = Depends(get_db)):
    """Tạo record số điện/nước cho 1 phòng, 1 tháng
    3 bước validate:
    1. room_id tồn tại
    2. (room_id, billing_month) chưa tồn tại - bắt qua IntegrityError
    3. electric_old/water_old nên khớp với số *_new của tháng liền trước
       (cảnh báo bằng exception rõ ràng, không phải lỗi 'cứng' của DB)"""
    room = db.query(Room).filter(Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={payload.room_id}"
        )
    
    # Tìm record gần nhất TRƯỚC tháng này của cùng phòng, để so sánh nối tiếp
    previous_reading = (
        db.query(UtilityReading)
        .filter(
            UtilityReading.room_id == payload.room_id,
            UtilityReading.billing_month < payload.billing_month
        )
        .order_by(UtilityReading.billing_month.desc())
        .first()
    )

    if previous_reading is not None:
        if payload.electric_old != previous_reading.electric_new:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=( f"electric_old ({payload.electric_old}) không khớp với "
                    f"electric_new của tháng {previous_reading.billing_month} "
                    f"({previous_reading.electric_new}). Kiểm tra lại số đã nhập.")
            )
        if payload.water_old != previous_reading.water_new:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"water_old ({payload.water_old}) không khớp với "
                    f"water_new của tháng {previous_reading.billing_month} "
                    f"({previous_reading.water_new}). Kiểm tra lại số đã nhập.")
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
def update_utility_reading(utility_id: int, payload: UtilityReadingCreate, db: Session = Depends(get_db)):
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
     