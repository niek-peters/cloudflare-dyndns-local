FROM oven/bun:debian as build

COPY ./index.ts .
CMD ["bun", "index.ts"]
