"""Indexed storage for datasets, cases, events and analysis configuration."""
from sqlalchemy import Column, Integer, String, Float, Boolean, JSON, ForeignKey, UniqueConstraint
from .database import Base

class Dataset(Base):
    """Uploaded dataset with its validation audit."""
    __tablename__ = 'datasets'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(String)
    quality = Column(JSON)

class Case(Base):
    """Case-level metadata; derived metrics are recalculated for active settings."""
    __tablename__ = 'cases'
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey('datasets.id'), index=True)
    case_id = Column(String, index=True)
    process_type = Column(String, index=True)
    start = Column(String)
    end = Column(String)
    status = Column(String)
    sla_hours = Column(Float)
    breached = Column(Boolean)
    __table_args__ = (UniqueConstraint('dataset_id', 'case_id'),)

class Event(Base):
    """One activity interval in one case."""
    __tablename__ = 'events'
    id = Column(Integer, primary_key=True)
    dataset_id = Column(Integer, ForeignKey('datasets.id'), index=True)
    case_id = Column(String, index=True)
    process_type = Column(String, index=True)
    activity = Column(String, index=True)
    start_time = Column(String, index=True)
    end_time = Column(String)
    role = Column(String)
    department = Column(String, index=True)
    resource = Column(String)
    outcome = Column(String)

class SlaRule(Base):
    """Active SLA targets."""
    __tablename__ = 'sla_rules'
    process_type = Column(String, primary_key=True)
    target_hours = Column(Float)
    activity_targets = Column(JSON)

class AnalysisCache(Base):
    """Persisted analysis settings; large computed frames use bounded memory caching."""
    __tablename__ = 'analysis_cache'
    key = Column(String, primary_key=True)
    payload = Column(JSON)
