FROM python:3.12-slim

WORKDIR /app
COPY etl /app/etl
COPY shared /app/shared
COPY scripts /app/scripts
ENV PYTHONPATH=/app/etl

RUN python scripts/generate_fixture.py --check

ENTRYPOINT ["python", "-m", "vale_verde_etl"]
CMD ["--date", "2026-11-19", "--promoter", "promo_camila"]
