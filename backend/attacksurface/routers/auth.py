from fastapi import APIRouter

from attacksurface.database import supabase
from attacksurface.schemas import SignInModel, SignUpModel

router = APIRouter(tags=["auth"])


@router.get("/sign_up")
def sign_up():
    res = supabase.auth.sign_up({"email": "email", "password": "password"})
    return res.session.access_token


@router.get("/sign_out")
def sign_out():
    res = supabase.auth.sign_out()
    return "success"


@router.get("/sign_in")
def sign_in():
    res = supabase.auth.sign_in_with_password(
        {"email": "email", "password": "password"}
    )
    return res.session.access_token
