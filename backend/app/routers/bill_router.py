import calendar
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.contract import Contract
from app.models.utility_reading import UtilityReading
from app.models.utility_rate import UtilityRate
from app.models.bill import Bill
from app.schemas.bill_schema import BillGenerateRequest, BillUpdate, BillResponse, BillEditRequest
from app.services.pdf import generate_bill_pdf
from app.services.email import send_bill_email
from app.models.room import Room

router = APIRouter(prefix="/bills", tags=["bills"])


def _billing_month_to_last_date(billing_month: str) -> date:
    year, month = billing_month.split("-")
    year, month = int(year), int(month)
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, last_day)


@router.post("/generate", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def generate_bill(payload: BillGenerateRequest, db: Session = Depends(get_db)):

    # Bước 1: Lấy Contract, kiểm tra active
    contract = db.query(Contract).filter(Contract.id == payload.contract_id).first()
    if contract is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy hợp đồng có id={payload.contract_id}",
        )
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

    # Bước 3: Lấy UtilityRate đúng thời điểm (point-in-time lookup) ---
    billing_month_end = _billing_month_to_last_date(payload.billing_month)
    rate = (
        db.query(UtilityRate)
        .filter(
            UtilityRate.room_id == contract.room_id,
            # Dùng ngày cuối tháng làm chốt chặn
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
    
    # Lấy room để check is_water_meter
    room = contract.room

    electric_consumed = Decimal(str(reading.electric_new)) - Decimal(str(reading.electric_old))
    electric_amount = electric_consumed * rate.electric_price

    if room.is_water_meter:
        # Có đồng hồ nước -> tính theo số đọc thực tế
        water_consumed = Decimal(str(reading.water_new)) - Decimal(str(reading.water_old))
        water_amount = water_consumed * rate.water_price
    else:
        # Không có đồng hồ nước -> dùng giá cố định
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

    rent_amount = contract.monthly_rent
    total_amount = rent_amount + electric_amount + water_amount + Decimal(str(payload.service_fee)) + Decimal(str(payload.additional_fee))

    # Bước 5: Insert Bill 
    new_bill = Bill(
        contract_id=payload.contract_id,
        billing_month=payload.billing_month,
        rent_amount=rent_amount,
        electric_amount=electric_amount,
        water_amount=water_amount,
        service_fee=payload.service_fee,
        additional_fee=payload.additional_fee,
        additional_fee_reason=payload.additional_fee_reason,
        total_amount=total_amount,
        electric_consumed=float(electric_consumed),
        water_consumed=float(water_consumed),
        status="pending",
    )
    db.add(new_bill)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Hợp đồng id={payload.contract_id} đã có bill "
                f"cho tháng {payload.billing_month}"
            ),
        )
    db.refresh(new_bill)
    return new_bill


@router.get("", response_model=list[BillResponse])
def list_bills(contract_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Bill)
    if contract_id is not None:
        query = query.filter(Bill.contract_id == contract_id)
    return query.order_by(Bill.billing_month.desc()).all()


@router.get("/{bill_id}", response_model=BillResponse)
def get_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )
    return bill


@router.patch("/{bill_id}", response_model=BillResponse)
def update_bill_status(bill_id: int, payload: BillUpdate, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bill, field, value)

    db.commit()
    db.refresh(bill)
    return bill


@router.patch("/{bill_id}/edit", response_model=BillResponse)
def edit_bill_calculations(bill_id: int, payload: BillEditRequest, db: Session = Depends(get_db)):
    # 1. Tìm Bill và kiểm tra trạng thái
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bill id={bill_id}")
    
    if bill.status != "pending":
        raise HTTPException(
            status_code=422,
            detail=f"Hóa đơn đang ở trạng thái '{bill.status}', không thể sửa."
        )

    contract = db.query(Contract).filter(Contract.id == bill.contract_id).first()
    room = contract.room

    # 2. Tìm UtilityReading của tháng đó để sửa
    reading = db.query(UtilityReading).filter(
        UtilityReading.room_id == contract.room_id,
        UtilityReading.billing_month == bill.billing_month
    ).first()
    
    if not reading:
        raise HTTPException(status_code=404, detail="Không tìm thấy số điện nước gốc của bill này.")

    # 3. Lấy lại đơn giá (UtilityRate)
    billing_month_end = _billing_month_to_last_date(bill.billing_month)
    rate = db.query(UtilityRate).filter(
        UtilityRate.room_id == contract.room_id,
        UtilityRate.effective_from <= billing_month_end
    ).order_by(UtilityRate.effective_from.desc(), UtilityRate.id.desc()).first()

    # 4. Tính toán lại y hệt hàm generate_bill
    electric_consumed = Decimal(str(payload.electric_new)) - Decimal(str(reading.electric_old))
    if electric_consumed < 0:
        raise HTTPException(status_code=400, detail="Số điện mới không được nhỏ hơn số điện cũ.")
    electric_amount = electric_consumed * rate.electric_price

    if room.is_water_meter:
        water_consumed = Decimal(str(payload.water_new)) - Decimal(str(reading.water_old))
        if water_consumed < 0:
            raise HTTPException(status_code=400, detail="Số nước mới không được nhỏ hơn số nước cũ.")
        water_amount = water_consumed * rate.water_price
    else:
        water_consumed = Decimal("0")
        water_amount = Decimal(str(rate.default_water_amount))

    total_amount = bill.rent_amount + electric_amount + water_amount + Decimal(str(payload.service_fee)) + Decimal(str(payload.additional_fee))

    # 5. Cập nhật UtilityReading
    reading.electric_new = payload.electric_new
    if room.is_water_meter:
        reading.water_new = payload.water_new

    # 6. Cập nhật Bill
    bill.electric_consumed = float(electric_consumed)
    bill.water_consumed = float(water_consumed)
    bill.electric_amount = electric_amount
    bill.water_amount = water_amount
    bill.service_fee = payload.service_fee
    bill.additional_fee = payload.additional_fee
    bill.additional_fee_reason = payload.additional_fee_reason  
    bill.total_amount = total_amount

    # 7. Commit cả 2 thay đổi
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu dữ liệu: {str(e)}")

    db.refresh(bill)
    return bill

@router.post("/{bill_id}/send", response_model=BillResponse)
def send_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = (
        db.query(Bill)
        .options(
            joinedload(Bill.contract)
            .joinedload(Contract.room),
            joinedload(Bill.contract)
            .joinedload(Contract.tenant),
        )
        .filter(Bill.id == bill_id)
        .first()
    )
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )
    if bill.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Bill này đang ở trạng thái '{bill.status}', "
                "chỉ gửi được bill ở trạng thái 'pending'."
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

    # Gửi email
    try:
        send_bill_email(
            to_email=tenant.email,
            tenant_name=tenant.full_name,
            billing_month=bill.billing_month,
            total_amount=float(bill.total_amount),
            pdf_path=pdf_path,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sinh PDF thành công nhưng gửi email thất bại: {str(e)}",
        )

    # Cập nhật bill sau khi gửi thành công
    bill.pdf_url = pdf_path
    bill.status = "sent"
    db.commit()
    db.refresh(bill)
    return bill


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    if bill is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy bill có id={bill_id}",
        )

    db.delete(bill)
    db.commit()
    return None