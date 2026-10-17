import { describe, expect, it } from "vitest";
import { badgeText, notificationHref, notificationTitle } from "./notificationText";

describe("notification text", () => {
	it("has a headline for every type and a fallback", () => {
		expect(notificationTitle({ Type: "accepted" })).toBe("내 답변이 채택됐어요");
		expect(notificationTitle({ Type: "unknown" as never })).toBe("새 알림");
	});

	it("follows only site paths", () => {
		expect(notificationHref({ Link: "/community/p1" })).toBe("/community/p1");
		expect(notificationHref({ Link: "https://evil.example" })).toBe("/notifications");
		expect(notificationHref({ Link: "//evil.example" })).toBe("/notifications");
		expect(notificationHref({ Link: "/\\evil.example" })).toBe("/notifications");
		expect(notificationHref({})).toBe("/notifications");
	});

	it("caps the badge", () => {
		expect(badgeText(0)).toBe("");
		expect(badgeText(7)).toBe("7");
		expect(badgeText(150)).toBe("99+");
	});
});
