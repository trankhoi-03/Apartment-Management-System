from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from app.core.dependencies import get_db, get_current_user 
from app.models.tags import Tag
from app.models.user import User 
from app.schemas.tag_schema import TagCreate, TagUpdate, TagResponse

router = APIRouter(prefix="/tags", tags=["Tags"])

@router.get("/", response_model=List[TagResponse])
def get_tags(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    # Chỉ lấy các tag thuộc về current_user
    tags = db.query(Tag).filter(Tag.user_id == current_user.id).all()
    return tags

@router.post("/", response_model=TagResponse)
def create_tag(
    tag: TagCreate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    existing_tag = db.query(Tag).filter(
        func.lower(Tag.name) == tag.name.strip().lower(), 
        Tag.type == tag.type,
        Tag.user_id == current_user.id
    ).first()
    
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag này đã tồn tại.")
        
    db_tag = Tag(name=tag.name.strip(), type=tag.type, user_id=current_user.id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(
    tag_id: int, 
    tag_update: TagUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Require user
):
    # Tìm tag dựa trên tag_id VÀ user_id để tránh user này sửa tag của user khác
    db_tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    ).first()
    
    if not db_tag:
        raise HTTPException(status_code=404, detail="Không tìm thấy tag hoặc bạn không có quyền sửa.")
    
    if tag_update.name is not None:
        db_tag.name = tag_update.name
    if tag_update.type is not None:
        db_tag.type = tag_update.type
        
    db.commit()
    db.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}")
def delete_tag(
    tag_id: int, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Require user
):
    # Tìm tag dựa trên tag_id VÀ user_id để tránh user này xoá tag của user khác
    db_tag = db.query(Tag).filter(
        Tag.id == tag_id,
        Tag.user_id == current_user.id
    ).first()
    
    if not db_tag:
        raise HTTPException(status_code=404, detail="Không tìm thấy tag hoặc bạn không có quyền xoá.")
    
    db.delete(db_tag)
    db.commit()
    return {"detail": "Đã xóa tag thành công."}