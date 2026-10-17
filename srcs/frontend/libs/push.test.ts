import { describe, expect, it } from "vitest";
import { pushSupport, urlBase64ToUint8Array } from "./push";

describe("push helpers", () => {
	it("decodes base64url keys", () => {
		expect(Array.from(urlBase64ToUint8Array("AQID-_8"))).toEqual([1, 2, 3, 251, 255]);
	});

	it("asks iOS users to install the app first", () => {
		const iphone = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" };
		expect(pushSupport(iphone, true, false)).toBe("needs-install");
		expect(pushSupport({ ...iphone, standalone: true }, true, false)).toBe("supported");
		expect(pushSupport({ userAgent: "Chrome" }, false, false)).toBe("unsupported");
		expect(pushSupport({ userAgent: "Chrome" }, true, false)).toBe("supported");
	});
});
