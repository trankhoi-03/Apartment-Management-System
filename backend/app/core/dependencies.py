from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.houses import House

# HTTPBearer tự động đọc token từ header "Authorization: Bearer <token>"
# và hiển thị đúng ô paste token trực tiếp trên Swagger UI
http_bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Dependency inject vào bất kỳ endpoint nào cần đăng nhập.
    Đọc JWT từ Authorization header → decode → trả về User object.
    Tự động raise 401 nếu token sai, hết hạn, hoặc user không tồn tại."""

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user


def require_owner(current_user: User = Depends(get_current_user)):
    """Dependency chỉ cho phép role 'owner' đi qua."""
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện hành động này. Chỉ dành cho Admin."
        )
    return current_user


def verify_house_access(
    house_id: int, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
) -> House:
    """Kiểm tra quyền truy cập vào 1 nhà trọ cụ thể"""
    house = db.query(House).filter(House.id == house_id).first()
    if not house:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhà trọ")
    
    if current_user not in house.managers:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Bạn không có quyền truy cập vào dữ liệu của nhà trọ này."
        )
    return house