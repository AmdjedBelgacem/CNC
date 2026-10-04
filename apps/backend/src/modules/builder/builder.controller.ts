import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BuilderService, Actor } from './builder.service';
import { NavigationService } from './navigation.service';
import {
  CreatePageDto,
  UpdatePageDto,
  DuplicatePageDto,
  SaveNavigationDto,
  SavePageDto,
  PublishDto,
  RevertDto,
  SaveThemeDto,
  SaveSavedSectionDto,
  RenameSavedSectionDto,
} from './dto/builder.dto';

@ApiTags('builder')
@ApiBearerAuth()
@Controller('builder')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles('super_admin', 'admin')
export class BuilderController {
  constructor(
    private builder: BuilderService,
    private navigation: NavigationService,
  ) {}

  private ctx(req: any) {
    return {
      ip: req?.ip,
      userAgent: (req?.headers?.['user-agent'] as string) || undefined,
    };
  }

  // ---------------------------------------------------------------- pages

  @Get('pages')
  @ApiOperation({ summary: 'List pages for the current tenant' })
  async listPages(@CurrentTenant() tenant: any) {
    return this.builder.listPages(this.builder.assertTenant(tenant));
  }

  @Post('pages')
  @ApiOperation({ summary: 'Create a new page' })
  async createPage(
    @CurrentTenant() tenant: any,
    @Body() dto: CreatePageDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.createPage(this.builder.assertTenant(tenant), dto, user, this.ctx(req));
  }

