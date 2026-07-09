FROM python:3.11-slim

# scipy/numba need a C toolchain to build/compile against on some platforms
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/engine

COPY pyproject.toml .
COPY optimize_engine ./optimize_engine
COPY data/Specs.csv data/Regions.csv ./data/
COPY tests ./tests
COPY scripts ./scripts

RUN pip install --no-cache-dir -e ".[dev]"

# EIA hourly/parquet data is gitignored (PRD §9) -- mount it at runtime,
# e.g. `docker run -v $(pwd)/data/eia_hourly:/app/engine/data/eia_hourly ...`
CMD ["pytest", "tests/", "-v"]
