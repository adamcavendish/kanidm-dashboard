import { describe, expect, it } from "vite-plus/test";
import { kanidmHttpError, KanidmHttpError } from "./kanidm-error";

describe("kanidm-error", () => {
  it("keeps raw response bodies in the default message", () => {
    const body = JSON.stringify({
      detail: "The origin web server returned an invalid or incomplete response to Cloudflare.",
      retry_after: 60,
    });

    const error = new KanidmHttpError("/v1/auth", 502, body);

    expect(error.message).toBe(`/v1/auth returned HTTP 502: ${body}`);
    expect(error.responseBody).toBe(body);
  });

  it("preserves the response body for diagnostics", async () => {
    const error = await kanidmHttpError(
      "/v1/auth",
      new Response("origin_bad_gateway", { status: 502 }),
    );

    expect(error.message).toBe("/v1/auth returned HTTP 502: origin_bad_gateway");
    expect(error.responseBody).toBe("origin_bad_gateway");
  });
});
