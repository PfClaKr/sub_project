# 잇냥 커뮤니티 설계

잇냥을 중고거래에서 **프랑스 한인 생활 플랫폼**으로 넓힙니다. 중고거래 옆에 커뮤니티(자유, 생활 Q&A), 집, 알바를 같은 비중으로 둡니다.

## 1. 조사 요약

| 사이트 | 지역 | 주요 메뉴 |
|---|---|---|
| 프랑스존 | 프랑스 | 알바존, 내집찾기·보금자리, 벼룩시장, 자유공감, 지식과정보, 지방커뮤니티, 업체등록 |
| 베를린리포트 | 독일 | 자유투고, 생활문답, 벼룩시장, 구인구직, 행사알림, 유학마당, 독어마당, 등업 규칙 |
| 헤이코리안 | 미국 | 렌트·룸메이트·서블렛, 구인구직, 사고팔기(지역별), 업소록, 클럽 |
| 호주나라·우리멜번 | 호주 | 쉐어·렌트(주 단위 가격), 구인/구직/과외, 사고팔고, 자동차, 업소록. 글쓰기에 로그인과 포인트 필요, 구인 사기 공지와 자동 필터 |
| 당근 동네생활·모임 | 한국 | 동네질문, 동네소식, 주제별 모임(가입 질문, 승인), 관심사 카페 |

**공통점**
- 게시판 구성: 자유, 생활 Q&A, 집, 구인구직, 벼룩시장, 행사, 업소록, 지역 게시판이 거의 모든 사이트에 있습니다.
- 운영 방식: 로그인 후 글쓰기, 등업제, 게시판 규칙, 사기 주의 공지를 둡니다.

**기존 사이트의 약점과 잇냥이 메울 부분**
- **사기:**
  - 문제: 집을 보기 전 보증금 송금, "귀국 처분" 선입금 후 잠적, 카톡·텔레그램으로 연락 유도, 한 사람이 여러 아이디로 반복 게시하는 수법이 많습니다.
  - 잇냥: 연락은 잇냥 채팅을 기본으로 하고, 위험 표현을 감지하고, 신고가 쌓이면 자동으로 숨기고, 집·알바 글은 가입 후 일정 기간이 지나야 쓸 수 있게 합니다.
- **2000년대식 목록:**
  - 문제: 제목, 닉네임, 조회수만 있고 가격·기간·위치 필터가 없습니다.
  - 잇냥: 집·알바를 구조화된 글로 받고, 지도 동네 경계와 필터를 붙입니다.
- **답이 쌓이지 않음:**
  - 문제: 같은 질문이 반복되고 정보가 카톡 오픈채팅으로 흩어집니다.
  - 잇냥: Q&A에 채택 답변을 두고, 질문을 쓰는 중에 비슷한 질문을 추천하고, 한글 검색(초성·오타)을 씁니다.

## 2. 결정 사항

| 항목 | 결정 |
|---|---|
| 지역 | 프랑스부터 엽니다. 데이터에는 `Country`(기본 `FR`)와 `City`를 넣어 다른 나라로 확장할 수 있게 합니다 |
| 첫 버전 게시판 | 자유, 생활 Q&A, 집(렌트·쉐어·서블렛), 알바 |
| 집·알바 글 형식 | 구조화된 글: 필드, 지도, 필터, 정렬 |
| 신뢰 장치 | 표준: 신고와 자동 숨김, 집·알바는 인증 후 7일, 위험 표현 경고, 반복 게시 차단 |
| 연락 | 잇냥 채팅이 기본입니다. 알바 글만 전화·이메일을 선택으로 공개하고, 로그인한 사람에게만 보여줍니다 |
| 익명 | 자유·Q&A 글과 댓글만 선택 익명입니다. 관리자는 작성자를 볼 수 있습니다 |
| 내비게이션 | 중고, 커뮤니티, 집, 알바를 같은 비중의 탭으로 둡니다. 홈은 네 영역의 새 글을 모은 허브입니다 |
| 알림 | 사이트 내 알림과 이메일 알림을 넣습니다. 웹 푸시는 채널 구조만 열어 두고 나중에 붙입니다 |

## 3. 정보 구조

