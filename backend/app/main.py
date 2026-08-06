from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import room_router, tenant_router, contract_router, utility_router, utilityrate_router, bill_router, house_router, incident_router
from app.routers import auth
from app.core.dependencies import get_current_user


app = FastAPI(
    title="Apartment Management API",
    description="API quản lý phòng trọ cho gia đình",
    version="0.1.0"
)


app.include_router(auth.router)  

# Protected routes - tất cả endpoint đều yêu cầu JWT token hợp lệ
# dependencies=[Depends(get_current_user)] áp dụng cho TOÀN BỘ endpoint
# trong router đó, không cần thêm từng endpoint một
_protected = {"dependencies": [Depends(get_current_user)]}

# Đăng ký router - mỗi router mới (Tenant, Contract,..) sau này
# chỉ cần thêm 1 dòng import + 1 dòng include_router ở đây
app.include_router(room_router.router, **_protected)
app.include_router(tenant_router.router, **_protected)
app.include_router(contract_router.router, **_protected)
app.include_router(utility_router.router, **_protected)
app.include_router(utilityrate_router.router, **_protected)
app.include_router(bill_router.router, **_protected)
app.include_router(house_router.router, **_protected)
app.include_router(incident_router.router, **_protected)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Apartment Management API đang hoạt động"}