'use client';

import { useRouter } from "next/navigation";
import { useState, ChangeEvent } from "react";

export const SearchInput = () => {
	const router = useRouter();
	const [ inputValue, setValue ] = useState("");
	
	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		const inputValue = event.target.value;
		setValue(inputValue);
	}

	const handleSearch = () => {
		if (inputValue)
			return router.push(`/search/${inputValue}`);
		else
			return router.push('/');
	}
	
	const handleKeyPress = (event: {key: any;}) => {
		if (event.key === "Enter")
			return handleSearch();
	}

	return (
		<div>
			<input 
				type="text"
				placeholder="검색"
				id="productSearch"
				value={inputValue ?? ""}
				onChange={handleChange}
				onKeyDown={handleKeyPress} />
			<button onClick={handleSearch}>검색</button>
		</div>
	);
}