```
헤더(데스크톱)  잇냥 | 중고 · 커뮤니티 · 집 · 알바 | [검색] [글쓰기] [채팅] [알림] [내 정보]
하단 탭(모바일) 홈 · 중고 · 커뮤니티 · 집 · 알바   (채팅·알림은 상단 아이콘)
```

| 경로 | 화면 |
|---|---|
| `/` | 허브: 검색창, 영역별 새 글(중고 카드, Q&A 미해결, 새 집, 새 알바), 안전 수칙 배너 |
| `/market` (기존 `/search`) | 중고거래 |
| `/community`, `/community?board=qna&topic=체류증` | 자유·Q&A 목록(주제 칩, 해결/미해결 필터) |
| `/community/[postId]` | 글 상세, 댓글, 채택 |
| `/housing`, `/housing/[postId]` | 집 목록(필터, 지도 보기)과 상세 |
| `/jobs`, `/jobs/[postId]` | 알바 목록과 상세 |
| `/write?type=qna\|free\|housing\|job` | 글쓰기(종류별 폼) |
| `/notifications` | 알림 목록 |
| `/myaccount/activity`, `/myaccount/notifications` | 내 글·댓글·북마크, 알림 설정 |
| `/safety` | 안전 가이드: 보증금·구인 사기 수법, 신고 방법, 현지 신고처 |
| `/search?q=` | 통합 검색: 중고, 커뮤니티, 집, 알바 탭 |

지역 선택: 지금 쓰는 `Regions`(파리, 일드프랑스, 리옹, 마르세유, 툴루즈, 스트라스부르, 니스, 프랑스 기타, 기타 유럽)를 그대로 `City`로 씁니다. 헤더의 지역 칩으로 바꾸면 모든 탭의 기본 필터가 됩니다. 기본값은 가입할 때 입력한 거주지입니다.

## 4. 게시판별 기능

### 4-1. 자유와 생활 Q&A

- **주제:**
  - 자유: 일상, 정보, 맛집·장보기, 행사·모임, 고민
  - Q&A: 체류증·비자, 행정(CAF·세금·보험), 은행·통신, 학교·어학, 의료, 집·이사, 일·취업, 기타
- **본문:** 제목, 본문(텍스트와 줄바꿈, 링크 자동 연결), 사진 5장(기존 `ImageUploader` 재사용)
- **댓글:** 대댓글은 1단계까지만 받습니다. 공감(좋아요)과 북마크가 있습니다.
- **Q&A 채택:**
  - 질문자가 답변 하나를 채택하면 글이 "해결됨"이 되고, 채택 답변이 본문 바로 아래로 올라옵니다.
  - 채택된 답변은 삭제할 수 없고, 수정하면 "수정됨"이 표시됩니다.
- **비슷한 질문 추천:** 질문 제목을 쓰는 동안 기존 질문을 검색해서 보여줍니다. 해결된 질문을 먼저 보여줍니다.
- **선택 익명:**
  - 글과 댓글에 "익명으로 쓰기"를 둡니다. 한 글 안에서는 `익명1`, `익명2`처럼 같은 사람에게 같은 번호를 붙이고, 글쓴이는 "글쓴이"로 표시합니다.
  - 작성자는 DB에 남아서 관리자, 신고, 제재에 그대로 쓰입니다.
  - 프로필의 "작성한 글"에는 익명 글이 다른 사람에게 보이지 않습니다.
- **정렬:** 최신순과 인기순(공감·댓글·시간 감쇠)이 있고, Q&A에는 미해결순이 추가됩니다.

### 4-2. 집 (렌트·쉐어·서블렛)

| 필드 | 내용 |
|---|---|
| 글 종류 | 방 있어요(제공) / 방 구해요(구함) |
| 형태 | 쉐어(colocation), 스튜디오·원룸, 아파트 전체, 서블렛, 단기·민박 |
| 월세 | € 숫자와 관리비 포함 여부(charges comprises) |
| 보증금 | € 숫자 |
| 입주 가능일 | 날짜 |
| 기간 | 최소 개월 또는 종료일. 서블렛은 종료일 필수 |
| 면적·방 수 | m², 방 수 |
| 옵션 | 가구 포함(meublé), CAF(APL) 신청 가능, 반려동물 가능 |
| 위치 | 지도. **동네 경계만** 표시하고 정확한 핀은 받지 않습니다(사생활 보호) |
| 사진 | "방 있어요"는 1장 이상 필수 |

