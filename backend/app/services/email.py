import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from app.core.config import settings


def send_bill_email(
    to_email: str,
    tenant_name: str,
    billing_month: str,
    total_amount: float,
    pdf_path: str,
) -> None:
    """Gửi email kèm PDF bill đến người thuê qua Gmail SMTP"""

    if not settings.GMAIL_SENDER or not settings.GMAIL_APP_PASSWORD:
        raise ValueError(
            "Chưa cấu hình Gmail SMTP. "
            "Hãy set GMAIL_SENDER và GMAIL_APP_PASSWORD trong file .env"
        )

    # --- Tạo email ---
    msg = MIMEMultipart()
    msg["From"] = f"{settings.GMAIL_SENDER_NAME} <{settings.GMAIL_SENDER}>"
    msg["To"] = to_email
    msg["Subject"] = f"Hoá đơn tiền phòng tháng {billing_month}"

    body_html = f"""
    <html><body>
    <p>Xin chào <strong>{tenant_name}</strong>,</p>
    <p>
        Vui lòng xem hoá đơn tiền phòng tháng <strong>{billing_month}</strong>
        đính kèm trong email này.
    </p>
    <p>
        Tổng số tiền phải thanh toán:
        <strong>{"{:,.0f}".format(total_amount)} đồng</strong>
    </p>
    <p>
        Nếu có thắc mắc, vui lòng liên hệ chủ trọ.<br>
        Trân trọng.
    </p>
    </body></html>
    """
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    # Đính kèm file PDF 
    with open(pdf_path, "rb") as f:
        attachment = MIMEBase("application", "octet-stream")
        attachment.set_payload(f.read())

    encoders.encode_base64(attachment)
    pdf_filename = f"hoa-don-{billing_month}.pdf"
    attachment.add_header(
        "Content-Disposition",
        f'attachment; filename="{pdf_filename}"',
    )
    msg.attach(attachment)

    # Gửi qua Gmail SMTP 
    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.GMAIL_SENDER, settings.GMAIL_APP_PASSWORD)
        server.sendmail(
            settings.GMAIL_SENDER,
            to_email,
            msg.as_string(),
        )