import { Controller, Get, Post, Param, Body, HttpException, HttpStatus } from '@nestjs/common';
import { GroqService } from './groq.service';
import { HarService } from '../har/har.service';

@Controller('api/groq')
export class GroqController {
  constructor(
    private groqService: GroqService,
    private harService: HarService,
  ) {}

  @Get('models')
  async getModels() {
    return this.groqService.getAvailableModels();
  }

  @Post('analyze/:uuid')
  async analyze(
    @Param('uuid') uuid: string,
    @Body() body: { prompt?: string; model?: string; analysisType?: string },
  ) {
    if (!body.model) {
      throw new HttpException('model is required', HttpStatus.BAD_REQUEST);
    }

    let analysis: any;
    try {
      analysis = await this.harService.getAnalysis(uuid);
    } catch {
      throw new HttpException(`HAR file ${uuid} not found`, HttpStatus.NOT_FOUND);
    }

    // Let groq.service throw typed HttpExceptions — they propagate correctly
    return this.groqService.analyzeHar(
      analysis,
      body.prompt || 'Analyze this HAR file and provide comprehensive insights.',
      body.model,
      body.analysisType || 'general',
    );
  }

  @Post('chat/:uuid')
  async chat(
    @Param('uuid') uuid: string,
    @Body() body: { messages: Array<{ role: string; content: string }>; model?: string },
  ) {
    if (!body.model) {
      throw new HttpException('model is required', HttpStatus.BAD_REQUEST);
    }
    if (!body.messages?.length) {
      throw new HttpException('messages array is required', HttpStatus.BAD_REQUEST);
    }

    let file: any;
    try {
      file = await this.harService.getHarFile(uuid);
    } catch {
      throw new HttpException(`HAR file ${uuid} not found`, HttpStatus.NOT_FOUND);
    }

    const context = {
      entryCount:  file.entryCount,
      domains:     (file.analysisData as any)?.domains,
      avgDuration: (file.analysisData as any)?.dashboard?.timingSummary?.avgDuration,
      failed:      (file.analysisData as any)?.dashboard?.requestSummary?.failed,
    };

    const result = await this.groqService.chatWithHar(body.messages, context, body.model);
    return { result };
  }
}
