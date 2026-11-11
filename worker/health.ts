import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

export function startHealthServer(port: number) {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    if (request.url !== "/health" || request.method !== "GET") { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify({ status: "ok", worker: "saxn-packager" }));
  });
  server.listen(port, "0.0.0.0");
  return server;
}
