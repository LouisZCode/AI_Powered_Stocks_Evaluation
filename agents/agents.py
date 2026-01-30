from langchain.agents import create_agent
from dotenv import load_dotenv

import os
os.environ["MOONSHOT_API_KEY"] = "MOONSHOT_API_KEY"

from langchain_community.chat_models.moonshot import MoonshotChat

chat = MoonshotChat()


load_dotenv()

grok_agent = create_agent(
    model="xai:grok-3-mini"
    )

moonshot_agent = create_agent(
    model="xai:grok-3-mini"
    )


message = input("write your message:\n")

response = grok_agent.invoke(
    {"messages" : {"role" : "user", "content" : message}}
)

for i, msg in enumerate(response["messages"]):
    msg.pretty_print()