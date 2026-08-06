from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.houses import House
from app.schemas.house_schema import HouseCreate, HouseUpdate, HouseResponse

router = APIRouter(prefix="/houses", tags=["houses"])


@router.post("", response_model=HouseResponse, status_code=status.HTTP_201_CREATED)
def create_house(payload: HouseCreate, db: Session = Depends(get_db)):
    house = House(**payload.model_dump())
    db.add(house)
    db.commit()
    db.refresh(house)
    return house


@router.get("", response_model=list[HouseResponse])
def list_houses(db: Session = Depends(get_db)):
    return db.query(House).all()


@router.patch("/{house_id}", response_model=HouseResponse)
def update_house(house_id: int, payload: HouseUpdate, db: Session = Depends(get_db)):
    house = db.query(House).filter(House.id == house_id).first()
    if house is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy nhà id={house_id}")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(house, field, value)
    db.commit()
    db.refresh(house)
    return house


@router.delete("/{house_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_house(house_id: int, db: Session = Depends(get_db)):
    house = db.query(House).filter(House.id == house_id).first()
    if house is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy nhà id={house_id}")
    from app.models.room import Room
    if db.query(Room).filter(Room.house_id == house_id).first():
        raise HTTPException(status_code=409,
            detail="Không thể xoá nhà trọ này vì còn phòng liên kết.")
    db.delete(house)
    db.commit()
    return None