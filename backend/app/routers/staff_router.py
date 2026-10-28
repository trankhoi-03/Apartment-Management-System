from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_owner
from app.models.houses import House
from app.models.user import User
from app.schemas.user_schema import VN_PHONE_PATTERN, normalize_phone

router = APIRouter(prefix="/staffs", tags=["staffs"])


class StaffAssignRequest(BaseModel):
    phone: str = Field(pattern=VN_PHONE_PATTERN)
    house_id: int


class HouseMinimal(BaseModel):
    id: int
    name: str
    employee_fee: float | None = None


class StaffResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    managed_houses: List[HouseMinimal] = Field(default_factory=list)


def _owner_ids(house: House) -> set[int]:
    """Owner inferred from existing user_house data (no owner_id column)."""
    return {manager.id for manager in house.managers if manager.role == "owner"}


def _require_owned_house(db: Session, house_id: int, owner: User) -> House:
    house = db.query(House).filter(House.id == house_id).first()
    if house is None or owner.id not in _owner_ids(house):
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản lý nhà trọ này.")
    if _owner_ids(house) != {owner.id}:
        raise HTTPException(status_code=409, detail="Quyền sở hữu nhà trọ không rõ ràng. Cần kiểm tra dữ liệu.")
    return house


def _owner_house_ids(current_user: User) -> set[int]:
    """Only houses for which this user is the unique recorded owner."""
    return {h.id for h in current_user.managed_houses if _owner_ids(h) == {current_user.id}}


def _require_staff(db: Session, staff_id: int) -> User:
    staff = db.query(User).filter(User.id == staff_id).first()
    if staff is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")
    if staff.role != "staff":
        raise HTTPException(status_code=403, detail="Chỉ có thể quản lý quyền của tài khoản nhân viên.")
    return staff


def _check_staff_owner(staff: User, owner: User) -> None:
    """Reject cross-owner or ambiguous existing staff associations."""
    owners = set()
    for house in staff.managed_houses:
        house_owners = _owner_ids(house)
        if len(house_owners) != 1:
            raise HTTPException(status_code=409, detail="Dữ liệu quyền của nhân viên không rõ ràng.")
        owners.update(house_owners)
    if len(owners) > 1:
        raise HTTPException(status_code=409, detail="Nhân viên đang có liên kết giữa nhiều chủ trọ. Cần rà soát.")
    if owners and owners != {owner.id}:
        raise HTTPException(status_code=403, detail="Nhân viên này đang thuộc một chủ trọ khác.")
    # No houses means unassigned; current data model cannot prove who invited staff.


@router.post("")
def assign_staff_to_house(
    payload: StaffAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    house = _require_owned_house(db, payload.house_id, current_user)
    phone = normalize_phone(payload.phone.strip())
    # PostgreSQL row lock serializes competing grants to the same staff account.
    staff = db.query(User).filter(User.phone == phone).with_for_update().first()
    if staff is None:
        raise HTTPException(status_code=404, detail="Hãy đăng ký tài khoản cho nhân viên ở trang Đăng ký trước.")
    if staff.role != "staff":
        raise HTTPException(status_code=403, detail="Chỉ được cấp quyền nhà trọ cho tài khoản có role staff.")
    _check_staff_owner(staff, current_user)
    if staff in house.managers:
        raise HTTPException(status_code=409, detail="Nhân viên này đã quản lý nhà trọ này rồi.")
    house.managers.append(staff)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể cấp quyền nhân viên.")
    return {"message": f"Đã cấp quyền thành công cho {staff.full_name}"}


@router.get("", response_model=List[StaffResponse])
def list_staffs_of_owner(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    owner_house_ids = _owner_house_ids(current_user)
    staff_responses = []
    seen_ids = set()
    for house in current_user.managed_houses:
        if house.id not in owner_house_ids:
            continue
        for manager in house.managers:
            if manager.role != "staff" or manager.id in seen_ids:
                continue
            filtered_houses = [
                {"id": h.id, "name": h.name, "employee_fee": h.employee_fee}
                for h in manager.managed_houses
                if h.id in owner_house_ids
            ]
            staff_responses.append(StaffResponse(
                id=manager.id,
                full_name=manager.full_name,
                phone=manager.phone,
                managed_houses=filtered_houses,
            ))
            seen_ids.add(manager.id)
    return staff_responses


@router.delete("/{staff_id}/houses/{house_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_staff_from_house(
    staff_id: int,
    house_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    house = _require_owned_house(db, house_id, current_user)
    staff = _require_staff(db, staff_id)
    if staff not in house.managers:
        raise HTTPException(status_code=404, detail="Nhân viên không được cấp quyền tại nhà trọ này.")
    house.managers.remove(staff)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể thu hồi quyền.")
    return None


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Revoke only house grants of this owner; do not delete the User."""
    staff = _require_staff(db, staff_id)
    owner_house_ids = _owner_house_ids(current_user)
    shared_houses = [h for h in staff.managed_houses if h.id in owner_house_ids]
    if not shared_houses:
        raise HTTPException(status_code=404, detail="Nhân viên không thuộc nhà trọ nào của bạn.")
    for house in shared_houses:
        house.managers.remove(staff)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể thu hồi quyền nhân viên.")
    return None
