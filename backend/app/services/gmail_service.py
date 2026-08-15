import os
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.send']

# Tự động lấy đường dẫn tuyệt đối của thư mục chứa file email.py này
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CREDENTIALS_PATH = os.path.join(BASE_DIR, 'credentials.json')
TOKEN_PATH = os.path.join(BASE_DIR, 'token.json')

def get_gmail_service():
    """Hàm xử lý xác thực và trả về Gmail API service"""
    creds = None
    
    # Kiểm tra xem token.json đã tồn tại ở cùng thư mục chưa
    if os.path.exists(TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)
        
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Mở trình duyệt để đăng nhập nếu chưa có token
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Lưu token lại vào file token.json
        with open(TOKEN_PATH, 'w') as token:
            token.write(creds.to_json())

    return build('gmail', 'v1', credentials=creds)

def send_bill_email(
    to_email: str,
    tenant_name: str,
    billing_month: str,
    total_amount: float,
    pdf_path: str,
) -> None:
    """Gửi email kèm PDF qua Gmail API"""

    service = get_gmail_service()

    # --- Tạo email ---
    msg = MIMEMultipart()
    msg["To"] = to_email
    msg["Subject"] = f"Hoá đơn tiền phòng tháng {billing_month}"

    body_html = f"""
    <html><body>
    <p>Xin chào <strong>{tenant_name}</strong>,</p>
    <p>Vui lòng xem hoá đơn tiền phòng tháng <strong>{billing_month}</strong> đính kèm trong email này.</p>
    <p>Tổng số tiền phải thanh toán: <strong>{"{:,.0f}".format(total_amount)} đồng</strong></p>
    <p>Nếu có thắc mắc, vui lòng liên hệ chủ trọ.<br>Trân trọng.</p>
    </body></html>
    """
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    # --- Đính kèm file PDF ---
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

    # Gmail API yêu cầu encode toàn bộ tin nhắn sang định dạng base64url
    raw_message = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    
    # --- Thực hiện gửi ---
    try:
        service.users().messages().send(userId="me", body={'raw': raw_message}).execute()
    except Exception as e:
        raise RuntimeError(f"Gửi email qua Gmail API thất bại: {str(e)}")

# Đoạn code này chỉ chạy khi bạn thực thi trực tiếp file email.py
if __name__ == "__main__":
    print("Đang khởi tạo trình duyệt để xác thực Gmail API...")
    get_gmail_service()
    print("Xác thực thành công! File token.json đã được tạo thành công.")