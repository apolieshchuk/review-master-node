import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Planet } from './planet.interface';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('randomPlanet')
  getRandomPlanet(): Promise<Planet> {
    return this.appService.getRandomPlanet();
  }
}
