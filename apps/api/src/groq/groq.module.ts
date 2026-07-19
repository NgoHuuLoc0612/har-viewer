import { Module } from '@nestjs/common';
import { GroqController } from './groq.controller';
import { GroqService } from './groq.service';
import { HarModule } from '../har/har.module';

@Module({
  imports: [HarModule],
  controllers: [GroqController],
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}
