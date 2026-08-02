import "server-only";
import type { PipelineReadService } from "@/application/ports/outbound/pipeline-read-service";
import { MongoPipelineReadService } from "@/infrastructure/database/mongo/mongo-pipeline-read-service";

let pipeline: PipelineReadService | undefined;
export function getPipelineReadService(): PipelineReadService {
	pipeline ??= new MongoPipelineReadService();
	return pipeline;
}
