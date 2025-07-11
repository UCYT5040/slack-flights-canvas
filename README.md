# Slack Flights Canvas

Ping your Slack bot in a canvas with flight numbers, and it will return information about that flight.

## Installation

Set environment variables or create a `.env` file with the following content:
```dotenv
SLACK_SIGNING_SECRET=""
SLACK_BOT_TOKEN=""
AVIATION_STACK_TOKEN=""
```

You can optionally set the `PORT` variable to change the port on which the server runs (default is 5000).

```
pip install uv
uv run main.py
```
