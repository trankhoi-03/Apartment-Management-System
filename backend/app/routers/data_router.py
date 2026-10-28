import io
import pandas as pd
from openpyxl.worksheet.datavalidation import DataValidation
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
from app.models.utility_rate import UtilityRate
from app.core.dependencies import get_current_user, require_owner, verify_house_access, verify_house_owner
from app.routers.report_router import get_house_financial_report, get_all_houses_financial_report

router = APIRouter(prefix="/data", tags=["data"])



def _scoped_house_ids(db: Session, current_user: User, *, owner_only: bool = False) -> list[int]:
    """Verify every managed house using the same canonical dependencies as other routers.

    Owner-only operations fail closed if a house has zero or multiple owners.
    Staff reads use assigned-house access; staff writes are blocked by require_owner.
    """
    ids = sorted({house.id for house in current_user.managed_houses})
    checker = verify_house_owner if owner_only or current_user.role == "owner" else verify_house_access
    for house_id in ids:
        checker(house_id=house_id, db=db, current_user=current_user)
    return ids


@router.get("/export")
def export_excel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) 
):    
    # 1. Lấy danh sách ID các nhà mà user hiện tại đang quản lý
    allowed_house_ids = _scoped_house_ids(db, current_user)
    
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
        furnitures_str = ", ".join(furnitures) if isinstance(furnitures, list) else str(furnitures or "")
        # Lấy cost_price
        cost_price = getattr(r, "cost_price", 0)

        room_data.append({
            "Tên nhà": r.house.name if r.house else "Không xác định",
            "Số Phòng": r.room_number,
            "Giá vốn (VNĐ)": float(cost_price) if cost_price else 0,
            "Diện tích (m2)": r.area_sqm,
            "Trạng thái (Trống hoặc Đang thuê)": room_status_map.get(r.status, r.status),
            "Đồng hồ nước (Có hoặc Không)": "Có" if r.is_water_meter else "Không",
            "Đặc điểm & Nội thất": furnitures_str
        })
        
    # Dữ liệu Sheet "Hợp đồng"
    contract_status_map = {
        "active": "Đang thuê",
        "ended": "Đã kết thúc",
        "pending": "Chờ xử lý"
    }
    
    contract_data = []
    for c in contracts:
        # 1. Lấy thông tin người ở cùng (co_tenants)
        co_tenants_names = []
        if getattr(c, "co_tenants", None):
            for ct in c.co_tenants:
                if getattr(ct, "full_name", None):
                    co_tenants_names.append(ct.full_name.strip())
                    
        co_tenants_str = ", ".join(co_tenants_names)

        # 2. Lấy đơn giá điện nước tương ứng với phòng
        electric_price_val = 0
        water_price_val = 0
        default_water_val = 0

        latest_rate = db.query(UtilityRate).filter(
            UtilityRate.room_id == c.room_id
        ).order_by(UtilityRate.effective_from.desc(), UtilityRate.id.desc()).first()

        is_water_meter = c.room.is_water_meter if c.room else False

        if latest_rate:
            if getattr(c, "electric_calc_method", "") == "split_ratio":
                electric_display = "Chia theo bill tổng"
            else:
                electric_display = float(latest_rate.electric_price or 0)
            
            if is_water_meter:
                water_price_val = float(latest_rate.water_price or 0)
                default_water_val = 0
            else:
                water_price_val = 0
                default_water_val = float(latest_rate.default_water_amount or 0)
        else:
            electric_display = 0

        contract_data.append({
            "Tên nhà": c.room.house.name if c.room and c.room.house else "Không xác định",
            "Số phòng": c.room.room_number if c.room else "Không xác định",
            "Khách thuê": c.tenant.full_name if c.tenant else "Không xác định",
            "Số điện thoại": c.tenant.phone if c.tenant else "",
            "Email": c.tenant.email if c.tenant and c.tenant.email else "",
            "Ngày bắt đầu": c.start_date.strftime("%d/%m/%Y") if c.start_date else None,
            "Ngày kết thúc": c.end_date.strftime("%d/%m/%Y") if c.end_date else None,
            "Tiền thuê": float(c.monthly_rent) if getattr(c, "monthly_rent", None) else 0,
            "Tiền cọc": float(c.deposit) if getattr(c, "deposit", None) else 0,
            "Phí dịch vụ": float(getattr(c, "service_fee", 0) or 0),
            "Phí vệ sinh": float(getattr(c, "cleaning_fee", 0) or 0),
            "Phí internet": float(getattr(c, "internet_fee", 0) or 0),
            "Giá điện (đ/kWh)": electric_display,
            "Giá nước (đ/m3)": water_price_val if is_water_meter else "—",
            "Tiền nước cố định (đ/tháng)": default_water_val if not is_water_meter else "—",
            "Số người": c.num_tenants,
            "Người ở cùng": co_tenants_str,
            "Số xe": c.num_vehicles,            
            "Trạng thái (Đang thuê hoặc Đã kết thúc)": contract_status_map.get(c.status, c.status),
            "Ghi chú": c.notes or ""
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
    current_user: User = Depends(require_owner) 
):    
    # Owner-only access is enforced by the shared dependency before parsing Excel.

    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ định dạng file Excel (.xlsx, .xls)")

    contents = await file.read()
    try:
        excel_data = pd.read_excel(io.BytesIO(contents), sheet_name=None)
    except Exception:
        raise HTTPException(status_code=400, detail="File Excel bị lỗi hoặc không đúng định dạng.")

    if not excel_data:
        raise HTTPException(status_code=400, detail="File Excel không có sheet dữ liệu.")
    sheet_name = "Phòng" if "Phòng" in excel_data else next(iter(excel_data))
    df_rooms = excel_data[sheet_name]
    required_columns = {"Tên nhà", "Số Phòng"}
    if not required_columns.issubset(df_rooms.columns):
        raise HTTPException(status_code=400, detail="Sheet phòng thiếu cột 'Tên nhà' hoặc 'Số Phòng'.")

    status_reverse_map = {
        "trống": "vacant",
        "đang thuê": "occupied",
        "ngừng thuê": "inactive"
    }

    def _value(row, key):
        v = row.get(key)
        return None if v is None or pd.isna(v) else v

    # Scope is derived from the authenticated owner, not from an Excel value.
    allowed_house_ids = _scoped_house_ids(db, current_user, owner_only=True)
    try:
        # Keep newly created houses in the current transaction, never commit per row.
        created_by_name = {}
        for index, row in df_rooms.iterrows():
            line = index + 2  # Excel header occupies row 1.
            house_raw = _value(row, "Tên nhà")
            room_raw = _value(row, "Số Phòng")
            house_name = str(house_raw).strip() if house_raw is not None else ""
            room_number = str(room_raw).strip() if room_raw is not None else ""
            if not house_name and not room_number:
                continue
            if not house_name or not room_number:
                raise HTTPException(status_code=400, detail=f"Dòng {line}: thiếu tên nhà hoặc số phòng.")

            house = created_by_name.get(house_name)
            if house is None:
                matching = (db.query(House)
                    .filter(House.name == house_name, House.id.in_(allowed_house_ids))
                    .limit(2).all()) if allowed_house_ids else []
                if len(matching) > 1:
                    raise HTTPException(status_code=400, detail=f"Dòng {line}: tên nhà '{house_name}' không duy nhất trong tài khoản.")
                if matching:
                    house = verify_house_owner(house_id=matching[0].id, db=db, current_user=current_user)
                else:
                    # A same-named house owned by ANOTHER owner must never be updated.
                    house = House(name=house_name)
                    current_user.managed_houses.append(house)
                    db.add(house)
                    db.flush()
                    # New house must have one unambiguous owner, as in room_router.
                    verify_house_owner(house_id=house.id, db=db, current_user=current_user)
                    allowed_house_ids.append(house.id)
                created_by_name[house_name] = house

            furnishings = _value(row, "Đặc điểm & Nội thất")
            furnitures_arr = [x.strip() for x in str(furnishings).split(",") if x.strip()] if furnishings is not None else []

            raw_water = _value(row, "Đồng hồ nước (Có hoặc Không)")
            if raw_water is None:
                raw_water = _value(row, "Đồng hồ nước")
            is_water = str(raw_water).strip().lower() == "có" if raw_water is not None else False

            raw_status = _value(row, "Trạng thái (Trống hoặc Đang thuê)")
            if raw_status is None:
                raw_status = _value(row, "Trạng thái")
            db_status = status_reverse_map.get(str(raw_status).strip().lower(), "vacant") if raw_status is not None else "vacant"

            cost_val = _value(row, "Giá vốn (VNĐ)")
            if cost_val is None:
                cost_val = _value(row, "Giá thuê (VNĐ)")
            try:
                cost_price = float(cost_val) if cost_val is not None and str(cost_val).strip() else 0.0
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail=f"Dòng {line}: giá vốn không hợp lệ.")

            area = _value(row, "Diện tích (m2)")
            existing_room = db.query(Room).filter(
                Room.house_id == house.id,
                Room.room_number == room_number
            ).first()
            if existing_room:
                existing_room.area_sqm = area
                existing_room.cost_price = cost_price
                if raw_status is not None:
                    existing_room.status = db_status
                existing_room.is_water_meter = is_water
                existing_room.feature_and_furniture = furnitures_arr
            else:
                db.add(Room(
                    house_id=house.id,
                    room_number=room_number,
                    area_sqm=area,
                    cost_price=cost_price,
                    status=db_status,
                    is_water_meter=is_water,
                    feature_and_furniture=furnitures_arr
                ))

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Có lỗi xảy ra khi lưu dữ liệu import.")

    return {"detail": "Import dữ liệu thành công!"}


