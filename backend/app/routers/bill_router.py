import calendar
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.dependencies import require_owner, get_current_user, verify_house_access, verify_house_owner
from app.models.contract import Contract
from app.models.utility_reading import UtilityReading
from app.models.utility_rate import UtilityRate
from app.models.bill import Bill
from app.models.room import Room
from app.models.user import User
from app.schemas.bill_schema import BillGenerateRequest, BillUpdate, BillResponse, BillEditRequest
from app.services.pdf import generate_bill_pdf
from app.services.gmail_service import send_bill_email

router = APIRouter(prefix="/bills", tags=["bills"])


def _check_contract_access(db: Session, contract: Contract, user: User, owner_only: bool = False) -> None:
    if contract is None or contract.room_id is None:
        raise HTTPException(status_code=409, detail="Không xác định được phòng của hợp đồng.")
    room = db.query(Room).filter(Room.id == contract.room_id).first()
    if room is None:
        raise HTTPException(status_code=409, detail="Không xác định được nhà của hợp đồng.")
    checker = verify_house_owner if owner_only else verify_house_access
    checker(house_id=room.house_id, db=db, current_user=user)


def _check_bill_access(db: Session, bill: Bill, user: User, owner_only: bool = False) -> None:
    contract = db.query(Contract).filter(Contract.id == bill.contract_id).first()
    _check_contract_access(db, contract, user, owner_only=owner_only)



def _billing_month_to_last_date(billing_month: str) -> date:
    year, month = billing_month.split("-")
    year, month = int(year), int(month)
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, last_day)


@router.post("/generate", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def generate_bill(payload: BillGenerateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    # Bước 1: Lấy Contract, kiểm tra active
    contract = db.query(Contract).filter(Contract.id == payload.contract_id).first()
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng có id={payload.contract_id}",
        )
    _check_contract_access(db, contract, current_user)
    if contract.status != "active":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Hợp đồng id={payload.contract_id} đang ở trạng thái "
                f"'{contract.status}', không phải 'active'. Không thể xuất bill."
            ),
        )

    # Bước 2: Lấy UtilityReading đúng tháng 
    reading = (
        db.query(UtilityReading)
        .filter(
            UtilityReading.room_id == contract.room_id,
            UtilityReading.billing_month == payload.billing_month,
        )
        .first()
    )
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Chưa có số điện/nước cho phòng id={contract.room_id} "
                f"tháng {payload.billing_month}. Hãy nhập số điện/nước trước."
            ),
        )

    # Bước 3: Lấy UtilityRate đúng thời điểm (point-in-time lookup)
    billing_month_end = _billing_month_to_last_date(payload.billing_month)
    rate = (
        db.query(UtilityRate)
        .filter(
            UtilityRate.room_id == contract.room_id,
            UtilityRate.effective_from <= billing_month_end,
        )
        .order_by(UtilityRate.effective_from.desc(), UtilityRate.id.desc())
        .first()
    )
    if rate is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Chưa có đơn giá điện/nước áp dụng cho phòng id={contract.room_id} "
                f"tại thời điểm tháng {payload.billing_month}. "
                "Hãy khai báo đơn giá trước."
            ),
        )

    # Bước 4: Tính toán 
    room = contract.room
    electric_consumed = Decimal(str(reading.electric_new)) - Decimal(str(reading.electric_old))
    if electric_consumed < 0:
        raise HTTPException(status_code=400, detail="Chỉ số điện mới không thể nhỏ hơn chỉ số cũ.")

    if payload.electric_calc_method == "split_ratio":
        # Validate dữ liệu đầu vào cho cách 2
        if not payload.electric_total_consumed or payload.electric_total_consumed <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tổng số kWh của hóa đơn tổng phải lớn hơn 0 khi chọn cách tính chia tỉ lệ."
            )
        if payload.electric_total_cost is None or payload.electric_total_cost < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Tổng số tiền của hóa đơn tổng không hợp lệ."
            )

        total_consumed = Decimal(str(payload.electric_total_consumed))
        total_cost = Decimal(str(payload.electric_total_cost))
        
        # Công thức cách 2: (số điện phòng / số điện tổng) * tổng tiền
        electric_amount = round((electric_consumed / total_consumed) * total_cost, 2)
    else:
        # Cách 1: Cố định theo đơn giá
        electric_amount = electric_consumed * rate.electric_price

    if room.is_water_meter:
        water_consumed = Decimal(str(reading.water_new)) - Decimal(str(reading.water_old))
        water_amount = water_consumed * rate.water_price
    else:
        if rate.default_water_amount is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Phòng id={contract.room_id} không có đồng hồ nước nhưng "
                    f"UtilityRate id={rate.id} chưa có default_water_amount. "
                    "Hãy cập nhật đơn giá trước."
                ),
            )
        water_consumed = Decimal("0")
        water_amount = Decimal(str(rate.default_water_amount))

    # Ưu tiên lấy rent_amount từ payload nếu có
    if payload.rent_amount is not None:
        rent_amount = Decimal(str(payload.rent_amount))
    else:
        rent_amount = contract.monthly_rent
    
    total_amount = (
        rent_amount 
        - Decimal(str(payload.discount_amount))
        + electric_amount 
        + water_amount 
        + Decimal(str(payload.service_fee)) 
        + Decimal(str(payload.cleaning_fee)) 
        + Decimal(str(payload.internet_fee)) 
        + Decimal(str(payload.additional_fee))
    )

    if total_amount < 0:
        total_amount = Decimal("0")

    # Bước 5: Insert Bill 
    new_bill = Bill(
        contract_id=payload.contract_id,
        billing_month=payload.billing_month,
        due_date=payload.due_date,
        rent_amount=rent_amount,
        discount_amount=payload.discount_amount,
        discount_reason=payload.discount_reason,
        electric_amount=electric_amount,
        water_amount=water_amount,
        service_fee=payload.service_fee,
        cleaning_fee=payload.cleaning_fee,
        internet_fee=payload.internet_fee, 
        additional_fee=payload.additional_fee,
        additional_fee_reason=payload.additional_fee_reason,
        total_amount=total_amount,
        electric_unit_price=rate.electric_price if payload.electric_calc_method == "fixed_price" else None,
        water_unit_price=rate.water_price if room.is_water_meter else None,
        electric_consumed=float(electric_consumed),
        water_consumed=float(water_consumed),
        status="pending",
        electric_calc_method=payload.electric_calc_method,
        electric_total_consumed=payload.electric_total_consumed if payload.electric_calc_method == "split_ratio" else None,
        electric_total_cost=payload.electric_total_cost if payload.electric_calc_method == "split_ratio" else None,
    )
    db.add(new_bill)
    db.commit()
    db.refresh(new_bill)
    return new_bill


