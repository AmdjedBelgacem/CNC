import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
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
