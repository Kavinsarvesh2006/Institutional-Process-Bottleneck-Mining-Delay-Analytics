"""Validated mutation contracts."""
from datetime import date
from math import isfinite
from pydantic import BaseModel, Field, model_validator

class Settings(BaseModel):
    """Institution calendar, targets and score weights."""
    working_hours: bool = False
    anonymise: bool = False
    holidays: list[date] = []
    weights: list[float] = Field(min_length=4, max_length=4)
    ideal_paths: dict[str, list[str]]
    sla_rules: dict[str, float]
    activity_targets: dict[str, float] = {}

    @model_validator(mode='after')
    def valid_values(self) -> 'Settings':
        """Reject undefined scores and invalid targets."""
        if not all(isfinite(v) for v in self.weights) or min(self.weights) < 0 or not isfinite(sum(self.weights)) or sum(self.weights) <= 0:
            raise ValueError('Weights must be nonnegative with a positive sum.')
        if any(not isfinite(v) or v <= 0 for v in [*self.sla_rules.values(), *self.activity_targets.values()]):
            raise ValueError('SLA targets must be positive hours.')
        if any(not path or any(not p.strip() for p in path) for path in self.ideal_paths.values()):
            raise ValueError('Ideal paths need at least one named activity.')
        return self

class Simulation(BaseModel):
    """Reduce incoming queue time at one activity."""
    activity: str
    reduction: float = Field(ge=0, le=100)

class Prediction(BaseModel):
    """Features observable after the first two activities."""
    process_type: str
    department: str
    weekday: int = Field(ge=0, le=6)
    first_wait: float = Field(ge=0, le=8760)
