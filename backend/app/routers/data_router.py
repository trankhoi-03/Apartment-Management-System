import io
import pandas as pd
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.models.room import Room
from app.models.contract import Contract
from app.models.houses import House

router = APIRouter(prefix="/data", tags=["data"])

@router.get("/export")
def export_excel(db: Session = Depends(get_db)):    
    rooms = db.query(Room).all()
    contracts = db.query(Contract).all()
    
    # 1. Dữ liệu Sheet "Phòng"
    room_status_map = {
        "vacant": "Trống",
        "occupied": "Đang thuê",
    }

    room_data = []
    for r in rooms:
        room_data.append({
            "Tên nhà": r.house.name if r.house else "Không xác định",
            "Số Phòng": r.room_number,
            "Diện tích (m2)": r.area_sqm,
            "Giá thuê (VNĐ)": float(r.base_rent) if r.base_rent else 0,
            "Trạng thái (Trống hoặc Đang thuê)": room_status_map.get(r.status, r.status),
            "Đồng hồ nước (Có hoặc Không)": "Có" if r.is_water_meter else "Không",
            "Nội thất": ", ".join(r.furnitures) if r.furnitures else ""
        })
        
    # 2. Dữ liệu Sheet "Hợp đồng"
    contract_status_map = {
        "active": "Đang thuê",
        "ended": "Đã kết thúc",
        "pending": "Chờ xử lý"
    }
    
    contract_data = []
    for c in contracts:
        contract_data.append({
            "Tên nhà": c.room.house.name if c.room and c.room.house else "Không xác định",
            "Số phòng": c.room.room_number if c.room else "Không xác định",
            "Khách thuê": c.tenant.full_name if c.tenant else "Không xác định",
            "Ngày bắt đầu": c.start_date.strftime("%d/%m/%Y") if c.start_date else None,
            "Ngày kết thúc": c.end_date.strftime("%d/%m/%Y") if c.end_date else None,
            "Tiền thuê": float(c.monthly_rent) if c.monthly_rent else 0,
            "Tiền cọc": float(c.deposit) if c.deposit else 0,
            "Số người": c.num_tenants,
            "Số xe": c.num_vehicles,            
            "Trạng thái (Đang thuê hoặc Đã kết thúc)": contract_status_map.get(c.status, c.status),
            "Ghi chú": c.notes
        })

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(room_data).to_excel(writer, sheet_name="Phòng", index=False)
        pd.DataFrame(contract_data).to_excel(writer, sheet_name="Hợp đồng", index=False)
    
    output.seek(0)
    
    file_name = f"Dữ liệu Phòng Trọ_{datetime.now().strftime('%d%m%Y')}.xlsx"
    encoded_file_name = quote(file_name)
    headers = {
        "Content-Disposition": f"attachment; filename*=utf-8''{encoded_file_name}"
    }
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )


@router.post("/import")
async def import_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng file Excel (.xlsx, .xls)")
        
    contents = await file.read()
    
    try:
        excel_data = pd.read_excel(io.BytesIO(contents), sheet_name=None)
    except Exception as e:
        raise HTTPException(status_code=400, detail="File Excel bị lỗi hoặc không đúng định dạng.")

    sheet_name = None
    if "Phòng" in excel_data:
        sheet_name = "Phòng"
    else:
        sheet_name = list(excel_data.keys())[0]

    df_rooms = excel_data[sheet_name]
    df_rooms = df_rooms.where(pd.notnull(df_rooms), None)
    
    status_reverse_map = {
        "trống": "vacant",
        "đang thuê": "occupied",
        "ngừng thuê": "inactive"
    }
    
    for _, row in df_rooms.iterrows():
        house_name = str(row.get("Tên nhà")).strip() if row.get("Tên nhà") else None
        room_number = str(row.get("Số Phòng")).strip() if row.get("Số Phòng") else None
        
        if not house_name or not room_number:
            continue 
            
        house = db.query(House).filter(House.name == house_name).first()
        if not house:
            house = House(name=house_name)
            db.add(house)
            db.commit() 
            db.refresh(house)
            
        furnitures_str = row.get("Nội thất")
        furnitures_arr = [f.strip() for f in str(furnitures_str).split(",")] if furnitures_str else []
        
        
        raw_water = row.get("Đồng hồ nước (Có hoặc Không)")
        if raw_water is None:
            raw_water = row.get("Đồng hồ nước")
            
        is_water = True if str(raw_water).strip().lower() == "có" else False

        raw_status = row.get("Trạng thái (Trống hoặc Đang thuê)")
        if raw_status is None:
            raw_status = row.get("Trạng thái")
            
        db_status = status_reverse_map.get(str(raw_status).strip().lower() if raw_status else "", "vacant")

        existing_room = db.query(Room).filter(
            Room.house_id == house.id, 
            Room.room_number == room_number
        ).first()

        if existing_room:
            existing_room.area_sqm = row.get("Diện tích (m2)")
            existing_room.base_rent = row.get("Giá thuê (VNĐ)")
            if raw_status:
                existing_room.status = db_status
            existing_room.is_water_meter = is_water
            existing_room.furnitures = furnitures_arr
        else:
            new_room = Room(
                house_id=house.id,
                room_number=room_number,
                area_sqm=row.get("Diện tích (m2)"),
                base_rent=row.get("Giá thuê (VNĐ)"),
                status=db_status,
                is_water_meter=is_water,
                furnitures=furnitures_arr
            )
            db.add(new_room)
            
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Có lỗi xảy ra khi lưu vào cơ sở dữ liệu.")

    return {"detail": "Import dữ liệu thành công!"}


@router.get("/template")
def download_template():    
    room_columns = [
        "Tên nhà", "Số Phòng", "Diện tích (m2)", 
        "Giá thuê (VNĐ)", "Trạng thái (Trống hoặc Đang thuê)", "Đồng hồ nước (Có hoặc Không)", "Nội thất"
    ]
    
    contract_columns = [
        "Tên nhà", "Số phòng", "Khách thuê", 
        "Ngày bắt đầu", "Ngày kết thúc", "Tiền thuê", 
        "Tiền cọc", "Số người", "Số xe", "Trạng thái (Đang thuê hoặc Đã kết thúc)", "Ghi chú"
    ]

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(columns=room_columns).to_excel(writer, sheet_name="Phòng", index=False)
        pd.DataFrame(columns=contract_columns).to_excel(writer, sheet_name="Hợp đồng", index=False)
    
    output.seek(0)
    
    file_name = "Mẫu Nhập Liệu Phòng Trọ.xlsx"
    encoded_file_name = quote(file_name)
    headers = {
        "Content-Disposition": f"attachment; filename*=utf-8''{encoded_file_name}"
    }
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )