import { Injectable } from '@nestjs/common';
import { DrizzleService } from '../../database/drizzle.service';

@Injectable()
export class TitanTvService {
  constructor(private drizzle: DrizzleService) {}

  async findAll() {
    return this.drizzle.db.query.videoSeries.findMany({
      orderBy: (vs: any, { asc }: any) => asc(vs.sortOrder),
      with: {
        videos: {
          orderBy: (v: any, { asc }: any) => asc(v.sortOrder),
        },
      },
    });
  }
}
