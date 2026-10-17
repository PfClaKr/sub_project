import Link from "next/link";
import { HOST, LEGAL_VERSION, MIN_AGE, NOTIFICATION_RETENTION, OPERATOR, RECORD_RETENTION, legalDate } from "@/libs/legal";
import { Fill } from "./LegalShell";

// 개인정보처리방침 (한국어). Every statement here must match the code:
// data collected (signup, Google, posts, chat, push), retention
// (adminhandler.DeleteMember, graphqlhandler.RecordRetention, notify
// Retention), processors (deploy/, geohandler, map tiles, push).
export function PrivacyKo() {
	const op = <Fill value={OPERATOR.name} lang="ko" label="운영자 이름" />;
	const email = <Fill value={OPERATOR.email} lang="ko" label="연락처 이메일" />;
	const keep = RECORD_RETENTION.ko;
	return (
		<>
			<p>
				{op}(이하 &ldquo;운영자&rdquo;)는 잇냥 서비스(이하 &ldquo;서비스&rdquo;)를 이용하는 분의 개인정보를 이 방침에 따라 처리합니다.
				운영자는 프랑스에서 서비스를 운영하므로 유럽연합 일반개인정보보호규정(GDPR)과 프랑스 정보처리자유법(Loi Informatique et Libertés)을 따르며,
				한국 개인정보 보호법이 정한 안내 항목도 함께 적었습니다.
			</p>

			<h2 id="1">1. 처리하는 개인정보와 목적</h2>
			<div className="table-wrap">
				<table>
					<thead>
						<tr><th>구분</th><th>항목</th><th>목적</th><th>처리 근거(GDPR)</th></tr>
					</thead>
					<tbody>
						<tr><td>회원가입·로그인 (필수)</td><td>이메일, 비밀번호(단방향 암호화해 저장), 닉네임, 사는 곳(도시)</td><td>계정 생성과 관리, 본인 확인, 부정 이용 방지</td><td>계약 이행</td></tr>
						<tr><td>프로필 (선택)</td><td>상세 지역, 프로필 사진</td><td>프로필 표시</td><td>계약 이행</td></tr>
						<tr><td>Google로 가입 (선택)</td><td>Google 계정의 이메일, 이름(닉네임으로 사용), 프로필 사진 주소</td><td>가입과 로그인</td><td>계약 이행</td></tr>
						<tr><td>서비스 이용</td><td>상품·글·댓글과 사진, 거래 위치(동네, 또는 회원이 고른 경우 정확한 위치), 채팅 메시지, 찜·공감·저장, 신고와 차단 기록, 알림과 알림 설정</td><td>서비스 제공</td><td>계약 이행</td></tr>
						<tr><td>구인 글 연락처 (선택)</td><td>전화번호, 이메일</td><td>로그인한 회원이 &lsquo;연락처 보기&rsquo;를 누르면 보여줌(본 횟수 기록)</td><td>계약 이행</td></tr>
						<tr><td>알림 메일</td><td>이메일</td><td>댓글, 채팅 등 알림 메일 발송(알림 설정이나 메일의 수신 거부 링크로 끌 수 있음)</td><td>계약 이행</td></tr>
						<tr><td>웹 푸시 (선택)</td><td>기기의 푸시 수신 주소와 암호화 키</td><td>휴대폰·브라우저 푸시 알림</td><td>동의(알림 설정에서 켜고 끔)</td></tr>
						<tr><td>신고 처리와 제재</td><td>신고 내용, 대상 게시물·대화, 이용 정지 기록</td><td>사기와 괴롭힘을 막고 안전하게 운영</td><td>정당한 이익, 법적 의무</td></tr>
						<tr><td>자동으로 생기는 정보</td><td>접속 IP 주소, 오류 기록</td><td>로그인·비밀번호 찾기 시도 횟수 제한, 장애 대응</td><td>정당한 이익</td></tr>
					</tbody>
				</table>
			</div>
			<p>
				IP 주소는 시도 횟수를 세는 데만 서버 메모리에서 쓰며 저장하지 않습니다(15분~1시간 뒤 사라짐).
				오류 기록에는 이메일 주소 등이 남을 수 있으며, 서비스마다 일정 용량(약 30MB)을 넘으면 오래된 기록부터 지워집니다.
				운영자는 광고나 행동 분석을 위해 개인정보를 쓰지 않고, 개인정보를 판매하지 않습니다.
			</p>

			<h2 id="2">2. 보유 기간과 탈퇴 시 처리</h2>
			<ul>
				<li><strong>회원 정보</strong>: 탈퇴할 때까지 보관합니다.</li>
				<li><strong>탈퇴하면 바로 삭제</strong>: 계정과 로그인 정보, 프로필 사진, 올린 상품과 사진, 찜·공감·저장, 알림, 푸시 기기 정보, 내가 한 차단</li>
				<li><strong>집·알바 글</strong>: 탈퇴하거나 글을 삭제하면 바로 비공개가 되고 사진은 즉시 삭제됩니다. 글 내용은 신고와 분쟁 대응을 위해 {keep} 보관한 뒤 삭제합니다.</li>
				<li><strong>커뮤니티 글과 댓글</strong>: 탈퇴한 뒤에도 작성자를 알 수 없는 상태(&ldquo;탈퇴한 회원&rdquo;)로 남습니다. 탈퇴 전에 직접 삭제할 수 있으며, 삭제한 글은 {keep} 뒤 완전히 지워집니다.</li>
				<li><strong>채팅과 신고 기록</strong>: 탈퇴한 회원이 참여한 채팅과, 그 회원이 하거나 받은 신고는 분쟁과 사기 신고 대응을 위해 탈퇴 후 {keep} 보관한 뒤 자동으로 삭제합니다. 그동안 대화 상대는 대화 내용을 볼 수 있습니다.</li>
				<li><strong>알림</strong>: {NOTIFICATION_RETENTION.ko}이 지나면 자동으로 삭제합니다.</li>
				<li><strong>비밀번호 재설정 링크</strong>: 1시간 동안만 유효하며 한 번 쓰면 사라집니다.</li>
				<li>법령이 더 오래 보관하도록 정한 경우에는 그 기간 동안 보관합니다.</li>
			</ul>

			<h2 id="3">3. 개인정보의 제3자 제공</h2>
			<p>
				운영자는 개인정보를 제3자에게 제공하지 않습니다. 다만 회원이 스스로 공개한 정보(닉네임, 게시물, 구인 글 연락처)는 다른 이용자가 볼 수 있고,
				법원이나 수사기관이 법령에 따라 요청하는 경우에는 필요한 범위에서 제공할 수 있습니다.
			</p>

			<h2 id="4">4. 처리 위탁과 국외 이전</h2>
			<p>서비스 운영을 위해 아래 회사가 개인정보를 처리합니다. 회원 정보는 프랑스(파리)에 있는 서버에 저장됩니다.</p>
			<div className="table-wrap">
				<table>
					<thead>
						<tr><th>받는 곳 (국가)</th><th>항목</th><th>목적</th><th>시기와 방법</th><th>보유 기간</th></tr>
					</thead>
					<tbody>
						<tr><td>{HOST.name} (룩셈부르크 법인, 서버 위치 {HOST.region})</td><td>위 1번의 모든 정보</td><td>서버, 데이터베이스, 사진 저장, 이메일 발송</td><td>서비스를 이용할 때 암호화된 연결로 전송</td><td>2번의 보유 기간</td></tr>
						<tr><td>OpenStreetMap Foundation (영국)</td><td>지도를 볼 때 브라우저의 접속 IP, 위치 검색어와 좌표(서버가 회원 정보 없이 전달)</td><td>지도 표시, 주소·동네 찾기</td><td>지도를 보거나 위치를 검색할 때</td><td>OSMF 정책에 따름</td></tr>
						<tr><td>Google LLC (미국)</td><td>Google 로그인 과정의 정보</td><td>Google 로그인 (선택한 경우만)</td><td>로그인할 때</td><td>Google 정책에 따름</td></tr>
						<tr><td>브라우저 푸시 서비스 (사용하는 브라우저에 따라 Google, Mozilla, Apple 등)</td><td>기기의 푸시 주소, 알림 제목과 짧은 내용</td><td>푸시 알림 전달 (켠 경우만)</td><td>알림을 보낼 때</td><td>전달 후 각 회사 정책에 따름</td></tr>
					</tbody>
				</table>
			</div>
			<p>
				유럽연합 밖으로 전송되는 경우에는 적정성 결정이나 표준계약조항 등 GDPR이 정한 보호 장치가 적용됩니다.
				국외 이전을 원하지 않으면 Google 로그인 대신 이메일로 가입하고 푸시 알림을 켜지 않으면 됩니다. 지도는 위치를 고르고 볼 때 필요합니다.
			</p>

			<h2 id="5">5. 개인정보의 파기</h2>
			<p>
				보유 기간이 끝나거나 탈퇴하면 데이터베이스에서 지우고, 사진 파일은 저장소에서 삭제합니다. 기간이 정해진 기록은 기간이 지나면 자동으로 삭제되며,
				실제로 지워지기까지 며칠이 걸릴 수 있습니다. 종이 문서로는 개인정보를 보관하지 않습니다.
			</p>

			<h2 id="6">6. 이용자의 권리와 행사 방법</h2>
			<ul>
				<li>열람과 정정: 마이페이지에서 닉네임과 프로필 사진을 바꿀 수 있고, 내 글과 상품은 직접 수정할 수 있습니다.</li>
				<li>삭제: 글·상품·댓글은 직접 삭제하고, 계정은 마이페이지의 &lsquo;회원 탈퇴&rsquo;로 삭제합니다.</li>
				<li>처리 정지와 반대, 동의 철회: 알림 메일과 푸시는 알림 설정에서 끌 수 있습니다.</li>
				<li>이동: 내 정보를 기계가 읽을 수 있는 형식으로 받고 싶으면 요청해주세요.</li>
				<li>프랑스 법에 따라, 사망한 뒤 내 개인정보를 어떻게 처리할지 지시를 남길 수 있습니다.</li>
			</ul>
			<p>위 권리는 {email}로 요청할 수 있으며, 운영자는 본인 확인 후 1개월 안에 답합니다.</p>

			<h2 id="7">7. 아동의 개인정보</h2>
			<p>만 {MIN_AGE}세 미만은 가입할 수 없습니다. 만 {MIN_AGE}세 미만이 가입한 사실을 알게 되면 계정을 삭제합니다.</p>

			<h2 id="8">8. 안전성 확보 조치</h2>
			<ul>
				<li>비밀번호는 복원할 수 없는 방식(bcrypt)으로 암호화해 저장하고, 비밀번호 재설정 링크도 해시값만 저장합니다.</li>
				<li>모든 통신은 HTTPS로 암호화하며, 로그인 쿠키는 스크립트가 읽을 수 없게(HttpOnly) 설정합니다.</li>
				<li>로그인과 비밀번호 찾기 시도 횟수를 제한합니다.</li>
				<li>서버 접근 권한을 필요한 최소한으로 제한하고, 관리자 권한은 요청마다 다시 확인합니다.</li>
			</ul>

			<h2 id="9">9. 쿠키와 브라우저 저장소</h2>
			<p>
				로그인 상태를 유지하는 쿠키 하나(token, 24시간)만 씁니다. 서비스에 꼭 필요한 쿠키라 별도 동의 없이 사용합니다.
				고른 지역 필터는 브라우저 저장소(localStorage)에 저장해 다음 방문 때 그대로 보여줍니다. 광고나 분석용 쿠키는 쓰지 않습니다.
			</p>

			<h2 id="10">10. 개인정보 보호책임자</h2>
			<p>
				개인정보 보호책임자: <Fill value={OPERATOR.privacyOfficer} lang="ko" label="이름" /> · 연락처: {email}
			</p>

			<h2 id="11">11. 권익 침해 구제 방법</h2>
			<p>운영자의 답변이 만족스럽지 않으면 아래 기관에 신고하거나 상담할 수 있습니다.</p>
			<ul>
				<li>프랑스 개인정보 감독기관 CNIL: 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 · <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">www.cnil.fr</a> (프랑스어로 작성)</li>
				<li>개인정보분쟁조정위원회: (국번 없이) 1833-6972 · <a href="https://www.kopico.go.kr" target="_blank" rel="noopener noreferrer">www.kopico.go.kr</a></li>
				<li>개인정보침해신고센터: (국번 없이) 118 · <a href="https://privacy.kisa.or.kr" target="_blank" rel="noopener noreferrer">privacy.kisa.or.kr</a></li>
				<li>대검찰청: (국번 없이) 1301 · <a href="https://www.spo.go.kr" target="_blank" rel="noopener noreferrer">www.spo.go.kr</a></li>
				<li>경찰청: (국번 없이) 182 · <a href="https://ecrm.police.go.kr" target="_blank" rel="noopener noreferrer">ecrm.police.go.kr</a></li>
			</ul>

			<h2 id="12">12. 방침의 변경</h2>
			<p>
				이 방침을 바꿀 때는 시행 7일 전(중요한 변경은 30일 전)부터 서비스 화면이나 이메일로 알립니다. 이 방침은 {legalDate("ko")}부터 시행합니다(버전 {LEGAL_VERSION}).
				함께 보기: <Link href="/terms">이용약관</Link>
			</p>
		</>
	);
}
