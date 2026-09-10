from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal
import calendar

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.houses import House
from app.models.room import Room
from app.models.bill import Bill
from app.models.contract import Contract
from app.models.incident import Incident
from app.models.monthly_house_cost import MonthlyHouseCost
from app.schemas.report_schema import HouseFinancialReport, ReportCategory, MonthlyCostUpdate, UtilityBillInput, OtherCostUpdate, OtherCostInput

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/financial/all", response_model=HouseFinancialReport)
def get_all_houses_financial_report(
    month: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # LỌC BẢO MẬT: Chỉ lấy những nhà mà User hiện tại quản lý
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

        # Phí quản lý chia đều
        hm_cost = Decimal(str(house.employee_fee)) if house.employee_fee else Decimal("0")
        total_management_cost += hm_cost
        fee_per_room = Decimal("0")
        if hm_cost > 0 and len(house.rooms) > 0:
            fee_per_room = hm_cost / Decimal(str(len(house.rooms)))

        # Chi phí khác chia đều
        hc_other = Decimal(str(house_cost.other_house_cost)) if house_cost and house_cost.other_house_cost else Decimal("0")
        hc_reason = house_cost.other_house_cost_reason if house_cost and house_cost.other_house_cost_reason else "Chi phí phát sinh khác"
        total_hc_other += hc_other
        other_fee_per_room = Decimal("0")
        if hc_other > 0 and len(house.rooms) > 0:
            other_fee_per_room = hc_other / Decimal(str(len(house.rooms)))

        active_contracts = db.query(Contract).join(Room).filter(Room.house_id == house.id, Contract.status == "active").all()
        total_tenants_in_house = sum(c.num_tenants for c in active_contracts) or 1 

        allocated_house_elec_cost = Decimal("0")
        allocated_house_water_cost = Decimal("0")

        for room in house.rooms:
            bill = db.query(Bill).join(Contract).filter(Contract.room_id == room.id, Bill.billing_month == month).first()
            if bill:
                room_rent = Decimal(str(bill.rent_amount)) 
                total_rent_revenue += room_rent
                total_revenue += room_rent
                rent_details.append({"room_name": f"P.{room.room_number} - {house.name}", "revenue": float(room_rent)})

                b_service = Decimal(str(bill.service_fee)) if bill.service_fee else Decimal("0")
                b_cleaning = Decimal(str(bill.cleaning_fee)) if bill.cleaning_fee else Decimal("0") 
                b_internet = Decimal(str(bill.internet_fee)) if bill.internet_fee else Decimal("0") 
                b_additional = Decimal(str(bill.additional_fee)) if bill.additional_fee else Decimal("0")
                
                current_other_rev = b_service + b_cleaning + b_internet + b_additional
                if current_other_rev > 0:
                    total_revenue += current_other_rev
                    
                    if b_service > 0:
                        total_other_revenue += b_service
                        other_revenue_details.append({"room_name": f"P.{room.room_number} - {house.name}", "item": "Phí dịch vụ", "amount": float(b_service)})
                    if b_cleaning > 0:
                        total_cleaning_revenue += b_cleaning
                        cleaning_revenue_details.append({"room_name": f"P.{room.room_number} - {house.name}", "amount": float(b_cleaning)})
                    if b_internet > 0:
                        total_internet_revenue += b_internet
                        internet_revenue_details.append({"room_name": f"P.{room.room_number} - {house.name}", "amount": float(b_internet)})
                    if b_additional > 0:
                        total_other_revenue += b_additional
                        reason = bill.additional_fee_reason or "Phát sinh khác"
                        other_revenue_details.append({"room_name": f"P.{room.room_number} - {house.name}", "item": reason, "amount": float(b_additional)})

            room_elec_kwh = Decimal(str(bill.electric_consumed)) if bill else Decimal("0") 
            room_water_consumed = Decimal(str(bill.water_consumed)) if bill else Decimal("0") 
            
            elec_cost = (room_elec_kwh / calc_elec_kwh) * calc_elec_bill
            water_cost = Decimal("0")
            if room.is_water_meter: 
                water_cost = (room_water_consumed / calc_water_cube) * calc_water_bill
            else:
                contract = db.query(Contract).filter(Contract.room_id == room.id, Contract.status == "active").first()
                if contract:
                    r_tenants = Decimal(str(contract.num_tenants))
                    water_cost = (r_tenants / Decimal(str(total_tenants_in_house))) * calc_water_bill

            allocated_house_elec_cost += elec_cost
            allocated_house_water_cost += water_cost
            total_utilities_cost += (elec_cost + water_cost)
            
            if elec_cost > 0 or water_cost > 0:
                util_details.append({"room_name": f"P.{room.room_number} - {house.name}", "electric_cost": float(elec_cost), "water_cost": float(water_cost)})

            incidents = db.query(Incident).filter(Incident.room_id == room.id, Incident.created_at >= start_date, Incident.created_at <= end_date, Incident.repair_cost.isnot(None)).all()
            for inc in incidents:
                r_cost = Decimal(str(inc.repair_cost)) 
                total_maintenance_cost += r_cost
                maint_details.append({"room_name": f"P.{room.room_number} - {house.name}", "description": inc.description, "handler_info": inc.handler_info, "amount": float(r_cost)})

            r_base_cost = Decimal(str(room.cost_price)) 
            total_base_cost += r_base_cost
            base_cost_details.append({"room_name": f"P.{room.room_number} - {house.name}", "amount": float(r_base_cost)})

            if fee_per_room > 0:
                manager_details.append({"item": f"P.{room.room_number} - {house.name}", "amount": float(fee_per_room)})
                
            if other_fee_per_room > 0:
                other_details.append({"item": f"P.{room.room_number} - {house.name} ({hc_reason})", "amount": float(other_fee_per_room)})

        unallocated_elec = calc_elec_bill - allocated_house_elec_cost
        unallocated_water = calc_water_bill - allocated_house_water_cost
        
        if unallocated_elec > 0:
            util_details.append({"room_name": f"[{house.name}] Hao hụt điện", "electric_cost": float(unallocated_elec), "water_cost": 0.0})
            total_utilities_cost += unallocated_elec
        
        if unallocated_water > 0:
            util_details.append({"room_name": f"[{house.name}] Hao hụt nước", "electric_cost": 0.0, "water_cost": float(unallocated_water)})
            total_utilities_cost += unallocated_water

    total_cost = total_utilities_cost + total_maintenance_cost + total_base_cost + total_management_cost + total_hc_other
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
        other_cost_input=OtherCostInput(other_house_cost=0, other_house_cost_reason="")
    )


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

    calc_elec_kwh = Decimal(str(ui_elec_kwh)) if ui_elec_kwh > 0 else Decimal("1")
    calc_elec_bill = Decimal(str(ui_elec_bill))
    calc_water_cube = Decimal(str(ui_water_cube)) if ui_water_cube > 0 else Decimal("1")
    calc_water_bill = Decimal(str(ui_water_bill))
    
    active_contracts = db.query(Contract).join(Room).filter(
        Room.house_id == house_id, 
        Contract.status == "active"
    ).all()
    total_tenants_in_house = sum(c.num_tenants for c in active_contracts) or 1 

    rooms = house.rooms

    rent_details = []
    other_revenue_details = []
    cleaning_revenue_details = [] 
    internet_revenue_details = [] 
    util_details = []
    maint_details = []
    base_cost_details = []
    manager_details = []
    other_details = []
    
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

    
    # CHI PHÍ QUẢN LÝ
    total_management_cost = Decimal(str(house.employee_fee)) if house.employee_fee else Decimal("0")
    fee_per_room = Decimal("0")
    if total_management_cost > 0 and len(rooms) > 0:
        fee_per_room = total_management_cost / Decimal(str(len(rooms)))

    # CHI PHÍ KHÁC
    hc_other = Decimal(str(house_cost.other_house_cost)) if house_cost and house_cost.other_house_cost else Decimal("0")
    hc_other_reason = house_cost.other_house_cost_reason if house_cost and house_cost.other_house_cost_reason else "Chi phí phát sinh khác"
    other_fee_per_room = Decimal("0")
    if hc_other > 0 and len(rooms) > 0:
        other_fee_per_room = hc_other / Decimal(str(len(rooms)))

    for room in rooms:
        bill = db.query(Bill).join(Contract).filter(
            Contract.room_id == room.id,
            Bill.billing_month == month
        ).first()

        room_revenue = Decimal("0")
        if bill:
            room_rent = Decimal(str(bill.rent_amount)) 
            total_rent_revenue += room_rent
            total_revenue += room_rent
            rent_details.append({
                "room_name": f"Phòng {room.room_number}", 
                "revenue": float(room_rent)
            })

            b_service = Decimal(str(bill.service_fee)) if bill.service_fee else Decimal("0")
            b_cleaning = Decimal(str(bill.cleaning_fee)) if bill.cleaning_fee else Decimal("0") 
            b_internet = Decimal(str(bill.internet_fee)) if bill.internet_fee else Decimal("0") 
            b_additional = Decimal(str(bill.additional_fee)) if bill.additional_fee else Decimal("0")
            
            current_other_rev = b_service + b_cleaning + b_internet + b_additional
            if current_other_rev > 0:
                total_revenue += current_other_rev
                
                if b_service > 0:
                    total_other_revenue += b_service
                    other_revenue_details.append({
                        "room_name": f"Phòng {room.room_number}",
                        "item": "Phí dịch vụ",
                        "amount": float(b_service)
                    })
                if b_cleaning > 0:
                    total_cleaning_revenue += b_cleaning
                    cleaning_revenue_details.append({
                        "room_name": f"Phòng {room.room_number}",
                        "amount": float(b_cleaning)
                    })
                if b_internet > 0:
                    total_internet_revenue += b_internet
                    internet_revenue_details.append({
                        "room_name": f"Phòng {room.room_number}",
                        "amount": float(b_internet)
                    })
                if b_additional > 0:
                    total_other_revenue += b_additional
                    reason = bill.additional_fee_reason or "Phát sinh khác"
                    other_revenue_details.append({
                        "room_name": f"Phòng {room.room_number}",
                        "item": reason,
                        "amount": float(b_additional)
                    })

        room_elec_kwh = Decimal(str(bill.electric_consumed)) if bill else Decimal("0") 
        room_water_consumed = Decimal(str(bill.water_consumed)) if bill else Decimal("0") 
        
        elec_cost = (room_elec_kwh / calc_elec_kwh) * calc_elec_bill
        water_cost = Decimal("0")
        if room.is_water_meter: 
            water_cost = (room_water_consumed / calc_water_cube) * calc_water_bill
        else:
            contract = db.query(Contract).filter(Contract.room_id == room.id, Contract.status == "active").first()
            if contract:
                r_tenants = Decimal(str(contract.num_tenants)) 
                water_cost = (r_tenants / Decimal(str(total_tenants_in_house))) * calc_water_bill

        allocated_house_elec_cost += elec_cost
        allocated_house_water_cost += water_cost
        total_utilities_cost += (elec_cost + water_cost)
        
        if elec_cost > 0 or water_cost > 0:
            util_details.append({
                "room_name": f"Phòng {room.room_number}",
                "electric_cost": float(elec_cost),
                "water_cost": float(water_cost)
            })

        incidents = db.query(Incident).filter(
            Incident.room_id == room.id,
            Incident.created_at >= start_date,
            Incident.created_at <= end_date,
            Incident.repair_cost.isnot(None) 
        ).all()

        for inc in incidents:
            r_cost = Decimal(str(inc.repair_cost)) 
            total_maintenance_cost += r_cost
            maint_details.append({
                "room_name": f"Phòng {room.room_number}",
                "description": inc.description, 
                "handler_info": inc.handler_info,
                "amount": float(r_cost)
            })        

        r_base_cost = Decimal(str(room.cost_price)) 
        total_base_cost += r_base_cost
        base_cost_details.append({
            "room_name": f"Phòng {room.room_number}",
            "amount": float(r_base_cost)
        })

        # --- PHÂN BỔ CHI PHÍ QUẢN LÝ & CHI PHÍ KHÁC ---
        if fee_per_room > 0:
            manager_details.append({
                "item": f"Phòng {room.room_number}",
                "amount": float(fee_per_room)
            })
            
        if other_fee_per_room > 0:
            other_details.append({
                "item": f"Phòng {room.room_number} ({hc_other_reason})",
                "amount": float(other_fee_per_room)
            })

    unallocated_elec = calc_elec_bill - allocated_house_elec_cost
    unallocated_water = calc_water_bill - allocated_house_water_cost
    
    if unallocated_elec > 0:
        util_details.append({
            "room_name": f"Hao hụt điện",
            "electric_cost": float(unallocated_elec),
            "water_cost": 0.0
        })
        total_utilities_cost += unallocated_elec
    
    if unallocated_water > 0:
        util_details.append({
            "room_name": f"Hao hụt nước",
            "electric_cost": 0.0,
            "water_cost": float(unallocated_water)
        })
        total_utilities_cost += unallocated_water

    total_cost = total_utilities_cost + total_maintenance_cost + total_base_cost + total_management_cost + hc_other
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
        utility_bill_input=UtilityBillInput(
            total_electric_kwh=ui_elec_kwh,
            total_electric_bill=ui_elec_bill,
            total_water_cube=ui_water_cube,
            total_water_bill=ui_water_bill,
        )
    )