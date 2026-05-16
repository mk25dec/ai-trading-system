FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /bin/api ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=build /bin/api /app/api
EXPOSE 8080
CMD ["/app/api"]
