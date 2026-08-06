from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.dependencies import require_owner
from app.models.user import User
from app.models.room import Room
from app.schemas.room_schema import RoomCreate, RoomUpdate, RoomResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    # 1. Kiểm tra trùng lặp theo nhà trọ
    existing_room = db.query(Room).filter(
        Room.room_number == payload.room_number,
        Room.house_id == payload.house_id
    ).first()
    
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Số phòng '{payload.room_number}' đã tồn tại trong nhà trọ này.",
        )

    # 2. Tiến hành tạo phòng
    new_room = Room(**payload.model_dump(), status="vacant")
    db.add(new_room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Fallback an toàn nếu database quăng lỗi IntegrityError (UniqueConstraint)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Số phòng '{payload.room_number}' đã tồn tại trong nhà trọ này.",
        )
    db.refresh(new_room)
    return new_room


@router.get("", response_model=list[RoomResponse])
def list_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={room_id}",
        )
    return room


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={room_id}",
        )

    # Kiểm tra trùng lặp nếu có đổi số phòng
    if payload.room_number is not None and payload.room_number != room.room_number:
        existing_room = db.query(Room).filter(
            Room.room_number == payload.room_number,
            Room.house_id == room.house_id  
        ).first()
        
        if existing_room:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Số phòng '{payload.room_number}' đã tồn tại trong nhà trọ này.",
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(room, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cập nhật thất bại do lỗi dữ liệu (có thể trùng số phòng).",
        )
        
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(room_id: int, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={room_id}",
        )

    try:
        db.delete(room)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể xoá phòng này vì còn hợp đồng liên kết. "
                   "Hãy đổi status phòng thành 'inactive' thay vì xoá.",
        )
    return None