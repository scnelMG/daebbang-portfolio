-- ============================================================
-- 대빵 (구 빵트레이/BangTray) — MySQL 8 스키마 (ERD v9, 15 tables)
-- 원본 설계: docs/04_ERD_v9_1.dbml
-- 2026-09-08 요구사항 명세서 확정 반영:
--   * 서비스명 '대빵' 통일 / 소셜 로그인은 구글만 구현 (provider에 google 추가, kakao/naver 값은 유지)
--   * 추천은 회원 전용 (비회원 session_key 미도입) / 만족도 게이트·피드백 제외
--   * rank_no (1,2,3): 점수 상위 2 + 무작위 발견 1 (2026-09-21 — 데이터 없는 빵집 노출 기회)
--   * 점수 공식 v1-mest-hl180: score=(Σw·언급+m·μ)/(Σw·전체+m), w=0.5^(경과일/180),
--     α=n/(n+10) 행 단위 자동. scores에 m/μ 저장 컬럼 추가
--   * 폐업은 수동 판정 (자동 감지 배치 스코프 제외) / 랭킹 배치는 월별만 (주·일별은 실시간 조회)
--   * 태그 2티어(43개) 구조는 '수집 현황 문서' 확보 후 반영 예정 (현 시드 29개 유지)
-- MySQL 컨테이너 최초 기동 시 docker-entrypoint-initdb.d 로 자동 실행됨
-- (이미 데이터 볼륨이 있으면 실행되지 않음 — 재적용하려면 볼륨 삭제)
-- ============================================================

SET NAMES utf8mb4;
ALTER DATABASE bangtray CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bangtray;

-- ============================================================
-- 1. 회원
-- ============================================================

CREATE TABLE users (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NULL COMMENT 'NULL 허용 — 소셜 무이메일 가입, 탈퇴 익명화 시 NULL',
  password_hash VARCHAR(255) NULL COMMENT 'local 활성 회원만 필수 (CHECK로 강제)',
  nickname      VARCHAR(50)  NOT NULL COMMENT '랭킹 화면 공개값. 탈퇴 시 "탈퇴한사용자_{id}"로 치환',
  provider      ENUM('local','kakao','naver','google') NOT NULL DEFAULT 'local' COMMENT '구현은 local/google만 (2026-09-08 확정)',
  provider_id   VARCHAR(255) NULL COMMENT '소셜 고유 ID. 소셜 활성 회원만 필수, 탈퇴 시 NULL',
  status        ENUM('active','withdrawn') NOT NULL DEFAULT 'active',
  withdrawn_at  TIMESTAMP    NULL COMMENT '탈퇴(익명화 처리) 시각',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nickname (nickname),
  UNIQUE KEY uq_users_provider (provider, provider_id),
  -- 활성 회원에게만 적용되는 provider별 필수 컬럼 제약
  CONSTRAINT chk_local CHECK (
    status <> 'active' OR provider <> 'local'
    OR (password_hash IS NOT NULL AND email IS NOT NULL AND provider_id IS NULL)
  ),
  CONSTRAINT chk_social CHECK (
    status <> 'active' OR provider = 'local'
    OR (provider_id IS NOT NULL AND password_hash IS NULL)
  ),
  CONSTRAINT chk_withdrawn CHECK (
    status <> 'withdrawn'
    OR (email IS NULL AND password_hash IS NULL AND provider_id IS NULL)
  )
) ENGINE=InnoDB COMMENT='탈퇴 = 익명화(행 보존). 동일 이메일이라도 로컬/소셜은 별도 계정';

-- ============================================================
-- 2. 빵 / 태그 마스터
-- ============================================================

CREATE TABLE breads (
  id            INT          NOT NULL AUTO_INCREMENT,
  name          VARCHAR(30)  NOT NULL,
  image_url     VARCHAR(500) NULL,
  display_order INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_breads_name (name)
) ENGINE=InnoDB COMMENT='빵 8종 마스터 (픽스)';

CREATE TABLE tags (
  id          INT         NOT NULL AUTO_INCREMENT,
  bread_id    INT         NOT NULL,
  name        VARCHAR(30) NOT NULL,
  is_type_tag BOOLEAN     NOT NULL DEFAULT FALSE COMMENT 'true = 근본/사파 같은 유형 분류 태그',
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE  COMMENT '태그 폐기 = false (물리 삭제 금지)',
  PRIMARY KEY (id),
  UNIQUE KEY uq_tags_bread_name (bread_id, name),
  UNIQUE KEY uq_tags_id_bread (id, bread_id) COMMENT '복합 FK 대상용 — (tag_id, bread_id) 참조가 "그 빵의 태그"임을 강제',
  CONSTRAINT fk_tags_bread FOREIGN KEY (bread_id) REFERENCES breads (id)
) ENGINE=InnoDB COMMENT='빵별 태그 사전 — 사용자 선택/자체 리뷰/LLM 라벨링의 공용어';

