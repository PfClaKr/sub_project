import { describe, expect, it } from "vitest";
import ko from "../messages/ko.json";
import fr from "../messages/fr.json";
import en from "../messages/en.json";

type Tree = { [key: string]: string | Tree };

// Every leaf key → the placeholders ({name}) and tags (<word>) its text
// uses, so a translation cannot drop or rename one.
function leaves(tree: Tree, prefix = "", out: Record<string, string> = {}): Record<string, string> {
	for (const key of Object.keys(tree)) {
		const value = tree[key];
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") {
			const tokens = (value.match(/\{\w+|<\w+>/g) ?? []).map(t => t.replace("{", ""));
			out[path] = Array.from(new Set(tokens)).sort().join(" ");
		} else {
			leaves(value, path, out);
		}
	}
	return out;
}

const source = leaves(ko as Tree);

describe.each([["fr", fr], ["en", en]] as const)("%s messages", (_, messages) => {
	const target = leaves(messages as Tree);
	it("have exactly the Korean keys", () => {
		expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort());
	});
	it("keep every placeholder and tag", () => {
		for (const key of Object.keys(source)) expect(target[key], key).toBe(source[key]);
	});
	it("have no empty text", () => {
		const texts = leaves(messages as Tree, "", {});
		for (const key of Object.keys(texts)) expect(key.split(".").reduce<Tree | string>((t, k) => (t as Tree)[k], messages as Tree), key).not.toBe("");
	});
});
