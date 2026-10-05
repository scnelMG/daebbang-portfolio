package com.bangtray.domain.label;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentLabelRepository extends JpaRepository<DocumentLabel, Long> {

	/** UNIQUE(mongo_doc_id, tag_id) 선확인 — 재실행 시 중복 INSERT 방지 */
	boolean existsByMongoDocIdAndTagId(String mongoDocId, Integer tagId);
}