-- ============================================================
-- 3. 빵집
-- ============================================================

CREATE TABLE bakeries (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  name             VARCHAR(100) NOT NULL,
  address          VARCHAR(255) NOT NULL,
  district         VARCHAR(30)  NULL COMMENT '구 단위(중구/유성구/서구...) — 표시용',
  map_url          VARCHAR(500) NULL COMMENT '네이버/카카오 지도 장소 페이지 링크',
  link_url         VARCHAR(500) NULL,
  image_url        VARCHAR(500) NULL,
  is_open          BOOLEAN      NOT NULL DEFAULT TRUE COMMENT '폐업 = false → 추천·목록 제외, 과거 데이터 보존',
  closed_at        TIMESTAMP    NULL,
  last_verified_at TIMESTAMP    NULL COMMENT '지도 API 영업 여부 최종 확인 시각',
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bakeries_name (name),
  KEY idx_bakeries_is_open (is_open)
) ENGINE=InnoDB COMMENT='빵산책 PDF + 대전 빵 축제 목록 기반 픽스';

CREATE TABLE saved_bakeries (
  user_id    BIGINT    NOT NULL,
  bakery_id  BIGINT    NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, bakery_id),
  CONSTRAINT fk_saved_user   FOREIGN KEY (user_id)   REFERENCES users (id),
  CONSTRAINT fk_saved_bakery FOREIGN KEY (bakery_id) REFERENCES bakeries (id)
) ENGINE=InnoDB COMMENT='저장한 빵집(북마크)';

-- ============================================================
-- 4. 추천 (리뷰 작성 화면 복원용 최소 스냅샷)
-- ============================================================