@router.get("", response_model=list[BillResponse])
def list_bills(
    contract_id: int | None = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    allowed_house_ids = [h.id for h in current_user.managed_houses]
    if not allowed_house_ids:
        return []

    query = db.query(Bill).join(Contract).join(Room).filter(Room.house_id.in_(allowed_house_ids))
    
    if contract_id is not None:
        query = query.filter(Bill.contract_id == contract_id)
        
    return query.order_by(Bill.billing_month.desc()).all()


@router.get("/{bill_id}", response_model=BillResponse)
def get_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )
    _check_bill_access(db, bill, current_user)
    return bill


@router.patch("/{bill_id}", response_model=BillResponse)
def update_bill_status(bill_id: int, payload: BillUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )

    _check_bill_access(db, bill, current_user, owner_only=True)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bill, field, value)

    db.commit()
    db.refresh(bill)
    return bill


@router.get("/{bill_id}/utility-reading")
def get_bill_utility_reading(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Không tìm thấy bill.")
    
    _check_bill_access(db, bill, current_user)
    contract = db.query(Contract).filter(Contract.id == bill.contract_id).first()
    
    reading = db.query(UtilityReading).filter(
        UtilityReading.room_id == contract.room_id,
        UtilityReading.billing_month == bill.billing_month
    ).first()
    
    if not reading:
        return {"electric_new": 0, "water_new": 0}
        
    return {
        "electric_new": reading.electric_new,
        "water_new": reading.water_new
    }


@router.patch("/{bill_id}/edit", response_model=BillResponse)
def edit_bill_calculations(bill_id: int, payload: BillEditRequest, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bill id={bill_id}")
    _check_bill_access(db, bill, current_user, owner_only=True)
    if bill.status not in ("pending", "sent", "paid"):
        raise HTTPException(status_code=422, detail=f"Hóa đơn đang ở trạng thái '{bill.status}', không thể sửa.")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return bill  # PATCH {} là no-op, không tính lại hóa đơn.

    contract = db.query(Contract).filter(Contract.id == bill.contract_id).first()
    room = contract.room
    reading = db.query(UtilityReading).filter(
        UtilityReading.room_id == contract.room_id,
        UtilityReading.billing_month == bill.billing_month,
    ).first()
    if reading is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy số điện nước gốc của bill này.")

    def dec(value):
        return Decimal(str(value))

    def changed(field, existing):
        value = changes.get(field)
        return field in changes and value is not None and dec(value) != dec(existing)

    month = changes.get("billing_month")
    month_changed = month is not None and month != bill.billing_month
    if month_changed:
        if not isinstance(month, str) or len(month) != 7 or month[4] != "-" or not month[:4].isdigit() or not month[5:].isdigit() or not 1 <= int(month[5:]) <= 12:
            raise HTTPException(status_code=422, detail="Tháng hóa đơn không hợp lệ (YYYY-MM).")
        conflicts = db.query(UtilityReading).filter(
            UtilityReading.room_id == contract.room_id,
            UtilityReading.billing_month == month,
        ).first()
        if conflicts:
            raise HTTPException(status_code=409, detail=f"Phòng đã có chốt điện nước cho tháng {month}.")
        # Không di chuyển reading nếu còn bill khác sử dụng cùng reading.
        shared = db.query(Bill).join(Contract, Bill.contract_id == Contract.id).filter(
            Bill.id != bill.id, Contract.room_id == contract.room_id,
            Bill.billing_month == bill.billing_month,
        ).first()
        if shared:
            raise HTTPException(status_code=409, detail="Không thể đổi tháng: số điện nước đang được hóa đơn khác sử dụng.")

    calc_method = changes.get("electric_calc_method") or bill.electric_calc_method or "fixed_price"
    if calc_method not in ("fixed_price", "split_ratio"):
        raise HTTPException(status_code=422, detail="Phương thức tính tiền điện không hợp lệ.")

    electric_new = changes.get("electric_new")
    electric_new = reading.electric_new if electric_new is None else electric_new
    water_new = changes.get("water_new")
    water_new = reading.water_new if water_new is None else water_new
    if dec(electric_new) < dec(reading.electric_old):
        raise HTTPException(status_code=400, detail="Số điện mới không được nhỏ hơn số điện cũ.")
    if room.is_water_meter and dec(water_new) < dec(reading.water_old):
        raise HTTPException(status_code=400, detail="Số nước mới không được nhỏ hơn số nước cũ.")

    method_changed = calc_method != bill.electric_calc_method
    electric_changed = (
        changed("electric_new", reading.electric_new) or method_changed or
        (calc_method == "split_ratio" and (
            (changes.get("electric_total_consumed") is not None and dec(changes["electric_total_consumed"]) != dec(bill.electric_total_consumed or 0)) or
            (changes.get("electric_total_cost") is not None and dec(changes["electric_total_cost"]) != dec(bill.electric_total_cost or 0))
        )) or (bill.electric_unit_price is None and changes.get("electric_unit_price") is not None and calc_method == "fixed_price")
    )
    water_changed = (
        (room.is_water_meter and (changed("water_new", reading.water_new) or (bill.water_unit_price is None and changes.get("water_unit_price") is not None)))
        or (not room.is_water_meter and changed("default_water_amount", bill.water_amount))
    )

    # Giá snapshot là bất biến sau khi chốt (kể cả nếu không tính lại).
    if bill.electric_unit_price is not None and changes.get("electric_unit_price") is not None and dec(changes["electric_unit_price"]) != dec(bill.electric_unit_price):
        raise HTTPException(status_code=409, detail="Hóa đơn đã chốt đơn giá điện.")
    if bill.water_unit_price is not None and changes.get("water_unit_price") is not None and dec(changes["water_unit_price"]) != dec(bill.water_unit_price):
        raise HTTPException(status_code=409, detail="Hóa đơn đã chốt đơn giá nước.")

    electric_amount = dec(bill.electric_amount)
    electric_consumed = dec(bill.electric_consumed)
    water_amount = dec(bill.water_amount)
    water_consumed = dec(bill.water_consumed)

    if electric_changed:
        electric_consumed = dec(electric_new) - dec(reading.electric_old)
        if calc_method == "split_ratio":
            tot_kwh = changes.get("electric_total_consumed")
            tot_cost = changes.get("electric_total_cost")
            tot_kwh = bill.electric_total_consumed if tot_kwh is None else tot_kwh
            tot_cost = bill.electric_total_cost if tot_cost is None else tot_cost
            if tot_kwh is None or dec(tot_kwh) <= 0 or tot_cost is None or dec(tot_cost) < 0:
                raise HTTPException(status_code=422, detail="Tổng điện và tổng tiền của bill tổng không hợp lệ.")
            electric_amount = round(electric_consumed / dec(tot_kwh) * dec(tot_cost), 2)
            bill.electric_total_consumed = float(tot_kwh)
            bill.electric_total_cost = dec(tot_cost)
        else:
            if bill.electric_unit_price is None:
                price = changes.get("electric_unit_price")
                if price is None:
                    raise HTTPException(status_code=422, detail="Bill cũ chưa lưu đơn giá điện; hãy xác nhận đơn giá.")
                bill.electric_unit_price = dec(price)
            electric_amount = electric_consumed * dec(bill.electric_unit_price)
            bill.electric_total_consumed = None
            bill.electric_total_cost = None
        bill.electric_calc_method = calc_method
        reading.electric_new = float(electric_new)
        bill.electric_consumed = float(electric_consumed)
        bill.electric_amount = electric_amount

    if water_changed:
        if room.is_water_meter:
            water_consumed = dec(water_new) - dec(reading.water_old)
            if bill.water_unit_price is None:
                price = changes.get("water_unit_price")
                if price is None:
                    raise HTTPException(status_code=422, detail="Bill cũ chưa lưu đơn giá nước; hãy xác nhận đơn giá.")
                bill.water_unit_price = dec(price)
            water_amount = water_consumed * dec(bill.water_unit_price)
            reading.water_new = float(water_new)
        else:
            water_consumed = dec(0)
            water_amount = dec(changes["default_water_amount"])
        bill.water_consumed = float(water_consumed)
        bill.water_amount = water_amount

    numeric_fields = ("rent_amount", "service_fee", "cleaning_fee", "internet_fee", "additional_fee", "discount_amount")
    for name in numeric_fields:
        value = changes.get(name)
        if value is not None and dec(value) != dec(getattr(bill, name) or 0):
            setattr(bill, name, dec(value))
    for name in ("additional_fee_reason", "discount_reason", "due_date"):
        if name in changes and changes[name] != getattr(bill, name):
            setattr(bill, name, changes[name])

    if month_changed:
        reading.billing_month = month
        bill.billing_month = month

    # Tính lại tổng từ các thành phần lưu trên bill; không thay thế thành phần chưa sửa.
    new_total = (dec(bill.rent_amount) - dec(bill.discount_amount or 0) +
                 dec(bill.electric_amount) + dec(bill.water_amount) +
                 dec(bill.service_fee or 0) + dec(bill.cleaning_fee or 0) +
                 dec(bill.internet_fee or 0) + dec(bill.additional_fee or 0))
    new_total = max(dec(0), new_total)
    if new_total != dec(bill.total_amount):
        bill.total_amount = new_total

    try:
        if db.is_modified(bill) or db.is_modified(reading):
            db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu dữ liệu: {exc}")
    db.refresh(bill)
    return bill


@router.post("/{bill_id}/send", response_model=BillResponse)
def send_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bill = (
        db.query(Bill)
        .options(
            joinedload(Bill.contract).joinedload(Contract.room).joinedload(Room.house),
            joinedload(Bill.contract).joinedload(Contract.tenant),
        )
        .filter(Bill.id == bill_id)
        .first()
    )
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )
    _check_bill_access(db, bill, current_user)
    if bill.status not in ["pending", "sent", "paid"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Không thể gửi email cho bill ở trạng thái '{bill.status}'."
            ),
        )

    tenant = bill.contract.tenant
    if not tenant.email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Tenant '{tenant.full_name}' chưa có email. "
                "Cập nhật email tenant trước khi gửi bill."
            ),
        )

    # Sinh PDF
    try:
        pdf_path = generate_bill_pdf(bill=bill, contract=bill.contract)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi sinh PDF: {str(e)}",
        )

    # Định dạng hạn thanh toán để gửi vào email
    formatted_due_date = bill.due_date.strftime("%d/%m/%Y") if getattr(bill, "due_date", None) else None

    # Gửi email kèm thông tin phòng và nhà
    try:
        send_bill_email(
            to_email=tenant.email,
            tenant_name=tenant.full_name,
            billing_month=bill.billing_month,
            total_amount=float(bill.total_amount),
            pdf_path=pdf_path,
            room_number=bill.contract.room.room_number,
            house_name=bill.contract.room.house.name,
            due_date=formatted_due_date 
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sinh PDF thành công nhưng gửi email thất bại: {str(e)}",
        )

    # Cập nhật bill sau khi gửi thành công
    bill.pdf_url = pdf_path
    
    # Chỉ chuyển thành "sent" nếu hóa đơn là mới. Không làm mất trạng thái "paid" của khách.
    if bill.status == "pending":
        bill.status = "sent"
        
    db.commit()
    db.refresh(bill)
    return bill


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )

    _check_bill_access(db, bill, current_user, owner_only=True)
    db.delete(bill)
    db.commit()
    return None