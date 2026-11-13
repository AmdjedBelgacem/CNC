import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DrizzleService } from '../../database/drizzle.service';
import { videoSeries } from '../../database/schema/videos';

@Injectable()
export class TitanTvService {
  constructor(private drizzle: DrizzleService) {}

  /** The library of one tenant. Unscoped, it listed every tenant's series and video URLs. */
  async findAll(tenantId: string) {
    return this.drizzle.db.query.videoSeries.findMany({
      where: eq(videoSeries.tenantId, tenantId),
      orderBy: (vs: any, { asc }: any) => asc(vs.sortOrder),
      with: {
        videos: {
          orderBy: (v: any, { asc }: any) => asc(v.sortOrder),
        },
      },
    });
  }
}
