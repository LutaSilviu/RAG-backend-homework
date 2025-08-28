from fastapi import APIRouter,Request
from starlette.responses import JSONResponse

from app.const.const import inapropiate_message, fail_message, not_enough_info_message
from app.models.imageGenerationRequest import ImageGenerationRequest
from app.models.question import Question
from app.services.chatgbt import ChatGBT

router = APIRouter()

@router.post("/ask_question")
def ask_question(question: Question,request: Request):
    vector_store = request.app.state.vector_store
    answer = ChatGBT.answer_question(question.text,vectorstore=vector_store )
    print("HERE: ", answer)
    if answer == fail_message or answer == inapropiate_message or answer == not_enough_info_message:
        return JSONResponse(
            status_code=400,
            content=answer
        )

    return JSONResponse(
        status_code=200,
        content={"content": answer}
    )


@router.post("/cover_image")
def get_cover_image(image_desc: ImageGenerationRequest,request: Request):
    """
    Return the cover image of the book.
    """
    image = ChatGBT.generate_image(image_desc.image_description)

    if not image:
        return JSONResponse(
            status_code=400,
            content={"content": "Failed to generate image."}
        )

    return JSONResponse(
        status_code=200,
        content={"content": image}
    )