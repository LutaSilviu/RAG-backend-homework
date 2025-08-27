import json
import os

from langchain.tools import tool

@tool()
def get_summary_by_title(title: str) -> str:
    """caută titlul și returnează rezumatul complet"""
    file_path = os.path.join(os.path.dirname(__file__), "book_summaries.json")
    with open(file_path, "r", encoding="utf-8") as f:
        summaries = json.load(f)
    return summaries.get(title, "Titlul nu a fost găsit.")


tools = [get_summary_by_title]



    # book_summaries_dict = {
    #     "The Hobbit": (
    #         "Bilbo Baggins, un hobbit confortabil și fără aventuri, este luat prin surprindere "
    #         "atunci când este invitat într-o misiune de a recupera comoara piticilor păzită de
    #         dragonul Smaug."
    #         "Pe parcursul călătoriei, el descoperă curajul și resursele interioare pe care nu știa că le
    #         are."
    #         "Povestea este plină de creaturi fantastice, prietenii neașteptate și momente tensionate."
    #     ),
    #     "1984": (
    #         "Romanul lui George Orwell descrie o societate distopică aflată sub controlul total al
    #         statului."
    #         "Oamenii sunt supravegheați constant de „Big Brother”, iar gândirea liberă este
    #         considerată crimă."
    #         "Winston Smith, personajul principal, încearcă să reziste acestui regim opresiv. "
    #         "Este o poveste despre libertate, adevăr și manipulare ideologică."
    #     )}
