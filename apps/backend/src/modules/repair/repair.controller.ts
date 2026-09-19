import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RepairService } from './repair.service';

@ApiTags('repair')
@Controller('repair')
export class RepairController {
  constructor(private repair: RepairService) {}

  @Get()
  @ApiOperation({ summary: 'List repair shops with filters' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.repair.findAll({
      category,
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get repair shop by ID' })
  findById(@Param('id') id: string) {
    return this.repair.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a repair shop listing' })
  create(@Body() body: any) {
    return this.repair.create(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a repair shop' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.repair.update(id, body);
  }
}
