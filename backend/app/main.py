"""FastAPI composition root and offline development server."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from . import models
from .config import ORIGINS
from .routers.api import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create schema on first launch; samples are loaded explicitly."""
    Base.metadata.create_all(engine)
    yield

app = FastAPI(title='FlowLens Campus Process Intelligence',version='1.0.0',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=ORIGINS,allow_methods=['GET','POST','PUT'],allow_headers=['*'])
app.include_router(router,prefix='/api')

@app.get('/health')
def health() -> dict:
    """Liveness endpoint for launch scripts."""
    return {'status':'ok','product':'FlowLens'}
