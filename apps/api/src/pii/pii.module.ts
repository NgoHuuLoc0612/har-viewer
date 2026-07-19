import { Module } from '@nestjs/common';
import { PiiController } from './pii.controller';
import { PiiScannerService } from './pii-scanner.service';

@Module({
  controllers: [PiiController],
  providers: [PiiScannerService],
  exports: [PiiScannerService],
})
export class PiiModule {}
