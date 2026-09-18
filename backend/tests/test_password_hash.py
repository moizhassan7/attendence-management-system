from app.core.security import get_password_hash, verify_password


def test_password_hash_roundtrip():
    hashed = get_password_hash("admin123")
    assert hashed.startswith("$2")
    assert verify_password("admin123", hashed)
    assert not verify_password("wrong", hashed)
