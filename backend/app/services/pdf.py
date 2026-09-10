import os
import calendar
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.models.bill import Bill
from app.models.contract import Contract

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
PDF_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "storage", "bills")

os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

_jinja_env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))


def generate_bill_pdf(bill: Bill, contract: Contract) -> str:

    template = _jinja_env.get_template("bill_template.html")

    # 1. Format lại tháng từ YYYY-MM sang MM/YYYY
    year_str, month_str = bill.billing_month.split('-')
    formatted_month = f"{month_str}/{year_str}"

    # 2. Tính toán hạn thanh toán an toàn
    payment_day = contract.payment_day
    year, month = int(year_str), int(month_str)
    last_day_of_month = calendar.monthrange(year, month)[1]
    
    actual_day = payment_day if payment_day <= last_day_of_month else last_day_of_month
    due_date = f"{actual_day:02d}/{month:02d}/{year}"

    # 3. Truyền dữ liệu vào template
    html_content = template.render(
        formatted_month=formatted_month,
        due_date=due_date,
        payment_day=payment_day,
        house_name=contract.room.house.name, 
        room_number=contract.room.room_number,
        tenant_name=contract.tenant.full_name,
        tenant_phone=contract.tenant.phone,
        rent_amount=float(bill.rent_amount),
        electric_amount=float(bill.electric_amount),
        electric_consumed=float(bill.electric_consumed),
        water_amount=float(bill.water_amount),
        water_consumed=float(bill.water_consumed),
        service_fee=float(bill.service_fee),
        additional_fee=float(bill.additional_fee) if bill.additional_fee else 0.0,
        additional_fee_reason=bill.additional_fee_reason,
        total_amount=float(bill.total_amount),
    )

    filename = f"bill_{bill.id}_{bill.billing_month}.pdf"
    output_path = os.path.abspath(os.path.join(PDF_OUTPUT_DIR, filename))

    HTML(string=html_content).write_pdf(output_path)

    return output_path