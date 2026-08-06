from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings


engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency cho FastAPI: tạo 1 session mới cho mỗi request,
    đảm bảo session luôn được đóng lại sau khi request xử lý xong
    (dù thành công hay có lỗi xảy ra) - tránh leak connection."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
