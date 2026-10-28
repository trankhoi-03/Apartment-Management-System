from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.room import Room
from app.models.tags import Tag
from app.models.user import User
from app.schemas.tag_schema import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/tags", tags=["Tags"])

FEATURE_TYPES = {"furniture", "amenity", "feature"}


class BulkDeleteTagsRequest(BaseModel):
    names: list[str] = Field(min_length=1, max_length=100)


def _owner_house_ids(user: User) -> set[int]:
    return {house.id for house in user.managed_houses}


def _normalize_names(names: list[str]) -> set[str]:
    normalized = {name.strip().casefold() for name in names if isinstance(name, str) and name.strip()}
    if not normalized:
        raise HTTPException(status_code=422, detail="Vui lòng chọn tag hợp lệ.")
    return normalized


def _delete_names(db: Session, owner: User, names: set[str]):
    """Gỡ tag của owner khỏi mọi phòng trong các nhà của owner, rồi xóa danh mục.

    Cả hai thay đổi nằm trong cùng một transaction.
    """
    house_ids = _owner_house_ids(owner)
    rooms_changed = 0
    if house_ids:
        rooms = db.query(Room).filter(Room.house_id.in_(house_ids)).all()
        for room in rooms:
            original = room.feature_and_furniture
            if not isinstance(original, list):
                continue
            updated = [
                name for name in original
                if not (isinstance(name, str) and name.strip().casefold() in names)
            ]
            if len(updated) != len(original):
                room.feature_and_furniture = updated
                flag_modified(room, "feature_and_furniture")
                rooms_changed += 1

    catalog_tags = db.query(Tag).filter(Tag.user_id == owner.id).all()
    deleted_catalog_count = 0
    for tag in catalog_tags:
        if tag.type in FEATURE_TYPES and tag.name.strip().casefold() in names:
            db.delete(tag)
            deleted_catalog_count += 1
    return rooms_changed, deleted_catalog_count


@router.get("/", response_model=List[TagResponse])
def get_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "owner":
        return db.query(Tag).filter(Tag.user_id == current_user.id).all()

    # Staff: chỉ xem tag đang được sử dụng ở các phòng được cấp quyền.
    # Không cho staff đọc toàn bộ kho tag của một owner ở những nhà chưa được cấp.
    house_ids = _owner_house_ids(current_user)
    if not house_ids:
        return []
    permitted_rooms = db.query(Room.feature_and_furniture).filter(Room.house_id.in_(house_ids)).all()
    used_names = {
        item.strip().casefold()
        for (items,) in permitted_rooms
        if isinstance(items, list)
        for item in items
        if isinstance(item, str) and item.strip()
    }
    if not used_names:
        return []
    owner_ids = {
        manager.id
        for house in current_user.managed_houses
        for manager in house.managers
        if manager.role == "owner"
    }
    if not owner_ids:
        return []
    return [
        tag for tag in db.query(Tag).filter(Tag.user_id.in_(owner_ids)).all()
        if tag.type in FEATURE_TYPES and tag.name.strip().casefold() in used_names
    ]


@router.post("/", response_model=TagResponse)
def create_tag(
    tag: TagCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    name = tag.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Tên tag không được để trống.")
    existing = db.query(Tag).filter(
        func.lower(Tag.name) == name.lower(),
        Tag.type == tag.type,
        Tag.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tag này đã tồn tại.")
    db_tag = Tag(name=name, type=tag.type, user_id=current_user.id)
    db.add(db_tag)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tag này đã tồn tại hoặc dữ liệu không hợp lệ.")
    db.refresh(db_tag)
    return db_tag


@router.post("/bulk-delete")
def bulk_delete_tags(
    payload: BulkDeleteTagsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    names = _normalize_names(payload.names)
    try:
        rooms_changed, catalog_deleted = _delete_names(db, current_user, names)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể xóa tag; thay đổi đã được hoàn tác.")
    return {"detail": "Đã xóa tag thành công.", "rooms_updated": rooms_changed, "tags_deleted": catalog_deleted}


@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int,
    tag_update: TagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    db_tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tag hoặc không có quyền sửa.")
    if tag_update.name is not None:
        name = tag_update.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="Tên tag không được để trống.")
        db_tag.name = name
    if tag_update.type is not None:
        db_tag.type = tag_update.type
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Tên tag đã tồn tại hoặc dữ liệu không hợp lệ.")
    db.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}")
def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    db_tag = db.query(Tag).filter(Tag.id == tag_id, Tag.user_id == current_user.id).first()
    if db_tag is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy tag hoặc bạn không có quyền xóa.")
    if db_tag.type not in FEATURE_TYPES:
        raise HTTPException(status_code=400, detail="API chỉ hỗ trợ xóa tag đặc điểm/nội thất.")
    name = db_tag.name
    try:
        rooms_changed, catalog_deleted = _delete_names(db, current_user, {name.strip().casefold()})
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể xóa tag; thay đổi đã được hoàn tác.")
    return {"detail": "Đã xóa tag thành công.", "rooms_updated": rooms_changed, "tags_deleted": catalog_deleted}
