import base64
import json

from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, AIMessage
from openai import OpenAI

from app.const.const import API_MODEL, fail_message
from app.services.tools import get_summary_by_title,tools

from app.const.const import inapropiate_message


class ChatGBT:

    __llm = init_chat_model(
        model=API_MODEL,
        model_provider="openai",
        temperature=0,
    )

    __image_model = OpenAI()

    @staticmethod
    def generate_image(description: str) -> bytes:
        """
        Generate an image based on the provided description using the ChatGBT model.

        Args:
            description (str): The description for the image generation.

        Returns:
            bytes: The generated image in bytes format.
        """
        prompt = (f"Generate an image based on the following description: {description}"
              f"\nThe image should be visually appealing and relevant to the description provided."
              f"nEnsure the image is of a small dimension."
                  )

        result = ChatGBT.__image_model.images.generate(
            model="gpt-image-1",
            prompt=prompt
        )

        image_base64 = result.data[0].b64_json
        print(image_base64)
        return image_base64

    @staticmethod
    def answer_question(question: str, vectorstore):
        """
        Answer a question using the vectorstore and LLM.

        Args:
            question (str): The question to answer.
            vectorstore: The vectorstore containing the documents.

        Returns:
            str: The answer to the question.
        """
        retriever = vectorstore.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 5}
        )
        retrieved_docs = retriever.invoke(question)
        print(question)
        print(f"Retrieved {len(retrieved_docs)} documents : {retrieved_docs}")

        context_list = []
        for doc in retrieved_docs:
            context_list.append({
                "title": doc.metadata.get("title", ""),
                "start_index": doc.metadata.get("start_index"),
                "id": getattr(doc, "id", None),
                "summary": doc.page_content
            })

        context = json.dumps(context_list, ensure_ascii=False)

        prompt = f"""You are a helpful librarian assistant that receives questions regarding books, and answers with a sugestion.
        You will be given a question and a context.
        The context is a JSON array of books, each with fields: "title", "summary".
        Search the context for the best answer to the question.Search the title and summary of the book that best answers the question.
        If the context does not contain enough information to answer the question, respond with : {fail_message}
        If the question is offensive, inappropriate, or not related to the context, respond with: {inapropiate_message}
        
        Here is the inappropriate message: {inapropiate_message}.
        Here is the fail message: {fail_message}.
        Do not try to make up an answer.Use the context provided the best you can.
        
        If the user does not provide a question, respond with: {fail_message}.
        
        If you dont know the answer, dont make up an answer, just respond with: {fail_message}.
        
        Your answer should be concise and relevant to the question.Here are some examples of how to answer the question 
        (Please note that the provided examples is just an example, and you should not use it in your answer):
        1. If the question is about a book, provide the title of the book and a small description, about 20-30 characters long.
        For example:
            Question: Give me a book about friendship.
            Answer: The book "The Little Prince" is a story about friendship and the importance of human connections. 
            
        2. If the question is about a summary, provide the summary of the book.The summary should be exactly as it is in the context.
        For example:
            Question: Give me a summary of "The Hobbit".
            Answer: "The Hobbit" is a fantasy novel by J.R.R. Tolkien that follows the journey of Bilbo Baggins, 
            a hobbit who is reluctantly drawn into an adventure with a group of dwarves and the wizard Gandalf. 
            The story explores themes of courage, friendship, and the hero's journey as Bilbo discovers his own bravery 
            and resourcefulness while facing various challenges and adversaries, 
            including the dragon Smaug who guards the dwarves' treasure.

        3. If the question is offensive, inappropriate, or not related to the context:
            Question: Give me a stupid book.
            Answer: {inapropiate_message}
            
        4. If the question is not related to the context:
            Question : What is the capital of France?
            Answer: {fail_message}
        
        You shoud try to answer the question as best as you can, using the context provided.
        Answer the question according to the context:
        
            Question: {question}.
            Context: {context}
    
         """

        prompt2 = f"""You are a helpful librarian assistant that receives questions regarding books, and answers with a sugestion.
        You will be given a question and a context.
        The context is a JSON array of books, each with fields: "title", "summary
        
        Question: {question}
        Context: {context}
        
        Whenever you dont know the answer, or the question is not related to the context,
        respond with: {fail_message}
        If the question is inappropriate, respond with: {inapropiate_message}.
        Do not try to make up an answer.
        """
        response = ChatGBT.__llm.invoke(
            input=prompt2
        )

        llm_with_tools = ChatGBT.__llm.bind_tools(tools, tool_choice="auto")
        history = [HumanMessage(question), AIMessage(response.content)]
        print(response.content)

        if response.content == fail_message or response.content == inapropiate_message:
            return response.content

        messages = [response.content]
        ai_msg = llm_with_tools.invoke(history)

        print(ai_msg.tool_calls)
        print()

        for tool_call in ai_msg.tool_calls:
            selected_tool = {"get_summary_by_title": get_summary_by_title}[tool_call["name"].lower()]
            tool_output = selected_tool.invoke(tool_call["args"])
            messages.append(f" {tool_output}")

        print(messages)

        return messages
