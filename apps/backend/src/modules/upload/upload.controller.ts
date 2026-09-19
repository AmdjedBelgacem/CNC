import { Controller, Post, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantScopeGuard } from '../auth/guards/tenant-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from './upload.constants';

class PresignedUploadDto {
  @IsString() @Matches(/^[a-zA-Z0-9._-]{1,120}$/, { message: 'key must be 1-120 chars [a-zA-Z0-9._-]' })
  key!: string;

  @IsString() contentType!: string;

  @IsOptional() @IsString() @MaxLength(30) folder?: string;
}

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  constructor(private upload: UploadService) {}

  @Post('presigned')
  @UseGuards(JwtAuthGuard, TenantGuard, TenantScopeGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get presigned upload URL (tenant-scoped, auth required, 15m TTL)' })
  getPresignedUrl(@CurrentUser() user: any, @Body() body: PresignedUploadDto) {
    const contentType = String(body.contentType || '').toLowerCase().trim();
    if (!ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException(
        `Unsupported content type "${body.contentType}". Allowed: ${[...ALLOWED_UPLOAD_CONTENT_TYPES].join(', ')}`,
      );
    }
    const tenantId = String(user.tenantId || '');
    return this.upload.getPresignedUploadUrlForTenant(
      tenantId,
      user.id,
      body.key,
      contentType,
      body.folder,
      MAX_UPLOAD_BYTES,
    );
  }
}
