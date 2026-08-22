from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from app.core.database import get_db
from app.models.houses import House
from app.models.user import User
from app.core.dependencies import get_current_user, require_owner

router = APIRouter(prefix="/staffs", tags=["staffs"])

class StaffAssignRequest(BaseModel):
    phone: str
    house_id: int

class HouseMinimal(BaseModel):
    id: int
    name: str

class StaffResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    managed_houses: List[HouseMinimal] = []

@router.post("")
def assign_staff_to_house(
    payload: StaffAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner) 
):
    house = db.query(House).filter(House.id == payload.house_id).first()
    if not house or current_user not in house.managers:
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản lý nhà trọ này.")
        
    staff = db.query(User).filter(User.phone == payload.phone).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Hãy đăng ký tài khoản cho nhân viên ở trang Đăng ký trước.")
        
    if staff in house.managers:
        raise HTTPException(status_code=409, detail="Nhân viên này đã quản lý nhà trọ này rồi.")
        
    house.managers.append(staff)
    db.commit()
    
    return {"message": f"Đã cấp quyền thành công cho {staff.full_name}"}

@router.get("", response_model=List[StaffResponse])
def list_staffs_of_owner(db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    """Trả về danh sách các nhân viên đang quản lý nhà trọ của Chủ trọ này"""
    staff_responses = []
    seen_ids = set()
    
    # Lấy danh sách ID các nhà trọ mà owner đang sở hữu để so sánh nhanh
    owner_house_ids = {h.id for h in current_user.managed_houses}
    
    for house in current_user.managed_houses:
        for manager in house.managers:
            # Lọc các User có role là staff
            if getattr(manager, "role", "staff") == "staff" and manager.id not in seen_ids:
                
                # Lọc danh sách nhà trọ (Bỏ qua gán trực tiếp, tạo data dict thuần tuý)
                filtered_houses = [
                    {"id": h.id, "name": h.name} 
                    for h in manager.managed_houses if h.id in owner_house_ids
                ]
                
                # Ép kiểu dữ liệu qua Pydantic Model để đảm bảo an toàn 100%
                staff_data = StaffResponse(
                    id=manager.id,
                    full_name=manager.full_name,
                    phone=manager.phone,
                    managed_houses=filtered_houses
                )
                
                staff_responses.append(staff_data)
                seen_ids.add(manager.id)
                
    return staff_responses

@router.delete("/{staff_id}/houses/{house_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_staff_from_house(
    staff_id: int,
    house_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_owner)
):
    """Thu hồi quyền quản lý 1 nhà trọ của nhân viên"""
    house = db.query(House).filter(House.id == house_id).first()
    if not house or current_user not in house.managers:
        raise HTTPException(status_code=403, detail="Không có quyền.")
        
    staff = db.query(User).filter(User.id == staff_id).first()
    if staff in house.managers:
        house.managers.remove(staff)
        db.commit()
    return None