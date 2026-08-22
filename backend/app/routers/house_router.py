from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.houses import House
from app.models.user import User
from app.schemas.house_schema import HouseCreate, HouseUpdate, HouseResponse
from app.core.dependencies import get_current_user, verify_house_access

router = APIRouter(prefix="/houses", tags=["houses"])

@router.post("", response_model=HouseResponse, status_code=status.HTTP_201_CREATED)
def create_house(
    payload: HouseCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    house = House(**payload.model_dump())
    house.managers.append(current_user) 
    
    db.add(house)
    db.commit()
    db.refresh(house)
    return house

@router.get("", response_model=list[HouseResponse])
def list_houses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    # Chỉ trả về những nhà trọ mà user này có quyền truy cập
    return current_user.managed_houses

@router.patch("/{house_id}", response_model=HouseResponse)
def update_house(
    payload: HouseUpdate, 
    db: Session = Depends(get_db),
    house: House = Depends(verify_house_access) 
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(house, field, value)
    db.commit()
    db.refresh(house)
    return house

@router.delete("/{house_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_house(
    db: Session = Depends(get_db),
    house: House = Depends(verify_house_access) 
):
    from app.models.room import Room
    if db.query(Room).filter(Room.house_id == house.id).first():
        raise HTTPException(status_code=409, detail="Không thể xoá nhà trọ này vì còn phòng liên kết.")
    
    db.delete(house)
    db.commit()
    return None