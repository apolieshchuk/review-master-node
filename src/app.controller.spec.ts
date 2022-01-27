import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CacheModule, InternalServerErrorException } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { Planet } from './planet.interface';
import { AxiosResponse } from 'axios';
import { catchError } from 'rxjs/operators';

describe('AppController', () => {
  let appController: AppController;
  let httpService: HttpService;
  let planet: Planet;
  let cache: Cache;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [CacheModule.register(), HttpModule, ConfigModule.forRoot()],
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    appController = app.get<AppController>(AppController);
    httpService = app.get<HttpService>(HttpService);
    // cache = app.get<Cache>(Cache);
    planet = {
      name: '',
      rotation_period: '',
      orbital_period: '',
      diameter: '',
      climate: '',
      gravity: '',
      terrain: '',
      surface_water: '',
      population: '',
      residents: [],
      films: [],
      created: '',
      edited: '',
      url: '',
    };
  });

  it('Should return Planet object from http get call to adapter-node', async () => {
    const response: AxiosResponse<Planet> = {
      data: planet,
      status: 200,
      statusText: 'OK',
      config: {},
      headers: {},
    };
    jest.spyOn(httpService, 'get').mockImplementationOnce(() => of(response));

    const randomPlanet = await appController.getRandomPlanet();
    expect(randomPlanet).toBe(planet);
  });

  it('After get 500 error from adapter-node, should send N-number or retry-requests', async () => {
    jest.setTimeout(AppService.RETRIES * 2000);

    let retriesCounter = 0;
    httpService.get = jest.fn().mockImplementation(() => {
      return throwError(new InternalServerErrorException()).pipe(
        catchError((err) => {
          retriesCounter++;
          return throwError(err);
        }),
      );
    });

    try {
      await appController.getRandomPlanet();
    } catch (e) {
      expect(retriesCounter).toBe(AppService.RETRIES + 1);
    }
  });

  it('After get 500 error from adapter-node N-times, should throw timeout exception', async () => {
    jest.setTimeout(AppService.RETRIES * 2000);
    httpService.get = jest.fn().mockImplementation(() => {
      return throwError(new InternalServerErrorException());
    });

    try {
      await appController.getRandomPlanet();
    } catch (e) {
      expect(+e.status).toBe(504);
    }
  });
});
