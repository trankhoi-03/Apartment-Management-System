from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func

from app.core.database import get_db
from app.core.dependencies import require_owner, get_current_user, verify_house_access, verify_house_owner
from app.models.user import User
from app.models.room import Room
from app.models.contract import Contract
from app.models.incident import Incident
from app.models.bill import Bill
from app.models.utility_rate import UtilityRate
from app.models.utility_reading import UtilityReading
from app.models.houses import House
from app.models.tags import Tag
from app.schemas.room_schema import RoomCreate, RoomUpdate, RoomResponse

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    payload: RoomCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner)
):
    verify_house_owner(house_id=payload.house_id, db=db, current_user=current_user)

    user_house_ids = [h.id for h in current_user.managed_houses]

    if user_house_ids:
        total_rooms = db.query(func.count(Room.id)).filter(Room.house_id.in_(user_house_ids)).scalar() or 0
    else:
        total_rooms = 0

    
    if payload.feature_and_furniture:
        for f_name in dict.fromkeys(payload.feature_and_furniture):
            tag_name = f_name.strip()
            if not tag_name:
                continue
            
            existing = db.query(Tag).filter(
                func.lower(Tag.name) == tag_name.lower(),
                Tag.user_id == current_user.id
            ).first()
            
            if not existing:
                new_tag = Tag(name=tag_name, type="amenity", user_id=current_user.id)
                db.add(new_tag)
        # Tag và phòng được commit chung một transaction.
    
    # is_premium = (
    #     current_user.subscription_plan != "free"
    #     and current_user.subscription_expires_at is not None
    #     and current_user.subscription_expires_at > datetime.utcnow()
    # )

    # if not is_premium and total_rooms >= current_user.max_rooms:
    #     raise HTTPException(...)

    existing_room = db.query(Room).filter(
        Room.room_number == payload.room_number,
        Room.house_id == payload.house_id
    ).first()
    
    if existing_room:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Số phòng '{payload.room_number}' đã tồn tại trong nhà trọ này.",
        )

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
def get_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={room_id}",
        )
    verify_house_access(house_id=room.house_id, db=db, current_user=current_user)
    return room


@router.patch("/{room_id}", response_model=RoomResponse)
def update_room(
    room_id: int, 
    payload: RoomUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner)
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={room_id}",
        )

    # Cần được cấp quyền trên nhà trọ hiện tại trước khi thay đổi phòng.
    verify_house_owner(house_id=room.house_id, db=db, current_user=current_user)

    update_data = payload.model_dump(exclude_unset=True)
    target_house_id = update_data.get("house_id", room.house_id)
    if target_house_id is None:
        raise HTTPException(status_code=422, detail="Nhà trọ của phòng không được để trống.")

    # Nếu chuyển phòng qua nhà khác, owner phải có quyền ở cả hai nhà.
    verify_house_owner(house_id=target_house_id, db=db, current_user=current_user)

    new_room_number = update_data.get("room_number", room.room_number)
    if (new_room_number != room.room_number or target_house_id != room.house_id):
        existing_room = db.query(Room).filter(
            Room.room_number == new_room_number,
            Room.house_id == target_house_id,
            Room.id != room.id,
        ).first()
        if existing_room:
            raise HTTPException(
                status_code=409,
                detail=f"Số phòng '{new_room_number}' đã tồn tại trong nhà trọ này.",
            )

    if update_data.get("feature_and_furniture"):
        for f_name in dict.fromkeys(update_data["feature_and_furniture"]):
            tag_name = f_name.strip()
            if not tag_name:
                continue
            existing = db.query(Tag).filter(
                func.lower(Tag.name) == tag_name.lower(),
                Tag.user_id == current_user.id,
            ).first()
            if not existing:
                db.add(Tag(name=tag_name, type="amenity", user_id=current_user.id))

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
def delete_room(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={room_id}",
        )

    verify_house_owner(house_id=room.house_id, db=db, current_user=current_user)

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



@router.post("/sync-legacy-tags", status_code=status.HTTP_200_OK)
def sync_legacy_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Đồng bộ tag cũ chỉ từ các nhà mà owner hiện tại quản lý.

    Không quét phòng của các tài khoản khác; tạo Tag có user_id cụ thể.
    Chỉ nên gọi khi thực sự cần đồng bộ dữ liệu cũ.
    """
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return {"message": "Không có nhà trọ để đồng bộ.", "tags": []}

    # Đồng bộ là thao tác ghi: từ chối nếu có nhà không thuộc duy nhất owner hiện tại.
    for house_id in allowed_house_ids:
        verify_house_owner(house_id=house_id, db=db, current_user=current_user)

    rooms = db.query(Room).filter(Room.house_id.in_(allowed_house_ids)).all()
    existing_tags = db.query(Tag).filter(Tag.user_id == current_user.id).all()
    known_names = {tag.name.strip().casefold() for tag in existing_tags}
    added_tags = []

    for room in rooms:
        for f_name in (room.feature_and_furniture or []):
            if not isinstance(f_name, str):
                continue
            tag_name = f_name.strip()
            if not tag_name or tag_name.casefold() in known_names:
                continue
            db.add(Tag(name=tag_name, type="furniture", user_id=current_user.id))
            known_names.add(tag_name.casefold())
            added_tags.append(tag_name)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Không thể đồng bộ do xung đột dữ liệu tag.")

    return {
        "message": f"Đã đồng bộ thành công {len(added_tags)} tag mới từ dữ liệu cũ.",
        "tags": added_tags,
    }
