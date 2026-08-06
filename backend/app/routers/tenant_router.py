from fastapi import APIRouter, Depends, HTTPException,  status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.tenant import Tenant
from app.models.contract import Contract
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
def list_tenants(db: Session = Depends(get_db)):
    return db.query(Tenant).all()



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
    if "phone" in update_data:
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
                    "Không thể đổi số điện thoại vì tenant đang có hợp đồng "
                    "active. Chỉ đổi số khi tenant đã mất quyền truy cập "
                    "số cũ và cần xác nhận đặc biệt."
                )
            )

    for field, value in update_data.items():
        setattr(tenant, field, value)

    db.commit()
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