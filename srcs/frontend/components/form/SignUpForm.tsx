'use client';

import { RegisterUserAction } from "./RegisterUserAction";
import { FormColumn, FieldLabel } from "@/styles/styledForm";
import { REGIONS } from "@/libs/constants";

export const SignUpForm = () => {
	return (
		<FormColumn action={RegisterUserAction}>
			<FieldLabel>이메일
				<input type="email" placeholder="you@example.com" name="email" required />
			</FieldLabel>
			<FieldLabel>비밀번호
				<input type="password" placeholder="8자 이상" name="password" required minLength={8} />
			</FieldLabel>
			<FieldLabel>닉네임
				<input type="text" placeholder="마켓에서 쓸 이름" name="nickname" required maxLength={20} />
			</FieldLabel>
			<FieldLabel>거주 지역
				<select name="residence" required>
					{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
				</select>
			</FieldLabel>
			<FieldLabel>상세 지역 (동네, 도시 등 — 선택)
				<input type="text" placeholder="예: 15구, Cachan, 리옹 2구" name="residencedetail" maxLength={50} />
			</FieldLabel>
			<button type="submit">가입하기</button>
		</FormColumn>
	);
};
