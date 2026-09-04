from fastapi import APIRouter, Depends, HTTPException,  status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError


from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.tenant import Tenant
from app.models.contract import Contract
from app.models.room import Room
from app.models.user import User
from app.schemas.tenant_schema import TenantCreate, TenantUpdate, TenantResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(payload: TenantCreate, db: Session = Depends(get_db)):
    new_tenant = Tenant(**payload.model_dump())
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant)
    return new_tenant


@router.get("", response_model=list[TenantResponse])
def list_tenants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return []

    return (
        db.query(Tenant)
        .join(Contract)
        .join(Room)
        .filter(Room.house_id.in_(allowed_house_ids))
        .distinct()
        .all()
    )



@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy khách thuê có id={tenant_id}"
        )
    return tenant


@router.patch("/{tenant_id}", response_model=TenantResponse)
def update_tenant(tenant_id: int, payload: TenantUpdate, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy khách thuê có id={tenant_id}"
        )
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Chỉ kiểm tra khi có 'phone' trong payload VÀ số mới KHÁC số hiện tại trong database
    if "phone" in update_data and update_data["phone"] != tenant.phone:
        has_active_contract = (
            db.query(Contract)
            .filter(Contract.tenant_id == tenant_id, Contract.status == "active")
            .first()
            is not None
        )
        if has_active_contract:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Không thể đổi số điện thoại vì khách thuê đang có hợp đồng."
                    "Chỉ đổi số khi khách thuê đã mất quyền truy cập"
                    "số cũ và cần xác nhận đặc biệt."
                )
            )
        
        # Kiểm tra xem số điện thoại mới đã tồn tại ở tenant khác chưa
        existing_phone = (
            db.query(Tenant)
            .filter(Tenant.phone == update_data["phone"], Tenant.id != tenant_id)
            .first()
        )
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Số điện thoại '{update_data['phone']}' đã được sử dụng bởi khách thuê khác."
            )

    for field, value in update_data.items():
        setattr(tenant, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cập nhật thất bại do dữ liệu bị trùng lặp (SĐT hoặc CCCD đã tồn tại)."
        )

    db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy khách thuê có id={tenant_id}"
        )
    
    has_contract = (
        db.query(Contract).filter(Contract.tenant_id == tenant_id).first()
        is not None
    )
    if has_contract: 
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Không thể xoá tenant này vì còn hợp đồng liên kết (lịch sử)."
        )
    
    db.delete(tenant)
    db.commit()
    return None