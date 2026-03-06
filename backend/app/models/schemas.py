import re
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$")


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @model_validator(mode="after")
    def validate_passwords(self):
        if not PASSWORD_REGEX.match(self.password):
            raise ValueError(
                "Password must be at least 8 characters and include uppercase, lowercase, number, and special character."
            )

        if self.password != self.confirm_password:
            raise ValueError("Password and confirm password do not match.")

        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_new_password: str

    @model_validator(mode="after")
    def validate_new_password(self):
        if not PASSWORD_REGEX.match(self.new_password):
            raise ValueError(
                "New password must be at least 8 characters and include uppercase, lowercase, number, and special character."
            )

        if self.new_password != self.confirm_new_password:
            raise ValueError("New password and confirm new password do not match.")

        return self


class ProfileUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class UserSummary(BaseModel):
    id: int
    email: EmailStr
    name: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserSummary


class ReviewRequest(BaseModel):
    language: str
    code: str
    question_text: Optional[str] = None
    action_type: Literal["review", "hint", "complexity", "diff", "fix"]
