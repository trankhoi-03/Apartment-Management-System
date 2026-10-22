from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from decimal import Decimal
import calendar

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.houses import House
from app.models.room import Room
from app.models.bill import Bill
from app.models.contract import Contract
from app.models.tenant import Tenant
from app.models.incident import Incident
from app.models.monthly_house_cost import MonthlyHouseCost
from app.schemas.report_schema import (
    HouseFinancialReport, InternetCostInput, ReportCategory, 
    MonthlyCostUpdate, UtilityBillInput, OtherCostUpdate, 
    OtherCostInput, InternetCostUpdate
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _contracts_billed_in_month(db: Session, room_id: int, month: str):
    """Các hợp đồng của phòng có bill trong tháng `month` (kể cả hợp đồng đã kết thúc trong tháng đó).

    Dùng để chia tiền nước theo số người cho các phòng thực sự được tính tiền trong tháng,
    khớp với cách chia tiền điện (theo bill của tháng) thay vì theo hợp đồng đang 'active' hiện tại."""
    contract_ids = {
        cid for (cid,) in db.query(Bill.contract_id)
        .join(Contract, Bill.contract_id == Contract.id)
        .filter(Contract.room_id == room_id, Bill.billing_month == month)
        .all()
    }
    if not contract_ids:
        return []
    return db.query(Contract).filter(Contract.id.in_(contract_ids)).all()


def _allocate_house_water_cost(db: Session, rooms, month: str, total_cube, total_bill):
    """Phân bổ CHI PHÍ trả công ty nước, không ảnh hưởng doanh thu từ khách.

    Chỉ tính các phòng có Bill của tháng; kiểm tra toàn bộ theo 3 loại nhà:
    - Toàn không đồng hồ: theo người.
    - Toàn đồng hồ: theo m³; chênh lệch dương của đồng hồ tổng là hao hụt.
    - Hỗn hợp: nếu tổng m³ > m³ nhóm có đồng hồ, nhóm đồng hồ tính
      theo tổng m³, phần còn lại chia theo người nhóm không đồng hồ;
      nếu thiếu tổng m³ hoặc tổng <= m³ nhóm đồng hồ, chia theo người
      toàn nhà để tránh phân bổ vượt bill hoặc bỏ sót nhóm không đồng hồ.
    Kết quả trả về: {room_id: Decimal}, Decimal hao hụt/chưa phân bổ.
    """
    total_cube = Decimal(str(total_cube or 0))
    total_bill = Decimal(str(total_bill or 0))
    room_usage = {}
    room_people = {}
    eligible = []

    for room in rooms:
        bills = (db.query(Bill).join(Contract, Bill.contract_id == Contract.id)
                 .filter(Contract.room_id == room.id, Bill.billing_month == month).all())
        if not bills:
            continue
        eligible.append(room)
        room_usage[room.id] = sum(
            (max(Decimal(str(b.water_consumed or 0)), Decimal("0")) for b in bills),
            Decimal("0")
        )
        contracts = _contracts_billed_in_month(db, room.id, month)
        room_people[room.id] = sum(
            (Decimal(str(c.num_tenants or 0)) for c in contracts), Decimal("0")
        )

    allocation = {room.id: Decimal("0") for room in rooms}
    if total_bill <= 0 or not eligible:
        return allocation, max(total_bill, Decimal("0"))

    def share(amount, weights):
        weights = {rid: max(w, Decimal("0")) for rid, w in weights.items()}
        denominator = sum(weights.values(), Decimal("0"))
        if denominator <= 0:
            return
        for rid, weight in weights.items():
            allocation[rid] += amount * weight / denominator

    meter_rooms = [r for r in eligible if r.is_water_meter]
    no_meter_rooms = [r for r in eligible if not r.is_water_meter]
    metered_cube = sum((room_usage[r.id] for r in meter_rooms), Decimal("0"))

    if not meter_rooms:
        share(total_bill, {r.id: room_people[r.id] for r in eligible})
    elif not no_meter_rooms:
        if metered_cube > 0:
            # Nếu số tổng < tổng phòng, chuẩn hóa theo tổng phòng (không âm).
            denominator = max(total_cube, metered_cube)
            for r in meter_rooms:
                allocation[r.id] = total_bill * room_usage[r.id] / denominator
        else:
            # Chưa ghi bất kỳ chỉ số nước nào: dự phòng theo số người.
            share(total_bill, {r.id: room_people[r.id] for r in eligible})
    elif total_cube > metered_cube:
        for r in meter_rooms:
            allocation[r.id] = total_bill * room_usage[r.id] / total_cube
        remainder = total_bill - sum(allocation.values(), Decimal("0"))
        share(remainder, {r.id: room_people[r.id] for r in no_meter_rooms})
    else:
        # Thiếu tổng m³ hoặc tổng <= chỉ số của nhóm có đồng hồ.
        share(total_bill, {r.id: room_people[r.id] for r in eligible})

    unallocated = total_bill - sum(allocation.values(), Decimal("0"))
    # Loại bỏ sai số cực nhỏ của Decimal khi chia tỷ lệ.
    if abs(unallocated) < Decimal("0.00000001"):
        unallocated = Decimal("0")
    return allocation, max(unallocated, Decimal("0"))


@router.get("/financial/all", response_model=HouseFinancialReport)
def get_all_houses_financial_report(
    month: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    houses = db.query(House).filter(House.id.in_(allowed_house_ids)).all()
    
    rent_details = []
    other_revenue_details = [] 
    cleaning_revenue_details = [] 
    internet_revenue_details = [] 
    util_details = []
    maint_details = []
    base_cost_details = []
    manager_details = []
    other_details = []
    internet_cost_details = []
    
    total_revenue = Decimal("0")
    total_rent_revenue = Decimal("0")  
    total_other_revenue = Decimal("0") 
    total_cleaning_revenue = Decimal("0") 
    total_internet_revenue = Decimal("0") 
    total_utilities_cost = Decimal("0")
    total_maintenance_cost = Decimal("0")
    total_base_cost = Decimal("0")
    total_management_cost = Decimal("0")
    total_hc_other = Decimal("0")
    total_internet_cost_val = Decimal("0")

    try:
        year, m = map(int, month.split('-'))
        last_day = calendar.monthrange(year, m)[1]
        start_date = f"{month}-01"
        end_date = f"{month}-{last_day} 23:59:59"
    except ValueError:
        raise HTTPException(status_code=400, detail="Định dạng tháng không hợp lệ")

    for house in houses:
        house_cost = db.query(MonthlyHouseCost).filter(
            MonthlyHouseCost.house_id == house.id,
            MonthlyHouseCost.month == month
        ).first()

        ui_elec_kwh = float(house_cost.total_electric_kwh) if house_cost and house_cost.total_electric_kwh else 0.0
        ui_elec_bill = float(house_cost.total_electric_bill) if house_cost and house_cost.total_electric_bill else 0.0
        ui_water_cube = float(house_cost.total_water_cube) if house_cost and house_cost.total_water_cube else 0.0
        ui_water_bill = float(house_cost.total_water_bill) if house_cost and house_cost.total_water_bill else 0.0

        calc_elec_kwh = Decimal(str(ui_elec_kwh)) if ui_elec_kwh > 0 else Decimal("1")
        calc_elec_bill = Decimal(str(ui_elec_bill))
        calc_water_cube = Decimal(str(ui_water_cube)) if ui_water_cube > 0 else Decimal("1")
        calc_water_bill = Decimal(str(ui_water_bill))

        hm_cost = Decimal(str(house.employee_fee)) if house.employee_fee else Decimal("0")
        total_management_cost += hm_cost
        fee_per_room = Decimal("0")
        if hm_cost > 0 and len(house.rooms) > 0:
            fee_per_room = hm_cost / Decimal(str(len(house.rooms)))

        hc_other = Decimal(str(house_cost.other_house_cost)) if house_cost and house_cost.other_house_cost else Decimal("0")
        hc_reason = house_cost.other_house_cost_reason if house_cost and house_cost.other_house_cost_reason else "Chi phí phát sinh khác"
        total_hc_other += hc_other
        other_fee_per_room = Decimal("0")
        if hc_other > 0 and len(house.rooms) > 0:
            other_fee_per_room = hc_other / Decimal(str(len(house.rooms)))

        internet_cost = Decimal(str(house_cost.total_internet_cost)) if house_cost and getattr(house_cost, 'total_internet_cost', None) else Decimal("0")
        total_internet_cost_val += internet_cost
        internet_fee_per_room = Decimal("0")
        if internet_cost > 0 and len(house.rooms) > 0:
            internet_fee_per_room = internet_cost / Decimal(str(len(house.rooms)))

        room_water_costs, house_unallocated_water = _allocate_house_water_cost(
            db, house.rooms, month, ui_water_cube, calc_water_bill
        )

        allocated_house_elec_cost = Decimal("0")
        allocated_house_water_cost = Decimal("0")

        # Chuẩn bị thông số hao hụt điện để chia tự động
        total_rooms_electric_kwh_house = sum(
            (Decimal(str(b.electric_consumed)) if b.electric_consumed else Decimal("0"))
            for r in house.rooms 
            for b in db.query(Bill).join(Contract).filter(Contract.room_id == r.id, Bill.billing_month == month).all()
        )
        calc_rooms_elec_kwh_house = total_rooms_electric_kwh_house if total_rooms_electric_kwh_house > 0 else Decimal("1")


        for room in house.rooms:
            room_bills = (
                db.query(Bill, Tenant.full_name)
                .join(Contract, Bill.contract_id == Contract.id)
                .outerjoin(Tenant, Contract.tenant_id == Tenant.id)
                .filter(Contract.room_id == room.id, Bill.billing_month == month)
                .all()
            )

            total_room_elec_kwh = Decimal("0")
            total_room_water_cube = Decimal("0")

            for bill, tenant_name in room_bills:
                tenant_label = f" ({tenant_name})" if tenant_name else ""
                display_label = f"Phòng {room.room_number} - {house.name}{tenant_label}"

                room_rent = Decimal(str(bill.rent_amount)) if bill.rent_amount else Decimal("0")
                b_electric_rev = Decimal(str(bill.electric_amount)) if bill.electric_amount else Decimal("0")
                b_water_rev = Decimal(str(bill.water_amount)) if bill.water_amount else Decimal("0")

                total_rent_revenue += room_rent
                total_revenue += (room_rent + b_electric_rev + b_water_rev)
                
                rent_details.append({"room_name": display_label, "revenue": float(room_rent)})

                b_service = Decimal(str(bill.service_fee)) if bill.service_fee else Decimal("0")
                b_cleaning = Decimal(str(bill.cleaning_fee)) if bill.cleaning_fee else Decimal("0") 
                b_internet = Decimal(str(bill.internet_fee)) if bill.internet_fee else Decimal("0") 
                b_additional = Decimal(str(bill.additional_fee)) if bill.additional_fee else Decimal("0")
                
                current_other_rev = b_service + b_cleaning + b_internet + b_additional
                if current_other_rev > 0:
                    total_revenue += current_other_rev
                    if b_service > 0:
                        total_other_revenue += b_service
                        other_revenue_details.append({"room_name": display_label, "item": "Phí dịch vụ", "amount": float(b_service)})
                    if b_cleaning > 0:
                        total_cleaning_revenue += b_cleaning
                        cleaning_revenue_details.append({"room_name": display_label, "amount": float(b_cleaning)})
                    if b_internet > 0:
                        total_internet_revenue += b_internet
                        internet_revenue_details.append({"room_name": display_label, "amount": float(b_internet)})
                    if b_additional > 0:
                        total_other_revenue += b_additional
                        reason = bill.additional_fee_reason or "Phát sinh khác"
                        other_revenue_details.append({"room_name": display_label, "item": reason, "amount": float(b_additional)})

                if bill.electric_consumed:
                    total_room_elec_kwh += Decimal(str(bill.electric_consumed))
                if bill.water_consumed:
                    total_room_water_cube += Decimal(str(bill.water_consumed))

            # Logic phân bổ thông minh
            if ui_elec_kwh > 0:
                elec_cost = (total_room_elec_kwh / Decimal(str(ui_elec_kwh))) * calc_elec_bill
            else:
                elec_cost = (total_room_elec_kwh / calc_rooms_elec_kwh_house) * calc_elec_bill
                
            water_cost = room_water_costs.get(room.id, Decimal("0"))

            allocated_house_elec_cost += elec_cost
            allocated_house_water_cost += water_cost
            total_utilities_cost += (elec_cost + water_cost)
            
            if elec_cost > 0 or water_cost > 0:
                util_details.append({"room_name": f"Phòng {room.room_number} - {house.name}", "electric_cost": float(elec_cost), "water_cost": float(water_cost)})

            incident_filter = or_(
                Incident.expense_month == month,
                (Incident.expense_month.is_(None) & (Incident.created_at >= start_date) & (Incident.created_at <= end_date))
            )
            incidents = db.query(Incident).filter(
                Incident.room_id == room.id,
                Incident.repair_cost.isnot(None),
                Incident.repair_cost > 0,
                incident_filter
            ).all()
            for inc in incidents:
                r_cost = Decimal(str(inc.repair_cost)) 
                total_maintenance_cost += r_cost
                maint_details.append({"room_name": f"Phòng {room.room_number} - {house.name}", "description": inc.description, "handler_info": inc.handler_info, "amount": float(r_cost)})

            r_base_cost = Decimal(str(room.cost_price)) 
            total_base_cost += r_base_cost
            base_cost_details.append({"room_name": f"Phòng {room.room_number} - {house.name}", "amount": float(r_base_cost)})

            if fee_per_room > 0:
                manager_details.append({"item": f"Phòng {room.room_number} - {house.name}", "amount": float(fee_per_room)})
                
            if other_fee_per_room > 0:
                other_details.append({"item": f"Phòng {room.room_number} - {house.name} ({hc_reason})", "amount": float(other_fee_per_room)})

            if internet_fee_per_room > 0:
                internet_cost_details.append({"item": f"Phòng {room.room_number} - {house.name}", "amount": float(internet_fee_per_room)})

        unallocated_elec = calc_elec_bill - allocated_house_elec_cost
        unallocated_water = house_unallocated_water
        
        if unallocated_elec > 0:
            util_details.append({"room_name": f"[{house.name}] Hao hụt điện", "electric_cost": float(unallocated_elec), "water_cost": 0.0})
            total_utilities_cost += unallocated_elec
        
        if unallocated_water > 0:
            util_details.append({"room_name": f"[{house.name}] Hao hụt nước", "electric_cost": 0.0, "water_cost": float(unallocated_water)})
            total_utilities_cost += unallocated_water

    total_cost = total_utilities_cost + total_maintenance_cost + total_base_cost + total_management_cost + total_hc_other + total_internet_cost_val
    net_profit = total_revenue - total_cost

    return HouseFinancialReport(
        house_id=0, house_name="Tất cả nhà trọ", month=month,
        total_revenue=float(total_revenue), total_cost=float(total_cost), net_profit=float(net_profit),
        rent_tab=ReportCategory(total=float(total_rent_revenue), details=rent_details),
        other_revenue_tab=ReportCategory(total=float(total_other_revenue), details=other_revenue_details),
        cleaning_rev_tab=ReportCategory(total=float(total_cleaning_revenue), details=cleaning_revenue_details), 
        internet_rev_tab=ReportCategory(total=float(total_internet_revenue), details=internet_revenue_details), 
        utilities_tab=ReportCategory(total=float(total_utilities_cost), details=util_details),
        maintenance_tab=ReportCategory(total=float(total_maintenance_cost), details=maint_details),
        management_tab=ReportCategory(total=float(total_management_cost), details=manager_details),
        base_cost_tab=ReportCategory(total=float(total_base_cost), details=base_cost_details),
        other_costs_tab=ReportCategory(total=float(total_hc_other), details=other_details),
        utility_bill_input=UtilityBillInput(total_electric_kwh=0, total_electric_bill=0, total_water_cube=0, total_water_bill=0),
        other_cost_input=OtherCostInput(other_house_cost=0, other_house_cost_reason=""),
        internet_cost_tab=ReportCategory(total=float(total_internet_cost_val), details=internet_cost_details),
        internet_cost_input=InternetCostInput(total_internet_cost=float(total_internet_cost_val)),
    )


@router.post("/financial/{house_id}/internet-cost")
def update_internet_cost(
    house_id: int, month: str, payload: InternetCostUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if house_id not in [h.id for h in current_user.managed_houses]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập nhà này")

    cost = db.query(MonthlyHouseCost).filter(
        MonthlyHouseCost.house_id == house_id, 
        MonthlyHouseCost.month == month
    ).first()
    
    if not cost:
        cost = MonthlyHouseCost(house_id=house_id, month=month)
        db.add(cost)
        
    cost.total_internet_cost = payload.total_internet_cost
    db.commit()
    return {"message": "Cập nhật chi phí internet thành công"}


@router.post("/financial/{house_id}/other-cost")
def update_other_cost(
    house_id: int, month: str, payload: OtherCostUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if house_id not in [h.id for h in current_user.managed_houses]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập nhà này")

    cost = db.query(MonthlyHouseCost).filter(
        MonthlyHouseCost.house_id == house_id, 
        MonthlyHouseCost.month == month
    ).first()
    
    if not cost:
        cost = MonthlyHouseCost(house_id=house_id, month=month)
        db.add(cost)
        
    cost.other_house_cost = payload.other_house_cost
    cost.other_house_cost_reason = payload.other_house_cost_reason
    db.commit()
    return {"message": "Cập nhật chi phí khác thành công"}


@router.post("/financial/{house_id}/monthly-cost")
def update_monthly_cost(
    house_id: int, month: str, payload: MonthlyCostUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if house_id not in [h.id for h in current_user.managed_houses]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập nhà này")

    cost = db.query(MonthlyHouseCost).filter(
        MonthlyHouseCost.house_id == house_id, 
        MonthlyHouseCost.month == month
    ).first()
    
    if not cost:
        cost = MonthlyHouseCost(house_id=house_id, month=month)
        db.add(cost)
        
    cost.total_electric_kwh = payload.total_electric_kwh
    cost.total_electric_bill = payload.total_electric_bill
    cost.total_water_cube = payload.total_water_cube
    cost.total_water_bill = payload.total_water_bill
    db.commit()
    return {"message": "Cập nhật thành công"}


@router.get("/financial/{house_id}", response_model=HouseFinancialReport)
def get_house_financial_report(
    house_id: int, month: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if house_id not in [h.id for h in current_user.managed_houses]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập báo cáo của nhà này")

    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà")

    house_cost = db.query(MonthlyHouseCost).filter(
        MonthlyHouseCost.house_id == house_id,
        MonthlyHouseCost.month == month
    ).first()

    ui_elec_kwh = float(house_cost.total_electric_kwh) if house_cost and house_cost.total_electric_kwh else 0.0
    ui_elec_bill = float(house_cost.total_electric_bill) if house_cost and house_cost.total_electric_bill else 0.0
    ui_water_cube = float(house_cost.total_water_cube) if house_cost and house_cost.total_water_cube else 0.0
    ui_water_bill = float(house_cost.total_water_bill) if house_cost and house_cost.total_water_bill else 0.0

    calc_elec_bill = Decimal(str(ui_elec_bill))
    calc_water_bill = Decimal(str(ui_water_bill))
    calc_water_cube = Decimal(str(ui_water_cube)) if ui_water_cube > 0 else Decimal("1")
    
    rooms = house.rooms

    total_rooms_electric_kwh = Decimal("0")
    for r in rooms:
        r_bills = db.query(Bill).join(Contract).filter(Contract.room_id == r.id, Bill.billing_month == month).all()
        for r_bill in r_bills:
            if r_bill.electric_consumed:
                total_rooms_electric_kwh += Decimal(str(r_bill.electric_consumed))

    calc_rooms_elec_kwh = total_rooms_electric_kwh if total_rooms_electric_kwh > 0 else Decimal("1")
    room_water_costs, house_unallocated_water = _allocate_house_water_cost(
        db, rooms, month, ui_water_cube, calc_water_bill
    )

    rent_details = []
    other_revenue_details = []
    cleaning_revenue_details = [] 
    internet_revenue_details = [] 
    util_details = []
    maint_details = []
    base_cost_details = []
    manager_details = []
    other_details = []
    internet_cost_details = []
    
    total_revenue = Decimal("0")
    total_rent_revenue = Decimal("0") 
    total_other_revenue = Decimal("0")
    total_cleaning_revenue = Decimal("0") 
    total_internet_revenue = Decimal("0") 
    total_utilities_cost = Decimal("0")
    total_maintenance_cost = Decimal("0")
    total_base_cost = Decimal("0")

    allocated_house_elec_cost = Decimal("0")
    allocated_house_water_cost = Decimal("0")

    try:
        year, m = map(int, month.split('-'))
        last_day = calendar.monthrange(year, m)[1]
        start_date = f"{month}-01"
        end_date = f"{month}-{last_day} 23:59:59"
    except ValueError:
        raise HTTPException(status_code=400, detail="Định dạng tháng không hợp lệ (YYYY-MM)")
    
    total_management_cost = Decimal(str(house.employee_fee)) if house.employee_fee else Decimal("0")
    fee_per_room = Decimal("0")
    if total_management_cost > 0 and len(rooms) > 0:
        fee_per_room = total_management_cost / Decimal(str(len(rooms)))

    hc_other = Decimal(str(house_cost.other_house_cost)) if house_cost and house_cost.other_house_cost else Decimal("0")
    hc_other_reason = house_cost.other_house_cost_reason if house_cost and house_cost.other_house_cost_reason else "Chi phí phát sinh khác"
    other_fee_per_room = Decimal("0")
    if hc_other > 0 and len(rooms) > 0:
        other_fee_per_room = hc_other / Decimal(str(len(rooms)))

    internet_cost = Decimal(str(house_cost.total_internet_cost)) if house_cost and getattr(house_cost, 'total_internet_cost', None) else Decimal("0")
    internet_fee_per_room = Decimal("0")
    if internet_cost > 0 and len(rooms) > 0:
        internet_fee_per_room = internet_cost / Decimal(str(len(rooms)))

    for room in rooms:
        room_bills = (
            db.query(Bill, Tenant.full_name)
            .join(Contract, Bill.contract_id == Contract.id)
            .outerjoin(Tenant, Contract.tenant_id == Tenant.id)
            .filter(Contract.room_id == room.id, Bill.billing_month == month)
            .all()
        )

        total_room_elec_kwh = Decimal("0")
        total_room_water_cube = Decimal("0")

        for bill, tenant_name in room_bills:
            tenant_label = f" ({tenant_name})" if tenant_name else ""
            display_label = f"Phòng {room.room_number}{tenant_label}"

            room_rent = Decimal(str(bill.rent_amount)) if bill.rent_amount else Decimal("0")
            b_electric_rev = Decimal(str(bill.electric_amount)) if bill.electric_amount else Decimal("0")
            b_water_rev = Decimal(str(bill.water_amount)) if bill.water_amount else Decimal("0")

            total_rent_revenue += room_rent
            total_revenue += (room_rent + b_electric_rev + b_water_rev)
            
            rent_details.append({"room_name": display_label, "revenue": float(room_rent)})

            b_service = Decimal(str(bill.service_fee)) if bill.service_fee else Decimal("0")
            b_cleaning = Decimal(str(bill.cleaning_fee)) if bill.cleaning_fee else Decimal("0") 
            b_internet = Decimal(str(bill.internet_fee)) if bill.internet_fee else Decimal("0") 
            b_additional = Decimal(str(bill.additional_fee)) if bill.additional_fee else Decimal("0")
            
            current_other_rev = b_service + b_cleaning + b_internet + b_additional
            if current_other_rev > 0:
                total_revenue += current_other_rev
                
                if b_service > 0:
                    total_other_revenue += b_service
                    other_revenue_details.append({"room_name": display_label, "item": "Phí dịch vụ", "amount": float(b_service)})
                if b_cleaning > 0:
                    total_cleaning_revenue += b_cleaning
                    cleaning_revenue_details.append({"room_name": display_label, "amount": float(b_cleaning)})
                if b_internet > 0:
                    total_internet_revenue += b_internet
                    internet_revenue_details.append({"room_name": display_label, "amount": float(b_internet)})
                if b_additional > 0:
                    total_other_revenue += b_additional
                    reason = bill.additional_fee_reason or "Phát sinh khác"
                    other_revenue_details.append({"room_name": display_label, "item": reason, "amount": float(b_additional)})

            if bill.electric_consumed:
                total_room_elec_kwh += Decimal(str(bill.electric_consumed))
            if bill.water_consumed:
                total_room_water_cube += Decimal(str(bill.water_consumed))

        if ui_elec_kwh > 0:
            elec_cost = (total_room_elec_kwh / Decimal(str(ui_elec_kwh))) * calc_elec_bill
        else:
            elec_cost = (total_room_elec_kwh / calc_rooms_elec_kwh) * calc_elec_bill
        
        water_cost = room_water_costs.get(room.id, Decimal("0"))

        allocated_house_elec_cost += elec_cost
        allocated_house_water_cost += water_cost
        total_utilities_cost += (elec_cost + water_cost)
        
        if elec_cost > 0 or water_cost > 0:
            util_details.append({"room_name": f"Phòng {room.room_number}", "electric_cost": float(elec_cost), "water_cost": float(water_cost)})

        incident_filter = or_(
            Incident.expense_month == month,
            (Incident.expense_month.is_(None) & (Incident.created_at >= start_date) & (Incident.created_at <= end_date))
        )
        incidents = db.query(Incident).filter(
            Incident.room_id == room.id,
            Incident.repair_cost.isnot(None),
            Incident.repair_cost > 0,
            incident_filter
        ).all()

        for inc in incidents:
            r_cost = Decimal(str(inc.repair_cost)) 
            total_maintenance_cost += r_cost
            maint_details.append({"room_name": f"Phòng {room.room_number}", "description": inc.description, "handler_info": inc.handler_info, "amount": float(r_cost)})        

        r_base_cost = Decimal(str(room.cost_price)) 
        total_base_cost += r_base_cost
        base_cost_details.append({"room_name": f"Phòng {room.room_number}", "amount": float(r_base_cost)})

        if fee_per_room > 0:
            manager_details.append({"item": f"Phòng {room.room_number}", "amount": float(fee_per_room)})
            
        if other_fee_per_room > 0:
            other_details.append({"item": f"Phòng {room.room_number} ({hc_other_reason})", "amount": float(other_fee_per_room)})

        if internet_fee_per_room > 0:
            internet_cost_details.append({"item": f"Phòng {room.room_number}", "amount": float(internet_fee_per_room)})

    unallocated_elec = calc_elec_bill - allocated_house_elec_cost
    unallocated_water = house_unallocated_water
    
    if unallocated_elec > 0:
        util_details.append({"room_name": f"Khu vực chung", "electric_cost": float(unallocated_elec), "water_cost": 0.0})
        total_utilities_cost += unallocated_elec
    
    if unallocated_water > 0:
        util_details.append({"room_name": f"Hao hụt nước", "electric_cost": 0.0, "water_cost": float(unallocated_water)})
        total_utilities_cost += unallocated_water

    total_cost = total_utilities_cost + total_maintenance_cost + total_base_cost + total_management_cost + hc_other + internet_cost
    net_profit = total_revenue - total_cost

    return HouseFinancialReport(
        house_id=house_id,
        house_name=house.name,
        month=month,
        total_revenue=float(total_revenue),
        total_cost=float(total_cost),
        net_profit=float(net_profit),
        rent_tab=ReportCategory(total=float(total_rent_revenue), details=rent_details),
        other_revenue_tab=ReportCategory(total=float(total_other_revenue), details=other_revenue_details),
        cleaning_rev_tab=ReportCategory(total=float(total_cleaning_revenue), details=cleaning_revenue_details), 
        internet_rev_tab=ReportCategory(total=float(total_internet_revenue), details=internet_revenue_details), 
        utilities_tab=ReportCategory(total=float(total_utilities_cost), details=util_details),
        maintenance_tab=ReportCategory(total=float(total_maintenance_cost), details=maint_details),
        management_tab=ReportCategory(total=float(total_management_cost), details=manager_details),
        base_cost_tab=ReportCategory(total=float(total_base_cost), details=base_cost_details),
        other_costs_tab=ReportCategory(total=float(hc_other), details=other_details),
        other_cost_input=OtherCostInput(
            other_house_cost=float(hc_other),
            other_house_cost_reason=house_cost.other_house_cost_reason if house_cost else ""
        ),
        internet_cost_tab=ReportCategory(total=float(internet_cost), details=internet_cost_details),
        internet_cost_input=InternetCostInput(total_internet_cost=float(internet_cost)),
        utility_bill_input=UtilityBillInput(
            total_electric_kwh=ui_elec_kwh,
            total_electric_bill=ui_elec_bill,
            total_water_cube=ui_water_cube,
            total_water_bill=ui_water_bill,
        )
    )