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
	border: 1px solid ${palette.bg[300]};
	margin-bottom: 24px;
`;

const Field = styled.label`
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 12px;
	font-weight: 600;
	color: ${palette.fg[100]};

	input, select {
		padding: 8px 10px;
		font-size: 14px;
		background-color: #ffffff;
	}
`;

const KeywordField = styled(Field)`
	flex: 1;
	min-width: 180px;
`;

const PriceInput = styled.input`
	width: 90px;
`;

export type SearchQuery = {
	q?: string;
	category?: string;
	region?: string;
	min?: string;
	max?: string;
	sort?: string;
};

export const SearchFilters = ({ current }: { current: SearchQuery }) => {
	const router = useRouter();
	const [state, setState] = useState<SearchQuery>(current);

	const set = (key: keyof SearchQuery) =>
		(e: { target: { value: string } }) =>
			setState(prev => ({ ...prev, [key]: e.target.value }));

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const params = new URLSearchParams();
		Object.entries(state).forEach(([key, value]) => {
			if (value) params.set(key, value);
		});
		router.push(`/search?${params.toString()}`);
	};

	return (
		<FilterBar onSubmit={handleSubmit}>
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
				<PriceInput type="number" min={0} value={state.min ?? ""} onChange={set("min")} />
			</Field>
			<Field>최대가 (€)
				<PriceInput type="number" min={0} value={state.max ?? ""} onChange={set("max")} />
			</Field>
			<Field>정렬
				<select value={state.sort ?? "recent"} onChange={set("sort")}>
					{SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
				</select>
			</Field>
			<button type="submit">검색</button>
		</FilterBar>
	);
};
