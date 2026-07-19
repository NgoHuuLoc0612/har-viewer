import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { HarController } from './har.controller';
import { HarService } from './har.service';
import { HarParserService } from './har-parser.service';
import { HarAnalysisProcessor } from './har-analysis.processor';
import { ExportService } from '../export/export.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'har-analysis' }),
  ],
  controllers: [HarController],
  providers: [HarService, HarParserService, HarAnalysisProcessor, ExportService],
  exports: [HarService],
})
export class HarModule {}
