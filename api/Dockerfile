FROM golang:1.24-bookworm AS build
WORKDIR /src
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY . .
ENV CGO_ENABLED=1
RUN go mod tidy && go build -o /bin/api ./cmd/server

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget libstdc++6 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /bin/api /app/api
RUN mkdir -p /data && chown nobody:nogroup /data
USER nobody
EXPOSE 8090
CMD ["/app/api"]
