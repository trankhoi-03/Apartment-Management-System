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
from app.models.user import User
from app.core.dependencies import get_current_user
from app.routers.report_router import get_house_financial_report, get_all_houses_financial_report

router = APIRouter(prefix="/data", tags=["data"])



@router.get("/export")
def export_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):    
    # 1. Lấy danh sách ID các nhà mà user hiện tại đang quản lý
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    
    # 2. Lọc danh sách phòng và hợp đồng chỉ thuộc về các nhà được phép
    rooms = db.query(Room).filter(Room.house_id.in_(allowed_house_ids)).all()
    contracts = db.query(Contract).join(Room).filter(Room.house_id.in_(allowed_house_ids)).all()
    
    # Dữ liệu Sheet "Phòng"
    room_status_map = {
        "vacant": "Trống",
        "occupied": "Đang thuê",
        "inactive": "Ngừng thuê"
    }

    room_data = []
    for r in rooms:
        # Lấy giá trị Nội thất an toàn
        furnitures = getattr(r, "feature_and_furniture", [])
        furnitures_str = ", ".join(furnitures) if furnitures else ""
        
        # Lấy cost_price
        cost_price = getattr(r, "cost_price", 0)

        room_data.append({
            "Tên nhà": r.house.name if r.house else "Không xác định",
            "Số Phòng": r.room_number,
            "Diện tích (m2)": r.area_sqm,
            "Giá vốn (VNĐ)": float(cost_price) if cost_price else 0,
            "Trạng thái (Trống hoặc Đang thuê)": room_status_map.get(r.status, r.status),
            "Đồng hồ nước (Có hoặc Không)": "Có" if r.is_water_meter else "Không",
            "Nội thất": furnitures_str
        })
        
    # Dữ liệu Sheet "Hợp đồng"
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
            "Tiền thuê": float(c.monthly_rent) if getattr(c, "monthly_rent", None) else 0,
            "Tiền cọc": float(c.deposit) if getattr(c, "deposit", None) else 0,
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
async def import_excel(
    file: UploadFile = File(...), 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):    
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
    
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    
    for _, row in df_rooms.iterrows():
        house_name = str(row.get("Tên nhà")).strip() if row.get("Tên nhà") else None
        room_number = str(row.get("Số Phòng")).strip() if row.get("Số Phòng") else None
        
        if not house_name or not room_number:
            continue 
            
        house = None
        if allowed_house_ids:
            house = db.query(House).filter(
                House.name == house_name,
                House.id.in_(allowed_house_ids)
            ).first()
            
        if not house:
            house = House(name=house_name)
            current_user.managed_houses.append(house) 
            
            db.add(house)
            db.commit() 
            db.refresh(house)
            
            allowed_house_ids.append(house.id) 
            
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

        cost_val = row.get("Giá vốn (VNĐ)")
        if pd.isna(cost_val) or cost_val is None:
            cost_val = row.get("Giá thuê (VNĐ)")
        
        cost_price = float(cost_val) if cost_val and not pd.isna(cost_val) else 0.0

        existing_room = db.query(Room).filter(
            Room.house_id == house.id, 
            Room.room_number == room_number
        ).first()

        if existing_room:
            existing_room.area_sqm = row.get("Diện tích (m2)")
            existing_room.cost_price = cost_price
            if raw_status:
                existing_room.status = db_status
            existing_room.is_water_meter = is_water
            existing_room.feature_and_furniture = furnitures_arr 
        else:
            new_room = Room(
                house_id=house.id,
                room_number=room_number,
                area_sqm=row.get("Diện tích (m2)"),
                cost_price=cost_price,
                status=db_status,
                is_water_meter=is_water,
                feature_and_furniture=furnitures_arr 
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
        "Giá vốn (VNĐ)", "Trạng thái (Trống hoặc Đang thuê)", "Đồng hồ nước (Có hoặc Không)", "Nội thất"
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
def export_financial_excel(
    month: str, 
    house_id: str = "all", 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):
    try:
        if house_id == "all":
            report_data = get_all_houses_financial_report(month=month, db=db, current_user=current_user)
        else:
            report_data = get_house_financial_report(house_id=int(house_id), month=month, db=db, current_user=current_user)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    def _g(obj, key, default=""):
        if isinstance(obj, dict): return obj.get(key, default)
        return getattr(obj, key, default)

    # 1. Trích xuất an toàn các tab để tránh lỗi AttributeError/KeyError
    rent_tab = _g(report_data, "rent_tab", {})
    other_rev_tab = _g(report_data, "other_revenue_tab", {})
    util_tab = _g(report_data, "utilities_tab", {})
    maint_tab = _g(report_data, "maintenance_tab", {})
    mgmt_tab = _g(report_data, "management_tab", {})
    base_cost_tab = _g(report_data, "base_cost_tab", {})
    other_costs_tab = _g(report_data, "other_costs_tab", {})

    rent_details = _g(rent_tab, "details", [])
    other_rev_details = _g(other_rev_tab, "details", [])
    util_details = _g(util_tab, "details", [])
    maint_details = _g(maint_tab, "details", [])
    mgmt_details = _g(mgmt_tab, "details", [])
    base_cost_details = _g(base_cost_tab, "details", [])
    other_costs_details = _g(other_costs_tab, "details", [])

    total_rev = _g(report_data, "total_revenue", 0)
    total_cost = _g(report_data, "total_cost", 0)
    net_profit = _g(report_data, "net_profit", 0)

    output = io.BytesIO()
    try:
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            
            # 1. Sheet Tổng quan
            summary_data = [
                {"Chỉ tiêu": "Tháng", "Giá trị": month},
                {"Chỉ tiêu": "Tổng doanh thu (VNĐ)", "Giá trị": float(total_rev or 0)},
                {"Chỉ tiêu": "Tổng chi phí (VNĐ)", "Giá trị": float(total_cost or 0)},
                {"Chỉ tiêu": "Lợi nhuận ròng (VNĐ)", "Giá trị": float(net_profit or 0)},
            ]
            pd.DataFrame(summary_data, columns=["Chỉ tiêu", "Giá trị"]).to_excel(writer, sheet_name="Tổng quan", index=False, header=False)

            # 2. Sheet Tiền thuê nhà
            rent_data = [{"Phòng": _g(d, "room_name"), "Số tiền (VNĐ)": _g(d, "revenue")} for d in rent_details]
            pd.DataFrame(rent_data, columns=["Phòng", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Tiền thuê nhà", index=False)

            # 3. Sheet Phí dịch vụ & Phát sinh
            other_rev_data = [{"Phòng": _g(d, "room_name"), "Hạng mục": _g(d, "item"), "Số tiền (VNĐ)": _g(d, "amount")} for d in other_rev_details]
            pd.DataFrame(other_rev_data, columns=["Phòng", "Hạng mục", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Dịch vụ & Phát sinh", index=False)

            # 4. Sheet Điện & Nước
            util_data = [{"Phòng": _g(d, "room_name"), "Tiền điện (VNĐ)": _g(d, "electric_cost"), "Tiền nước (VNĐ)": _g(d, "water_cost")} for d in util_details]
            pd.DataFrame(util_data, columns=["Phòng", "Tiền điện (VNĐ)", "Tiền nước (VNĐ)"]).to_excel(writer, sheet_name="Điện & Nước", index=False)

            # 5. Sheet Sửa chữa & Bảo trì
            maint_data = [{"Phòng": _g(d, "room_name"), "Nội dung": _g(d, "description"), "Bên xử lý": _g(d, "handler_info") or "—", "Chi phí (VNĐ)": _g(d, "amount")} for d in maint_details]
            pd.DataFrame(maint_data, columns=["Phòng", "Nội dung", "Bên xử lý", "Chi phí (VNĐ)"]).to_excel(writer, sheet_name="Sửa chữa & Bảo trì", index=False)

            # 6. Sheet Nhân viên quản lý
            mgr_data = [{"Hạng mục": _g(d, "item"), "Số tiền (VNĐ)": _g(d, "amount")} for d in mgmt_details]
            pd.DataFrame(mgr_data, columns=["Hạng mục", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Nhân viên", index=False)

            # 7. Sheet Giá Cost
            cost_data = [{"Phòng": _g(d, "room_name"), "Số tiền (VNĐ)": _g(d, "amount")} for d in base_cost_details]
            pd.DataFrame(cost_data, columns=["Phòng", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Giá Cost", index=False)

            # 8. Sheet Chi phí khác
            other_cost_data = [{"Nội dung chi": _g(d, "item"), "Số tiền (VNĐ)": _g(d, "amount")} for d in other_costs_details]
            pd.DataFrame(other_cost_data, columns=["Nội dung chi", "Số tiền (VNĐ)"]).to_excel(writer, sheet_name="Chi phí khác", index=False)

            # Căn chỉnh độ rộng cột tự động cho tất cả các sheet
            for sheet_name in writer.sheets:
                worksheet = writer.sheets[sheet_name]
                worksheet.column_dimensions['A'].width = 30
                worksheet.column_dimensions['B'].width = 25
                worksheet.column_dimensions['C'].width = 20
                worksheet.column_dimensions['D'].width = 20
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý dữ liệu Excel: {str(e)}")
    
    output.seek(0)
    
    house_name_raw = _g(report_data, "house_name", "")
    safe_house_name = house_name_raw.replace(' ', '_') if house_name_raw else f"Nha_Tro_{house_id}"
    
    file_name = f"Bao_Cao_Tai_Chinh_{safe_house_name}_{month}.xlsx"
    encoded_file_name = quote(file_name)
    headers = {
        "Content-Disposition": f"attachment; filename*=utf-8''{encoded_file_name}"
    }
    
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )