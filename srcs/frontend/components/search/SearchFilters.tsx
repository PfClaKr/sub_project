'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import palette from "@/theme/colorPalette";
import { CATEGORIES, REGIONS, SORT_OPTIONS } from "@/libs/constants";

const FilterBar = styled.form`
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 10px;
	padding: 16px;
	border-radius: 12px;
	background-color: ${palette.bg[100]};
	border: 1px solid ${palette.line};
	margin-bottom: 24px;

	@media (max-width: 600px) {
		padding: 12px;
		gap: 8px;
	}
`;

// On phones the fields collapse behind a toggle so results stay visible.
const Fields = styled.div<{ $open: boolean }>`
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 10px;
	width: 100%;

	@media (max-width: 600px) {
		display: ${p => (p.$open ? "flex" : "none")};
		gap: 8px;
	}
`;

const Field = styled.label`
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 1;
	min-width: 120px;
	font-size: 12px;
	font-weight: 600;
	color: ${palette.fg[100]};

	input, select {
		padding: 8px 10px;
		font-size: 14px;
		background-color: ${palette.bg.default};
	}
`;

const KeywordField = styled(Field)`
	min-width: 180px;
`;

const SubmitButton = styled.button`
	@media (max-width: 600px) {
		width: 100%;
		padding: 11px;
	}
`;

const ToggleButton = styled.button`
	display: none;

	@media (max-width: 600px) {
		display: block;
		width: 100%;
		padding: 10px;
		background-color: ${palette.bg.default};
		color: ${palette.fg[500]};
		border: 1px solid ${palette.line};
	}
`;

export type SearchQuery = {
	q?: string;
	category?: string;
	region?: string;
	min?: string;
	max?: string;
	sort?: string;
};

function activeCount(query: SearchQuery) {
	return [query.q, query.category, query.region, query.min, query.max].filter(Boolean).length;
}

export const SearchFilters = ({ current }: { current: SearchQuery }) => {
	const router = useRouter();
	const [state, setState] = useState<SearchQuery>(current);
	const [open, setOpen] = useState(false);

	const set = (key: keyof SearchQuery) =>
		(e: { target: { value: string } }) =>
			setState(prev => ({ ...prev, [key]: e.target.value }));

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const params = new URLSearchParams();
		Object.entries(state).forEach(([key, value]) => {
			if (value) params.set(key, value);
		});
		setOpen(false);
		router.push(`/search?${params.toString()}`);
	};

	const count = activeCount(current);

	return (
		<FilterBar onSubmit={handleSubmit}>
			<ToggleButton type="button" onClick={() => setOpen(prev => !prev)}>
				{open ? "필터 접기" : `필터${count > 0 ? ` (${count})` : ""}`}
			</ToggleButton>
			<Fields $open={open}>
				<KeywordField>검색어
					<input type="text" value={state.q ?? ""} onChange={set("q")} placeholder="예: 아이폰, 책상" />
				</KeywordField>
				<Field>카테고리
					<select value={state.category ?? ""} onChange={set("category")}>
						<option value="">전체</option>
						{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
					</select>
				</Field>
				<Field>지역
					<select value={state.region ?? ""} onChange={set("region")}>
						<option value="">전체</option>
						{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
					</select>
				</Field>
				<Field>최소가 (€)
					<input type="number" min={0} value={state.min ?? ""} onChange={set("min")} />
				</Field>
				<Field>최대가 (€)
					<input type="number" min={0} value={state.max ?? ""} onChange={set("max")} />
				</Field>
				<Field>정렬
					<select value={state.sort ?? "recent"} onChange={set("sort")}>
						{SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
					</select>
				</Field>
				<SubmitButton type="submit">검색</SubmitButton>
			</Fields>
		</FilterBar>
	);
};
