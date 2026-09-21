from pydantic import BaseModel, ConfigDict

class TagBase(BaseModel):
    name: str
    type: str 

class TagCreate(TagBase):
    pass

class TagUpdate(BaseModel):
    name: str | None = None
    type: str | None = None

class TagResponse(TagBase):
    id: int

    model_config = ConfigDict(from_attributes=True)