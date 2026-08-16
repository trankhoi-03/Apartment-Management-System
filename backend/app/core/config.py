from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 giờ
 

    GMAIL_SENDER: str = ""
    GMAIL_APP_PASSWORD: str = ""
    GMAIL_SENDER_NAME: str = "Quản lý phòng trọ"

    class Config:
        env_file = ".env",
        extra="ignore"


settings = Settings()