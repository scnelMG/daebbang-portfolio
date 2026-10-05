package com.bangtray.domain.collection;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CollectionQueryRepository extends JpaRepository<CollectionQuery, Long> {

	List<CollectionQuery> findByIsActiveTrue();
}
