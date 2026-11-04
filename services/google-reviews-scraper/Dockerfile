FROM python:3.12-slim

ARG SCRAPER_COMMIT=f94b38b3c188f701f09aa24e2cb6824349da09f4

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates chromium chromium-driver git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY rating-extraction.patch /tmp/rating-extraction.patch
RUN git clone https://github.com/georgekhananaev/google-reviews-scraper-pro.git . \
	&& git fetch origin refs/pull/27/head \
	&& git checkout "$SCRAPER_COMMIT" \
	&& git apply /tmp/rating-extraction.patch \
	&& rm -rf .git
RUN pip install --no-cache-dir -r requirements.txt

COPY test_rating_extraction.py /tmp/test_rating_extraction.py
RUN PYTHONPATH=/app python /tmp/test_rating_extraction.py

COPY config.yaml /app/config.yaml

ENV CHROME_BIN=/usr/bin/chromium \
    CHROMEDRIVER_PATH=/usr/bin/chromedriver \
    PYTHONUNBUFFERED=1

EXPOSE 8000
CMD ["python", "api_server.py"]
