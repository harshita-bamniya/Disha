from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.exceptions import AuthException, ForbiddenException, InvalidTokenException
from app.core.security import decode_access_token
from app.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise AuthException("Authorization header missing")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise InvalidTokenException()

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise InvalidTokenException()

    user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True,
        User.deleted_at == None,
    ).first()

    if not user:
        raise AuthException("User not found or inactive")

    return user


def get_current_verified_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.phone_verified and not current_user.email_verified:
        raise ForbiddenException("Please verify your account before continuing.")
    return current_user


def require_role(*roles: str):
    """Factory that returns a dependency enforcing one of the given roles."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role_name not in roles:
            raise ForbiddenException(f"Role '{current_user.role_name}' is not allowed here.")
        return current_user
    return _check


require_admin = require_role("admin", "super_admin")
require_super_admin = require_role("super_admin")


def get_current_aspirant(current_user: User = Depends(get_current_verified_user)) -> User:
    """Dependency: user must be an aspirant (not employer, not admin)."""
    if current_user.role_name not in ("aspirant",):
        raise ForbiddenException("This endpoint is for aspirants only.")
    return current_user
