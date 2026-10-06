from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

Status = Literal["TODO", "IN_PROGRESS", "BLOCKED", "DONE"]
Priority = Literal["LOW", "MEDIUM", "HIGH"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(StrictModel):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def password_bytes(cls, value):
        if len(value.encode("utf-8")) > 256:
            raise ValueError("Password exceeds 256 UTF-8 bytes.")
        return value


class Register(Login):
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=10, max_length=128)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class DeleteAccount(StrictModel):
    password: str = Field(min_length=1, max_length=128)


class TaskInput(StrictModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=2000)
    status: Status = "TODO"
    priority: Priority = "MEDIUM"
    due_date: date | None = None

    @field_validator("title", mode="before")
    @classmethod
    def trim_title(cls, value):
        if not isinstance(value, str):
            return value
        return value.strip()  # mutation target: whitespace validation

    @field_validator("due_date")
    @classmethod
    def bounded_date(cls, value):
        if value and not date(2000, 1, 1) <= value <= date(2100, 12, 31):
            raise ValueError("Use a date between 2000 and 2100.")
        return value


class TaskUpdate(TaskInput):
    revision: int = Field(strict=True, ge=1)
