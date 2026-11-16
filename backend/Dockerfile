FROM rust:1-slim-trixie AS build
WORKDIR /app
ENV SQLX_OFFLINE=true

# Build the dependencies first so they are cached between code changes.
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src

COPY build.rs ./
COPY migrations migrations
COPY src src
RUN touch src/main.rs && cargo build --release

FROM debian:trixie-slim
# postgresql-client has pg_dump, pg_restore and psql for backups.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --no-create-home aerostat \
    && mkdir -p /data/backups \
    && chown aerostat /data/backups

COPY --from=build /app/target/release/statuspage-backend /usr/local/bin/aerostat

USER aerostat
ENV HOST=0.0.0.0 \
    PORT=3004 \
    RUST_LOG=info
EXPOSE 3004
ENTRYPOINT ["aerostat"]
