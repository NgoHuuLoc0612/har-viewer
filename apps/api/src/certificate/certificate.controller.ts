import { Controller, Get, Query, Param } from '@nestjs/common';
import { CertificateService } from './certificate.service';

@Controller('api/certificate')
export class CertificateController {
  constructor(private certService: CertificateService) {}

  @Get('inspect')
  async inspect(
    @Query('host') host: string,
    @Query('port') port?: string,
  ) {
    if (!host) return { error: 'host is required' };
    const portNum = port ? parseInt(port) : 443;
    return this.certService.fetchCertificateChain(host, portNum);
  }

  @Get('inspect-har/:uuid')
  async inspectFromHar(
    @Param('uuid') uuid: string,
    @Query('host') host: string,
  ) {
    return this.certService.fetchCertificateChain(host, 443);
  }
}
