import logging
import os
import threading
import time

from dotenv import load_dotenv
from flask import Flask, request
from slack_bolt import App
from slack_bolt.adapter.flask import SlackRequestHandler

from traceback import print_exc

from canvas_editor import CanvasEditor, CanvasEditResult

load_dotenv()

logging.basicConfig(level=logging.INFO)

flask_app = Flask(__name__)

app = App(
    token=os.environ.get("SLACK_BOT_TOKEN"),
    signing_secret=os.environ.get("SLACK_SIGNING_SECRET")
)

auth_test_result = app.client.auth_test()
bot_id = auth_test_result["user_id"]

tracked_files = []


def update_file(file_id: str):
    editor = CanvasEditor(
        app=app,
        file_id=file_id,
        token=os.environ.get("SLACK_BOT_TOKEN")
    )
    if editor.get_result() == CanvasEditResult.CURRENTLY_TRACKING:
        if file_id not in tracked_files:
            tracked_files.append(file_id)
            logging.info(f"Started tracking file: {file_id}")
    else:
        if file_id in tracked_files:
            tracked_files.remove(file_id)
            logging.info(f"Stopped tracking file: {file_id}")


def update_tracked_files():
    while True:
        for file in tracked_files:
            try:
                update_file(file)
            except Exception as e:
                logging.error(f"Error updating file {file}: {e}")
                if os.environ.get("DEBUG", "false").lower() == "true":
                    print_exc()

        time.sleep(60 * 2)  # Update every two minutes


def check_all_files():
    files_response = app.client.files_list(types="canvas")
    if not files_response.get("ok", False):
        logging.error("Failed to fetch files from Slack.")
        return
    files = files_response.get("files", [])
    if not files:
        logging.info("No canvas files found.")
        return
    for file in files:
        file_id = file.get("id")
        if not file_id:
            logging.warning("File without ID found, skipping.")
            continue
        try:
            update_file(file_id)
        except Exception as e:
            logging.error(f"Error updating file {file_id}: {e}")
            if os.environ.get("DEBUG", "false").lower() == "true":
                print_exc()


def periodic_file_check():
    """
    Periodically check all files and update the tracked files.
    """
    while True:
        try:
            check_all_files()
        except Exception as e:
            logging.error(f"Error during periodic file check: {e}")
            if os.environ.get("DEBUG", "false").lower() == "true":
                print_exc()
        time.sleep(60 * 60 * 1)  # Check every hour


threading.Thread(target=update_tracked_files, daemon=True).start()
threading.Thread(target=periodic_file_check, daemon=True).start()


@app.event("file_change")
def handle_file_change(event, say):
    """
    Handle file change events.
    """
    file_id = event.get("file_id")
    if not file_id:
        logging.warning("No file_id found in the event.")
        return
    try:
        update_file(file_id)
    except Exception as e:
        logging.error(f"Error handling file change for {file_id}: {e}")
        if os.environ.get("DEBUG", "false").lower() == "true":
            print_exc()


@flask_app.route("/slack/events", methods=["POST"])
def slack_events():
    return SlackRequestHandler(app).handle(request)


if __name__ == "__main__":
    flask_app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
