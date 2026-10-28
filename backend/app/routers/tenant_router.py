from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import exists
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_owner
from app.models.tenant import Tenant
from app.models.contract import Contract
from app.models.room import Room
from app.models.user import User
from app.models.co_tenant import CoTenant
from app.schemas.tenant_schema import TenantCreate, TenantUpdate, TenantResponse
from app.core.security import encrypt_cccd, decrypt_cccd

router = APIRouter(prefix="/tenants", tags=["tenants"])


class CCCDSearchRequest(BaseModel):
    cccd: str


def _owner_tenant(db: Session, tenant_id: int, current_user: User) -> Tenant:
    """Only the owning account can mutate this tenant. NULL owner fails closed."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách thuê.")
    if tenant.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản lý khách thuê này.")
    return tenant


def _staff_visible_tenant(db: Session, tenant_id: int, current_user: User) -> bool:
    """A staff account may read only tenants contracted in their assigned houses."""
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return False
    return (
        db.query(Contract.id)
        .join(Room, Contract.room_id == Room.id)
        .filter(Contract.tenant_id == tenant_id, Room.house_id.in_(allowed_house_ids))
        .first()
        is not None
    )


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    new_tenant = Tenant(
        full_name=payload.full_name,
        phone=payload.phone,
        email=payload.email,
        owner_id=current_user.id,  # Never trust owner_id from client data.
        id_card_number=encrypt_cccd(payload.id_card_number) if payload.id_card_number else None,
    )
    db.add(new_tenant)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Không thể tạo khách thuê do dữ liệu trùng lặp.")
    db.refresh(new_tenant)
    return new_tenant


@router.get("", response_model=list[TenantResponse])
def list_tenants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "owner":
        return db.query(Tenant).filter(Tenant.owner_id == current_user.id).all()

    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return []
    return (
        db.query(Tenant)
        .join(Contract, Contract.tenant_id == Tenant.id)
        .join(Room, Contract.room_id == Room.id)
        .filter(Room.house_id.in_(allowed_house_ids), Tenant.owner_id.isnot(None))
        .distinct()
        .all()
    )


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy khách thuê.")
    if current_user.role == "owner":
        if tenant.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền xem khách thuê này.")
    elif tenant.owner_id is None or not _staff_visible_tenant(db, tenant.id, current_user):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem khách thuê này.")
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    tenant = _owner_tenant(db, tenant_id, current_user)
    update_data = payload.model_dump(exclude_unset=True)
    force_update = update_data.pop("force_update_phone", False)

    # Keep existing PHONE_UPDATE_CONFIRM_REQUIRED flow for active contracts.
    if "phone" in update_data and update_data["phone"] != tenant.phone:
        if update_data["phone"] is None:
            raise HTTPException(status_code=422, detail="Số điện thoại không được để trống.")
        has_active_contract = (
            db.query(Contract)
            .filter(Contract.tenant_id == tenant_id, Contract.status == "active")
            .first()
            is not None
        )
        if has_active_contract and not force_update:
            raise HTTPException(status_code=409, detail="PHONE_UPDATE_CONFIRM_REQUIRED")

        # A tenant can only be deduplicated within the same owner; cross-owner
        # tenant existence must not leak through error messages.
        existing_phone = (
            db.query(Tenant)
            .filter(
                Tenant.phone == update_data["phone"],
                Tenant.id != tenant_id,
                Tenant.owner_id == current_user.id,
            )
            .first()
        )
        if existing_phone:
            raise HTTPException(status_code=409, detail="Số điện thoại đã được sử dụng bởi khách thuê khác của bạn.")

    if "full_name" in update_data:
        name = update_data["full_name"]
        if name is None or not name.strip():
            raise HTTPException(status_code=422, detail="Họ tên không được để trống.")
        update_data["full_name"] = name.strip()

    # Never put raw CCCD in the model. Empty/omitted preserves existing CCCD.
    cccd = update_data.pop("id_card_number", None)
    if cccd is not None and cccd.strip():
        tenant.id_card_number = encrypt_cccd(cccd.strip())

    # Prevent setting required fields to NULL; optional email can be cleared.
    for field, value in update_data.items():
        setattr(tenant, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cập nhật thất bại do dữ liệu trùng lặp.")
    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    tenant = _owner_tenant(db, tenant_id, current_user)
    has_contract = db.query(Contract).filter(Contract.tenant_id == tenant_id).first() is not None
    if has_contract:
        raise HTTPException(status_code=409, detail="Không thể xoá tenant này vì còn hợp đồng liên kết (lịch sử).")
    db.delete(tenant)
    db.commit()
    return None


@router.post("/search/by-cccd", response_model=TenantResponse)
def search_tenant_by_cccd(
    payload: CCCDSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    cccd_query = payload.cccd.strip()
    if not cccd_query:
        raise HTTPException(status_code=422, detail="Vui lòng nhập CCCD.")

    # Main tenants owned by this owner, including those without contracts.
    tenants = db.query(Tenant).filter(Tenant.owner_id == current_user.id).all()
    for t in tenants:
        if t.id_card_number:
            try:
                if decrypt_cccd(t.id_card_number) == cccd_query:
                    return t
            except Exception:
                continue

    # Co-tenants can be reached only through contracts of main tenants owned
    # by this user; do not expose another owner's related record.
    co_tenants = (
        db.query(CoTenant)
        .join(Contract, CoTenant.contract_id == Contract.id)
        .join(Tenant, Contract.tenant_id == Tenant.id)
        .filter(Tenant.owner_id == current_user.id)
        .all()
    )
    for ct in co_tenants:
        if ct.id_card_number:
            try:
                if decrypt_cccd(ct.id_card_number) == cccd_query:
                    main_tenant = db.query(Tenant).filter(
                        Tenant.id == ct.contract.tenant_id,
                        Tenant.owner_id == current_user.id,
                    ).first()
                    if main_tenant:
                        result_dict = main_tenant.__dict__.copy()
                        result_dict["matched_name"] = ct.full_name
                        return result_dict
            except Exception:
                continue
    raise HTTPException(status_code=404, detail="Không tìm thấy.")


# /tenants/emergency-clear-cccd intentionally NOT registered.
# A platform-wide emergency purge must use a separate audited operator action,
# never a user/staff/owner JWT endpoint.
