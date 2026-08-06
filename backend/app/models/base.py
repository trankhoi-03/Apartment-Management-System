from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class cho tất cả models. Mọi model sẽ kế thừa từ class này."""
    pass