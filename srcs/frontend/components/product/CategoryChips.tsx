'use client';

import { Chip, ChipRow } from "@/styles/styledUi";
import { CATEGORIES } from "@/libs/constants";

export function CategoryChips({ active }: { active?: string }) {
	return (
		<ChipRow aria-label="카테고리">
			<Chip href="/" $active={!active} scroll={false}>전체</Chip>
			{CATEGORIES.map(c => (
				<Chip key={c} href={`/?category=${encodeURIComponent(c)}`} $active={active === c} scroll={false}>
					{c}
				</Chip>
			))}
		</ChipRow>
	);
}
