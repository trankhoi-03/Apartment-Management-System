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
from app.routers.report_router import get_house_financial_report, get_all_houses_financial_report

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


@router.get("/export-finance")
def export_financial_excel(month: str, house_id: str = "all", db: Session = Depends(get_db)):
    try:
        if house_id == "all":
            report_data = get_all_houses_financial_report(month=month, db=db)
        else:
            report_data = get_house_financial_report(house_id=int(house_id), month=month, db=db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    def _g(obj, key, default=""):
        if isinstance(obj, dict): return obj.get(key, default)
        return getattr(obj, key, default)

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        
        # 1. Sheet Tổng quan
        summary_data = [
            # {"Chỉ tiêu": "Khu vực", "Giá trị": report_data.house_name},
            {"Chỉ tiêu": "Tháng", "Giá trị": month},
            {"Chỉ tiêu": "Tổng doanh thu (VNĐ)", "Giá trị": float(report_data.total_revenue)},
            {"Chỉ tiêu": "Tổng chi phí (VNĐ)", "Giá trị": float(report_data.total_cost)},
            {"Chỉ tiêu": "Lợi nhuận ròng (VNĐ)", "Giá trị": float(report_data.net_profit)},
        ]
        pd.DataFrame(summary_data, columns=["Chỉ tiêu", "Giá trị"]).to_excel(writer, sheet_name="Tổng quan", index=False, header=False)

        # 2. Sheet Tiền thuê nhà
        rent_data = [{"Phòng": _g(d, "room_name"), "Số tiền (VNĐ)": _g(d, "revenue")} for d in report_data.rent_tab.details]
        pd.DataFrame(rent_data, columns=["Phòng", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Tiền thuê nhà", index=False)

        # 3. Sheet Phí dịch vụ & Phát sinh
        other_rev_data = [{"Phòng": _g(d, "room_name"), "Hạng mục": _g(d, "item"), "Số tiền (VNĐ)": _g(d, "amount")} for d in report_data.other_revenue_tab.details]
        pd.DataFrame(other_rev_data, columns=["Phòng", "Hạng mục", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Dịch vụ & Phát sinh", index=False)

        # 4. Sheet Điện & Nước
        util_data = [{"Phòng": _g(d, "room_name"), "Tiền điện (VNĐ)": _g(d, "electric_cost"), "Tiền nước (VNĐ)": _g(d, "water_cost")} for d in report_data.utilities_tab.details]
        pd.DataFrame(util_data, columns=["Phòng", "Tiền điện (VNĐ)", "Tiền nước (VNĐ)"]).to_excel(writer, sheet_name="Điện & Nước", index=False)

        # 5. Sheet Sửa chữa & Bảo trì
        maint_data = [{"Phòng": _g(d, "room_name"), "Nội dung": _g(d, "description"), "Bên xử lý": _g(d, "handler_info") or "—", "Chi phí (VNĐ)": _g(d, "amount")} for d in report_data.maintenance_tab.details]
        pd.DataFrame(maint_data, columns=["Phòng", "Nội dung", "Bên xử lý", "Chi phí (VNĐ)"]).to_excel(writer, sheet_name="Sửa chữa & Bảo trì", index=False)

        # 6. Sheet Nhân viên quản lý
        mgr_data = [{"Hạng mục": _g(d, "item"), "Số tiền (VNĐ)": _g(d, "amount")} for d in report_data.management_tab.details]
        pd.DataFrame(mgr_data, columns=["Hạng mục", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Nhân viên", index=False)

        # 7. Sheet Giá Cost
        cost_data = [{"Phòng": _g(d, "room_name"), "Số tiền (VNĐ)": _g(d, "amount")} for d in report_data.base_cost_tab.details]
        pd.DataFrame(cost_data, columns=["Phòng", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Giá Cost", index=False)

        # 8. Sheet Chi phí khác
        other_cost_data = [{"Nội dung chi": _g(d, "item"), "Số tiền (VNĐ)": _g(d, "amount")} for d in report_data.other_costs_tab.details]
        pd.DataFrame(other_cost_data, columns=["Nội dung chi", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Chi phí khác", index=False)

        # Căn chỉnh độ rộng cột tự động cho tất cả các sheet
        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            worksheet.column_dimensions['A'].width = 30
            worksheet.column_dimensions['B'].width = 25
            worksheet.column_dimensions['C'].width = 20
            worksheet.column_dimensions['D'].width = 20
    
    output.seek(0)
    
    safe_house_name = report_data.house_name.replace(' ', '_')
    file_name = f"Baó Cáo Tài Chính {safe_house_name} {month}.xlsx"
    encoded_file_name = quote(file_name)
    headers = {
        "Content-Disposition": f"attachment; filename*=utf-8''{encoded_file_name}"
    }
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )