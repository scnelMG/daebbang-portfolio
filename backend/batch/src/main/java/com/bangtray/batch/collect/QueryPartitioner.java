package com.bangtray.batch.collect;

import com.bangtray.domain.collection.CollectionQuery;
import com.bangtray.domain.collection.CollectionQueryRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.batch.core.partition.Partitioner;
import org.springframework.batch.infrastructure.item.ExecutionContext;
import org.springframework.stereotype.Component;

/**
 * 설계 확정: Source×Bakery 조합 단위 파티션 병렬.
 * 활성 쿼리를 (source, bakery) 그룹으로 묶어 파티션마다 쿼리 id 목록을 배정한다.
 */
@Component
@RequiredArgsConstructor
public class QueryPartitioner implements Partitioner {

	private final CollectionQueryRepository queryRepository;

	@Override
	public Map<String, ExecutionContext> partition(int gridSize) {
		List<CollectionQuery> active = queryRepository.findByIsActiveTrue();

		Map<String, List<Long>> groups = new LinkedHashMap<>();
		for (CollectionQuery query : active) {
			String key = query.getSource() + "|" + query.getBakeryId();
			groups.computeIfAbsent(key, k -> new ArrayList<>()).add(query.getId());
		}

		Map<String, ExecutionContext> partitions = new LinkedHashMap<>();
		int index = 0;
		for (Map.Entry<String, List<Long>> group : groups.entrySet()) {
			ExecutionContext context = new ExecutionContext();
			context.putString("groupKey", group.getKey());
			context.putString("queryIds", group.getValue().stream()
					.map(String::valueOf)
					.collect(Collectors.joining(",")));
			partitions.put("partition" + index++, context);
		}
		return partitions;
	}
}
