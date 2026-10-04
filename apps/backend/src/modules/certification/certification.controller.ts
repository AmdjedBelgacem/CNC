import { Controller, Get, Post, Param, Req, Res, UseGuards, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CertificationService } from './certification.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('certifications')
@Controller('certifications')
export class CertificationController {
  constructor(private certs: CertificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  @ApiOperation({ summary: 'Get my certifications' })
  findMy(@CurrentUser() user: { id: string }) {
    return this.certs.findByUser(user.id);
  }

  @Public()
  @Get('verify/:number')
  @ApiOperation({ summary: 'Verify a certificate by number' })
  verify(@Param('number') number: string) {
    return this.certs.verify(number);
  }

  /**
   * Download the PDF for one of my certificates.
   *
   * Streams the bytes rather than redirecting: the storage key is a capability
   * URL, and handing it to a browser in a Location header would leak it into
   * history and referrers. Content-Disposition is set so the browser saves the
   * file under a meaningful name.
   */
  @UseGuards(JwtAuthGuard)
  @Get('my/:id/download')
  @ApiOperation({ summary: 'Download my certificate PDF' })
  async downloadMine(
    @CurrentUser() user: { id: string; tenantId: string; role: string },
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const cert = await this.certs.getForDownload(id, {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role ?? 'learner',
    });
    if (cert.userId !== user.id) {
      // Admins use the admin download route; the learner route is owner-only so
      // an admin session cannot be used to read a learner's file by guessing ids.
      const role = (req.user as any)?.role;
      if (!['super_admin', 'admin'].includes(role)) throw new ForbiddenException('Not your certificate');
    }
    const body = await this.certs.loadDocument(cert as never);
    if (!body) {
      throw new NotFoundException('No stored PDF for this certificate yet');
    }
    const filename = `certificate-${cert.certificateNumber}.pdf`;
    res.header('content-type', 'application/pdf');
    res.header('content-disposition', `attachment; filename="${filename}"`);
    res.header('content-length', String(body.length));
    res.header('cache-control', 'private, no-store');
    return res.send(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('issue/:courseId')
  @ApiOperation({ summary: 'Issue certificate for completed course' })
  issue(
    @CurrentUser() user: { id: string },
    @CurrentTenant() tenant: { id: string },
    @Param('courseId') courseId: string,
  ) {
    return this.certs.issue(user.id, courseId, tenant.id);
  }
}
