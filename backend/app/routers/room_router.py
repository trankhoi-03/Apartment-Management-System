from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import require_owner, get_current_user, verify_house_access
from app.models.user import User
from app.models.room import Room
from app.models.contract import Contract
from app.models.incident import Incident
from app.models.bill import Bill
from app.models.utility_rate import UtilityRate
from app.models.utility_reading import UtilityReading
from app.models.houses import House
from app.schemas.room_schema import RoomCreate, RoomUpdate, RoomResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner)
):
    # 0. Xác thực người dùng có quyền quản lý nhà trọ này không
    verify_house_access(house_id=payload.house_id, db=db, current_user=current_user)

    # 1. Lấy danh sách ID các nhà trọ mà user hiện tại quản lý
    user_house_ids = [h.id for h in current_user.managed_houses]

    # Đếm CHỈ các phòng thuộc nhà của user hiện tại
    if user_house_ids:
        total_rooms = db.query(func.count(Room.id)).filter(Room.house_id.in_(user_house_ids)).scalar() or 0
    else:
        total_rooms = 0
    
    # is_premium = (
    #     current_user.subscription_plan != "free"
    #     and current_user.subscription_expires_at is not None
    #     and current_user.subscription_expires_at > datetime.utcnow()
    # )

    # if not is_premium and total_rooms >= current_user.max_rooms:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail=f"Gói miễn phí giới hạn tối đa {current_user.max_rooms} phòng. Bạn đã tạo {total_rooms}/{current_user.max_rooms} phòng. Vui lòng nâng cấp lên Premium để tạo thêm phòng mới."
    #     )

    # 2. Kiểm tra trùng số phòng trong cùng một nhà
    existing_room = db.query(Room).filter(
        Room.room_number == payload.room_number,
        Room.house_id == payload.house_id
    ).first()
    
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Số phòng '{payload.room_number}' đã tồn tại trong nhà trọ này.",
        )

    # 3. Tiến hành tạo phòng
    new_room = Room(**payload.model_dump(), status="vacant")
    db.add(new_room)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Số phòng '{payload.room_number}' đã tồn tại trong nhà trọ này.",
        )
    db.refresh(new_room)
    return new_room


@router.get("", response_model=list[RoomResponse])
def list_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Thêm current_user
):
    # Lấy danh sách ID nhà trọ mà tài khoản này quản lý
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    
    if not allowed_house_ids:
        return []
        
    # Chỉ lấy các phòng thuộc các nhà trọ được phép
    return db.query(Room).filter(Room.house_id.in_(allowed_house_ids)).all()


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

    # Kiểm tra hợp đồng đang active
    active_contract = db.query(Contract).filter(
        Contract.room_id == room_id,
        Contract.status == "active"
    ).first()

    if active_contract is not None or room.status == "occupied":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể xoá phòng này vì đang có người thuê (hợp đồng đang có hiệu lực).",
        )

    try:
        try:
            db.query(UtilityRate).filter(UtilityRate.room_id == room_id).delete()
        except (ImportError, AttributeError):
            pass

        try:
            db.query(UtilityReading).filter(UtilityReading.room_id == room_id).delete()
        except (ImportError, AttributeError):
            pass

        old_contracts = db.query(Contract).filter(Contract.room_id == room_id).all()
        for contract in old_contracts:
            contract.room_id = None

        try:
            incidents = db.query(Incident).filter(Incident.room_id == room_id).all()
            for inc in incidents:
                inc.room_id = None
        except (ImportError, AttributeError):
            pass

        try:
            if hasattr(Bill, "room_id"):
                bills = db.query(Bill).filter(Bill.room_id == room_id).all()
                for bill in bills:
                    bill.room_id = None
        except (ImportError, AttributeError):
            pass

        db.delete(room)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Không thể xoá phòng do ràng buộc dữ liệu: {str(e.orig)}",
        )
    return None