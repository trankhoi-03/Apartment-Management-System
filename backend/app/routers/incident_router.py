from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_owner, get_current_user
from app.models.incident import Incident
from app.models.user import User
from app.models.room import Room
from app.schemas.incident_schema import IncidentCreate, IncidentUpdate, IncidentResponse

router = APIRouter(prefix="/incidents", tags=["incidents"])

@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db)):
    new_incident = Incident(**payload.model_dump())
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)
    return new_incident

@router.get("", response_model=list[IncidentResponse])
def list_incidents(
    room_id: int | None = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return []

    query = db.query(Incident).join(Room).filter(Room.house_id.in_(allowed_house_ids))
    
    if room_id is not None:
        query = query.filter(Incident.room_id == room_id)
        
    return query.order_by(Incident.id.desc()).all()

@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(incident_id: int, payload: IncidentUpdate, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sự cố có id={incident_id}"
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(incident, field, value)

    db.commit()
    db.refresh(incident)
    return incident

@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(incident_id: int, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sự cố có id={incident_id}"
        )
    db.delete(incident)
    db.commit()
    return None