  @Patch('pages/:slug')
  @ApiOperation({
    summary: 'Update a page: title, slug, status (draft/published/disabled), nav visibility, SEO',
  })
  async updatePage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.updatePage(this.builder.assertTenant(tenant), slug, dto, user, this.ctx(req));
  }

  @Post('pages/:slug/duplicate')
  @ApiOperation({ summary: 'Copy a page (layout, SEO, template) under a new slug as a draft' })
  async duplicatePage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @Body() dto: DuplicatePageDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.duplicatePage(this.builder.assertTenant(tenant), slug, dto, user, this.ctx(req));
  }

  @Delete('pages/:slug')
  @ApiOperation({ summary: 'Delete a page. Built-in pages cannot be deleted, only disabled.' })
  async deletePage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.deletePage(this.builder.assertTenant(tenant), slug, user, this.ctx(req));
  }

  @Get('pages/:slug')
  @ApiOperation({ summary: 'Get a page (auto-provisions the built-in slugs with the default layout)' })
  async getPage(@CurrentTenant() tenant: any, @Param('slug') slug: string, @Req() req: any) {
    // The locale resolver reads the cookie, then `?locale=`, then the header.
    return this.builder.getPage(this.builder.assertTenant(tenant), slug, req);
  }

  @Put('pages/:slug')
  @ApiOperation({ summary: 'Save a draft layout' })
  async savePage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @Body() dto: SavePageDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.savePage(this.builder.assertTenant(tenant), slug, dto, user, this.ctx(req));
  }

  @Post('pages/:slug/publish')
  @ApiOperation({ summary: 'Save and publish the current layout atomically' })
  async publishPage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.publishPage(
      this.builder.assertTenant(tenant),
      slug,
      dto,
      user,
      this.ctx(req),
    );
  }

  @Post('pages/:slug/revert')
  @ApiOperation({ summary: 'Restore a previous published version as a new draft' })
  async revertPage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @Body() dto: RevertDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.revertPage(this.builder.assertTenant(tenant), slug, dto.version, user, this.ctx(req));
  }

  @Post('pages/:slug/reset')
  @ApiOperation({ summary: 'Reset the page to the default layout' })
  async resetPage(
    @CurrentTenant() tenant: any,
    @Param('slug') slug: string,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.resetPage(this.builder.assertTenant(tenant), slug, user, this.ctx(req));
  }

  @Get('pages/:slug/versions')
  @ApiOperation({ summary: 'Version history for a page' })
  async getPageVersions(@CurrentTenant() tenant: any, @Param('slug') slug: string) {
    return this.builder.getPageVersions(this.builder.assertTenant(tenant), slug);
  }

  // ---------------------------------------------------------------- saved sections

  @Get('saved-sections')
  @ApiOperation({ summary: 'List saved sections for the current tenant' })
  async listSavedSections(@CurrentTenant() tenant: any) {
    return this.builder.listSavedSections(this.builder.assertTenant(tenant));
  }

  @Post('saved-sections')
  @ApiOperation({ summary: 'Save a section subtree as a reusable component' })
  async saveSavedSection(
    @CurrentTenant() tenant: any,
    @Body() dto: SaveSavedSectionDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.saveSavedSection(this.builder.assertTenant(tenant), dto, user, this.ctx(req));
  }

  @Put('saved-sections/:id')
  @ApiOperation({ summary: 'Rename a saved section' })
  async renameSavedSection(
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @Body() dto: RenameSavedSectionDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.renameSavedSection(this.builder.assertTenant(tenant), id, dto, user, this.ctx(req));
  }

  @Delete('saved-sections/:id')
  @ApiOperation({ summary: 'Delete a saved section' })
  async deleteSavedSection(
    @CurrentTenant() tenant: any,
    @Param('id') id: string,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.deleteSavedSection(this.builder.assertTenant(tenant), id, user, this.ctx(req));
  }

  // ---------------------------------------------------------------- themes

  @Get('themes')
  @ApiOperation({ summary: 'Get the current theme for the tenant' })
  async getTheme(@CurrentTenant() tenant: any) {
    return this.builder.getTheme(this.builder.assertTenant(tenant));
  }

  @Put('themes')
  @ApiOperation({ summary: 'Save theme tokens as a draft' })
  async saveTheme(
    @CurrentTenant() tenant: any,
    @Body() dto: SaveThemeDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.saveTheme(this.builder.assertTenant(tenant), dto, user, this.ctx(req));
  }

  @Post('themes/publish')
  @ApiOperation({ summary: 'Publish the current theme tokens' })
  async publishTheme(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.publishTheme(this.builder.assertTenant(tenant), user, this.ctx(req));
  }

  @Post('themes/revert')
  @ApiOperation({ summary: 'Restore a previous published theme as a draft' })
  async revertTheme(
    @CurrentTenant() tenant: any,
    @Body() dto: RevertDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.revertTheme(this.builder.assertTenant(tenant), dto.version, user, this.ctx(req));
  }

  @Post('themes/reset')
  @ApiOperation({ summary: 'Reset the theme to default tokens' })
  async resetTheme(
    @CurrentTenant() tenant: any,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.builder.resetTheme(this.builder.assertTenant(tenant), user, this.ctx(req));
  }

  @Get('themes/versions')
  @ApiOperation({ summary: 'Version history for the theme' })
  async getThemeVersions(@CurrentTenant() tenant: any) {
    return this.builder.getThemeVersions(this.builder.assertTenant(tenant));
  }

  // ----------------------------------------------------------- navigation

  @Get('navigation')
  @ApiOperation({ summary: 'The tenant navigation tree, unfiltered, for the nav editor' })
  async getNavigation(@CurrentTenant() tenant: any) {
    return this.navigation.getTree(this.builder.assertTenant(tenant));
  }

  @Put('navigation')
  @ApiOperation({ summary: 'Replace the tenant navigation tree in one transaction' })
  async saveNavigation(
    @CurrentTenant() tenant: any,
    @Body() dto: SaveNavigationDto,
    @CurrentUser() user: Actor,
    @Req() req: any,
  ) {
    return this.navigation.saveTree(
      this.builder.assertTenant(tenant),
      dto.items as never,
      user,
      this.ctx(req),
    );
  }
}
