import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { StudyGroupsService } from './study-groups.service';
import { CreateGroupDto, UpdateGroupDto } from './dto/create-group.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

/**
 * Study groups. One controller, both halves of the contract:
 *
 *   public reads   -> `@Public()`, no caller identity required
 *   detail         -> `@Public() + OptionalAuthGuard`, so an anonymous visitor still gets the group
 *                     while a signed-in one also gets `isMember`/`isHost` without a second request
 *   all mutations  -> `JwtAuthGuard`; "may I?" is decided in the service, because the rule is
 *                     "the host OR a site manager", which `@Roles` cannot express as an OR with
 *                     an ownership check
 *
 * Static segments (`cities`, `mine`) are declared before `:id`. Nest matches in declaration
 * order, so `cities` behind `:id` would be read as a group id and fail the UUID pipe with a 400
 * instead of returning the city list.
 */
@ApiTags('study-groups')
@Controller('social/groups')
export class StudyGroupsController {
  constructor(private svc: StudyGroupsService) {}

  // -- public reads ---------------------------------------------------------

  @Public()
  @Get()
  @ApiOperation({ summary: 'List active study groups' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'academy', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('academy') academy?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.list({
      search,
      city,
      academy,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Public()
  @Get('cities')
  @ApiOperation({ summary: 'Cities that have at least one active group' })
  findCities() {
    return this.svc.listCities();
  }

  // -- caller-scoped read ---------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({ summary: 'Groups the signed-in user belongs to or hosts' })
  findMine(@CurrentUser() user: { id: string }) {
    return this.svc.mine(user.id);
  }

  // -- public detail --------------------------------------------------------

  @Public()
  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'One group, with members and the viewer relationship' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user?: { id: string; role?: string }) {
    return this.svc.detail(id, user);
  }

  // -- mutations ------------------------------------------------------------

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Create a group; the caller becomes host and first member' })
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: { id: string }) {
    return this.svc.create(dto, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  @ApiOperation({ summary: 'Edit a group (host or site manager)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: { id: string; role?: string },
  ) {
    return this.svc.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a group and its memberships (host or site manager)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string; role?: string }) {
    return this.svc.remove(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a group (idempotent)' })
  join(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.svc.join(id, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave a group; the host role is handed to the oldest member' })
  leave(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: { id: string }) {
    return this.svc.leave(id, user.id);
  }
}
