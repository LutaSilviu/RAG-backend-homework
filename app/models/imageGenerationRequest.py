from pydantic import BaseModel


class ImageGenerationRequest(BaseModel):
    image_description: str