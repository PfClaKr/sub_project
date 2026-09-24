'use client';

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, FormEvent, KeyboardEvent } from "react";
import { SearchRow, ComboBox, SuggestionList } from "@/styles/styledHome";
import { gql } from "@/libs/graphql";

// Bold the typed text inside a suggestion when it appears verbatim.
function Highlight({ text, query }: { text: string; query: string }) {
	const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
	if (i < 0) return <>{text}</>;
	return (
		<>
			{text.slice(0, i)}
			<mark>{text.slice(i, i + query.length)}</mark>
			{text.slice(i + query.length)}
		</>
	);
}

// SearchInput with autocomplete. Suggestions are requested while a
// Hangul syllable is still being composed ("아잎" → 아이폰), which the
// backend matches by jamo prefix.
export const SearchInput = ({ initial = "" }: { initial?: string }) => {
	const router = useRouter();
	const listId = useId();
	const [value, setValue] = useState(initial);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(-1);
	const requestSeq = useRef(0);

	useEffect(() => {
		const q = value.trim();
		if (!q) {
			setSuggestions([]);
			return;
		}
		const seq = ++requestSeq.current;
		const timer = setTimeout(async () => {
			const { data } = await gql<{ searchSuggestions: string[] }>(
				`query S($p: String!) { searchSuggestions(Prefix: $p) }`,
				{ p: q },
			);
			// Ignore answers to older keystrokes.
			if (seq === requestSeq.current) {
				setSuggestions(data?.searchSuggestions ?? []);
				setActive(-1);
			}
		}, 150);
		return () => clearTimeout(timer);
	}, [value]);

	const go = (q: string) => {
		setOpen(false);
		const trimmed = q.trim();
		router.push(trimmed ? `/search/${encodeURIComponent(trimmed)}` : "/search");
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		go(active >= 0 ? suggestions[active] : value);
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		// Enter/arrows while the IME is composing belong to the IME.
		if (event.nativeEvent.isComposing) return;
		const count = suggestions.length;
		if (event.key === "ArrowDown" && count) {
			event.preventDefault();
			setOpen(true);
			setActive(i => (i + 1) % count);
		} else if (event.key === "ArrowUp" && count) {
			event.preventDefault();
			setActive(i => (i <= 0 ? count - 1 : i - 1));
		} else if (event.key === "Escape") {
			setOpen(false);
			setActive(-1);
		}
	};

	const showList = open && suggestions.length > 0;

	return (
		<SearchRow role="search" onSubmit={handleSubmit}>
			<ComboBox>
				<input
					type="search"
					role="combobox"
					placeholder="어떤 물건을 찾고 있냥?"
					aria-label="상품 검색"
					aria-autocomplete="list"
					aria-expanded={showList}
					aria-controls={listId}
					aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
					autoComplete="off"
					value={value}
					maxLength={100}
					onChange={e => {
						setValue(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setOpen(false)}
					onKeyDown={handleKeyDown}
				/>
				{showList && (
					<SuggestionList id={listId} role="listbox" aria-label="추천 검색어">
						{suggestions.map((s, i) => (
							<li
								key={s}
								id={`${listId}-${i}`}
								role="option"
								aria-selected={i === active}
								// mousedown fires before the input's blur closes the list.
								onMouseDown={e => {
									e.preventDefault();
									go(s);
								}}
								onMouseEnter={() => setActive(i)}
							>
								<Highlight text={s} query={value.trim()} />
							</li>
						))}
					</SuggestionList>
				)}
			</ComboBox>
			<button type="submit">검색</button>
		</SearchRow>
	);
};
