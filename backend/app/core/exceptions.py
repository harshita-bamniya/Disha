from fastapi import HTTPException, status


class AuthException(HTTPException):
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail,
                         headers={"WWW-Authenticate": "Bearer"})


class ForbiddenException(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class NotFoundException(HTTPException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ConflictException(HTTPException):
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class BadRequestException(HTTPException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class OtpExpiredException(BadRequestException):
    def __init__(self):
        super().__init__(detail="OTP has expired. Please request a new one.")


class OtpInvalidException(BadRequestException):
    def __init__(self):
        super().__init__(detail="Invalid OTP. Please check and try again.")


class TokenExpiredException(AuthException):
    def __init__(self):
        super().__init__(detail="Token has expired")


class InvalidTokenException(AuthException):
    def __init__(self):
        super().__init__(detail="Invalid token")
