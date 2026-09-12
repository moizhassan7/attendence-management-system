"""Central v1 API router — includes all sub-routers."""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.devices import router as devices_router
from app.api.v1.personnel import router as personnel_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.master_data import (
    dept_router,
    rank_router,
    shift_router,
    holiday_router,
    course_router,
)

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.settings import router as settings_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health_router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(settings_router)
api_router.include_router(devices_router)
api_router.include_router(personnel_router)
api_router.include_router(attendance_router)
api_router.include_router(dashboard_router)
api_router.include_router(dept_router)
api_router.include_router(rank_router)
api_router.include_router(shift_router)
api_router.include_router(holiday_router)
api_router.include_router(course_router)
