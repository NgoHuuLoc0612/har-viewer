import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DB_TOKEN } from '../database/database.module';
import * as schema from '../database/schema';
import { HarParserService } from './har-parser.service';

@Processor('har-analysis')
export class HarAnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(HarAnalysisProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private db: NodePgDatabase<typeof schema>,
    private parser: HarParserService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    const { harFileId, uuid, content, fileName, fileSize } = job.data as {
      harFileId: number; uuid: string; content: string; fileName: string; fileSize: number;
    };
    this.logger.log(`Processing HAR analysis for ${uuid}`);

    try {
      await job.updateProgress(10);
      const harFile = this.parser.parseHarFile(content);
      await job.updateProgress(30);
      const analysis = this.parser.fullAnalysis(harFile, fileName, fileSize, content);
      await job.updateProgress(80);

      const analysisJson = JSON.stringify(analysis);

      await this.db.execute(
        sql`UPDATE har_files
            SET status = 'complete',
                analysis_data = ${analysisJson}::jsonb,
                updated_at = NOW()
            WHERE id = ${harFileId}`
      );

      await job.updateProgress(100);
      this.logger.log(`Completed: ${uuid} — ${analysis.entries.length} entries`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed: ${uuid} — ${error.message}`);
      try {
        await this.db.execute(
          sql`UPDATE har_files
              SET status = 'error',
                  error_message = ${error.message},
                  updated_at = NOW()
              WHERE id = ${harFileId}`
        );
      } catch (_) {}
      throw error;
    }
  }
}
