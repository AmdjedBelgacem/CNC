import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  controllers: [ProductsController, AdminProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
