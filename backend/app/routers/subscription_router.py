from datetime import datetime, timedelta
import os
from fastapi import APIRouter, Depends, HTTPException, Request
from payos import PayOS
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.dependencies import require_owner
from app.models.user import User

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# payos = PayOS(
#     client_id=os.getenv("PAYOS_CLIENT_ID", "your_client_id"),
#     api_key=os.getenv("PAYOS_API_KEY", "your_api_key"),
#     checksum_key=os.getenv("PAYOS_CHECKSUM_KEY", "your_checksum_key")
# )

PLANS = {
    "premium_monthly": {"name": "Gói Premium (1 Tháng)", "price": 99000, "days": 30},
    "premium_yearly": {"name": "Gói Premium (1 Năm)", "price": 990000, "days": 365},
}

@router.get("/status")
def get_subscription_status(current_user: User = Depends(require_owner)):
    """Kiểm tra tình trạng gói, ngày hết hạn và cần gia hạn hay không"""
    now = datetime.now(datetime.timezone.utc)
    is_active = (
        current_user.subscription_plan != "free" 
        and current_user.subscription_expires_at is not None 
        and current_user.subscription_expires_at > now
    )
    days_left = (current_user.subscription_expires_at - now).days if is_active else 0
    needs_renewal = is_active and (days_left <= 5)  # Báo gia hạn trước 5 ngày

    return {
        "plan": current_user.subscription_plan,
        "expires_at": current_user.subscription_expires_at,
        "is_active": is_active,
        "days_left": max(0, days_left),
        "needs_renewal": needs_renewal or not is_active
    }

@router.post("/checkout")
def create_checkout(plan_key: str, current_user: User = Depends(require_owner)):
    """Tạo link thanh toán để điều hướng người dùng"""
    if plan_key not in PLANS:
        raise HTTPException(status_code=400, detail="Gói cước không hợp lệ")

    plan = PLANS[plan_key]
    
    # Tích hợp PayOS hoặc Stripe để tạo payment URL
    # Giả lập trả về redirect link thanh toán:
    payment_url = f"https://your-payment-gateway.com/pay?amount={plan['price']}&user_id={current_user.id}&plan={plan_key}"
    
    return {"checkout_url": payment_url}

@router.post("/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """Nhận webhook từ cổng thanh toán sau khi người dùng chuyển khoản xong"""
    data = await request.json()
    # Xác thực signature từ cổng thanh toán...
    user_id = data.get("user_id")
    plan_key = data.get("plan_key")

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        plan_days = PLANS[plan_key]["days"]
        now = datetime.now(datetime.timezone.utc)
        # Nếu đang còn hạn thì cộng dồn tiếp, nếu đã hết hạn thì tính từ hiện tại
        start_from = user.subscription_expires_at if (user.subscription_expires_at and user.subscription_expires_at > now) else now
        user.subscription_expires_at = start_from + timedelta(days=plan_days)
        user.subscription_plan = plan_key
        db.commit()

    return {"status": "success"}