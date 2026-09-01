import os
import shutil
import base64
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.send']

RENDER_CREDENTIALS = "/etc/secrets/credentials.json"
RENDER_TOKEN = "/etc/secrets/token.json"
WRITABLE_RENDER_TOKEN = "/tmp/token.json"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_CREDENTIALS = os.path.join(BASE_DIR, 'credentials.json')
LOCAL_TOKEN = os.path.join(BASE_DIR, 'token.json')

CREDENTIALS_PATH = RENDER_CREDENTIALS if os.path.exists(RENDER_CREDENTIALS) else LOCAL_CREDENTIALS

if os.path.exists(RENDER_TOKEN):
    if not os.path.exists(WRITABLE_RENDER_TOKEN):
        os.makedirs(os.path.dirname(WRITABLE_RENDER_TOKEN), exist_ok=True)
        shutil.copyfile(RENDER_TOKEN, WRITABLE_RENDER_TOKEN)
    TOKEN_PATH = WRITABLE_RENDER_TOKEN
else:
    TOKEN_PATH = LOCAL_TOKEN

def get_gmail_service():
    """Hàm xử lý xác thực và trả về Gmail API service"""
    creds = None
    
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
            
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)

def send_bill_email(
    to_email: str,
    tenant_name: str,
    billing_month: str,
    total_amount: float,
    pdf_path: str,
    due_date: Optional[str] = None
) -> None:
    """Gửi email kèm PDF và thông báo hạn thanh toán qua Gmail API"""

    service = get_gmail_service()

    if not due_date:
        calculated_date = datetime.now() + timedelta(days=5)
        due_date = calculated_date.strftime("%d/%m/%Y")

    # Tạo email 
    msg = MIMEMultipart()
    msg["To"] = to_email
    msg["Subject"] = f"[Thông Báo] Hoá đơn tiền phòng tháng {billing_month} - Hạn đóng {due_date}"

    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #2563eb; margin-bottom: 8px;">Thông báo hoá đơn tiền phòng</h2>
      <p>Xin chào <strong>{tenant_name}</strong>,</p>
      <p>Hệ thống gửi đến bạn hoá đơn tiền phòng tháng <strong>{billing_month}</strong>.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 20px 0;">
        <p style="margin: 6px 0; font-size: 15px;">
          💰 Tổng số tiền thanh toán: 
          <strong style="color: #2563eb; font-size: 17px;">{"{:,.0f}".format(total_amount)} VNĐ</strong>
        </p>
        <p style="margin: 6px 0; font-size: 15px; color: #dc2626;">
          ⏰ Hạn thanh toán: 
          <strong>{due_date}</strong> (trong vòng 5 ngày kể từ ngày xuất bill)
        </p>
      </div>

      <p>Chi tiết các khoản tiền (tiền phòng, điện, nước, dịch vụ) đã được đính kèm trong file PDF bên dưới.</p>
      <p style="color: #64748b; font-size: 13px; margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Nếu có bất kỳ thắc mắc hoặc sai sót nào về chỉ số điện/nước, vui lòng phản hồi lại chủ trọ trước thời hạn nêu trên.<br>
        <em>Trân trọng!</em>
      </p>
    </body>
    </html>
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

    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    
    # Thực hiện gửi 
    try:
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
    except Exception as e:
        raise RuntimeError(f"Gửi email qua Gmail API thất bại: {str(e)}")

if __name__ == "__main__":
    print("Đang khởi tạo trình duyệt để xác thực Gmail API...")
    get_gmail_service()
    print("Xác thực thành công! File token.json đã được tạo thành công.")