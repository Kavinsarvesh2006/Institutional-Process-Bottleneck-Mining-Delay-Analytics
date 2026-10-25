"""SQLite connection and session factory."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .config import DATABASE_URL

class Base(DeclarativeBase):
    """Base for persistent records."""

engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False})
Session = sessionmaker(engine, expire_on_commit=False)
