import { Controller, Post, Param, Inject } from '@nestjs/common';
import { PiiScannerService } from './pii-scanner.service';
import { DB_TOKEN } from '../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';

@Controller('api/pii')
export class PiiController {
  constructor(
    private piiService: PiiScannerService,
    @Inject(DB_TOKEN) private db: NodePgDatabase<typeof schema>,
  ) {}

  @Post('scan/:uuid')
  async scan(@Param('uuid') uuid: string) {
    const [file] = await this.db.select()
      .from(schema.harFiles)
      .where(eq(schema.harFiles.uuid, uuid));
    if (!file) return { error: 'HAR file not found' };
    const analysis = file.analysisData as any;
    if (!analysis) return { error: 'Analysis not complete' };
    return this.piiService.scanHar(analysis);
  }
}