- **목록:**
  - 필터: 형태, 월세 범위, 입주일, 지역 또는 +N km, 가구, CAF
  - 정렬: 최신순, 월세 낮은순, 입주일순
  - 목록과 지도 보기를 전환할 수 있습니다. 지도에는 동네별 묶음을 표시합니다.
- **상세:** 상단에 고정 안전 배너를 둡니다. "집을 직접 보고 계약서를 쓰기 전에는 보증금·월세를 송금하지 마세요."
- **상태와 만료:**
  - 상태는 모집중, 예약중, 완료입니다.
  - 30일이 지나면 자동으로 만료됩니다. 만료 3일 전에 알림을 보내고, 버튼 하나로 연장할 수 있습니다. 끌어올리기는 하루 1회입니다.
- **연락:** 잇냥 채팅만 씁니다. 집 글에는 연락처 필드가 없습니다.

### 4-3. 알바

| 필드 | 내용 |
|---|---|
| 글 종류 | 구인 / 구직 |
| 업종 | 식당·카페, 판매·매장, 사무, 과외·강사, 베이비시터, 가이드·통역, 기타 |
| 고용 형태 | 알바(시간제), 정규직, 인턴(stage), 프리랜서 |
| 급여 | 시급 또는 월급 € 숫자, 또는 "협의" |
| 근무 | 지역(지도 동네 또는 가게 정확한 위치), 요일·시간(텍스트) |
| 요건 | 근로 가능 체류증 필요 여부, 언어(한국어·프랑스어·영어 수준) |
| 연락처 | 구인 글만 전화·이메일을 선택해서 공개합니다. 로그인한 사람에게만 보이고, "연락처 보기"를 누를 때 열람 기록을 남깁니다 |

- **법적 주의:**
  - 프랑스 차별금지 규정 때문에 구인 글에 **성별, 나이, 국적 조건 입력란을 두지 않습니다**. "한국어 가능" 같은 직무 요건만 받습니다.
  - 시급이 최저임금(SMIC)보다 낮으면 작성 시 경고합니다. SMIC 금액은 설정값으로 두고 해마다 갱신합니다.
  - 정확한 법 기준은 출시 전에 확인해야 합니다.
- **목록:**
  - 필터: 업종, 고용 형태, 지역 또는 +N km, 체류증 요건
  - 정렬: 최신순, 시급 높은순
- **만료:** 집과 같습니다(30일, 연장, 끌어올리기).

## 5. 공통 기능

- **작성 자격:**
  - 로그인과 이메일 인증이 필요합니다.
  - 집·알바 글은 인증 후 **7일**이 지나야 쓸 수 있습니다(설정값). 관리자는 예외입니다.
  - 정지된 회원은 글, 댓글, 채팅을 쓸 수 없습니다.
- **검색:**
  - Elasticsearch에 새 인덱스 `posts`(alias)를 만들고, `korean.go`의 자모·초성 처리를 제목에 그대로 씁니다.
  - 목록, 필터, 정렬, 페이지도 모두 ES로 처리합니다. DynamoDB는 원본 저장소로만 둡니다. 상품 검색과 같은 구조입니다.
- **채팅 일반화:**
  - 지금 채팅방은 `ProductId`에 묶여 있습니다. `SubjectType`(product, housing, job)과 `SubjectId`를 추가합니다.
  - 새 채팅방 ID는 `uuid.NewSHA1(ns, type:id:buyer)`로 만들고, 상품 채팅방은 기존 공식을 그대로 써서 호환을 유지합니다.
  - 채팅 목록 카드에는 대상 종류별 제목과 썸네일을 보여줍니다.
