from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import require_owner
from app.core.database import get_db
from app.models.user import User
from app.models.contract import Contract
from app.models.room import Room
from app.models.tenant import Tenant
from app.schemas.contract_schema import ContractCreate, ContractUpdate, ContractResponse


router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.post("", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)):
    """Tạo hợp đồng mới
    3 bước validate nghiệp vụ phải làm trước khi insert:
    1. room_id tồn tại
    2. tenant_id tồn tại
    3. room đó chưa có hợp đồng active nào khác
    Sau khi tạo thành công, đồng bộ room.status -> 'occupied'."""

    room = db.query(Room).filter(Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy phòng có id={payload.room_id}"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == payload.tenant_id).first()
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy khách thuê có id={payload.tenant_id}"
        )
    

    existing_active = (
        db.query(Contract)
        .filter(Contract.room_id == payload.room_id, Contract.status == "active")
        .first()
    )
    if existing_active is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Phòng id={payload.room_id} đang có hợp đồng active "
                f"(id={existing_active.id}). Phải kết thúc hợp đồng cũ "
                "trước khi tạo hợp đồng mới cho phòng này."
            )
        )
    
    new_contract = Contract(**payload.model_dump(), status="active")
    db.add(new_contract)


    # Đồng bộ trạng thái phòng - tránh chủ trọ quên đổi status tay
    room.status = "occupied"

    db.commit()
    db.refresh(new_contract)
    return new_contract


@router.get("", response_model=list[ContractResponse])
def list_contracts(db: Session = Depends(get_db)):
    return db.query(Contract).all()


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng có id={contract_id}"
        )
    return contract


@router.patch("/{contract_id}", response_model=ContractResponse)
def update_contract(contract_id: int, payload: ContractUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng có id={contract_id}"
        )
    
    update_data = payload.model_dump(exclude_unset=True)
    new_status = update_data.get("status")

    for field, value in update_data.items():
        setattr(contract, field, value)

    if new_status in ("ended", "terminated"):
        room = db.query(Room).filter(Room.id == contract.room_id).first()
        room.status = "vacant"


    db.commit()
    db.refresh(contract)
    return contract


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng có id={contract_id}"
        )
    
    from app.models.bill import Bill
    has_bill = db.query(Bill).filter(Bill.contract_id == contract_id).first() is not None
    if has_bill:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Không thể xoá hợp đồng này vì còn bill liên kết (lịch sử)."
        )
    
    db.delete(contract)
    db.commit()
    return None