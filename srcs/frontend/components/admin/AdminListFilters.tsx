'use client';

import { FilterForm } from "@/styles/styledAdmin";
import { useTranslations } from "next-intl";

type Select = { name: string; label: string; value: string; options: { value: string; label: string }[] };

// A plain GET form: the server page does the filtering, so there is no
// client state to keep in sync. Submitting resets to page 1 because the
// form carries no page field. Without `search` there is no text field.
export function AdminListFilters({ search, placeholder, selects = [] }: {
	search?: string;
	placeholder?: string;
	selects?: Select[];
}) {
	const t = useTranslations("admin");
	return (
		<FilterForm method="get" role="search">
			{search !== undefined && (
				<label>
					{t("search")}
					<input type="search" name="q" defaultValue={search} placeholder={placeholder} />
				</label>
			)}
			{selects.map(s => (
				<label key={s.name}>
					{s.label}
					<select name={s.name} defaultValue={s.value}>
						{s.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
					</select>
				</label>
			))}
			<button type="submit">{t("apply")}</button>
		</FilterForm>
	);
}