- **프로필:** 가입일, 이메일 인증 배지, 활동(글·댓글 수)을 보여줍니다. 받은 신고 수는 공개하지 않습니다.
- **탈퇴:**
  - 집·알바·중고 글은 삭제합니다.
  - 자유·Q&A 글과 댓글은 "탈퇴한 회원"으로 표시하고 남깁니다. Q&A 정보가 쌓이도록 하기 위해서입니다.
  - 본인이 원하면 탈퇴 전에 일괄 삭제할 수 있게 합니다. 아래 확인 필요 항목 1번입니다.

## 6. 신뢰·안전 (표준)

| 장치 | 동작 |
|---|---|
| 신고 | 사유: 사기 의심, 스팸·광고, 욕설·혐오, 개인정보 노출, 불법(미신고 고용 등), 기타. 같은 사람은 같은 대상을 한 번만 신고할 수 있습니다(결정적 ID와 조건부 저장) |
| 자동 숨김 | 가입 7일 이상 된 **서로 다른 3명**이 신고하면 글·댓글을 숨기고 관리자 검토 큐에 올립니다. 작성자에게는 "검토 중"으로 보입니다 |
| 위험 표현 감지 | 순수 함수로 만들고 단위 테스트합니다. 아래 표현이 있으면 작성할 때 경고 모달을 띄웁니다(그래도 게시할 수 있음). 글에 플래그를 남겨 검토 큐에서 먼저 보이게 하고, 상세에는 안전 배너를 띄웁니다. 감지 대상: 카톡·텔레그램·왓츠앱·라인 ID와 전화번호(집 글 본문), "선입금", "보증금 먼저", "송금 후", Western Union, 해외 계좌 |
| 반복 게시 | 같은 사용자가 24시간 안에 제목+본문 해시가 같은 글을 올리면 막습니다. 동시에 올릴 수 있는 글 수에 상한을 둡니다(집 3개, 알바 5개) |
| 속도 제한 | 글은 시간당 5개, 댓글은 분당 5개입니다(설정값) |
| 제재 | `Users.Status`: active / suspended(`SuspendedUntil`). 관리자 페이지에서 기간 정지와 해제를 합니다 |
| 관리자 | 신고 큐(대상 미리보기, 신고 사유 모음, 숨김 해제·삭제·작성자 정지), 게시글 관리, 익명 글 작성자 조회 |
| 안전 가이드 | `/safety`에 사기 수법, 예방 수칙, 잇냥 신고 방법, 현지 신고처를 정리합니다. 현지 신고처는 17Cyber, PHAROS, 경찰·긴급번호, 주프랑스 대사관 영사과(대표·당직 번호, 2026-10 확인)입니다 |

차단(특정 사용자의 글·채팅 숨기기)은 2차로 미룹니다.

## 7. 알림

### 이벤트

| 이벤트 | 사이트 내 | 이메일(기본값) |
|---|---|---|
| 내 글에 댓글 | O | 묶음 발송 |
| 내 댓글에 답글 | O | 묶음 발송 |
| 내 답변이 채택됨 | O | 즉시 |
| 새 채팅 메시지(접속하지 않은 상태) | 채팅 배지 | 묶음 발송 |
| 내 글 만료 3일 전 | O | 즉시 |
| 내 글이 신고로 숨김 또는 복구됨 | O | 즉시 |
| 관리자 공지 | O | 끔 |

### 구조

```
apiserver(글·댓글·채택·만료)  ┐
chatserver(새 메시지)         ┼─> package/notify.Publish(event)
관리자(숨김·공지)             ┘          │
                                         ├─ Notifications 테이블 저장 (사이트 내, 90일 TTL)
                                         ├─ Users.UnreadCount += 1 (헤더 배지는 GetItem 한 번)
                                         └─ 채널 분배: 사용자 설정(이벤트 × 채널)에 따라
                                              ├─ email: 즉시 또는 묶음 대기(EmailState=pending)
                                              └─ push:  인터페이스만(Phase 5에서 Web Push)
apiserver 백그라운드 워커: 15분마다 pending을 사용자별로 묶어 한 통으로 보냅니다
```