CREATE TABLE recommendations (
  id            BIGINT    NOT NULL AUTO_INCREMENT,
  user_id       BIGINT    NOT NULL,
  tray_snapshot JSON      NOT NULL COMMENT '"추천받기" 클릭 시점 트레이. 예: [{"bread":"소금빵","tags":["짭짤한 맛"]}]',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_reco_user FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE=InnoDB COMMENT='추천받기 1회 = 1행';

CREATE TABLE recommendation_results (
  id                BIGINT  NOT NULL AUTO_INCREMENT,
  recommendation_id BIGINT  NOT NULL,
  bakery_id         BIGINT  NOT NULL,
  rank_no           TINYINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reco_results (recommendation_id, rank_no),
  CONSTRAINT fk_recoresult_reco   FOREIGN KEY (recommendation_id) REFERENCES recommendations (id),
  CONSTRAINT fk_recoresult_bakery FOREIGN KEY (bakery_id)         REFERENCES bakeries (id),
  CONSTRAINT chk_rank CHECK (rank_no IN (1, 2, 3))  -- 3 = 무작위 발견 슬롯 (2026-09-21)
) ENGINE=InnoDB COMMENT='추천된 빵집 2곳. 리뷰의 "방문한 빵집" 자동 채움에 사용';

-- ============================================================
-- 5. 자체 리뷰
-- ============================================================

CREATE TABLE reviews (
  id                       BIGINT    NOT NULL AUTO_INCREMENT,
  user_id                  BIGINT    NOT NULL,
  bakery_id                BIGINT    NOT NULL,
  recommendation_result_id BIGINT    NULL COMMENT '어떤 추천을 받고 방문했는지 (직접 방문이면 NULL)',
  visit_date               DATE      NOT NULL,
  rating                   TINYINT   NOT NULL,
  custom_bread_names       JSON      NULL COMMENT '목록 외 빵 이름 (REVW-017) — 태그·집계 제외, 빵 종류 확장 근거 수집용',
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_reviews_user       FOREIGN KEY (user_id)                  REFERENCES users (id),
  CONSTRAINT fk_reviews_bakery     FOREIGN KEY (bakery_id)                REFERENCES bakeries (id),
  CONSTRAINT fk_reviews_recoresult FOREIGN KEY (recommendation_result_id) REFERENCES recommendation_results (id),
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB COMMENT='자체 리뷰. 라벨 클릭 + 별점만. 타 사용자에게 전면 비공개';

CREATE TABLE review_breads (
  id        BIGINT NOT NULL AUTO_INCREMENT,
  review_id BIGINT NOT NULL,
  bread_id  INT    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_breads (review_id, bread_id),
  UNIQUE KEY uq_review_breads_id_bread (id, bread_id) COMMENT '복합 FK 대상용',
  CONSTRAINT fk_rb_review FOREIGN KEY (review_id) REFERENCES reviews (id),
  CONSTRAINT fk_rb_bread  FOREIGN KEY (bread_id)  REFERENCES breads (id)
) ENGINE=InnoDB COMMENT='리뷰에서 "먹어본 빵" 단위. 빵별로 태그를 따로 선택';

CREATE TABLE review_bread_tags (
  review_bread_id BIGINT NOT NULL,
  tag_id          INT    NOT NULL,
  bread_id        INT    NOT NULL COMMENT '무결성 강제용 — 부모의 빵과 태그의 빵이 같음을 복합 FK 2개가 보장',
  PRIMARY KEY (review_bread_id, tag_id),
  -- "소금빵 리뷰에 베이글 태그" 같은 오류를 DB가 차단
  CONSTRAINT fk_rbt_review_bread FOREIGN KEY (review_bread_id, bread_id) REFERENCES review_breads (id, bread_id),
  CONSTRAINT fk_rbt_tag          FOREIGN KEY (tag_id, bread_id)          REFERENCES tags (id, bread_id)
) ENGINE=InnoDB COMMENT='리뷰 시 빵마다 클릭한 라벨 = 추천 데이터. 빵당 최대 2개는 앱 검증';

-- ============================================================
-- 6. 랭킹
-- ============================================================

CREATE TABLE monthly_user_rankings (
  id                   BIGINT     NOT NULL AUTO_INCREMENT,
  user_id              BIGINT     NOT NULL,
  `year_month`         VARCHAR(7) NOT NULL COMMENT '예: 2026-08 (YEAR_MONTH가 MySQL 예약어라 백틱 필요)',
  review_count         INT        NOT NULL DEFAULT 0,
  visited_bakery_count INT        NOT NULL DEFAULT 0,
  rank_no              INT        NOT NULL,
  calculated_at        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rankings_user_month (user_id, `year_month`),
  KEY idx_rankings_month_rank (`year_month`, rank_no),
  CONSTRAINT fk_rankings_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT chk_ranking_counts CHECK (review_count >= 0 AND visited_bakery_count >= 0),
  CONSTRAINT chk_ranking_rank CHECK (rank_no >= 1)
) ENGINE=InnoDB COMMENT='월별 리뷰 랭킹 배치 집계. rank 1 = 이달의 대빵';

-- ============================================================
-- 7. 외부 데이터 수집 파이프라인
-- ============================================================

CREATE TABLE collection_queries (
  id         BIGINT       NOT NULL AUTO_INCREMENT,
  source     ENUM('tistory','instagram','naver_cafe','naver_blog') NOT NULL,
  query_text VARCHAR(200) NOT NULL COMMENT '검색 형식: 빵집 이름 + 빵명',
  bakery_id  BIGINT       NULL,
  bread_id   INT          NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_queries_source_text (source, query_text),
  CONSTRAINT fk_queries_bakery FOREIGN KEY (bakery_id) REFERENCES bakeries (id),
  CONSTRAINT fk_queries_bread  FOREIGN KEY (bread_id)  REFERENCES breads (id)
) ENGINE=InnoDB COMMENT='수집할 검색 조건 정의. 실행 결과는 collection_runs에 누적';

CREATE TABLE collection_runs (
  id              BIGINT       NOT NULL AUTO_INCREMENT,
  query_id        BIGINT       NOT NULL,
  status          ENUM('running','success','failed') NOT NULL DEFAULT 'running',
  started_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at     TIMESTAMP    NULL,
  collected_count INT          NOT NULL DEFAULT 0 COMMENT '이번 실행에서 새로 저장된 문서 수',
  error_message   VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_runs_query_started (query_id, started_at),
  KEY idx_runs_status (status),
  CONSTRAINT fk_runs_query FOREIGN KEY (query_id) REFERENCES collection_queries (id),
  CONSTRAINT chk_collected_count CHECK (collected_count >= 0)
) ENGINE=InnoDB COMMENT='실행 1회 = 1행. 덮어쓰지 않고 누적 (실패 이력 추적)';

-- 리뷰 원문·메타는 MongoDB cleaned_reviews가 단일 원천 (MySQL 목차 없음)

CREATE TABLE document_labels (
  id           BIGINT    NOT NULL AUTO_INCREMENT,
  mongo_doc_id CHAR(24)  NOT NULL COMMENT 'MongoDB cleaned_reviews._id (논리 참조, FK 아님)',
  bakery_id    BIGINT    NOT NULL,
  bread_id     INT       NOT NULL,
  tag_id       INT       NOT NULL,
  published_at TIMESTAMP NULL COMMENT '리뷰 작성일 — ③이 Mongo에서 복사. ④ 시간 가중치용',
  labeled_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_labels_doc_tag (mongo_doc_id, tag_id) COMMENT '재실행 멱등성',
  KEY idx_labels_bakery_bread_tag (bakery_id, bread_id, tag_id),
  CONSTRAINT fk_labels_bakery FOREIGN KEY (bakery_id)        REFERENCES bakeries (id),
  CONSTRAINT fk_labels_tag    FOREIGN KEY (tag_id, bread_id) REFERENCES tags (id, bread_id)
) ENGINE=InnoDB COMMENT='③ LLM 라벨링 결과. 긍정 라벨만 — 행 존재 = 언급 1회';

-- ============================================================
-- 8. 집계 점수 (추천 엔진이 읽는 유일한 테이블)
-- ============================================================

CREATE TABLE bakery_bread_tag_scores (
  id                    BIGINT       NOT NULL AUTO_INCREMENT,
  bakery_id             BIGINT       NOT NULL,
  bread_id              INT          NOT NULL,
  tag_id                INT          NOT NULL,
  external_count        INT          NOT NULL DEFAULT 0 COMMENT '이 특징이 언급된 외부 문서 수 (분자)',
  external_sample_count INT          NOT NULL DEFAULT 0 COMMENT '이 빵집×빵의 전체 외부 문서 수 (분모)',
  internal_count        INT          NOT NULL DEFAULT 0 COMMENT '이 태그가 클릭된 자체 리뷰 수 (분자)',
  internal_sample_count INT          NOT NULL DEFAULT 0 COMMENT '이 빵집×빵의 전체 자체 리뷰 수 (분모)',
  external_score        DECIMAL(8,4) NULL COMMENT '= (Σw·언급 + m_ext·mu_ext) / (Σw·전체 + m_ext), w=0.5^(경과일/180)',
  internal_score        DECIMAL(8,4) NULL COMMENT '= (Σw·클릭 + m_int·mu_int) / (Σw·전체 + m_int)',
  m_ext                 DECIMAL(6,3) NULL COMMENT 'm-추정 외부 축소 계수 (초기 제안 5 — 파라미터 회의 대상)',
  m_int                 DECIMAL(6,3) NULL COMMENT 'm-추정 자체 축소 계수 (초기 제안 3)',
  mu_ext                DECIMAL(8,4) NULL COMMENT 'μ: (빵,태그)별 전체 빵집 평균 비율(외부) — 배치가 매회 계산',
  mu_int                DECIMAL(8,4) NULL COMMENT 'μ: (빵,태그)별 전체 빵집 평균 비율(자체)',
  alpha                 DECIMAL(4,3) NOT NULL COMMENT '= internal_sample_count/(internal_sample_count+10) 행 단위 자동 산출',
  final_score           DECIMAL(8,4) NOT NULL COMMENT '= alpha*internal + (1-alpha)*external',
  formula_version       VARCHAR(20)  NOT NULL COMMENT '예: v1-mest-hl180 — 점수 재현·검증 근거',
  calculated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_scores (bakery_id, bread_id, tag_id),
  KEY idx_scores_lookup (bread_id, tag_id, final_score) COMMENT '추천 조회용: 트레이의 (빵,태그)로 검색',
  CONSTRAINT fk_scores_bakery FOREIGN KEY (bakery_id)        REFERENCES bakeries (id),
  CONSTRAINT fk_scores_tag    FOREIGN KEY (tag_id, bread_id) REFERENCES tags (id, bread_id),
  CONSTRAINT chk_counts CHECK (
    external_count >= 0 AND internal_count >= 0
    AND external_count <= external_sample_count
    AND internal_count <= internal_sample_count
  ),
  CONSTRAINT chk_alpha CHECK (alpha BETWEEN 0 AND 1),
  CONSTRAINT chk_scores CHECK (final_score >= 0)
) ENGINE=InnoDB COMMENT='④ 집계 배치 결과. 매 실행 전체 재계산(full refresh)';

-- ============================================================
-- 시드 데이터
-- ============================================================

-- 빵 8종 (픽스)
INSERT INTO breads (name, display_order) VALUES
  ('소금빵', 1),
  ('식빵', 2),
  ('크루아상', 3),
  ('베이글', 4),
  ('바게트', 5),
  ('치아바타', 6),
  ('휘낭시에', 7),
  ('에그타르트', 8);

-- 근본/사파 유형 태그 — 모든 빵에 시드 (is_type_tag = TRUE)
INSERT INTO tags (bread_id, name, is_type_tag)
SELECT id, '근본', TRUE FROM breads;
INSERT INTO tags (bread_id, name, is_type_tag)
SELECT id, '사파', TRUE FROM breads;

-- 맛·식감 태그 [확정 — 아이디어 회의 라벨 목록 기준, 2026-09-07 고정]
-- LLM 라벨링 사전과 트레이/리뷰 UI에 그대로 노출된다.
-- 태그 폐기는 DELETE가 아니라 is_active=false (물리 삭제 금지 원칙).
-- 회의에서 폐기된 항목은 시드하지 않음: '오리지널'(전 빵종), 바게트 '부속재료 유무'.
-- 2026-09-07 정리:
--   * 치아바타 '구멍'은 '기공'과 같은 특징이라 '기공' 하나로 통합.
--     리뷰 표현이 무엇이든 한 태그로 수렴시킨다 → LLM 프롬프트에 동의어 매핑 명시:
--     "구멍 / 기공 / 벌집 → '기공'". UI 문구만 "#기공(구멍 숭숭)"으로 풀어 쓸 수 있다.
--   * 식빵 '이색특징' 제거 — 식감·풍미가 아니라 '특이함' 메타 판정이고 그건 '사파'의 정의와 같다.
--     식빵에만 있어 빵 간 일관성도 깨졌으므로 사파로 흡수.
-- 보류(수집 PoC 데이터로 확정): 크루아상·바게트 태그 보강, '풍미' 구체화.
--   태그는 "리뷰에 실제로 많이 나오는 표현"이어야 LLM이 찾아낼 수 있다는 원칙에 따라
--   실제 리뷰에서 표현 빈도를 확인한 뒤 확정한다. 후보안은 docs/architecture.md '지금 단계' 참고.
INSERT INTO tags (bread_id, name) VALUES
  ((SELECT id FROM breads WHERE name = '소금빵'), '바삭'),
  ((SELECT id FROM breads WHERE name = '소금빵'), '촉촉'),
  ((SELECT id FROM breads WHERE name = '소금빵'), '버터 풍미'),
  ((SELECT id FROM breads WHERE name = '소금빵'), '짠맛'),
  ((SELECT id FROM breads WHERE name = '소금빵'), '쫄깃'),
  ((SELECT id FROM breads WHERE name = '식빵'), '쫄깃'),
  ((SELECT id FROM breads WHERE name = '식빵'), '부드럽'),
  ((SELECT id FROM breads WHERE name = '식빵'), '촉촉'),
  ((SELECT id FROM breads WHERE name = '식빵'), '버터'),
  ((SELECT id FROM breads WHERE name = '식빵'), '담백'),
  ((SELECT id FROM breads WHERE name = '식빵'), '고소'),
  ((SELECT id FROM breads WHERE name = '크루아상'), '바삭'),
  ((SELECT id FROM breads WHERE name = '크루아상'), '풍미'),
  ((SELECT id FROM breads WHERE name = '베이글'), '쫄깃'),
  ((SELECT id FROM breads WHERE name = '베이글'), '탄력감'),
  ((SELECT id FROM breads WHERE name = '베이글'), '밀도감'),
  ((SELECT id FROM breads WHERE name = '바게트'), '바삭'),
  ((SELECT id FROM breads WHERE name = '바게트'), '촉촉'),
  ((SELECT id FROM breads WHERE name = '치아바타'), '쫄깃'),
  ((SELECT id FROM breads WHERE name = '치아바타'), '기공'),
  ((SELECT id FROM breads WHERE name = '치아바타'), '올리브향'),
  ((SELECT id FROM breads WHERE name = '치아바타'), '폭신폭신'),
  ((SELECT id FROM breads WHERE name = '휘낭시에'), '촉촉'),
  ((SELECT id FROM breads WHERE name = '휘낭시에'), '바삭'),
  ((SELECT id FROM breads WHERE name = '휘낭시에'), '부드러움'),
  ((SELECT id FROM breads WHERE name = '휘낭시에'), '풍미'),
  ((SELECT id FROM breads WHERE name = '에그타르트'), '촉촉'),
  ((SELECT id FROM breads WHERE name = '에그타르트'), '바삭'),
  ((SELECT id FROM breads WHERE name = '에그타르트'), '풍미');

-- bakeries 시드: 빵산책 PDF + 대전 빵 축제 목록 확보 후 별도 INSERT 스크립트로 적재
-- collection_queries 시드: bakeries 확정 후 (빵집 × 빵) 조합으로 생성
