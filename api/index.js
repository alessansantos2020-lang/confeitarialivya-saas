import handler from "../dist/server/server.js";

export default function (request) {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host");
  const url = new URL(request.url, `${proto}://${host}`);
  const absoluteRequest = new Request(url, request);
  return handler.fetch(absoluteRequest, {}, {});
}
