import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'OfficeCore API - Run your office in one place';
  }
}
