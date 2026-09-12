"""Common schemas — response envelope, pagination, etc."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class PaginationMeta(BaseModel):
    page: int = 1
    page_size: int = 50
    total: int = 0

    @property
    def total_pages(self) -> int:
        if self.page_size <= 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size


class ApiResponse(BaseModel):
    """Standard API response envelope."""
    success: bool = True
    data: Any = None
    message: str | None = None
    code: str | None = None


class PaginatedResponse(BaseModel):
    """Paginated list response."""
    success: bool = True
    data: list[Any] = []
    pagination: PaginationMeta = PaginationMeta()
    message: str | None = None


class ErrorResponse(BaseModel):
    """Error response."""
    success: bool = False
    message: str
    code: str | None = None
