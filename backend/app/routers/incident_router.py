from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_owner, get_current_user, verify_house_owner, verify_house_access
from app.models.incident import Incident
from app.models.user import User
from app.models.room import Room
from app.schemas.incident_schema import IncidentCreate, IncidentUpdate, IncidentResponse

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _verify_incident_room_owner(db: Session, room_id: int | None, current_user: User) -> None:
    """Verify the owner of the house containing an incident's room (fail closed)."""
    if room_id is None:
        raise HTTPException(status_code=409, detail="Sự cố chưa liên kết với phòng; không thể xác minh quyền sở hữu.")
    room = db.query(Room).filter(Room.id == room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng của sự cố.")
    verify_house_owner(house_id=room.house_id, db=db, current_user=current_user)


@router.post("", response_model=IncidentResponse, status_code=status.HTTP_201_CREATED)
def create_incident(
    payload: IncidentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Staff may report incidents only in assigned houses; owners only in their own houses.
    room = db.query(Room).filter(Room.id == payload.room_id).first()
    if room is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng để báo cáo sự cố.")
    if current_user.role == "owner":
        verify_house_owner(house_id=room.house_id, db=db, current_user=current_user)
    elif current_user.role == "staff":
        verify_house_access(house_id=room.house_id, db=db, current_user=current_user)
    else:
        raise HTTPException(status_code=403, detail="Bạn không có quyền báo cáo sự cố.")
    new_incident = Incident(**payload.model_dump())
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)
    return new_incident


@router.get("", response_model=list[IncidentResponse])
def list_incidents(
    room_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return []

    query = db.query(Incident).join(Room).filter(Room.house_id.in_(allowed_house_ids))

    if room_id is not None:
        query = query.filter(Incident.room_id == room_id)

    return query.order_by(Incident.id.desc()).all()


@router.patch("/{incident_id}", response_model=IncidentResponse)
def update_incident(
    incident_id: int,
    payload: IncidentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sự cố có id={incident_id}"
        )

    # Check current house before any updates.
    _verify_incident_room_owner(db, incident.room_id, current_user)
    update_data = payload.model_dump(exclude_unset=True)
    # If moving the incident to a different room, check the destination house too.
    if "room_id" in update_data and update_data["room_id"] != incident.room_id:
        _verify_incident_room_owner(db, update_data["room_id"], current_user)

    for field, value in update_data.items():
        setattr(incident, field, value)

    db.commit()
    db.refresh(incident)
    return incident


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_incident(
    incident_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if incident is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy sự cố có id={incident_id}"
        )
    _verify_incident_room_owner(db, incident.room_id, current_user)
    db.delete(incident)
    db.commit()
    return None
