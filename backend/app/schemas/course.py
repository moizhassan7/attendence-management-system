"""Course schemas."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class CourseBase(BaseModel):
    name: str = Field(..., max_length=200)
    code: str | None = Field(None, max_length=50)
    start_date: date | None = None
    end_date: date | None = None
    active: bool = True


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    code: str | None = Field(None, max_length=50)
    start_date: date | None = None
    end_date: date | None = None
    active: bool | None = None


class CourseResponse(CourseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
