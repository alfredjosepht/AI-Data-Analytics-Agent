from fastapi import APIRouter

from pydantic import BaseModel

from backend.agents.query_agent.query_agent import (
    QueryAgent
)

router = APIRouter(
    tags=["Chat"]
)


class ChatRequest(
    BaseModel
):

    question: str


@router.post("/")
def chat(
    request: ChatRequest
):

    return (
        QueryAgent
        .execute_question(
            request.question
        )
    )