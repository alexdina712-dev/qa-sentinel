import pytest
from pydantic import ValidationError
from app.schemas import TaskInput, Register
from app.auth import hash_password, verify_password, digest_token


@pytest.mark.parametrize("length", [3, 120])
def test_title_boundary_acceptance(length):
    assert len(TaskInput(title="x" * length).title) == length


@pytest.mark.parametrize("title", ["", "xx", " " * 3, "x" * 121])
def test_title_boundary_rejection(title):
    with pytest.raises(ValidationError):
        TaskInput(title=title)


@pytest.mark.parametrize("due", ["2026-02-30", "1999-12-31", "2101-01-01", "tomorrow"])
def test_invalid_due_dates(due):
    with pytest.raises(ValidationError):
        TaskInput(title="Boundary item", due_date=due)


def test_password_hashes_are_salted_and_verify_full_unicode():
    password = "密" * 24
    first, second = hash_password(password), hash_password(password)
    assert first != second and verify_password(password, first)
    assert not verify_password(password + "x", first)
    assert not verify_password("密" * 100, first)
    assert digest_token("secret") != "secret"


def test_registration_normalizes_and_limits_password_bytes():
    assert (
        Register(name=" Test User ", email=" TEST@EXAMPLE.COM ", password="SecurePass123").email
        == "test@example.com"
    )
    with pytest.raises(ValidationError):
        Register(name="Tester", email="a@example.com", password="密" * 100)
