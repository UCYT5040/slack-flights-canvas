import threading
import time
import os
from datetime import datetime, timedelta
from json import dumps
from os import environ
from uuid import uuid4

from dotenv import load_dotenv
from flask import Flask, request, Response

from scrape_flightaware import scrape_flightaware

load_dotenv()

app = Flask(__name__)

secret_tokens = environ.get("SECRET_TOKENS", "").split(",")

if not secret_tokens or not all(secret_tokens):
    raise ValueError("SECRET_TOKENS environment variable must be set with at least one token.")


def validate_token(token):
    if not token or token not in secret_tokens:
        return False
    return True


worker_queue = []

flight_cache = {}
CACHE_EXPIRATION = timedelta(minutes=2)
BUSY_CACHE_EXPIRATION = timedelta(minutes=5)  # Special expiration for when the queue is busy
BUSY_QUEUE_COUNT = 15  # Number of items in the queue before we consider it busy


def queue_busy():
    return len(worker_queue) >= BUSY_QUEUE_COUNT


class QueueItem:
    def __init__(self, request_id, flight_number):
        self.request_id = request_id
        self.flight_number = flight_number
        self.in_progress = False
        self.completed = False
        self.result = None
        worker_queue.append(self)

    def start(self):
        self.in_progress = True
        self.completed = False
        self.result = None

    def complete(self, result):
        self.in_progress = False
        self.completed = True
        self.result = result
        worker_queue.remove(self)

    def can_pickup(self):
        return not self.in_progress and not self.completed


def work():
    global worker_queue, flight_cache
    while True:
        if not worker_queue:
            time.sleep(0.1)
            continue
        for item in list(worker_queue):
            if item.can_pickup():
                item.start()
                if item.flight_number in flight_cache:
                    cached_item = flight_cache[item.flight_number]
                    created_at = cached_item['created_at']
                    if queue_busy() and datetime.now() - created_at < BUSY_CACHE_EXPIRATION:
                        item.complete(cached_item['result'])
                        continue
                    elif datetime.now() - created_at < CACHE_EXPIRATION:
                        item.complete(cached_item['result'])
                        continue
                result = scrape_flightaware(item.flight_number)
                if result:
                    flight_cache[item.flight_number] = {
                        'result': result,
                        'created_at': datetime.now()
                    }
                    item.complete(result)
                else:
                    item.complete({
                        "error": "Flight data not found or could not be scraped."
                    })
                break

worker_threads = []
num_threads = int(os.environ.get("NUM_THREADS", os.cpu_count()))
for _ in range(num_threads):
    worker = threading.Thread(target=work, daemon=True)
    worker.start()
    worker_threads.append(worker)


@app.route("/api/scrape/<flight_numbers>")
def scrape(flight_numbers):
    if not validate_token(request.args.get("token")):
        return "Invalid token", 403
    request_id = str(uuid4())
    queue_items = []
    for number in flight_numbers.split(","):
        number = number.strip().replace(" ", "").replace("-", "").upper()
        if not number.isalnum() or len(number) < 2 or len(number) > 10:
            return "Invalid flight number format", 400
        queue_items.append(QueueItem(request_id, number))

    def stream():
        while len(queue_items) > 0:
            for item in queue_items:
                if item.completed:
                    yield dumps({
                        "type": "flight_data",
                        "request_id": item.request_id,
                        "flight_number": item.flight_number,
                        "status": "completed",
                        "result": item.result
                    }) + "\n"
                    queue_items.remove(item)
        yield dumps({
            "type": "end",
            "request_id": request_id,
            "status": "completed"
        }) + "\n"

    return Response(stream(), mimetype='application/json')

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), threaded=True)
