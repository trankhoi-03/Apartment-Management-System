from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from cryptography.fernet import Fernet

from app.core.config import settings


fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def hash_password(plain_password: str) -> str:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        raise ValueError("Mật khẩu không được vượt quá 72 byte UTF-8.")
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    password_bytes = plain_password.encode("utf-8")
    if len(password_bytes) > 72:
        return False
    try:
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except ValueError:
        return False


def encrypt_cccd(plain_cccd: str) -> str:
    return fernet.encrypt(plain_cccd.encode("utf-8")).decode("utf-8")


def decrypt_cccd(encrypted_cccd: str) -> str:
    return fernet.decrypt(encrypted_cccd.encode("utf-8")).decode("utf-8")


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except (JWTError, ValueError, TypeError):
        return None
