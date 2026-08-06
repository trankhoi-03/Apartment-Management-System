import os
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

    html_content = template.render(
        billing_month=bill.billing_month,
        room_number=contract.room.room_number,
        tenant_name=contract.tenant.full_name,
        tenant_phone=contract.tenant.phone,
        rent_amount=float(bill.rent_amount),
        electric_amount=float(bill.electric_amount),
        electric_consumed=float(bill.electric_consumed),
        water_amount=float(bill.water_amount),
        water_consumed=float(bill.water_consumed),
        service_fee=float(bill.service_fee),
        total_amount=float(bill.total_amount),
    )

    filename = f"bill_{bill.id}_{bill.billing_month}.pdf"
    output_path = os.path.abspath(os.path.join(PDF_OUTPUT_DIR, filename))

    HTML(string=html_content).write_pdf(output_path)

    return output_path