@router.get("/template")
def download_template(current_user: User = Depends(require_owner)):

    room_columns = [
        "Tên nhà", 
        "Số Phòng", 
        "Giá vốn (VNĐ)", 
        "Diện tích (m2)", 
        "Trạng thái (Trống hoặc Đang thuê)", 
        "Đồng hồ nước (Có hoặc Không)", 
        "Đặc điểm & Nội thất"
    ]
    
    contract_columns = [
        "Tên nhà", "Số phòng", "Khách thuê", "Số điện thoại", "Email",
        "Ngày bắt đầu", "Ngày kết thúc", "Tiền thuê", "Tiền cọc",
        "Phí dịch vụ", "Phí vệ sinh", "Phí internet",
        "Giá điện (đ/kWh)", "Giá nước (đ/m3)", "Tiền nước cố định (đ/tháng)",
        "Số người", "Người ở cùng", "Số xe", 
        "Trạng thái (Đang thuê hoặc Đã kết thúc)", "Ghi chú"
    ]

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        pd.DataFrame(columns=room_columns).to_excel(writer, sheet_name="Phòng", index=False)
        pd.DataFrame(columns=contract_columns).to_excel(writer, sheet_name="Hợp đồng", index=False)

        workbook = writer.book
        
        # 1. Xử lý Sheet "Phòng"
        ws_room = workbook["Phòng"]
        
        dv_room_status = DataValidation(
            type="list", 
            formula1='"Trống,Đang thuê"', 
            allow_blank=True
        )
        dv_room_status.error ='Vui lòng chọn từ danh sách thả xuống.'
        dv_room_status.errorTitle = 'Lỗi nhập liệu'
        
        dv_water_meter = DataValidation(
            type="list", 
            formula1='"Có,Không"', 
            allow_blank=True
        )
        dv_water_meter.error ='Vui lòng chọn "Có" hoặc "Không".'
        dv_water_meter.errorTitle = 'Lỗi nhập liệu'
        
        ws_room.add_data_validation(dv_room_status)
        ws_room.add_data_validation(dv_water_meter)
        dv_room_status.add("E2:E1000")
        dv_water_meter.add("F2:F1000")


        # 2. Xử lý Sheet "Hợp đồng"
        ws_contract = workbook["Hợp đồng"]
        
        dv_contract_status = DataValidation(
            type="list", 
            formula1='"Đang thuê,Đã kết thúc"', 
            allow_blank=True
        )
        dv_contract_status.error ='Vui lòng chọn trạng thái hợp lệ.'
        dv_contract_status.errorTitle = 'Lỗi nhập liệu'
        
        ws_contract.add_data_validation(dv_contract_status)
        dv_contract_status.add("S2:S1000")

        ws_room.column_dimensions['E'].width = 30
        ws_room.column_dimensions['F'].width = 30
        ws_contract.column_dimensions['S'].width = 40
    
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
    current_user: User = Depends(require_owner) 
):
    allowed_house_ids = _scoped_house_ids(db, current_user, owner_only=True)
    try:
        if house_id == "all":
            report_data = get_all_houses_financial_report(month=month, db=db, current_user=current_user)
        else:
            target_house_id = int(house_id)
            if target_house_id not in allowed_house_ids:
                raise HTTPException(status_code=403, detail="Không có quyền xuất tài chính của nhà này.")
            verify_house_owner(house_id=target_house_id, db=db, current_user=current_user)
            report_data = get_house_financial_report(house_id=target_house_id, month=month, db=db, current_user=current_user)
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=422, detail="house_id không hợp lệ.")
        
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