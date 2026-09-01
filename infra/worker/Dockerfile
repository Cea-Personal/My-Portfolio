# Supply a digest-pinned value in CI, for example python:3.13.5-slim@sha256:<reviewed-digest>.
ARG PYTHON_IMAGE=python:3.13.5-slim
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_NO_CACHE=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    WORKER_SCRATCH_DIR=/tmp/career-worker

RUN groupadd --system --gid 10001 career-worker \
    && useradd --system --uid 10001 --gid career-worker --home /nonexistent career-worker \
    && mkdir -p /app /tmp/career-worker \
    && chown -R career-worker:career-worker /app /tmp/career-worker

WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.7.19 /uv /uvx /bin/
COPY apps/worker/pyproject.toml apps/worker/uv.lock ./
RUN uv sync --frozen --no-dev
COPY apps/worker/src ./src

USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/opt/venv/bin/python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/healthz', timeout=2)"]
ENTRYPOINT ["/opt/venv/bin/career-worker"]
CMD ["serve", "--host", "0.0.0.0", "--port", "8080"]
