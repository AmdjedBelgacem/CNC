import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';
import { quotes } from '../../database/schema/quotes';

@Injectable()
export class QuotesService {
  constructor(private drizzle: DrizzleService) {}

  async create(data: { name: string; email: string; company: string; message?: string }) {
    const [quote] = await this.drizzle.db.insert(quotes).values(data).returning();
    return quote;
  }
}
