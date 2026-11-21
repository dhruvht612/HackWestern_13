import time
from typing import Any

import jwt
from fastapi import HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from attacksurface.config import settings

JWT_ALGORITHM = "HS256"


def token_response(token: str):
    return {"access_token": token}


def sign_jwt(user_id: str) -> dict[str, str]:
    payload = {"user_id": user_id, "expires": time.time() + 600}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=JWT_ALGORITHM)

    return token_response(token)


def decode_jwt(token: str) -> dict[str, Any] | None:
    try:
        decoded_token = jwt.decode(
            token, settings.jwt_secret, algorithms=[JWT_ALGORITHM]
        )
        return decoded_token if decoded_token["expires"] >= time.time() else None
    except:
        return {}


class JWTBearer(HTTPBearer):
    def __init__(self, auto_error: bool = True):
        super(JWTBearer, self).__init__(auto_error=auto_error)

    async def __call__(self, request: Request):  # ty: ignore[incompatible-method-override]

        credentials: HTTPAuthorizationCredentials = await super(
            JWTBearer, self
        ).__call__(request)  # ty: ignore[invalid-assignment]

        if credentials:
            if not credentials.scheme == "Bearer":
                raise HTTPException(
                    status_code=403, detail="Invalid authentication scheme."
                )
            if not self.verify_jwt(credentials.credentials):
                raise HTTPException(
                    status_code=403, detail="Invalid token or expired token."
                )
            return credentials.credentials
        else:
            raise HTTPException(status_code=403, detail="Invalid authorization code.")

    def verify_jwt(self, jwtoken: str) -> bool:
        isTokenValid: bool = False

        try:
            payload = decode_jwt(jwtoken)
        except:
            payload = None
        if payload:
            isTokenValid = True

        return isTokenValid
