# Slack Flights Canvas

Ping your Slack bot in a canvas with flight numbers, and it will return information about each flight.

## Installation

Set environment variables or create a `.env` file with the following content:

```dotenv
SLACK_SIGNING_SECRET=""
SLACK_BOT_TOKEN=""
```

Build the online map files:

```shell
npm install
npm run build
```

Set the default map file ID (from Slack):

```dotenv
DEFAULT_FILE_ID=""
```

You can optionally set the `PORT` variable to change the port on which the server runs (default is 5000).

```shell
pip install uv
uv run main.py
```

## Configuration

On the same line that you mention the bot, add a JSON object or a URL (ending in `.json`).

See [shipwrecked_config.json](shipwrecked_config.json) for an example configuration made for Hack Club’s Shipwrecked
event.

If you’ve enabled the map feature, visit `/map/<canvas_file_id>` to see the map. Prepend `/api` for a programmatic
interface. Set `DEFAULT_FILE_ID` to redirect `/` to a specific map file.
