from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.dependencies import get_db 
from app.models.tags import Tag
from app.schemas.tag_schema import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/tags", tags=["Tags"])

@router.get("/", response_model=List[TagResponse])
def get_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).all()
    return tags

@router.post("/", response_model=TagResponse)
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    existing_tag = db.query(Tag).filter(Tag.name == tag.name, Tag.type == tag.type).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag này đã tồn tại.")
        
    db_tag = Tag(name=tag.name, type=tag.type)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: int, tag_update: TagUpdate, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Không tìm thấy tag.")
    
    if tag_update.name is not None:
        db_tag.name = tag_update.name
    if tag_update.type is not None:
        db_tag.type = tag_update.type
        
    db.commit()
    db.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    db_tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not db_tag:
        raise HTTPException(status_code=404, detail="Không tìm thấy tag.")
    
    db.delete(db_tag)
    db.commit()
    return {"detail": "Đã xóa tag thành công."}