import { Controller, Post, Get, Delete, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { HarService } from './har.service';
import { ExportService } from '../export/export.service';

@Controller('api/har')
export class HarController {
  constructor(private harService: HarService, private exportService: ExportService) {}

  @Post('upload')
  async upload(@Body() body: { content: string; fileName: string }) {
    return this.harService.uploadHar(body.content, body.fileName);
  }

  @Get()
  async list() { return this.harService.getAllHarFiles(); }

  @Get(':uuid')
  async getFile(@Param('uuid') uuid: string) { return this.harService.getHarFile(uuid); }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('uuid') uuid: string) { return this.harService.deleteHarFile(uuid); }

  @Get(':uuid/status')
  async getStatus(@Param('uuid') uuid: string) { return this.harService.getAnalysisStatus(uuid); }

  @Get(':uuid/analysis')
  async getAnalysis(@Param('uuid') uuid: string) { return this.harService.getAnalysis(uuid); }

  @Get(':uuid/entries')
  async getEntries(@Param('uuid') uuid: string, @Query() query: Record<string, any>) {
    return this.harService.getEntries(uuid, query);
  }

  @Get(':uuid/entries/:index')
  async getEntry(@Param('uuid') uuid: string, @Param('index') index: string) {
    return this.harService.getEntry(uuid, parseInt(index));
  }

  @Get(':uuid/search')
  async search(@Param('uuid') uuid: string, @Query('q') query: string, @Query('fields') fields: string) {
    return this.harService.searchEntries(uuid, query, fields ? fields.split(',') : []);
  }

  @Get(':uuid/export')
  async export(@Param('uuid') uuid: string, @Query('format') format: string, @Query('entries') entriesParam?: string) {
    const entryIndices = entriesParam ? entriesParam.split(',').map(Number) : undefined;
    return this.exportService.exportHar(uuid, format as any, entryIndices);
  }

  @Post('compare')
  async compare(@Body() body: { uuidA: string; uuidB: string }) {
    return this.harService.compareHarFiles(body.uuidA, body.uuidB);
  }
}
