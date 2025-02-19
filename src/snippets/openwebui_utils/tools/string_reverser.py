"""
title: String Reverser Tool
author: Your Name
author_url: https://yourwebsite.com
git_url: https://github.com/yourusername/string-reverser-tool
description: A simple tool that reverses an input string if the proper secret key is provided.
required_open_webui_version: 0.4.0
version: 0.1.0
license: MIT
"""

from pydantic import BaseModel, Field

class Tools:
    # Define a nested Valves class to hold configurable parameters.
    class Valves(BaseModel):
        # This valve holds a secret key used to authorize tool usage.
        secret_key: str = Field(default="", description="Secret key to authorize tool usage.")

    def __init__(self):
        # Initialize the valves. The default value can be changed by an administrator via the UI.
        self.valves = self.Valves(secret_key="default_secret")

    def reverse_string(self, input_str: str) -> str:
        """
        Reverse the given string if the correct secret key is set.

        :param input_str: The string to be reversed.
        :return: The reversed string, or an error message if the secret key is incorrect.
        """
        # Check that the valve (secret_key) has the expected value.
        if self.valves.secret_key != "openwebui_secret":
            return "Error: Unauthorized usage. Incorrect secret key."
        return input_str[::-1]

# Example of using the tool directly:
if __name__ == "__main__":
    tool = Tools()
    # Simulate setting the secret via Open WebUI configuration:
    tool.valves.secret_key = "openwebui_secret"
    
    sample = "Open WebUI"
    result = tool.reverse_string(sample)
    print(f"Input: {sample}")
    print(f"Reversed: {result}")