- **채널 인터페이스:** `type Channel interface { Send(ctx, user, []Notification) error }`. 이메일 채널을 먼저 만들고, 푸시는 나중에 같은 인터페이스로 끼웁니다.
- **메일 코드 이동:** 메일 발송 코드는 loginserver의 `mailer`를 `package/mailer`로 옮겨서 함께 씁니다.
- **수신 거부:** 모든 메일에 서명된 토큰 링크를 넣고 원클릭 수신 거부(`List-Unsubscribe` 헤더 포함)를 지원합니다. 수신 거부는 이메일 채널만 끕니다.
- **사이트 내 알림 갱신:** 헤더 배지는 60초 주기와 창이 포커스될 때 갱신합니다. 나중에 chatserver 웹소켓으로 실시간 전환할 수 있습니다.
- **웹 푸시(Phase 5):**
  - VAPID 키, `PushSubscriptions` 테이블(UserId + endpoint 해시), 기존 `public/sw.js`에 `push` 이벤트를 추가합니다.
  - iOS는 홈 화면에 설치한 PWA에서만 받을 수 있다고 안내합니다.

## 8. 데이터 모델 (DynamoDB, 모두 온디맨드)

| 테이블 | 키 | 주요 속성 |
|---|---|---|
| `Posts` | `PostId` | `Type`(free, qna, housing, job), `Topic`, `Country`, `City`, `AuthorId`, `Anonymous`, `AnonMap`(작성자 → 익명 번호), `Title`, `Body`, `Images`, `Status`(active, hidden, closed, expired, deleted), `Flags`, `CreatedAt`, `BumpedAt`, `ExpiresAt`, `CommentCount`, `LikeCount`, `ViewCount`, `AcceptedCommentId`, 위치(`Latitude`, `Longitude`, `AreaId`, `AreaName`), `Housing`(map), `Job`(map), `Contact`(map). GSI `AuthorIndex`(AuthorId, CreatedAt) |
| `Comments` | `PostId` + `CommentId`(시간순 정렬 키) | `AuthorId`, `ParentId`, `Body`, `Anonymous`, `AnonNo`, `Status`, `CreatedAt`. GSI `AuthorIndex` |
| `PostLikes`, `Bookmarks` | `UserId` + `PostId` | `CreatedAt` (`Favorites`와 같은 패턴) |
| `Reports` | `ReportId` = SHA1(대상:신고자) | `TargetType`, `TargetId`, `ReporterId`, `Reason`, `Detail`, `Status`(open, resolved, dismissed), `CreatedAt` |
| `Notifications` | `UserId` + `SortKey`(CreatedAt#Id) | `Type`, `ActorId`, `TargetType`, `TargetId`, `Preview`, `Read`, `EmailState`, `ExpiresAt`(TTL 90일) |
| `PushSubscriptions` (Phase 5) | `UserId` + `EndpointHash` | `Endpoint`, `Keys`, `CreatedAt` |
| `Users`에 추가 | | `Status`, `SuspendedUntil`, `UnreadCount`, `NotifyPrefs`(map), `VerifiedAt` |
| `ChatRooms`에 추가 | | `SubjectType`, `SubjectId` |

- **목록 조회:** 커뮤니티 목록은 처음부터 테이블 전체를 스캔하지 않습니다. 목록·필터는 ES로 처리하고 "내 글"은 GSI로 조회합니다.
- **카운터:** 댓글 수와 공감 수는 `UpdateItem ADD`로 원자적으로 올립니다. 조회수는 같은 사용자의 중복 조회를 막지 않는 단순 증가로 둡니다(MVP).
- **배포 반영:** `deploy/aws-setup.sh`의 IAM 정책에 새 테이블과 `Query`(GSI), TTL 설정을 추가합니다.

## 9. API

GraphQL(apiserver)에 추가합니다. 지금 `buildSchema`는 SDL의 `input` 타입을 지원하지 않아서, **먼저 input 타입 지원을 넣습니다**. 집·알바 필드를 `HousingInput`과 `JobInput`으로 받기 위해서입니다.

```graphql
type Query {
  posts(Type: String!, Topic: String, City: String, Q: String, Solved: Boolean,
        Housing: HousingFilter, Job: JobFilter, AreaId: String,
        Latitude: Float, Longitude: Float, DistanceKm: Float,
        Sort: String, Page: Int): PostPage
  post(PostId: String!): Post            # 조회수 +1
  comments(PostId: String!): [Comment]
  similarQuestions(Title: String!): [Post]
  myPosts(Type: String): [Post]
  myBookmarks: [Post]
  notifications(Before: String): NotificationPage
  unreadCount: Int
}
type Mutation {
  createPost(Input: PostInput!): Post    # 자격·속도·중복 검사, 위험 표현은 Warnings로 응답
  updatePost(PostId: String!, Input: PostInput!): Post
  deletePost(PostId: String!): Boolean
  setPostStatus(PostId: String!, Status: String!): Post   # 예약중·완료
  extendPost(PostId: String!): Post      # 만료 연장
  bumpPost(PostId: String!): Post        # 하루 1회
  likePost(PostId: String!, On: Boolean!): Post
  bookmarkPost(PostId: String!, On: Boolean!): Boolean
  createComment(PostId: String!, Body: String!, ParentId: String, Anonymous: Boolean): Comment
  deleteComment(PostId: String!, CommentId: String!): Boolean
  acceptAnswer(PostId: String!, CommentId: String!): Post
  revealContact(PostId: String!): Contact
  report(TargetType: String!, TargetId: String!, Reason: String!, Detail: String): Boolean
  markNotificationsRead(Ids: [String!]): Int
  updateNotifyPrefs(Prefs: NotifyPrefsInput!): User
}
```

- **관리자 REST:** `/admin/reports`(큐, 처리), `/admin/posts`, `/admin/users/{id}/suspend`
- **수신 거부:** `GET /notifications/unsubscribe?token=` (서명 토큰, 로그인 불필요)
- **채팅:** chatserver에 `GET /room/{subjectType}/{subjectId}`를 추가합니다. 기존 `/room/product/{productId}`는 그 경로의 product 경우로 그대로 동작합니다.

## 10. 사용자 흐름

**1. 새로 온 유학생의 질문**
가입 → 이메일 인증 → 커뮤니티 Q&A에서 "체류증 갱신" 검색 → 채택된 답변을 읽음 → 원하는 답이 없어 질문 작성 → 제목을 쓰는 동안 비슷한 질문 추천 → 그대로 게시 → 답변이 달리면 사이트 내 알림과 이메일(묶음) → 답변 채택 → 답변자에게 채택 알림.

**2. 집 구하기**
집 탭 → 쉐어, 월세 €700 이하, 9월 입주, 파리 15구 +3km, CAF 가능 필터 → 지도 보기 → 상세(동네 경계, 안전 배너) → "채팅으로 문의" → 상대가 "보증금 먼저 보내주세요"라고 요구 → 채팅방에서 신고 → 서로 다른 3명이 신고하면 글 자동 숨김 → 관리자가 확인하고 작성자 정지.

**3. 방 내놓기 (인증 7일 경과 회원)**
글쓰기 → "방 있어요" → 필드, 사진, 동네 선택 → 본문에 카톡 ID를 쓰면 "연락은 잇냥 채팅으로 받아요" 경고 → 수정 후 게시 → 27일째 만료 임박 알림 → 연장하거나 "완료"로 변경.

**4. 가게 구인**
알바 → 구인 → 식당, 시급, 근무 시간, 체류증 요건, 전화번호 공개 선택 → 구직자는 로그인 후 "연락처 보기" 또는 채팅.

**5. 관리자**
관리자 → 신고 큐(플래그 글이 위) → 대상 미리보기와 신고 사유 모음 확인 → 숨김 유지·삭제·복구, 작성자 7일 정지 → 작성자에게 결과 알림.

## 11. 구현 단계

단계마다 PR을 하나씩(필요하면 백엔드와 프론트로 나눠서) 올립니다.

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. 기반** (완료) | `buildSchema` input 타입 지원, `package/mailer` 분리, `package/notify`(사이트 내 저장, 알림 GraphQL), 새 테이블과 IAM, `package/account` 정지(모든 쓰기 차단, 관리자 API), 채팅 `SubjectType` 일반화(호환), 섹션 탭·모바일 하단 탭·알림 종·알림 페이지 | 기존 e2e 통과, 정지·알림·채팅 대상 e2e |
| **1. 커뮤니티** (완료) | 허브 홈, 지역 칩, 자유·Q&A 글, 댓글, 대댓글, 공감, 북마크, 선택 익명, 채택, 비슷한 질문, ES `posts` 인덱스, 목록·상세·글쓰기 UI, 신고(기본), 속도 제한, 사이트 내 알림(댓글·답글·채택) | e2e: 익명 번호, 채택 권한, 신고 중복 방지, 알림 생성 |
| **2. 집·알바** (완료) | 구조화 폼과 검증, 지도(집은 동네만), 필터·정렬·지도 보기, 만료·연장·끌어올리기(워커), 인증 7일 자격, 위험 표현 감지와 경고, 반복 게시 차단, 연락처 공개, 채팅 연결, 안전 배너, `/safety` | e2e: 자격 미달 403, 위험 표현 Warnings, 만료 처리 |
| **3. 운영** (완료) | 자동 숨김(3명), 관리자 신고 큐, 게시글 관리, 정지 UI, 익명 작성자 조회, 통계에 커뮤니티 지표 추가 | e2e: 자동 숨김과 관리자 복구 |
| **4. 이메일 알림** (완료) | 이메일 채널, 15분 묶음 워커, 즉시 이벤트, 알림 설정 화면, 서명 수신 거부 링크, `List-Unsubscribe` | MailHog로 묶음 메일과 수신 거부 e2e |
| **5. 웹 푸시** (완료) | VAPID, 구독 저장, sw.js push, 채널 등록 | 설치한 PWA에서 수신 확인 |

**비용 영향:** 테이블은 온디맨드라 쓰지 않으면 과금되지 않습니다. ES 인덱스가 하나 늘어도 2GB 서버에 들어갑니다. 이메일은 묶음 발송이라 SES 비용이 거의 늘지 않습니다. 월 $12~13 구성을 그대로 유지합니다.

## 12. 확인 필요 항목

1. 탈퇴할 때 커뮤니티 글을 "탈퇴한 회원"으로 남기는 기본값이 괜찮은지(GDPR상 본인 요청 시 삭제 경로 필요)
2. 집 쉐어 글의 성별 선호 표시를 허용할지(프랑스 차별금지 규정 확인 필요). 기본값은 넣지 않는 것입니다.
3. ~~SMIC 금액과 PHAROS, 영사과 연락처는 출시 직전에 확인~~ 2026-10-17 확인: SMIC 시급 12.31유로(2026-06-01부터), 신고처에 17Cyber 추가, 영사과 대표·당직 번호 반영
4. 업소록, 모임·행사, 다른 나라 확장은 첫 버전 이후로 미룸

## 참고 자료

- 프랑스존 게시판: [벼룩시장](https://www.francezone.com/bbs/list.html?table=bbs_5), [알바존](https://www.francezone.com/bbs/list.html?table=bbs_1), [보금자리](https://www.francezone.com/bbs/list.html?table=bbs_4), [지방커뮤니티](https://www.francezone.com/bbs/list.html?table=bbs_11)
- [베를린리포트](https://berlinreport.com/), [생활문답](https://www.berlinreport.com/bbs/board.php?bo_table=lifeqna)
- [헤이코리안](https://www.heykorean.com/), [렌트](https://rent.heykorean.com/rent), [회사 소개](https://story.heykorean.com/)
- [호주나라](https://hojunara.com/), [우리멜번 구인 사기 주의](https://woorimel.com/melbourne-jobs/post/466822)
- [당근 동네생활 같이해요](https://about.daangn.com/company/pr/archive/%EB%8B%B9%EA%B7%BC%EB%A7%88%EC%BC%93-%EB%8F%99%EB%84%A4%EC%83%9D%ED%99%9C-%EA%B0%99%EC%9D%B4%ED%95%B4%EC%9A%94-%EB%A6%AC%EB%89%B4%EC%96%BC-%EC%98%A4%ED%94%88/), [당근 카페 도입](https://blog.nasmedia.co.kr/entry/2601mediaissue-daangn-cafe)
- [보스톤코리아 커뮤니티 (보증금 송금 주의)](https://bostonkorea.com/community/), [외교부 개인간 거래 사기 주의](https://overseas.mofa.go.kr/my-ko/brd/m_1923/view.do?seq=1346731)
