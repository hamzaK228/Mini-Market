"""FastAPI application entry point for Mini-Markets CRM.

Works both locally (uvicorn) and on Vercel (serverless).
On Vercel, startup events don't fire reliably, so init_db() is called lazily.
"""
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from jinja2 import Environment, FileSystemLoader

from app.config import settings
from app.database import init_db
from app.routers import auth, markets, products, orders, reconciliations

# --- Lazy init (works on serverless cold starts) ---
_init_done = False


def _ensure_init():
    global _init_done
    if not _init_done:
        init_db()
        _init_done = True


# --- Jinja2 Templates ---
BASE_DIR = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    auto_reload=settings.DEBUG,
    cache_size=0,
)


def render_template(name: str, **context) -> str:
    """Render a Jinja2 template and return HTML string."""
    template = _jinja_env.get_template(name)
    return template.render(**context)


# --- FastAPI App ---

app = FastAPI(
    title="Mini-Markets CRM API",
    description="Multi-tenant CRM for small retail chains in Kyrgyzstan",
    version="1.0.0",
)

# --- CORS ---
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Routers ---

app.include_router(auth.router)
app.include_router(markets.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(reconciliations.router)


# --- Static Files ---

STATIC_DIR = BASE_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# --- Page Routes ---


@app.get("/dashboard", response_class=HTMLResponse)
def dashboard():
    _ensure_init()
    html = render_template("dashboard.html")
    return HTMLResponse(html)


@app.get("/", response_class=HTMLResponse)
def login_page():
    _ensure_init()
    html = render_template("login.html")
    return HTMLResponse(html)


@app.get("/health")
def health():
    _ensure_init()
    return {
        "status": "ok",
        "version": "1.0.0",
        "env": "production" if not settings.DEBUG else "development",
    }


# --- Security Headers Middleware ---


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Cache-Control"] = "no-store"
    return response


# --- Entry point (local) ---

if __name__ == "__main__":
    _ensure_init()
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
