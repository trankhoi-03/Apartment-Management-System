from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# --- Password ---

def hash_password(plain_password: str) -> str:
    """Hash password bằng bcrypt trực tiếp (không qua passlib).
    bcrypt.gensalt() tự tạo salt ngẫu nhiên mỗi lần → cùng password
    cho ra hash khác nhau, không thể dùng rainbow table để crack."""
    password_bytes = plain_password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """So sánh plain text password với bcrypt hash đã lưu trong DB."""
    password_bytes = plain_password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


# --- JWT ---

def create_access_token(user_id: int) -> str:
    """Tạo JWT token chứa user_id, hết hạn sau ACCESS_TOKEN_EXPIRE_MINUTES."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),   # "sub" (subject) là claim chuẩn của JWT spec
        "exp": expire,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Decode JWT token, trả về user_id nếu hợp lệ, None nếu sai/hết hạn.
    JWTError bao gồm: token sai chữ ký, token hết hạn, format không hợp lệ."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None